// Session 54 — barrier-damage routing (the S53-deferred piece). A damaging
// ability that lands on a tile bearing a barrier emits `system_barrier_damage`
// (pipeline-bypass) instead of (or alongside, for AoE) hitting a unit:
//   - basic Attack on an adjacent barrier tile (single-target route);
//   - an AoE whose footprint covers barrier tiles (per-tile route).
// validateAction names a barrier tile as a legal damageable target even for
// `single_unit` abilities. End-to-end destruction reuses the S53 mechanism.

import { describe, expect, it } from 'vitest';
import { createCatalog, type ActiveAbilityDefinition } from '../../../engine/catalog/index.ts';
import { defaultRuleset } from '../../rulesets/default.ts';
import {
  abilityId,
  bucketId,
  classId,
  commandSetId,
  unitId,
  type Action,
  type BarrierState,
  type BattleMap,
  type ClassDefinition,
} from '@engine/index.ts';
import { loadDefaultCatalog } from '../../index.ts';
import { reduceUseAbility, reduceSystemBarrierDamage } from '../../../engine/actions/reducers.ts';
import { validateAction } from '../../../engine/actions/validate.ts';
import { makeGameState, makeUnit, activeTurnFor } from '../../../engine/ct/test-fixtures.ts';
import { mapWith } from '../../../engine/map/test-fixtures.ts';

const realCatalog = loadDefaultCatalog();

function barrier(hp: number, owner = 'terra'): BarrierState {
  return { hp, ttl: 5, ownerId: unitId(owner) };
}

// A land row map with optional barriers at given x positions.
function rowMapWithBarriers(width: number, barrierXs: ReadonlyMap<number, BarrierState>): BattleMap {
  const tiles = [];
  for (let x = 0; x < width; x++) {
    const b = barrierXs.get(x);
    tiles.push(b !== undefined ? { x, y: 0, elevation: 4, barrier: b } : { x, y: 0, elevation: 4 });
  }
  return mapWith({ width, height: 1, tiles });
}

function attackTile(actorId: ReturnType<typeof unitId>, x: number, y: number) {
  return {
    type: 'use_ability' as const, source: 'player' as const, actorId,
    payload: { abilityId: abilityId('attack'), target: { kind: 'tile' as const, position: { x, y, layer: 0 } } },
    sequenceNumber: 0, seed: 1, timestamp: { tick: 0, ct: 0 }, chainDepth: 0, isReaction: false,
  };
}

describe('Barrier damage — basic attack (single-target route)', () => {
  it('a basic Attack on an adjacent barrier tile emits system_barrier_damage (PA × WP, no variance)', () => {
    // PA 6, no weapon → WP 1, coeff 1 → amount 6.
    const u = makeUnit({ id: 'a', spd: 9, pa: 6, classId: 'knight', position: { x: 0, y: 0, layer: 0 } });
    const state = makeGameState({
      units: [u],
      map: rowMapWithBarriers(3, new Map([[1, barrier(48)]])),
      turnState: activeTurnFor(u.id),
    });
    const r = reduceUseAbility(state, attackTile(u.id, 1, 0), realCatalog);
    const dmg = r.generatedActions.find((a) => a.type === 'system_barrier_damage');
    expect(dmg).toBeDefined();
    const payload = (dmg as Extract<Action, { type: 'system_barrier_damage' }>).payload;
    expect(payload).toMatchObject({ x: 1, y: 0, layer: 0, amount: 6 });
    expect(payload.source).toMatchObject({ attackerId: u.id, abilityId: abilityId('attack') });
  });

  it('validateAction accepts a basic Attack on an adjacent barrier tile', () => {
    const u = makeUnit({ id: 'a', spd: 9, pa: 6, classId: 'knight', position: { x: 0, y: 0, layer: 0 } });
    const state = makeGameState({
      units: [u], map: rowMapWithBarriers(3, new Map([[1, barrier(48)]])), turnState: activeTurnFor(u.id),
    });
    expect(validateAction(state, attackTile(u.id, 1, 0), realCatalog).valid).toBe(true);
  });

  it('validateAction rejects a basic Attack on a barrier tile out of melee range', () => {
    const u = makeUnit({ id: 'a', spd: 9, pa: 6, classId: 'knight', position: { x: 0, y: 0, layer: 0 } });
    const state = makeGameState({
      units: [u], map: rowMapWithBarriers(4, new Map([[2, barrier(48)]])), turnState: activeTurnFor(u.id),
    });
    // Barrier at x=2 is 2 tiles from the attacker at x=0 — beyond Attack's
    // horizontal range 1.
    expect(validateAction(state, attackTile(u.id, 2, 0), realCatalog).valid).toBe(false);
  });

  it('destroys the barrier when the routed damage reaches its HP (S53 mechanism)', () => {
    const u = makeUnit({ id: 'a', spd: 9, pa: 6, classId: 'knight', position: { x: 0, y: 0, layer: 0 } });
    const state = makeGameState({
      units: [u], map: rowMapWithBarriers(3, new Map([[1, barrier(5)]])), turnState: activeTurnFor(u.id),
    });
    const r = reduceUseAbility(state, attackTile(u.id, 1, 0), realCatalog);
    const dmg = r.generatedActions.find((a) => a.type === 'system_barrier_damage')!;
    // Reduce the routed barrier damage end-to-end (amount 6 ≥ hp 5 → destroyed).
    const full: Extract<Action, { type: 'system_barrier_damage' }> = {
      ...(dmg as Extract<Action, { type: 'system_barrier_damage' }>),
      sequenceNumber: 1, timestamp: { tick: 0, ct: 0 }, seed: 0, chainDepth: 0, isReaction: false,
    };
    const after = reduceSystemBarrierDamage(r.newState, full);
    expect(after.outcome.destroyed).toBe(true);
    expect(after.outcome.hpAfter).toBe(0);
  });
});

// --- AoE route: synthetic instant cross AoE so a single reduce exercises
// resolveAoeDispatch (every real AoE is charged). ---

function crossDamageSpell(): ActiveAbilityDefinition {
  return {
    id: abilityId('quake'),
    name: 'Quake',
    kind: 'active',
    bucket: bucketId('first_action'),
    baseCost: 1,
    availability: 'hidden',
    tags: ['magical'],
    targeting: { kind: 'tile', range: { horizontal: 10, vertical: 3 }, rangeMode: 'arc' },
    actionSpeed: 0,
    mpCost: 0,
    effects: {
      damage: { tags: ['magical'], power_coefficient: 5 },
      aoe: { shape: { kind: 'cross', radius: 1 } },
    },
  };
}

function knightClass(): ClassDefinition {
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

const aoeCatalog = createCatalog({
  statusTypes: [],
  abilities: [crossDamageSpell()],
  commandSets: [],
  classes: [knightClass()],
  items: [],
  rulesets: [defaultRuleset],
});

describe('Barrier damage — AoE (per-tile route)', () => {
  // 7×3 land map; cross r1 anchored at (3,1) covers (3,1),(2,1),(4,1),(3,0),(3,2).
  function aoeMap(barrierAt: ReadonlyArray<{ x: number; y: number }>): BattleMap {
    const tiles = [];
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 7; x++) {
        const b = barrierAt.some((p) => p.x === x && p.y === y);
        tiles.push(b ? { x, y, elevation: 4, barrier: barrier(48) } : { x, y, elevation: 4 });
      }
    }
    return mapWith({ width: 7, height: 3, tiles });
  }

  function castQuake(actorId: ReturnType<typeof unitId>, x: number, y: number) {
    return {
      type: 'use_ability' as const, source: 'player' as const, actorId,
      payload: { abilityId: abilityId('quake'), target: { kind: 'tile' as const, position: { x, y, layer: 0 } } },
      sequenceNumber: 0, seed: 1, timestamp: { tick: 0, ct: 0 }, chainDepth: 0, isReaction: false,
    };
  }

  it('emits one system_barrier_damage per barrier tile in the footprint (MA × coeff)', () => {
    const caster = makeUnit({ id: 'c', spd: 9, ma: 8, classId: 'knight', position: { x: 0, y: 0, layer: 0 } });
    // Barriers on two cardinals of the cross at (3,1): (2,1) and (4,1).
    const state = makeGameState({
      units: [caster], map: aoeMap([{ x: 2, y: 1 }, { x: 4, y: 1 }]), turnState: activeTurnFor(caster.id),
    });
    const r = reduceUseAbility(state, castQuake(caster.id, 3, 1), aoeCatalog);
    const dmgs = r.generatedActions.filter((a) => a.type === 'system_barrier_damage');
    expect(dmgs).toHaveLength(2);
    for (const d of dmgs) {
      // MA 8 × power 5 = 40.
      expect((d as Extract<Action, { type: 'system_barrier_damage' }>).payload.amount).toBe(40);
    }
  });

  it('damages both a unit and a barrier when the footprint covers both', () => {
    const caster = makeUnit({ id: 'c', spd: 9, ma: 8, classId: 'knight', position: { x: 0, y: 0, layer: 0 } });
    const victim = makeUnit({ id: 'v', spd: 9, hp: 200, maxHpBase: 200, team: 'team_b', classId: 'knight', position: { x: 3, y: 2, layer: 0 } });
    const state = makeGameState({
      units: [caster, victim], map: aoeMap([{ x: 2, y: 1 }]), turnState: activeTurnFor(caster.id),
    });
    const r = reduceUseAbility(state, castQuake(caster.id, 3, 1), aoeCatalog);
    const barrierDmgs = r.generatedActions.filter((a) => a.type === 'system_barrier_damage');
    expect(barrierDmgs).toHaveLength(1);
    // The unit at (3,2) took normal pipeline damage (a per-target result).
    const unitResult = r.outcome.perTargetResults.find((t) => t.target.kind === 'unit');
    expect(unitResult?.damage).toBeGreaterThan(0);
  });
});
