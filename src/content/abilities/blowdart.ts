// Blowdart — Assassin Command Set (Session 42). Instant, ranged (4h × 3v,
// arc targeting — uncovered source + target), no damage: applies Poison
// for sustained pressure.
//
// Shares the existing `poison` status with the Geosage (per S42 brief
// D8) — same DoT mechanics, tick cadence, and infinite (null) duration
// encoding. Poison is `permanent_per_unit_ct`, so no `duration` is
// passed; it ticks until the target is cured or KO'd.
//
// Brave-and-Speed formula `{ brave: true, speed: true }`, baseChance 80
// (a reliable applier — Poison's value is the slow grind, not a coin
// flip). No `hitRoll` / `damage`: status formula decides the outcome, no
// damage-Reaction triggers. mpCost 8.

import {
  abilityId,
  bucketId,
  statusTypeId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const blowdart: ActiveAbilityDefinition = {
  id: abilityId('blowdart'),
  name: 'Blowdart',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'available',
  targeting: {
    kind: 'single_unit',
    range: { horizontal: 4, vertical: 3 },
    rangeMode: 'arc',
  },
  actionSpeed: 0,
  mpCost: 8,
  effects: {
    statusEffects: [
      {
        typeId: statusTypeId('poison'),
        target: 'primary_target',
        baseChance: 80,
        factors: { brave: true, speed: true },
      },
    ],
  },
};
