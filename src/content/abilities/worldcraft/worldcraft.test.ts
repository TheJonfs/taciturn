// Session 54 — Worldcraft command set integration tests against the real
// default catalog: the five abilities (Pillar/Pit/Hill/Valley/Barrier)
// resolving through `reduceUseAbility` → `resolveWorldcraft`, the effect
// queue (entry shape + cap eviction with revert), barrier HP scaling, and
// the tile_set targeting validation (line constraints + placement legality).
//
// The cast emits a `system_terrain_change` / `system_barrier_change` as a
// generatedAction (reduced by the engine loop — terrain physically mutates
// and fall damage fires there, exercised by the S53 substrate tests). These
// tests assert the emitted payloads + the actor's queue state.

import { describe, expect, it } from 'vitest';
import {
  abilityId,
  type Action,
  type BattleMap,
  type Unit,
  type WorldcraftEffectEntry,
} from '@engine/index.ts';
import { loadDefaultCatalog } from '../../index.ts';
import { reduceUseAbility } from '../../../engine/actions/reducers.ts';
import { validateAction } from '../../../engine/actions/validate.ts';
import { makeGameState, makeUnit, activeTurnFor } from '../../../engine/ct/test-fixtures.ts';
import { mapWith } from '../../../engine/map/test-fixtures.ts';

const catalog = loadDefaultCatalog();

// A flat land map (elevation 4) so raises/lowers are clean and a Pit drop
// stays above the water floor.
function landMap(width: number, height: number, elevation = 4): BattleMap {
  const tiles = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) tiles.push({ x, y, elevation });
  }
  return mapWith({ width, height, tiles });
}

// A Terraformer-profile stand-in. The Terraformer class lands in the next
// commit; Worldcraft resolution is class-agnostic (it keys off the ability's
// effect spec, not the class), so these tests use `calculator` (also MA-
// dominant, mage profile) as the caster class. PA 6 / MA 8 match the
// Terraformer stat line so Barrier HP reads 48.
function terraformer(overrides: Partial<Parameters<typeof makeUnit>[0]> = {}): Unit {
  return makeUnit({
    id: 'terra',
    spd: 8,
    pa: 6,
    ma: 8,
    mp: 100,
    maxMpBase: 100,
    classId: 'calculator',
    position: { x: 2, y: 2, layer: 0 },
    ...overrides,
  });
}

function terrainChangeFrom(actions: ReturnType<typeof reduceUseAbility>['generatedActions']) {
  return actions.find((a) => a.type === 'system_terrain_change');
}
function barrierChangeFrom(actions: ReturnType<typeof reduceUseAbility>['generatedActions']) {
  return actions.find((a) => a.type === 'system_barrier_change');
}

describe('Worldcraft — Pillar / Pit (single-tile elevation)', () => {
  it('Pillar raises the target tile by +3 and queues one terrain effect', () => {
    const u = terraformer();
    const state = makeGameState({ units: [u], map: landMap(6, 6), turnState: activeTurnFor(u.id) });
    const r = reduceUseAbility(
      state,
      {
        type: 'use_ability', source: 'player', actorId: u.id,
        payload: { abilityId: abilityId('pillar'), target: { kind: 'tile', position: { x: 3, y: 2, layer: 0 } } },
        sequenceNumber: 0, seed: 1, timestamp: { tick: 0, ct: 0 }, chainDepth: 0, isReaction: false,
      },
      catalog,
    );
    const tc = terrainChangeFrom(r.generatedActions);
    expect(tc).toBeDefined();
    const changes = (tc as Extract<Action, { type: 'system_terrain_change' }>).payload.tileChanges;
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ x: 3, y: 2, originalElevation: 4, newElevation: 7 });
    const q = r.newState.units.get(u.id)!.worldcraftEffects;
    expect(q).toHaveLength(1);
    expect(q[0]!.kind).toBe('terrain');
  });

  it('Pit lowers the target tile by -3', () => {
    const u = terraformer();
    const state = makeGameState({ units: [u], map: landMap(6, 6), turnState: activeTurnFor(u.id) });
    const r = reduceUseAbility(
      state,
      {
        type: 'use_ability', source: 'player', actorId: u.id,
        payload: { abilityId: abilityId('pit'), target: { kind: 'tile', position: { x: 3, y: 2, layer: 0 } } },
        sequenceNumber: 0, seed: 1, timestamp: { tick: 0, ct: 0 }, chainDepth: 0, isReaction: false,
      },
      catalog,
    );
    const changes = (terrainChangeFrom(r.generatedActions) as Extract<Action, { type: 'system_terrain_change' }>).payload.tileChanges;
    expect(changes[0]).toMatchObject({ originalElevation: 4, newElevation: 1, newTerrain: 'water_shallow' });
  });

  it('deducts MP (Pillar 8) and reports mpAfter', () => {
    const u = terraformer({ mp: 30, maxMpBase: 100 });
    const state = makeGameState({ units: [u], map: landMap(6, 6), turnState: activeTurnFor(u.id) });
    const r = reduceUseAbility(
      state,
      {
        type: 'use_ability', source: 'player', actorId: u.id,
        payload: { abilityId: abilityId('pillar'), target: { kind: 'tile', position: { x: 3, y: 2, layer: 0 } } },
        sequenceNumber: 0, seed: 1, timestamp: { tick: 0, ct: 0 }, chainDepth: 0, isReaction: false,
      },
      catalog,
    );
    expect(r.outcome.mpSpent).toBe(8);
    expect(r.outcome.mpAfter).toBe(22);
    expect(r.newState.units.get(u.id)!.vitals.mp).toBe(22);
  });

  it('is instant-cast (no chargedActionId)', () => {
    const u = terraformer();
    const state = makeGameState({ units: [u], map: landMap(6, 6), turnState: activeTurnFor(u.id) });
    const r = reduceUseAbility(
      state,
      {
        type: 'use_ability', source: 'player', actorId: u.id,
        payload: { abilityId: abilityId('pillar'), target: { kind: 'tile', position: { x: 2, y: 2, layer: 0 } } },
        sequenceNumber: 0, seed: 1, timestamp: { tick: 0, ct: 0 }, chainDepth: 0, isReaction: false,
      },
      catalog,
    );
    expect(r.outcome.chargedActionId).toBeUndefined();
  });

  it('allows self-targeting (Pillar on own tile)', () => {
    const u = terraformer({ position: { x: 2, y: 2, layer: 0 } });
    const state = makeGameState({ units: [u], map: landMap(6, 6), turnState: activeTurnFor(u.id) });
    const v = validateAction(state, {
      type: 'use_ability', source: 'player', actorId: u.id,
      payload: { abilityId: abilityId('pillar'), target: { kind: 'tile', position: { x: 2, y: 2, layer: 0 } } },
      sequenceNumber: 0, seed: 1, timestamp: { tick: 0, ct: 0 }, chainDepth: 0, isReaction: false,
    }, catalog);
    expect(v.valid).toBe(true);
  });
});

describe('Worldcraft — Hill / Valley (3×3 kernel)', () => {
  it('Hill applies the [1,2,1;2,3,2;1,2,1] kernel across nine tiles', () => {
    const u = terraformer();
    const state = makeGameState({ units: [u], map: landMap(7, 7), turnState: activeTurnFor(u.id) });
    const r = reduceUseAbility(
      state,
      {
        type: 'use_ability', source: 'player', actorId: u.id,
        payload: { abilityId: abilityId('hill'), target: { kind: 'tile', position: { x: 3, y: 3, layer: 0 } } },
        sequenceNumber: 0, seed: 1, timestamp: { tick: 0, ct: 0 }, chainDepth: 0, isReaction: false,
      },
      catalog,
    );
    const changes = (terrainChangeFrom(r.generatedActions) as Extract<Action, { type: 'system_terrain_change' }>).payload.tileChanges;
    expect(changes).toHaveLength(9);
    const byPos = new Map(changes.map((c) => [`${c.x},${c.y}`, c.newElevation - c.originalElevation]));
    expect(byPos.get('3,3')).toBe(3); // center
    expect(byPos.get('3,2')).toBe(2); // edge
    expect(byPos.get('2,2')).toBe(1); // corner
    expect(byPos.get('4,4')).toBe(1); // corner
  });

  it('Valley applies the negated kernel', () => {
    const u = terraformer();
    const state = makeGameState({ units: [u], map: landMap(7, 7), turnState: activeTurnFor(u.id) });
    const r = reduceUseAbility(
      state,
      {
        type: 'use_ability', source: 'player', actorId: u.id,
        payload: { abilityId: abilityId('valley'), target: { kind: 'tile', position: { x: 3, y: 3, layer: 0 } } },
        sequenceNumber: 0, seed: 1, timestamp: { tick: 0, ct: 0 }, chainDepth: 0, isReaction: false,
      },
      catalog,
    );
    const changes = (terrainChangeFrom(r.generatedActions) as Extract<Action, { type: 'system_terrain_change' }>).payload.tileChanges;
    const byPos = new Map(changes.map((c) => [`${c.x},${c.y}`, c.newElevation - c.originalElevation]));
    expect(byPos.get('3,3')).toBe(-3);
    expect(byPos.get('3,2')).toBe(-2);
    expect(byPos.get('2,2')).toBe(-1);
  });

  it('skips kernel offsets that fall outside the map (anchor at a corner)', () => {
    const u = terraformer({ position: { x: 0, y: 0, layer: 0 } });
    const state = makeGameState({ units: [u], map: landMap(7, 7), turnState: activeTurnFor(u.id) });
    const r = reduceUseAbility(
      state,
      {
        type: 'use_ability', source: 'player', actorId: u.id,
        payload: { abilityId: abilityId('hill'), target: { kind: 'tile', position: { x: 0, y: 0, layer: 0 } } },
        sequenceNumber: 0, seed: 1, timestamp: { tick: 0, ct: 0 }, chainDepth: 0, isReaction: false,
      },
      catalog,
    );
    const changes = (terrainChangeFrom(r.generatedActions) as Extract<Action, { type: 'system_terrain_change' }>).payload.tileChanges;
    // Only the 4 in-bounds tiles of the 3×3 (anchor + east + south + SE).
    expect(changes).toHaveLength(4);
  });
});

describe('Worldcraft — effect-queue cap eviction', () => {
  it('LIFO-evicts the oldest entry with a revert action when over cap (default 2)', () => {
    let state = makeGameState({ units: [terraformer({ mp: 100 })], map: landMap(8, 8) });
    const actorId = state.units.values().next().value!.id;
    const positions = [{ x: 1, y: 2 }, { x: 3, y: 2 }, { x: 5, y: 2 }];
    let lastR: ReturnType<typeof reduceUseAbility> | undefined;
    for (const p of positions) {
      state = { ...state, turnState: activeTurnFor(actorId) };
      lastR = reduceUseAbility(
        state,
        {
          type: 'use_ability', source: 'player', actorId,
          payload: { abilityId: abilityId('pillar'), target: { kind: 'tile', position: { x: p.x, y: p.y, layer: 0 } } },
          sequenceNumber: 0, seed: 1, timestamp: { tick: 0, ct: 0 }, chainDepth: 0, isReaction: false,
        },
        catalog,
      );
      state = lastR.newState;
    }
    // After 3 casts at cap 2, the queue holds the latest 2.
    expect(state.units.get(actorId)!.worldcraftEffects).toHaveLength(2);
    // The third cast emitted a revert (a second system_terrain_change undoing
    // the evicted first Pillar) alongside its own cast change.
    const terrainChanges = lastR!.generatedActions.filter((a) => a.type === 'system_terrain_change');
    expect(terrainChanges.length).toBe(2);
  });
});

describe('Worldcraft — Barrier (tile_set)', () => {
  function barrierAction(positions: ReadonlyArray<{ x: number; y: number }>) {
    return {
      type: 'use_ability' as const, source: 'player' as const, actorId: undefined,
      payload: {
        abilityId: abilityId('barrier'),
        target: { kind: 'tile_set' as const, positions: positions.map((p) => ({ x: p.x, y: p.y, layer: 0 })) },
      },
      sequenceNumber: 0, seed: 1, timestamp: { tick: 0, ct: 0 }, chainDepth: 0, isReaction: false,
    };
  }

  it('spawns a barrier per tile with HP = PA × MA and queues one barrier effect', () => {
    const u = terraformer({ pa: 6, ma: 8, position: { x: 0, y: 0, layer: 0 } });
    const state = makeGameState({ units: [u], map: landMap(8, 8), turnState: activeTurnFor(u.id) });
    const r = reduceUseAbility(
      state,
      { ...barrierAction([{ x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }]), actorId: u.id },
      catalog,
    );
    const bc = barrierChangeFrom(r.generatedActions) as Extract<Action, { type: 'system_barrier_change' }>;
    expect(bc.payload.tileChanges).toHaveLength(3);
    for (const c of bc.payload.tileChanges) {
      expect(c.barrier).toMatchObject({ hp: 48, ttl: 5, ownerId: u.id });
    }
    const q = r.newState.units.get(u.id)!.worldcraftEffects;
    expect(q).toHaveLength(1);
    expect(q[0]!.kind).toBe('barrier');
    expect((q[0] as Extract<WorldcraftEffectEntry, { kind: 'barrier' }>).barrierTiles).toHaveLength(3);
  });

  it('validates: a 3-tile horizontal line is legal', () => {
    // Caster off the line and within Manhattan range 4 of all three tiles.
    const u = terraformer({ position: { x: 2, y: 0, layer: 0 } });
    const state = makeGameState({ units: [u], map: landMap(8, 8), turnState: activeTurnFor(u.id) });
    const v = validateAction(state, { ...barrierAction([{ x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }]), actorId: u.id }, catalog);
    expect(v.valid).toBe(true);
  });

  it('rejects a line shorter than 3 tiles', () => {
    const u = terraformer();
    const state = makeGameState({ units: [u], map: landMap(8, 8), turnState: activeTurnFor(u.id) });
    const v = validateAction(state, { ...barrierAction([{ x: 1, y: 2 }, { x: 2, y: 2 }]), actorId: u.id }, catalog);
    expect(v.valid).toBe(false);
  });

  it('rejects a line longer than 5 tiles', () => {
    const u = terraformer({ position: { x: 0, y: 2, layer: 0 } });
    const state = makeGameState({ units: [u], map: landMap(10, 8), turnState: activeTurnFor(u.id) });
    const v = validateAction(state, { ...barrierAction([{ x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 }, { x: 5, y: 2 }, { x: 6, y: 2 }]), actorId: u.id }, catalog);
    expect(v.valid).toBe(false);
  });

  it('rejects a non-contiguous line (gap)', () => {
    const u = terraformer();
    const state = makeGameState({ units: [u], map: landMap(8, 8), turnState: activeTurnFor(u.id) });
    const v = validateAction(state, { ...barrierAction([{ x: 1, y: 2 }, { x: 2, y: 2 }, { x: 4, y: 2 }]), actorId: u.id }, catalog);
    expect(v.valid).toBe(false);
  });

  it('rejects a diagonal line', () => {
    const u = terraformer();
    const state = makeGameState({ units: [u], map: landMap(8, 8), turnState: activeTurnFor(u.id) });
    const v = validateAction(state, { ...barrierAction([{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }]), actorId: u.id }, catalog);
    expect(v.valid).toBe(false);
  });

  it('rejects placing on an occupied tile', () => {
    const u = terraformer({ position: { x: 0, y: 0, layer: 0 } });
    const blocker = makeUnit({ id: 'block', spd: 9, classId: 'knight', position: { x: 2, y: 2, layer: 0 } });
    const state = makeGameState({ units: [u, blocker], map: landMap(8, 8), turnState: activeTurnFor(u.id) });
    const v = validateAction(state, { ...barrierAction([{ x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }]), actorId: u.id }, catalog);
    expect(v.valid).toBe(false);
  });

  it('rejects placing on a tile that already has a barrier', () => {
    const u = terraformer({ position: { x: 0, y: 0, layer: 0 } });
    const tiles = [];
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      tiles.push(x === 2 && y === 2
        ? { x, y, elevation: 4, barrier: { hp: 10, ttl: 3, ownerId: u.id } }
        : { x, y, elevation: 4 });
    }
    const state = makeGameState({ units: [u], map: mapWith({ width: 8, height: 8, tiles }), turnState: activeTurnFor(u.id) });
    const v = validateAction(state, { ...barrierAction([{ x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }]), actorId: u.id }, catalog);
    expect(v.valid).toBe(false);
  });

  it('rejects tiles out of range', () => {
    const u = terraformer({ position: { x: 0, y: 0, layer: 0 } });
    const state = makeGameState({ units: [u], map: landMap(12, 12), turnState: activeTurnFor(u.id) });
    // x=9.. is well beyond range 4 from (0,0).
    const v = validateAction(state, { ...barrierAction([{ x: 9, y: 0 }, { x: 10, y: 0 }, { x: 11, y: 0 }]), actorId: u.id }, catalog);
    expect(v.valid).toBe(false);
  });
});
