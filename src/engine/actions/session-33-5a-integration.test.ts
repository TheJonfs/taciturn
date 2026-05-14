// Session 33.5A integration tests — post-state absolutes generalized.
//
// ADR-0074 closed the "UI consumer reconstructs an absolute post-state
// value by arithmetic on a magnitude delta" gap for HP on ability
// per-target results (`hpAfter`). Session 33.5A extends the same
// principle: every engine outcome that moves HP or MP now reports the
// applied *absolute* alongside the magnitude. This file covers the
// reducer-side population of the new fields from committed `workingState`:
//
//   B1 — `UseAbilityOutcome.mpAfter` (instant cast + charged-cast commit)
//        `ChargedActionResolveOutcome.mpAfter` (caster MP at resolve)
//        `SystemMpDrainOutcome.sourceMpAfter` / `targetMpAfter`
//   B2 — `SystemDamageOutcome.hpAfter` / `SystemHealOutcome.hpAfter`,
//        including the engine-clamped overkill case and the gated
//        KO'd-target paths (which populate the *unchanged* value).

import { describe, expect, it } from 'vitest';
import {
  abilityId,
  bucketId,
  statusHook,
  statusTypeId,
  type ActiveAbilityDefinition,
  type ActionEnvelope,
  type DamageTag,
  type Unit,
} from '@engine/index.ts';
import { createCatalog, type StatusEffectType } from '../catalog/index.ts';
import { defaultTestRulesets } from '../catalog/test-fixtures.ts';
import { makeKnight } from '../abilities/test-fixtures.ts';
import {
  activeTurnFor,
  makeChargedAction,
  makeGameState,
  makeUnit,
} from '../ct/test-fixtures.ts';
import {
  reduceChargedActionResolve,
  reduceSystemDamage,
  reduceSystemHeal,
  reduceSystemMpDrain,
  reduceUseAbility,
} from './reducers.ts';

// A bolt-like magical damage spell. `actionSpeed` / `mpCost` vary per
// test so the same fixture covers the instant and charged paths.
function boltSpell(args: { actionSpeed?: number; mpCost?: number } = {}): ActiveAbilityDefinition {
  return {
    id: abilityId('test_bolt'),
    name: 'Test Bolt',
    kind: 'active',
    bucket: bucketId('first_action'),
    baseCost: 1,
    availability: 'hidden',
    targeting: { kind: 'single_unit', range: { horizontal: 4, vertical: 3 } },
    actionSpeed: args.actionSpeed ?? 0,
    mpCost: args.mpCost ?? 0,
    effects: {
      damage: {
        tags: ['magical'] as DamageTag[],
        power_coefficient: 4,
        variance: { min: 1, max: 1 },
      },
    },
  };
}

// The default test ruleset names `charging` as its charged-action
// status; `commitCharged` applies it, so the catalog must carry the type.
function chargingType(): StatusEffectType {
  return {
    id: statusTypeId('charging'),
    name: 'Charging',
    tags: ['neutral'],
    durationMode: 'conditional',
    stackingRule: 'REJECT',
    hooks: [
      statusHook('queryTurnSkipped', () => ({ reason: 'charging', suppressStatusTicks: false })),
    ],
  };
}

function catalogWith(abilities: ActiveAbilityDefinition[]) {
  return createCatalog({
    statusTypes: [chargingType()],
    abilities,
    commandSets: [],
    classes: [makeKnight()],
    items: [],
    rulesets: defaultTestRulesets,
  });
}

const ENVELOPE: ActionEnvelope = {
  sequenceNumber: 1,
  source: 'system',
  timestamp: { tick: 0, ct: 0 },
  seed: 42,
  chainDepth: 0,
  isReaction: false,
};

// ===========================================================================
// B1 — MP post-state absolutes
// ===========================================================================

describe('Session 33.5A B1 — caster MP absolute on UseAbilityOutcome', () => {
  it('an instant cast records mpAfter as the caster MP post-deduction', () => {
    const bolt = boltSpell({ mpCost: 8 });
    const cat = catalogWith([bolt]);
    const caster = makeUnit({ id: 'a', spd: 10, ma: 14, mp: 30, maxMpBase: 50 });
    const target = makeUnit({ id: 't', spd: 10, hp: 100, maxHpBase: 100 });
    const state = makeGameState({ units: [caster, target], turnState: activeTurnFor(caster.id) });
    const result = reduceUseAbility(
      state,
      {
        ...ENVELOPE,
        actorId: caster.id,
        type: 'use_ability',
        payload: { abilityId: bolt.id, target: { kind: 'unit', unitId: target.id } },
      },
      cat,
    );
    expect(result.outcome.mpSpent).toBe(8);
    // The absolute, not `30 - mpSpent` left to the consumer to compute.
    expect(result.outcome.mpAfter).toBe(22);
    expect(result.newState.units.get(caster.id)!.vitals.mp).toBe(22);
  });

  it('a charged-cast commit records mpAfter — MP is deducted up front', () => {
    const bolt = boltSpell({ mpCost: 8, actionSpeed: 25 });
    const cat = catalogWith([bolt]);
    const caster = makeUnit({ id: 'a', spd: 10, ma: 14, mp: 30, maxMpBase: 50 });
    const target = makeUnit({ id: 't', spd: 10, hp: 100, maxHpBase: 100 });
    const state = makeGameState({ units: [caster, target], turnState: activeTurnFor(caster.id) });
    const result = reduceUseAbility(
      state,
      {
        ...ENVELOPE,
        actorId: caster.id,
        type: 'use_ability',
        payload: { abilityId: bolt.id, target: { kind: 'unit', unitId: target.id } },
      },
      cat,
    );
    // Charged path: chargedActionId set, per-target results empty, but the
    // MP cost was still paid at this commit — mpAfter reflects it.
    expect(result.outcome.chargedActionId).toBeDefined();
    expect(result.outcome.mpSpent).toBe(8);
    expect(result.outcome.mpAfter).toBe(22);
  });
});

describe('Session 33.5A B1 — caster MP absolute on ChargedActionResolveOutcome', () => {
  it('the resolve records mpAfter as the caster MP (unchanged from the commit-time deduction)', () => {
    const bolt = boltSpell({ mpCost: 8, actionSpeed: 25 });
    const cat = catalogWith([bolt]);
    // Caster MP already reflects the commit-time deduction (30 - 8).
    const caster = makeUnit({ id: 'a', spd: 10, ma: 14, mp: 22, maxMpBase: 50 });
    const ca = makeChargedAction({ id: 'ca1', speed: 25, casterId: caster.id, abilityId: 'test_bolt' });
    const state = makeGameState({ units: [caster], chargedActions: [ca] });
    const result = reduceChargedActionResolve(
      state,
      {
        ...ENVELOPE,
        type: 'charged_action_resolve',
        payload: { chargedActionId: ca.id },
      },
      cat,
    );
    // MP did not move at resolve; mpAfter still anchors the renderer to truth.
    expect(result.outcome.mpAfter).toBe(22);
  });
});

describe('Session 33.5A B1 — MP absolutes on SystemMpDrainOutcome', () => {
  function drainAction(source: Unit, target: Unit, amount: number) {
    return {
      ...ENVELOPE,
      type: 'system_mp_drain' as const,
      payload: { source: source.id, target: target.id, amount },
    };
  }

  it('a transfer records both ends post-state from committed state', () => {
    const cat = catalogWith([]);
    const src = makeUnit({ id: 'src', spd: 10, mp: 10, maxMpBase: 100 });
    const tgt = makeUnit({ id: 'tgt', spd: 10, team: 'team_b', mp: 50 });
    const state = makeGameState({ units: [src, tgt] });
    const result = reduceSystemMpDrain(state, drainAction(src, tgt, 8), cat);
    expect(result.outcome.sourceMpAfter).toBe(18);
    expect(result.outcome.targetMpAfter).toBe(42);
    expect(result.newState.units.get(src.id)!.vitals.mp).toBe(18);
    expect(result.newState.units.get(tgt.id)!.vitals.mp).toBe(42);
  });

  it('the gated all-zero path still reports the unchanged absolutes', () => {
    // Target has 0 MP — nothing to transfer. The outcome still carries
    // both absolutes so the renderer settles from truth, not arithmetic.
    const cat = catalogWith([]);
    const src = makeUnit({ id: 'src', spd: 10, mp: 25, maxMpBase: 100 });
    const tgt = makeUnit({ id: 'tgt', spd: 10, team: 'team_b', mp: 0 });
    const state = makeGameState({ units: [src, tgt] });
    const result = reduceSystemMpDrain(state, drainAction(src, tgt, 8), cat);
    expect(result.outcome.targetApplied).toBe(0);
    expect(result.outcome.sourceApplied).toBe(0);
    expect(result.outcome.sourceMpAfter).toBe(25);
    expect(result.outcome.targetMpAfter).toBe(0);
  });

  it('a missing end reports the present end and omits the absent one', () => {
    const cat = catalogWith([]);
    const src = makeUnit({ id: 'src', spd: 10, mp: 25, maxMpBase: 100 });
    const tgt = makeUnit({ id: 'tgt', spd: 10, team: 'team_b', mp: 50 });
    const state = makeGameState({ units: [src] }); // tgt not in state
    const result = reduceSystemMpDrain(state, drainAction(src, tgt, 8), cat);
    expect(result.outcome.sourceMpAfter).toBe(25);
    expect(result.outcome.targetMpAfter).toBeUndefined();
  });
});

// ===========================================================================
// B2 — HP post-state absolutes on system damage / heal
// ===========================================================================

describe('Session 33.5A B2 — hpAfter on SystemDamageOutcome', () => {
  function damageAction(target: Unit, amount: number) {
    return {
      ...ENVELOPE,
      type: 'system_damage' as const,
      payload: {
        targetId: target.id,
        amount,
        tags: [] as DamageTag[],
        source: { kind: 'falling' as const, unitId: target.id, dropDistance: 3 },
      },
    };
  }

  it('an ordinary tick records hpAfter as the post-damage HP', () => {
    const cat = catalogWith([]);
    const target = makeUnit({ id: 't', spd: 10, hp: 80, maxHpBase: 100 });
    const state = makeGameState({ units: [target] });
    const result = reduceSystemDamage(state, damageAction(target, 30), cat);
    expect(result.outcome.applied).toBe(30);
    expect(result.outcome.hpAfter).toBe(50);
    expect(result.newState.units.get(target.id)!.vitals.hp).toBe(50);
  });

  it('an overkill tick reports hpAfter: 0 — engine-clamped, not the negative delta', () => {
    const cat = catalogWith([]);
    const target = makeUnit({ id: 't', spd: 10, hp: 4, maxHpBase: 100 });
    const state = makeGameState({ units: [target] });
    const result = reduceSystemDamage(state, damageAction(target, 133), cat);
    // `applied` is the engine-floored delta (4), `hpAfter` the clamped absolute.
    expect(result.outcome.applied).toBe(4);
    expect(result.outcome.hpAfter).toBe(0);
  });

  it("a tick on an already-KO'd target reports the unchanged hpAfter", () => {
    const cat = catalogWith([]);
    const koTarget = makeUnit({ id: 't', spd: 10, hp: 0, maxHpBase: 100 });
    const state = makeGameState({ units: [koTarget] });
    const result = reduceSystemDamage(state, damageAction(koTarget, 50), cat);
    expect(result.outcome.applied).toBe(0);
    expect(result.outcome.hpAfter).toBe(0);
  });
});

describe('Session 33.5A B2 — hpAfter on SystemHealOutcome', () => {
  function healAction(target: Unit, amount: number) {
    return {
      ...ENVELOPE,
      type: 'system_heal' as const,
      payload: {
        targetId: target.id,
        amount,
        tags: ['healing'] as DamageTag[],
        source: {
          kind: 'status_tick' as const,
          statusTypeId: statusTypeId('regen'),
          unitId: target.id,
        },
      },
    };
  }

  it('an ordinary regen tick records hpAfter as the post-heal HP', () => {
    const cat = catalogWith([]);
    const target = makeUnit({ id: 't', spd: 10, hp: 60, maxHpBase: 100 });
    const state = makeGameState({ units: [target] });
    const result = reduceSystemHeal(state, healAction(target, 25), cat);
    expect(result.outcome.applied).toBe(25);
    expect(result.outcome.hpAfter).toBe(85);
    expect(result.newState.units.get(target.id)!.vitals.hp).toBe(85);
  });

  it("a heal on a KO'd target is gated — hpAfter reports the unchanged 0", () => {
    const cat = catalogWith([]);
    const koTarget = makeUnit({ id: 't', spd: 10, hp: 0, maxHpBase: 100 });
    const state = makeGameState({ units: [koTarget] });
    const result = reduceSystemHeal(state, healAction(koTarget, 25), cat);
    expect(result.outcome.applied).toBe(0);
    expect(result.outcome.hpAfter).toBe(0);
    expect(result.newState.units.get(koTarget.id)!.vitals.hp).toBe(0);
  });
});
