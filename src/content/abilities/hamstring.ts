// Hamstring — Sera's signature Assassin active (TABA chapter-1 plot unit).
//
// A NEW Shadow Arts member, Sera-exclusive (a unit-restricted, buyable
// component in the campaign; ~200 JP — her natural fifth active between the
// basic debuffs and the Shadow Stitch capstone). Instant, ranged (4h × 3v
// straight_line — same range + LoS as her other line abilities), no damage:
// applies the STACKING, PERMANENT `hamstrung` debuff (Move −1 and Jump −1 per
// stack, each floored at 0).
//
// Proc: the SAME Speed-based formula as Shadow Stitch / Blowdart
// (`factors: { brave: true, speed: true }`) — a fast Assassin lands it
// reliably, a fast target resists. baseChance 75 sits between Blowdart's
// reliable 80 and Shadow Stitch's swingier 60: it should land often enough to
// accumulate, but the grind to full immobilize still takes several turns.
// mpCost 8. No `damage` / `hitRoll` → the status formula decides the outcome,
// so no damage-triggered Reactions fire (matches Blowdart / Shadow Stitch).

import {
  abilityId,
  bucketId,
  statusTypeId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const hamstring: ActiveAbilityDefinition = {
  id: abilityId('hamstring'),
  name: 'Hamstring',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  // Unit-restricted signature — kept out of the Mage War picker; the campaign
  // Training UI shows it only in Sera's catalog (Seam 3 restrictedToUnit).
  availability: 'hidden',
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
        typeId: statusTypeId('hamstrung'),
        target: 'primary_target',
        baseChance: 75,
        factors: { brave: true, speed: true },
      },
    ],
  },
};
