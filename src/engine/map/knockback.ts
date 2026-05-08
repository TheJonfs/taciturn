// Forced-movement (knockback) primitive — per ADR-0026.
//
// Pure function: takes a starting state + direction + distance and
// returns the kinematic result (final position, drop distance, optional
// falling-damage system_damage emission). The caller (a future
// ability-effect runner) applies the position update to state and
// enqueues the falling-damage emission.
//
// **Why not in the reducer:** knockback is a *side effect of an effect*,
// not a player-proposed action. Water Mage's Base spell is "damage with
// chance to knockback 1" — the knockback fires inline during ability
// resolution, not as a discrete user action. Keeping the primitive
// pure-functional decouples the kinematics from the ability surface.
//
// **Collision policy (per ADR-0026):**
//   1. Map edge → cancel at last legal tile.
//   2. Unit at destination → cancel at last legal tile.
//   3. Destination elevation ≥ standing elevation + 1 → cancel.
//   4. Otherwise, advance to the destination.
//
// **Falling damage:**
//   - dropDistance = startElevation - finalElevation
//   - if dropDistance > 1 → emit `system_damage` with amount = 10 × dropDistance
//   - if dropDistance ≤ 1 → no emission

import type { ProposedAction, UnitId } from '../types/index.ts';
import type { BattleMap, GameState, Position, Tile, Unit } from '../types/index.ts';
import { tileAt, tilesAt, unitAt } from './accessors.ts';

export type KnockbackDirection = 'N' | 'S' | 'E' | 'W';

export interface KnockbackArgs {
  readonly state: GameState;
  readonly unit: Unit;
  readonly direction: KnockbackDirection;
  readonly distance: number; // requested tiles to push; >= 1
}

export type KnockbackCancellation =
  | 'map_edge'
  | 'unit_blocker'
  | 'height_tolerance';

export interface KnockbackResult {
  readonly finalPosition: Position;
  readonly path: ReadonlyArray<Position>; // includes starting position; length === stepsTaken + 1
  readonly stepsTaken: number;
  readonly cancellation: KnockbackCancellation | null;
  // dropDistance: positive = drop (final elevation lower than start),
  // 0 or negative = level/uphill end (uphill cancels, so positive only
  // happens after legal downward steps).
  readonly dropDistance: number;
  // Falling-damage emission per ADR-0026. Undefined when dropDistance ≤ 1.
  readonly fallingDamageAction?: ProposedAction;
}

const DELTAS: Record<KnockbackDirection, { dx: number; dy: number }> = {
  N: { dx: 0, dy: -1 },
  S: { dx: 0, dy: 1 },
  E: { dx: 1, dy: 0 },
  W: { dx: -1, dy: 0 },
};

const FALLING_DAMAGE_PER_LEVEL = 10;

export function applyKnockback(args: KnockbackArgs): KnockbackResult {
  const { dx, dy } = DELTAS[args.direction];
  const startTile = tileAt(
    args.state.map,
    args.unit.position.x,
    args.unit.position.y,
    args.unit.position.layer,
  );
  if (startTile === undefined) {
    throw new Error(
      `applyKnockback: unit ${JSON.stringify(args.unit.id)} stands on a non-existent tile (${args.unit.position.x},${args.unit.position.y},${args.unit.position.layer})`,
    );
  }
  const startElevation = startTile.elevation;

  let currentPos: Position = { ...args.unit.position };
  let currentElevation = startElevation;
  const path: Position[] = [currentPos];
  let cancellation: KnockbackCancellation | null = null;

  for (let i = 0; i < args.distance; i++) {
    const nextX = currentPos.x + dx;
    const nextY = currentPos.y + dy;

    // Map edge.
    if (nextX < 0 || nextY < 0 || nextX >= args.state.map.width || nextY >= args.state.map.height) {
      cancellation = 'map_edge';
      break;
    }

    // Pick the landing tile at (nextX, nextY): the highest tile whose
    // elevation does not exceed currentElevation by ≥ 1. If none exists
    // (the only tile is too high), the height tolerance cancels.
    const candidateTiles = tilesAt(args.state.map, nextX, nextY);
    if (candidateTiles.length === 0) {
      cancellation = 'map_edge';
      break;
    }
    const landing = pickLandingTile(candidateTiles, currentElevation);
    if (landing === null) {
      cancellation = 'height_tolerance';
      break;
    }

    // Unit at the chosen landing tile.
    const blocker = unitAt(args.state, nextX, nextY, landing.layer);
    if (blocker !== undefined && blocker.id !== args.unit.id) {
      cancellation = 'unit_blocker';
      break;
    }

    // Step accepted.
    currentPos = { x: nextX, y: nextY, layer: landing.layer };
    currentElevation = landing.elevation;
    path.push(currentPos);
  }

  const dropDistance = startElevation - currentElevation;
  const result: KnockbackResult = {
    finalPosition: currentPos,
    path,
    stepsTaken: path.length - 1,
    cancellation,
    dropDistance,
    ...(dropDistance > 1
      ? {
          fallingDamageAction: makeFallingDamageAction(args.unit.id, dropDistance),
        }
      : {}),
  };
  return result;
}

// Pick the highest landing tile whose elevation does not exceed
// `currentElevation + 0.999...` — i.e., elevation ≤ currentElevation
// (per ADR-0026's strict "≥ 1 step up cancels"). When tiles exist but
// all are too high, returns null (caller cancels with 'height_tolerance').
function pickLandingTile(tiles: ReadonlyArray<Tile>, currentElevation: number): Tile | null {
  let best: Tile | null = null;
  for (const t of tiles) {
    // Per ADR-0026: cancellation triggers when destination elevation
    // is ≥ standing elevation + 1. So elevation < currentElevation + 1
    // is permissible (== currentElevation, level; < currentElevation,
    // drop). Use a strict comparison.
    if (t.elevation >= currentElevation + 1) continue;
    if (best === null || t.elevation > best.elevation) best = t;
  }
  return best;
}

function makeFallingDamageAction(unitId: UnitId, dropDistance: number): ProposedAction {
  return {
    type: 'system_damage',
    source: 'system',
    payload: {
      targetId: unitId,
      amount: FALLING_DAMAGE_PER_LEVEL * dropDistance,
      tags: ['physical'],
      source: { kind: 'falling', unitId, dropDistance },
    },
  };
}

// Re-export the map accessors that callers commonly pair with knockback.
// (No-op in the import graph; helps consumers find the right primitive.)
export type { BattleMap, Position };
