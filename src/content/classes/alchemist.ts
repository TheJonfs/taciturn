// Alchemist — Session 39b. Physical class doubling as the v1 healing
// solution via a prepare-then-throw item economy.
//
// Stats per the S39 brief (L25 reference): 126 HP / 36 MP / 8 PA / 5 MA
// / Move 4 / Jump 3 / Evades 6-4-0. Equipment: Universal armor / helm
// / accessory / weapons (per D1, D2 — Knight-exclusive armor access
// trajectory deferred). Native Command Set: Alchemy (Compound + Throw
// Item). Native R/S/M: Combat Focus (Reaction), Field Recovery
// (Movement, HP heal = tiles²), Field Kit (Support, starting
// stockpile).
//
// Tactical identity: resource manager who banks consumables on
// lower-pressure turns and spends them on demand. Speed 8 (lower
// than the Knight's 9 and Water Mage's 10) — Alchemist is a slower
// support class, less tempo than the mages but with stronger sustain
// via Field Recovery + the heal-throws.

import {
  abilityId,
  classId,
  commandSetId,
  type ClassDefinition,
} from '@engine/index.ts';

export const alchemist: ClassDefinition = {
  id: classId('alchemist'),
  name: 'Alchemist',
  movement: {
    moveRange: 3,
    jump: 3,
    terrainCosts: new Map(),
    // Universal water-enterable; cost is the gate. Matches the
    // post-S33 convention (ADR-0073).
    canEnter: new Set(['ground', 'water_shallow', 'water_deep', 'rampart']),
  },
  evasion: { front: 6, side: 4, back: 0 },
  equipmentSlots: {
    leftHand: true,
    rightHand: true,
    headgear: true,
    armor: true,
    accessory: true,
  },
  firstActionCommandSet: commandSetId('alchemy'),
  freeAbilities: new Set([
    abilityId('attack'),
    abilityId('combat_focus'),
    abilityId('field_recovery'),
    abilityId('field_kit'),
  ]),
};
