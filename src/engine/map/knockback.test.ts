// Unit tests for the knockback primitive (ADR-0026).

import { describe, expect, it } from 'vitest';
import { unitId } from '../types/index.ts';
import { makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { applyKnockback } from './knockback.ts';
import type { BattleMap, Tile } from '../types/index.ts';

function flatMap(width: number, height: number, elevation = 0): BattleMap {
  const tiles: Tile[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      tiles.push({ x, y, layer: 0, elevation, terrain: 'ground', properties: [] });
    }
  }
  return { width, height, tiles };
}

function multiElevationMap(): BattleMap {
  // 5×3 map. Column 0..2 elevation 0; column 3 elevation 2 (a wall);
  // column 4 elevation 0. Useful for height-tolerance + drop tests.
  const tiles: Tile[] = [];
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 5; x++) {
      const elevation = x === 3 ? 2 : 0;
      tiles.push({ x, y, layer: 0, elevation, terrain: 'ground', properties: [] });
    }
  }
  return { width: 5, height: 3, tiles };
}

function dropMap(): BattleMap {
  // 5×1 map with a stepped descent: x=0 at elevation 5, x=1 at 4,
  // x=2 at 3, x=3 at 2, x=4 at 0 (a 2-step drop at the end).
  const tiles: Tile[] = [];
  const elevations = [5, 4, 3, 2, 0];
  for (let x = 0; x < 5; x++) {
    tiles.push({ x, y: 0, layer: 0, elevation: elevations[x]!, terrain: 'ground', properties: [] });
  }
  return { width: 5, height: 1, tiles };
}

describe('applyKnockback', () => {
  it('moves the unit one tile east on a flat map with distance 1', () => {
    const map = flatMap(5, 3);
    const u = makeUnit({ id: 'u', spd: 10, position: { x: 1, y: 1, layer: 0 } });
    const state = makeGameState({ units: [u], map });
    const result = applyKnockback({ state, unit: u, direction: 'E', distance: 1 });
    expect(result.finalPosition).toEqual({ x: 2, y: 1, layer: 0 });
    expect(result.stepsTaken).toBe(1);
    expect(result.cancellation).toBeNull();
    expect(result.dropDistance).toBe(0);
    expect(result.fallingDamageAction).toBeUndefined();
  });

  it('cancels at the map edge', () => {
    const map = flatMap(5, 3);
    const u = makeUnit({ id: 'u', spd: 10, position: { x: 4, y: 1, layer: 0 } });
    const state = makeGameState({ units: [u], map });
    const result = applyKnockback({ state, unit: u, direction: 'E', distance: 2 });
    expect(result.finalPosition).toEqual({ x: 4, y: 1, layer: 0 });
    expect(result.stepsTaken).toBe(0);
    expect(result.cancellation).toBe('map_edge');
  });

  it('cancels when a unit blocks the destination', () => {
    const map = flatMap(5, 3);
    const u = makeUnit({ id: 'u', spd: 10, position: { x: 1, y: 1, layer: 0 } });
    const blocker = makeUnit({ id: 'b', spd: 10, team: 'team_b', position: { x: 2, y: 1, layer: 0 } });
    const state = makeGameState({ units: [u, blocker], map });
    const result = applyKnockback({ state, unit: u, direction: 'E', distance: 2 });
    expect(result.finalPosition).toEqual({ x: 1, y: 1, layer: 0 });
    expect(result.cancellation).toBe('unit_blocker');
  });

  it("cancels on an upward step ≥ 1", () => {
    const map = multiElevationMap(); // x=3 is elevation 2; everywhere else 0
    const u = makeUnit({ id: 'u', spd: 10, position: { x: 1, y: 1, layer: 0 } });
    const state = makeGameState({ units: [u], map });
    const result = applyKnockback({ state, unit: u, direction: 'E', distance: 5 });
    // Should advance 1 step (to x=2), then cancel at x=3 (elevation 2 ≥ 0+1).
    expect(result.finalPosition).toEqual({ x: 2, y: 1, layer: 0 });
    expect(result.stepsTaken).toBe(1);
    expect(result.cancellation).toBe('height_tolerance');
  });

  it("permits descent and emits falling damage when drop distance > 1", () => {
    const map = dropMap();
    // Unit standing at x=0 (elevation 5). One step E lands x=1 (elevation 4)
    // — drop 1, OK; second step lands x=2 (elev 3) — drop 1 from previous,
    // total drop 2 from start, but per-step the drops are within tolerance.
    // The final dropDistance is start - end = 5 - 3 = 2; > 1, so falling
    // damage of 10 × 2 = 20 is emitted.
    const u = makeUnit({ id: 'u', spd: 10, position: { x: 0, y: 0, layer: 0 } });
    const state = makeGameState({ units: [u], map });
    const result = applyKnockback({ state, unit: u, direction: 'E', distance: 2 });
    expect(result.finalPosition).toEqual({ x: 2, y: 0, layer: 0 });
    expect(result.dropDistance).toBe(2);
    expect(result.fallingDamageAction).toBeDefined();
    if (result.fallingDamageAction !== undefined) {
      expect(result.fallingDamageAction.type).toBe('system_damage');
      if (result.fallingDamageAction.type === 'system_damage') {
        expect(result.fallingDamageAction.payload.amount).toBe(20);
        expect(result.fallingDamageAction.payload.targetId).toBe(unitId('u'));
        expect(result.fallingDamageAction.payload.tags).toEqual(['physical']);
      }
    }
  });

  it('does not emit falling damage when drop distance is 1 or less', () => {
    const map = dropMap();
    // Unit at x=0 (elevation 5), one step E to x=1 (elevation 4). Drop = 1.
    const u = makeUnit({ id: 'u', spd: 10, position: { x: 0, y: 0, layer: 0 } });
    const state = makeGameState({ units: [u], map });
    const result = applyKnockback({ state, unit: u, direction: 'E', distance: 1 });
    expect(result.dropDistance).toBe(1);
    expect(result.fallingDamageAction).toBeUndefined();
  });

  it('takes all available steps until the requested distance', () => {
    const map = flatMap(10, 3);
    const u = makeUnit({ id: 'u', spd: 10, position: { x: 1, y: 1, layer: 0 } });
    const state = makeGameState({ units: [u], map });
    const result = applyKnockback({ state, unit: u, direction: 'E', distance: 3 });
    expect(result.finalPosition).toEqual({ x: 4, y: 1, layer: 0 });
    expect(result.stepsTaken).toBe(3);
    expect(result.cancellation).toBeNull();
  });

  it('handles distance 0 as a no-op', () => {
    const map = flatMap(5, 3);
    const u = makeUnit({ id: 'u', spd: 10, position: { x: 1, y: 1, layer: 0 } });
    const state = makeGameState({ units: [u], map });
    const result = applyKnockback({ state, unit: u, direction: 'E', distance: 0 });
    expect(result.finalPosition).toEqual({ x: 1, y: 1, layer: 0 });
    expect(result.stepsTaken).toBe(0);
    expect(result.cancellation).toBeNull();
  });

  // Session 32 / Item 16 — River Ridge ridge-into-water knockback case.
  // Per docs/twentyOneDesign/river-ridge.md "Knockback Into Water":
  // a unit knocked off the elev-7 ridge into adjacent shallow water at
  // elev 1 should land on the water tile with dropDistance 6 and emit
  // fall damage of 10 × 6 = 60. Confirms the primitive does not filter
  // water tiles as invalid destinations (water destinations are allowed
  // regardless of Walk-on-Water status — that's a future passive).
  it('knockback from a ridge into adjacent shallow water (dropDistance 6, fall damage 60)', () => {
    // 2×1 map: ridge tile at (0,0) elev 7, shallow water at (1,0) elev 1.
    const map: BattleMap = {
      width: 2,
      height: 1,
      tiles: [
        { x: 0, y: 0, layer: 0, elevation: 7, terrain: 'ground', properties: [] },
        { x: 1, y: 0, layer: 0, elevation: 1, terrain: 'water', properties: [] },
      ],
    };
    const u = makeUnit({ id: 'u', spd: 10, position: { x: 0, y: 0, layer: 0 } });
    const state = makeGameState({ units: [u], map });
    const result = applyKnockback({ state, unit: u, direction: 'E', distance: 1 });
    expect(result.finalPosition).toEqual({ x: 1, y: 0, layer: 0 });
    expect(result.stepsTaken).toBe(1);
    expect(result.cancellation).toBeNull();
    expect(result.dropDistance).toBe(6);
    expect(result.fallingDamageAction).toBeDefined();
    if (result.fallingDamageAction !== undefined) {
      expect(result.fallingDamageAction.type).toBe('system_damage');
      if (result.fallingDamageAction.type === 'system_damage') {
        expect(result.fallingDamageAction.payload.amount).toBe(60);
        expect(result.fallingDamageAction.payload.targetId).toBe(unitId('u'));
        expect(result.fallingDamageAction.payload.source.kind).toBe('falling');
      }
    }
  });
});
