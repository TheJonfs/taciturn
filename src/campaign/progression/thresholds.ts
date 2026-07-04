// TABA M2 progression — the tier-unlock thresholds.
//
// The JP-spend gates that open tiers (brief §Unlock thresholds). Gating is on
// CUMULATIVE JP SPENT WITHIN A TIER, WITHIN A HALF (confirmed with Chris):
// buying abilities is the only JP sink, and that same spend climbs the tree —
// the tree is not a separate sink.
//
// All values tunable. They live as named constants (not magic numbers in the
// unlock logic) so the economy can be retuned in one place.
//
// The rules, in prose (implemented by `unlockedTiers` in ledger.ts):
//   - 500 in a half's Tier 1  → that half's Tier 2 AND the OTHER half's Tier 1.
//   - 1000 in a half's Tier 1 + 500 in that half's Tier 2 → that half's Tier 3.
//   - 500 in BOTH halves' Tier 1 → Hybrid Tier 2 (Templar, Terraformer).
//   - 1000 in Hybrid Tier 2 → Hybrid Tier 3 (capstone — seam only, no class).
//   - A whole tier opens at threshold (every class in it becomes reclass-able
//     at once).
//
// A unit's CURRENT class's slot is always considered open (you are in it); the
// thresholds layer additional slots on top. So a fresh unit that started as a
// Tier-1 class has exactly its own half's Tier 1 open until it spends.

export const TIER2_FROM_TIER1_SPEND = 500;
export const OTHER_HALF_TIER1_FROM_TIER1_SPEND = 500;

export const TIER3_TIER1_SPEND = 1000;
export const TIER3_TIER2_SPEND = 500;

export const HYBRID_T2_EACH_HALF_TIER1_SPEND = 500;
export const HYBRID_T3_FROM_HYBRID_T2_SPEND = 1000;
