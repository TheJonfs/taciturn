// Arc targeting — overhead-clearance check for lobbed projectiles.
// See docs/design/map-and-battlefield.md ("Arc").
//
// Rules:
// - Source tile must not be covered: no tile at higher layer at source's
//   (x, y).
// - Target tile must not be covered: no tile at higher layer at target's
//   (x, y).
//
// Intermediate obstructions are explicitly *not* checked: the projectile
// is conceptually high enough that ground walls and units between source
// and target are irrelevant. Bridges and ceilings provide cover from arc
// attacks where they don't from straight-line.

import { tilesAt } from './accessors.ts';
import type { BattleMap } from '../types/index.ts';

export interface ArcEndpoint {
  readonly x: number;
  readonly y: number;
  readonly layer: number;
}

function isCovered(map: BattleMap, x: number, y: number, layer: number): boolean {
  for (const tile of tilesAt(map, x, y)) {
    if (tile.layer > layer) return true;
  }
  return false;
}

export function arcTargetable(map: BattleMap, source: ArcEndpoint, target: ArcEndpoint): boolean {
  if (isCovered(map, source.x, source.y, source.layer)) return false;
  if (isCovered(map, target.x, target.y, target.layer)) return false;
  return true;
}
