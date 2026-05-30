// Session 53 — mutable terrain (`system_terrain_change`) reducer.
//
// Covers the elevation+terrain mutation, structural sharing of unchanged
// tiles, the water-table terrain move, and the fall-damage emission for
// occupied tiles that *drop* (a rising tile emits nothing — the blueprint's
// raise/lower asymmetry falling out of the physics).

import { describe, expect, it } from 'vitest';
import { makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { reduceSystemTerrainChange } from './reducers.ts';
import type { Action, BattleMap, Position, Tile } from '@engine/index.ts';

function tile(x: number, y: number, elevation: number, terrain: string, layer = 0): Tile {
  return { x, y, layer, elevation, terrain, properties: [] };
}

function mapOf(tiles: ReadonlyArray<Tile>): BattleMap {
  const width = Math.max(...tiles.map((t) => t.x)) + 1;
  const height = Math.max(...tiles.map((t) => t.y)) + 1;
  return { width, height, tiles };
}

function makeAction(
  tileChanges: Extract<Action, { type: 'system_terrain_change' }>['payload']['tileChanges'],
): Extract<Action, { type: 'system_terrain_change' }> {
  return {
    type: 'system_terrain_change',
    source: 'system',
    sequenceNumber: 0,
    timestamp: { tick: 0, ct: 0 },
    seed: 0,
    chainDepth: 0,
    isReaction: false,
    payload: { tileChanges },
  };
}

function at(map: BattleMap, x: number, y: number, layer = 0): Tile {
  const t = map.tiles.find((tt) => tt.x === x && tt.y === y && tt.layer === layer);
  if (t === undefined) throw new Error(`no tile at ${x},${y},${layer}`);
  return t;
}

const pos = (x: number, y: number, layer = 0): Position => ({ x, y, layer });

describe('Session 53 — reduceSystemTerrainChange mutation', () => {
  it('applies a single-tile elevation + terrain change in lockstep', () => {
    const map = mapOf([tile(0, 0, 0, 'water_deep'), tile(1, 0, 2, 'ground')]);
    const state = makeGameState({ map });
    const result = reduceSystemTerrainChange(
      state,
      makeAction([
        {
          x: 0,
          y: 0,
          layer: 0,
          originalElevation: 0,
          newElevation: 3,
          originalTerrain: 'water_deep',
          newTerrain: 'ground',
        },
      ]),
    );
    const changed = at(result.newState.map, 0, 0);
    expect(changed.elevation).toBe(3);
    expect(changed.terrain).toBe('ground');
    expect(result.outcome.appliedCount).toBe(1);
  });

  it('applies a multi-tile change (e.g. a 3-tile cast)', () => {
    const map = mapOf([tile(0, 0, 2, 'ground'), tile(1, 0, 2, 'ground'), tile(2, 0, 2, 'ground')]);
    const state = makeGameState({ map });
    const result = reduceSystemTerrainChange(
      state,
      makeAction(
        [0, 1, 2].map((x) => ({
          x,
          y: 0,
          layer: 0,
          originalElevation: 2,
          newElevation: 5,
          originalTerrain: 'ground',
          newTerrain: 'ground',
        })),
      ),
    );
    expect(result.outcome.appliedCount).toBe(3);
    for (const x of [0, 1, 2]) expect(at(result.newState.map, x, 0).elevation).toBe(5);
  });

  it('moves terrain with elevation across the water table (land → shallow water)', () => {
    const map = mapOf([tile(0, 0, 4, 'ground')]);
    const state = makeGameState({ map });
    const result = reduceSystemTerrainChange(
      state,
      makeAction([
        {
          x: 0,
          y: 0,
          layer: 0,
          originalElevation: 4,
          newElevation: 1,
          originalTerrain: 'ground',
          newTerrain: 'water_shallow',
        },
      ]),
    );
    const changed = at(result.newState.map, 0, 0);
    expect(changed.elevation).toBe(1);
    expect(changed.terrain).toBe('water_shallow');
  });

  it('does not mutate the input state; unchanged tiles keep identity (structural sharing)', () => {
    const map = mapOf([tile(0, 0, 2, 'ground'), tile(1, 0, 2, 'ground')]);
    const state = makeGameState({ map });
    const originalUnchanged = at(state.map, 1, 0);
    const result = reduceSystemTerrainChange(
      state,
      makeAction([
        {
          x: 0,
          y: 0,
          layer: 0,
          originalElevation: 2,
          newElevation: 5,
          originalTerrain: 'ground',
          newTerrain: 'ground',
        },
      ]),
    );
    // Original untouched.
    expect(at(state.map, 0, 0).elevation).toBe(2);
    // Unchanged tile object is the same reference in the new map.
    expect(at(result.newState.map, 1, 0)).toBe(originalUnchanged);
    // Changed tile is a fresh object.
    expect(at(result.newState.map, 0, 0)).not.toBe(at(state.map, 0, 0));
  });

  it('counts only tiles that exist (a change addressing a missing tile is skipped)', () => {
    const map = mapOf([tile(0, 0, 2, 'ground')]);
    const state = makeGameState({ map });
    const result = reduceSystemTerrainChange(
      state,
      makeAction([
        {
          x: 0,
          y: 0,
          layer: 0,
          originalElevation: 2,
          newElevation: 3,
          originalTerrain: 'ground',
          newTerrain: 'ground',
        },
        {
          // No tile at (0,0,9) — different layer.
          x: 0,
          y: 0,
          layer: 9,
          originalElevation: 2,
          newElevation: 3,
          originalTerrain: 'ground',
          newTerrain: 'ground',
        },
      ]),
    );
    expect(result.outcome.appliedCount).toBe(1);
  });
});

describe('Session 53 — reduceSystemTerrainChange fall damage', () => {
  it('emits fall damage for an occupant when the tile drops by > 1', () => {
    const map = mapOf([tile(0, 0, 4, 'ground')]);
    const occupant = makeUnit({ id: 'faller', spd: 10, position: pos(0, 0) });
    const state = makeGameState({ units: [occupant], map });
    const result = reduceSystemTerrainChange(
      state,
      makeAction([
        {
          x: 0,
          y: 0,
          layer: 0,
          originalElevation: 4,
          newElevation: 1,
          originalTerrain: 'ground',
          newTerrain: 'water_shallow',
        },
      ]),
    );
    expect(result.generatedActions).toHaveLength(1);
    const fall = result.generatedActions[0]!;
    expect(fall.type).toBe('system_damage');
    if (fall.type !== 'system_damage') return;
    expect(fall.payload.targetId).toBe(occupant.id);
    expect(fall.payload.amount).toBe(30); // 10 × dropDistance(3)
    expect(fall.payload.source.kind).toBe('falling');
    expect(result.outcome.fallDamageUnitIds).toEqual([occupant.id]);
  });

  it('emits no fall damage for a drop of exactly 1 (natural gate)', () => {
    const map = mapOf([tile(0, 0, 2, 'ground')]);
    const occupant = makeUnit({ id: 'faller', spd: 10, position: pos(0, 0) });
    const state = makeGameState({ units: [occupant], map });
    const result = reduceSystemTerrainChange(
      state,
      makeAction([
        {
          x: 0,
          y: 0,
          layer: 0,
          originalElevation: 2,
          newElevation: 1,
          originalTerrain: 'ground',
          newTerrain: 'water_shallow',
        },
      ]),
    );
    expect(result.generatedActions).toEqual([]);
    expect(result.outcome.fallDamageUnitIds).toEqual([]);
  });

  it('emits no fall damage for a rising tile (a Pillar/Hill cast)', () => {
    const map = mapOf([tile(0, 0, 2, 'ground')]);
    const occupant = makeUnit({ id: 'rider', spd: 10, position: pos(0, 0) });
    const state = makeGameState({ units: [occupant], map });
    const result = reduceSystemTerrainChange(
      state,
      makeAction([
        {
          x: 0,
          y: 0,
          layer: 0,
          originalElevation: 2,
          newElevation: 5,
          originalTerrain: 'ground',
          newTerrain: 'ground',
        },
      ]),
    );
    expect(result.generatedActions).toEqual([]);
  });

  it('emits no fall damage when the dropped tile is unoccupied', () => {
    const map = mapOf([tile(0, 0, 5, 'ground')]);
    const state = makeGameState({ map });
    const result = reduceSystemTerrainChange(
      state,
      makeAction([
        {
          x: 0,
          y: 0,
          layer: 0,
          originalElevation: 5,
          newElevation: 0,
          originalTerrain: 'ground',
          newTerrain: 'water_deep',
        },
      ]),
    );
    expect(result.generatedActions).toEqual([]);
  });

  it('emits per-occupant fall damage across a multi-tile drop (a Valley cast)', () => {
    const map = mapOf([tile(0, 0, 4, 'ground'), tile(1, 0, 4, 'ground'), tile(2, 0, 4, 'ground')]);
    const a = makeUnit({ id: 'a', spd: 10, position: pos(0, 0) });
    const b = makeUnit({ id: 'b', spd: 10, position: pos(2, 0) });
    const state = makeGameState({ units: [a, b], map });
    const result = reduceSystemTerrainChange(
      state,
      makeAction(
        [0, 1, 2].map((x) => ({
          x,
          y: 0,
          layer: 0,
          originalElevation: 4,
          newElevation: 1,
          originalTerrain: 'ground',
          newTerrain: 'water_shallow',
        })),
      ),
    );
    // Two occupants fell (tiles 0 and 2); tile 1 is empty.
    expect([...result.outcome.fallDamageUnitIds].sort()).toEqual([a.id, b.id].sort());
    expect(result.generatedActions).toHaveLength(2);
  });

  it('does not fall-damage a removed unit standing on a dropped tile', () => {
    const map = mapOf([tile(0, 0, 5, 'ground')]);
    const ghost = makeUnit({ id: 'ghost', spd: 10, position: pos(0, 0), removed: true });
    const state = makeGameState({ units: [ghost], map });
    const result = reduceSystemTerrainChange(
      state,
      makeAction([
        {
          x: 0,
          y: 0,
          layer: 0,
          originalElevation: 5,
          newElevation: 0,
          originalTerrain: 'ground',
          newTerrain: 'water_deep',
        },
      ]),
    );
    expect(result.generatedActions).toEqual([]);
  });
});
