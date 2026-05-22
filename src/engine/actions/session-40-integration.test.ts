// Session 40 integration tests — knife weapon class, Speed-based
// dynamic variance, Magebane Silence proc, and the AI proc-target
// synergy heuristic.
//
// Covers:
//   1. Dynamic variance substrate: `physicalVariance: { kind:
//      'attacker_speed', spread }` resolves to `[Speed/10 - spread,
//      Speed/10 + spread]` at action resolution time. Composes with
//      `modifyStatQuery` so post-equipment Speed (Sai +1) flows into
//      the band.
//   2. Knife content: Chef's Knife (+1 PA), Magebane (50% Silence proc),
//      Sai (+1 Speed). Stats, accuracy, weapon-class tag.
//   3. Magebane proc behavior: applies Silence on connecting physical
//      hits via the apply_silence_proc rider; doesn't fire on misses;
//      bypasses MP / Silence (rider semantics from ADR-0064 / ADR-0068).
//   4. Static variance arms — War Axe / Bolt Hammer continue to use
//      their fixed [0.9, 1.3] band (no behavior change after the
//      discriminated-union migration).

import { describe, expect, it } from 'vitest';
import { createCatalog } from '../catalog/index.ts';
import {
  DEFAULT_TEST_DAMAGE_PIPELINE,
  defaultTestRulesets,
  makeTestRuleset,
} from '../catalog/test-fixtures.ts';
import { makeKnight } from '../abilities/test-fixtures.ts';
import { makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { runDamagePipeline } from '../damage/pipeline.ts';
import { defaultDamageHandlers } from '../damage/default-handlers.ts';
import { runOnDamageDealt } from '../hooks/runners.ts';
import { chefsKnife } from '../../content/items/chefs-knife.ts';
import { magebane } from '../../content/items/magebane.ts';
import { sai } from '../../content/items/sai.ts';
import { warAxe } from '../../content/items/war-axe.ts';
import { boltHammer } from '../../content/items/bolt-hammer.ts';
import { applySilenceProc } from '../../content/abilities/apply-silence-proc.ts';
import { silence } from '../../content/statuses/silence.ts';
import {
  abilityId,
  bucketId,
  itemId,
  statusTypeId,
  type DamageContext,
  type DamageTag,
  type Unit,
  type UnitEquipment,
} from '../types/index.ts';
import type { ActiveAbilityDefinition } from '../catalog/index.ts';
import type { WeaponEquipment } from '../catalog/index.ts';

// ===========================================================================
// 1. Dynamic variance substrate — Speed-based band resolution
// ===========================================================================

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
    // 100% hit so we don't accidentally test the evasion path.
    hitRoll: { accuracy: 100 },
    effects: { damage: { tags: ['physical', 'weapon'], power_coefficient } },
  };
}

function rulesetForPipeline() {
  return makeTestRuleset({ damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE });
}

function equipWeaponRight(id: string): UnitEquipment {
  return { leftHand: null, rightHand: itemId(id), headgear: null, armor: null, accessory: null };
}

describe('Session 40 dynamic variance — Speed-source band', () => {
  it('Speed 10 wielder produces a [0.95, 1.05] band on a knife', () => {
    const knife: WeaponEquipment = {
      id: itemId('test_knife'),
      name: 'Test Knife',
      availability: 'hidden',
      kind: 'weapon',
      wp: 4,
      accuracy: 100,
      tags: ['knife'],
      physicalVariance: { kind: 'attacker_speed', spread: 0.05 },
    };
    const attack = physicalAttack(1);
    const ruleset = rulesetForPipeline();
    const cat = createCatalog({
      statusTypes: [],
      abilities: [attack],
      commandSets: [],
      classes: [makeKnight()],
      items: [knife],
      rulesets: [ruleset],
    });
    const attacker = makeUnit({
      id: 'a',
      spd: 10,
      pa: 5,
      equipment: equipWeaponRight('test_knife'),
    });
    const target = makeUnit({ id: 'b', spd: 10, hp: 100, maxHpBase: 100 });
    const state = makeGameState({ units: [attacker, target] });
    // base = PA × WP = 5 × 4 = 20; band [0.95, 1.05] → final ∈ [19, 21].
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
      expect(f).toBeGreaterThanOrEqual(19); // floor(20 × 0.95) = 19
      expect(f).toBeLessThanOrEqual(21); // floor(20 × 1.05) = 21
    }
  });

  it('Speed 5 wielder produces a [0.45, 0.55] band (slow-class penalty)', () => {
    const knife: WeaponEquipment = {
      id: itemId('test_knife_slow'),
      name: 'Test Knife',
      availability: 'hidden',
      kind: 'weapon',
      wp: 4,
      accuracy: 100,
      tags: ['knife'],
      physicalVariance: { kind: 'attacker_speed', spread: 0.05 },
    };
    const attack = physicalAttack(1);
    const ruleset = rulesetForPipeline();
    const cat = createCatalog({
      statusTypes: [],
      abilities: [attack],
      commandSets: [],
      classes: [makeKnight()],
      items: [knife],
      rulesets: [ruleset],
    });
    const attacker = makeUnit({
      id: 'a',
      spd: 5,
      pa: 10,
      equipment: equipWeaponRight('test_knife_slow'),
    });
    const target = makeUnit({ id: 'b', spd: 10, hp: 100, maxHpBase: 100 });
    const state = makeGameState({ units: [attacker, target] });
    // base = 10 × 4 = 40; band [0.45, 0.55] → final ∈ [18, 22].
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
      expect(f).toBeGreaterThanOrEqual(18); // floor(40 × 0.45)
      expect(f).toBeLessThanOrEqual(22); // floor(40 × 0.55)
    }
  });

  it('post-equipment Speed flows into the band — Sai +1 Speed lifts a Knight from [0.85,0.95] to [0.95,1.05]', () => {
    const attack = physicalAttack(1);
    const ruleset = rulesetForPipeline();
    const cat = createCatalog({
      statusTypes: [],
      abilities: [attack],
      commandSets: [],
      classes: [makeKnight()],
      items: [sai],
      rulesets: [ruleset],
    });
    // Knight base Speed 9 — matches the S40 brief's example. Sai's +1
    // Speed must compose through modifyStatQuery into the variance
    // resolution, lifting the band to [0.95, 1.05] (mean 1.0) from
    // [0.85, 0.95] (mean 0.9).
    const attacker = makeUnit({
      id: 'a',
      spd: 9,
      pa: 5,
      equipment: equipWeaponRight('sai'),
    });
    const target = makeUnit({ id: 'b', spd: 10, hp: 100, maxHpBase: 100 });
    const state = makeGameState({ units: [attacker, target] });
    // base = 5 × 4 = 20; band [0.95, 1.05] → final ∈ [19, 21].
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
      expect(f).toBeGreaterThanOrEqual(19);
      expect(f).toBeLessThanOrEqual(21);
    }
  });

  it('magical-only damage from a knife wielder ignores the knife variance (physical-gate)', () => {
    const attack: ActiveAbilityDefinition = {
      id: abilityId('cast_test'),
      name: 'Cast',
      kind: 'active',
      bucket: bucketId('first_action'),
      baseCost: 1,
      availability: 'hidden',
      targeting: { kind: 'single_unit', range: { horizontal: 4, vertical: 2 }, rangeMode: 'arc' },
      actionSpeed: 0,
      mpCost: 0,
      effects: { damage: { tags: ['magical', 'lightning'], power_coefficient: 12 } },
    };
    const ruleset = rulesetForPipeline();
    const cat = createCatalog({
      statusTypes: [],
      abilities: [attack],
      commandSets: [],
      classes: [makeKnight()],
      items: [chefsKnife],
      rulesets: [ruleset],
    });
    const attacker = makeUnit({
      id: 'a',
      spd: 5,
      pa: 5,
      ma: 10,
      faith: 100,
      equipment: equipWeaponRight('chefs_knife'),
    });
    const target = makeUnit({ id: 'b', spd: 10, hp: 200, maxHpBase: 200, faith: 100 });
    const state = makeGameState({ units: [attacker, target] });
    // Magical: MA × power × Faith_factor = 10 × 12 × 1.0 = 120. No
    // ability variance → ctx.variance = {1, 1} → identity. If the
    // knife band leaked into the magical path, Speed-5 wielder would
    // shave damage by ~50%; expect 120 every seed.
    const seeds = [1, 2, 3, 5, 7];
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
    for (const f of finals) expect(f).toBe(120);
  });

  it('deterministic per (state, action, seed) — same seed reproduces the same band roll', () => {
    const attack = physicalAttack(1);
    const ruleset = rulesetForPipeline();
    const cat = createCatalog({
      statusTypes: [],
      abilities: [attack],
      commandSets: [],
      classes: [makeKnight()],
      items: [chefsKnife],
      rulesets: [ruleset],
    });
    const attacker = makeUnit({
      id: 'a',
      spd: 10,
      pa: 5,
      equipment: equipWeaponRight('chefs_knife'),
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
// 2. Static variance arms — pre-S40 weapons keep their fixed band
// ===========================================================================

describe('Session 40 discriminated-union migration — static arms unchanged', () => {
  it('War Axe declares the static arm with [0.9, 1.3]', () => {
    expect(warAxe.physicalVariance).toEqual({ kind: 'static', min: 0.9, max: 1.3 });
  });

  it('Bolt Hammer declares the static arm with [0.9, 1.3] and its Lightning Strike proc', () => {
    expect(boltHammer.physicalVariance).toEqual({ kind: 'static', min: 0.9, max: 1.3 });
    expect(boltHammer.attackProcs?.[0]?.abilityId).toBe(abilityId('lightning_strike'));
  });
});

// ===========================================================================
// 3. Knife content — shape sanity
// ===========================================================================

describe('Session 40 knife content — shape', () => {
  it("Chef's Knife: WP 4, Acc 95, +1 PA, knife tag, attacker_speed variance", () => {
    expect(chefsKnife.kind).toBe('weapon');
    expect(chefsKnife.wp).toBe(4);
    expect(chefsKnife.accuracy).toBe(95);
    expect(chefsKnife.statMods?.pa).toBe(1);
    expect(chefsKnife.tags).toContain('knife');
    expect(chefsKnife.physicalVariance).toEqual({ kind: 'attacker_speed', spread: 0.05 });
    expect(chefsKnife.attackProcs).toBeUndefined();
    expect(chefsKnife.classRestrictions).toBeUndefined();
  });

  it('Magebane: WP 5, Acc 95, 50% Silence proc, knife tag, attacker_speed variance', () => {
    expect(magebane.kind).toBe('weapon');
    expect(magebane.wp).toBe(5);
    expect(magebane.accuracy).toBe(95);
    expect(magebane.tags).toContain('knife');
    expect(magebane.physicalVariance).toEqual({ kind: 'attacker_speed', spread: 0.05 });
    expect(magebane.attackProcs?.length).toBe(1);
    expect(magebane.attackProcs?.[0]?.chance).toBe(0.5);
    expect(magebane.attackProcs?.[0]?.abilityId).toBe(abilityId('apply_silence_proc'));
    expect(magebane.classRestrictions).toBeUndefined();
  });

  it('Sai: WP 4, Acc 95, +1 Speed, knife tag, attacker_speed variance', () => {
    expect(sai.kind).toBe('weapon');
    expect(sai.wp).toBe(4);
    expect(sai.accuracy).toBe(95);
    expect(sai.statMods?.spd).toBe(1);
    expect(sai.tags).toContain('knife');
    expect(sai.physicalVariance).toEqual({ kind: 'attacker_speed', spread: 0.05 });
    expect(sai.attackProcs).toBeUndefined();
    expect(sai.classRestrictions).toBeUndefined();
  });
});

// ===========================================================================
// 4. apply_silence_proc — shape sanity
// ===========================================================================

describe('Session 40 apply_silence_proc — shape', () => {
  it('declares applyAlways: true on the silence effect (matches apply_burn_proc convention)', () => {
    expect(applySilenceProc.kind).toBe('active');
    expect(applySilenceProc.availability).toBe('hidden');
    expect(applySilenceProc.mpCost).toBe(0);
    expect(applySilenceProc.actionSpeed).toBe(0);
    const effects = applySilenceProc.effects.statusEffects ?? [];
    expect(effects.length).toBe(1);
    expect(effects[0]?.typeId).toBe(statusTypeId('silence'));
    expect(effects[0]?.applyAlways).toBe(true);
    expect(effects[0]?.duration).toBe(4);
  });

  it('Silence status remains the v1 single-tag status (no resistance gate; mental tag)', () => {
    expect(silence.tags).toContain('negative');
    expect(silence.tags).toContain('mental');
    expect(silence.resistanceTag).toBeUndefined();
  });
});

// ===========================================================================
// 5. Magebane proc emission — composes with the existing attackProc substrate
// ===========================================================================
//
// The full proc-emission path is already tested in session-30-integration.test.ts
// via a generic procWeapon fixture. These tests confirm Magebane specifically
// composes correctly — the proc fires on physical hits, skips on misses, skips
// on non-physical damage, and emits the expected riderSource shape.

function makeCtxFor(args: {
  readonly attacker: Unit;
  readonly target: Unit;
  readonly tags: ReadonlyArray<DamageTag>;
  readonly hit: boolean;
  readonly actionSeed: number;
}): DamageContext {
  return {
    attacker: args.attacker,
    target: args.target,
    sourceActionSeq: 0,
    sourceAbilityId: abilityId('attack_test'),
    damageTags: new Set(args.tags),
    baseDamage: 0,
    multipliers: [],
    additives: [],
    variance: { min: 1, max: 1 },
    hit: args.hit,
    targetCount: 1,
    actionSeed: args.actionSeed,
  };
}

describe('Session 40 Magebane proc emission', () => {
  function magebaneCatalog() {
    return createCatalog({
      statusTypes: [silence],
      abilities: [applySilenceProc],
      commandSets: [],
      classes: [makeKnight()],
      items: [magebane],
      rulesets: defaultTestRulesets,
    });
  }

  it('emits apply_silence_proc against the target with riderSource on a physical hit', () => {
    // 100% proc to make the assertion deterministic. Magebane's actual
    // 50% rate is content-shape-tested above; this case is about the
    // emission path. We override the chance by replacing the weapon with
    // a high-chance variant — the substrate path is the same.
    const guaranteedMagebane: WeaponEquipment = {
      ...magebane,
      id: itemId('magebane_test'),
      attackProcs: [{ chance: 1, abilityId: abilityId('apply_silence_proc') }],
    };
    const cat = createCatalog({
      statusTypes: [silence],
      abilities: [applySilenceProc],
      commandSets: [],
      classes: [makeKnight()],
      items: [guaranteedMagebane],
      rulesets: defaultTestRulesets,
    });
    const attacker = makeUnit({
      id: 'knight',
      spd: 9,
      pa: 7,
      equipment: { leftHand: null, rightHand: guaranteedMagebane.id, headgear: null, armor: null, accessory: null },
    });
    const target = makeUnit({ id: 'mage', spd: 10, team: 'team_b', hp: 100, maxHpBase: 100 });
    const state = makeGameState({ units: [attacker, target] });
    const ctx = makeCtxFor({ attacker, target, tags: ['physical', 'weapon'], hit: true, actionSeed: 7 });
    const result = runOnDamageDealt(state, cat, { unit: attacker, ctx });
    expect(result.emittedActions).toBeDefined();
    expect(result.emittedActions!.length).toBe(1);
    const emission = result.emittedActions![0]!;
    expect(emission.type).toBe('use_ability');
    if (emission.type !== 'use_ability') return;
    expect(emission.payload.abilityId).toBe(abilityId('apply_silence_proc'));
    expect(emission.payload.target).toEqual({ kind: 'unit', unitId: target.id });
    expect(emission.payload.riderSource).toEqual({
      kind: 'equipment_proc',
      itemId: guaranteedMagebane.id,
    });
    expect(emission.source).toBe('system');
  });

  it('does NOT emit on a miss (ctx.hit === false)', () => {
    const cat = magebaneCatalog();
    const attacker = makeUnit({
      id: 'knight',
      spd: 9,
      pa: 7,
      equipment: { leftHand: null, rightHand: itemId('magebane'), headgear: null, armor: null, accessory: null },
    });
    const target = makeUnit({ id: 'mage', spd: 10, team: 'team_b' });
    const state = makeGameState({ units: [attacker, target] });
    const ctx = makeCtxFor({ attacker, target, tags: ['physical', 'weapon'], hit: false, actionSeed: 7 });
    const result = runOnDamageDealt(state, cat, { unit: attacker, ctx });
    expect(result.emittedActions ?? []).toEqual([]);
  });

  it('does NOT emit on non-physical damage (knife wielder somehow casting a spell)', () => {
    const cat = magebaneCatalog();
    const attacker = makeUnit({
      id: 'knight',
      spd: 9,
      pa: 7,
      equipment: { leftHand: null, rightHand: itemId('magebane'), headgear: null, armor: null, accessory: null },
    });
    const target = makeUnit({ id: 'mage', spd: 10, team: 'team_b' });
    const state = makeGameState({ units: [attacker, target] });
    const ctx = makeCtxFor({ attacker, target, tags: ['magical'], hit: true, actionSeed: 7 });
    const result = runOnDamageDealt(state, cat, { unit: attacker, ctx });
    expect(result.emittedActions ?? []).toEqual([]);
  });
});
