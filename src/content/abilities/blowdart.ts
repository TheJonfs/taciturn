// Blowdart — Assassin Command Set (Session 42). Instant, ranged (4h × 3v,
// straight_line targeting — needs line of sight), no damage: applies
// Poison for sustained pressure.
//
// S65: rangeMode arc → straight_line (ADR-0108). A blown dart is a flat,
// fast projectile, so a Terraformer's Barrier (or intervening terrain /
// units) now stops it — making Barrier a real counter to the Assassin's
// ranged-status pressure, consistent with the S60 arc→straight_line cut
// (ADR-0097) that flipped the elemental bolts. Lobbed / area attacks and
// bows stay arc.
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
    rangeMode: 'straight_line',
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
