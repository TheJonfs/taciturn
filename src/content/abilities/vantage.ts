// Vantage — the Hunter's second Support (Session 68). Free and native on
// the Hunter; cross-class costs 1 (a cheap, narrow specialist pick).
//
// Single contribution via `modifyAttackerElevation`: the wielder's own
// offensive computations resolve as if it stood +2 tiles higher than its
// real tile. That feeds four attacker-side elevation reads (ADR-0115):
//   - height_delta damage variance (downhill bonus — bows),
//   - the high-ground accuracy modifier (+5% when "higher"),
//   - bow reach-from-height,
//   - the SOURCE endpoint of attack line-of-sight ("shoot over cover").
//
// It is offensive-only and applies to the wielder's attacks alone — never
// to defensive reads (the wielder as a target), Math Skill Height,
// pathfinding, knockback, or AoE. The unit is physically at its real
// elevation; it only *aims* from higher.
//
// Bow-shaped without naming bows: only bows carry height_delta variance
// and reach-from-height, and the accuracy modifier is irrelevant to
// melee that's already adjacent. The one cross-class reach is LoS — a
// straight-line caster (e.g. an Aethurge) can clear cover it otherwise
// couldn't, which is the intended counter to a Barrier-walling
// Terraformer. Nothing here rewards a melee bruiser, so it's not a
// slam-dunk splash.
//
// X = +2 is the spicy first cut (per the S68 design pass) — re-analyze
// Hunter DoT vs other classes and playtest; dial toward +1 if too strong.

import {
  abilityId,
  bucketId,
  passiveHook,
  type PassiveAbilityDefinition,
} from '@engine/index.ts';

const VANTAGE_ELEVATION_BONUS = 2;

export const vantage: PassiveAbilityDefinition = {
  id: abilityId('vantage'),
  name: 'Vantage',
  kind: 'passive',
  bucket: bucketId('support'),
  baseCost: 1,
  availability: 'available',
  hooks: [
    passiveHook('modifyAttackerElevation', (args) => args.baseValue + VANTAGE_ELEVATION_BONUS),
  ],
};
