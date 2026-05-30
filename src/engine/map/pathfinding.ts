// Pathfinding — Dijkstra over the tile graph for a unit's legal moves.
// See docs/design/map-and-battlefield.md ("Move engine") and ADR-0006.
//
// Pure function: same `(state, unitId, catalog)` always yields the same
// MovementResult. No reducer dependency.
//
// Graph definition (adjacency, step legality) is driven entirely by the
// composed MovementProfile — pathfinding is profile-blind beyond reading
// its fields. Special-movement profiles fork the algorithm:
//   - undefined → standard Dijkstra (default).
//   - 'fly'     → standard Dijkstra but the jump constraint is dropped;
//                 terrain costs and canEnter still apply (a flying unit
//                 with no canEnter for water still can't land on it).
//   - 'teleport' / 'phase' → not implemented yet; throws. No content
//                 consumer in v1; lands when the corresponding ability
//                 arrives.
//
// Why Dijkstra and not A*: we want every reachable tile and its path,
// not a single shortest path. A* would buy nothing; per-terrain costs
// rule out straight BFS.
//
// Cost model: each step costs `terrainCosts.get(destinationTerrain) ?? 1`.
// The unit may move along any path whose total cost is ≤ moveRange.
//
// Session 32 / Item 15: jump-over-water leap candidates. During node
// expansion, in addition to the four cardinal one-step adjacents, the
// algorithm considers four cardinal two-step leaps where the
// intermediate tile is water (elevation 0 or 1) and the destination is
// land (elevation ≥ 2). Each leap costs a fixed 2 move points and
// requires the moving unit to have `jump ≥ 1`. The elevation differential
// from source to destination must still satisfy the jump tolerance
// (same rule as a standard step). The intermediate tile is *not*
// required to satisfy `canEnter` — the unit leaps over it. See
// docs/maps/river-ridge.md ("Jump-Over-Water Rule").

import { computeMovementProfile } from './movement-profile.ts';
import { tileAt, tilesAt, unitAt, isKO } from './accessors.ts';
import {
  getUnit,
  type GameState,
  type MovementProfile,
  type Position,
  type TeamId,
  type Tile,
  type UnitId,
} from '../types/index.ts';
import type { Catalog } from '../catalog/index.ts';

// Stable string serialization for use as a Map key.
export type PositionKey = string;

export function positionKey(p: Position): PositionKey {
  return `${p.x},${p.y},${p.layer}`;
}

// A reachable destination paired with the tile sequence that reaches it.
// `path[0]` is the unit's starting tile; `path[path.length - 1]` is the
// destination. `cost` is the total path cost (sum of step costs).
export interface MovePath {
  readonly destination: Position;
  readonly path: ReadonlyArray<Position>;
  readonly cost: number;
}

export interface MovementResult {
  readonly reachable: ReadonlyMap<PositionKey, MovePath>;
}

export class SpecialMovementNotImplementedError extends Error {
  override readonly name = 'SpecialMovementNotImplementedError';
  constructor(readonly kind: string) {
    super(`Special movement '${kind}' is not implemented yet (session 4 covers standard movement only)`);
  }
}

interface FrontierEntry {
  readonly key: PositionKey;
  readonly position: Position;
  readonly cost: number;
}

const CARDINAL_DELTAS: ReadonlyArray<{ readonly dx: number; readonly dy: number }> = [
  { dx: 1, dy: 0 },
  { dx: -1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: 0, dy: -1 },
];

// Jump-over-water leap is a fixed 2 move points (per river-ridge.md and
// Session 32 brief Item 15). Independent of `terrainCosts` — the leap
// is a category of move, not a per-tile cost lookup.
const LEAP_COST = 2;

// Per universal water-table convention (river-ridge.md "Elevation Grid"):
// elev 0 = deep water, elev 1 = shallow water, elev ≥ 2 = land. The
// elevation alone determines water-ness; no separate terrain check is
// needed. Future terrain-manipulation abilities mutate elevation +
// terrain in lockstep so the cost lookup also flips.
function isWaterTile(tile: Tile): boolean {
  return tile.elevation <= 1;
}

function isLandTile(tile: Tile): boolean {
  return tile.elevation >= 2;
}

function inBounds(state: GameState, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < state.map.width && y < state.map.height;
}

// Naive priority dequeue — O(n) per pop. v1 maps are small (~400 tiles),
// so a binary heap is unjustified. Revisit if profiling shows otherwise.
function popLowest(frontier: FrontierEntry[]): FrontierEntry | undefined {
  if (frontier.length === 0) return undefined;
  let bestIdx = 0;
  for (let i = 1; i < frontier.length; i++) {
    if (frontier[i]!.cost < frontier[bestIdx]!.cost) bestIdx = i;
  }
  const [entry] = frontier.splice(bestIdx, 1);
  return entry;
}

// Step legality between two adjacent tiles. The destination tile is
// guaranteed in-bounds by the caller; this checks the per-step rules:
//   1. Destination terrain is in canEnter.
//   2. Occupant rule: a *living* unit on the tile blocks the step
//      *unless* `friendlyPassThrough` is on and the occupant is on the
//      same team as the moving unit. A KO'd occupant (any team) never
//      blocks traversal — FFT canon lets a unit path through a downed
//      body, just not stop on it. Settling on an occupied tile (living
//      *or* KO'd) is filtered separately by `getLegalMoves` after
//      Dijkstra completes. `removed` units occupy nothing (`unitAt`
//      skips them) and so don't reach this check.
//   3. Elevation differential ≤ jump — *unless* the unit is flying,
//      in which case the jump check is dropped (per design doc:
//      "Fly — moves over tiles ignoring elevation differentials").
function canStep(
  state: GameState,
  movingUnit: { readonly id: UnitId; readonly team: TeamId },
  fromTile: Tile,
  toTile: Tile,
  profile: MovementProfile,
  friendlyPassThrough: boolean,
): boolean {
  // Session 53: a Barrier makes its tile impassable — nothing steps onto
  // it (even a flying unit; the barrier is a solid object, not a height).
  if (toTile.barrier !== undefined) return false;
  if (!profile.canEnter.has(toTile.terrain)) return false;
  if (
    profile.specialMovement !== 'fly' &&
    Math.abs(toTile.elevation - fromTile.elevation) > profile.jump
  ) {
    return false;
  }
  const occupant = unitAt(state, toTile.x, toTile.y, toTile.layer);
  if (occupant !== undefined && occupant.id !== movingUnit.id && !isKO(occupant)) {
    if (!friendlyPassThrough) return false;
    if (occupant.team !== movingUnit.team) return false;
  }
  return true;
}

function stepCost(profile: MovementProfile, toTile: Tile): number {
  return profile.terrainCosts.get(toTile.terrain) ?? 1;
}

// Leap legality: like canStep, but the elevation differential is
// measured source-to-destination (the leap is one atomic move; the
// intermediate water tile is hopped over and contributes no terrain
// constraint). canEnter and occupancy still gate the destination.
// Flying units don't need leaps (they path straight across water at
// terrain-cost-1) but the rule lets them anyway — no behavior change.
function canLeapTo(
  state: GameState,
  movingUnit: { readonly id: UnitId; readonly team: TeamId },
  fromTile: Tile,
  destTile: Tile,
  profile: MovementProfile,
  friendlyPassThrough: boolean,
): boolean {
  // Session 53: a Barrier on the landing tile blocks the leap, same as a step.
  if (destTile.barrier !== undefined) return false;
  if (!profile.canEnter.has(destTile.terrain)) return false;
  if (
    profile.specialMovement !== 'fly' &&
    Math.abs(destTile.elevation - fromTile.elevation) > profile.jump
  ) {
    return false;
  }
  const occupant = unitAt(state, destTile.x, destTile.y, destTile.layer);
  if (occupant !== undefined && occupant.id !== movingUnit.id && !isKO(occupant)) {
    if (!friendlyPassThrough) return false;
    if (occupant.team !== movingUnit.team) return false;
  }
  return true;
}

export function getLegalMoves(
  state: GameState,
  unitId: UnitId,
  catalog: Catalog,
): MovementResult {
  const unit = getUnit(state, unitId);
  const profile = computeMovementProfile(state, unitId, catalog);
  const ruleset = catalog.getRuleset(state.ruleset.id);
  const friendlyPassThrough = ruleset.behaviors.friendlyPassThrough;

  if (profile.specialMovement !== undefined && profile.specialMovement !== 'fly') {
    throw new SpecialMovementNotImplementedError(profile.specialMovement);
  }

  const startTile = tileAt(state.map, unit.position.x, unit.position.y, unit.position.layer);
  if (startTile === undefined) {
    // The unit is positioned where no tile exists. Treat as bug (not a
    // legitimate runtime state) — callers should not reach here.
    throw new Error(
      `Unit ${unit.id} occupies (${unit.position.x},${unit.position.y},${unit.position.layer}) but no tile exists there`,
    );
  }

  // Best-known cost to reach each (x, y, layer); a Map keyed on PositionKey.
  const bestCost = new Map<PositionKey, number>();
  // Predecessor for path reconstruction.
  const cameFrom = new Map<PositionKey, PositionKey>();
  // Position object per key, so reconstruction can produce Positions.
  const positions = new Map<PositionKey, Position>();

  const startKey = positionKey(unit.position);
  bestCost.set(startKey, 0);
  positions.set(startKey, unit.position);

  const frontier: FrontierEntry[] = [
    { key: startKey, position: unit.position, cost: 0 },
  ];

  while (frontier.length > 0) {
    const current = popLowest(frontier);
    if (current === undefined) break;
    // Skip if a better entry has already been settled.
    if (current.cost > (bestCost.get(current.key) ?? Infinity)) continue;

    const fromTile = tileAt(state.map, current.position.x, current.position.y, current.position.layer);
    if (fromTile === undefined) continue;

    for (const delta of CARDINAL_DELTAS) {
      const nx = current.position.x + delta.dx;
      const ny = current.position.y + delta.dy;
      if (!inBounds(state, nx, ny)) continue;
      // Adjacency considers all tiles at (nx, ny) regardless of layer.
      const candidates = tilesAt(state.map, nx, ny);
      for (const toTile of candidates) {
        if (!canStep(state, unit, fromTile, toTile, profile, friendlyPassThrough)) continue;
        const newCost = current.cost + stepCost(profile, toTile);
        if (newCost > profile.moveRange) continue;
        const toPos: Position = { x: toTile.x, y: toTile.y, layer: toTile.layer };
        const toKey = positionKey(toPos);
        const previousBest = bestCost.get(toKey) ?? Infinity;
        if (newCost < previousBest) {
          bestCost.set(toKey, newCost);
          cameFrom.set(toKey, current.key);
          positions.set(toKey, toPos);
          frontier.push({ key: toKey, position: toPos, cost: newCost });
        }
      }

      // Jump-over-water leap candidates (Session 32 / Item 15). Two-step
      // cardinal leap where the intermediate is water (elev 0 or 1) and
      // the destination is land (elev ≥ 2). Cost 2; requires jump ≥ 1.
      // The intermediate tile's `canEnter` does not gate the leap; the
      // destination still must.
      if (profile.jump >= 1) {
        const lx = current.position.x + 2 * delta.dx;
        const ly = current.position.y + 2 * delta.dy;
        if (!inBounds(state, lx, ly)) continue;
        // For the intermediate, take any tile at the cell — water on
        // *any* layer (river map is single-layer in v1) is a leap-over
        // candidate. If multiple intermediates exist, we treat the leap
        // as valid if any of them is water.
        const intermediates = tilesAt(state.map, nx, ny);
        const intermediateIsWater = intermediates.some(isWaterTile);
        if (!intermediateIsWater) continue;
        const leapCandidates = tilesAt(state.map, lx, ly);
        for (const destTile of leapCandidates) {
          if (!isLandTile(destTile)) continue;
          if (!canLeapTo(state, unit, fromTile, destTile, profile, friendlyPassThrough)) continue;
          const leapCost = current.cost + LEAP_COST;
          if (leapCost > profile.moveRange) continue;
          const destPos: Position = { x: destTile.x, y: destTile.y, layer: destTile.layer };
          const destKey = positionKey(destPos);
          const previousBest = bestCost.get(destKey) ?? Infinity;
          if (leapCost < previousBest) {
            bestCost.set(destKey, leapCost);
            cameFrom.set(destKey, current.key);
            positions.set(destKey, destPos);
            frontier.push({ key: destKey, position: destPos, cost: leapCost });
          }
        }
      }
    }
  }

  // Reconstruct paths. The starting tile is reachable at cost 0 with a
  // single-element path; every other reachable tile chains back through
  // cameFrom until the start.
  //
  // With friendly pass-through on, an ally's tile shows up in `bestCost`
  // because Dijkstra was allowed to step onto it — but a unit cannot
  // *settle* on an ally tile. Filter those out of the reachable set
  // here; intermediate ally tiles still appear in any further-out
  // tile's `path` because the predecessor chain is unaffected.
  const reachable = new Map<PositionKey, MovePath>();
  for (const [key, cost] of bestCost) {
    const pos = positions.get(key)!;
    const occupant = unitAt(state, pos.x, pos.y, pos.layer);
    if (occupant !== undefined && occupant.id !== unit.id) continue;
    const path: Position[] = [];
    let cursor: PositionKey | undefined = key;
    while (cursor !== undefined) {
      path.push(positions.get(cursor)!);
      cursor = cameFrom.get(cursor);
    }
    path.reverse();
    reachable.set(key, { destination: pos, path, cost });
  }

  return { reachable };
}
