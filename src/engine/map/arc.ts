// Arc targeting — overhead-clearance check for lobbed projectiles (bows and
// the lobbed/area attacks). See docs/design/map-and-battlefield.md ("Arc").
//
// Rules:
// - Source tile must not be covered: no tile at a higher layer at source's
//   (x, y) — a ceiling/bridge over the shooter.
// - Target tile must not be covered: same, over the target.
// - Bounded apex (S69 follow-up): the lob has a finite ceiling. An
//   intermediate tile blocks the arc only when its ground surface rises
//   *more than `ARC_LOB_CLEARANCE` above the higher of the two endpoints* —
//   so a wall / building is cleared (the projectile lobs over it, FFT-style)
//   but a genuine mountain blocks. Previously intermediate obstructions were
//   ignored entirely (the projectile was modeled as infinitely high), so an
//   arc could clear a 50-tall peak.
//
// The clearance is a flat ceiling above the higher endpoint, not a true
// parabola — deliberately generous near the endpoints (so you can still lob
// over an adjacent wall), which matches the intended feel. Vantage is *not*
// folded in (it already boosts a bow's reach-from-height; the lob apex is a
// property of the projectile, not the shooter's eye).

import { tileAt, tilesAt } from './accessors.ts';
import { bresenhamCells } from './bresenham.ts';
import type { BattleMap } from '../types/index.ts';

// How far above the higher endpoint a lob can clear an obstacle. Set to 5 to
// mirror the bow's height-delta damage falloff (`falloffPerHeight: 0.2` → a
// bow already deals 0 at a +5 height delta), so a bow can lob over cover up
// to exactly the height where its shot would be worthless anyway. A single
// retunable dial (cf. VANTAGE_ELEVATION_BONUS); see docs/playtest-watch.md.
const ARC_LOB_CLEARANCE = 5;

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

function endpointElevation(map: BattleMap, p: ArcEndpoint): number {
  return tileAt(map, p.x, p.y, p.layer)?.elevation ?? 0;
}

export function arcTargetable(map: BattleMap, source: ArcEndpoint, target: ArcEndpoint): boolean {
  if (isCovered(map, source.x, source.y, source.layer)) return false;
  if (isCovered(map, target.x, target.y, target.layer)) return false;

  // Bounded apex: the lob clears obstacles up to ARC_LOB_CLEARANCE above the
  // higher endpoint; anything taller pokes through the arc and blocks it.
  const apex =
    Math.max(endpointElevation(map, source), endpointElevation(map, target)) + ARC_LOB_CLEARANCE;
  const cells = bresenhamCells(source.x, source.y, target.x, target.y);
  for (let i = 1; i < cells.length - 1; i++) {
    const cell = cells[i]!;
    for (const tile of tilesAt(map, cell.x, cell.y)) {
      if (tile.elevation > apex) return false;
    }
  }
  return true;
}
