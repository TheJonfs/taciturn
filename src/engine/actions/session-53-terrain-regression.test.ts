// Session 53 — pieces 2 & 3 (verify-free): pathfinding and AoE both read
// live tile elevation, so a `system_terrain_change` is reflected with zero
// substrate. These regressions mutate terrain through the real reducer and
// confirm `getLegalMoves` / `aoeFootprint` recompute against the new map.

import { describe, expect, it } from 'vitest';
import { createCatalog, type ClassDefinition } from '../catalog/index.ts';
import { defaultTestRulesets } from '../catalog/test-fixtures.ts';
import { makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { mapWith } from '../map/test-fixtures.ts';
import { getLegalMoves, positionKey } from '../map/pathfinding.ts';
import { aoeFootprint } from '../map/aoe.ts';
import { reduceSystemTerrainChange } from './reducers.ts';
import { classId, commandSetId, unitId, type Action, type BattleMap, type Tile } from '@engine/index.ts';

function knightCatalog(args?: { jump?: number; moveRange?: number }) {
  const knight: ClassDefinition = {
    id: classId('knight'),
    name: 'Knight',
    movement: {
      moveRange: args?.moveRange ?? 4,
      jump: args?.jump ?? 2,
      terrainCosts: new Map(),
      canEnter: new Set(['ground']),
    },
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

function tile(x: number, y: number, elevation: number): Tile {
  return { x, y, layer: 0, elevation, terrain: 'ground', properties: [] };
}

function rowMap(elevations: ReadonlyArray<number>): BattleMap {
  return mapWith({
    width: elevations.length,
    height: 1,
    tiles: elevations.map((e, x) => tile(x, 0, e)),
  });
}

function raise(x: number, y: number, from: number, to: number): Action {
  return {
    type: 'system_terrain_change',
    source: 'system',
    sequenceNumber: 0,
    timestamp: { tick: 0, ct: 0 },
    seed: 0,
    chainDepth: 0,
    isReaction: false,
    payload: {
      tileChanges: [
        {
          x,
          y,
          layer: 0,
          originalElevation: from,
          newElevation: to,
          originalTerrain: 'ground',
          newTerrain: 'ground',
        },
      ],
    },
  } as Action;
}

const key = (x: number) => positionKey({ x, y: 0, layer: 0 });

describe('Session 53 — pathfinding reflects terrain mutation (verify-free)', () => {
  it('a Pillar that raises a tile beyond jump range makes it unreachable', () => {
    const cat = knightCatalog({ jump: 2, moveRange: 4 });
    // Unit on (0,0) elev 2; neighbor (1,0) elev 4 → delta 2 ≤ jump 2 → reachable.
    const state = makeGameState({
      units: [makeUnit({ id: 'u', spd: 10, position: { x: 0, y: 0, layer: 0 } })],
      map: rowMap([2, 4, 4]),
    });
    expect(getLegalMoves(state, unitId('u'), cat).reachable.has(key(1))).toBe(true);

    // Pillar (1,0): 4 → 8. Delta from (0,0) is now 6 > jump 2 → unreachable.
    const after = reduceSystemTerrainChange(
      state,
      raise(1, 0, 4, 8) as Extract<Action, { type: 'system_terrain_change' }>,
    ).newState;
    expect(getLegalMoves(after, unitId('u'), cat).reachable.has(key(1))).toBe(false);
  });

  it('a Pit that lowers a too-high tile into range makes it reachable', () => {
    const cat = knightCatalog({ jump: 2, moveRange: 4 });
    // Neighbor (1,0) elev 9 → delta 7 > jump 2 → unreachable initially.
    const state = makeGameState({
      units: [makeUnit({ id: 'u', spd: 10, position: { x: 0, y: 0, layer: 0 } })],
      map: rowMap([2, 9, 9]),
    });
    expect(getLegalMoves(state, unitId('u'), cat).reachable.has(key(1))).toBe(false);

    // Pit (1,0): 9 → 3. Delta from (0,0) is now 1 ≤ jump 2 → reachable.
    const after = reduceSystemTerrainChange(
      state,
      raise(1, 0, 9, 3) as Extract<Action, { type: 'system_terrain_change' }>,
    ).newState;
    expect(getLegalMoves(after, unitId('u'), cat).reachable.has(key(1))).toBe(true);
  });
});

describe('Session 53 — AoE reflects terrain mutation (verify-free)', () => {
  it('a tile raised beyond vertical tolerance drops out of the footprint', () => {
    // Anchor (1,0) elev 2, diamond r1, tolerance 1 → includes (0,0),(2,0) at elev 2.
    const state = makeGameState({ map: rowMap([2, 2, 2]) });
    const anchor = { x: 1, y: 0, elevation: 2 };
    const shape = { kind: 'diamond' as const, radius: 1 };
    const before = aoeFootprint({ map: state.map, anchor, shape, verticalTolerance: 1 });
    expect(before.some((t) => t.x === 2)).toBe(true);

    // Pillar (2,0): 2 → 5. |5 − 2| = 3 > tolerance 1 → excluded.
    const after = reduceSystemTerrainChange(
      state,
      raise(2, 0, 2, 5) as Extract<Action, { type: 'system_terrain_change' }>,
    ).newState;
    const footprint = aoeFootprint({ map: after.map, anchor, shape, verticalTolerance: 1 });
    expect(footprint.some((t) => t.x === 2)).toBe(false);
    // The in-tolerance neighbor (0,0) is still included.
    expect(footprint.some((t) => t.x === 0)).toBe(true);
  });

  it('a tile lowered into vertical tolerance enters the footprint', () => {
    // Anchor (1,0) elev 2, tolerance 1. Neighbor (2,0) starts at elev 6 → excluded.
    const state = makeGameState({ map: rowMap([2, 2, 6]) });
    const anchor = { x: 1, y: 0, elevation: 2 };
    const shape = { kind: 'diamond' as const, radius: 1 };
    const before = aoeFootprint({ map: state.map, anchor, shape, verticalTolerance: 1 });
    expect(before.some((t) => t.x === 2)).toBe(false);

    // Valley (2,0): 6 → 2. Now within tolerance → included.
    const after = reduceSystemTerrainChange(
      state,
      raise(2, 0, 6, 2) as Extract<Action, { type: 'system_terrain_change' }>,
    ).newState;
    const footprint = aoeFootprint({ map: after.map, anchor, shape, verticalTolerance: 1 });
    expect(footprint.some((t) => t.x === 2)).toBe(true);
  });
});
