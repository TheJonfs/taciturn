// Session 62 — Dragoon Jump (ADR-0103), end-to-end. Jump is a charged
// off-field leap: the caster goes `airborne` (untargetable) at commit,
// charges at 3 × Speed, then lands on its takeoff tile dealing
// PA × WP × (1 + isLance) to the unit on the target tile (whiff if vacated).

import { describe, expect, it } from 'vitest';
import { createCatalog, type StatusEffectType } from '../catalog/index.ts';
import {
  DEFAULT_TEST_DAMAGE_PIPELINE,
  makeTestRuleset,
} from '../catalog/test-fixtures.ts';
import { makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { advanceToNextEvent } from '../turn/scheduler.ts';
import { flatMap } from '../map/test-fixtures.ts';
import { runDamagePipeline } from '../damage/pipeline.ts';
import { defaultDamageHandlers } from '../damage/default-handlers.ts';
import { ACTIVE_BUCKET_IDS, PASSIVE_BUCKET_IDS } from '../abilities/constants.ts';
import {
  abilityId,
  bucketId,
  classId,
  commandSetId,
  statusHook,
  statusTypeId,
  unitId,
  type AbilityId,
  type ClassDefinition,
  type Loadout,
  type ProposedAction,
  type UnitEquipment,
} from '@engine/index.ts';
import { commitAction } from './commit.ts';
import { validateAction } from './validate.ts';
import { estimateChargedTiming } from '../forecast/charged-timing.ts';
import { computeChargedActionSpeed } from '../ct/speed.ts';
import type { GameState } from '../types/index.ts';
import { jump } from '../../content/abilities/jump.ts';
import { attack } from '../../content/abilities/attack.ts';
import { lance } from '../../content/items/lance.ts';
import { longSword } from '../../content/items/long-sword.ts';

function knightClass(): ClassDefinition {
  return {
    id: classId('knight'),
    name: 'Knight',
    movement: { moveRange: 3, jump: 2, terrainCosts: new Map(), canEnter: new Set(['ground']) },
    evasion: { front: 0, side: 0, back: 0 },
    equipmentSlots: { leftHand: true, rightHand: true, headgear: true, armor: true, accessory: true },
    firstActionCommandSet: commandSetId('dragoon'),
    freeAbilities: new Set([abilityId('attack')]),
    dominantStat: 'pa',
  };
}

function chargingType(): StatusEffectType {
  return {
    id: statusTypeId('charging'),
    name: 'Charging',
    tags: ['neutral'],
    durationMode: 'conditional',
    stackingRule: 'REJECT',
    hooks: [statusHook('queryTurnSkipped', () => ({ reason: 'charging', suppressStatusTicks: false }))],
  };
}

function loadout(): Loadout {
  const actionBuckets: Record<string, ReadonlyArray<ReturnType<typeof commandSetId>>> = {};
  for (const b of ACTIVE_BUCKET_IDS) actionBuckets[b] = [];
  actionBuckets[bucketId('first_action')] = [commandSetId('dragoon')];
  const passiveBuckets: Record<string, ReadonlyArray<AbilityId>> = {};
  for (const b of PASSIVE_BUCKET_IDS) passiveBuckets[b] = [];
  return { actionBuckets, passiveBuckets };
}

function weapon(id: string): UnitEquipment {
  return { rightHand: id as never, leftHand: null, headgear: null, armor: null, accessory: null };
}

function turnFor(id: string) {
  return {
    unitId: unitId(id),
    budget: { movesAvailable: 1, actsAvailable: 1 },
    consumed: { movesConsumed: 0, actsConsumed: 0 },
    reactionsUsedThisTurn: new Map(),
  };
}

function cat() {
  return createCatalog({
    statusTypes: [chargingType()],
    abilities: [jump, attack],
    commandSets: [
      { id: commandSetId('dragoon'), name: 'Dragoon', members: [abilityId('jump'), abilityId('attack')], baseCost: 1, availability: 'hidden' },
    ],
    classes: [knightClass()],
    items: [lance, longSword],
    rulesets: [makeTestRuleset({ damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE })],
  });
}

function resolveCharge(s0: GameState, catalog: ReturnType<typeof cat>): GameState {
  let s = s0;
  let resolveProposed: ProposedAction | null = null;
  for (let i = 0; i < 60; i++) {
    const sched = advanceToNextEvent(s, catalog);
    if (sched === null) break;
    s = sched.newState;
    if (sched.proposed.type === 'charged_action_resolve') {
      resolveProposed = sched.proposed;
      break;
    }
    const r = commitAction(s, sched.proposed, catalog);
    expect(r.ok).toBe(true);
    if (!r.ok) return s;
    s = r.newState;
  }
  expect(resolveProposed).not.toBeNull();
  const r = commitAction(s, resolveProposed!, catalog);
  expect(r.ok).toBe(true);
  if (!r.ok) return s;
  return r.newState;
}

describe('Dragoon Jump — charge rate + airborne', () => {
  it('charges at 3 × the caster Speed', () => {
    const c = cat();
    const j = makeUnit({ id: 'j', spd: 10, mp: 10, equipment: weapon(lance.id), loadout: loadout(), position: { x: 0, y: 0, layer: 0 } });
    const enemy = makeUnit({ id: 'e', team: 'team_b', spd: 10, hp: 200, maxHpBase: 200, position: { x: 2, y: 0, layer: 0 } });
    const s = makeGameState({ units: [j, enemy], map: flatMap(6, 6), turnState: turnFor('j') });
    const r = commitAction(s, {
      type: 'use_ability', source: 'player', actorId: j.id,
      payload: { abilityId: abilityId('jump'), target: { kind: 'tile', position: { x: 2, y: 0, layer: 0 } } },
    }, c);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.newState.chargedActions).toHaveLength(1);
    expect(r.newState.chargedActions[0]!.speed).toBe(30); // 3 × 10
    expect(r.newState.units.get(j.id)!.airborne).toBe(true);
  });

  it('the airborne jumper is untargetable', () => {
    const c = cat();
    // Jumper already airborne; it's the enemy's turn — the enemy tries to
    // attack the airborne unit and is rejected for airborne (not turn order).
    const j = makeUnit({ id: 'j', spd: 10, airborne: true, equipment: weapon(lance.id), loadout: loadout(), position: { x: 0, y: 0, layer: 0 } });
    const enemy = makeUnit({ id: 'e', team: 'team_b', spd: 10, hp: 100, maxHpBase: 100, equipment: weapon(longSword.id), loadout: loadout(), position: { x: 1, y: 0, layer: 0 } });
    const state = makeGameState({ units: [j, enemy], map: flatMap(6, 6), turnState: turnFor('e') });
    const attackAirborne = validateAction(state, {
      type: 'use_ability', source: 'player', actorId: enemy.id,
      payload: { abilityId: abilityId('attack'), target: { kind: 'unit', unitId: j.id } },
    }, c);
    expect(attackAirborne.valid).toBe(false);
    if (!attackAirborne.valid) expect(attackAirborne.reason).toMatch(/airborne/i);
  });
});

describe('Dragoon Jump — resolve', () => {
  it('lands back home, clears airborne, and strikes the target tile for PA×WP×2 (Lance)', () => {
    const c = cat();
    const j = makeUnit({ id: 'j', spd: 10, pa: 6, mp: 10, brave: 100, equipment: weapon(lance.id), loadout: loadout(), position: { x: 0, y: 0, layer: 0 } });
    const enemy = makeUnit({ id: 'e', team: 'team_b', spd: 10, hp: 200, maxHpBase: 200, position: { x: 2, y: 0, layer: 0 } });
    let s = makeGameState({ units: [j, enemy], map: flatMap(6, 6), turnState: turnFor('j') });
    const cast = commitAction(s, {
      type: 'use_ability', source: 'player', actorId: j.id,
      payload: { abilityId: abilityId('jump'), target: { kind: 'tile', position: { x: 2, y: 0, layer: 0 } } },
    }, c);
    expect(cast.ok).toBe(true);
    if (!cast.ok) return;
    const ended = commitAction(cast.newState, { type: 'turn_end', source: 'system', payload: { unitId: j.id } }, c);
    expect(ended.ok).toBe(true);
    if (!ended.ok) return;
    s = resolveCharge(ended.newState, c);
    const jumper = s.units.get(j.id)!;
    expect(jumper.airborne).toBe(false); // landed
    expect(jumper.position).toEqual({ x: 0, y: 0, layer: 0 }); // back home
    // Damage: PA 6 × WP 10 × power 1 × Lance ×2 × variance[0.9,1.1] =
    // 120 × [0.9, 1.1] = [108, 132] → hp 200 - that = [68, 92].
    const enemyHp = s.units.get(enemy.id)!.vitals.hp;
    expect(enemyHp).toBeGreaterThanOrEqual(68);
    expect(enemyHp).toBeLessThanOrEqual(92);
    expect(s.chargedActions).toHaveLength(0);
  });

  it('whiffs when the target tile is empty at resolution (the dodge window)', () => {
    const c = cat();
    const j = makeUnit({ id: 'j', spd: 10, pa: 6, mp: 10, equipment: weapon(lance.id), loadout: loadout(), position: { x: 0, y: 0, layer: 0 } });
    const enemy = makeUnit({ id: 'e', team: 'team_b', spd: 10, hp: 200, maxHpBase: 200, position: { x: 4, y: 4, layer: 0 } });
    let s = makeGameState({ units: [j, enemy], map: flatMap(6, 6), turnState: turnFor('j') });
    // Target an empty tile.
    const cast = commitAction(s, {
      type: 'use_ability', source: 'player', actorId: j.id,
      payload: { abilityId: abilityId('jump'), target: { kind: 'tile', position: { x: 2, y: 0, layer: 0 } } },
    }, c);
    expect(cast.ok).toBe(true);
    if (!cast.ok) return;
    const ended = commitAction(cast.newState, { type: 'turn_end', source: 'system', payload: { unitId: j.id } }, c);
    expect(ended.ok).toBe(true);
    if (!ended.ok) return;
    s = resolveCharge(ended.newState, c);
    expect(s.units.get(enemy.id)!.vitals.hp).toBe(200); // untouched
    expect(s.units.get(j.id)!.airborne).toBe(false);
  });
});

describe('Dragoon Jump — timing forecast uses 3 × Speed', () => {
  it('the pre-commit projection matches the committed Speed-derived rate, not actionSpeed', () => {
    const c = cat();
    const j = makeUnit({ id: 'j', spd: 10, mp: 10, equipment: weapon(lance.id), loadout: loadout(), position: { x: 0, y: 0, layer: 0 } });
    const state = makeGameState({ units: [j], map: flatMap(6, 6), turnState: turnFor('j') });
    // The forecast must use the same rate commitCharged bakes in: 3 × 10 = 30
    // (NOT the fixed actionSpeed 24). Both route through computeChargedActionSpeed.
    expect(computeChargedActionSpeed(state, c, j, jump)).toBe(30);
    const est = estimateChargedTiming({ state, catalog: c, caster: j, ability: jump, anchor: { x: 2, y: 0, layer: 0 } });
    expect(est).not.toBeNull();
    // At rate 30 the charge resolves in ceil(100/30) = 4 ticks; the old bug
    // (actionSpeed 24) would have projected ceil(100/24) = 5.
    expect(est!.ticksToResolve).toBe(4);
  });
});

describe('Dragoon Jump — Lance doubling', () => {
  it('a Lance doubles Jump damage; a non-Lance does not', () => {
    const c = cat();
    const withLance = makeUnit({ id: 'a', spd: 10, pa: 5, equipment: weapon(lance.id) });
    const withSword = makeUnit({ id: 'b', spd: 10, pa: 5, equipment: weapon(longSword.id) });
    const target = makeUnit({ id: 't', spd: 10, hp: 200, maxHpBase: 200 });
    const state = makeGameState({ units: [withLance, withSword, target] });
    const lanceCtx = runDamagePipeline({ state, catalog: c, attacker: withLance, target, ability: jump, sourceActionSeq: 0, seed: 0, registry: defaultDamageHandlers });
    const swordCtx = runDamagePipeline({ state, catalog: c, attacker: withSword, target, ability: jump, sourceActionSeq: 0, seed: 0, registry: defaultDamageHandlers });
    // Lance: PA 5 × WP 10 × 2 × variance[0.9,1.1] = 100 × [0.9,1.1] = [90,110].
    // Long Sword (WP 8, no lance tag, flat variance): 5 × 8 × 1 = 40 exact.
    expect(lanceCtx.finalDamage).toBeGreaterThanOrEqual(90);
    expect(lanceCtx.finalDamage).toBeLessThanOrEqual(110);
    expect(swordCtx.finalDamage).toBe(40);
    // The ×2 multiplier is the deterministic proof of the Lance doubling.
    expect(lanceCtx.multipliers.some((m) => m.source === 'lance_jump' && m.factor === 2)).toBe(true);
    expect(swordCtx.multipliers.some((m) => m.source === 'lance_jump')).toBe(false);
  });
});
