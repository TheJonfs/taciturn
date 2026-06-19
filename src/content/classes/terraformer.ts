// Terraformer — the 10th class (Session 54). The battlefield-shaping
// geomancer: its primary contribution is the terrain itself, not direct
// combat output. Through the Worldcraft command set it raises pillars,
// digs pits, sculpts hills and valleys, and raises destructible barrier
// walls — reshaping engagement geometry (lifting allied archers onto
// perches, dropping enemies off cliffs, funnelling movement, walling off
// melee approaches). The first hybrid PA/MA class: both stats feed Barrier
// HP, so equipment can't min-max one axis.
//
// Stats (see classBaselineStats): HP 105 / MP 35 / PA 6 / MA 8 / Speed 8.
// Move 2 / Jump 2 — the slow-caster mobility tier (with Calculator and the
// two slow elemental mages); the Terraformer sets up the battlefield and
// doesn't need to act often. MP 35 funds ~3-4 flat-cost Worldcraft casts a
// battle (lower than Calculator's 47 — Worldcraft is flat-cost, not
// per-target).
//
// Evasion 6 / 3 / 0: standard mage profile (front between Calculator's 7 and
// the baseline). With 105 HP the Terraformer wants positioning behind its
// own terrain and front-line allies.
//
// Native R/S/M (free; cross-class costs per ability):
//   - Reaction: Damage Split (free; cross-class 2) — on surviving a damaging
//     hit, reflects full damage back (pipeline-bypass) and self-heals half.
//   - Movement: Ignore Height (free; cross-class 3) — removes the Jump
//     constraint on vertical movement (jump → 99).
//   - Support: Expert Former (free; cross-class 1) — raises the Worldcraft
//     effect cap +2 (base 2 → 4).
//
// Equipment: Mage + Universal armor / headgear / off-hand (Books) +
// accessories, wired via item-side classRestrictions (S54 equipment commit).
// Battle Dictionary's +1 PA finally pays off here — Barrier HP scales on PA.
//
// S49 Level system: Terraformer is MA-dominant. PA and MA sit close (6 / 8)
// to signal the hybrid identity, but MA edges it (most Worldcraft casting
// reads as magical) and takes the single dominant-stat pick.

import {
  abilityId,
  classId,
  commandSetId,
  type ClassDefinition,
} from '@engine/index.ts';

export const terraformer: ClassDefinition = {
  id: classId('terraformer'),
  name: 'Terraformer',
  movement: {
    moveRange: 2,
    jump: 2,
    terrainCosts: new Map(),
    // Universal water-enterable (ADR-0073). See knight.ts for the
    // convention.
    canEnter: new Set(['ground', 'water_shallow', 'water_deep', 'rampart', 'rock', 'grass_rock']),
  },
  evasion: { front: 6, side: 3, back: 0 },
  equipmentSlots: {
    leftHand: true,
    rightHand: true,
    headgear: true,
    armor: true,
    accessory: true,
  },
  firstActionCommandSet: commandSetId('worldcraft'),
  freeAbilities: new Set([
    abilityId('attack'),
    abilityId('damage_split'),
    abilityId('ignore_height'),
    abilityId('expert_former'),
  ]),
  dominantStat: 'ma',
  defaultGender: 'male',
};
