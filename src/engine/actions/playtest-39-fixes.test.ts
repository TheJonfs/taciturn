// Playtest fixes — post-S38 in-between-sessions playtest debrief.
//
// Four areas:
//   1. Charged action persistence on caster KO
//   2. Reaction triggering reaction (Discharge Strike → Discharge Strike)
//   3. Fire Embrace stacking from same caster on same target (investigation)
//   4. Status duration tick math — DA/DM 24 → ? per Knight turn cycle
//
// The first two are regression tests for the fixes landed in this session.
// The last two are diagnostic — they pin the *current engine behavior* so
// we can compare against the playtest observation and decide whether the
// engine or the user's interpretation needs adjustment.

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '../../content/index.ts';
import { applyStatus } from '../status/apply.ts';
import {
  reduceChargedActionResolve,
  reduceStatusTick,
  reduceSystemDamage,
  reduceTurnStart,
  reduceUseAbility,
} from './reducers.ts';
import { runModifyStatQuery } from '../hooks/runners.ts';
import { activeTurnFor, makeChargedAction, makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import {
  abilityId,
  bucketId,
  chargedActionId,
  statusTypeId,
  unitId,
  EMPTY_LOADOUT,
  type AbilityId,
  type Action,
  type ChargedActionId,
  type CommandSetId,
  type UnitId,
} from '@engine/index.ts';
import { flatMap } from '../map/test-fixtures.ts';

// ===== Bug 1: charged action removed when caster KO'd =====

describe('charged action lifecycle on caster KO', () => {
  const catalog = loadDefaultCatalog();

  it('strips chargedActions belonging to the KO\'d caster from the queue', () => {
    // Two casters, both with charged actions in flight; KO one and verify
    // only their charge clears.
    const aliveCaster = makeUnit({ id: 'alive_caster', spd: 10 });
    const dyingCaster = makeUnit({ id: 'dying_caster', spd: 10, hp: 1 });
    const otherCharge = makeChargedAction({
      id: 'ca_alive',
      casterId: aliveCaster.id as unknown as string,
      speed: 25,
    });
    const dyingCharge = makeChargedAction({
      id: 'ca_dying',
      casterId: dyingCaster.id as unknown as string,
      speed: 25,
    });
    let state = makeGameState({
      units: [aliveCaster, dyingCaster],
      chargedActions: [otherCharge, dyingCharge],
    });
    expect(state.chargedActions).toHaveLength(2);

    // Apply enough damage to KO the dying caster via the system_damage
    // path (which is one of the two KO-detection sites we patched).
    const sysDmg: Action = {
      type: 'system_damage',
      sequenceNumber: 0,
      source: 'system',
      timestamp: { tick: 0, ct: 0 },
      seed: 0,
      chainDepth: 0,
      isReaction: false,
      payload: {
        targetId: dyingCaster.id,
        amount: 5,
        tags: [],
        source: { kind: 'falling' },
      },
    };
    const reduced = reduceSystemDamage(state, sysDmg, catalog);
    state = reduced.newState;

    // The dying caster's charge is gone; the alive caster's stays.
    expect(state.chargedActions).toHaveLength(1);
    expect(state.chargedActions[0]!.id).toBe(otherCharge.id);
  });

  it('Charging status is auto-removed on caster KO via the existing source-KO sweep', () => {
    // Apply Charging to a unit (self-source), then KO them and walk the
    // emitted system actions through the status_remove reducer to confirm
    // Charging is swept.
    const caster = makeUnit({ id: 'caster', spd: 10, hp: 1 });
    let state = makeGameState({ units: [caster] });
    const chargingApplied = applyStatus(
      state,
      {
        targetId: caster.id,
        typeId: statusTypeId('charging'),
        sourceUnitId: caster.id,
        sourceActionSeq: 0,
        customState: { chargedActionId: chargedActionId('ca_test') },
      },
      catalog,
    );
    state = chargingApplied.newState;
    expect(
      state.units.get(caster.id)!.statuses.some((s) => s.typeId === statusTypeId('charging')),
    ).toBe(true);

    // KO the caster via system_damage so the sweep emits.
    const sysDmg: Action = {
      type: 'system_damage',
      sequenceNumber: 0,
      source: 'system',
      timestamp: { tick: 0, ct: 0 },
      seed: 0,
      chainDepth: 0,
      isReaction: false,
      payload: {
        targetId: caster.id,
        amount: 5,
        tags: [],
        source: { kind: 'falling' },
      },
    };
    const reduced = reduceSystemDamage(state, sysDmg, catalog);
    state = reduced.newState;
    // Status removal is queued as a generated action — assert the emission
    // exists; the chain-runner in commitAction would actually apply it.
    const statusRemoves = reduced.generatedActions.filter(
      (a) =>
        a.type === 'status_remove' &&
        a.payload.statusTypeId === statusTypeId('charging') &&
        a.payload.targetId === caster.id,
    );
    expect(statusRemoves).toHaveLength(1);
  });

  it('reduceChargedActionResolve also fizzles on caster KO (defensive backstop)', () => {
    // The new clearing covers the normal flow; this defends the path
    // where the resolve action somehow survives (e.g. mid-resolve KO).
    const caster = makeUnit({ id: 'c', spd: 10, hp: 0 }); // already KO'd
    const ca = makeChargedAction({
      id: 'ca_x',
      casterId: caster.id as unknown as string,
      speed: 25,
      abilityId: 'fire_embrace',
    });
    const state = makeGameState({ units: [caster], chargedActions: [ca] });
    const action: Action = {
      type: 'charged_action_resolve',
      sequenceNumber: 0,
      source: 'system',
      timestamp: { tick: 0, ct: 0 },
      seed: 0,
      chainDepth: 0,
      isReaction: false,
      payload: { chargedActionId: ca.id as unknown as ChargedActionId },
    };
    const reduced = reduceChargedActionResolve(state, action, catalog);
    // Charged action removed by finalize; per-target results empty.
    expect(reduced.newState.chargedActions).toHaveLength(0);
  });
});

// ===== Bug 2: reaction does not trigger another reaction =====

describe('reaction-triggers-reaction guard', () => {
  const catalog = loadDefaultCatalog();

  it('a reaction use_ability does NOT emit further reactions even when target has a reaction equipped', () => {
    // Set up two Lightning Mages with Discharge in their reaction
    // bucket. Simulate a Discharge Strike firing as a reaction (isReaction:
    // true) against the second mage. Without the guard, the second mage's
    // Discharge would fire too — and the engine would ping-pong them
    // until per-unit-per-turn caps. With the guard, the reaction's
    // generatedReactions array is empty.
    const reactor = makeUnit({
      id: 'reactor',
      spd: 10,
      ma: 8,
      hp: 100,
      mp: 50,
      faith: 100,
      brave: 100,
      classId: 'lightning_mage',
      position: { x: 0, y: 0, layer: 0 },
    });
    const targetMage = makeUnit({
      id: 'target_mage',
      spd: 10,
      hp: 100,
      faith: 100,
      brave: 100,
      classId: 'lightning_mage', // also has Discharge in their freeAbilities
      position: { x: 1, y: 0, layer: 0 },
      team: 'team_b',
      loadout: {
        ...EMPTY_LOADOUT,
        passiveBuckets: new Map([[bucketId('reaction'), [abilityId('discharge')]]]),
      },
    });
    const state = makeGameState({
      units: [reactor, targetMage],
      map: flatMap(4, 4),
    });

    // Build a reaction-flagged Discharge Strike from reactor → targetMage.
    const reactionAction: Action = {
      type: 'use_ability',
      sequenceNumber: 1,
      source: 'system',
      actorId: reactor.id,
      timestamp: { tick: 0, ct: 0 },
      seed: 0xABCD,
      chainDepth: 1,
      isReaction: true,
      payload: {
        abilityId: abilityId('discharge_strike'),
        target: { kind: 'unit', unitId: targetMage.id },
      },
    };

    const result = reduceUseAbility(state, reactionAction, catalog);
    // The target took damage (Discharge connected) but did NOT chain a
    // reaction of their own. generatedReactions is empty or absent.
    expect(result.generatedReactions ?? []).toHaveLength(0);
    expect(result.newState.units.get(targetMage.id)!.vitals.hp).toBeLessThan(
      targetMage.vitals.hp,
    );
    // Suppress unused-warning for the cross-test imports.
    void unitId;
    void chargedActionId as unknown;
    void ({} as { c: CommandSetId; a: AbilityId; u: UnitId });
  });
});

// ===== Bug 4 (status tick math) =====

describe('status tick math — Don\'t Act / Don\'t Move duration decrement', () => {
  const catalog = loadDefaultCatalog();

  it('Don\'t Act with duration 24 decrements by 1 per status_tick (single tick)', () => {
    const target = makeUnit({
      id: 'target',
      spd: 10,
      statuses: [],
    });
    let state = makeGameState({
      units: [target],
      turnState: activeTurnFor(target.id),
    });
    // Apply Don't Act with duration 24.
    const applied = applyStatus(
      state,
      {
        targetId: target.id,
        typeId: statusTypeId('dont_act'),
        sourceUnitId: target.id, // self-anchored to keep test focused
        sourceActionSeq: 0,
        duration: 24,
      },
      catalog,
    );
    state = applied.newState;
    // Confirm initial duration.
    let inst = state.units
      .get(target.id)!
      .statuses.find((s) => s.typeId === statusTypeId('dont_act'))!;
    expect(inst.remainingDuration).toBe(24);

    // One status_tick decrements by exactly 1.
    const tick: Action = {
      type: 'status_tick',
      sequenceNumber: 1,
      source: 'system',
      timestamp: { tick: 0, ct: 0 },
      seed: 0,
      chainDepth: 0,
      isReaction: false,
      payload: { unitId: target.id, statusTypeId: statusTypeId('dont_act') },
    };
    const reduced = reduceStatusTick(state, tick, catalog);
    state = reduced.newState;
    inst = state.units
      .get(target.id)!
      .statuses.find((s) => s.typeId === statusTypeId('dont_act'))!;
    expect(inst.remainingDuration).toBe(23);
  });

  it('turn_start emits exactly one status_tick per per_unit_ct status (no double-decrement)', () => {
    // Reproduces the playtest scenario: Knight has DA + DM both at 24,
    // turn comes around. One turn_start should generate one tick per
    // status (so DA → 23 and DM → 23 after the chain runs).
    const target = makeUnit({ id: 'target', spd: 10, ct: 100 });
    let state = makeGameState({
      units: [target],
    });
    // Apply both statuses with duration 24.
    state = applyStatus(
      state,
      {
        targetId: target.id,
        typeId: statusTypeId('dont_act'),
        sourceUnitId: target.id,
        sourceActionSeq: 0,
        duration: 24,
      },
      catalog,
    ).newState;
    state = applyStatus(
      state,
      {
        targetId: target.id,
        typeId: statusTypeId('dont_move'),
        sourceUnitId: target.id,
        sourceActionSeq: 1,
        duration: 24,
      },
      catalog,
    ).newState;

    const turnStart: Action = {
      type: 'turn_start',
      sequenceNumber: 2,
      source: 'system',
      timestamp: { tick: 0, ct: 0 },
      seed: 0,
      chainDepth: 0,
      isReaction: false,
      payload: { unitId: target.id },
    };
    const reduced = reduceTurnStart(state, turnStart, catalog);
    // Count emitted status_ticks per typeId.
    const tickEmissions = reduced.generatedActions.filter((a) => a.type === 'status_tick');
    const daTicks = tickEmissions.filter(
      (a) => a.type === 'status_tick' && a.payload.statusTypeId === statusTypeId('dont_act'),
    );
    const dmTicks = tickEmissions.filter(
      (a) => a.type === 'status_tick' && a.payload.statusTypeId === statusTypeId('dont_move'),
    );
    expect(daTicks).toHaveLength(1);
    expect(dmTicks).toHaveLength(1);
  });
});

// ===== Bug 3 (Fire Embrace stacking) — investigation =====

describe('Fire Embrace stacking from same caster on same target', () => {
  const catalog = loadDefaultCatalog();

  it('two same-caster pa_up applications STACK_ADDITIVE merge to magnitude 2 / stacks 2', () => {
    // Pin the engine behavior: STACK_ADDITIVE merges into the head with
    // summed magnitude and incremented stacks. If the playtest says the
    // second cast had no effect, either (a) the second cast never fired
    // (validation / target picker), or (b) the cast fired but the chance
    // roll missed, or (c) UI display is hiding the change.
    const caster = makeUnit({ id: 'caster', spd: 10, ma: 5, hp: 100 });
    const target = makeUnit({ id: 'target', spd: 10, pa: 5, hp: 100 });
    let state = makeGameState({ units: [caster, target] });
    state = applyStatus(
      state,
      {
        targetId: target.id,
        typeId: statusTypeId('pa_up'),
        sourceUnitId: caster.id,
        sourceActionSeq: 0,
        magnitude: 1,
      },
      catalog,
    ).newState;
    state = applyStatus(
      state,
      {
        targetId: target.id,
        typeId: statusTypeId('pa_up'),
        sourceUnitId: caster.id, // SAME caster
        sourceActionSeq: 1,
        magnitude: 1,
      },
      catalog,
    ).newState;
    const t = state.units.get(target.id)!;
    const inst = t.statuses.find((s) => s.typeId === statusTypeId('pa_up'))!;
    expect(inst.magnitude).toBe(2);
    expect(inst.stacks).toBe(2);
    const pa = runModifyStatQuery(state, catalog, {
      unit: t,
      statName: 'pa',
      baseValue: t.baseStats.pa,
    });
    expect(pa).toBe(7); // 5 base + 2 from the merged instance
  });

  it('different casters produce identical merged shape (magnitude 2 / stacks 2)', () => {
    // The user reported "if hit by two different casters, it can benefit
    // twice." Pin that the engine does not in fact behave differently
    // between same-caster and different-caster paths — so the playtest
    // "different casters works" observation may itself be a misread.
    const casterA = makeUnit({ id: 'a', spd: 10, ma: 5, hp: 100 });
    const casterB = makeUnit({ id: 'b', spd: 10, ma: 5, hp: 100 });
    const target = makeUnit({ id: 'target', spd: 10, pa: 5, hp: 100 });
    let state = makeGameState({ units: [casterA, casterB, target] });
    state = applyStatus(
      state,
      {
        targetId: target.id,
        typeId: statusTypeId('pa_up'),
        sourceUnitId: casterA.id,
        sourceActionSeq: 0,
        magnitude: 1,
      },
      catalog,
    ).newState;
    state = applyStatus(
      state,
      {
        targetId: target.id,
        typeId: statusTypeId('pa_up'),
        sourceUnitId: casterB.id, // DIFFERENT caster
        sourceActionSeq: 1,
        magnitude: 1,
      },
      catalog,
    ).newState;
    const t = state.units.get(target.id)!;
    const insts = t.statuses.filter((s) => s.typeId === statusTypeId('pa_up'));
    expect(insts).toHaveLength(1); // STACK_ADDITIVE merges
    expect(insts[0]!.magnitude).toBe(2);
    expect(insts[0]!.stacks).toBe(2);
  });

  it('fire_embrace ability spec carries pa_up + ma_up linkRoll, both STACK_ADDITIVE typed', () => {
    // Sanity check the content shape so the playtest hypothesis is
    // grounded in the actual ability definition.
    const fe = catalog.getAbility(abilityId('fire_embrace'));
    if (fe.kind !== 'active') throw new Error('expected active');
    const effects = fe.effects.statusEffects;
    expect(effects).toBeDefined();
    expect(effects!).toHaveLength(2);
    expect(effects![0]!.typeId).toBe(statusTypeId('pa_up'));
    expect(effects![1]!.typeId).toBe(statusTypeId('ma_up'));
    expect(effects![1]!.linkRoll).toBe(true);
    expect(catalog.getStatusType(statusTypeId('pa_up')).stackingRule).toBe('STACK_ADDITIVE');
    expect(catalog.getStatusType(statusTypeId('ma_up')).stackingRule).toBe('STACK_ADDITIVE');
    // Suppress unused-warning
    void unitId;
  });
});

// ===== unit_or_tile targeting (post-S38 FFT-canonical pin-mode toggle) =====

describe('unit_or_tile targeting accepts both payload shapes', () => {
  const catalog = loadDefaultCatalog();

  it('fire_embrace is now unit_or_tile (converted from single_unit in this session)', () => {
    const fe = catalog.getAbility(abilityId('fire_embrace'));
    if (fe.kind !== 'active') throw new Error('expected active');
    expect(fe.targeting.kind).toBe('unit_or_tile');
  });

  it('all post-S38 converted charged abilities are unit_or_tile', () => {
    // Pin the conversion list so an accidental revert is caught by CI.
    const expected: string[] = [
      'brine',
      'earth_blessing',
      'earth_curse',
      'earth_strike',
      'fire_embrace',
      'fire_strike',
      'lightning_strike',
      'magnetic_mark',
      'spark',
      'static_embrace',
      'storm_caller',
      'tide_surge',
      'water_strike',
    ];
    for (const name of expected) {
      const a = catalog.getAbility(abilityId(name));
      if (a.kind !== 'active') throw new Error(`expected active: ${name}`);
      expect(a.targeting.kind).toBe('unit_or_tile');
      expect(a.actionSpeed).toBeGreaterThan(0); // all are charged
    }
  });
});

