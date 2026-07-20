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
import { marshmoor } from '@content/maps/marshmoor.ts';

// Lineup 'lineup_fixture' on map 'marshmoor' — battle id 'lineup_fixture_v1'.
export const LINEUP_FIXTURE_LINEUP: LineupSpec = {
  key: 'lineup_fixture',
  mapKey: 'marshmoor',
  battleId: 'lineup_fixture_v1',
  players: [
    { x: 13, y: 1, layer: 0, facing: 'S' },
    { x: 14, y: 1, layer: 0, facing: 'S' },
    { x: 15, y: 1, layer: 0, facing: 'S' },
    { x: 13, y: 2, layer: 0, facing: 'S' },
    { x: 14, y: 2, layer: 0, facing: 'S' },
  ],
  guests: [
    { x: 12, y: 2, layer: 0, facing: 'S' },
  ],
  enemies: [
    { x: 1, y: 13, layer: 0, facing: 'N', classId: 'monk', level: 4 },
    { x: 2, y: 13, layer: 0, facing: 'N', classId: 'fire_mage', level: 3 },
    { x: 1, y: 14, layer: 0, facing: 'N', classId: 'hunter', level: 3 },
    { x: 2, y: 14, layer: 0, facing: 'N', classId: 'water_mage', level: 3 },
    { x: 0, y: 13, layer: 0, facing: 'E', classId: 'alchemist', level: 3 },
    { x: 0, y: 14, layer: 0, facing: 'E', classId: 'earth_mage', level: 5 },
  ],
};

export const lineupFixtureBattle: BattleConfig = buildBattleFromLineup(
  LINEUP_FIXTURE_LINEUP,
  marshmoor,
  riverRidgeBattle,
);
