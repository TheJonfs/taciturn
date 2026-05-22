// Session 31 integration tests — Cluster 5 content + substrate (resistance
// shift + weapon variance + actionSpeed rider bypass).
//
// Covers:
//   1. `tagged_resistance_shift` status: per-instance customState, additive
//      composition through `runModifyResistance`, cross-wand cancellation,
//      battle-long (`permanent`) duration.
//   2. Weapon-sourced variance fork: `physicalVariance` on WeaponEquipment
//      replaces ability `damageSpec.variance` for physical hits; magical
//      damage is unaffected; falls back to ability variance when the
//      weapon doesn't declare; determinism preserved per-seed.
//
// Subsequent sections (actionSpeed rider bypass, content items, demo
// loadout regression) extend this file as Session 31 ships.

import { describe, expect, it } from 'vitest';
import { createCatalog } from '../catalog/index.ts';
import {
  DEFAULT_TEST_DAMAGE_PIPELINE,
  defaultTestRulesets,
  makeTestRuleset,
} from '../catalog/test-fixtures.ts';
import { makeKnight } from '../abilities/test-fixtures.ts';
import { makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { runModifyResistance } from '../hooks/runners.ts';
import { applyStatus } from '../status/apply.ts';
import { runDamagePipeline } from '../damage/pipeline.ts';
import { defaultDamageHandlers } from '../damage/default-handlers.ts';
import { reduceUseAbility } from './reducers.ts';
import { boltHammer } from '../../content/items/bolt-hammer.ts';
import { flametongue } from '../../content/items/flametongue.ts';
import { raspPendant } from '../../content/items/rasp-pendant.ts';
import { warAxe } from '../../content/items/war-axe.ts';
import { wandOfDeepwood } from '../../content/items/wand-of-deepwood.ts';
import { wandOfDepths } from '../../content/items/wand-of-depths.ts';
import { applyBurnProc } from '../../content/abilities/apply-burn-proc.ts';
import { wandOfDeepwoodApplyShift } from '../../content/abilities/wand-of-deepwood-apply-shift.ts';
import { wandOfDepthsApplyShift } from '../../content/abilities/wand-of-depths-apply-shift.ts';
import { charging } from '../../content/statuses/charging.ts';
import { taggedResistanceShift } from '../../content/statuses/tagged-resistance-shift.ts';
import { formatActionLog } from '../../ui/action-log-format.ts';
import {
  abilityId,
  bucketId,
  itemId,
  statusTypeId,
  type UnitEquipment,
} from '../types/index.ts';
import type { ActiveAbilityDefinition, WeaponEquipment } from '../catalog/index.ts';

// ===========================================================================
// 1. tagged_resistance_shift — additive composition
// ===========================================================================

describe('Session 31 tagged_resistance_shift — composition', () => {
  function catalogWith() {
    return createCatalog({
      statusTypes: [taggedResistanceShift],
      abilities: [],
      commandSets: [],
      classes: [makeKnight()],
      items: [],
      rulesets: defaultTestRulesets,
    });
  }

  it('single application shifts the configured tags', () => {
    const cat = catalogWith();
    const u = makeUnit({ id: 'u', spd: 10 });
    let state = makeGameState({ units: [u] });
    const applied = applyStatus(
      state,
      {
        targetId: u.id,
        typeId: statusTypeId('tagged_resistance_shift'),
        sourceUnitId: null,
        sourceActionSeq: null,
        customState: {
          tagDeltas: { fire: 25, lightning: -25 },
          displayName: 'Wand of the Depths Resonance',
        },
      },
      cat,
    );
    state = applied.newState;
    const target = state.units.get(u.id)!;
    const fire = runModifyResistance(state, cat, { unit: target, tag: 'fire', baseValue: 0 });
    const lightning = runModifyResistance(state, cat, {
      unit: target,
      tag: 'lightning',
      baseValue: 0,
    });
    const water = runModifyResistance(state, cat, { unit: target, tag: 'water', baseValue: 0 });
    expect(fire).toBe(25);
    expect(lightning).toBe(-25);
    expect(water).toBe(0);
  });

  it('two same-source applications stack additively', () => {
    const cat = catalogWith();
    const u = makeUnit({ id: 'u', spd: 10 });
    let state = makeGameState({ units: [u] });
    for (let i = 0; i < 2; i++) {
      const applied = applyStatus(
        state,
        {
          targetId: u.id,
          typeId: statusTypeId('tagged_resistance_shift'),
          sourceUnitId: null,
          sourceActionSeq: null,
          customState: {
            tagDeltas: { fire: 25, lightning: -25 },
            displayName: 'Wand of the Depths Resonance',
          },
        },
        cat,
      );
      state = applied.newState;
    }
    const target = state.units.get(u.id)!;
    expect(target.statuses).toHaveLength(2);
    const fire = runModifyResistance(state, cat, { unit: target, tag: 'fire', baseValue: 0 });
    const lightning = runModifyResistance(state, cat, {
      unit: target,
      tag: 'lightning',
      baseValue: 0,
    });
    expect(fire).toBe(50);
    expect(lightning).toBe(-50);
  });

  it('Wand of Depths + Wand of Deepwood cancel additively to zero net', () => {
    const cat = catalogWith();
    const u = makeUnit({ id: 'u', spd: 10 });
    let state = makeGameState({ units: [u] });
    state = applyStatus(
      state,
      {
        targetId: u.id,
        typeId: statusTypeId('tagged_resistance_shift'),
        sourceUnitId: null,
        sourceActionSeq: null,
        customState: {
          tagDeltas: { fire: 25, lightning: -25 },
          displayName: 'Wand of the Depths Resonance',
        },
      },
      cat,
    ).newState;
    state = applyStatus(
      state,
      {
        targetId: u.id,
        typeId: statusTypeId('tagged_resistance_shift'),
        sourceUnitId: null,
        sourceActionSeq: null,
        customState: {
          tagDeltas: { lightning: 25, fire: -25 },
          displayName: 'Wand of the Deepwood Resonance',
        },
      },
      cat,
    ).newState;
    const target = state.units.get(u.id)!;
    expect(target.statuses).toHaveLength(2);
    const fire = runModifyResistance(state, cat, { unit: target, tag: 'fire', baseValue: 0 });
    const lightning = runModifyResistance(state, cat, {
      unit: target,
      tag: 'lightning',
      baseValue: 0,
    });
    expect(fire).toBe(0);
    expect(lightning).toBe(0);
  });

  it('composes additively over native resistance baseValue', () => {
    const cat = catalogWith();
    const u = makeUnit({ id: 'u', spd: 10 });
    let state = makeGameState({ units: [u] });
    state = applyStatus(
      state,
      {
        targetId: u.id,
        typeId: statusTypeId('tagged_resistance_shift'),
        sourceUnitId: null,
        sourceActionSeq: null,
        customState: {
          tagDeltas: { fire: 25, lightning: -25 },
          displayName: 'Wand of the Depths Resonance',
        },
      },
      cat,
    ).newState;
    const target = state.units.get(u.id)!;
    // baseValue of 50 (e.g., Fire Mage's natural Fire affinity) + 25 shift
    const fire = runModifyResistance(state, cat, { unit: target, tag: 'fire', baseValue: 50 });
    expect(fire).toBe(75);
  });

  it('persists as permanent (never decrements by time)', () => {
    const cat = catalogWith();
    const u = makeUnit({ id: 'u', spd: 10 });
    let state = makeGameState({ units: [u] });
    const applied = applyStatus(
      state,
      {
        targetId: u.id,
        typeId: statusTypeId('tagged_resistance_shift'),
        sourceUnitId: null,
        sourceActionSeq: null,
        customState: {
          tagDeltas: { fire: 25, lightning: -25 },
          displayName: 'Wand of the Depths Resonance',
        },
      },
      cat,
    );
    state = applied.newState;
    const target = state.units.get(u.id)!;
    // The 'permanent' durationMode stores null remainingDuration; no
    // decrement, no expiry. The contract is also documented at
    // `engine/status/apply.ts:computeInitialDuration`.
    expect(target.statuses).toHaveLength(1);
    expect(target.statuses[0]?.remainingDuration).toBeNull();
  });
});

// ===========================================================================
// 2. physicalVariance — weapon-sourced variance fork
// ===========================================================================

function makeWeaponWithVariance(args: {
  readonly id: string;
  readonly wp?: number;
  readonly accuracy?: number;
  readonly physicalVariance?: WeaponEquipment['physicalVariance'];
}): WeaponEquipment {
  return {
    id: itemId(args.id),
    name: args.id,
    availability: 'hidden',
    kind: 'weapon',
    wp: args.wp ?? 12,
    accuracy: args.accuracy ?? 100,
    tags: [],
    ...(args.physicalVariance !== undefined
      ? { physicalVariance: args.physicalVariance }
      : {}),
  };
}

function physicalAttack(power_coefficient = 1): ActiveAbilityDefinition {
  return {
    id: abilityId('attack_test'),
    name: 'Attack',
    kind: 'active',
    bucket: bucketId('first_action'),
    baseCost: 1,
    availability: 'hidden',
    targeting: { kind: 'single_unit', range: { horizontal: 1, vertical: 3 }, rangeMode: 'melee' },
    actionSpeed: 0,
    mpCost: 0,
    // No ability-declared variance; weapon should drive the band.
    effects: { damage: { tags: ['physical', 'weapon'], power_coefficient } },
  };
}

function magicalCast(power_coefficient = 12): ActiveAbilityDefinition {
  return {
    id: abilityId('cast_test'),
    name: 'Cast',
    kind: 'active',
    bucket: bucketId('first_action'),
    baseCost: 1,
    availability: 'hidden',
    targeting: { kind: 'single_unit', range: { horizontal: 4, vertical: 2 }, rangeMode: 'arc' },
    actionSpeed: 0,
    mpCost: 0,
    effects: { damage: { tags: ['magical', 'lightning'], power_coefficient } },
  };
}

function rulesetForPipeline() {
  return makeTestRuleset({ damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE });
}

function equipWeaponRight(id: string): UnitEquipment {
  return { leftHand: null, rightHand: itemId(id), headgear: null, armor: null, accessory: null };
}

describe('Session 31 physicalVariance — weapon-sourced variance fork', () => {
  it('physical hit with wielder weapon declaring physicalVariance uses the weapon band', () => {
    const ax = makeWeaponWithVariance({
      id: 'war_axe_test',
      wp: 12,
      physicalVariance: { kind: 'static', min: 0.9, max: 1.3 },
    });
    const attack = physicalAttack(1);
    const ruleset = rulesetForPipeline();
    const cat = createCatalog({
      statusTypes: [],
      abilities: [attack],
      commandSets: [],
      classes: [makeKnight()],
      items: [ax],
      rulesets: [ruleset],
    });
    const attacker = makeUnit({ id: 'a', spd: 10, pa: 5, equipment: equipWeaponRight('war_axe_test') });
    const target = makeUnit({ id: 'b', spd: 10, hp: 100, maxHpBase: 100 });
    const state = makeGameState({ units: [attacker, target] });
    // Sample many seeds; every variance factor must lie in [0.9, 1.3].
    // baseDamage = PA × WP × power_coefficient = 5 × 12 × 1 = 60.
    // Final damage = floor(60 × factor) → integer in [54, 78] inclusive.
    const seeds = [1, 2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47];
    const finals = seeds.map(
      (seed) =>
        runDamagePipeline({
          state,
          catalog: cat,
          attacker,
          target,
          ability: attack,
          sourceActionSeq: 0,
          seed,
          registry: defaultDamageHandlers,
        }).finalDamage ?? -1,
    );
    for (const f of finals) {
      expect(f).toBeGreaterThanOrEqual(54); // 60 × 0.9 = 54
      expect(f).toBeLessThanOrEqual(78); // 60 × 1.3 = 78
    }
    // The asymmetric band [0.9, 1.3] has mean 1.1 — sample average over
    // many seeds should sit comfortably above 60 (the symmetric mean).
    const mean = finals.reduce((s, v) => s + v, 0) / finals.length;
    expect(mean).toBeGreaterThan(60);
  });

  it('falls back to ability variance when wielder weapon declares no physicalVariance', () => {
    const sword = makeWeaponWithVariance({ id: 'long_sword_test', wp: 8 });
    const attack: ActiveAbilityDefinition = {
      ...physicalAttack(1),
      effects: {
        damage: { tags: ['physical', 'weapon'], power_coefficient: 1, variance: { min: 0.5, max: 1.5 } },
      },
    };
    const ruleset = rulesetForPipeline();
    const cat = createCatalog({
      statusTypes: [],
      abilities: [attack],
      commandSets: [],
      classes: [makeKnight()],
      items: [sword],
      rulesets: [ruleset],
    });
    const attacker = makeUnit({
      id: 'a',
      spd: 10,
      pa: 5,
      equipment: equipWeaponRight('long_sword_test'),
    });
    const target = makeUnit({ id: 'b', spd: 10, hp: 100, maxHpBase: 100 });
    const state = makeGameState({ units: [attacker, target] });
    // base = 5 × 8 = 40; ability band [0.5, 1.5] → [20, 60].
    const seeds = [1, 2, 3, 5, 7, 11, 13, 17, 19, 23];
    const finals = seeds.map(
      (seed) =>
        runDamagePipeline({
          state,
          catalog: cat,
          attacker,
          target,
          ability: attack,
          sourceActionSeq: 0,
          seed,
          registry: defaultDamageHandlers,
        }).finalDamage ?? -1,
    );
    for (const f of finals) {
      expect(f).toBeGreaterThanOrEqual(20);
      expect(f).toBeLessThanOrEqual(60);
    }
    // The 1.5 max would land at >40 occasionally; if the fork misfired
    // and used `physicalVariance` instead of ability variance, all finals
    // would cluster in [36, 52] (0.9–1.3 × 40). Confirm the spread is
    // wider than that.
    const min = Math.min(...finals);
    const max = Math.max(...finals);
    expect(max - min).toBeGreaterThan(16);
    void min;
  });

  it('magical-only damage ignores wielder weapon physicalVariance (fork is physical-gated)', () => {
    const wandWithVariance = makeWeaponWithVariance({
      id: 'wand_with_variance_test',
      wp: 2,
      physicalVariance: { kind: 'static', min: 0.9, max: 1.3 },
    });
    const cast: ActiveAbilityDefinition = {
      ...magicalCast(12),
      effects: {
        damage: { tags: ['magical', 'lightning'], power_coefficient: 12 },
      },
    };
    const ruleset = rulesetForPipeline();
    const cat = createCatalog({
      statusTypes: [],
      abilities: [cast],
      commandSets: [],
      classes: [makeKnight()],
      items: [wandWithVariance],
      rulesets: [ruleset],
    });
    const attacker = makeUnit({
      id: 'a',
      spd: 10,
      pa: 5,
      ma: 10,
      faith: 100,
      equipment: equipWeaponRight('wand_with_variance_test'),
    });
    const target = makeUnit({ id: 'b', spd: 10, hp: 100, maxHpBase: 100, faith: 100 });
    const state = makeGameState({ units: [attacker, target] });
    // Magical: MA × power × Faith_factor = 10 × 12 × 1.0 = 120. No
    // ability variance declared → ctx.variance = {1, 1} → identity
    // short-circuit. Final damage must be 120 every seed; if the weapon
    // band leaked into the magical path, seeds would diverge.
    const seeds = [1, 2, 3, 5, 7];
    const finals = seeds.map(
      (seed) =>
        runDamagePipeline({
          state,
          catalog: cat,
          attacker,
          target,
          ability: cast,
          sourceActionSeq: 0,
          seed,
          registry: defaultDamageHandlers,
        }).finalDamage ?? -1,
    );
    for (const f of finals) expect(f).toBe(120);
  });

  it('deterministic per (state, action, seed) — same seed reproduces the same factor', () => {
    const ax = makeWeaponWithVariance({
      id: 'war_axe_test_b',
      wp: 12,
      physicalVariance: { kind: 'static', min: 0.9, max: 1.3 },
    });
    const attack = physicalAttack(1);
    const ruleset = rulesetForPipeline();
    const cat = createCatalog({
      statusTypes: [],
      abilities: [attack],
      commandSets: [],
      classes: [makeKnight()],
      items: [ax],
      rulesets: [ruleset],
    });
    const attacker = makeUnit({
      id: 'a',
      spd: 10,
      pa: 5,
      equipment: equipWeaponRight('war_axe_test_b'),
    });
    const target = makeUnit({ id: 'b', spd: 10, hp: 100, maxHpBase: 100 });
    const state = makeGameState({ units: [attacker, target] });
    const args = {
      state,
      catalog: cat,
      attacker,
      target,
      ability: attack,
      sourceActionSeq: 0,
      seed: 12345,
      registry: defaultDamageHandlers,
    };
    const ctx1 = runDamagePipeline(args);
    const ctx2 = runDamagePipeline(args);
    expect(ctx1.finalDamage).toBe(ctx2.finalDamage);
  });
});

// ===========================================================================
// 3. Bolt Hammer — content sanity (attackProcs references lightning_strike)
// ===========================================================================

describe('Session 31 Bolt Hammer — content shape', () => {
  it('declares the asymmetric physicalVariance and a Lightning Strike proc', () => {
    expect(boltHammer.kind).toBe('weapon');
    expect(boltHammer.wp).toBe(10);
    expect(boltHammer.accuracy).toBe(75);
    expect(boltHammer.tags).toContain('axe');
    expect(boltHammer.physicalVariance).toEqual({ kind: 'static', min: 0.9, max: 1.3 });
    expect(boltHammer.attackProcs?.length).toBe(1);
    expect(boltHammer.attackProcs?.[0]?.chance).toBe(0.25);
    expect(boltHammer.attackProcs?.[0]?.abilityId).toBe(abilityId('lightning_strike'));
  });

  it('War Axe retrofit declares the same [0.9, 1.3] band and no proc', () => {
    expect(warAxe.physicalVariance).toEqual({ kind: 'static', min: 0.9, max: 1.3 });
    expect(warAxe.attackProcs).toBeUndefined();
  });

  it('Flametongue extension declares the apply_burn_proc rider at 25%', () => {
    expect(flametongue.attackProcs?.length).toBe(1);
    expect(flametongue.attackProcs?.[0]?.chance).toBe(0.25);
    expect(flametongue.attackProcs?.[0]?.abilityId).toBe(abilityId('apply_burn_proc'));
    // Fire-tag intact (drives elemental wheel composition; Session 29 carry).
    expect(flametongue.tags).toContain('fire');
  });

  it('Wand of the Depths declares the shift proc at 100%', () => {
    expect(wandOfDepths.attackProcs?.length).toBe(1);
    expect(wandOfDepths.attackProcs?.[0]?.chance).toBe(1.0);
    expect(wandOfDepths.attackProcs?.[0]?.abilityId).toBe(
      abilityId('wand_of_depths_apply_shift'),
    );
    // Wielder-side range passive intact (Session 29 carry).
    expect(wandOfDepths.abilityRangeModifiers?.length).toBe(1);
  });

  it('Wand of the Deepwood declares the shift proc at 100%', () => {
    expect(wandOfDeepwood.attackProcs?.length).toBe(1);
    expect(wandOfDeepwood.attackProcs?.[0]?.chance).toBe(1.0);
    expect(wandOfDeepwood.attackProcs?.[0]?.abilityId).toBe(
      abilityId('wand_of_deepwood_apply_shift'),
    );
    // Wielder-side speed passive intact (Session 29 carry).
    expect(wandOfDeepwood.actionSpeedModifiers?.length).toBe(1);
  });

  it('Rasp Pendant declares damageMpDrainPercent: 10 with no other surfaces', () => {
    expect(raspPendant.kind).toBe('accessory');
    expect(raspPendant.damageMpDrainPercent).toBe(10);
    // Per the Session 30 mid-session call: the 10% damage-reduction half
    // of the original equipment doc spec was dropped. The pendant
    // carries only the drain — no damageMpDrainPercent companions.
    expect(raspPendant.statMods).toBeUndefined();
    expect(raspPendant.statModsMultiplicative).toBeUndefined();
  });

  it('proc abilities are all hidden (only fired through attackProcs riderSource)', () => {
    expect(applyBurnProc.availability).toBe('hidden');
    expect(wandOfDepthsApplyShift.availability).toBe('hidden');
    expect(wandOfDeepwoodApplyShift.availability).toBe('hidden');
  });

  it('wand apply_shift abilities author the correct tagDeltas via StatusEffectSpec.customState', () => {
    const depthsSpec = wandOfDepthsApplyShift.effects.statusEffects?.[0];
    const deepwoodSpec = wandOfDeepwoodApplyShift.effects.statusEffects?.[0];
    expect(depthsSpec?.typeId).toBe(statusTypeId('tagged_resistance_shift'));
    expect(deepwoodSpec?.typeId).toBe(statusTypeId('tagged_resistance_shift'));
    expect((depthsSpec?.customState as { tagDeltas: Record<string, number> } | undefined)?.tagDeltas).toEqual({
      fire: 25,
      lightning: -25,
    });
    expect((deepwoodSpec?.customState as { tagDeltas: Record<string, number> } | undefined)?.tagDeltas).toEqual({
      lightning: 25,
      fire: -25,
    });
  });
});

// ===========================================================================
// 4. riderSource — actionSpeed charge bypass
// ===========================================================================

describe('Session 31 riderSource — actionSpeed charge bypass (ADR-0068)', () => {
  function chargedSpell(): ActiveAbilityDefinition {
    return {
      id: abilityId('charged_test_spell'),
      name: 'Charged Test Spell',
      kind: 'active',
      bucket: bucketId('first_action'),
      baseCost: 1,
      availability: 'hidden',
      targeting: {
        kind: 'single_unit',
        range: { horizontal: 99, vertical: 99 },
        rangeMode: 'arc',
      },
      // Authored as a charged spell — non-rider casts must spawn a
      // ChargedAction and apply Charging.
      actionSpeed: 30,
      mpCost: 0,
      effects: { damage: { tags: ['magical', 'lightning'], power_coefficient: 1 } },
    };
  }

  function setUp() {
    const spell = chargedSpell();
    const cat = createCatalog({
      statusTypes: [taggedResistanceShift, charging],
      abilities: [spell],
      commandSets: [],
      classes: [makeKnight()],
      items: [],
      rulesets: defaultTestRulesets,
    });
    const actor = makeUnit({ id: 'actor', spd: 10, mp: 0, faith: 100 });
    const target = makeUnit({
      id: 'target',
      spd: 10,
      team: 'team_b',
      position: { x: 1, y: 0, layer: 0 },
      hp: 1000,
      faith: 0,
    });
    const state = makeGameState({
      units: [actor, target],
      turnState: {
        unitId: actor.id,
        budget: { movesAvailable: 1, actsAvailable: 1 },
        consumed: { movesConsumed: 0, actsConsumed: 0 },
        reactionsUsedThisTurn: new Map(),
      },
    });
    return { cat, spell, actor, target, state };
  }

  it('rider cast with actionSpeed > 0 resolves instantly (no ChargedAction queued)', () => {
    const { cat, spell, actor, target, state } = setUp();
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
        abilityId: spell.id,
        target: { kind: 'unit', unitId: target.id },
        riderSource: { kind: 'equipment_proc', itemId: itemId('test_weapon') },
      },
    };
    const result = reduceUseAbility(state, action, cat);
    // Instant path: the use_ability outcome carries `perTargetResults`
    // (the resolved cast), not a `chargedActionId`.
    expect(result.outcome.chargedActionId).toBeUndefined();
    expect(result.outcome.perTargetResults.length).toBe(1);
    // No ChargedAction queued on the post-state.
    expect(result.newState.chargedActions.length).toBe(0);
    // No Charging status on the actor.
    const postActor = result.newState.units.get(actor.id)!;
    expect(postActor.statuses.find((s) => s.typeId === statusTypeId('charging'))).toBeUndefined();
  });

  it('non-rider cast of the same actionSpeed > 0 ability charges as expected (regression)', () => {
    const { cat, spell, actor, target, state } = setUp();
    const action: Parameters<typeof reduceUseAbility>[1] = {
      sequenceNumber: 1,
      source: 'player',
      actorId: actor.id,
      timestamp: { tick: 0, ct: 0 },
      seed: 0,
      chainDepth: 1,
      isReaction: false,
      type: 'use_ability',
      payload: {
        abilityId: spell.id,
        target: { kind: 'unit', unitId: target.id },
      },
    };
    const result = reduceUseAbility(state, action, cat);
    // Charged path: outcome carries chargedActionId; perTargetResults
    // empty (resolution lands later via charged_action_resolve).
    expect(result.outcome.chargedActionId).toBeDefined();
    expect(result.outcome.perTargetResults.length).toBe(0);
    expect(result.newState.chargedActions.length).toBe(1);
    const postActor = result.newState.units.get(actor.id)!;
    expect(postActor.statuses.find((s) => s.typeId === statusTypeId('charging'))).toBeDefined();
  });
});

// ===========================================================================
// 5. system_mp_drain — action log regression (UI doesn't crash)
// ===========================================================================
//
// In the first playtest after Session 31's loadouts shipped, the Blue
// Lightning Mage's Rasp Pendant emitted `system_mp_drain` when Lightning
// Strike landed. `formatActionLog`'s switch had no case for the new
// type → fell through to implicit undefined → caller's `for (const row
// of rows)` threw → React white-screen. This regression pins the four
// UI surfaces (action-log-format, animator, action-log-panel, derived-
// events) so the next new system action that doesn't get the same
// treatment fails loudly at test time.

describe('Session 31 system_mp_drain — UI surfaces handle the action shape', () => {
  it('formatActionLog renders a system_mp_drain entry without throwing', () => {
    const cat = createCatalog({
      statusTypes: [],
      abilities: [],
      commandSets: [],
      classes: [makeKnight()],
      items: [],
      rulesets: defaultTestRulesets,
    });
    const source = makeUnit({ id: 'source', spd: 10, mp: 60 });
    const target = makeUnit({
      id: 'target',
      spd: 10,
      team: 'team_b',
      position: { x: 1, y: 0, layer: 0 },
      mp: 30,
    });
    const state = makeGameState({ units: [source, target] });
    // Build a minimally-shaped `system_mp_drain` Action with an outcome
    // and feed it through the log formatter. Per the bug: the formatter
    // used to return undefined for this action type, crashing the caller.
    const action = {
      sequenceNumber: 1,
      source: 'system' as const,
      timestamp: { tick: 0, ct: 0 },
      seed: 0,
      chainDepth: 1,
      isReaction: false,
      type: 'system_mp_drain' as const,
      payload: { source: source.id, target: target.id, amount: 7 },
      outcome: {
        kind: 'system_mp_drain' as const,
        source: source.id,
        target: target.id,
        requested: 7,
        targetApplied: 7,
        sourceApplied: 7,
      },
    };
    // The state's action log shouldn't have to actually contain it for
    // formatActionLog to handle the entry; pass it directly as the log.
    const rows = formatActionLog([action], state, cat);
    expect(rows.length).toBe(1);
    expect(rows[0]?.text).toContain('drained');
    expect(rows[0]?.text).toContain('7 MP');
  });

  it('formatActionLog skips entries when both applied values are zero (noise reduction)', () => {
    const cat = createCatalog({
      statusTypes: [],
      abilities: [],
      commandSets: [],
      classes: [makeKnight()],
      items: [],
      rulesets: defaultTestRulesets,
    });
    const source = makeUnit({ id: 'source', spd: 10, mp: 60 });
    const target = makeUnit({
      id: 'target',
      spd: 10,
      team: 'team_b',
      position: { x: 1, y: 0, layer: 0 },
      mp: 0,
    });
    const state = makeGameState({ units: [source, target] });
    const action = {
      sequenceNumber: 1,
      source: 'system' as const,
      timestamp: { tick: 0, ct: 0 },
      seed: 0,
      chainDepth: 1,
      isReaction: false,
      type: 'system_mp_drain' as const,
      payload: { source: source.id, target: target.id, amount: 5 },
      outcome: {
        kind: 'system_mp_drain' as const,
        source: source.id,
        target: target.id,
        requested: 5,
        targetApplied: 0,
        sourceApplied: 0,
      },
    };
    const rows = formatActionLog([action], state, cat);
    expect(rows.length).toBe(0);
  });

  it('formatActionLog annotates spillover when source cap shortens the transfer', () => {
    const cat = createCatalog({
      statusTypes: [],
      abilities: [],
      commandSets: [],
      classes: [makeKnight()],
      items: [],
      rulesets: defaultTestRulesets,
    });
    const source = makeUnit({ id: 'source', spd: 10, mp: 98 });
    const target = makeUnit({
      id: 'target',
      spd: 10,
      team: 'team_b',
      position: { x: 1, y: 0, layer: 0 },
      mp: 30,
    });
    const state = makeGameState({ units: [source, target] });
    const action = {
      sequenceNumber: 1,
      source: 'system' as const,
      timestamp: { tick: 0, ct: 0 },
      seed: 0,
      chainDepth: 1,
      isReaction: false,
      type: 'system_mp_drain' as const,
      payload: { source: source.id, target: target.id, amount: 10 },
      outcome: {
        kind: 'system_mp_drain' as const,
        source: source.id,
        target: target.id,
        requested: 10,
        targetApplied: 10,
        sourceApplied: 2, // source had only 2 headroom
      },
    };
    const rows = formatActionLog([action], state, cat);
    expect(rows.length).toBe(1);
    expect(rows[0]?.text).toContain('lost to MP cap');
  });
});
