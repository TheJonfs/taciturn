// Earth Mage — first Mage class. Magical attacker oriented around
// earth-tagged spells, stat-mod debuffs, and Regen-flavored support.
//
// Movement baseline: moveRange 3, jump 3, ground-only. A standard mage
// silhouette per the Battle Mechanics Guide. Curves and equipment land
// later (sessions 17+); v1 stats are static-from-baseStats.
//
// Default First Action command set: `earth_spells` — the 5-ability
// Earth kit (strike, blessing, curse). The kit's AoE / Ultimate land
// in session 17 alongside AoE engine work.
//
// Class-inherent passives: none yet. Earth Mage's identity comes from
// equipped passives (Earth Communion, Earth Resilience) and the Earth
// command set itself.

import {
  abilityId,
  classId,
  commandSetId,
  type ClassDefinition,
} from '@engine/index.ts';

export const earthMage: ClassDefinition = {
  id: classId('earth_mage'),
  name: 'Earth Mage',
  movement: {
    moveRange: 3,
    jump: 3,
    terrainCosts: new Map(),
    canEnter: new Set(['ground']),
  },
  // Standard mage evasion baseline (modest front, modest side, no back)
  // per BMG "Evasion and accuracy". Real numbers land in tuning.
  evasion: { front: 8, side: 5, back: 0 },
  // Earth Mage equips into all five slots (per ADR-0028). Robe-only
  // restrictions are wave-2 territory; v1 keeps the slot surface
  // uniform across classes.
  equipmentSlots: {
    leftHand: true,
    rightHand: true,
    headgear: true,
    armor: true,
    accessory: true,
  },
  firstActionCommandSet: commandSetId('earth_spells'),
  freeAbilities: new Set<ReturnType<typeof abilityId>>(),
};
