// Session 31.5 integration tests — regression coverage for the bug fixes
// landed in ADR-0069 and adjacent changes.
//
// Covers:
//   1. Bug 4 — Bolt Hammer's proc gate sees the resolved hit. A missed
//      swing emits no proc; a hit swing emits at the rolled chance.
//      Verified by running the full production pipeline (defaultRuleset's
//      target-stage order: evasion_check → fire_on_damage_dealt → …).
//   2. Bug 3 — Rasp Pendant drains on magical damage. The full pipeline
//      reaches postFinalize for spell casts and emits `system_mp_drain`.
//   3. Bug 3 — mid-chain fatal hit still drains. The reducer's prior
//      `vitals.hp <= 0` short-circuit was dropped (ADR-0069); a target
//      KO'd by the same action's damage still transfers MP.
//   4. Bug 1 — `regen_auto` status displays as "Regen".
//   5. isRiderCast helper consolidation (smoke test).

import { describe, expect, it } from 'vitest';
import { createCatalog } from '../catalog/index.ts';
import { defaultRuleset } from '../../content/rulesets/default.ts';
import { runDamagePipeline } from '../damage/pipeline.ts';
import { defaultDamageHandlers } from '../damage/default-handlers.ts';
import { makeKnight } from '../abilities/test-fixtures.ts';
import { activeTurnFor, makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { flatMap } from '../map/test-fixtures.ts';
import { regenAuto } from '../../content/statuses/regen-auto.ts';
import { isRiderCast } from './payload-helpers.ts';
import { reduceSystemMpDrain, reduceUseAbility } from './reducers.ts';
import {
  abilityId,
  itemId,
  type Action,
  type DamageTag,
  type UnitEquipment,
  type ActionEnvelope,
} from '../types/index.ts';
import { teamId } from '../types/ids.ts';
import type {
  AccessoryEquipment,
  ActiveAbilityDefinition,
  WeaponEquipment,
} from '../catalog/index.ts';

function emptyEquip(): UnitEquipment {
  return { leftHand: null, rightHand: null, headgear: null, armor: null, accessory: null };
}

function magicalSpell(): ActiveAbilityDefinition {
  return {
    id: abilityId('water_strike_test'),
    name: 'Water Strike Test',
    kind: 'active',
    bucket: 'first_action' as unknown as ActiveAbilityDefinition['bucket'],
    availability: 'available' as const,
    cost: { mp: 5 },
    targeting: { kind: 'single_unit', range: { horizontal: 4, vertical: 2 } },
    effects: {
      damage: {
        tags: ['magical', 'water'] as DamageTag[],
        power_coefficient: 8,
        variance: { min: 1, max: 1 },
      },
    },
    actionSpeed: 0,
    aoe: { kind: 'single' },
  } as unknown as ActiveAbilityDefinition;
}

function physicalAttack(opts?: { readonly accuracy?: number }): ActiveAbilityDefinition {
  return {
    id: abilityId('basic_swing_test'),
    name: 'Swing Test',
    kind: 'active',
    bucket: 'first_action' as unknown as ActiveAbilityDefinition['bucket'],
    availability: 'available' as const,
    cost: { mp: 0 },
    targeting: { kind: 'single_unit', range: { horizontal: 1, vertical: 3 } },
    effects: {
      damage: {
        tags: ['physical', 'weapon'] as DamageTag[],
        power_coefficient: 1,
        variance: { min: 1, max: 1 },
      },
    },
    actionSpeed: 0,
    aoe: { kind: 'single' },
    hitRoll: opts?.accuracy !== undefined ? { accuracy: opts.accuracy } : {},
  } as unknown as ActiveAbilityDefinition;
}

function procTargetAbility(): ActiveAbilityDefinition {
  return {
    id: abilityId('proc_target'),
    name: 'Proc Target',
    kind: 'active',
    bucket: 'first_action' as unknown as ActiveAbilityDefinition['bucket'],
    availability: 'hidden',
    cost: { mp: 0 },
    targeting: { kind: 'single_unit', range: { horizontal: 1, vertical: 1 } },
    effects: {
      damage: {
        tags: ['magical'] as DamageTag[],
        power_coefficient: 1,
        variance: { min: 1, max: 1 },
      },
    },
    actionSpeed: 0,
    aoe: { kind: 'single' },
  } as unknown as ActiveAbilityDefinition;
}

function procWeapon(args: { readonly accuracy: number }): WeaponEquipment {
  return {
    id: itemId('bolt_hammer_test'),
    name: 'Bolt Test',
    availability: 'available',
    kind: 'weapon',
    wp: 10,
    accuracy: args.accuracy,
    attackProcs: [{ chance: 1, abilityId: abilityId('proc_target') }],
  };
}

function rsAccessory(): AccessoryEquipment {
  return {
    id: itemId('rasp_pendant_test'),
    name: 'Rasp Test',
    availability: 'available',
    kind: 'accessory',
    damageMpDrainPercent: 10,
  };
}

describe('Session 31.5 — bug 4 (proc gate sees resolved hit)', () => {
  it('Bolt Hammer proc does NOT fire on a missed physical swing (full pipeline)', () => {
    const weapon = procWeapon({ accuracy: 0 }); // 0 accuracy → always miss
    const swing = physicalAttack();
    const cat = createCatalog({
      statusTypes: [],
      abilities: [swing, procTargetAbility()],
      commandSets: [],
      classes: [makeKnight()],
      items: [weapon],
      rulesets: [defaultRuleset],
    });
    const attacker = makeUnit({
      id: 'a',
      spd: 10,
      pa: 8,
      brave: 70,
      equipment: { ...emptyEquip(), leftHand: weapon.id },
    });
    const target = makeUnit({ id: 't', spd: 10, position: { x: 1, y: 0, layer: 0 } });
    const state = makeGameState({ units: [attacker, target] });
    const ctx = runDamagePipeline({
      state,
      catalog: cat,
      attacker,
      target,
      ability: swing,
      sourceActionSeq: 0,
      seed: 42,
      registry: defaultDamageHandlers,
    });
    expect(ctx.hit).toBe(false);
    const procs = (ctx.emittedActions ?? []).filter((a) => a.type === 'use_ability');
    expect(procs).toEqual([]);
  });

  it('Bolt Hammer proc DOES fire on a landed physical swing', () => {
    const weapon = procWeapon({ accuracy: 100 }); // always hit
    const swing = physicalAttack();
    const cat = createCatalog({
      statusTypes: [],
      abilities: [swing, procTargetAbility()],
      commandSets: [],
      classes: [makeKnight()],
      items: [weapon],
      rulesets: [defaultRuleset],
    });
    const attacker = makeUnit({
      id: 'a',
      spd: 10,
      pa: 8,
      brave: 70,
      equipment: { ...emptyEquip(), leftHand: weapon.id },
    });
    const target = makeUnit({ id: 't', spd: 10, position: { x: 1, y: 0, layer: 0 } });
    const state = makeGameState({ units: [attacker, target] });
    const ctx = runDamagePipeline({
      state,
      catalog: cat,
      attacker,
      target,
      ability: swing,
      sourceActionSeq: 0,
      seed: 42,
      registry: defaultDamageHandlers,
    });
    expect(ctx.hit).toBe(true);
    const procs = (ctx.emittedActions ?? []).filter((a) => a.type === 'use_ability');
    expect(procs.length).toBe(1);
  });
});

describe('Session 31.5 — bug 3 (Rasp Pendant on magical damage + mid-chain fatal hit)', () => {
  it('Rasp Pendant emits system_mp_drain on a magical cast (full pipeline)', () => {
    const pendant = rsAccessory();
    const spell = magicalSpell();
    const cat = createCatalog({
      statusTypes: [],
      abilities: [spell],
      commandSets: [],
      classes: [makeKnight()],
      items: [pendant],
      rulesets: [defaultRuleset],
    });
    const attacker = makeUnit({
      id: 'a',
      spd: 10,
      ma: 14,
      faith: 100,
      equipment: { ...emptyEquip(), accessory: pendant.id },
    });
    const target = makeUnit({ id: 't', spd: 10, mp: 30, faith: 100 });
    const state = makeGameState({ units: [attacker, target] });
    const ctx = runDamagePipeline({
      state,
      catalog: cat,
      attacker,
      target,
      ability: spell,
      sourceActionSeq: 0,
      seed: 42,
      registry: defaultDamageHandlers,
    });
    expect(ctx.finalDamage).toBeGreaterThan(0);
    const drains = (ctx.emittedActions ?? []).filter((a) => a.type === 'system_mp_drain');
    expect(drains.length).toBe(1);
    if (drains[0]!.type !== 'system_mp_drain') return;
    // 10% of finalDamage, floored.
    expect(drains[0]!.payload.amount).toBe(Math.floor((ctx.finalDamage ?? 0) * 10 / 100));
  });

  it('mid-chain fatal hit: drain still transfers MP on a KO-by-this-hit target', () => {
    // Simulates the chain ordering: attacker's spell sets target HP to 0
    // (post-damage state), drain action reduces against that state.
    // The reducer must NOT short-circuit on target.hp = 0.
    const cat = createCatalog({
      statusTypes: [],
      abilities: [],
      commandSets: [],
      classes: [makeKnight()],
      items: [],
      rulesets: [defaultRuleset],
    });
    const source = makeUnit({ id: 'src', spd: 10, mp: 0 });
    // Target is KO'd (HP 0) but still carries MP — the mid-chain scenario.
    const target = makeUnit({ id: 'tgt', spd: 10, team: 'team_b', hp: 0, mp: 50 });
    const state = makeGameState({ units: [source, target] });
    const envelope: ActionEnvelope = {
      sequenceNumber: 1,
      source: 'system',
      timestamp: { tick: 0, ct: 0 },
      seed: 0,
      chainDepth: 0,
      isReaction: false,
    };
    const action = {
      ...envelope,
      type: 'system_mp_drain' as const,
      payload: { source: source.id, target: target.id, amount: 11 },
    };
    const result = reduceSystemMpDrain(state, action, cat);
    expect(result.outcome.targetApplied).toBe(11);
    expect(result.outcome.sourceApplied).toBe(11);
    expect(result.newState.units.get(source.id)!.vitals.mp).toBe(11);
    expect(result.newState.units.get(target.id)!.vitals.mp).toBe(39);
  });
});

describe("Session 31.5 — bug 1 (Auto-Regen displays as 'Regen')", () => {
  it("regen_auto's name reads as 'Regen'", () => {
    expect(regenAuto.name).toBe('Regen');
  });
});

describe('Session 31.5 — isRiderCast helper consolidation', () => {
  it('isRiderCast returns true when payload carries a riderSource', () => {
    expect(isRiderCast({ abilityId: abilityId('x'), target: { kind: 'self' } })).toBe(false);
    expect(
      isRiderCast({
        abilityId: abilityId('x'),
        target: { kind: 'self' },
        riderSource: { kind: 'equipment_proc', itemId: itemId('any') },
      }),
    ).toBe(true);
  });
});

// ===========================================================================
// Knockback marker desync (bug A) — AbilityTargetResult.displacedTo
// ===========================================================================

describe('Session 31.5 — knockback displacement on per-target result', () => {
  // The reducer's knockback rider was already updating unit.position in
  // engine state pre-31.5 (clicking the new tile opened the right unit's
  // detail panel), but no animator-visible signal carried the new
  // position. The renderer's sprite stayed on the original tile until
  // the unit's next Move. This regression locks in that the per-target
  // result now records `displacedTo`, the field the renderer reads.
  it("AbilityTargetResult carries `displacedTo` after a knockback rider fires", () => {
    const knockAbility: ActiveAbilityDefinition = {
      id: abilityId('test_knock_blast'),
      name: 'Test Knock Blast',
      kind: 'active',
      bucket: 'first_action' as unknown as ActiveAbilityDefinition['bucket'],
      availability: 'hidden',
      cost: { mp: 0 },
      targeting: { kind: 'tile', range: { horizontal: 4, vertical: 2 } },
      effects: {
        damage: {
          tags: ['magical', 'water'] as DamageTag[],
          power_coefficient: 1,
          variance: { min: 1, max: 1 },
          knockback: { distance: 1 },
        },
      },
      actionSpeed: 0,
      aoe: { kind: 'single' },
    } as unknown as ActiveAbilityDefinition;
    const cat = createCatalog({
      statusTypes: [],
      abilities: [knockAbility],
      commandSets: [],
      classes: [makeKnight()],
      items: [],
      rulesets: [defaultRuleset],
    });
    const attacker = makeUnit({ id: 'a', spd: 10, ma: 5, faith: 100, position: { x: 0, y: 0, layer: 0 } });
    const target = makeUnit({ id: 't', spd: 10, hp: 999, team: 'team_b', position: { x: 2, y: 0, layer: 0 }, faith: 100 });
    let state = makeGameState({
      units: [attacker, target],
      map: flatMap(8, 8),
      turnState: activeTurnFor(attacker.id),
    });
    // Synthesize a use_ability action against a tile that includes the
    // target's position so the AoE dispatcher routes the per-target damage.
    const action: Extract<Action, { type: 'use_ability' }> = {
      sequenceNumber: 1,
      source: 'player',
      timestamp: { tick: 0, ct: 0 },
      seed: 1,
      chainDepth: 0,
      isReaction: false,
      actorId: attacker.id,
      type: 'use_ability' as const,
      payload: {
        abilityId: knockAbility.id,
        target: { kind: 'unit' as const, unitId: target.id },
      },
    };
    const result = reduceUseAbility(state, action, cat);
    state = result.newState;
    const outcomeOf = result.outcome;
    if (outcomeOf.kind !== 'use_ability') throw new Error('expected use_ability outcome');
    expect(outcomeOf.perTargetResults.length).toBeGreaterThan(0);
    const r = outcomeOf.perTargetResults[0]!;
    expect(r.hit).toBe(true);
    // Engine state moved the target to (3, 0, 0) — one tile east.
    expect(state.units.get(target.id)!.position).toEqual({ x: 3, y: 0, layer: 0 });
    // Per-target result carries the same destination for the renderer.
    expect(r.displacedTo).toEqual({ x: 3, y: 0, layer: 0 });
  });
});

// ===========================================================================
// Absorption can't revive (bug B) — applyDamageToTarget gates healing on hp > 0
// ===========================================================================

describe("Session 31.5 — absorption tag-flip cannot revive a KO'd target", () => {
  // Pre-31.5 a Lightning attack on a unit with >100 Lightning resistance
  // would tag-flip to healing (ADR-0057). If the target was already KO'd
  // by earlier damage, the healing-flagged result was applied to the 0-HP
  // unit via `applyDamageToTarget`'s `hp + finalDamage` branch, reviving
  // them. The scheduler then picked them up for a normal turn. ADR-0070
  // closes the gate.
  it('a Lightning hit on a KO\'d high-resistance target does NOT raise HP', () => {
    const lightning: ActiveAbilityDefinition = {
      id: abilityId('test_bolt'),
      name: 'Test Bolt',
      kind: 'active',
      bucket: 'first_action' as unknown as ActiveAbilityDefinition['bucket'],
      availability: 'hidden',
      cost: { mp: 0 },
      targeting: { kind: 'single_unit', range: { horizontal: 4, vertical: 2 } },
      effects: {
        damage: {
          tags: ['magical', 'lightning'] as DamageTag[],
          power_coefficient: 8,
          variance: { min: 1, max: 1 },
        },
      },
      actionSpeed: 0,
      aoe: { kind: 'single' },
    } as unknown as ActiveAbilityDefinition;
    const cat = createCatalog({
      statusTypes: [],
      abilities: [lightning],
      commandSets: [],
      classes: [makeKnight()],
      items: [],
      rulesets: [defaultRuleset],
    });
    const attacker = makeUnit({ id: 'a', spd: 10, ma: 14, faith: 100 });
    // KO'd target with +150 Lightning resistance (the absorption regime).
    const koTarget = makeUnit({
      id: 't',
      spd: 10,
      hp: 0,
      faith: 100,
      resistances: new Map<DamageTag, number>([['lightning', 150]]),
    });
    const state = makeGameState({ units: [attacker, koTarget], turnState: activeTurnFor(attacker.id) });
    const ctx = runDamagePipeline({
      state,
      catalog: cat,
      attacker,
      target: koTarget,
      ability: lightning,
      sourceActionSeq: 0,
      seed: 42,
      registry: defaultDamageHandlers,
    });
    // The pipeline still tag-flips (absorption regime detected in the
    // cap stage) — that's a pipeline-internal concern. The engine-side
    // gate lives in applyDamageToTarget.
    expect(ctx.damageTags.has('healing')).toBe(true);
    // Now run reduceUseAbility end-to-end so the gate kicks in.
    const action: Extract<Action, { type: 'use_ability' }> = {
      sequenceNumber: 1,
      source: 'player',
      timestamp: { tick: 0, ct: 0 },
      seed: 42,
      chainDepth: 0,
      isReaction: false,
      actorId: attacker.id,
      type: 'use_ability' as const,
      payload: {
        abilityId: lightning.id,
        target: { kind: 'unit' as const, unitId: koTarget.id },
      },
    };
    const result = reduceUseAbility(state, action, cat);
    // The KO'd target stays at HP 0.
    expect(result.newState.units.get(koTarget.id)!.vitals.hp).toBe(0);
  });
});

// Suppress unused-import lint for the team helper.
void teamId;
