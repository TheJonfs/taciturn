// TABA M2 progression — the ledger-mutating operations + export gating.
//
// Pure functions returning a NEW `CampaignUnit` (immutable; the campaign owns
// no reducer of its own — these compose into the roster update at the
// between-battle boundary). Three operations:
//   - `unlockComponent` — spend JP to buy an unlock.
//   - `grantJp` / `grantOnClassUnlock` — the tier-scaled grant on class unlock.
//   - `canEquipPassive` — the R/S/M export-gating query (roster-side; the
//     engine has no native-class concept — see the M2 substrate audit).

import type { AbilityId, ClassId } from '@engine/index.ts';
import { deriveActionSeed } from '@engine/index.ts';
import type { CampaignUnit } from '../types.ts';
import type { ComponentCatalog } from './component-catalog.ts';
import { componentMetaOf } from './component-catalog.ts';
import { availableInClass } from './ledger.ts';
import { hasToken, tokenKey, type UnlockToken } from './tokens.ts';
import type { ClassTier } from './tier-map.ts';

// --- Spend -----------------------------------------------------------------

// Buy an unlock: append the token. Spend is DERIVED (the unlock IS the record
// of spend), so nothing else is written — the component's cost is now counted
// against its native class's pool by `spentInClass`. Fails loud (CLAUDE.md: no
// silent fallbacks) if the token is already owned or the unit can't afford it
// in the component's native class — a caller pre-checks `availableInClass` for
// UX, but this is the authoritative gate.
export function unlockComponent(
  unit: CampaignUnit,
  token: UnlockToken,
  catalog: ComponentCatalog,
): CampaignUnit {
  const owned = new Set(unit.unlocks.map(tokenKey));
  if (hasToken(owned, token)) {
    throw new Error(`unlockComponent: '${tokenKey(token)}' is already unlocked`);
  }
  const meta = componentMetaOf(token, catalog);
  const available = availableInClass(unit, meta.nativeClass, catalog);
  if (meta.cost > available) {
    throw new Error(
      `unlockComponent: '${tokenKey(token)}' costs ${meta.cost} ${String(meta.nativeClass)} JP ` +
        `but only ${available} available`,
    );
  }
  return { ...unit, unlocks: [...unit.unlocks, token] };
}

// --- Grant -----------------------------------------------------------------

// Tier-scaled unlock grant on class unlock (brief): Tier 1 = 100 + random,
// Tier 2 = 200 + random, Tier 3 = 300 + random. The base is the earned
// head-start for reaching a later tier; the random is a small deterministic
// bonus keyed off `seed` (Chris: make grants deterministic with a passed
// seed — no ambient RNG). GRANT_RANDOM_RANGE bounds the bonus; the brief
// says "+ random" without a range, so this is a tunable assumption.
export const GRANT_BASE_PER_TIER = 100;
export const GRANT_RANDOM_RANGE = 100;

export function tierGrantAmount(tier: ClassTier, seed: number): number {
  const base = GRANT_BASE_PER_TIER * tier;
  // Reuse the engine's splitmix32 mixer for a well-distributed uint32 from the
  // single seed, then bound it. Deterministic: same (tier, seed) → same grant.
  const bonus = deriveActionSeed(seed, tier) % GRANT_RANDOM_RANGE;
  return base + bonus;
}

// Add JP into a specific class's pool (the raw grant primitive; also the
// apply-back per-action earn path). Earnings are always class-scoped.
export function grantJp(unit: CampaignUnit, classId: ClassId, amount: number): CampaignUnit {
  if (amount < 0) {
    throw new Error(`grantJp: amount must be non-negative, got ${amount}`);
  }
  if (amount === 0) return unit;
  return {
    ...unit,
    earnedByClass: {
      ...unit.earnedByClass,
      [classId]: (unit.earnedByClass[classId] ?? 0) + amount,
    },
  };
}

// Grant the tier-scaled head-start INTO the newly-unlocked class's pool (so a
// freshly-unlocked class can afford its intended entry — the T3 Calculator's
// functional triple, etc.).
export function grantOnClassUnlock(
  unit: CampaignUnit,
  classId: ClassId,
  tier: ClassTier,
  seed: number,
): CampaignUnit {
  return grantJp(unit, classId, tierGrantAmount(tier, seed));
}

// --- Export gating (R/S/M passives) ----------------------------------------

export type EquipGate = { readonly ok: true } | { readonly ok: false; readonly reason: string };

// Whether the unit may equip a passive (`abilityId`) while in `targetClass`.
// The R/S/M rule (brief item 3):
//   - In the passive's NATIVE class → free, always allowed.
//   - On a NON-native class → allowed only if (a) the passive is exportable
//     and (b) the unit has paid the export tax (unlocked the token).
//   - Native-only passives (`exportable: false`, e.g. Expert Former,
//     Mathematician) → never equippable off their class, at any price.
// Roster-side only: the engine's `validateLoadout` is structural and has no
// native-class concept, so this gate lives here and the roster UI consults it.
export function canEquipPassive(
  unit: CampaignUnit,
  abilityId: AbilityId,
  targetClass: ClassId,
  catalog: ComponentCatalog,
): EquipGate {
  const token: UnlockToken = { kind: 'ability', id: abilityId };
  const meta = componentMetaOf(token, catalog);

  if (targetClass === meta.nativeClass) {
    return { ok: true }; // free in-class
  }
  if (meta.exportable === false) {
    return { ok: false, reason: `${String(abilityId)} is native-only (no export path)` };
  }
  const owned = new Set(unit.unlocks.map(tokenKey));
  if (!hasToken(owned, token)) {
    return {
      ok: false,
      reason: `${String(abilityId)} is not unlocked (${meta.cost} JP export tax unpaid)`,
    };
  }
  return { ok: true };
}
