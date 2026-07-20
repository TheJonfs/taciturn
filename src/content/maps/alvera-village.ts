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

export const ALVERA_VILLAGE_WIDTH = 16;
export const ALVERA_VILLAGE_HEIGHT = 16;

// Alvera Village (16×16) — prose: docs/maps/alvera-village.md.
export const ALVERA_VILLAGE_SPEC: MapSpec = {
  key: 'alvera_village',
  label: 'Alvera Village',
  width: ALVERA_VILLAGE_WIDTH,
  height: ALVERA_VILLAGE_HEIGHT,
  bands: [
    { when: 'eq', elevation: 0, terrain: 'water_deep' },
    { when: 'eq', elevation: 1, terrain: 'water_shallow' },
    { when: 'eq', elevation: 8, terrain: 'rampart' },
  ],
  elevation: [
    [8, 8, 8, 8, 8, 8, 3, 3, 3, 3, 3, 2, 2, 1, 1, 0],
    [8, 3, 3, 3, 3, 8, 3, 3, 3, 3, 2, 2, 1, 1, 0, 0],
    [8, 3, 3, 3, 3, 8, 3, 3, 3, 2, 2, 1, 1, 0, 0, 1],
    [8, 8, 3, 8, 8, 8, 3, 3, 2, 2, 1, 1, 0, 0, 1, 1],
    [3, 2, 2, 2, 3, 3, 3, 2, 2, 1, 1, 0, 0, 1, 1, 2],
    [3, 2, 2, 2, 3, 3, 2, 2, 1, 1, 0, 0, 1, 1, 2, 2],
    [2, 2, 2, 2, 2, 2, 2, 1, 1, 0, 0, 1, 1, 2, 2, 3],
    [1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 2, 2, 3, 3],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 2, 2, 2, 3],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 3, 3, 3],
    [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    [8, 8, 8, 8, 8, 2, 2, 2, 2, 2, 2, 2, 8, 8, 8, 8],
    [8, 3, 3, 3, 8, 2, 8, 8, 3, 8, 8, 2, 8, 3, 3, 8],
    [8, 3, 3, 3, 3, 2, 8, 3, 3, 3, 8, 2, 3, 3, 3, 8],
    [8, 3, 3, 3, 8, 2, 8, 3, 3, 3, 8, 2, 8, 3, 3, 8],
    [8, 8, 8, 8, 8, 2, 8, 8, 8, 8, 8, 2, 8, 8, 8, 8],
  ],
  terrainOverrides: [],
  properties: [
    { x: 2, y: 10, properties: ['bridge_ramp'] },
  ],
  decks: [
    { x: 2, y: 7, elevation: 3, terrain: 'bridge', properties: [] },
    { x: 2, y: 8, elevation: 3, terrain: 'bridge', properties: [] },
    { x: 2, y: 9, elevation: 3, terrain: 'bridge', properties: [] },
  ],
};

export const alveraVillage: BattleMap = buildMapFromSpec(ALVERA_VILLAGE_SPEC);
