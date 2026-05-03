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
} from '@engine/index.ts';
import { defaultDamageHandlers } from './default-handlers.ts';
import { runDamagePipeline } from './pipeline.ts';

function knightClass(): ClassDefinition {
  return {
    id: classId('knight'),
    name: 'Knight',
    movement: { moveRange: 3, jump: 2, terrainCosts: new Map(), canEnter: new Set(['ground']) },
    firstActionCommandSet: commandSetId('battle_skill'),
    freeAbilities: new Set(),
  };
}

function basicAttack(power = 4): ActiveAbilityDefinition {
  return {
    id: abilityId('attack'),
    name: 'Attack',
    kind: 'active',
    bucket: bucketId('first_action'),
    baseCost: 1,
    targeting: { kind: 'single_unit', range: { horizontal: 1, vertical: 3 }, rangeMode: 'melee' },
    chargeTicks: 0,
    mpCost: 0,
    effects: { damage: { tags: ['physical', 'weapon'], power } },
  };
}

function basicCure(power = 5): ActiveAbilityDefinition {
  return {
    id: abilityId('cure'),
    name: 'Cure',
    kind: 'active',
    bucket: bucketId('second_action'),
    baseCost: 1,
    targeting: { kind: 'single_unit', range: { horizontal: 4, vertical: 3 }, rangeMode: 'arc' },
    chargeTicks: 0,
    mpCost: 4,
    effects: { damage: { tags: ['holy', 'healing'], power } },
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
    // healing_base ran (ma × power = 20), physical_pa_wp short-circuited.
    expect(ctx.baseDamage).toBe(20);
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
        damage: { tags: ['physical', 'weapon'], power: 4, variance: { min: 0.5, max: 1.5 } },
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
        damage: { tags: ['physical', 'weapon'], power: 4, variance: { min: 0.5, max: 1.5 } },
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

// Keep imports tidy.
void passiveHook;
