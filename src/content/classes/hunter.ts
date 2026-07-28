// Hunter — the 8th class (Session 45), balancing the roster at 4 physical
// / 4 magical. A ranged-instant-damage skirmisher built around the bow
// weapon class and elevation play.
//
// Stats (see classBaselineStats): HP 116 / MP 28 / PA 6 / MA 3 / Speed 9.
// Movement 4 / Jump 3 — but native High Jump bumps Jump to 5, reaching
// the high ground its bows' height-delta variance rewards. MP 28 is a
// light caster supplement (Pin Down and bow attacks spend no MP; the MP
// is headroom for cross-classed casting).
//
// Evasion 6 / 3 / 0: a modest front evade (below Knight 12 / Assassin 8),
// light side, universal back-zero. With 116 HP the Hunter is sturdier
// than the Assassin (96) but wants to fight from range, not the front.
//
// Native R/S/M (free; cross-class costs per ability):
//   - Reaction: Updraft (free; cross-class 1) — +1 Jump permanent on
//     being hit for damage; accumulates over the battle.
//   - Support: Eagle Eye (free; cross-class 2) — ×2 physical hit chance
//     (the bows' bare 33 accuracy → ~66% net).
//   - Movement: High Jump (free; cross-class 1) — Jump +2.
//
// Equipment: universal armor / helm / accessory; weapons inherit the
// no-class-gating convention (any class can field a bow — the Knight +
// Longbow + Lightning Stab cross-class is intentional). Both hand slots
// open, though a two-handed bow leaves the off-hand empty.

import {
  abilityId,
  classId,
  commandSetId,
  type ClassDefinition,
} from '@engine/index.ts';

export const hunter: ClassDefinition = {
  id: classId('hunter'),
  name: 'Hunter',
  movement: {
    moveRange: 3,
    jump: 3,
    terrainCosts: new Map(),
    canEnter: new Set(['ground', 'water_shallow', 'water_deep', 'rampart', 'rock', 'grass_rock', 'bridge', 'roof']),
  },
  evasion: { front: 6, side: 3, back: 0 },
  equipmentSlots: {
    leftHand: true,
    rightHand: true,
    headgear: true,
    armor: true,
    accessory: true,
  },
  firstActionCommandSet: commandSetId('marksmanship'),
  freeAbilities: new Set([
    abilityId('attack'),
    abilityId('updraft'),
    abilityId('eagle_eye'),
    abilityId('high_jump'),
    // S68: the Hunter's 2nd free Support — offensive elevation +2 (ADR-0115).
    abilityId('vantage'),
  ]),
  // S49 Level system: Hunter is a PA-scaling ranged class (bows compute
  // damage off PA × WP) — physical-dominant.
  dominantStat: 'pa',
  defaultGender: 'male',
};
