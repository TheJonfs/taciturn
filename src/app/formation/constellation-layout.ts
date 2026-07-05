// Constellation — the pure star-chart layout + gating copy (TABA M2 UI).
//
// The reclass tree as a star-chart: 3 domain columns (Physical / Hybrid /
// Magical) × 3 altitude bands (Horizon T1 / Ascendant T2 / Zenith T3). Positions
// are DERIVED from `CLASS_TIER_MAP` — not hardcoded — so the chart tracks the
// real tree (no phantom Onion Knight; hybrid-T3 is a labeled empty capstone).
//
// This module owns geometry + threshold *copy*; it never decides openness (that
// is `reclassableClasses` in the component) and never re-derives thresholds for
// gating — only for the human-readable "what opens this" hint, straight off the
// same constants the engine gates on.

import type { ClassId } from '@engine/index.ts';
import {
  CLASS_TIER_MAP,
  tierSlot,
  TIER2_FROM_TIER1_SPEND,
  OTHER_HALF_TIER1_FROM_TIER1_SPEND,
  TIER3_TIER1_SPEND,
  TIER3_TIER2_SPEND,
  HYBRID_T2_EACH_HALF_TIER1_SPEND,
  type ClassHalf,
  type ClassTier,
  type TierSlot,
} from '@campaign/index.ts';

export const VIEW_W = 900;
export const VIEW_H = 515;

// Column centre x by domain; row centre y by tier (Zenith high, Horizon low).
const COLUMN_X: Readonly<Record<ClassHalf, number>> = { physical: 180, hybrid: 450, magical: 720 };
const ROW_Y: Readonly<Record<ClassTier, number>> = { 1: 430, 2: 265, 3: 100 };
const SLOT_GAP = 84; // horizontal spacing between co-slot stars

export interface StarNode {
  readonly classId: ClassId;
  readonly half: ClassHalf;
  readonly tier: ClassTier;
  readonly slot: TierSlot;
  readonly x: number;
  readonly y: number;
}

// Group classes by slot and lay each slot's members out horizontally, centred
// on their column. Sorted by id within a slot so positions are deterministic.
function buildLayout(): ReadonlyArray<StarNode> {
  const bySlot = new Map<TierSlot, ClassId[]>();
  for (const [id, entry] of CLASS_TIER_MAP) {
    const slot = tierSlot(entry.half, entry.tier);
    const list = bySlot.get(slot) ?? [];
    list.push(id);
    bySlot.set(slot, list);
  }

  const nodes: StarNode[] = [];
  for (const [slot, ids] of bySlot) {
    ids.sort((a, b) => String(a).localeCompare(String(b)));
    const [half, tierStr] = slot.split(':') as [ClassHalf, string];
    const tier = Number(tierStr) as ClassTier;
    const cx = COLUMN_X[half];
    const cy = ROW_Y[tier];
    const n = ids.length;
    ids.forEach((id, i) => {
      const x = cx + (i - (n - 1) / 2) * SLOT_GAP;
      nodes.push({ classId: id, half, tier, slot, x, y: cy });
    });
  }
  return nodes;
}

export const STAR_LAYOUT: ReadonlyArray<StarNode> = buildLayout();

// The altitude bands (guide lines + labels) and domain column labels.
export const BANDS: ReadonlyArray<{ readonly y: number; readonly label: string }> = [
  { y: ROW_Y[3] - 30, label: 'Zenith · tier iii' },
  { y: ROW_Y[2] - 65, label: 'Ascendant · tier ii' },
  { y: ROW_Y[1] - 60, label: 'Horizon · tier i' },
];

export const COLUMNS: ReadonlyArray<{ readonly x: number; readonly half: ClassHalf; readonly label: string }> = [
  { x: COLUMN_X.physical, half: 'physical', label: 'Physical' },
  { x: COLUMN_X.hybrid, half: 'hybrid', label: 'Hybrid' },
  { x: COLUMN_X.magical, half: 'magical', label: 'Magical' },
];

// The empty hybrid-T3 capstone seam (no class occupies it) — rendered as a
// faint marker so the tree's shape is honest about the undesigned slot.
export const HYBRID_CAPSTONE: { readonly x: number; readonly y: number } = {
  x: COLUMN_X.hybrid,
  y: ROW_Y[3],
};

// Human-readable "what opens this locked star" — derived from the tier-slot
// aggregates + the same thresholds the engine gates on. Mirrors the openness
// rules in `unlockedTiers`; used only for copy (never for the openness itself).
export function lockReason(node: StarNode, spentByTierSlot: ReadonlyMap<TierSlot, number>): string {
  const at = (slot: TierSlot): number => spentByTierSlot.get(slot) ?? 0;
  const short = (need: number, have: number): number => Math.max(0, need - have);
  const { half, tier } = node;

  if (half === 'hybrid' && tier === 2) {
    return `need ${HYBRID_T2_EACH_HALF_TIER1_SPEND} in both halves' T1`;
  }
  if (half === 'hybrid' && tier === 3) return 'master a hybrid first';

  if (tier === 2) {
    const t1 = at(tierSlot(half, 1));
    return `+${short(TIER2_FROM_TIER1_SPEND, t1)} JP in ${label(half)} T1`;
  }
  if (tier === 3) {
    const t1short = short(TIER3_TIER1_SPEND, at(tierSlot(half, 1)));
    const t2short = short(TIER3_TIER2_SPEND, at(tierSlot(half, 2)));
    if (t1short && t2short) return `+${t1short} T1 · +${t2short} T2`;
    if (t1short) return `+${t1short} JP in ${label(half)} T1`;
    return `+${t2short} JP in ${label(half)} T2`;
  }
  // Tier 1 (physical/magical): a locked half opens via 500 in the OTHER half's
  // T1. (A unit's own starting half's T1 is always open, so this copy is only
  // reached for the opposite half — e.g. a hybrid unit that hasn't earned into
  // either base half yet.)
  const other: ClassHalf = half === 'physical' ? 'magical' : 'physical';
  return `+${short(OTHER_HALF_TIER1_FROM_TIER1_SPEND, at(tierSlot(other, 1)))} JP in ${label(other)} T1`;
}

// One physical/magical aggregate card: both tier-slots and the T3 gate copy.
export interface AggregateCard {
  readonly half: 'physical' | 'magical';
  readonly label: string;
  readonly t1: number;
  readonly t2: number;
  readonly t1Need: number; // 1000 — the T3 Tier-I gate
  readonly t2Need: number; // 500  — the T3 Tier-II gate
  readonly nextText: string;
}

export function aggregateCard(
  half: 'physical' | 'magical',
  spentByTierSlot: ReadonlyMap<TierSlot, number>,
): AggregateCard {
  const t1 = spentByTierSlot.get(tierSlot(half, 1)) ?? 0;
  const t2 = spentByTierSlot.get(tierSlot(half, 2)) ?? 0;
  const t3Open = t1 >= TIER3_TIER1_SPEND && t2 >= TIER3_TIER2_SPEND;

  let nextText: string;
  if (t1 < TIER2_FROM_TIER1_SPEND) {
    nextText = `${TIER2_FROM_TIER1_SPEND - t1} more in Tier I opens Tier II`;
  } else if (t3Open) {
    nextText = 'Tier III open — both thresholds met';
  } else {
    const a = Math.max(0, TIER3_TIER1_SPEND - t1);
    const b = Math.max(0, TIER3_TIER2_SPEND - t2);
    const parts = [a ? `+${a} in Tier I` : '', b ? `+${b} in Tier II` : ''].filter(Boolean);
    nextText = `Tier III needs ${parts.join(' · ')}`;
  }

  return {
    half,
    label: label(half),
    t1,
    t2,
    t1Need: TIER3_TIER1_SPEND,
    t2Need: TIER3_TIER2_SPEND,
    nextText,
  };
}

function label(half: ClassHalf): string {
  return half === 'physical' ? 'Physical' : half === 'magical' ? 'Magical' : 'Hybrid';
}
