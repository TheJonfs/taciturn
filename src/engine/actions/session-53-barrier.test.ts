// Session 53 — Barrier substrate (Piece 5).
//
// Barriers are a tile-side `BarrierState` (impassable + sight-blocking).
// Spawned/cleared via `system_barrier_change`; HP-damaged (pipeline-bypass)
// via `system_barrier_damage`, destroyed at HP ≤ 0. Pathfinding and
// line-of-sight gate on the field directly.

import { describe, expect, it } from 'vitest';
import { createCatalog, type ClassDefinition } from '../catalog/index.ts';
import { defaultTestRulesets } from '../catalog/test-fixtures.ts';
import { makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { mapWith } from '../map/test-fixtures.ts';
import { getLegalMoves, positionKey } from '../map/pathfinding.ts';
import { hasLineOfSight } from '../map/line-of-sight.ts';
import { tileAt } from '../map/accessors.ts';
import { reduceSystemBarrierChange, reduceSystemBarrierDamage } from './reducers.ts';
import {
  abilityId,
  classId,
  commandSetId,
  unitId,
  type Action,
  type BarrierState,
  type BattleMap,
  type Tile,
} from '@engine/index.ts';

function tile(x: number, y: number, elevation = 2): Tile {
  return { x, y, layer: 0, elevation, terrain: 'ground', properties: [] };
}

function barrier(hp: number): BarrierState {
  return { hp, ttl: 5, ownerId: unitId('terra') };
}

function rowMap(width: number): BattleMap {
  return mapWith({
    width,
    height: 1,
    tiles: Array.from({ length: width }, (_, x) => tile(x, 0)),
  });
}

function barrierChange(
  changes: ReadonlyArray<{ x: number; y: number; layer: number; barrier: BarrierState | null }>,
): Extract<Action, { type: 'system_barrier_change' }> {
  return {
    type: 'system_barrier_change',
    source: 'system',
    sequenceNumber: 0,
    timestamp: { tick: 0, ct: 0 },
    seed: 0,
    chainDepth: 0,
    isReaction: false,
    payload: { tileChanges: changes },
  };
}

function barrierDamage(
  x: number,
  y: number,
  amount: number,
): Extract<Action, { type: 'system_barrier_damage' }> {
  return {
    type: 'system_barrier_damage',
    source: 'system',
    sequenceNumber: 0,
    timestamp: { tick: 0, ct: 0 },
    seed: 0,
    chainDepth: 0,
    isReaction: false,
    payload: {
      x,
      y,
      layer: 0,
      amount,
      source: { attackerId: unitId('atk'), abilityId: abilityId('attack') },
    },
  };
}

describe('Session 53 — system_barrier_change (spawn / clear)', () => {
  it('spawns a barrier on a tile', () => {
    const state = makeGameState({ map: rowMap(3) });
    const r = reduceSystemBarrierChange(
      state,
      barrierChange([{ x: 1, y: 0, layer: 0, barrier: barrier(49) }]),
    );
    expect(r.outcome.appliedCount).toBe(1);
    expect(tileAt(r.newState.map, 1, 0, 0)!.barrier).toEqual(barrier(49));
    // Other tiles untouched.
    expect(tileAt(r.newState.map, 0, 0, 0)!.barrier).toBeUndefined();
  });

  it('spawns a multi-tile barrier line', () => {
    const state = makeGameState({ map: rowMap(5) });
    const r = reduceSystemBarrierChange(
      state,
      barrierChange([0, 1, 2].map((x) => ({ x, y: 0, layer: 0, barrier: barrier(49) }))),
    );
    expect(r.outcome.appliedCount).toBe(3);
    for (const x of [0, 1, 2]) expect(tileAt(r.newState.map, x, 0, 0)!.barrier).toBeDefined();
  });

  it('clears a barrier (null) and removes the field entirely', () => {
    const seeded = mapWith({
      width: 2,
      height: 1,
      tiles: [{ ...tile(0, 0), barrier: barrier(49) }, tile(1, 0)],
    });
    const state = makeGameState({ map: seeded });
    const r = reduceSystemBarrierChange(state, barrierChange([{ x: 0, y: 0, layer: 0, barrier: null }]));
    const cleared = tileAt(r.newState.map, 0, 0, 0)!;
    expect(cleared.barrier).toBeUndefined();
    expect('barrier' in cleared).toBe(false);
  });

  it('does not mutate the input state', () => {
    const state = makeGameState({ map: rowMap(2) });
    reduceSystemBarrierChange(state, barrierChange([{ x: 0, y: 0, layer: 0, barrier: barrier(49) }]));
    expect(tileAt(state.map, 0, 0, 0)!.barrier).toBeUndefined();
  });
});

describe('Session 53 — system_barrier_damage', () => {
  function withBarrier(x: number, hp: number, width = 3): BattleMap {
    return mapWith({
      width,
      height: 1,
      tiles: Array.from({ length: width }, (_, i) =>
        i === x ? { ...tile(i, 0), barrier: barrier(hp) } : tile(i, 0),
      ),
    });
  }

  it('reduces barrier HP and reports hpAfter', () => {
    const state = makeGameState({ map: withBarrier(1, 49) });
    const r = reduceSystemBarrierDamage(state, barrierDamage(1, 0, 20));
    expect(r.outcome.applied).toBe(20);
    expect(r.outcome.hpAfter).toBe(29);
    expect(r.outcome.destroyed).toBe(false);
    expect(tileAt(r.newState.map, 1, 0, 0)!.barrier!.hp).toBe(29);
  });

  it('destroys the barrier at HP ≤ 0 and clears the tile', () => {
    const state = makeGameState({ map: withBarrier(1, 15) });
    const r = reduceSystemBarrierDamage(state, barrierDamage(1, 0, 20));
    expect(r.outcome.applied).toBe(15); // clamped at the barrier's HP
    expect(r.outcome.hpAfter).toBe(0);
    expect(r.outcome.destroyed).toBe(true);
    expect(tileAt(r.newState.map, 1, 0, 0)!.barrier).toBeUndefined();
  });

  it('is a silent no-op when the tile has no barrier', () => {
    const state = makeGameState({ map: rowMap(3) });
    const r = reduceSystemBarrierDamage(state, barrierDamage(1, 0, 20));
    expect(r.outcome.applied).toBe(0);
    expect(r.outcome.destroyed).toBe(false);
    expect(r.newState).toBe(state);
  });

  it('damages multi-tile barriers independently', () => {
    // Two barriers; damaging one leaves the other intact.
    const map = mapWith({
      width: 3,
      height: 1,
      tiles: [
        { ...tile(0, 0), barrier: barrier(49) },
        { ...tile(1, 0), barrier: barrier(49) },
        tile(2, 0),
      ],
    });
    const state = makeGameState({ map });
    const r = reduceSystemBarrierDamage(state, barrierDamage(0, 0, 49));
    expect(tileAt(r.newState.map, 0, 0, 0)!.barrier).toBeUndefined(); // destroyed
    expect(tileAt(r.newState.map, 1, 0, 0)!.barrier!.hp).toBe(49); // untouched
  });
});

function knightCatalog() {
  const knight: ClassDefinition = {
    id: classId('knight'),
    name: 'Knight',
    movement: { moveRange: 4, jump: 3, terrainCosts: new Map(), canEnter: new Set(['ground']) },
    evasion: { front: 0, side: 0, back: 0 },
    equipmentSlots: { leftHand: true, rightHand: true, headgear: true, armor: true, accessory: true },
    firstActionCommandSet: commandSetId('battle_skill'),
    freeAbilities: new Set(),
    dominantStat: 'pa',
  };
  return createCatalog({
    statusTypes: [],
    abilities: [],
    commandSets: [],
    classes: [knight],
    items: [],
    rulesets: defaultTestRulesets,
  });
}

describe('Session 53 — Barrier blocks movement (pathfinding)', () => {
  it('a unit cannot step onto a barrier tile', () => {
    const cat = knightCatalog();
    // Flat row; barrier on (1,0) walls off everything past it.
    const map = mapWith({
      width: 4,
      height: 1,
      tiles: [tile(0, 0), { ...tile(1, 0), barrier: barrier(49) }, tile(2, 0), tile(3, 0)],
    });
    const state = makeGameState({
      units: [makeUnit({ id: 'u', spd: 10, position: { x: 0, y: 0, layer: 0 } })],
      map,
    });
    const { reachable } = getLegalMoves(state, unitId('u'), cat);
    // The barrier tile itself is unreachable, and so is everything behind it
    // on this 1-wide corridor.
    expect(reachable.has(positionKey({ x: 1, y: 0, layer: 0 }))).toBe(false);
    expect(reachable.has(positionKey({ x: 2, y: 0, layer: 0 }))).toBe(false);
  });
});

describe('Session 53 — Barrier blocks line-of-sight', () => {
  it('a barrier between source and target blocks sight; clearing it restores', () => {
    // Source (0,0) elev 2, target (2,0) elev 2, barrier on the middle tile.
    const map = mapWith({
      width: 3,
      height: 1,
      tiles: [tile(0, 0), { ...tile(1, 0), barrier: barrier(49) }, tile(2, 0)],
    });
    const src = { x: 0, y: 0, elevation: 2 };
    const tgt = { x: 2, y: 0, elevation: 2 };
    expect(hasLineOfSight(map, src, tgt)).toBe(false);

    // Without the barrier, sight is clear.
    const clearMap = mapWith({ width: 3, height: 1, tiles: [tile(0, 0), tile(1, 0), tile(2, 0)] });
    expect(hasLineOfSight(clearMap, src, tgt)).toBe(true);
  });
});
