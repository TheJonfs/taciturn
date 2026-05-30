// Session 53 — Worldcraft effect queue (Piece 9).
//
// Cap-based LIFO eviction, terrain vs barrier revert, computed cap (Expert
// Former composability), and the Barrier-TTL decrement helper.

import { describe, expect, it } from 'vitest';
import {
  computeWorldcraftEffectCap,
  decrementBarrierTtls,
  enqueueWorldcraftEffect,
  revertActionsFor,
} from './queue.ts';
import { createCatalog } from '../catalog/index.ts';
import { defaultTestRulesets } from '../catalog/test-fixtures.ts';
import { emptyCatalog, makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { ACTIVE_BUCKET_IDS, PASSIVE_BUCKET_IDS } from '../abilities/constants.ts';
import {
  abilityId,
  bucketId,
  classId,
  commandSetId,
  passiveHook,
  type AbilityId,
  type ClassDefinition,
  type Loadout,
  type PassiveAbilityDefinition,
  type TerrainTileChange,
  type WorldcraftBarrierEffect,
  type WorldcraftTerrainEffect,
} from '@engine/index.ts';

function change(x: number, fromE: number, toE: number): TerrainTileChange {
  return {
    x,
    y: 0,
    layer: 0,
    originalElevation: fromE,
    newElevation: toE,
    originalTerrain: 'ground',
    newTerrain: 'ground',
  };
}

function terrainEntry(ability: string, changes: ReadonlyArray<TerrainTileChange>): WorldcraftTerrainEffect {
  return { kind: 'terrain', abilityId: abilityId(ability), tileChanges: changes, castTick: 0 };
}

function barrierEntry(ability: string, ttl: number): WorldcraftBarrierEffect {
  return {
    kind: 'barrier',
    abilityId: abilityId(ability),
    barrierTiles: [{ x: 5, y: 0, layer: 0 }],
    castTick: 0,
    ttl,
  };
}

describe('enqueueWorldcraftEffect — cap & eviction', () => {
  it('appends under the cap with no eviction', () => {
    const cat = emptyCatalog();
    const u = makeUnit({ id: 'terra', spd: 7 });
    const state = makeGameState({ units: [u] });
    const r = enqueueWorldcraftEffect(state, cat, u, terrainEntry('pillar', [change(0, 2, 5)]));
    expect(r.unit.worldcraftEffects).toHaveLength(1);
    expect(r.revertActions).toEqual([]);
  });

  it('evicts the oldest entry when the cap (default 2) is exceeded', () => {
    const cat = emptyCatalog();
    let u = makeUnit({ id: 'terra', spd: 7 });
    const state = makeGameState({ units: [u] });
    u = enqueueWorldcraftEffect(state, cat, u, terrainEntry('a', [change(0, 2, 5)])).unit;
    u = enqueueWorldcraftEffect(state, cat, u, terrainEntry('b', [change(1, 2, 5)])).unit;
    // Third cast: cap 2 exceeded → oldest ('a') evicted.
    const r = enqueueWorldcraftEffect(state, cat, u, terrainEntry('c', [change(2, 2, 5)]));
    expect(r.unit.worldcraftEffects).toHaveLength(2);
    const ids = r.unit.worldcraftEffects.map((e) => e.abilityId);
    expect(ids).toEqual([abilityId('b'), abilityId('c')]);
    // The evicted terrain entry reverts via a swapped terrain-change.
    expect(r.revertActions).toHaveLength(1);
    const revert = r.revertActions[0]!;
    expect(revert.type).toBe('system_terrain_change');
    if (revert.type !== 'system_terrain_change') return;
    const tc = revert.payload.tileChanges[0]!;
    expect(tc.x).toBe(0);
    expect(tc.originalElevation).toBe(5); // swapped: was newElevation
    expect(tc.newElevation).toBe(2); // swapped: was originalElevation
  });

  it('a barrier entry reverts by clearing its barrier tiles', () => {
    expect(revertActionsFor(barrierEntry('barrier', 5))).toEqual([
      {
        type: 'system_barrier_change',
        source: 'system',
        payload: { tileChanges: [{ x: 5, y: 0, layer: 0, barrier: null }] },
      },
    ]);
  });
});

// A synthetic Expert Former: +2 to the Worldcraft effect cap via
// modifyStatQuery (the real one lands in S54; this validates the hook
// composes for any equipper).
function expertFormer(): PassiveAbilityDefinition {
  return {
    id: abilityId('expert_former'),
    name: 'Expert Former',
    kind: 'passive',
    bucket: bucketId('support'),
    baseCost: 1,
    availability: 'available',
    hooks: [
      passiveHook('modifyStatQuery', (args) =>
        args.statName === 'worldcraft_effect_cap' ? args.baseValue + 2 : args.baseValue,
      ),
    ],
  };
}

function classDef(): ClassDefinition {
  return {
    id: classId('knight'),
    name: 'Knight',
    movement: { moveRange: 3, jump: 2, terrainCosts: new Map(), canEnter: new Set(['ground']) },
    evasion: { front: 0, side: 0, back: 0 },
    equipmentSlots: { leftHand: true, rightHand: true, headgear: true, armor: true, accessory: true },
    firstActionCommandSet: commandSetId('battle_skill'),
    freeAbilities: new Set(),
    dominantStat: 'pa',
  };
}

function loadoutWithSupport(support?: AbilityId): Loadout {
  const actionBuckets: Record<string, ReadonlyArray<ReturnType<typeof commandSetId>>> = {};
  for (const b of ACTIVE_BUCKET_IDS) actionBuckets[b] = [];
  const passiveBuckets: Record<string, ReadonlyArray<AbilityId>> = {};
  for (const b of PASSIVE_BUCKET_IDS) passiveBuckets[b] = [];
  if (support !== undefined) passiveBuckets[bucketId('support')] = [support];
  return { actionBuckets, passiveBuckets };
}

describe('computeWorldcraftEffectCap — computed (Expert Former composes)', () => {
  function cat() {
    return createCatalog({
      statusTypes: [],
      abilities: [expertFormer()],
      commandSets: [],
      classes: [classDef()],
      items: [],
      rulesets: defaultTestRulesets,
    });
  }

  it('defaults to 2 with no modifiers', () => {
    const c = cat();
    const u = makeUnit({ id: 'terra', spd: 7, loadout: loadoutWithSupport() });
    expect(computeWorldcraftEffectCap(makeGameState({ units: [u] }), c, u)).toBe(2);
  });

  it('rises to 4 when Expert Former is equipped', () => {
    const c = cat();
    const u = makeUnit({ id: 'terra', spd: 7, loadout: loadoutWithSupport(abilityId('expert_former')) });
    expect(computeWorldcraftEffectCap(makeGameState({ units: [u] }), c, u)).toBe(4);
  });

  it('holds 4 effects (no eviction) at the raised cap', () => {
    const c = cat();
    let u = makeUnit({ id: 'terra', spd: 7, loadout: loadoutWithSupport(abilityId('expert_former')) });
    const state = makeGameState({ units: [u] });
    for (const name of ['a', 'b', 'c', 'd']) {
      const r = enqueueWorldcraftEffect(state, c, u, terrainEntry(name, [change(0, 2, 5)]));
      u = r.unit;
      expect(r.revertActions).toEqual([]); // never evicts up to 4
    }
    expect(u.worldcraftEffects).toHaveLength(4);
  });
});

describe('decrementBarrierTtls', () => {
  it('returns the same unit untouched when there are no barrier effects', () => {
    const u = makeUnit({ id: 'terra', spd: 7 });
    const withTerrain = { ...u, worldcraftEffects: [terrainEntry('pillar', [change(0, 2, 5)])] };
    const r = decrementBarrierTtls(withTerrain);
    expect(r.unit).toBe(withTerrain);
    expect(r.clearActions).toEqual([]);
  });

  it('decrements a barrier TTL without expiring it', () => {
    const u = makeUnit({ id: 'terra', spd: 7 });
    const withBarrier = { ...u, worldcraftEffects: [barrierEntry('barrier', 3)] };
    const r = decrementBarrierTtls(withBarrier);
    expect(r.clearActions).toEqual([]);
    const e = r.unit.worldcraftEffects[0]!;
    expect(e.kind).toBe('barrier');
    if (e.kind === 'barrier') expect(e.ttl).toBe(2);
  });

  it('expires a barrier at TTL 1→0: prunes the entry and clears its tiles', () => {
    const u = makeUnit({ id: 'terra', spd: 7 });
    const withBarrier = { ...u, worldcraftEffects: [barrierEntry('barrier', 1)] };
    const r = decrementBarrierTtls(withBarrier);
    expect(r.unit.worldcraftEffects).toEqual([]);
    expect(r.clearActions).toHaveLength(1);
    expect(r.clearActions[0]!.type).toBe('system_barrier_change');
  });

  it('leaves terrain effects untouched while ticking barriers', () => {
    const u = makeUnit({ id: 'terra', spd: 7 });
    const mixed = {
      ...u,
      worldcraftEffects: [terrainEntry('pillar', [change(0, 2, 5)]), barrierEntry('barrier', 2)],
    };
    const r = decrementBarrierTtls(mixed);
    expect(r.unit.worldcraftEffects).toHaveLength(2);
    expect(r.unit.worldcraftEffects[0]!.kind).toBe('terrain');
    const b = r.unit.worldcraftEffects[1]!;
    if (b.kind === 'barrier') expect(b.ttl).toBe(1);
  });
});
