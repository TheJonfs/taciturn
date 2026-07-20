// GENERATED-SHAPED — battle-map module (Cartographer map editor).
//
// This module is codegen output of the Cartographer map-authoring tool (the
// `?cartographer` dev route): the map's spec — elevation grid, terrain
// bands, overrides, property tags, and layer-1 decks — plus the built
// BattleMap. Hand edits are legal TypeScript but the next Cartographer
// export of this map OVERWRITES THE FILE WHOLESALE. Geography and design
// prose live in the map's doc (see the spec comment below); deployment
// zones live in src/content/deployment/registry.ts. Round-trip fidelity is
// pinned by the Cartographer codegen test.

import type { BattleMap } from '@engine/index.ts';

import { buildMapFromSpec, type MapSpec } from './map-format.ts';

export const MOUNTAIN_PASS_WIDTH = 16;
export const MOUNTAIN_PASS_HEIGHT = 16;

// Mountain Pass (16×16) — prose: docs/maps/mountain-pass.md.
export const MOUNTAIN_PASS_SPEC: MapSpec = {
  key: 'mountain_pass',
  label: 'Mountain Pass',
  width: MOUNTAIN_PASS_WIDTH,
  height: MOUNTAIN_PASS_HEIGHT,
  bands: [
    { when: 'eq', elevation: 0, terrain: 'water_deep' },
    { when: 'eq', elevation: 1, terrain: 'water_shallow' },
    { when: 'gte', elevation: 7, terrain: 'rock' },
    { when: 'gte', elevation: 5, terrain: 'grass_rock' },
  ],
  elevation: [
    [6, 5, 4, 5, 6, 7, 6, 7, 6, 7, 8, 9, 10, 9, 8, 7],
    [7, 3, 4, 4, 5, 6, 5, 7, 6, 8, 9, 10, 9, 8, 9, 7],
    [5, 4, 3, 4, 4, 5, 6, 5, 7, 6, 8, 9, 10, 9, 8, 9],
    [7, 5, 3, 3, 4, 4, 5, 6, 5, 7, 6, 8, 9, 10, 9, 8],
    [6, 5, 4, 3, 4, 4, 3, 4, 6, 5, 7, 6, 8, 9, 10, 9],
    [7, 6, 3, 4, 4, 4, 4, 3, 4, 5, 6, 5, 6, 10, 11, 10],
    [6, 6, 4, 3, 4, 4, 4, 4, 3, 4, 5, 6, 5, 9, 10, 8],
    [7, 8, 5, 4, 4, 4, 3, 4, 4, 3, 4, 5, 6, 7, 8, 9],
    [8, 9, 6, 3, 4, 3, 2, 3, 4, 4, 3, 4, 6, 8, 8, 9],
    [9, 9, 5, 4, 3, 4, 3, 4, 3, 4, 4, 3, 5, 7, 9, 8],
    [8, 8, 6, 5, 4, 3, 4, 3, 2, 3, 4, 4, 5, 7, 8, 9],
    [9, 9, 7, 6, 5, 4, 3, 4, 2, 6, 4, 4, 4, 5, 7, 8],
    [8, 8, 7, 7, 6, 5, 4, 5, 7, 8, 7, 4, 4, 4, 5, 7],
    [7, 7, 5, 7, 8, 7, 6, 8, 9, 10, 8, 7, 4, 4, 4, 5],
    [5, 6, 6, 6, 7, 8, 7, 9, 8, 9, 8, 7, 7, 4, 4, 4],
    [4, 5, 7, 5, 6, 7, 8, 8, 9, 10, 9, 8, 6, 7, 4, 4],
  ],
  terrainOverrides: [],
  properties: [],
  decks: [],
};

export const mountainPass: BattleMap = buildMapFromSpec(MOUNTAIN_PASS_SPEC);
