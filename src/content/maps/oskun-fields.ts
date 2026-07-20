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

export const OSKUN_FIELDS_WIDTH = 16;
export const OSKUN_FIELDS_HEIGHT = 16;

// Oskun Fields (16×16) — prose: docs/maps/oskun-fields.md.
export const OSKUN_FIELDS_SPEC: MapSpec = {
  key: 'oskun_fields',
  label: 'Oskun Fields',
  width: OSKUN_FIELDS_WIDTH,
  height: OSKUN_FIELDS_HEIGHT,
  bands: [
    { when: 'eq', elevation: 0, terrain: 'water_deep' },
    { when: 'eq', elevation: 1, terrain: 'water_shallow' },
  ],
  elevation: [
    [1, 1, 1, 1, 1, 1, 1, 1, 3, 3, 3, 3, 3, 3, 2, 3],
    [1, 2, 3, 3, 3, 3, 3, 1, 3, 2, 2, 3, 3, 2, 3, 2],
    [3, 3, 2, 3, 3, 4, 3, 1, 3, 2, 2, 3, 3, 3, 3, 3],
    [4, 4, 3, 2, 3, 3, 3, 1, 3, 3, 3, 3, 2, 2, 2, 3],
    [2, 2, 3, 3, 2, 3, 3, 1, 3, 4, 5, 3, 2, 4, 2, 3],
    [3, 3, 4, 3, 2, 2, 2, 1, 3, 4, 4, 3, 2, 2, 2, 3],
    [5, 6, 4, 4, 3, 3, 2, 1, 3, 4, 4, 3, 3, 3, 3, 3],
    [4, 5, 5, 4, 4, 3, 2, 1, 3, 3, 3, 3, 3, 3, 3, 3],
    [4, 5, 5, 4, 4, 3, 2, 1, 1, 1, 1, 1, 3, 2, 3, 3],
    [5, 6, 4, 3, 3, 3, 2, 2, 2, 2, 2, 1, 3, 2, 3, 2],
    [3, 3, 4, 4, 3, 3, 3, 3, 3, 3, 2, 1, 3, 3, 3, 3],
    [3, 2, 3, 4, 3, 2, 3, 4, 5, 3, 2, 1, 3, 2, 2, 3],
    [3, 3, 2, 3, 3, 3, 4, 5, 5, 3, 2, 1, 3, 3, 3, 3],
    [3, 2, 1, 2, 3, 3, 5, 5, 4, 3, 2, 1, 1, 1, 1, 1],
    [0, 1, 2, 3, 3, 3, 5, 4, 3, 3, 2, 2, 2, 2, 2, 2],
    [0, 0, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
  ],
  terrainOverrides: [],
  properties: [],
  decks: [],
};

export const oskunFields: BattleMap = buildMapFromSpec(OSKUN_FIELDS_SPEC);
