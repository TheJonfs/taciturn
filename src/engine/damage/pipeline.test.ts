// Tests for the damage pipeline orchestrator and its v1 default
// handlers. The pipeline is pure given (state, action, ability, target,
// seed, ruleset, registry) — these tests exercise the seven-stage flow,
// healing tag inversion, the cap stage, and determinism under variance.

import { createCatalog } from '../catalog/index.ts';
import {
  DEFAULT_TEST_DAMAGE_PIPELINE,
  defaultTestRulesets,
  makeTestRuleset,
} from '../catalog/test-fixtures.ts';
import { makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { flatMap, mapWith } from '../map/test-fixtures.ts';
import { passiveHook } from '../abilities/hooks.ts';
import { statusHook } from '../status/hooks.ts';
import { makeStatusInstance, makeStatusType } from '../status/test-fixtures.ts';
import {
  abilityId,
  bucketId,
  classId,
  commandSetId,
  type ActiveAbilityDefinition,
  type ClassDefinition,
  type DamageTag,
} from '@engine/index.ts';
import { defaultDamageHandlers } from './default-handlers.ts';
import { runDamagePipeline } from './pipeline.ts';

function knightClass(): ClassDefinition {
  return {
    id: classId('knight'),
    name: 'Knight',
    movement: { moveRange: 3, jump: 2, terrainCosts: new Map(), canEnter: new Set(['ground']) },
    evasion: { front: 0, side: 0, back: 0 },
    equipmentSlots: { leftHand: true, rightHand: true, headgear: true, armor: true, accessory: true },
    firstActionCommandSet: commandSetId('battle_skill'),
    freeAbilities: new Set(),
  };
}

function basicAttack(power_coefficient = 4): ActiveAbilityDefinition {
  return {
    id: abilityId('attack'),
    name: 'Attack',
    kind: 'active',
    bucket: bucketId('first_action'),
    baseCost: 1,
    availability: 'hidden',
    targeting: { kind: 'single_unit', range: { horizontal: 1, vertical: 3 }, rangeMode: 'melee' },
    actionSpeed: 0,
    mpCost: 0,
    effects: { damage: { tags: ['physical', 'weapon'], power_coefficient } },
  };
}

function basicCure(power_coefficient = 5): ActiveAbilityDefinition {
  return {
    id: abilityId('cure'),
    name: 'Cure',
    kind: 'active',
    bucket: bucketId('second_action'),
    baseCost: 1,
    availability: 'hidden',
    targeting: { kind: 'single_unit', range: { horizontal: 4, vertical: 3 }, rangeMode: 'arc' },
    actionSpeed: 0,
    mpCost: 4,
    effects: { damage: { tags: ['holy', 'healing'], power_coefficient } },
  };
}

describe('runDamagePipeline — physical (PA × power)', () => {
  it('produces baseDamage = pa × power and writes finalDamage at finalize', () => {
    const attack = basicAttack(/* power */ 4);
    const attacker = makeUnit({ id: 'a', spd: 10, pa: 5 });
    const target = makeUnit({ id: 'b', spd: 10, hp: 100 });
    const cat = createCatalog({
      statusTypes: [],
      abilities: [attack],
      commandSets: [],
      classes: [knightClass()],
      items: [],
      rulesets: defaultTestRulesets,
    });
    const ruleset = makeTestRuleset({ damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE });
    const cat2 = createCatalog({
      statusTypes: [],
      abilities: [attack],
      commandSets: [],
      classes: [knightClass()],
      items: [],
      rulesets: [ruleset],
    });
    const state = makeGameState({ units: [attacker, target] });
    const ctx = runDamagePipeline({
      state,
      catalog: cat2,
      attacker,
      target,
      ability: attack,
      sourceActionSeq: 0,
      seed: 0,
      registry: defaultDamageHandlers,
    });
    // Variance band defaults to {1, 1} when omitted, so finalDamage = baseDamage = pa * power.
    expect(ctx.baseDamage).toBe(20);
    expect(ctx.finalDamage).toBe(20);
    void cat;
  });

  it('does not run the physical formula when the tag is absent', () => {
    const heal = basicCure(/* power */ 5);
    const attacker = makeUnit({ id: 'a', spd: 10, pa: 5, ma: 4 });
    const target = makeUnit({ id: 'b', spd: 10, hp: 50, maxHpBase: 100 });
    const ruleset = makeTestRuleset({ damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE });
    const cat = createCatalog({
      statusTypes: [],
      abilities: [heal],
      commandSets: [],
      classes: [knightClass()],
      items: [],
      rulesets: [ruleset],
    });
    const state = makeGameState({ units: [attacker, target] });
    const ctx = runDamagePipeline({
      state,
      catalog: cat,
      attacker,
      target,
      ability: heal,
      sourceActionSeq: 0,
      seed: 0,
      registry: defaultDamageHandlers,
    });
    // healing_base ran with Faith_factor symmetric on faith 80 / 80:
    // ma × power × (0.8 × 0.8) = 4 × 5 × 0.64 = 12.8.
    // physical_pa_wp short-circuited (no 'physical' tag).
    expect(ctx.baseDamage).toBeCloseTo(12.8);
  });
});

describe('runDamagePipeline — healing (MA × power, capped at maxHp − hp)', () => {
  it('caps healing at room-to-full', () => {
    const heal = basicCure(/* power */ 50);
    const attacker = makeUnit({ id: 'a', spd: 10, ma: 4 });
    // Target has 90 HP out of 100 → only 10 room. Healing of 200 should cap at 10.
    const target = makeUnit({ id: 'b', spd: 10, hp: 90, maxHpBase: 100 });
    const ruleset = makeTestRuleset({ damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE });
    const cat = createCatalog({
      statusTypes: [],
      abilities: [heal],
      commandSets: [],
      classes: [knightClass()],
      items: [],
      rulesets: [ruleset],
    });
    const state = makeGameState({ units: [attacker, target] });
    const ctx = runDamagePipeline({
      state,
      catalog: cat,
      attacker,
      target,
      ability: heal,
      sourceActionSeq: 0,
      seed: 0,
      registry: defaultDamageHandlers,
    });
    expect(ctx.finalDamage).toBe(10);
  });

  it('floors damage at 0 (no negative damage)', () => {
    // Target gets a status that reduces damage massively via onDamageReceived.
    // Even if base would produce damage, the negative multiplier should cap at 0.
    const sturdy = makeStatusType({
      id: 'sturdy',
      stackingRule: 'REFRESH',
      hooks: [
        statusHook('onDamageReceived', (args) => ({
          ...args.ctx,
          additives: [...args.ctx.additives, { source: 'sturdy', amount: -10000 }],
        })),
      ],
    });
    const attack = basicAttack(/* power */ 4);
    const attacker = makeUnit({ id: 'a', spd: 10, pa: 5 });
    const target = makeUnit({
      id: 'b',
      spd: 10,
      hp: 100,
      maxHpBase: 100,
      statuses: [makeStatusInstance({ typeId: 'sturdy' })],
    });
    const ruleset = makeTestRuleset({ damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE });
    const cat = createCatalog({
      statusTypes: [sturdy],
      abilities: [attack],
      commandSets: [],
      classes: [knightClass()],
      items: [],
      rulesets: [ruleset],
    });
    const state = makeGameState({ units: [attacker, target] });
    const ctx = runDamagePipeline({
      state,
      catalog: cat,
      attacker,
      target,
      ability: attack,
      sourceActionSeq: 0,
      seed: 0,
      registry: defaultDamageHandlers,
    });
    expect(ctx.finalDamage).toBe(0);
  });
});

describe('runDamagePipeline — onDamageDealt / onDamageReceived hooks', () => {
  it('attacker stage applies onDamageDealt multipliers; target stage applies onDamageReceived multipliers', () => {
    // A "Strength Up" status on the attacker — multiplies outgoing physical by 1.5.
    const strengthUp = makeStatusType({
      id: 'strength_up',
      stackingRule: 'REFRESH',
      hooks: [
        statusHook('onDamageDealt', (args) => {
          if (!args.ctx.damageTags.has('physical')) return args.ctx;
          return {
            ...args.ctx,
            multipliers: [...args.ctx.multipliers, { source: 'strength_up', factor: 1.5 }],
          };
        }),
      ],
    });
    // A "Protect" status on the target — halves incoming physical.
    const protect = makeStatusType({
      id: 'protect',
      stackingRule: 'REFRESH',
      hooks: [
        statusHook('onDamageReceived', (args) => {
          if (!args.ctx.damageTags.has('physical')) return args.ctx;
          return {
            ...args.ctx,
            multipliers: [...args.ctx.multipliers, { source: 'protect', factor: 0.5 }],
          };
        }),
      ],
    });
    const attack = basicAttack(/* power */ 4);
    const attacker = makeUnit({
      id: 'a',
      spd: 10,
      pa: 5,
      statuses: [makeStatusInstance({ typeId: 'strength_up' })],
    });
    const target = makeUnit({
      id: 'b',
      spd: 10,
      hp: 100,
      maxHpBase: 100,
      statuses: [makeStatusInstance({ typeId: 'protect' })],
    });
    const ruleset = makeTestRuleset({ damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE });
    const cat = createCatalog({
      statusTypes: [strengthUp, protect],
      abilities: [attack],
      commandSets: [],
      classes: [knightClass()],
      items: [],
      rulesets: [ruleset],
    });
    const state = makeGameState({ units: [attacker, target] });
    const ctx = runDamagePipeline({
      state,
      catalog: cat,
      attacker,
      target,
      ability: attack,
      sourceActionSeq: 0,
      seed: 0,
      registry: defaultDamageHandlers,
    });
    // 5 × 4 × 1.5 × 0.5 = 15.
    expect(ctx.finalDamage).toBe(15);
  });
});

describe('runDamagePipeline — variance and determinism', () => {
  it('same seed → same finalDamage with non-trivial variance band', () => {
    const attack: ActiveAbilityDefinition = {
      ...basicAttack(/* power */ 4),
      effects: {
        damage: { tags: ['physical', 'weapon'], power_coefficient: 4, variance: { min: 0.5, max: 1.5 } },
      },
    };
    const attacker = makeUnit({ id: 'a', spd: 10, pa: 5 });
    const target = makeUnit({ id: 'b', spd: 10, hp: 100, maxHpBase: 100 });
    const ruleset = makeTestRuleset({ damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE });
    const cat = createCatalog({
      statusTypes: [],
      abilities: [attack],
      commandSets: [],
      classes: [knightClass()],
      items: [],
      rulesets: [ruleset],
    });
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

  it('different seeds → potentially different finalDamage with non-trivial variance band', () => {
    const attack: ActiveAbilityDefinition = {
      ...basicAttack(/* power */ 4),
      effects: {
        damage: { tags: ['physical', 'weapon'], power_coefficient: 4, variance: { min: 0.5, max: 1.5 } },
      },
    };
    const attacker = makeUnit({ id: 'a', spd: 10, pa: 5 });
    const target = makeUnit({ id: 'b', spd: 10, hp: 100, maxHpBase: 100 });
    const ruleset = makeTestRuleset({ damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE });
    const cat = createCatalog({
      statusTypes: [],
      abilities: [attack],
      commandSets: [],
      classes: [knightClass()],
      items: [],
      rulesets: [ruleset],
    });
    const state = makeGameState({ units: [attacker, target] });
    const seeds = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89];
    const results = new Set(
      seeds.map(
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
          }).finalDamage,
      ),
    );
    // With 10 different seeds and a non-trivial band, multiple distinct
    // outcomes prove the variance handler actually depends on seed.
    expect(results.size).toBeGreaterThan(1);
  });

  it('no variance band → same finalDamage every time, regardless of seed', () => {
    const attack = basicAttack(/* power */ 4);
    const attacker = makeUnit({ id: 'a', spd: 10, pa: 5 });
    const target = makeUnit({ id: 'b', spd: 10, hp: 100, maxHpBase: 100 });
    const ruleset = makeTestRuleset({ damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE });
    const cat = createCatalog({
      statusTypes: [],
      abilities: [attack],
      commandSets: [],
      classes: [knightClass()],
      items: [],
      rulesets: [ruleset],
    });
    const state = makeGameState({ units: [attacker, target] });
    const args1 = {
      state,
      catalog: cat,
      attacker,
      target,
      ability: attack,
      sourceActionSeq: 0,
      seed: 1,
      registry: defaultDamageHandlers,
    };
    const args2 = { ...args1, seed: 99999 };
    expect(runDamagePipeline(args1).finalDamage).toBe(runDamagePipeline(args2).finalDamage);
  });
});

describe('runDamagePipeline — error surfacing', () => {
  it('throws when invoked on an ability with no damage spec', () => {
    const noDamage: ActiveAbilityDefinition = {
      ...basicAttack(),
      effects: {},
    };
    const attacker = makeUnit({ id: 'a', spd: 10 });
    const target = makeUnit({ id: 'b', spd: 10 });
    const ruleset = makeTestRuleset({ damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE });
    const cat = createCatalog({
      statusTypes: [],
      abilities: [noDamage],
      commandSets: [],
      classes: [knightClass()],
      items: [],
      rulesets: [ruleset],
    });
    const state = makeGameState({ units: [attacker, target] });
    expect(() =>
      runDamagePipeline({
        state,
        catalog: cat,
        attacker,
        target,
        ability: noDamage,
        sourceActionSeq: 0,
        seed: 0,
        registry: defaultDamageHandlers,
      }),
    ).toThrow(/no damage spec/);
  });

  it('throws when a stage references an unknown handler ref', () => {
    const attack = basicAttack();
    const attacker = makeUnit({ id: 'a', spd: 10 });
    const target = makeUnit({ id: 'b', spd: 10 });
    const brokenRuleset = makeTestRuleset({
      damagePipelineStages: { ...DEFAULT_TEST_DAMAGE_PIPELINE, base: ['no_such_handler'] },
    });
    const cat = createCatalog({
      statusTypes: [],
      abilities: [attack],
      commandSets: [],
      classes: [knightClass()],
      items: [],
      rulesets: [brokenRuleset],
    });
    const state = makeGameState({ units: [attacker, target] });
    expect(() =>
      runDamagePipeline({
        state,
        catalog: cat,
        attacker,
        target,
        ability: attack,
        sourceActionSeq: 0,
        seed: 0,
        registry: defaultDamageHandlers,
      }),
    ).toThrow(/unknown handler ref/);
  });
});

// --- Session 14 additions: magical / evasion / resistance ---

function basicSpell(args: {
  readonly id?: string;
  readonly tags?: ReadonlyArray<DamageTag>;
  readonly power_coefficient?: number;
  readonly mpCost?: number;
} = {}): ActiveAbilityDefinition {
  return {
    id: abilityId(args.id ?? 'spell'),
    name: 'Spell',
    kind: 'active',
    bucket: bucketId('first_action'),
    baseCost: 1,
    availability: 'hidden',
    targeting: { kind: 'single_unit', range: { horizontal: 4, vertical: 3 }, rangeMode: 'arc' },
    actionSpeed: 0,
    mpCost: args.mpCost ?? 0,
    effects: { damage: { tags: args.tags ?? ['magical'], power_coefficient: args.power_coefficient ?? 5 } },
  };
}

function evasiveClass(args: {
  readonly front?: number;
  readonly side?: number;
  readonly back?: number;
}): ClassDefinition {
  return {
    id: classId('evasive'),
    name: 'Evasive',
    movement: { moveRange: 3, jump: 2, terrainCosts: new Map(), canEnter: new Set(['ground']) },
    evasion: { front: args.front ?? 0, side: args.side ?? 0, back: args.back ?? 0 },
    equipmentSlots: { leftHand: true, rightHand: true, headgear: true, armor: true, accessory: true },
    firstActionCommandSet: commandSetId('battle_skill'),
    freeAbilities: new Set(),
  };
}

describe('runDamagePipeline — magical (MA × power × Faith_factor)', () => {
  it('produces baseDamage = MA × power × Faith_factor with symmetric Faith', () => {
    // Caster faith 80, target faith 80 → factor 0.64. MA 5 × power 4 × 0.64 = 12.8.
    const spell = basicSpell({ power_coefficient: 4 });
    const attacker = makeUnit({ id: 'a', spd: 10, ma: 5, faith: 80 });
    const target = makeUnit({ id: 'b', spd: 10, hp: 100, faith: 80 });
    const ruleset = makeTestRuleset({ damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE });
    const cat = createCatalog({
      statusTypes: [],
      abilities: [spell],
      commandSets: [],
      classes: [knightClass()],
      items: [],
      rulesets: [ruleset],
    });
    const state = makeGameState({ units: [attacker, target] });
    const ctx = runDamagePipeline({
      state,
      catalog: cat,
      attacker,
      target,
      ability: spell,
      sourceActionSeq: 0,
      seed: 0,
      registry: defaultDamageHandlers,
    });
    expect(ctx.baseDamage).toBeCloseTo(12.8);
    expect(ctx.finalDamage).toBe(12);
  });

  it('asymmetric Faith — low caster faith reduces damage; symmetric high faith maximizes it', () => {
    // Same MA/power; vary faith. Faith_factor scales linearly per side.
    const spell = basicSpell({ power_coefficient: 4 });
    const ruleset = makeTestRuleset({ damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE });
    const cat = createCatalog({
      statusTypes: [],
      abilities: [spell],
      commandSets: [],
      classes: [knightClass()],
      items: [],
      rulesets: [ruleset],
    });

    function damageAt(faithA: number, faithB: number): number {
      const attacker = makeUnit({ id: 'a', spd: 10, ma: 5, faith: faithA });
      const target = makeUnit({ id: 'b', spd: 10, hp: 100, faith: faithB });
      const state = makeGameState({ units: [attacker, target] });
      return runDamagePipeline({
        state,
        catalog: cat,
        attacker,
        target,
        ability: spell,
        sourceActionSeq: 0,
        seed: 0,
        registry: defaultDamageHandlers,
      }).finalDamage ?? 0;
    }

    // Faith 100 / 100 → factor 1.0 → 20.
    expect(damageAt(100, 100)).toBe(20);
    // Faith 100 / 50 → factor 0.5 → 10.
    expect(damageAt(100, 50)).toBe(10);
    // Faith 50 / 100 → factor 0.5 → 10 (symmetric).
    expect(damageAt(50, 100)).toBe(10);
    // Faith 50 / 50 → factor 0.25 → 5.
    expect(damageAt(50, 50)).toBe(5);
  });

  it("does not run the magical formula when the 'magical' tag is absent", () => {
    const physical = basicSpell({ tags: ['physical', 'weapon'], power_coefficient: 4 });
    const attacker = makeUnit({ id: 'a', spd: 10, pa: 5, ma: 99, faith: 1 });
    const target = makeUnit({ id: 'b', spd: 10, hp: 100, faith: 1 });
    const ruleset = makeTestRuleset({ damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE });
    const cat = createCatalog({
      statusTypes: [],
      abilities: [physical],
      commandSets: [],
      classes: [knightClass()],
      items: [],
      rulesets: [ruleset],
    });
    const state = makeGameState({ units: [attacker, target] });
    const ctx = runDamagePipeline({
      state,
      catalog: cat,
      attacker,
      target,
      ability: physical,
      sourceActionSeq: 0,
      seed: 0,
      registry: defaultDamageHandlers,
    });
    // physical_pa_wp ran (PA × power = 20); magical_ma_power short-circuited.
    // Faith doesn't enter the physical formula.
    expect(ctx.baseDamage).toBe(20);
  });
});

describe('runDamagePipeline — resistance (signedMax composition, healing short-circuit, cap-at-immune)', () => {
  it('half resistance halves damage; full resistance immune', () => {
    const spell = basicSpell({ power_coefficient: 4 });
    const attacker = makeUnit({ id: 'a', spd: 10, ma: 5, faith: 100 });
    // Faith 100/100 → factor 1.0 → MA × power = 20 base.
    const halfResist = makeUnit({
      id: 'b',
      spd: 10,
      hp: 100,
      faith: 100,
      resistances: new Map<DamageTag, number>([['magical', 50]]),
    });
    const ruleset = makeTestRuleset({ damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE });
    const cat = createCatalog({
      statusTypes: [],
      abilities: [spell],
      commandSets: [],
      classes: [knightClass()],
      items: [],
      rulesets: [ruleset],
    });
    const state = makeGameState({ units: [attacker, halfResist] });
    const ctx = runDamagePipeline({
      state,
      catalog: cat,
      attacker,
      target: halfResist,
      ability: spell,
      sourceActionSeq: 0,
      seed: 0,
      registry: defaultDamageHandlers,
    });
    // 20 × 0.5 = 10.
    expect(ctx.finalDamage).toBe(10);
  });

  it('weakness (negative resistance) increases damage', () => {
    const spell = basicSpell({ power_coefficient: 4 });
    const attacker = makeUnit({ id: 'a', spd: 10, ma: 5, faith: 100 });
    const weakTarget = makeUnit({
      id: 'b',
      spd: 10,
      hp: 100,
      faith: 100,
      resistances: new Map<DamageTag, number>([['magical', -50]]),
    });
    const ruleset = makeTestRuleset({ damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE });
    const cat = createCatalog({
      statusTypes: [],
      abilities: [spell],
      commandSets: [],
      classes: [knightClass()],
      items: [],
      rulesets: [ruleset],
    });
    const state = makeGameState({ units: [attacker, weakTarget] });
    const ctx = runDamagePipeline({
      state,
      catalog: cat,
      attacker,
      target: weakTarget,
      ability: spell,
      sourceActionSeq: 0,
      seed: 0,
      registry: defaultDamageHandlers,
    });
    // 20 × 1.5 = 30.
    expect(ctx.finalDamage).toBe(30);
  });

  it('multi-tag composition takes signed maximum (resistance wins ties per ADR-0015)', () => {
    // Holy fire spell. Target has fire +50 and holy -50; ties resolve to
    // resistance side. signedMax(50, -50) = 50 → half damage.
    const holyFire = basicSpell({ tags: ['magical', 'fire', 'holy'], power_coefficient: 4 });
    const attacker = makeUnit({ id: 'a', spd: 10, ma: 5, faith: 100 });
    const target = makeUnit({
      id: 'b',
      spd: 10,
      hp: 100,
      faith: 100,
      resistances: new Map<DamageTag, number>([
        ['fire', 50],
        ['holy', -50],
      ]),
    });
    const ruleset = makeTestRuleset({ damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE });
    const cat = createCatalog({
      statusTypes: [],
      abilities: [holyFire],
      commandSets: [],
      classes: [knightClass()],
      items: [],
      rulesets: [ruleset],
    });
    const state = makeGameState({ units: [attacker, target] });
    const ctx = runDamagePipeline({
      state,
      catalog: cat,
      attacker,
      target,
      ability: holyFire,
      sourceActionSeq: 0,
      seed: 0,
      registry: defaultDamageHandlers,
    });
    // 20 × 0.5 = 10.
    expect(ctx.finalDamage).toBe(10);
  });

  it('healing-tagged effects skip resistance entirely (ADR-0016)', () => {
    // Cure on a target with holy +100 (would be immune if resistance applied).
    const cure = basicCure(/* power */ 5);
    const attacker = makeUnit({ id: 'a', spd: 10, ma: 4, faith: 100 });
    const target = makeUnit({
      id: 'b',
      spd: 10,
      hp: 50,
      maxHpBase: 100,
      faith: 100,
      resistances: new Map<DamageTag, number>([['holy', 100]]),
    });
    const ruleset = makeTestRuleset({ damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE });
    const cat = createCatalog({
      statusTypes: [],
      abilities: [cure],
      commandSets: [],
      classes: [knightClass()],
      items: [],
      rulesets: [ruleset],
    });
    const state = makeGameState({ units: [attacker, target] });
    const ctx = runDamagePipeline({
      state,
      catalog: cat,
      attacker,
      target,
      ability: cure,
      sourceActionSeq: 0,
      seed: 0,
      registry: defaultDamageHandlers,
    });
    // Faith 100/100 → factor 1.0 → MA × power = 20. Resistance skipped.
    expect(ctx.finalDamage).toBe(20);
  });

  it('resistance = 200 absorbs full base damage as healing (per ADR-0057, supersedes ADR-0022)', () => {
    const spell = basicSpell({ power_coefficient: 4 });
    const attacker = makeUnit({ id: 'a', spd: 10, ma: 5, faith: 100 });
    const absorbTarget = makeUnit({
      id: 'b',
      spd: 10,
      hp: 50,
      maxHpBase: 100,
      faith: 100,
      resistances: new Map<DamageTag, number>([['magical', 200]]),
    });
    const ruleset = makeTestRuleset({ damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE });
    const cat = createCatalog({
      statusTypes: [],
      abilities: [spell],
      commandSets: [],
      classes: [knightClass()],
      items: [],
      rulesets: [ruleset],
    });
    const state = makeGameState({ units: [attacker, absorbTarget] });
    const ctx = runDamagePipeline({
      state,
      catalog: cat,
      attacker,
      target: absorbTarget,
      ability: spell,
      sourceActionSeq: 0,
      seed: 0,
      registry: defaultDamageHandlers,
    });
    // Base damage = MA(5) × power(4) × Faith(1.0×1.0) = 20.
    // Resistance 200 → multiplier (100 - 200) / 100 = -1.0 → raw = -20.
    // clampMinMax detects absorption: tag-flip to healing; absorbed =
    // min(20, base=20) = 20; max-HP room = 50; finalDamage = 20.
    expect(ctx.finalDamage).toBe(20);
    expect(ctx.damageTags.has('healing')).toBe(true);
    expect(ctx.hit).toBe(true);
  });

  it('missing tag entries default to 0 resistance (no implicit immunity)', () => {
    const spell = basicSpell({ power_coefficient: 4 });
    const attacker = makeUnit({ id: 'a', spd: 10, ma: 5, faith: 100 });
    // Empty resistance map: every tag reads as 0.
    const target = makeUnit({ id: 'b', spd: 10, hp: 100, faith: 100 });
    const ruleset = makeTestRuleset({ damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE });
    const cat = createCatalog({
      statusTypes: [],
      abilities: [spell],
      commandSets: [],
      classes: [knightClass()],
      items: [],
      rulesets: [ruleset],
    });
    const state = makeGameState({ units: [attacker, target] });
    const ctx = runDamagePipeline({
      state,
      catalog: cat,
      attacker,
      target,
      ability: spell,
      sourceActionSeq: 0,
      seed: 0,
      registry: defaultDamageHandlers,
    });
    // 20 × 1.0 = 20.
    expect(ctx.finalDamage).toBe(20);
  });
});

describe('runDamagePipeline — evasion check (ADR-0019)', () => {
  it('auto-hits when the ability omits hitRoll', () => {
    // No hitRoll on the ability → evasion_check short-circuits.
    const spell = basicSpell({ tags: ['physical', 'weapon'], power_coefficient: 4 });
    const attacker = makeUnit({ id: 'a', spd: 10, pa: 5 });
    // Target has 99 evasion in every facing — would always miss if rolled.
    const target = makeUnit({ id: 'b', spd: 10, hp: 100, classId: 'evasive' });
    const ruleset = makeTestRuleset({ damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE });
    const cat = createCatalog({
      statusTypes: [],
      abilities: [spell],
      commandSets: [],
      classes: [knightClass(), evasiveClass({ front: 99, side: 99, back: 99 })],
      items: [],
      rulesets: [ruleset],
    });
    const state = makeGameState({ units: [attacker, target] });
    const ctx = runDamagePipeline({
      state,
      catalog: cat,
      attacker,
      target,
      ability: spell,
      sourceActionSeq: 0,
      seed: 0,
      registry: defaultDamageHandlers,
    });
    expect(ctx.hit).toBe(true);
    expect(ctx.finalDamage).toBe(20);
  });

  it("magical-only damage skips the roll (no 'physical' tag → always lands)", () => {
    // hitRoll is present but tag set is purely magical → handler short-circuits.
    const spell: ActiveAbilityDefinition = {
      ...basicSpell({ tags: ['magical'], power_coefficient: 4 }),
      hitRoll: {},
    };
    const attacker = makeUnit({ id: 'a', spd: 10, ma: 5, faith: 100 });
    const target = makeUnit({ id: 'b', spd: 10, hp: 100, classId: 'evasive', faith: 100 });
    const ruleset = makeTestRuleset({ damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE });
    const cat = createCatalog({
      statusTypes: [],
      abilities: [spell],
      commandSets: [],
      classes: [knightClass(), evasiveClass({ front: 99, side: 99, back: 99 })],
      items: [],
      rulesets: [ruleset],
    });
    const state = makeGameState({ units: [attacker, target] });
    const ctx = runDamagePipeline({
      state,
      catalog: cat,
      attacker,
      target,
      ability: spell,
      sourceActionSeq: 0,
      seed: 0,
      registry: defaultDamageHandlers,
    });
    expect(ctx.hit).toBe(true);
    expect(ctx.finalDamage).toBe(20);
  });

  it('rolls against evasion when hitRoll is present and the tag is physical; high evasion produces miss across many seeds', () => {
    // Target with front evasion 90 → hit chance ~10% against frontal attack.
    // Roll across many seeds and expect at least one miss (ctx.hit = false).
    const spell: ActiveAbilityDefinition = {
      ...basicSpell({ tags: ['physical', 'weapon'], power_coefficient: 4 }),
      hitRoll: {},
    };
    const attacker = makeUnit({
      id: 'a',
      spd: 10,
      pa: 5,
      position: { x: 0, y: 0, layer: 0 },
    });
    // Target faces south (toward attacker is south of target) — i.e. attacker
    // at y=0, target at y=1, target facing 'N' so attacker is in *front*.
    const target = makeUnit({
      id: 'b',
      spd: 10,
      hp: 100,
      classId: 'evasive',
      position: { x: 0, y: 1, layer: 0 },
      facing: 'N',
    });
    const ruleset = makeTestRuleset({ damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE });
    const cat = createCatalog({
      statusTypes: [],
      abilities: [spell],
      commandSets: [],
      classes: [knightClass(), evasiveClass({ front: 90, side: 0, back: 0 })],
      items: [],
      rulesets: [ruleset],
    });
    const state = makeGameState({
      units: [attacker, target],
      map: flatMap(2, 2),
    });
    const seeds = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233];
    const outcomes = seeds.map((seed) =>
      runDamagePipeline({
        state,
        catalog: cat,
        attacker,
        target,
        ability: spell,
        sourceActionSeq: 0,
        seed,
        registry: defaultDamageHandlers,
      }),
    );
    const misses = outcomes.filter((c) => !c.hit).length;
    expect(misses).toBeGreaterThan(0);
    expect(misses).toBeLessThan(seeds.length);
  });

  it('ctx.hit = false produces finalDamage = 0 at finalize', () => {
    // Set evasion to 99 to nearly guarantee a miss; the [0.05, 1.0] clamp
    // keeps a 5% chance, so we pick a seed that produces a miss.
    // (Determinism: seed = 0 with our mulberry32 mixer is deterministic;
    // we can find a seed that misses.)
    const spell: ActiveAbilityDefinition = {
      ...basicSpell({ tags: ['physical', 'weapon'], power_coefficient: 4 }),
      hitRoll: {},
    };
    const attacker = makeUnit({ id: 'a', spd: 10, pa: 5 });
    const target = makeUnit({ id: 'b', spd: 10, hp: 100, classId: 'evasive' });
    const ruleset = makeTestRuleset({ damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE });
    const cat = createCatalog({
      statusTypes: [],
      abilities: [spell],
      commandSets: [],
      classes: [knightClass(), evasiveClass({ front: 99, side: 99, back: 99 })],
      items: [],
      rulesets: [ruleset],
    });
    const state = makeGameState({ units: [attacker, target] });
    // Try several seeds; the first one that misses verifies the hit→0 path.
    let foundMiss = false;
    for (const seed of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]) {
      const ctx = runDamagePipeline({
        state,
        catalog: cat,
        attacker,
        target,
        ability: spell,
        sourceActionSeq: 0,
        seed,
        registry: defaultDamageHandlers,
      });
      if (!ctx.hit) {
        expect(ctx.finalDamage).toBe(0);
        foundMiss = true;
        break;
      }
    }
    expect(foundMiss).toBe(true);
  });

  it('elevation modifier: attacker on higher tile gets +5% hit chance', () => {
    // Construct a 2-tile map where attacker stands on elevation 5 and
    // target on elevation 0. Run many seeds; the attacker-higher case
    // should land hits more often than attacker-lower for the same setup.
    const spell: ActiveAbilityDefinition = {
      ...basicSpell({ tags: ['physical', 'weapon'], power_coefficient: 4 }),
      hitRoll: { accuracy: 50 }, // mid-band so elevation +5% / -5% is observable
    };
    const ruleset = makeTestRuleset({ damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE });

    function landings(highElevAttacker: boolean): number {
      const attacker = makeUnit({
        id: 'a',
        spd: 10,
        pa: 5,
        position: { x: 0, y: 0, layer: 0 },
      });
      const target = makeUnit({
        id: 'b',
        spd: 10,
        hp: 100,
        classId: 'knight',
        position: { x: 0, y: 1, layer: 0 },
        facing: 'N',
      });
      const map = mapWith({
        width: 2,
        height: 2,
        tiles: [
          { x: 0, y: 0, elevation: highElevAttacker ? 5 : 0 },
          { x: 1, y: 0 },
          { x: 0, y: 1, elevation: highElevAttacker ? 0 : 5 },
          { x: 1, y: 1 },
        ],
      });
      const cat = createCatalog({
        statusTypes: [],
        abilities: [spell],
        commandSets: [],
        classes: [knightClass()],
        items: [],
        rulesets: [ruleset],
      });
      const state = makeGameState({ units: [attacker, target], map });
      let hits = 0;
      for (let seed = 0; seed < 200; seed++) {
        const ctx = runDamagePipeline({
          state,
          catalog: cat,
          attacker,
          target,
          ability: spell,
          sourceActionSeq: 0,
          seed,
          registry: defaultDamageHandlers,
        });
        if (ctx.hit) hits++;
      }
      return hits;
    }

    const highHits = landings(true);
    const lowHits = landings(false);
    // Strict: elevation advantage → more landings. The 5% elevation
    // modifier shifts roll-against-50% probability noticeably across 200
    // seeds.
    expect(highHits).toBeGreaterThan(lowHits);
  });

  it('back attacks read back-evasion (lower than front for the same target)', () => {
    // Attacker behind a target with front 90 / back 0. Hit lands every
    // seed because back evasion is 0.
    const spell: ActiveAbilityDefinition = {
      ...basicSpell({ tags: ['physical', 'weapon'], power_coefficient: 4 }),
      hitRoll: {},
    };
    const attacker = makeUnit({
      id: 'a',
      spd: 10,
      pa: 5,
      position: { x: 0, y: 0, layer: 0 },
    });
    // Target faces N; attacker is at (0, 0) and target at (0, 1) → attacker
    // is to the *north* of target → front. To put attacker at back, flip
    // facing: target facing 'S' means north is its back.
    const target = makeUnit({
      id: 'b',
      spd: 10,
      hp: 100,
      classId: 'evasive',
      position: { x: 0, y: 1, layer: 0 },
      facing: 'S',
    });
    const ruleset = makeTestRuleset({ damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE });
    const cat = createCatalog({
      statusTypes: [],
      abilities: [spell],
      commandSets: [],
      classes: [knightClass(), evasiveClass({ front: 90, side: 0, back: 0 })],
      items: [],
      rulesets: [ruleset],
    });
    const state = makeGameState({
      units: [attacker, target],
      map: flatMap(2, 2),
    });
    let allHit = true;
    for (let seed = 0; seed < 50; seed++) {
      const ctx = runDamagePipeline({
        state,
        catalog: cat,
        attacker,
        target,
        ability: spell,
        sourceActionSeq: 0,
        seed,
        registry: defaultDamageHandlers,
      });
      if (!ctx.hit) {
        allHit = false;
        break;
      }
    }
    expect(allHit).toBe(true);
  });
});

// Keep imports tidy.
void passiveHook;
