// TABA M2 progression — the derived selectors.
//
// Everything downstream of the two stored fields (`jpLedger`, `unlocks`) is
// COMPUTED here, never persisted (rule 5 — computed values never cached in
// state). All selectors are pure and take the static component catalog as a
// parameter (table-driven), so they work identically against the production
// catalog and test fixtures.
//
// The chain:
//   unlocks + catalog  →  spentByTierSlot  →  unlockedTiers  →  reclassableClasses
// and, independently, `jpLedger → availableJp`.

import type { ClassId } from '@engine/index.ts';
import type { CampaignUnit } from '../types.ts';
import type { ComponentCatalog } from './component-catalog.ts';
import { componentMetaOf } from './component-catalog.ts';
import {
  classesInSlot,
  slotOf,
  tierEntryOf,
  tierSlot,
  type ClassTier,
  type TierSlot,
} from './tier-map.ts';
import {
  HYBRID_T2_EACH_HALF_TIER1_SPEND,
  HYBRID_T3_FROM_HYBRID_T2_SPEND,
  OTHER_HALF_TIER1_FROM_TIER1_SPEND,
  TIER2_FROM_TIER1_SPEND,
  TIER3_TIER1_SPEND,
  TIER3_TIER2_SPEND,
} from './thresholds.ts';

// JP earned in a class (0 if none). Reads the stored per-class pool.
export function earnedInClass(unit: CampaignUnit, classId: ClassId): number {
  return unit.earnedByClass[classId] ?? 0;
}

// JP already spent in a class — DERIVED: the sum of that class's unlocked
// components' costs (rule 5, never stored). Buying an ability spends its
// native class's JP.
export function spentInClass(
  unit: CampaignUnit,
  classId: ClassId,
  catalog: ComponentCatalog,
): number {
  let sum = 0;
  for (const token of unit.unlocks) {
    const meta = componentMetaOf(token, catalog);
    if (meta.nativeClass === classId) sum += meta.cost;
  }
  return sum;
}

// JP the unit can still spend IN A CLASS: that class's earnings minus its
// unlock spend. Affordability for buying a component reads this against the
// component's native class.
export function availableInClass(
  unit: CampaignUnit,
  classId: ClassId,
  catalog: ComponentCatalog,
): number {
  return earnedInClass(unit, classId) - spentInClass(unit, classId, catalog);
}

// Cumulative JP spent, bucketed by the (half, tier) slot each unlock's native
// class sits in. The tier-gating currency (brief: "JP spent in a tier, on a
// half"). Derived from `unlocks` + the catalog — never stored. Unchanged by
// the per-class split: spend was always attributed by native class.
export function spentByTierSlot(
  unit: CampaignUnit,
  catalog: ComponentCatalog,
): ReadonlyMap<TierSlot, number> {
  const out = new Map<TierSlot, number>();
  for (const token of unit.unlocks) {
    const meta = componentMetaOf(token, catalog);
    const slot = slotOf(tierEntryOf(meta.nativeClass));
    out.set(slot, (out.get(slot) ?? 0) + meta.cost);
  }
  return out;
}

// Which (half, tier) slots the unit currently has open. Derived from the
// per-slot spend + the unit's CURRENT class (you're in it, so its slot — and,
// for a non-hybrid, every tier you climbed through to reach it — is open).
//
// Threshold rules (thresholds.ts):
//   - 500 in a half's T1 → that half's T2 + the OTHER half's T1.
//   - 1000 in a half's T1 + 500 in that half's T2 → that half's T3.
//   - 500 in BOTH halves' T1 → hybrid T2.
//   - 1000 in hybrid T2 → hybrid T3 (seam; no class occupies it).
export function unlockedTiers(
  unit: CampaignUnit,
  catalog: ComponentCatalog,
): ReadonlySet<TierSlot> {
  const open = new Set<TierSlot>();

  // Seed: the current class's slot is always open. For a physical/magical
  // class, every tier from 1 up to the current one is open too (you climbed
  // through them — so you can reclass back down within your half). A hybrid
  // has no T1 of its own; its prerequisite T1 openness falls out of the spend
  // rules below.
  const cur = tierEntryOf(unit.classId);
  if (cur.half === 'hybrid') {
    open.add(slotOf(cur));
  } else {
    for (let t = 1 as ClassTier; t <= cur.tier; t = (t + 1) as ClassTier) {
      open.add(tierSlot(cur.half, t));
    }
  }

  const spent = spentByTierSlot(unit, catalog);
  const at = (slot: TierSlot): number => spent.get(slot) ?? 0;
  const pT1 = at('physical:1');
  const mT1 = at('magical:1');
  const pT2 = at('physical:2');
  const mT2 = at('magical:2');
  const hT2 = at('hybrid:2');

  // 500 in a half's T1 → that half's T2 + the other half's T1.
  if (pT1 >= TIER2_FROM_TIER1_SPEND) open.add('physical:2');
  if (pT1 >= OTHER_HALF_TIER1_FROM_TIER1_SPEND) open.add('magical:1');
  if (mT1 >= TIER2_FROM_TIER1_SPEND) open.add('magical:2');
  if (mT1 >= OTHER_HALF_TIER1_FROM_TIER1_SPEND) open.add('physical:1');

  // 1000 in a half's T1 + 500 in that half's T2 → that half's T3.
  if (pT1 >= TIER3_TIER1_SPEND && pT2 >= TIER3_TIER2_SPEND) open.add('physical:3');
  if (mT1 >= TIER3_TIER1_SPEND && mT2 >= TIER3_TIER2_SPEND) open.add('magical:3');

  // 500 in BOTH halves' T1 → hybrid T2.
  if (pT1 >= HYBRID_T2_EACH_HALF_TIER1_SPEND && mT1 >= HYBRID_T2_EACH_HALF_TIER1_SPEND) {
    open.add('hybrid:2');
  }

  // 1000 in hybrid T2 → hybrid T3 (capstone seam — no class fills it yet).
  if (hT2 >= HYBRID_T3_FROM_HYBRID_T2_SPEND) open.add('hybrid:3');

  return open;
}

// Which classes the unit may currently reclass into: every class sitting in an
// unlocked tier slot, plus the plot-unique `classAccessOverride` (unioned in
// unconditionally — a pre-unlock grants access without opening that tier for
// generics). Pure over campaign-unit state + static tables.
export function reclassableClasses(
  unit: CampaignUnit,
  catalog: ComponentCatalog,
): ReadonlyArray<ClassId> {
  const out = new Set<ClassId>();
  for (const slot of unlockedTiers(unit, catalog)) {
    for (const id of classesInSlot(slot)) out.add(id);
  }
  for (const id of unit.classAccessOverride ?? []) out.add(id);
  return [...out];
}
