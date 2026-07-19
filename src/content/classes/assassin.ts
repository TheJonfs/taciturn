// Assassin — the second physical class beyond the Knight (Session 42). A
// Speed-defined glass cannon built around action economy and permadebuff
// pressure: fastest base Speed in v1 (14), low HP/PA, and a ranged
// status-application Command Set (Shadow Arts).
//
// Stats (see classBaselineStats): HP 96 / MP 24 / PA 6 / MA 3 / Speed 14.
// Movement 4 / Jump 4 — but native Fleet of Foot bumps both to 5 / 5,
// the most mobile profile in v1.
//
// Evasion 8 / 4 / 0: a real front evade (below the Knight's 12, above
// the mages), middling side, and the universal back-zero. Combined with
// only 96 HP, the 0 back-evade makes flanking the Assassin brutal —
// positioning matters intensely.
//
// Native R/S/M (free; cross-class costs per ability):
//   - Support: Two Weapons (free; cross-class 3) — dual-wield + PA × 0.75.
//   - Reaction: Speed Save (free; cross-class 1) — +1 Speed permanent on
//     being hit by an enemy for damage; accumulates over the battle.
//   - Movement: Fleet of Foot (free; cross-class 1) — Move +1, Jump +1.
//
// Equipment: Universal armor / helm / accessory; weapons inherit the
// no-class-gating convention. Both hand slots open so Two Weapons can
// fill the off-hand.

import {
  abilityId,
  classId,
  commandSetId,
  type ClassDefinition,
} from '@engine/index.ts';

export const assassin: ClassDefinition = {
  id: classId('assassin'),
  name: 'Assassin',
  movement: {
    moveRange: 3,
    jump: 4,
    terrainCosts: new Map(),
    // Universal water-enterable; cost is the gate (ADR-0073).
    canEnter: new Set(['ground', 'water_shallow', 'water_deep', 'rampart', 'rock', 'grass_rock', 'bridge']),
  },
  evasion: { front: 8, side: 4, back: 0 },
  equipmentSlots: {
    leftHand: true,
    rightHand: true,
    headgear: true,
    armor: true,
    accessory: true,
  },
  firstActionCommandSet: commandSetId('shadow_arts'),
  freeAbilities: new Set([
    abilityId('attack'),
    abilityId('speed_save'),
    abilityId('two_weapons'),
    abilityId('fleet_of_foot'),
  ]),
  // S49 Level system: Assassin's identity is Speed (14 base, highest in
  // v1) — at L27 Speed bumps to 15.
  dominantStat: 'spd',
  defaultGender: 'female',
};
