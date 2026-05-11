// Projection contract tests — assert that `projectExpectedDamage` matches
// either the closed-form expected value OR the empirical mean of N live
// `runDamagePipeline` runs (the drift guard).
//
// The drift guard is the load-bearing test: when a future content change
// adds a new random handler, this test breaks if no projection variant
// exists for it. That's the intended pressure — projection drift is a
// design concern, not an oversight.

import { describe, expect, it } from 'vitest';
import {
  abilityId,
  bucketId,
  classId,
  commandSetId,
  createCatalog,
  defaultDamageHandlers,
  runDamagePipeline,
  statusTypeId,
  type ActiveAbilityDefinition,
  type ClassDefinition,
} from '@engine/index.ts';
import {
  DEFAULT_TEST_DAMAGE_PIPELINE,
  defaultTestRulesets,
  makeTestRuleset,
} from '@engine/catalog/test-fixtures.ts';
import { makeGameState, makeUnit } from '@engine/ct/test-fixtures.ts';
import { makeStatusInstance, makeStatusType } from '@engine/status/test-fixtures.ts';
import { statusHook } from '@engine/status/hooks.ts';
import { projectExpectedDamage, projectDamageContext } from './projection.ts';

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

function evasiveClass(frontEvasion: number): ClassDefinition {
  return {
    id: classId('evader'),
    name: 'Evader',
    movement: { moveRange: 3, jump: 2, terrainCosts: new Map(), canEnter: new Set(['ground']) },
    evasion: { front: frontEvasion, side: frontEvasion, back: frontEvasion },
    equipmentSlots: { leftHand: true, rightHand: true, headgear: true, armor: true, accessory: true },
    firstActionCommandSet: commandSetId('battle_skill'),
    freeAbilities: new Set(),
  };
}

function physicalAttack(opts: {
  readonly power_coefficient?: number;
  readonly variance?: { readonly min: number; readonly max: number };
  readonly hitRoll?: boolean;
}): ActiveAbilityDefinition {
  const damage: ActiveAbilityDefinition['effects']['damage'] = {
    tags: ['physical'],
    power_coefficient: opts.power_coefficient ?? 4,
    ...(opts.variance !== undefined ? { variance: opts.variance } : {}),
  };
  return {
    id: abilityId('attack'),
    name: 'Attack',
    kind: 'active',
    bucket: bucketId('first_action'),
    baseCost: 1,
    targeting: { kind: 'single_unit', range: { horizontal: 1, vertical: 3 }, rangeMode: 'melee' },
    actionSpeed: 0,
    mpCost: 0,
    ...(opts.hitRoll === true ? { hitRoll: {} } : {}),
    effects: { damage },
  };
}

function magicalAttack(power_coefficient = 5): ActiveAbilityDefinition {
  return {
    id: abilityId('bolt'),
    name: 'Bolt',
    kind: 'active',
    bucket: bucketId('first_action'),
    baseCost: 1,
    targeting: { kind: 'single_unit', range: { horizontal: 4, vertical: 3 }, rangeMode: 'arc' },
    actionSpeed: 0,
    mpCost: 8,
    effects: { damage: { tags: ['magical'], power_coefficient } },
  };
}

function makeCatalog(opts: {
  readonly abilities: ReadonlyArray<ActiveAbilityDefinition>;
  readonly classes: ReadonlyArray<ClassDefinition>;
  readonly statusTypes?: ReadonlyArray<Parameters<typeof createCatalog>[0]['statusTypes'][number]>;
}) {
  const ruleset = makeTestRuleset({ damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE });
  return createCatalog({
    statusTypes: opts.statusTypes ?? [],
    abilities: opts.abilities,
    commandSets: [],
    classes: opts.classes,
    items: [],
    rulesets: [ruleset],
  });
}

describe('projectExpectedDamage — physical', () => {
  it('matches base formula for deterministic ability (no variance, no crit, no evasion)', () => {
    const attack = physicalAttack({ power_coefficient: 4 });
    const attacker = makeUnit({ id: 'a', spd: 10, pa: 5 });
    const target = makeUnit({ id: 'b', spd: 10, hp: 100 });
    const cat = makeCatalog({ abilities: [attack], classes: [knightClass()] });
    const state = makeGameState({ units: [attacker, target] });

    // Base formula: PA × WP × power_coefficient. WP defaults to 1 (unarmed)
    // when no weapon. 5 × 1 × 4 = 20.
    expect(projectExpectedDamage({ state, catalog: cat, attacker, target, ability: attack })).toBe(20);
  });

  it('returns 0 for an ability without a damage spec', () => {
    const debuffOnly: ActiveAbilityDefinition = {
      id: abilityId('mark'),
      name: 'Mark',
      kind: 'active',
      bucket: bucketId('first_action'),
      baseCost: 1,
      targeting: { kind: 'single_unit', range: { horizontal: 4, vertical: 3 }, rangeMode: 'arc' },
      actionSpeed: 0,
      mpCost: 6,
      effects: {
        statusEffects: [
          {
            typeId: statusTypeId('vulnerable'),
            target: 'primary_target',
            baseChance: 100,
          },
        ],
      },
    };
    const attacker = makeUnit({ id: 'a', spd: 10, ma: 7 });
    const target = makeUnit({ id: 'b', spd: 10, hp: 100 });
    const cat = makeCatalog({ abilities: [debuffOnly], classes: [knightClass()] });
    const state = makeGameState({ units: [attacker, target] });
    expect(projectExpectedDamage({ state, catalog: cat, attacker, target, ability: debuffOnly })).toBe(0);
  });
});

describe('projectExpectedDamage — variance midpoint', () => {
  it('applies (min + max) / 2 as the variance multiplier', () => {
    const attack = physicalAttack({
      power_coefficient: 4,
      variance: { min: 0.8, max: 1.2 },
    });
    const attacker = makeUnit({ id: 'a', spd: 10, pa: 5 });
    const target = makeUnit({ id: 'b', spd: 10, hp: 100 });
    const cat = makeCatalog({ abilities: [attack], classes: [knightClass()] });
    const state = makeGameState({ units: [attacker, target] });

    // Base 20 × midpoint 1.0 = 20.
    expect(projectExpectedDamage({ state, catalog: cat, attacker, target, ability: attack })).toBe(20);
  });

  it('asymmetric variance band shifts the projection toward the band midpoint', () => {
    const attack = physicalAttack({
      power_coefficient: 4,
      variance: { min: 1.0, max: 2.0 },
    });
    const attacker = makeUnit({ id: 'a', spd: 10, pa: 5 });
    const target = makeUnit({ id: 'b', spd: 10, hp: 100 });
    const cat = makeCatalog({ abilities: [attack], classes: [knightClass()] });
    const state = makeGameState({ units: [attacker, target] });

    // Base 20 × midpoint 1.5 = 30.
    expect(projectExpectedDamage({ state, catalog: cat, attacker, target, ability: attack })).toBe(30);
  });
});

describe('projectExpectedDamage — crit expectation', () => {
  it('appends E[crit_factor] = 1 + p × (mult - 1) when crit_chance > 0', () => {
    const attack = physicalAttack({ power_coefficient: 4 });
    const attacker = makeUnit({
      id: 'a', spd: 10, pa: 5,
      crit_chance: 20,
      crit_multiplier: 2.0,
    });
    const target = makeUnit({ id: 'b', spd: 10, hp: 100 });
    const cat = makeCatalog({ abilities: [attack], classes: [knightClass()] });
    const state = makeGameState({ units: [attacker, target] });

    // Base 20 × E[crit] = 20 × (1 + 0.2 × (2 - 1)) = 20 × 1.2 = 24.
    expect(projectExpectedDamage({ state, catalog: cat, attacker, target, ability: attack })).toBe(24);
  });

  it('clamps queried crit_chance at 100 (ADR-0034 / ADR-0042 read-site clamp)', () => {
    // crit_chance 200 (e.g., post-Crit_modifier runaway) must project at
    // most a guaranteed crit, not an over-unity factor. Pre-ADR-0042 the
    // projection's own clamp masked the issue; the shared `readCritChance`
    // helper now carries the clamp for both the runtime and projection.
    const attack = physicalAttack({ power_coefficient: 4 });
    const attacker = makeUnit({
      id: 'a', spd: 10, pa: 5,
      crit_chance: 200,
      crit_multiplier: 2.0,
    });
    const target = makeUnit({ id: 'b', spd: 10, hp: 100 });
    const cat = makeCatalog({ abilities: [attack], classes: [knightClass()] });
    const state = makeGameState({ units: [attacker, target] });

    // Base 20 × E[crit at clamped p=1] = 20 × (1 + 1 × (2 - 1)) = 40.
    expect(projectExpectedDamage({ state, catalog: cat, attacker, target, ability: attack })).toBe(40);
  });

  it('skips crit on healing-tagged abilities', () => {
    const heal: ActiveAbilityDefinition = {
      id: abilityId('cure'),
      name: 'Cure',
      kind: 'active',
      bucket: bucketId('second_action'),
      baseCost: 1,
      targeting: { kind: 'single_unit', range: { horizontal: 4, vertical: 3 }, rangeMode: 'arc' },
      actionSpeed: 0,
      mpCost: 4,
      effects: { damage: { tags: ['healing'], power_coefficient: 5 } },
    };
    const attacker = makeUnit({
      id: 'a', spd: 10, ma: 4,
      crit_chance: 50, crit_multiplier: 3.0,
    });
    const target = makeUnit({ id: 'b', spd: 10, hp: 50, maxHpBase: 100 });
    const cat = makeCatalog({ abilities: [heal], classes: [knightClass()] });
    const state = makeGameState({ units: [attacker, target] });

    // healing_base: ma × power × Faith_factor = 4 × 5 × 0.64 = 12.8 → floor 12.
    // No crit applied (skipped on 'healing'-tagged effects).
    expect(projectExpectedDamage({ state, catalog: cat, attacker, target, ability: heal })).toBe(12);
  });
});

describe('projectExpectedDamage — evasion expectation', () => {
  it('multiplies expected damage by the projected hit_chance', () => {
    const attack = physicalAttack({ power_coefficient: 4, hitRoll: true });
    const attacker = makeUnit({ id: 'a', spd: 10, pa: 5 });
    const target = makeUnit({
      id: 'b', spd: 10, hp: 100,
      classId: 'evader',
      // Place attacker S of target so attacker is "in front" of a target
      // facing N. Front evasion 30%.
      facing: 'N', position: { x: 5, y: 5, layer: 0 },
    });
    const attackerWithPos = { ...attacker, position: { x: 5, y: 6, layer: 0 } };
    const cat = makeCatalog({ abilities: [attack], classes: [evasiveClass(30)] });
    const state = makeGameState({
      units: [attackerWithPos, target],
      map: {
        width: 10, height: 10,
        tiles: Array.from({ length: 100 }, (_, i) => ({
          x: i % 10, y: Math.floor(i / 10), layer: 0, elevation: 0,
          terrain: 'ground' as const, properties: [],
        })),
      },
    });

    // Base 20, hit_chance = 1.0 (acc) × 0.7 (1 - 30/100) × 1.0 (elev) = 0.7.
    // Projected damage = 20 × 0.7 = 14.
    expect(projectExpectedDamage({
      state, catalog: cat, attacker: attackerWithPos, target, ability: attack,
    })).toBe(14);
  });

  it('skips evasion when the ability lacks hitRoll (auto-hit)', () => {
    const attack = physicalAttack({ power_coefficient: 4, hitRoll: false });
    const attacker = makeUnit({ id: 'a', spd: 10, pa: 5 });
    const target = makeUnit({ id: 'b', spd: 10, hp: 100, classId: 'evader' });
    const cat = makeCatalog({ abilities: [attack], classes: [evasiveClass(50)] });
    const state = makeGameState({ units: [attacker, target] });

    // No hitRoll → auto-hit → full damage 20 regardless of evasion.
    expect(projectExpectedDamage({ state, catalog: cat, attacker, target, ability: attack })).toBe(20);
  });
});

describe('projectExpectedDamage — Vulnerable amplification', () => {
  it("folds in target's onDamageReceived multiplier (Vulnerable ×1.5)", () => {
    // Use a generic "amplifier" status hook that mirrors Vulnerable's
    // ×1.5 multiplier. We don't import the live Vulnerable status because
    // its emittedActions slot would also try to remove the status — fine
    // for live runs, irrelevant for projection (the pipeline only reads
    // multipliers, not emissions).
    const amplifier = makeStatusType({
      id: 'amplifier',
      stackingRule: 'REFRESH',
      hooks: [
        statusHook('onDamageReceived', (args) => ({
          ...args.ctx,
          multipliers: [...args.ctx.multipliers, { source: 'amplifier', factor: 1.5 }],
        })),
      ],
    });
    const attack = physicalAttack({ power_coefficient: 4 });
    const attacker = makeUnit({ id: 'a', spd: 10, pa: 5 });
    const target = makeUnit({
      id: 'b', spd: 10, hp: 100,
      statuses: [makeStatusInstance({ typeId: 'amplifier' })],
    });
    const cat = makeCatalog({ abilities: [attack], classes: [knightClass()], statusTypes: [amplifier] });
    const state = makeGameState({ units: [attacker, target] });

    // Base 20 × 1.5 = 30.
    expect(projectExpectedDamage({ state, catalog: cat, attacker, target, ability: attack })).toBe(30);
  });
});

describe('projectExpectedDamage — chainBonus (AoE cluster scaling)', () => {
  it('targetCount > 1 raises the magical base via effective power_coefficient', () => {
    const chain: ActiveAbilityDefinition = {
      id: abilityId('chain'),
      name: 'Chain',
      kind: 'active',
      bucket: bucketId('first_action'),
      baseCost: 1,
      targeting: { kind: 'tile', range: { horizontal: 4, vertical: 3 }, rangeMode: 'arc' },
      actionSpeed: 0,
      mpCost: 16,
      effects: {
        damage: {
          tags: ['magical'],
          power_coefficient: 6,
          chainBonus: { powerPerAdditionalTarget: 2 },
        },
      },
    };
    const attacker = makeUnit({ id: 'a', spd: 10, ma: 8 });
    const target = makeUnit({ id: 'b', spd: 10, hp: 100 });
    const cat = makeCatalog({ abilities: [chain], classes: [knightClass()] });
    const state = makeGameState({ units: [attacker, target] });

    // Single-target: base = ma × power × Faith_factor = 8 × 6 × 0.64 = 30.72.
    expect(projectExpectedDamage({
      state, catalog: cat, attacker, target, ability: chain, targetCount: 1,
    })).toBe(30);

    // 3 targets: power = 6 + 2 × 2 = 10. Base = 8 × 10 × 0.64 = 51.2 → 51.
    expect(projectExpectedDamage({
      state, catalog: cat, attacker, target, ability: chain, targetCount: 3,
    })).toBe(51);
  });
});

describe('projectExpectedDamage — drift guard (vs live runDamagePipeline)', () => {
  // Empirically validate that the projection equals the average of N
  // live `runDamagePipeline` runs over different seeds. If a future
  // engine change adds a new random handler, the projection's deterministic
  // output will diverge from the empirical mean — this test is the
  // sentinel that catches the drift.
  function empiricalMean(opts: {
    readonly samples: number;
    readonly run: (seed: number) => number;
  }): number {
    let sum = 0;
    for (let i = 0; i < opts.samples; i++) sum += opts.run(i);
    return sum / opts.samples;
  }

  it('projection ≈ empirical mean for a varied physical attack with crit and evasion', () => {
    const attack = physicalAttack({
      power_coefficient: 4,
      variance: { min: 0.8, max: 1.2 },
      hitRoll: true,
    });
    const attacker = makeUnit({
      id: 'a', spd: 10, pa: 5,
      crit_chance: 20, crit_multiplier: 2.0,
      position: { x: 5, y: 6, layer: 0 },
    });
    const target = makeUnit({
      id: 'b', spd: 10, hp: 1000, // huge HP avoids cap
      classId: 'evader', facing: 'N',
      position: { x: 5, y: 5, layer: 0 },
    });
    const cat = makeCatalog({ abilities: [attack], classes: [evasiveClass(20)] });
    const state = makeGameState({
      units: [attacker, target],
      map: {
        width: 10, height: 10,
        tiles: Array.from({ length: 100 }, (_, i) => ({
          x: i % 10, y: Math.floor(i / 10), layer: 0, elevation: 0,
          terrain: 'ground' as const, properties: [],
        })),
      },
    });

    const projected = projectExpectedDamage({ state, catalog: cat, attacker, target, ability: attack });

    // 600 samples → tight enough to assert within ±3.5% of mean (3σ for ~p=0.8 hits).
    const mean = empiricalMean({
      samples: 600,
      run: (seed) => {
        const ctx = runDamagePipeline({
          state, catalog: cat, attacker, target, ability: attack,
          sourceActionSeq: 0, seed, registry: defaultDamageHandlers,
        });
        return ctx.finalDamage ?? 0;
      },
    });

    // Tolerance: ±15% of projection, roomy enough for finite-sample
    // variance but tight enough to catch a missing handler.
    expect(Math.abs(projected - mean) / projected).toBeLessThan(0.15);
  });

  it('projection ≈ empirical mean for a magical attack with crit (no evasion)', () => {
    const bolt = magicalAttack(5);
    const attacker = makeUnit({
      id: 'a', spd: 10, ma: 7,
      crit_chance: 15, crit_multiplier: 2.5,
    });
    const target = makeUnit({ id: 'b', spd: 10, hp: 1000 });
    const cat = makeCatalog({ abilities: [bolt], classes: [knightClass()] });
    const state = makeGameState({ units: [attacker, target] });

    const projected = projectExpectedDamage({ state, catalog: cat, attacker, target, ability: bolt });
    const mean = empiricalMean({
      samples: 600,
      run: (seed) => {
        const ctx = runDamagePipeline({
          state, catalog: cat, attacker, target, ability: bolt,
          sourceActionSeq: 0, seed, registry: defaultDamageHandlers,
        });
        return ctx.finalDamage ?? 0;
      },
    });

    // Magical lands every time, so only crit varies — tighter tolerance.
    expect(Math.abs(projected - mean) / projected).toBeLessThan(0.10);
  });
});

describe('projectDamageContext', () => {
  it('returns the full context including stage-applied multipliers', () => {
    const attack = physicalAttack({ power_coefficient: 4 });
    const attacker = makeUnit({
      id: 'a', spd: 10, pa: 5,
      crit_chance: 10, crit_multiplier: 2.0,
    });
    const target = makeUnit({ id: 'b', spd: 10, hp: 100 });
    const cat = makeCatalog({ abilities: [attack], classes: [knightClass()] });
    const state = makeGameState({ units: [attacker, target] });

    const ctx = projectDamageContext({ state, catalog: cat, attacker, target, ability: attack });
    expect(ctx.baseDamage).toBe(20);
    // Crit factor 1 + 0.1 × (2 - 1) = 1.1 should appear as a multiplier.
    expect(ctx.multipliers.some((m) => m.source === 'crit' && Math.abs(m.factor - 1.1) < 1e-9)).toBe(true);
    expect(ctx.finalDamage).toBe(22);
  });
});

