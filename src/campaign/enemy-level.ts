// TABA economy — the ONE enemy-level lever (M3 economy brief).
//
// Everywhere the campaign needs a dynamic enemy level — skirmish generation,
// reward derivation, any future scaled encounter — it resolves through this
// single function. A node's authored `offset` is the one lever driving both
// challenge AND payout (all three rewards derive from enemy level), so this
// seam is what keeps them coupled by construction.
//
// `difficultyFactor` is a RESERVED additive global term, hardwired 0
// (D-econ-4: structure now, expose later — no UI for it). Additive, never
// multiplicative, so a future difficulty setting preserves authored relative
// pacing between nodes.

import type { CampaignUnit } from './types.ts';

// The reserved global difficulty term. Always 0 today; a future difficulty
// setting changes THIS value (or threads a live one through), never the
// resolution formula.
export const DIFFICULTY_FACTOR = 0;

// The single source for a scaled enemy level: party average + the node's
// authored offset + the (reserved) global difficulty term.
export function resolveEnemyLevel(
  partyAvg: number,
  nodeOffset: number,
  difficultyFactor: number = DIFFICULTY_FACTOR,
): number {
  return partyAvg + nodeOffset + difficultyFactor;
}

// The party's average level — the `partyAvg` input above, and the recruitment
// hire-level cap (Stage 3). Averages the ACTIVE roster only (`lost` units are
// off the party for every forward-looking purpose), rounded to the nearest
// whole level. Throws on a roster with no active units — a campaign in that
// state has no party to scale against (fail loud, CLAUDE.md anti-pattern).
export function partyAverageLevel(roster: ReadonlyArray<CampaignUnit>): number {
  const active = roster.filter((u) => u.fate === 'active');
  if (active.length === 0) {
    throw new Error('partyAverageLevel: roster has no active units to average');
  }
  const sum = active.reduce((acc, u) => acc + u.level, 0);
  return Math.round(sum / active.length);
}
