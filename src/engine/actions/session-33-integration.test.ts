// Session 33 integration tests — Cluster 6 content (River Ridge) plus
// the terrain-tag abstraction (ADR-0073).
//
// Coverage:
//   1. River Ridge pathfinding sanity: the Water Mage's reachable set
//      includes the col-2 shallow water at the Tidewalker-adjusted
//      cost; the col-0 deep water is unreachable without Float.
//   2. Tidewalker composition: Water Mage with Tidewalker pays 1 mp on
//      water_shallow (down from the ruleset-default 2); Knight without
//      Tidewalker sees the unmodified cost.
//   3. Knockback fall-damage tiers off the ridge: a fabricated 3×1
//      synthetic strip per tier (4→2, 7→2, 9→2) confirms the
//      knockback primitive emits a `system_damage` with the expected
//      amount.
//   4. Bedrock Stride composition with falling damage on the River
//      Ridge demo state: an Earth Mage with the passive is unharmed by
//      a falling system_damage of any magnitude.
//   5. River Ridge battle bootstraps cleanly end-to-end:
//      `createInitialState` + `runPreBattlePhase` produce a valid state
//      with all six demo units placed in their respective deployment
//      zones.

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '@content/index.ts';
import {
  abilityId,
  computeMovementProfile,
  createInitialState,
  enumeratePreBattleActions,
  getLegalMoves,
  positionKey,
  runPreBattlePhase,
  teamId,
  unitId,
  type ActiveAbilityDefinition,
  type BattleMap,
  type DamageTag,
  type GameState,
} from '@engine/index.ts';
import { createCatalog } from '../catalog/index.ts';
import { defaultRuleset } from '../../content/rulesets/default.ts';
import { makeKnight } from '../abilities/test-fixtures.ts';
import { activeTurnFor, makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { reduceUseAbility } from './reducers.ts';
import { riverRidge } from '../../content/maps/river-ridge.ts';
import { riverRidgeBattle } from '../../content/battles/river-ridge-battle.ts';
import { commitAction } from './commit.ts';

const catalog = loadDefaultCatalog();

function initialRiverRidgeState(): GameState {
  const state = createInitialState(riverRidgeBattle, catalog);
  return runPreBattlePhase(state, riverRidgeBattle, catalog);
}

// A bare 1-knockback magical-damage ability. Reused across the
// fall-damage tier tests to drive the same primitive that powers Tide
// Surge / Knight's push in production.
function knockSpell(): ActiveAbilityDefinition {
  return {
    id: abilityId('test_ridge_blast'),
    name: 'Test Ridge Blast',
    kind: 'active',
    bucket: 'first_action' as unknown as ActiveAbilityDefinition['bucket'],
    availability: 'hidden',
    cost: { mp: 0 },
    targeting: { kind: 'single_unit', range: { horizontal: 4, vertical: 8 } },
    effects: {
      damage: {
        tags: ['magical'] as DamageTag[],
        power_coefficient: 1,
        variance: { min: 1, max: 1 },
        knockback: { distance: 1 },
      },
    },
    actionSpeed: 0,
    aoe: { kind: 'single' },
  } as unknown as ActiveAbilityDefinition;
}

function knockbackTierMap(highElev: number, lowElev: number): BattleMap {
  // 3×1 strip. Caster at (0,0); target at (1,0); landing tile at (2,0).
  return {
    width: 3,
    height: 1,
    tiles: [
      { x: 0, y: 0, layer: 0, elevation: highElev, terrain: 'ground', properties: [] },
      { x: 1, y: 0, layer: 0, elevation: highElev, terrain: 'ground', properties: [] },
      { x: 2, y: 0, layer: 0, elevation: lowElev, terrain: 'ground', properties: [] },
    ],
  };
}

function runKnockbackTier(highElev: number, lowElev: number): {
  amount: number;
  dropDistance: number;
} {
  const ability = knockSpell();
  const cat = createCatalog({
    statusTypes: [],
    abilities: [ability],
    commandSets: [],
    classes: [makeKnight()],
    items: [],
    rulesets: [defaultRuleset],
  });

  const caster = makeUnit({
    id: 'caster',
    spd: 10,
    ma: 5,
    faith: 100,
    position: { x: 0, y: 0, layer: 0 },
  });
  const target = makeUnit({
    id: 'target',
    spd: 10,
    hp: 999,
    team: 'team_b',
    faith: 100,
    position: { x: 1, y: 0, layer: 0 },
  });

  const state = makeGameState({
    units: [caster, target],
    map: knockbackTierMap(highElev, lowElev),
    turnState: activeTurnFor(caster.id),
  });

  const action = {
    sequenceNumber: 1,
    source: 'player' as const,
    timestamp: { tick: 0, ct: 0 },
    seed: 1,
    chainDepth: 0,
    isReaction: false,
    actorId: caster.id,
    type: 'use_ability' as const,
    payload: {
      abilityId: ability.id,
      target: { kind: 'unit' as const, unitId: target.id },
    },
  };

  const result = reduceUseAbility(state, action, cat);
  const falling = result.generatedActions.find(
    (a) =>
      a.type === 'system_damage' &&
      a.payload.source.kind === 'falling' &&
      a.payload.targetId === target.id,
  );
  if (falling === undefined || falling.type !== 'system_damage') {
    throw new Error('expected falling system_damage emission');
  }
  if (falling.payload.source.kind !== 'falling') {
    throw new Error('expected falling source');
  }
  return {
    amount: falling.payload.amount,
    dropDistance: falling.payload.source.dropDistance,
  };
}

describe('Session 33 — River Ridge pathfinding', () => {
  it('Water Mage with Move 6 + Tidewalker reaches col-1 water_deep at row 1 going west', () => {
    // Water Mage starts at (5, 1). Equipment grants Move +2 (Sorcerer's
    // Robe + Lightfoot) → Move 6. Tidewalker: water_shallow cost 1,
    // water_deep cost 2. Path west: (5→4→3→2→1) costs 1+1+1+2 = 5 mp.
    // (1, 1) reachable; (0, 1) at total 7 mp is not.
    const state = initialRiverRidgeState();
    const waterMage = state.units.get(unitId('blue_water_mage'))!;
    const moves = getLegalMoves(state, waterMage.id, catalog);
    expect(moves.reachable.has(positionKey({ x: 1, y: 1, layer: 0 }))).toBe(true);
    expect(moves.reachable.has(positionKey({ x: 0, y: 1, layer: 0 }))).toBe(false);
  });

  it('Water Mage can also reach water_shallow tiles at the reduced cost', () => {
    const state = initialRiverRidgeState();
    const waterMage = state.units.get(unitId('blue_water_mage'))!;
    const moves = getLegalMoves(state, waterMage.id, catalog);
    let reachedShallow = false;
    for (const [, path] of moves.reachable) {
      const dest = path.destination;
      const tile = state.map.tiles.find(
        (t) => t.x === dest.x && t.y === dest.y && t.layer === dest.layer,
      );
      if (tile?.terrain === 'water_shallow') {
        reachedShallow = true;
        break;
      }
    }
    expect(reachedShallow).toBe(true);
  });

  it('Knight at (3, 4) leaps over col-2 water_shallow to reach the col-1 island (1, 4) for 2 mp', () => {
    // The jump-over-water leap at row 4 (also valid at row 5; symmetric
    // at rows 8-9 for the southern islands). Knight at (3, 4) leaps E→W
    // over (2, 4) water_shallow to (1, 4) island elev 2. Leap cost 2 mp
    // is cheaper than the wade path (cost 3 mp: 2 for shallow + 1 for
    // island). The reachable set includes (1, 4).
    const state = initialRiverRidgeState();
    const knightId = unitId('blue_knight_n');
    const knight = state.units.get(knightId)!;
    const repositioned: typeof state.units = new Map([
      ...state.units,
      [knightId, { ...knight, position: { x: 3, y: 4, layer: 0 } }],
    ]);
    const newState: GameState = { ...state, units: repositioned };
    const moves = getLegalMoves(newState, knightId, catalog);
    expect(moves.reachable.has(positionKey({ x: 1, y: 4, layer: 0 }))).toBe(true);
    // The reconstructed path takes the leap (2 tiles) rather than wading
    // through (2, 4) — confirmed by checking that the cheaper path is
    // chosen. Wade path would have 3 entries [start, (2,4), (1,4)];
    // leap path has 2 entries [start, (1,4)].
    const path = moves.reachable.get(positionKey({ x: 1, y: 4, layer: 0 }))!;
    expect(path.cost).toBe(2);
    expect(path.path.length).toBe(2);
  });

  it('Knight can also wade into water at penalty cost (canEnter is universal)', () => {
    // Knight at (3, 4) has Move 3. (3,4) → (2,4) [shallow, cost 2] →
    // (1,4) [island, cost 1] → total 3 mp. (2, 4) is also reachable
    // standalone at cost 2.
    const state = initialRiverRidgeState();
    const knightId = unitId('blue_knight_n');
    const knight = state.units.get(knightId)!;
    const repositioned: typeof state.units = new Map([
      ...state.units,
      [knightId, { ...knight, position: { x: 3, y: 4, layer: 0 } }],
    ]);
    const newState: GameState = { ...state, units: repositioned };
    const moves = getLegalMoves(newState, knightId, catalog);
    // Wading to (2, 4) shallow water costs exactly 2.
    const wadePath = moves.reachable.get(positionKey({ x: 2, y: 4, layer: 0 }));
    expect(wadePath).toBeDefined();
    expect(wadePath!.cost).toBe(2);
  });
});

describe('Session 33 — Tidewalker / Bedrock Stride composition on River Ridge', () => {
  it('Water Mage with Tidewalker pays 1 mp on water_shallow (down from ruleset-default 2)', () => {
    const state = initialRiverRidgeState();
    const waterMage = state.units.get(unitId('blue_water_mage'))!;
    const profile = computeMovementProfile(state, waterMage.id, catalog);
    expect(profile.terrainCosts.get('water_shallow')).toBe(1);
    // Tidewalker also reduces water_deep cost 3 → 2, even though the
    // Water Mage's canEnter doesn't include water_deep.
    expect(profile.terrainCosts.get('water_deep')).toBe(2);
  });

  it('Knight has the unmodified ruleset water costs (no Tidewalker) and can enter all water', () => {
    const state = initialRiverRidgeState();
    const knight = state.units.get(unitId('blue_knight_n'))!;
    const profile = computeMovementProfile(state, knight.id, catalog);
    expect(profile.terrainCosts.get('water_shallow')).toBe(2);
    expect(profile.terrainCosts.get('water_deep')).toBe(3);
    // ADR-0073: water is universally enterable; the cost is the gate.
    expect(profile.canEnter.has('water_shallow')).toBe(true);
    expect(profile.canEnter.has('water_deep')).toBe(true);
  });

  it('Bedrock Stride on the Red Earth Mage negates fall damage from a falling system_damage', () => {
    // The S32 handoff flagged this as the "first playtest of the fall-
    // immunity passive on a unit knocked from the ridge." Real
    // knockback rider exercises end-to-end in `runKnockbackTier` below;
    // here we lock the primitive composition against the River Ridge
    // demo state.
    const state = initialRiverRidgeState();
    const earthMage = state.units.get(unitId('red_earth_mage'))!;
    const hpBefore = earthMage.vitals.hp;

    const fallingDamage = {
      type: 'system_damage' as const,
      source: 'system' as const,
      payload: {
        targetId: earthMage.id,
        amount: 50,
        tags: ['physical'] as const,
        source: {
          kind: 'falling' as const,
          unitId: earthMage.id,
          dropDistance: 5,
        },
      },
    };
    const result = commitAction(state, fallingDamage, catalog);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.newState.units.get(earthMage.id)!.vitals.hp).toBe(hpBefore);
  });
});

describe('Session 33 — knockback fall-damage tiers', () => {
  it('gentle slope (elev 4 → 2): dropDistance 2, fall damage 20', () => {
    const r = runKnockbackTier(4, 2);
    expect(r.dropDistance).toBe(2);
    expect(r.amount).toBe(20);
  });

  it('mid-ridge (elev 7 → 2): dropDistance 5, fall damage 50', () => {
    const r = runKnockbackTier(7, 2);
    expect(r.dropDistance).toBe(5);
    expect(r.amount).toBe(50);
  });

  it('east perch (elev 9 → 2): dropDistance 7, fall damage 70', () => {
    const r = runKnockbackTier(9, 2);
    expect(r.dropDistance).toBe(7);
    expect(r.amount).toBe(70);
  });
});

describe('Session 33 — River Ridge battle bootstraps end-to-end', () => {
  it('createInitialState + runPreBattlePhase produces all River Ridge units placed', () => {
    // Session 35: River Ridge expanded to 4v4. Session 48: 5v5 expansion
    // brought the roster to 10 (Blue gains Earth Mage; Red gains Knight).
    // The 3v3 `demoBattle` fixture stays untouched; the extra units live
    // on `riverRidgeBattle` directly.
    const state = initialRiverRidgeState();
    expect(state.units.size).toBe(riverRidgeBattle.units.length);
    expect(state.map).toBe(riverRidge);
  });

  it('every unit deploys on a tile owned by its team', () => {
    const state = initialRiverRidgeState();
    for (const unit of state.units.values()) {
      const tile = state.map.tiles.find(
        (t) =>
          t.x === unit.position.x &&
          t.y === unit.position.y &&
          t.layer === unit.position.layer,
      );
      expect(tile).toBeDefined();
      expect(tile!.deploymentZone).toBe(unit.team);
    }
  });

  it('Blue and Red each field at least one unit', () => {
    const state = initialRiverRidgeState();
    let blueCount = 0;
    let redCount = 0;
    for (const u of state.units.values()) {
      if (u.team === teamId('team_a')) blueCount += 1;
      if (u.team === teamId('team_b')) redCount += 1;
    }
    expect(blueCount).toBeGreaterThan(0);
    expect(redCount).toBeGreaterThan(0);
  });

  it('pre-battle queue emits one system_set_ct per unit (no explicit initialCT)', () => {
    const initial = createInitialState(riverRidgeBattle, catalog);
    const queue = enumeratePreBattleActions(initial, riverRidgeBattle, catalog);
    const setCtCount = queue.filter((a) => a.type === 'system_set_ct').length;
    expect(setCtCount).toBe(riverRidgeBattle.units.length);
  });
});
