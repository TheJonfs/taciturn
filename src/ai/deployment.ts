// AI deployment heuristic (Session 43).
//
// Places an AI-controlled team's units onto its deployment-zone tiles
// without human input. The heuristic is intentionally simple: tanks
// forward, everyone facing the enemy.
//
//   1. Opposing-zone centroid — the average position of every tile
//      tagged as a deployment zone for some *other* team.
//   2. Front center — the own-zone tile closest to that centroid (the
//      tip of the spear).
//   3. Sort units by descending maxHP (high-HP bodies soak the front),
//      tie-broken by class id ascending so the result is deterministic.
//   4. Assign each unit, in that order, to the still-available own-zone
//      tile closest to the front center. Facing points from the tile
//      toward the opposing centroid.
//
// Pure: no RNG, no I/O. The zone-smaller-than-team edge case returns the
// leftover unit ids in `unplaced` rather than logging — the caller (the
// app's deployment routing) owns the warning so this stays a pure,
// trivially-testable geometry function. The heuristic is "correct most
// of the time but not smart"; role-aware placement is a future refinement
// (see S43 playtest-watch).

import {
  cardinalFromTo,
  type BattleMap,
  type ClassId,
  type Direction,
  type Position,
  type Tile,
  type TeamId,
  type UnitId,
} from '@engine/index.ts';

// The minimum a unit needs to be placed by the heuristic: its id, its
// computed maxHP (the sort key — caller computes it, since maxHP is a
// computed-not-stored value), and its class id (the deterministic
// tie-break).
export interface DeployableUnit {
  readonly id: UnitId;
  readonly maxHP: number;
  readonly classId: ClassId;
}

export interface AiDeploymentResult {
  readonly placements: ReadonlyMap<UnitId, { readonly position: Position; readonly facing: Direction }>;
  // Unit ids that did not fit (zone smaller than the team). Empty in the
  // normal case; non-empty signals a content-authoring problem the
  // caller should surface.
  readonly unplaced: ReadonlyArray<UnitId>;
}

interface Centroid {
  readonly x: number;
  readonly y: number;
}

// Squared Euclidean distance on (x, y). Squared avoids a sqrt and
// preserves ordering — we only ever compare distances, never report them.
function dist2(tile: Tile, point: Centroid): number {
  const dx = tile.x - point.x;
  const dy = tile.y - point.y;
  return dx * dx + dy * dy;
}

// Deterministic total order over tiles: row, then column, then layer.
// Used as the tie-break whenever two tiles are equidistant from a
// reference point, so the heuristic never depends on map-tile iteration
// order.
function tileOrder(a: Tile, b: Tile): number {
  if (a.y !== b.y) return a.y - b.y;
  if (a.x !== b.x) return a.x - b.x;
  return a.layer - b.layer;
}

function centroidOf(tiles: ReadonlyArray<Tile>): Centroid {
  let sx = 0;
  let sy = 0;
  for (const t of tiles) {
    sx += t.x;
    sy += t.y;
  }
  return { x: sx / tiles.length, y: sy / tiles.length };
}

export function planAiDeployment(args: {
  readonly map: BattleMap;
  readonly team: TeamId;
  readonly units: ReadonlyArray<DeployableUnit>;
}): AiDeploymentResult {
  const { map, team, units } = args;

  const ownZone = map.tiles.filter((t) => t.deploymentZone === team);
  // Opposing zone = any tile tagged for a *different* team. `null` (an
  // explicitly-neutral shared zone) and `undefined` (no zone) are skipped.
  const opposingZone = map.tiles.filter(
    (t) => t.deploymentZone != null && t.deploymentZone !== team,
  );

  if (opposingZone.length === 0) {
    throw new Error(
      `planAiDeployment: map declares no opposing deployment zone for team ${JSON.stringify(team)}`,
    );
  }

  // No own-zone tiles → nothing can be placed. Fail loud rather than
  // silently returning an empty plan (it's a malformed-map signal).
  if (ownZone.length === 0) {
    throw new Error(
      `planAiDeployment: map declares no deployment zone for team ${JSON.stringify(team)}`,
    );
  }

  const opposingCentroid = centroidOf(opposingZone);

  // Front center: the own-zone tile closest to the enemy centroid.
  let frontCenter = ownZone[0]!;
  for (const t of ownZone) {
    const d = dist2(t, opposingCentroid);
    const best = dist2(frontCenter, opposingCentroid);
    if (d < best || (d === best && tileOrder(t, frontCenter) < 0)) {
      frontCenter = t;
    }
  }
  const frontCenterPoint: Centroid = { x: frontCenter.x, y: frontCenter.y };

  // High HP first; class id breaks ties so the plan is deterministic.
  const sorted = [...units].sort((a, b) => {
    if (a.maxHP !== b.maxHP) return b.maxHP - a.maxHP;
    return a.classId < b.classId ? -1 : a.classId > b.classId ? 1 : 0;
  });

  const available = [...ownZone];
  const placements = new Map<UnitId, { readonly position: Position; readonly facing: Direction }>();
  const unplaced: UnitId[] = [];

  for (const unit of sorted) {
    if (available.length === 0) {
      unplaced.push(unit.id);
      continue;
    }
    // Pick the available tile nearest the front center (tie-break by
    // tileOrder for determinism).
    let bestIdx = 0;
    for (let i = 1; i < available.length; i++) {
      const cand = available[i]!;
      const best = available[bestIdx]!;
      const dc = dist2(cand, frontCenterPoint);
      const db = dist2(best, frontCenterPoint);
      if (dc < db || (dc === db && tileOrder(cand, best) < 0)) {
        bestIdx = i;
      }
    }
    const tile = available.splice(bestIdx, 1)[0]!;
    const facing = cardinalFromTo(
      { x: tile.x, y: tile.y },
      opposingCentroid,
    );
    placements.set(unit.id, {
      position: { x: tile.x, y: tile.y, layer: tile.layer },
      facing,
    });
  }

  return { placements, unplaced };
}
