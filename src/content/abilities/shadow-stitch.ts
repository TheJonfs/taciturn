// Shadow Stitch — Assassin Command Set (Session 42). Instant, ranged
// (4h × 3v, straight_line targeting — needs line of sight), no damage:
// pins the target with Stop.
//
// S65: rangeMode arc → straight_line (ADR-0108). The Stop dart is the
// strongest member of the "control sub-game"; making it LoS-gated lets a
// Barrier wall off the ranged Stop, which is the point of pairing
// disables with resistance gear (the Barbut). Consistent with the S60
// arc→straight_line cut (ADR-0097); bows / lobbed / area stay arc.
//
// Brave-and-Speed formula (per S42 brief): the application chance is
//   baseFraction × (caster_brave/100) × (target_brave/100)
//                × (0.9 + caster_speed/20)
// declared as `factors: { brave: true, speed: true }` (full-override —
// no faith, no MA). A fast, brave Assassin lands Stop reliably; a
// low-Brave target resists. baseChance 60, Stop for 3 turns (Stop is
// `per_unit_ct`, so the duration is required and clears at KO per
// ADR-0079).
//
// No `hitRoll` and no `damage`: there is no hit-or-miss roll and no
// damage delivery, so the status formula alone decides the outcome and
// no damage-triggered Reactions (Counter, Speed Save) fire. mpCost 10 —
// the priciest Command Set member (Stop is the strongest single-target
// lockout); two castings at the Assassin's base MP 24.

import {
  abilityId,
  bucketId,
  statusTypeId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const shadowStitch: ActiveAbilityDefinition = {
  id: abilityId('shadow_stitch'),
  name: 'Shadow Stitch',
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
  mpCost: 10,
  effects: {
    statusEffects: [
      {
        typeId: statusTypeId('stop'),
        target: 'primary_target',
        baseChance: 60,
        duration: 3,
        factors: { brave: true, speed: true },
      },
    ],
  },
};
