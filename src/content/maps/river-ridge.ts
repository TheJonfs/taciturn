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

export const RIVER_RIDGE_WIDTH = 14;
export const RIVER_RIDGE_HEIGHT = 14;

// River Ridge (14×14) — prose: docs/maps/river-ridge.md.
export const RIVER_RIDGE_SPEC: MapSpec = {
  key: 'river_ridge',
  label: 'River Ridge',
  width: RIVER_RIDGE_WIDTH,
  height: RIVER_RIDGE_HEIGHT,
  bands: [
    { when: 'eq', elevation: 0, terrain: 'water_deep' },
    { when: 'eq', elevation: 1, terrain: 'water_shallow' },
  ],
  elevation: [
    [0, 0, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    [0, 0, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    [0, 0, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    [0, 0, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    [0, 2, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    [0, 2, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    [0, 0, 1, 2, 3, 4, 7, 7, 7, 7, 9, 9, 9, 9],
    [0, 0, 2, 2, 3, 4, 7, 7, 7, 7, 9, 9, 9, 9],
    [0, 2, 1, 2, 3, 4, 7, 7, 7, 7, 9, 9, 9, 9],
    [0, 2, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    [0, 0, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    [0, 0, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    [0, 0, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    [0, 0, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  ],
  terrainOverrides: [],
  properties: [],
  decks: [],
};

export const riverRidge: BattleMap = buildMapFromSpec(RIVER_RIDGE_SPEC);
