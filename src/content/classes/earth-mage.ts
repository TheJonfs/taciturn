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
// Class-inherent free passives: Earth Communion, Earth Resilience, and
// Bedrock Stride (session 26 — Earth's Movement-bucket parity passive:
// +1 moveRange, fall-damage immunity). The R/S/M parity rule grants
// each Mage class its themed Movement passive free.

import {
  abilityId,
  classId,
  commandSetId,
  type ClassDefinition,
  type DamageTag,
} from '@engine/index.ts';

export const earthMage: ClassDefinition = {
  id: classId('earth_mage'),
  // S40 name-update pass: display name updated to 'Geosage';
  // underlying classId preserved for save-state continuity.
  name: 'Geosage',
  movement: {
    moveRange: 2,
    jump: 3,
    terrainCosts: new Map(),
    // Session 33 (ADR-0073): water is universally enterable; cost is
    // the gate. See knight.ts for the convention.
    canEnter: new Set(['ground', 'water_shallow', 'water_deep', 'rampart']),
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
  freeAbilities: new Set([
    abilityId('attack'),
    abilityId('earth_resilience'),
    abilityId('earth_communion'),
    abilityId('bedrock_stride'),
  ]),
  // Elemental wheel (designer call 2026-05-10): +50 vs Lightning
  // (grounds the charge), -50 vs Fire (earth burns / scorches).
  baselineResistances: new Map<DamageTag, number>([
    ['lightning', 50],
    ['fire', -50],
  ]),
  // S49 Level system: mage classes lean on MA — at L23 MA drops 1; at
  // L27 MA boosts 1.
  dominantStat: 'ma',
  defaultGender: 'male',
};
