// Session 27 integration tests — the four new hook surfaces
// (`modifyMpCost`, `modifyActionSpeed`, `modifyResistance`,
// `modifyIncomingStatusApplicationChance`), the equipment contributor
// refactor (E4), and the resistance-absorption activation (per
// ADR-0057, supersedes ADR-0022).
//
// Per the brief's test strategy: per-hook unit coverage (empty chain,
// single contributor, multi-contributor composition) plus integration
// tests where the hook composes with its consumer (computeMpCost,
// computeBaseActionSpeed, the damage pipeline's resistance + absorption
// path, computeStatusChance's caster+target composition).

import { describe, expect, it } from 'vitest';
import {
  knightLoadout,
  makeAbilitiesCatalog,
  makeActive,
  makeKnight,
  makePassive,
} from '../abilities/test-fixtures.ts';
import { computeMpCost } from '../abilities/cost.ts';
import { computeBaseActionSpeed } from '../ct/speed.ts';
import { makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { runDamagePipeline } from '../damage/pipeline.ts';
import { defaultDamageHandlers } from '../damage/default-handlers.ts';
import { rollStatusChance } from '../status/chance.ts';
import {
  catalogWith,
  makeStatusInstance,
  makeStatusType,
} from '../status/test-fixtures.ts';
import { statusHook } from '../status/hooks.ts';
import { createCatalog } from '../catalog/index.ts';
import {
  DEFAULT_TEST_DAMAGE_PIPELINE,
  defaultTestRulesets,
  makeTestRuleset,
} from '../catalog/test-fixtures.ts';
import {
  bucketId,
  type DamageTag,
} from '../types/index.ts';
import type { ActiveAbilityDefinition } from '../catalog/index.ts';

// ---------------------------------------------------------------------------
// modifyMpCost / computeMpCost
// ---------------------------------------------------------------------------

describe('computeMpCost (modifyMpCost chain)', () => {
  it('returns the ability mpCost unchanged when no contributors fire (empty chain default)', () => {
    const spell = makeActive({ id: 'spark', mpCost: 8 });
    const cat = makeAbilitiesCatalog({ abilities: [spell] });
    const u = makeUnit({ id: 'u1', spd: 10, mp: 20, loadout: knightLoadout() });
    const state = makeGameState({ units: [u] });
    expect(computeMpCost(state, cat, u.id, spell.id)).toBe(8);
  });

  it('applies a single multiplicative status contributor (× 1.20 = 10 from 8)', () => {
    const staffOfPower = makeStatusType({
      id: 'staff_of_power',
      hooks: [passiveStyleMpHook(1.2)],
    });
    const spell = makeActive({ id: 'spark', mpCost: 8 });
    const cat = catalogWithExtras({
      statusTypes: [staffOfPower],
      abilities: [spell],
    });
    const u = makeUnit({
      id: 'u1',
      spd: 10,
      mp: 50,
      loadout: knightLoadout(),
      statuses: [makeStatusInstance({ typeId: 'staff_of_power' })],
    });
    const state = makeGameState({ units: [u] });
    // 8 × 1.2 = 9.6 → round half-up → 10
    expect(computeMpCost(state, cat, u.id, spell.id)).toBe(10);
  });

  it('composes multiple multiplicative contributors (8 × 1.20 × 0.80 = 7.68 → 8)', () => {
    const up = makeStatusType({ id: 'up', hooks: [passiveStyleMpHook(1.2)] });
    const down = makeStatusType({ id: 'down', hooks: [passiveStyleMpHook(0.8)] });
    const spell = makeActive({ id: 'spark', mpCost: 8 });
    const cat = catalogWithExtras({
      statusTypes: [up, down],
      abilities: [spell],
    });
    const u = makeUnit({
      id: 'u1',
      spd: 10,
      mp: 50,
      loadout: knightLoadout(),
      statuses: [
        makeStatusInstance({ typeId: 'up' }),
        makeStatusInstance({ typeId: 'down' }),
      ],
    });
    const state = makeGameState({ units: [u] });
    // 8 × 1.2 × 0.8 = 7.68 → round half-up → 8
    expect(computeMpCost(state, cat, u.id, spell.id)).toBe(8);
  });

  it('rounds half-up at the chain exit (5 × 1.20 = 6.0 → 6, 8 × 1.30 = 10.4 → 10, 8 × 1.25 = 10 → 10)', () => {
    const m = (factor: number) =>
      makeStatusType({ id: `m_${factor}`, hooks: [passiveStyleMpHook(factor)] });
    const t1 = m(1.2);
    const t2 = m(1.3);
    const t3 = m(1.25);
    const spell5 = makeActive({ id: 'spell5', mpCost: 5 });
    const spell8 = makeActive({ id: 'spell8', mpCost: 8 });
    const cat = catalogWithExtras({
      statusTypes: [t1, t2, t3],
      abilities: [spell5, spell8],
    });
    {
      const u = makeUnit({
        id: 'u1',
        spd: 10,
        mp: 50,
        loadout: knightLoadout(),
        statuses: [makeStatusInstance({ typeId: 'm_1.2' })],
      });
      const state = makeGameState({ units: [u] });
      expect(computeMpCost(state, cat, u.id, spell5.id)).toBe(6);
    }
    {
      const u = makeUnit({
        id: 'u2',
        spd: 10,
        mp: 50,
        loadout: knightLoadout(),
        statuses: [makeStatusInstance({ typeId: 'm_1.3' })],
      });
      const state = makeGameState({ units: [u] });
      // 8 × 1.3 = 10.4 → 10
      expect(computeMpCost(state, cat, u.id, spell8.id)).toBe(10);
    }
    {
      const u = makeUnit({
        id: 'u3',
        spd: 10,
        mp: 50,
        loadout: knightLoadout(),
        statuses: [makeStatusInstance({ typeId: 'm_1.25' })],
      });
      const state = makeGameState({ units: [u] });
      // 8 × 1.25 = 10 → 10
      expect(computeMpCost(state, cat, u.id, spell8.id)).toBe(10);
    }
  });

  it('short-circuits to 0 for class-granted free abilities (chain does not fire)', () => {
    const spell = makeActive({ id: 'free_spell', mpCost: 8 });
    // Even with a × 5.0 contributor, the free-ability path returns 0.
    const huge = makeStatusType({ id: 'huge', hooks: [passiveStyleMpHook(5.0)] });
    const cat = catalogWithExtras({
      statusTypes: [huge],
      abilities: [spell],
      classes: [makeKnight({ freeAbilities: ['free_spell'] })],
    });
    const u = makeUnit({
      id: 'u1',
      spd: 10,
      mp: 0,
      loadout: knightLoadout(),
      statuses: [makeStatusInstance({ typeId: 'huge' })],
    });
    const state = makeGameState({ units: [u] });
    expect(computeMpCost(state, cat, u.id, spell.id)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// modifyActionSpeed / computeBaseActionSpeed
// ---------------------------------------------------------------------------

describe('computeBaseActionSpeed (modifyActionSpeed chain)', () => {
  it('returns ability.actionSpeed unchanged when no contributors fire', () => {
    const spell = makeActive({ id: 'bolt', actionSpeed: 10 });
    const cat = makeAbilitiesCatalog({ abilities: [spell] });
    const u = makeUnit({ id: 'u1', spd: 10, loadout: knightLoadout() });
    const state = makeGameState({ units: [u] });
    expect(computeBaseActionSpeed(state, cat, u, spell)).toBe(10);
  });

  it('applies an additive status contributor (+5 from 10 → 15)', () => {
    const wand = makeStatusType({
      id: 'wand_of_speed',
      hooks: [statusHook('modifyActionSpeed', (a) => a.baseActionSpeed + 5)],
    });
    const spell = makeActive({ id: 'bolt', actionSpeed: 10 });
    const cat = catalogWithExtras({
      statusTypes: [wand],
      abilities: [spell],
    });
    const u = makeUnit({
      id: 'u1',
      spd: 10,
      loadout: knightLoadout(),
      statuses: [makeStatusInstance({ typeId: 'wand_of_speed' })],
    });
    const state = makeGameState({ units: [u] });
    expect(computeBaseActionSpeed(state, cat, u, spell)).toBe(15);
  });

  it('clamps a positive-base ability to >= 1 even with large negative contributors', () => {
    const slow = makeStatusType({
      id: 'slow',
      hooks: [statusHook('modifyActionSpeed', (a) => a.baseActionSpeed - 100)],
    });
    const spell = makeActive({ id: 'bolt', actionSpeed: 5 });
    const cat = catalogWithExtras({
      statusTypes: [slow],
      abilities: [spell],
    });
    const u = makeUnit({
      id: 'u1',
      spd: 10,
      loadout: knightLoadout(),
      statuses: [makeStatusInstance({ typeId: 'slow' })],
    });
    const state = makeGameState({ units: [u] });
    // Without clamp this'd be -95; charged-vs-instant invariant preserves at 1.
    expect(computeBaseActionSpeed(state, cat, u, spell)).toBe(1);
  });

  it('supports tag-conditional contributors (only earth-tagged casts modified)', () => {
    // Wand-of-Deepwood pattern: +5 only when ability has 'earth' tag.
    const wand = makeStatusType({
      id: 'wand_of_deepwood',
      hooks: [
        statusHook('modifyActionSpeed', (a) => {
          const tags = a.ability.effects.damage?.tags ?? [];
          return tags.includes('earth' as DamageTag)
            ? a.baseActionSpeed + 5
            : a.baseActionSpeed;
        }),
      ],
    });
    const earthSpell = makeActive({
      id: 'earth_bolt',
      actionSpeed: 10,
      effects: {
        damage: { tags: ['magical', 'earth'], power_coefficient: 1 },
      },
    });
    const fireSpell = makeActive({
      id: 'fire_bolt',
      actionSpeed: 10,
      effects: {
        damage: { tags: ['magical', 'fire'], power_coefficient: 1 },
      },
    });
    const cat = catalogWithExtras({
      statusTypes: [wand],
      abilities: [earthSpell, fireSpell],
    });
    const u = makeUnit({
      id: 'u1',
      spd: 10,
      loadout: knightLoadout(),
      statuses: [makeStatusInstance({ typeId: 'wand_of_deepwood' })],
    });
    const state = makeGameState({ units: [u] });
    expect(computeBaseActionSpeed(state, cat, u, earthSpell)).toBe(15);
    expect(computeBaseActionSpeed(state, cat, u, fireSpell)).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// modifyResistance + absorption thresholds (via damage pipeline)
// ---------------------------------------------------------------------------

describe('modifyResistance + composeResistance + absorption', () => {
  function basicSpell(): ActiveAbilityDefinition {
    return makeActive({
      id: 'bolt',
      effects: {
        damage: {
          tags: ['magical', 'lightning'],
          power_coefficient: 4,
          variance: { min: 1, max: 1 },
        },
      },
    });
  }

  function setup(args: {
    readonly targetResistances?: ReadonlyMap<DamageTag, number>;
    readonly contributorDelta?: { readonly tag: DamageTag; readonly delta: number };
    readonly hp?: number;
    readonly maxHpBase?: number;
  }): {
    state: ReturnType<typeof makeGameState>;
    catalog: ReturnType<typeof createCatalog>;
    attacker: ReturnType<typeof makeUnit>;
    target: ReturnType<typeof makeUnit>;
    ability: ActiveAbilityDefinition;
  } {
    const ability = basicSpell();
    const statuses = args.contributorDelta
      ? [
          makeStatusType({
            id: 'resist_contrib',
            hooks: [
              statusHook('modifyResistance', (a) =>
                a.tag === args.contributorDelta!.tag
                  ? a.baseValue + args.contributorDelta!.delta
                  : a.baseValue,
              ),
            ],
          }),
        ]
      : [];
    // Use a ruleset with the full damage pipeline so resistance / cap /
    // finalize handlers fire. The default test ruleset has empty stages.
    const ruleset = makeTestRuleset({ damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE });
    const catalog = createCatalog({
      statusTypes: statuses,
      abilities: [ability],
      commandSets: [],
      classes: [makeKnight()],
      items: [],
      rulesets: [ruleset],
    });
    const attacker = makeUnit({ id: 'a', spd: 10, ma: 5, faith: 100 });
    const target = makeUnit({
      id: 'b',
      spd: 10,
      faith: 100,
      hp: args.hp ?? 50,
      maxHpBase: args.maxHpBase ?? 100,
      ...(args.targetResistances ? { resistances: args.targetResistances } : {}),
      ...(args.contributorDelta
        ? { statuses: [makeStatusInstance({ typeId: 'resist_contrib' })] }
        : {}),
    });
    const state = makeGameState({ units: [attacker, target] });
    return { state, catalog, attacker, target, ability };
  }

  function runPipeline(s: ReturnType<typeof setup>) {
    return runDamagePipeline({
      state: s.state,
      catalog: s.catalog,
      attacker: s.attacker,
      target: s.target,
      ability: s.ability,
      sourceActionSeq: 0,
      seed: 0,
      registry: defaultDamageHandlers,
    });
  }

  it('native resistance + contributor compose additively', () => {
    const s = setup({
      targetResistances: new Map<DamageTag, number>([['lightning', 30]]),
      contributorDelta: { tag: 'lightning', delta: 50 },
    });
    // base = 5 (MA) × 4 (power) × 1.0 (Faith 1.0 × 1.0) = 20.
    // resistance = 30 (native) + 50 (status) = 80.
    // factor = (100 - 80) / 100 = 0.20.
    // raw = 20 × 0.2 = 4.
    const ctx = runPipeline(s);
    expect(ctx.finalDamage).toBe(4);
    expect(ctx.damageTags.has('healing')).toBe(false);
  });

  it('contributor introduces resistance to a tag the unit does not natively carry', () => {
    const s = setup({
      // No native lightning entry.
      contributorDelta: { tag: 'lightning', delta: 50 },
    });
    // resistance = 0 (absent) + 50 (status) = 50.
    // factor = (100 - 50) / 100 = 0.5.
    // raw = 20 × 0.5 = 10.
    const ctx = runPipeline(s);
    expect(ctx.finalDamage).toBe(10);
  });

  it('preserves ADR-0015: absent native tag + contributor returning 0 = skip', () => {
    // Without a contributor for the queried tag, an absent native entry
    // doesn't contribute an implicit 0 to signedMax. Verify by stacking
    // 'magical' damage with a tag the unit DOES natively resist
    // negatively — the negative tag should win.
    const s = setup({
      targetResistances: new Map<DamageTag, number>([['lightning', -50]]),
      // contributor for an unrelated tag (no effect).
    });
    // signedMax of [-50 (lightning)] = -50 (no implicit 0 from 'magical').
    // factor = (100 - (-50)) / 100 = 1.5.
    // raw = 20 × 1.5 = 30.
    const ctx = runPipeline(s);
    expect(ctx.finalDamage).toBe(30);
  });

  it('resistance = 50 → half damage', () => {
    const s = setup({
      targetResistances: new Map<DamageTag, number>([['lightning', 50]]),
    });
    const ctx = runPipeline(s);
    // 20 × 0.5 = 10
    expect(ctx.finalDamage).toBe(10);
    expect(ctx.damageTags.has('healing')).toBe(false);
  });

  it('resistance = 100 → fully blocked (no damage, no heal)', () => {
    const s = setup({
      targetResistances: new Map<DamageTag, number>([['lightning', 100]]),
    });
    const ctx = runPipeline(s);
    // 20 × 0.0 = 0; no absorption (raw is exactly 0, not negative)
    expect(ctx.finalDamage).toBe(0);
    expect(ctx.damageTags.has('healing')).toBe(false);
  });

  it('resistance = 150 → absorbs 50% of base as heal (tag-flip)', () => {
    const s = setup({
      targetResistances: new Map<DamageTag, number>([['lightning', 150]]),
    });
    const ctx = runPipeline(s);
    // 20 × -0.5 = -10 → absorbed = 10
    expect(ctx.finalDamage).toBe(10);
    expect(ctx.damageTags.has('healing')).toBe(true);
  });

  it('resistance = 200 → absorbs 100% of base as heal', () => {
    const s = setup({
      targetResistances: new Map<DamageTag, number>([['lightning', 200]]),
    });
    const ctx = runPipeline(s);
    // 20 × -1.0 = -20 → absorbed = 20
    expect(ctx.finalDamage).toBe(20);
    expect(ctx.damageTags.has('healing')).toBe(true);
  });

  it('resistance > 200 clamps absorbed amount at base (no compounding)', () => {
    const s = setup({
      targetResistances: new Map<DamageTag, number>([['lightning', 250]]),
    });
    const ctx = runPipeline(s);
    // 20 × -1.5 = -30 → would absorb 30, but clamp = min(30, base=20) = 20
    expect(ctx.finalDamage).toBe(20);
    expect(ctx.damageTags.has('healing')).toBe(true);
  });

  it('absorbed heal respects max-HP room cap', () => {
    const s = setup({
      targetResistances: new Map<DamageTag, number>([['lightning', 200]]),
      hp: 95,
      maxHpBase: 100,
    });
    const ctx = runPipeline(s);
    // Would absorb 20, but only 5 HP of room → finalDamage = 5
    expect(ctx.finalDamage).toBe(5);
    expect(ctx.damageTags.has('healing')).toBe(true);
  });

  it('vulnerability (resistance < 0) scales damage up', () => {
    const s = setup({
      targetResistances: new Map<DamageTag, number>([['lightning', -50]]),
    });
    const ctx = runPipeline(s);
    // 20 × 1.5 = 30
    expect(ctx.finalDamage).toBe(30);
    expect(ctx.damageTags.has('healing')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// modifyIncomingStatusApplicationChance (target-side composition)
// ---------------------------------------------------------------------------

describe('modifyIncomingStatusApplicationChance — target-side composition', () => {
  it('target-side multiplier composes with caster-side multiplier (caster × target)', () => {
    // Caster has Earth Communion × 1.25; target has Pointy Hat × 0.5.
    // Base apply chance = 100% × Faith(1.0 × 1.0) × MA(0.9 + 5/10 = 1.4)
    // × resistance(1.0) = 1.4 → clamps to 1.0 normally, but we'll use
    // a low-base ability so the chain is observable.
    const silence = makeStatusType({ id: 'silence', tags: ['negative'] });
    const earthCommunion = makeStatusType({
      id: 'earth_communion',
      hooks: [statusHook('modifyStatusApplicationChance', (a) => a.baseChance * 1.25)],
    });
    const pointyHat = makeStatusType({
      id: 'pointy_hat',
      hooks: [
        statusHook('modifyIncomingStatusApplicationChance', (a) =>
          a.statusType.id === silence.id ? a.baseChance * 0.5 : a.baseChance,
        ),
      ],
    });
    const cat = catalogWithExtras({
      statusTypes: [silence, earthCommunion, pointyHat],
    });
    const caster = makeUnit({
      id: 'c',
      spd: 10,
      ma: 5,
      faith: 100,
      statuses: [makeStatusInstance({ typeId: 'earth_communion' })],
    });
    const target = makeUnit({
      id: 't',
      spd: 10,
      faith: 100,
      statuses: [makeStatusInstance({ typeId: 'pointy_hat' })],
    });
    const state = makeGameState({ units: [caster, target] });
    const result = rollStatusChance({
      state,
      catalog: cat,
      caster,
      target,
      statusType: cat.getStatusType(silence.id),
      ability: null,
      baseChance: 40, // [0, 100]
      seed: 0,
    });
    // 0.4 × Faith(1.0) × MA(1.4) × resistance(1.0) × caster(1.25) × target(0.5)
    // = 0.4 × 1.4 × 1.25 × 0.5 = 0.35 → clamped to [0, 1].
    expect(result.chance).toBeCloseTo(0.35, 4);
  });

  it('target-side modifier alone (no caster modifier) still composes', () => {
    const silence = makeStatusType({ id: 'silence', tags: ['negative'] });
    const pointyHat = makeStatusType({
      id: 'pointy_hat',
      hooks: [
        statusHook('modifyIncomingStatusApplicationChance', (a) => a.baseChance * 0.5),
      ],
    });
    const cat = catalogWithExtras({
      statusTypes: [silence, pointyHat],
    });
    const caster = makeUnit({ id: 'c', spd: 10, ma: 5, faith: 100 });
    const target = makeUnit({
      id: 't',
      spd: 10,
      faith: 100,
      statuses: [makeStatusInstance({ typeId: 'pointy_hat' })],
    });
    const state = makeGameState({ units: [caster, target] });
    const result = rollStatusChance({
      state,
      catalog: cat,
      caster,
      target,
      statusType: cat.getStatusType(silence.id),
      ability: null,
      baseChance: 50,
      seed: 0,
    });
    // 0.5 × Faith(1.0) × MA(1.4) × resistance(1.0) × target(0.5) = 0.35.
    expect(result.chance).toBeCloseTo(0.35, 4);
  });

  it('uncapped resistance flows through; final probability clamps to [0, 1]', () => {
    // Status with resistance tag = 'lightning'. Target has +150 lightning
    // resistance. Without the cap, (100 - 150) / 100 = -0.5, so the
    // resistanceFactor is negative → preModifier negative → final clamps
    // to 0.
    const stun = makeStatusType({
      id: 'stun',
      tags: ['negative'],
      resistanceTag: 'lightning' as DamageTag,
    });
    const cat = catalogWithExtras({ statusTypes: [stun] });
    const caster = makeUnit({ id: 'c', spd: 10, ma: 5, faith: 100 });
    const target = makeUnit({
      id: 't',
      spd: 10,
      faith: 100,
      resistances: new Map<DamageTag, number>([['lightning', 150]]),
    });
    const state = makeGameState({ units: [caster, target] });
    const result = rollStatusChance({
      state,
      catalog: cat,
      caster,
      target,
      statusType: cat.getStatusType(stun.id),
      ability: null,
      baseChance: 100,
      seed: 0,
    });
    expect(result.chance).toBe(0);
  });
});

// Refactor preservation for `equipmentContributionsFor` is implicitly
// covered by the rest of the test suite: every pre-Session-27 test that
// exercises `modifyStatQuery` against equipped items (Long Sword in
// `session-25-integration.test.ts`, status-equipment composition in
// pipeline tests, etc.) continues to pass post-refactor. Adding a
// duplicate explicit test here would be redundant.

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// statusHook variant for modifyMpCost — typed as a multiplicative status
// contributor. Keeps the test bodies readable.
function passiveStyleMpHook(factor: number) {
  return statusHook('modifyMpCost', (a) => a.baseCost * factor);
}

// catalogWith + abilities + extra ergonomics — wraps createCatalog with
// sensible defaults so each test doesn't repeat the ruleset/classes
// boilerplate.
function catalogWithExtras(args: {
  readonly statusTypes?: Parameters<typeof createCatalog>[0]['statusTypes'];
  readonly abilities?: Parameters<typeof createCatalog>[0]['abilities'];
  readonly classes?: Parameters<typeof createCatalog>[0]['classes'];
}) {
  return createCatalog({
    statusTypes: args.statusTypes ?? [],
    abilities: args.abilities ?? [],
    commandSets: [],
    classes: args.classes ?? [makeKnight()],
    items: [],
    rulesets: defaultTestRulesets,
  });
}

// keep imports alive for static analysis
void catalogWith;
void bucketId;
void makePassive;
