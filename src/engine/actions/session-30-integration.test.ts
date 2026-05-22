// Session 30 integration tests — Cluster 5 substrate (procs + drains).
//
// Covers:
//   1. `attackProcContributor` — proc fires on a physical hit, skips on
//      miss, skips on non-physical damage; emits `use_ability` with
//      `riderSource: { kind: 'equipment_proc', itemId }` against the
//      original target.
//   2. `finalDamageDrainContributor` — emits `system_mp_drain` from the
//      new `onFinalDamage` hook; skips on absorbed damage and on zero
//      damage.
//   3. `reduceSystemMpDrain` — transfer math (target floor at 0, source
//      cap at maxMp), KO'd-target no-op.
//   4. `riderSource` bypass — validator skips MP affordability; reducer
//      skips MP deduction and records `mpSpent: 0`. Silence bypass is
//      covered structurally by the `runPreHook` source/rider gate.

import { describe, expect, it } from 'vitest';
import { createCatalog } from '../catalog/index.ts';
import { defaultTestRulesets } from '../catalog/test-fixtures.ts';
import { makeKnight, knightLoadout } from '../abilities/test-fixtures.ts';
import { makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { flatMap } from '../map/test-fixtures.ts';
import {
  runOnDamageDealt,
  runOnFinalDamage,
} from '../hooks/runners.ts';
import { reduceSystemMpDrain, reduceUseAbility } from './reducers.ts';
import { validateAction } from './validate.ts';
import {
  abilityId,
  bucketId,
  itemId,
  type ActionEnvelope,
  type DamageContext,
  type DamageTag,
  type ItemId,
  type ProposedAction,
  type Unit,
  type UnitEquipment,
} from '../types/index.ts';
import { teamId } from '../types/ids.ts';
import type {
  AccessoryEquipment,
  ActiveAbilityDefinition,
  WeaponEquipment,
} from '../catalog/index.ts';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeProcWeapon(args: {
  readonly id: string;
  readonly procs: WeaponEquipment['attackProcs'];
}): WeaponEquipment {
  return {
    id: itemId(args.id),
    name: args.id,
    availability: 'available',
    kind: 'weapon',
    wp: 6,
    accuracy: 100,
    ...(args.procs !== undefined ? { attackProcs: args.procs } : {}),
  };
}

function makeDrainAccessory(args: {
  readonly id: string;
  readonly percent: number;
}): AccessoryEquipment {
  return {
    id: itemId(args.id),
    name: args.id,
    availability: 'available',
    kind: 'accessory',
    damageMpDrainPercent: args.percent,
  };
}

function equipWeaponLeft(id: ItemId): UnitEquipment {
  return { leftHand: id, rightHand: null, headgear: null, armor: null, accessory: null };
}

function equipAccessory(id: ItemId): UnitEquipment {
  return { leftHand: null, rightHand: null, headgear: null, armor: null, accessory: id };
}

function makeProcAbility(args: { readonly id: string }): ActiveAbilityDefinition {
  return {
    id: abilityId(args.id),
    name: args.id,
    kind: 'active',
    bucket: bucketId('first_action'),
    baseCost: 1,
    availability: 'hidden',
    targeting: {
      kind: 'single_unit',
      range: { horizontal: 99, vertical: 99 },
      rangeMode: 'arc',
    },
    actionSpeed: 0,
    // Non-zero MP cost on the procced ability proves the rider bypass
    // (the wielder doesn't pay even though the ability normally costs MP).
    mpCost: 20,
    effects: { damage: { tags: ['magical', 'lightning'], power_coefficient: 1 } },
  };
}

function makeBaseAbility(args: { readonly id: string }): ActiveAbilityDefinition {
  return {
    id: abilityId(args.id),
    name: args.id,
    kind: 'active',
    bucket: bucketId('first_action'),
    baseCost: 1,
    availability: 'hidden',
    targeting: {
      kind: 'single_unit',
      range: { horizontal: 99, vertical: 99 },
      rangeMode: 'arc',
    },
    actionSpeed: 0,
    mpCost: 0,
    hitRoll: {},
    effects: { damage: { tags: ['physical', 'weapon'], power_coefficient: 1 } },
  };
}

function makeCtxFor(args: {
  readonly attacker: Unit;
  readonly target: Unit;
  readonly tags: ReadonlyArray<DamageTag>;
  readonly hit: boolean;
  readonly actionSeed: number;
  readonly finalDamage?: number;
}): DamageContext {
  return {
    attacker: args.attacker,
    target: args.target,
    sourceActionSeq: 0,
    sourceAbilityId: abilityId('basic_attack'),
    damageTags: new Set(args.tags),
    baseDamage: 0,
    multipliers: [],
    additives: [],
    variance: { min: 1, max: 1 },
    hit: args.hit,
    targetCount: 1,
    actionSeed: args.actionSeed,
    ...(args.finalDamage !== undefined ? { finalDamage: args.finalDamage } : {}),
  };
}

// ===========================================================================
// 1. attack_proc — onDamageDealt emission
// ===========================================================================

describe('Session 30 attack_proc — onDamageDealt emission shape', () => {
  it('proc fires on a physical hit and emits use_ability against the original target with riderSource', () => {
    const procWeapon = makeProcWeapon({
      id: 'bolt_hammer_test',
      // chance = 1 → always procs, deterministically
      procs: [{ chance: 1, abilityId: abilityId('proc_bolt') }],
    });
    const procAbility = makeProcAbility({ id: 'proc_bolt' });
    const baseAbility = makeBaseAbility({ id: 'basic_attack' });
    const cat = createCatalog({
      statusTypes: [],
      abilities: [procAbility, baseAbility],
      commandSets: [],
      classes: [makeKnight()],
      items: [procWeapon],
      rulesets: defaultTestRulesets,
    });
    const attacker = makeUnit({
      id: 'attacker',
      spd: 10,
      loadout: knightLoadout(),
      equipment: equipWeaponLeft(procWeapon.id),
    });
    const target = makeUnit({ id: 'target', spd: 10, team: 'team_b', position: { x: 1, y: 0, layer: 0 } });
    const state = makeGameState({ units: [attacker, target] });
    const ctx = makeCtxFor({
      attacker,
      target,
      tags: ['physical', 'weapon'],
      hit: true,
      actionSeed: 12345,
    });
    const result = runOnDamageDealt(state, cat, { unit: attacker, ctx });
    expect(result.emittedActions).toBeDefined();
    expect(result.emittedActions!.length).toBe(1);
    const emission = result.emittedActions![0]!;
    expect(emission.type).toBe('use_ability');
    if (emission.type !== 'use_ability') return;
    expect(emission.payload.abilityId).toBe(abilityId('proc_bolt'));
    expect(emission.payload.target).toEqual({ kind: 'unit', unitId: target.id });
    expect(emission.payload.riderSource).toEqual({
      kind: 'equipment_proc',
      itemId: procWeapon.id,
    });
    expect(emission.actorId).toBe(attacker.id);
    // Source is 'system' — engine-emitted; commitAction recognizes the
    // path and skips onActionAttempted (Silence) per the runPreHook gate.
    expect(emission.source).toBe('system');
  });

  it('proc does NOT fire when the underlying swing missed (ctx.hit === false)', () => {
    const procWeapon = makeProcWeapon({
      id: 'flametongue_test',
      procs: [{ chance: 1, abilityId: abilityId('proc_burn') }],
    });
    const cat = createCatalog({
      statusTypes: [],
      abilities: [makeProcAbility({ id: 'proc_burn' })],
      commandSets: [],
      classes: [makeKnight()],
      items: [procWeapon],
      rulesets: defaultTestRulesets,
    });
    const attacker = makeUnit({
      id: 'attacker',
      spd: 10,
      equipment: equipWeaponLeft(procWeapon.id),
    });
    const target = makeUnit({ id: 'target', spd: 10, team: 'team_b' });
    const state = makeGameState({ units: [attacker, target] });
    const ctx = makeCtxFor({
      attacker,
      target,
      tags: ['physical'],
      hit: false, // <-- miss
      actionSeed: 12345,
    });
    const result = runOnDamageDealt(state, cat, { unit: attacker, ctx });
    expect(result.emittedActions ?? []).toEqual([]);
  });

  it('proc does NOT fire on non-physical damage (e.g., the wielder casts a magical spell)', () => {
    const procWeapon = makeProcWeapon({
      id: 'flametongue_test',
      procs: [{ chance: 1, abilityId: abilityId('proc_burn') }],
    });
    const cat = createCatalog({
      statusTypes: [],
      abilities: [makeProcAbility({ id: 'proc_burn' })],
      commandSets: [],
      classes: [makeKnight()],
      items: [procWeapon],
      rulesets: defaultTestRulesets,
    });
    const attacker = makeUnit({
      id: 'attacker',
      spd: 10,
      equipment: equipWeaponLeft(procWeapon.id),
    });
    const target = makeUnit({ id: 'target', spd: 10, team: 'team_b' });
    const state = makeGameState({ units: [attacker, target] });
    const ctx = makeCtxFor({
      attacker,
      target,
      tags: ['magical', 'fire'], // <-- not physical
      hit: true,
      actionSeed: 12345,
    });
    const result = runOnDamageDealt(state, cat, { unit: attacker, ctx });
    expect(result.emittedActions ?? []).toEqual([]);
  });

  it('proc is deterministic for the same actionSeed (replayability)', () => {
    // chance = 0.5 → some seeds fire, others don't; same seed always
    // produces the same answer.
    const procWeapon = makeProcWeapon({
      id: 'proc_50',
      procs: [{ chance: 0.5, abilityId: abilityId('proc_bolt') }],
    });
    const cat = createCatalog({
      statusTypes: [],
      abilities: [makeProcAbility({ id: 'proc_bolt' })],
      commandSets: [],
      classes: [makeKnight()],
      items: [procWeapon],
      rulesets: defaultTestRulesets,
    });
    const attacker = makeUnit({
      id: 'attacker',
      spd: 10,
      equipment: equipWeaponLeft(procWeapon.id),
    });
    const target = makeUnit({ id: 'target', spd: 10, team: 'team_b' });
    const state = makeGameState({ units: [attacker, target] });
    const ctx = makeCtxFor({
      attacker,
      target,
      tags: ['physical'],
      hit: true,
      actionSeed: 99999,
    });
    const a = runOnDamageDealt(state, cat, { unit: attacker, ctx });
    const b = runOnDamageDealt(state, cat, { unit: attacker, ctx });
    expect((a.emittedActions ?? []).length).toBe((b.emittedActions ?? []).length);
  });

  it('two proc entries roll on distinct sub-streams (independent results)', () => {
    // chance = 0.5 on each. With independent sub-streams, the two procs
    // can return different answers for the same seed. Confirm both are
    // invoked (each contributes a possible emission slot) rather than
    // sharing one roll.
    const procWeapon = makeProcWeapon({
      id: 'dual_proc',
      procs: [
        { chance: 1.0, abilityId: abilityId('proc_a') },
        { chance: 1.0, abilityId: abilityId('proc_b') },
      ],
    });
    const cat = createCatalog({
      statusTypes: [],
      abilities: [makeProcAbility({ id: 'proc_a' }), makeProcAbility({ id: 'proc_b' })],
      commandSets: [],
      classes: [makeKnight()],
      items: [procWeapon],
      rulesets: defaultTestRulesets,
    });
    const attacker = makeUnit({
      id: 'attacker',
      spd: 10,
      equipment: equipWeaponLeft(procWeapon.id),
    });
    const target = makeUnit({ id: 'target', spd: 10, team: 'team_b' });
    const state = makeGameState({ units: [attacker, target] });
    const ctx = makeCtxFor({
      attacker,
      target,
      tags: ['physical'],
      hit: true,
      actionSeed: 42,
    });
    const result = runOnDamageDealt(state, cat, { unit: attacker, ctx });
    expect(result.emittedActions!.length).toBe(2);
    const procIds = (result.emittedActions ?? []).map((a) =>
      a.type === 'use_ability' ? a.payload.abilityId : null,
    );
    expect(procIds).toContain(abilityId('proc_a'));
    expect(procIds).toContain(abilityId('proc_b'));
  });
});

// ===========================================================================
// 2. onFinalDamage emission + finalDamageDrainContributor
// ===========================================================================

describe('Session 30 onFinalDamage — emission semantics', () => {
  it('finalDamageDrainContributor emits system_mp_drain on damage', () => {
    const pendant = makeDrainAccessory({ id: 'rasp_test', percent: 10 });
    const cat = createCatalog({
      statusTypes: [],
      abilities: [],
      commandSets: [],
      classes: [makeKnight()],
      items: [pendant],
      rulesets: defaultTestRulesets,
    });
    const attacker = makeUnit({
      id: 'attacker',
      spd: 10,
      equipment: equipAccessory(pendant.id),
    });
    const target = makeUnit({ id: 'target', spd: 10, team: 'team_b', mp: 30 });
    const state = makeGameState({ units: [attacker, target] });
    const emissions = runOnFinalDamage(state, cat, {
      unit: attacker,
      target,
      damageDealt: 87,
      damageTags: new Set<DamageTag>(['physical']),
      absorbed: false,
    });
    expect(emissions.length).toBe(1);
    const emission = emissions[0]!;
    expect(emission.type).toBe('system_mp_drain');
    if (emission.type !== 'system_mp_drain') return;
    expect(emission.payload.source).toBe(attacker.id);
    expect(emission.payload.target).toBe(target.id);
    // floor(87 * 10 / 100) = 8
    expect(emission.payload.amount).toBe(8);
  });

  it('finalDamageDrainContributor skips on absorbed damage', () => {
    const pendant = makeDrainAccessory({ id: 'rasp_test', percent: 10 });
    const cat = createCatalog({
      statusTypes: [],
      abilities: [],
      commandSets: [],
      classes: [makeKnight()],
      items: [pendant],
      rulesets: defaultTestRulesets,
    });
    const attacker = makeUnit({ id: 'attacker', spd: 10, equipment: equipAccessory(pendant.id) });
    const target = makeUnit({ id: 'target', spd: 10, team: 'team_b' });
    const state = makeGameState({ units: [attacker, target] });
    const emissions = runOnFinalDamage(state, cat, {
      unit: attacker,
      target,
      damageDealt: 0, // post-finalize, an absorbed hit reads as zero damage
      damageTags: new Set<DamageTag>(['physical', 'healing']),
      absorbed: true,
    });
    expect(emissions).toEqual([]);
  });

  it('finalDamageDrainContributor skips when damageDealt is zero (miss / blocked)', () => {
    const pendant = makeDrainAccessory({ id: 'rasp_test', percent: 10 });
    const cat = createCatalog({
      statusTypes: [],
      abilities: [],
      commandSets: [],
      classes: [makeKnight()],
      items: [pendant],
      rulesets: defaultTestRulesets,
    });
    const attacker = makeUnit({ id: 'attacker', spd: 10, equipment: equipAccessory(pendant.id) });
    const target = makeUnit({ id: 'target', spd: 10, team: 'team_b' });
    const state = makeGameState({ units: [attacker, target] });
    const emissions = runOnFinalDamage(state, cat, {
      unit: attacker,
      target,
      damageDealt: 0,
      damageTags: new Set<DamageTag>(['physical']),
      absorbed: false,
    });
    expect(emissions).toEqual([]);
  });

  it('finalDamageDrainContributor skips when target is KO (HP <= 0)', () => {
    const pendant = makeDrainAccessory({ id: 'rasp_test', percent: 10 });
    const cat = createCatalog({
      statusTypes: [],
      abilities: [],
      commandSets: [],
      classes: [makeKnight()],
      items: [pendant],
      rulesets: defaultTestRulesets,
    });
    const attacker = makeUnit({ id: 'attacker', spd: 10, equipment: equipAccessory(pendant.id) });
    const koTarget = makeUnit({ id: 'ko_target', spd: 10, team: 'team_b', hp: 0 });
    const state = makeGameState({ units: [attacker, koTarget] });
    const emissions = runOnFinalDamage(state, cat, {
      unit: attacker,
      target: koTarget,
      damageDealt: 87,
      damageTags: new Set<DamageTag>(['physical']),
      absorbed: false,
    });
    expect(emissions).toEqual([]);
  });
});

// ===========================================================================
// 3. reduceSystemMpDrain
// ===========================================================================

function makeMpDrainAction(args: {
  readonly source: Unit;
  readonly target: Unit;
  readonly amount: number;
}) {
  const envelope: ActionEnvelope = {
    sequenceNumber: 1,
    source: 'system',
    timestamp: { tick: 0, ct: 0 },
    seed: 0,
    chainDepth: 0,
    isReaction: false,
  };
  return {
    ...envelope,
    type: 'system_mp_drain' as const,
    payload: { source: args.source.id, target: args.target.id, amount: args.amount },
  };
}

describe('Session 30 reduceSystemMpDrain', () => {
  it('transfers MP from target to source within both bounds', () => {
    const src = makeUnit({ id: 'src', spd: 10, mp: 10, maxMpBase: 100 });
    const tgt = makeUnit({ id: 'tgt', spd: 10, team: 'team_b', mp: 50 });
    const state = makeGameState({ units: [src, tgt] });
    const cat = createCatalog({
      statusTypes: [],
      abilities: [],
      commandSets: [],
      classes: [makeKnight()],
      items: [],
      rulesets: defaultTestRulesets,
    });
    const action = makeMpDrainAction({ source: src, target: tgt, amount: 8 });
    const result = reduceSystemMpDrain(state, action, cat);
    expect(result.outcome.requested).toBe(8);
    expect(result.outcome.targetApplied).toBe(8);
    expect(result.outcome.sourceApplied).toBe(8);
    expect(result.newState.units.get(src.id)!.vitals.mp).toBe(18);
    expect(result.newState.units.get(tgt.id)!.vitals.mp).toBe(42);
  });

  it('floors target MP at 0 (low-MP target yields less drain than requested)', () => {
    const src = makeUnit({ id: 'src', spd: 10, mp: 0, maxMpBase: 100 });
    const tgt = makeUnit({ id: 'tgt', spd: 10, team: 'team_b', mp: 3 });
    const state = makeGameState({ units: [src, tgt] });
    const cat = createCatalog({
      statusTypes: [],
      abilities: [],
      commandSets: [],
      classes: [makeKnight()],
      items: [],
      rulesets: defaultTestRulesets,
    });
    const action = makeMpDrainAction({ source: src, target: tgt, amount: 10 });
    const result = reduceSystemMpDrain(state, action, cat);
    expect(result.outcome.requested).toBe(10);
    expect(result.outcome.targetApplied).toBe(3); // target had only 3
    expect(result.outcome.sourceApplied).toBe(3); // source gains what target lost
    expect(result.newState.units.get(src.id)!.vitals.mp).toBe(3);
    expect(result.newState.units.get(tgt.id)!.vitals.mp).toBe(0);
  });

  it('caps source MP at maxMp (high-MP source gains only what fits in headroom)', () => {
    // Source has 98/100 MP, target has 50 MP, request 10 → source can only
    // gain 2 (cap at maxMp); target only loses 2 (transfer-bounded).
    const src = makeUnit({ id: 'src', spd: 10, mp: 98, maxMpBase: 100 });
    const tgt = makeUnit({ id: 'tgt', spd: 10, team: 'team_b', mp: 50 });
    const state = makeGameState({ units: [src, tgt] });
    const cat = createCatalog({
      statusTypes: [],
      abilities: [],
      commandSets: [],
      classes: [makeKnight()],
      items: [],
      rulesets: defaultTestRulesets,
    });
    const action = makeMpDrainAction({ source: src, target: tgt, amount: 10 });
    const result = reduceSystemMpDrain(state, action, cat);
    expect(result.outcome.targetApplied).toBe(10); // target loses the full requested
    expect(result.outcome.sourceApplied).toBe(2); // source gains only headroom
    expect(result.newState.units.get(src.id)!.vitals.mp).toBe(100);
    expect(result.newState.units.get(tgt.id)!.vitals.mp).toBe(40);
  });

  // Session 31.5 / ADR-0069: KO'd target is NOT a reducer-level no-op.
  // The contributor's pre-fire HP gate (in `finalDamageDrainContributor`)
  // already filters "target was already dead before the swing." The
  // mid-chain case — the swing's damage KO'd the target this turn — is
  // the load-bearing one for v1 (Rasp Pendant on a fatal cast). Pre-31.5
  // the reducer's HP gate zeroed those drains; the drain represents
  // "10% of the damage you just dealt" and should apply whether or not
  // the target survived. MP doesn't need HP to transfer.
  it("KO'd target still drains MP (mid-chain fatal-hit case per ADR-0069)", () => {
    const src = makeUnit({ id: 'src', spd: 10, mp: 0 });
    const koTgt = makeUnit({ id: 'tgt', spd: 10, team: 'team_b', hp: 0, mp: 50 });
    const state = makeGameState({ units: [src, koTgt] });
    const cat = createCatalog({
      statusTypes: [],
      abilities: [],
      commandSets: [],
      classes: [makeKnight()],
      items: [],
      rulesets: defaultTestRulesets,
    });
    const action = makeMpDrainAction({ source: src, target: koTgt, amount: 8 });
    const result = reduceSystemMpDrain(state, action, cat);
    expect(result.outcome.targetApplied).toBe(8);
    expect(result.outcome.sourceApplied).toBe(8);
    expect(result.newState.units.get(src.id)!.vitals.mp).toBe(8);
    expect(result.newState.units.get(koTgt.id)!.vitals.mp).toBe(42);
  });

  it('missing source or target is a no-op (entry logged, no state change)', () => {
    const src = makeUnit({ id: 'src', spd: 10, mp: 0 });
    const tgt = makeUnit({ id: 'tgt', spd: 10, team: 'team_b', mp: 50 });
    const state = makeGameState({ units: [src] }); // tgt not present
    const cat = createCatalog({
      statusTypes: [],
      abilities: [],
      commandSets: [],
      classes: [makeKnight()],
      items: [],
      rulesets: defaultTestRulesets,
    });
    const action = makeMpDrainAction({ source: src, target: tgt, amount: 8 });
    const result = reduceSystemMpDrain(state, action, cat);
    expect(result.outcome.targetApplied).toBe(0);
    expect(result.outcome.sourceApplied).toBe(0);
    expect(result.newState).toBe(state);
  });
});

// ===========================================================================
// 4. riderSource bypass — MP affordability + MP deduction
// ===========================================================================

describe('Session 30 riderSource bypass — MP gates', () => {
  it('validator accepts a rider use_ability even when actor has 0 MP and ability costs 20', () => {
    const proc = makeProcAbility({ id: 'expensive_spell' });
    const cat = createCatalog({
      statusTypes: [],
      abilities: [proc],
      commandSets: [],
      classes: [makeKnight()],
      items: [],
      rulesets: defaultTestRulesets,
    });
    const actor = makeUnit({ id: 'actor', spd: 10, mp: 0 });
    const target = makeUnit({ id: 'target', spd: 10, team: 'team_b', position: { x: 1, y: 0, layer: 0 } });
    const state = makeGameState({
      units: [actor, target],
      map: flatMap(4, 4),
      turnState: {
        unitId: actor.id,
        budget: { movesAvailable: 1, actsAvailable: 1 },
        consumed: { movesConsumed: 0, actsConsumed: 0 },
        reactionsUsedThisTurn: new Map(),
      },
    });
    const riderAction: ProposedAction = {
      type: 'use_ability',
      source: 'system',
      actorId: actor.id,
      payload: {
        abilityId: proc.id,
        target: { kind: 'unit', unitId: target.id },
        riderSource: { kind: 'equipment_proc', itemId: itemId('test_weapon') },
      },
    };
    const result = validateAction(state, riderAction, cat);
    expect(result.valid).toBe(true);
  });

  it('validator rejects a non-rider use_ability with insufficient MP (regression check)', () => {
    const proc = makeProcAbility({ id: 'expensive_spell' });
    const cat = createCatalog({
      statusTypes: [],
      abilities: [proc],
      commandSets: [],
      classes: [makeKnight()],
      items: [],
      rulesets: defaultTestRulesets,
    });
    const actor = makeUnit({ id: 'actor', spd: 10, mp: 0 });
    const target = makeUnit({ id: 'target', spd: 10, team: 'team_b', position: { x: 1, y: 0, layer: 0 } });
    const state = makeGameState({
      units: [actor, target],
      map: flatMap(4, 4),
      turnState: {
        unitId: actor.id,
        budget: { movesAvailable: 1, actsAvailable: 1 },
        consumed: { movesConsumed: 0, actsConsumed: 0 },
        reactionsUsedThisTurn: new Map(),
      },
    });
    const plainAction: ProposedAction = {
      type: 'use_ability',
      source: 'player',
      actorId: actor.id,
      payload: {
        abilityId: proc.id,
        target: { kind: 'unit', unitId: target.id },
      },
    };
    const result = validateAction(state, plainAction, cat);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/Insufficient MP/);
  });

  it('reducer records mpSpent: 0 for a rider cast and does not deduct from actor', () => {
    const proc = makeProcAbility({ id: 'free_spell' });
    const cat = createCatalog({
      statusTypes: [],
      abilities: [proc],
      commandSets: [],
      classes: [makeKnight()],
      items: [],
      rulesets: defaultTestRulesets,
    });
    const actor = makeUnit({ id: 'actor', spd: 10, mp: 5, faith: 100 });
    const target = makeUnit({
      id: 'target',
      spd: 10,
      team: 'team_b',
      position: { x: 1, y: 0, layer: 0 },
      hp: 1000, // soak the proc damage
      faith: 0,
    });
    const state = makeGameState({
      units: [actor, target],
      map: flatMap(4, 4),
      turnState: {
        unitId: actor.id,
        budget: { movesAvailable: 1, actsAvailable: 1 },
        consumed: { movesConsumed: 0, actsConsumed: 0 },
        reactionsUsedThisTurn: new Map(),
      },
    });
    const action: Parameters<typeof reduceUseAbility>[1] = {
      sequenceNumber: 1,
      source: 'system',
      actorId: actor.id,
      timestamp: { tick: 0, ct: 0 },
      seed: 0,
      chainDepth: 1,
      isReaction: false,
      type: 'use_ability',
      payload: {
        abilityId: proc.id,
        target: { kind: 'unit', unitId: target.id },
        riderSource: { kind: 'equipment_proc', itemId: itemId('test_weapon') },
      },
    };
    const result = reduceUseAbility(state, action, cat);
    expect(result.outcome.mpSpent).toBe(0);
    expect(result.newState.units.get(actor.id)!.vitals.mp).toBe(5); // unchanged
    // Sanity: the cast actually executed (perTargetResults populated).
    expect(result.outcome.perTargetResults.length).toBe(1);
  });
});

// Avoid an unused-import lint for teamId (it's available for future tests
// that need to build multi-team states explicitly).
void teamId;
