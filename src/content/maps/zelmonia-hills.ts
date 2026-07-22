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

export const ZELMONIA_HILLS_WIDTH = 16;
export const ZELMONIA_HILLS_HEIGHT = 16;

// Zelmonia Hills (16×16) — prose: docs/maps/zelmonia-hills.md.
export const ZELMONIA_HILLS_SPEC: MapSpec = {
  key: 'zelmonia_hills',
  label: 'Zelmonia Hills',
  width: ZELMONIA_HILLS_WIDTH,
  height: ZELMONIA_HILLS_HEIGHT,
  bands: [
    { when: 'eq', elevation: 0, terrain: 'water_deep' },
    { when: 'eq', elevation: 1, terrain: 'water_shallow' },
  ],
  elevation: [
    [14, 12, 7, 7, 7, 12, 12, 13, 13, 13, 12, 12, 7, 7, 7, 7],
    [14, 14, 12, 7, 7, 7, 12, 13, 13, 13, 12, 7, 7, 7, 7, 7],
    [13, 13, 12, 12, 7, 7, 7, 11, 11, 8, 7, 7, 7, 11, 11, 11],
    [12, 12, 12, 12, 7, 7, 7, 7, 7, 7, 7, 7, 7, 11, 11, 11],
    [11, 11, 10, 10, 10, 10, 7, 7, 7, 7, 10, 10, 10, 10, 10, 10],
    [11, 10, 10, 9, 8, 8, 5, 5, 5, 5, 10, 9, 9, 9, 9, 9],
    [10, 10, 9, 8, 8, 7, 6, 5, 5, 5, 9, 8, 8, 9, 9, 9],
    [9, 8, 8, 7, 7, 7, 7, 5, 4, 4, 9, 7, 7, 8, 9, 9],
    [8, 8, 7, 7, 7, 7, 5, 5, 4, 5, 9, 7, 7, 8, 8, 8],
    [8, 7, 7, 7, 7, 7, 5, 5, 5, 4, 7, 7, 7, 7, 7, 8],
    [7, 7, 6, 6, 6, 6, 5, 5, 4, 5, 6, 6, 6, 6, 7, 7],
    [7, 7, 6, 6, 6, 6, 5, 5, 5, 5, 6, 6, 6, 6, 6, 7],
    [5, 5, 6, 5, 5, 5, 4, 4, 4, 4, 5, 5, 5, 5, 6, 5],
    [5, 5, 5, 5, 5, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5],
    [5, 4, 4, 4, 4, 4, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5],
    [5, 4, 4, 4, 4, 4, 3, 2, 2, 3, 4, 4, 4, 4, 5, 5],
  ],
  terrainOverrides: [
    { x: 6, y: 6, terrain: 'grass_rock' },
    { x: 8, y: 7, terrain: 'grass_rock' },
    { x: 9, y: 7, terrain: 'grass_rock' },
    { x: 8, y: 8, terrain: 'grass_rock' },
    { x: 9, y: 9, terrain: 'grass_rock' },
    { x: 4, y: 10, terrain: 'grass_rock' },
    { x: 8, y: 10, terrain: 'grass_rock' },
    { x: 11, y: 10, terrain: 'grass_rock' },
    { x: 13, y: 10, terrain: 'grass_rock' },
    { x: 5, y: 11, terrain: 'grass_rock' },
    { x: 12, y: 11, terrain: 'grass_rock' },
    { x: 6, y: 12, terrain: 'grass_rock' },
    { x: 8, y: 12, terrain: 'grass_rock' },
    { x: 7, y: 13, terrain: 'grass_rock' },
    { x: 9, y: 13, terrain: 'grass_rock' },
  ],
  properties: [],
  decks: [],
};

export const zelmoniaHills: BattleMap = buildMapFromSpec(ZELMONIA_HILLS_SPEC);
