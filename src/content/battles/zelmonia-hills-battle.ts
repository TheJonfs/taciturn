// GENERATED-SHAPED — battle-lineup module (Cartographer unit mode).
//
// This module is codegen output of the Cartographer map-authoring tool (the
// `?cartographer` dev route): the lineup's spec — ordered player staging,
// guest markers, and enemy slots, each with position + facing (enemy slots
// also carry an authored class + level) — plus the BattleConfig restaged
// from it. ENEMY SLOT ORDER IS MEANINGFUL (lead = slot 0; the campaign fold
// re-skins by index). The authored classes/levels are consumed campaign-side
// via `enemiesFromLineup` (src/campaign/lineup.ts). Hand edits are legal
// TypeScript but the next Cartographer export of this lineup OVERWRITES THE
// FILE WHOLESALE. Round-trip fidelity is pinned by the Cartographer codegen
// test.

import type { BattleConfig } from '@engine/index.ts';

import { buildBattleFromLineup, type LineupSpec } from '@content/battles/lineup-format.ts';
import { riverRidgeBattle } from '@content/battles/river-ridge-battle.ts';
import { zelmoniaHills } from '@content/maps/zelmonia-hills.ts';

// Lineup 'zelmonia_hills' on map 'zelmonia_hills' — battle id 'zelmonia_hills_v1'.
export const ZELMONIA_HILLS_LINEUP: LineupSpec = {
  key: 'zelmonia_hills',
  mapKey: 'zelmonia_hills',
  battleId: 'zelmonia_hills_v1',
  players: [
    { x: 6, y: 14, layer: 0, facing: 'N' },
    { x: 7, y: 15, layer: 0, facing: 'N' },
    { x: 8, y: 14, layer: 0, facing: 'N' },
    { x: 9, y: 15, layer: 0, facing: 'N' },
    { x: 9, y: 14, layer: 0, facing: 'N' },
  ],
  guests: [],
  enemies: [
    { x: 7, y: 4, layer: 0, facing: 'S', classId: 'hunter', level: 4 },
    { x: 5, y: 3, layer: 0, facing: 'S', classId: 'hunter', level: 3 },
    {
      x: 9, y: 4, layer: 0, facing: 'S', classId: 'water_mage', level: 4,
      overrides: {
        name: 'Oscar',
        gender: 'male',
        unlocks: [
          { kind: 'ability', id: 'water_strike' },
          { kind: 'ability', id: 'brine' },
          { kind: 'ability', id: 'earth_communion' },
          { kind: 'ability', id: 'earth_blessing' },
        ],
        secondaryCommandSet: 'earth_spells',
        passives: { support: ['earth_communion'] },
        equipment: { leftHand: 'wand_of_depths', headgear: 'focus_band', armor: 'padded_jacket' },
      },
    },
    { x: 10, y: 3, layer: 0, facing: 'S', classId: 'earth_mage', level: 3 },
    { x: 11, y: 2, layer: 0, facing: 'S', classId: 'monk', level: 3 },
    {
      x: 4, y: 2, layer: 0, facing: 'S', classId: 'alchemist', level: 3,
      overrides: {
        name: 'Tina',
        gender: 'female',
        unlocks: [
          { kind: 'item', id: 'potion' },
          { kind: 'item', id: 'phoenix_down' },
          { kind: 'item', id: 'ether' },
        ],
        equipment: { leftHand: 'buckler', rightHand: 'dagger', headgear: 'lookouts_hood', armor: 'padded_jacket' },
      },
    },
  ],
};

export const zelmoniaHillsBattle: BattleConfig = buildBattleFromLineup(
  ZELMONIA_HILLS_LINEUP,
  zelmoniaHills,
  riverRidgeBattle,
);
