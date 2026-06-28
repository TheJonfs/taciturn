// Vigilance (Session 76) — the Monk's innate Movement passive. Lifts evasion
// on ALL facings (front / side / back) by a fraction of PA. Because it raises
// BACK evasion off the floor, the Monk resists flanking — a deliberate part of
// its anti-physical profile (a flanked Monk still dodges).
//
// Reads `unit.baseStats.pa` directly: the `modifyEvasion` hook isn't handed
// state, so it can't run the `modifyStatQuery` chain. This means PA buffs
// (Gauntlet, Martial Expertise) do NOT compound into evasion — a deliberately
// conservative read versus the brief's swingiest interaction, and cheaper to
// reason about. Re-evaluate if hand-play wants the buffs to feed evasion too.
//
// Evasion-per-PA (tuning): floor(PA / 2) → +4 at the Monk's PA 9, lifting its
// 11/8/3 base to ~15/12/7. A starting value for the sim seam + hand-play; the
// brief frames the Monk as deliberately evasion-strong, so this can climb.
//
// baseCost 1 cross-class (free for the Monk). On a non-Monk it only pays off
// while that unit also has a high PA.

import {
  abilityId,
  bucketId,
  passiveHook,
  type PassiveAbilityDefinition,
} from '@engine/index.ts';

const VIGILANCE_PA_DIVISOR = 2;

export const vigilance: PassiveAbilityDefinition = {
  id: abilityId('vigilance'),
  name: 'Vigilance',
  kind: 'passive',
  bucket: bucketId('movement'),
  baseCost: 1,
  availability: 'available',
  hooks: [
    passiveHook('modifyEvasion', (args) => {
      const bonus = Math.floor(args.unit.baseStats.pa / VIGILANCE_PA_DIVISOR);
      return args.baseEvasion + bonus;
    }),
  ],
};
