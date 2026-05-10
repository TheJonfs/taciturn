// Training Field — the first authored map for the Phase A battle UI.
//
// Per the post-reconciliation roadmap (Session 22) and `docs/twentyOne
// Planning/mage-war-content-spec.md`: a 14×14 grid of uniform `ground`
// terrain at elevation 2. Single layer. No deployment zones encoded
// (the `deploymentZone` tile field doesn't ship until Cluster 2). All
// tiles are walkable by any class with the default per-tile move cost
// (terrain `ground`, elevation flat, no properties).
//
// Elevation 2 (rather than 0) honors the implicit water-table rule
// authored in the spec — water sits below elevation 2; land sits at
// elevation 2 or above. Training Field has no water, but staying at
// elevation 2 keeps the map authoring style consistent with River
// Ridge (Session 33) and any subsequent maps.
//
// The map is intentionally small in design surface: every tile is the
// same. It exists to give the Phase A battle UI something to render
// at the eventual real-world scale (14×14 is the size both shipped maps
// will use) without entangling it with terrain-pathing nuances. River
// Ridge layers in elevation, water, and deployment zones against the
// same renderer.
//
// Lives in `src/content/maps/` per the architecture overview's content
// organization. Battles that use this map import the constant directly.

import type { BattleMap, Tile } from '@engine/index.ts';

export const TRAINING_FIELD_WIDTH = 14;
export const TRAINING_FIELD_HEIGHT = 14;
export const TRAINING_FIELD_ELEVATION = 2;

function buildTrainingField(): BattleMap {
  const tiles: Tile[] = [];
  for (let y = 0; y < TRAINING_FIELD_HEIGHT; y++) {
    for (let x = 0; x < TRAINING_FIELD_WIDTH; x++) {
      tiles.push({
        x,
        y,
        layer: 0,
        elevation: TRAINING_FIELD_ELEVATION,
        terrain: 'ground',
        properties: [],
      });
    }
  }
  return {
    width: TRAINING_FIELD_WIDTH,
    height: TRAINING_FIELD_HEIGHT,
    tiles,
  };
}

export const trainingField: BattleMap = buildTrainingField();
