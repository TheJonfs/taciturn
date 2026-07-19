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
// Class-inherent free passives: `ignition` (Burn-on-magical-damage),
// `aether_bloom` (universal magical-AoE expander), `smolder`, and
// `hotfoot` (session 26 — Fire's Movement-bucket parity passive:
// +1 moveRange, +1 spd). All four are listed in `freeAbilities`, so a
// Fire Mage equipping them pays 0 capacity. A cross-classed mage can
// equip any at the standard baseCost.

import {
  abilityId,
  classId,
  commandSetId,
  type ClassDefinition,
  type DamageTag,
} from '@engine/index.ts';

export const fireMage: ClassDefinition = {
  id: classId('fire_mage'),
  // S40 name-update pass: display name updated to 'Pyromancer';
  // underlying classId preserved for save-state continuity.
  name: 'Pyromancer',
  movement: {
    moveRange: 2,
    jump: 3,
    terrainCosts: new Map(),
    // Session 33 (ADR-0073): water is universally enterable; cost is
    // the gate. See knight.ts for the convention.
    canEnter: new Set(['ground', 'water_shallow', 'water_deep', 'rampart', 'rock', 'grass_rock', 'bridge']),
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
  freeAbilities: new Set([
    abilityId('attack'),
    abilityId('ignition'),
    abilityId('aether_bloom'),
    abilityId('smolder'),
    abilityId('hotfoot'),
  ]),
  // Elemental wheel (designer call 2026-05-10): +50 vs Earth (burns
  // through stone), -50 vs Water (steam quench).
  baselineResistances: new Map<DamageTag, number>([
    ['earth', 50],
    ['water', -50],
  ]),
  // S49 Level system: mage class — MA-dominant.
  dominantStat: 'ma',
  defaultGender: 'female',
};
