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

export const MARSHMOOR_WIDTH = 16;
export const MARSHMOOR_HEIGHT = 16;

// Marshmoor (16×16) — prose: docs/maps/marshmoor.md.
export const MARSHMOOR_SPEC: MapSpec = {
  key: 'marshmoor',
  label: 'Marshmoor',
  width: MARSHMOOR_WIDTH,
  height: MARSHMOOR_HEIGHT,
  bands: [
    { when: 'eq', elevation: 0, terrain: 'water_deep' },
    { when: 'eq', elevation: 1, terrain: 'water_shallow' },
  ],
  elevation: [
    [0, 5, 5, 1, 1, 2, 2, 0, 0, 0, 1, 1, 1, 2, 2, 3],
    [0, 4, 4, 1, 1, 2, 2, 0, 2, 2, 1, 2, 1, 2, 4, 2],
    [0, 3, 3, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 2, 2, 2],
    [0, 2, 2, 1, 0, 2, 0, 2, 1, 0, 1, 1, 1, 1, 1, 1],
    [0, 2, 2, 1, 1, 0, 1, 0, 1, 2, 1, 1, 1, 1, 2, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1],
    [2, 2, 2, 2, 1, 2, 2, 2, 1, 0, 0, 1, 0, 1, 2, 1],
    [1, 1, 1, 1, 1, 2, 2, 2, 1, 1, 1, 1, 1, 1, 2, 1],
    [1, 2, 1, 1, 1, 1, 1, 1, 2, 2, 2, 1, 1, 1, 1, 1],
    [1, 2, 1, 1, 2, 0, 0, 1, 2, 2, 2, 1, 2, 2, 2, 2],
    [1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 2, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 2, 2, 0],
    [1, 1, 1, 1, 1, 1, 2, 1, 2, 0, 2, 0, 1, 2, 2, 0],
    [2, 2, 2, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 3, 2, 0],
    [2, 3, 2, 1, 2, 1, 2, 2, 0, 2, 2, 1, 1, 4, 4, 0],
    [4, 2, 2, 1, 1, 1, 0, 0, 0, 2, 2, 1, 1, 6, 6, 0],
  ],
  terrainOverrides: [],
  properties: [],
  decks: [],
};

export const marshmoor: BattleMap = buildMapFromSpec(MARSHMOOR_SPEC);
