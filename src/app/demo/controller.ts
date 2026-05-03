// Greedy "approach and attack" controller for the demo battle.
//
// This is a *placeholder* until the AI module lands in session 12. It
// is deliberately dumb: it picks the closest enemy, walks toward them,
// and attacks when in range. Its purpose is to drive both teams in the
// demo battle so the renderer has something visible to show.
//
// Conscious limitations: no accounting for HP, no positioning, no
// flanking, no Wait-as-tactic. v1 only — the AI session replaces this
// with proper decision-making.

import {
  abilityId as mkAbilityId,
  endpointFrom,
  getLegalMoves,
  horizontalDistance,
  inRange,
  tileAt,
  validateAction,
  type Catalog,
  type GameState,
  type Position,
  type ProposedAction,
  type Unit,
} from '@engine/index.ts';
import type { Controller } from './orchestrator.ts';

const ATTACK = mkAbilityId('attack');

export function greedyMeleeController(): Controller {
  return (state, catalog) => {
    if (state.turnState === null) return null;
    const actor = state.units.get(state.turnState.unitId);
    if (actor === undefined) return null;

    const enemies = livingEnemies(state, actor);
    if (enemies.length === 0) return null;

    // 1. Attack if any enemy is in melee range and we still have an Act.
    if (state.turnState.budget.actsAvailable > 0) {
      const target = pickReachableMeleeTarget(state, catalog, actor, enemies);
      if (target !== null) {
        return {
          type: 'use_ability',
          source: 'player',
          actorId: actor.id,
          payload: {
            abilityId: ATTACK,
            target: { kind: 'unit', unitId: target.id },
          },
        };
      }
    }

    // 2. Move toward the closest enemy if we still have a Move.
    if (state.turnState.budget.movesAvailable > 0) {
      const closest = closestEnemy(actor, enemies);
      const dest = pickStepToward(state, catalog, actor, closest);
      if (dest !== null) {
        return {
          type: 'move',
          source: 'player',
          actorId: actor.id,
          payload: { destination: dest },
        };
      }
    }

    // 3. Nothing left to do — orchestrator will commit `turn_end`.
    return null;
  };
}

function livingEnemies(state: GameState, actor: Unit): Unit[] {
  const out: Unit[] = [];
  for (const u of state.units.values()) {
    if (u.team === actor.team) continue;
    if (u.vitals.hp <= 0) continue;
    out.push(u);
  }
  return out;
}

function closestEnemy(actor: Unit, enemies: Unit[]): Unit {
  let best = enemies[0]!;
  let bestDist = horizontalDistance(actor.position, best.position);
  for (let i = 1; i < enemies.length; i++) {
    const e = enemies[i]!;
    const d = horizontalDistance(actor.position, e.position);
    if (d < bestDist || (d === bestDist && e.id < best.id)) {
      best = e;
      bestDist = d;
    }
  }
  return best;
}

// Choose an attackable enemy by checking validateAction for the
// proposed UseAbility. Picks the first enemy in lex-id order that
// passes (deterministic).
function pickReachableMeleeTarget(
  state: GameState,
  catalog: Catalog,
  actor: Unit,
  enemies: Unit[],
): Unit | null {
  const sorted = [...enemies].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const enemy of sorted) {
    const proposed: ProposedAction = {
      type: 'use_ability',
      source: 'player',
      actorId: actor.id,
      payload: {
        abilityId: ATTACK,
        target: { kind: 'unit', unitId: enemy.id },
      },
    };
    if (validateAction(state, proposed, catalog).valid) return enemy;
  }
  return null;
}

// Of all legal move destinations, pick the one that lands closest to
// `target`. Tiebreak by lex-sorted PositionKey for determinism. Returns
// null when the only legal "move" is staying put.
function pickStepToward(
  state: GameState,
  catalog: Catalog,
  actor: Unit,
  target: Unit,
): Position | null {
  const moves = getLegalMoves(state, actor.id, catalog);

  let best: Position | null = null;
  let bestScore = Infinity;
  let bestKey = '';

  for (const [key, path] of moves.reachable) {
    const dest = path.destination;
    // Skip the no-op (staying on the current tile).
    if (
      dest.x === actor.position.x &&
      dest.y === actor.position.y &&
      dest.layer === actor.position.layer
    ) {
      continue;
    }
    // Prefer destinations that get us into melee range of the target on
    // the same turn (so the next iteration of the controller can attack
    // before turn_end). Use the actual range check rather than Manhattan
    // distance so vertical tolerance composes correctly.
    const sourceTile = tileAt(state.map, dest.x, dest.y, dest.layer);
    const targetTile = tileAt(state.map, target.position.x, target.position.y, target.position.layer);
    if (sourceTile === undefined || targetTile === undefined) continue;
    const inMeleeAfter = inRange({
      source: endpointFrom(dest, sourceTile.elevation),
      target: endpointFrom(target.position, targetTile.elevation),
      params: { horizontalMax: 1, verticalMax: 3 },
    });
    // Score: 0 if in melee after the move, else Manhattan distance.
    const score = inMeleeAfter ? 0 : horizontalDistance(dest, target.position);
    if (score < bestScore || (score === bestScore && (best === null || key < bestKey))) {
      best = dest;
      bestScore = score;
      bestKey = key;
    }
  }
  // Defensive: if there are no legal non-staying moves, return null and
  // let the orchestrator end the turn.
  return best;
}
