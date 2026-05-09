// Fire Mage — third Mage class. Glass-cannon damage dealer: highest MA
// of the three Mages, lowest HP, modest movement. Burst damage + Burn
// pressure, with the Aether Bloom passive expanding magical AoE shapes
// for Fire's signature wide-area presence.
//
// Per session 19 plaintext review:
//   - spd 10 / pa 3 / ma 9 / hp 42 / mp 42 (highest MA among Mages)
//   - evasion 6/4/0 (lower than Water; Fire isn't mobile-defensive)
//   - moveRange 3, jump 3, ground-only (parity with Earth Mage)
//
// Movement baseline: ground-only, no float/water-walking. Fire's
// identity is positional commitment — pick your spot and bring the
// burn. Float / fly is left as an equipped passive for cross-classed
// builds.
//
// Default First Action command set: `fire_spells` (Strike, Embrace,
// Storm, Spark, Flame Lance).
//
// Class-inherent free passives: `ignition` (Burn-on-magical-damage)
// and `aether_bloom` (universal magical-AoE expander). Both are listed
// in `freeAbilities`, so a Fire Mage equipping them pays 0 capacity.
// A cross-classed mage can equip either at baseCost 2 each.

import {
  abilityId,
  classId,
  commandSetId,
  type ClassDefinition,
} from '@engine/index.ts';

export const fireMage: ClassDefinition = {
  id: classId('fire_mage'),
  name: 'Fire Mage',
  movement: {
    moveRange: 3,
    jump: 3,
    terrainCosts: new Map(),
    canEnter: new Set(['ground']),
  },
  evasion: { front: 6, side: 4, back: 0 },
  equipmentSlots: {
    leftHand: true,
    rightHand: true,
    headgear: true,
    armor: true,
    accessory: true,
  },
  firstActionCommandSet: commandSetId('fire_spells'),
  // Both supports free for Fire Mage — Ignition and Aether Bloom give
  // the class its identity. Equipping either on a cross-classed mage
  // costs the standard baseCost 2 each.
  freeAbilities: new Set([abilityId('ignition'), abilityId('aether_bloom')]),
};
