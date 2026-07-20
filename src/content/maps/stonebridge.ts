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

export const STONEBRIDGE_WIDTH = 16;
export const STONEBRIDGE_HEIGHT = 16;

// Stonebridge (16×16) — prose: docs/maps/stonebridge.md.
export const STONEBRIDGE_SPEC: MapSpec = {
  key: 'stonebridge',
  label: 'Stonebridge',
  width: STONEBRIDGE_WIDTH,
  height: STONEBRIDGE_HEIGHT,
  bands: [
    { when: 'eq', elevation: 0, terrain: 'water_deep' },
    { when: 'eq', elevation: 1, terrain: 'water_shallow' },
  ],
  elevation: [
    [8, 7, 5, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    [7, 7, 5, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    [5, 5, 5, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    [1, 1, 1, 1, 1, 1, 3, 3, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 4, 4, 1, 1, 1, 1, 1, 1, 2, 1],
    [0, 1, 1, 0, 0, 0, 5, 5, 0, 0, 0, 0, 2, 0, 2, 0],
    [0, 1, 0, 0, 0, 0, 6, 6, 0, 0, 0, 2, 2, 0, 0, 0],
    [0, 0, 1, 0, 0, 0, 6, 6, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 0, 0, 0, 5, 5, 0, 0, 0, 2, 2, 0, 2, 0],
    [1, 1, 1, 1, 1, 1, 4, 4, 1, 1, 1, 1, 2, 1, 2, 1],
    [1, 1, 1, 1, 1, 1, 3, 3, 1, 1, 1, 1, 1, 1, 1, 1],
    [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 8, 8, 8, 8, 8, 8],
    [5, 5, 5, 3, 2, 2, 2, 2, 2, 2, 8, 2, 2, 2, 2, 6],
    [7, 7, 5, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 4],
    [8, 7, 5, 3, 2, 2, 2, 2, 2, 2, 8, 8, 2, 2, 2, 2],
  ],
  terrainOverrides: [
    { x: 10, y: 12, terrain: 'rampart' },
    { x: 11, y: 12, terrain: 'rampart' },
    { x: 12, y: 12, terrain: 'rampart' },
    { x: 13, y: 12, terrain: 'rampart' },
    { x: 14, y: 12, terrain: 'rampart' },
    { x: 15, y: 12, terrain: 'rampart' },
    { x: 10, y: 13, terrain: 'rampart' },
    { x: 10, y: 15, terrain: 'rampart' },
    { x: 11, y: 15, terrain: 'rampart' },
  ],
  properties: [],
  decks: [],
};

export const stonebridge: BattleMap = buildMapFromSpec(STONEBRIDGE_SPEC);
