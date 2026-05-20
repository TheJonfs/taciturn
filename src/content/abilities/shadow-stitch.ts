// Shadow Stitch — Assassin Command Set (Session 42). Instant, ranged
// (4h × 3v, arc targeting — uncovered source + target), no damage: pins
// the target with Stop.
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
    rangeMode: 'arc',
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
