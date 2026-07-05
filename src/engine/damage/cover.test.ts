// TABA Seam 2 — cover primitive tests.
//
// Three layers: the `coverRedirect` pipeline handler (finder + fraction +
// emission), the full pipeline (ally's hit reduced + redirect emitted), and
// `reduceCoverRedirect` (the bearer soaks through their OWN mitigation, KO
// handling, and cleanliness against a Counter-equipped tank).

import { createCatalog } from '../catalog/index.ts';
import { makeTestRuleset, DEFAULT_TEST_DAMAGE_PIPELINE } from '../catalog/test-fixtures.ts';
import { makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { loadoutOf } from '../abilities/test-fixtures.ts';
import { compileReactionAbility } from '../abilities/reaction-compiler.ts';
import {
  abilityId,
  bucketId,
  classId,
  commandSetId,
  unitId,
  type ActiveAbilityDefinition,
  type ClassDefinition,
  type DamageContext,
  type DamageTag,
  type GameState,
  type PassiveAbilityDefinition,
  type Action,
} from '@engine/index.ts';
import { defaultDamageHandlers } from './default-handlers.ts';
import { coverRedirect } from './cover.ts';
import { runDamagePipeline } from './pipeline.ts';
import { reduceCoverRedirect } from '../actions/reducers.ts';
import type { PipelineEnv } from './registry.ts';

const BUCKET_SUPPORT = bucketId('support');

function knightClass(): ClassDefinition {
  return {
    id: classId('knight'),
    name: 'Knight',
    movement: { moveRange: 3, jump: 2, terrainCosts: new Map(), canEnter: new Set(['ground']) },
    evasion: { front: 0, side: 0, back: 0 },
    equipmentSlots: { leftHand: true, rightHand: true, headgear: true, armor: true, accessory: true },
    firstActionCommandSet: commandSetId('battle_skill'),
    freeAbilities: new Set(),
    dominantStat: 'pa',
  };
}

const ATTACK: ActiveAbilityDefinition = {
  id: abilityId('attack'),
  name: 'Attack',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'hidden',
  targeting: { kind: 'single_unit', range: { horizontal: 1, vertical: 3 }, rangeMode: 'melee' },
  actionSpeed: 0,
  mpCost: 0,
  effects: { damage: { tags: ['physical', 'weapon'], power_coefficient: 4 } },
};

// A cover passive: 10 % redirect per tier, strict adjacency, vertical tol 3.
function coverPassive(params?: {
  readonly redirectPerTier?: number;
  readonly range?: number;
  readonly verticalTolerance?: number;
  readonly maxFraction?: number;
}): PassiveAbilityDefinition {
  return {
    id: abilityId('test_cover'),
    name: 'Test Cover',
    kind: 'passive',
    bucket: BUCKET_SUPPORT,
    baseCost: 0,
    availability: 'available',
    hooks: [],
    coverParams: {
      redirectPerTier: params?.redirectPerTier ?? 0.1,
      range: params?.range ?? 1,
      verticalTolerance: params?.verticalTolerance ?? 3,
      ...(params?.maxFraction !== undefined ? { maxFraction: params.maxFraction } : {}),
    },
  };
}

const COVER_LOADOUT = loadoutOf({ passive: [[BUCKET_SUPPORT, [abilityId('test_cover')]]] });

// A minimal DamageContext for a raw base hit on `targetId` by `attackerId`.
function ctxFor(attackerId: string, target: DamageContext['target'], baseDamage: number): DamageContext {
  return {
    attacker: makeUnit({ id: attackerId, spd: 10, team: 'team_b', position: { x: 5, y: 0, layer: 0 } }),
    target,
    sourceActionSeq: 0,
    sourceAbilityId: ATTACK.id,
    damageTags: new Set<DamageTag>(['physical', 'weapon']),
    baseDamage,
    multipliers: [],
    additives: [],
    variance: { min: 1, max: 1 },
    hit: true,
    targetCount: 1,
  };
}

function catalogWithCover(pass: PassiveAbilityDefinition = coverPassive()) {
  return createCatalog({
    statusTypes: [],
    abilities: [ATTACK, pass],
    commandSets: [],
    classes: [knightClass()],
    items: [],
    rulesets: [makeTestRuleset({ damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE })],
  });
}

describe('coverRedirect handler — finder + fraction + emission', () => {
  function scenario(over: {
    readonly scenarioTier?: number;
    readonly coverPos?: { x: number; y: number; layer: number };
    readonly coverTeam?: string;
    readonly coverHp?: number;
    readonly pass?: PassiveAbilityDefinition;
  } = {}) {
    const pass = over.pass ?? coverPassive();
    const cat = catalogWithCover(pass);
    const ally = makeUnit({ id: 'ally', spd: 10, team: 'team_a', position: { x: 0, y: 0, layer: 0 }, hp: 100, maxHpBase: 100 });
    const cover = makeUnit({
      id: 'chris',
      spd: 10,
      team: over.coverTeam ?? 'team_a',
      position: over.coverPos ?? { x: 1, y: 0, layer: 0 },
      hp: over.coverHp ?? 100,
      maxHpBase: 100,
      loadout: COVER_LOADOUT,
    });
    const base = makeGameState({ units: [ally, cover] });
    const state: GameState = { ...base, scenarioTier: over.scenarioTier ?? 1 };
    const env: PipelineEnv = { state, catalog: cat, seed: 0, stage: 'target' };
    return { ally, env };
  }

  it('redirects a tier-scaled fraction: subtracts the raw share + emits the redirect', () => {
    const { ally, env } = scenario({ scenarioTier: 2 }); // 0.1 × 2 = 0.2
    const out = coverRedirect(ctxFor('att', ally, 100), env);
    // 20 % of raw 100 = 20 subtracted from the ally.
    expect(out.additives).toContainEqual({ source: 'cover', amount: -20 });
    const emitted = (out.emittedActions ?? []).filter((a) => a.type === 'system_cover_redirect');
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      type: 'system_cover_redirect',
      payload: { coverId: unitId('chris'), coveredId: unitId('ally'), amount: 20 },
    });
  });

  it('scales with the scenario tier (chapter)', () => {
    const raw = 100;
    const t1 = coverRedirect(ctxFor('att', scenario({ scenarioTier: 1 }).ally, raw), scenario({ scenarioTier: 1 }).env);
    const t3 = coverRedirect(ctxFor('att', scenario({ scenarioTier: 3 }).ally, raw), scenario({ scenarioTier: 3 }).env);
    expect(t1.additives).toContainEqual({ source: 'cover', amount: -10 });
    expect(t3.additives).toContainEqual({ source: 'cover', amount: -30 });
  });

  it('clamps the fraction to maxFraction', () => {
    const { ally, env } = scenario({ scenarioTier: 20, pass: coverPassive({ maxFraction: 0.5 }) });
    const out = coverRedirect(ctxFor('att', ally, 100), env);
    expect(out.additives).toContainEqual({ source: 'cover', amount: -50 });
  });

  it('does not redirect when the coverer is out of horizontal range', () => {
    const { ally, env } = scenario({ coverPos: { x: 3, y: 0, layer: 0 } });
    expect(coverRedirect(ctxFor('att', ally, 100), env).emittedActions ?? []).toHaveLength(0);
  });

  it('does not redirect when the coverer is beyond vertical tolerance', () => {
    const { ally, env } = scenario({ coverPos: { x: 1, y: 0, layer: 9 } });
    expect(coverRedirect(ctxFor('att', ally, 100), env).emittedActions ?? []).toHaveLength(0);
  });

  it('does not redirect from an enemy-team unit', () => {
    const { ally, env } = scenario({ coverTeam: 'team_b' });
    expect(coverRedirect(ctxFor('att', ally, 100), env).emittedActions ?? []).toHaveLength(0);
  });

  it('does not redirect from a KO’d coverer', () => {
    const { ally, env } = scenario({ coverHp: 0 });
    expect(coverRedirect(ctxFor('att', ally, 100), env).emittedActions ?? []).toHaveLength(0);
  });

  it('does not redirect a healing-tagged effect or a missed hit', () => {
    const { ally, env } = scenario();
    const heal = { ...ctxFor('att', ally, 100), damageTags: new Set<DamageTag>(['holy', 'healing']) };
    expect(coverRedirect(heal, env).emittedActions ?? []).toHaveLength(0);
    const miss = { ...ctxFor('att', ally, 100), hit: false };
    expect(coverRedirect(miss, env).emittedActions ?? []).toHaveLength(0);
  });
});

describe('cover in the full pipeline — ally hit reduced + redirect emitted', () => {
  it('reduces the ally by the redirected raw and emits the redirect', () => {
    const cat = createCatalog({
      statusTypes: [],
      abilities: [ATTACK, coverPassive()],
      commandSets: [],
      classes: [knightClass()],
      items: [],
      // A ruleset whose target stage includes cover_redirect (post-evasion).
      rulesets: [
        makeTestRuleset({
          damagePipelineStages: {
            ...DEFAULT_TEST_DAMAGE_PIPELINE,
            target: ['evasion_check', 'cover_redirect', 'resistance_check', 'fire_on_damage_received'],
          },
        }),
      ],
    });
    const attacker = makeUnit({ id: 'att', spd: 10, pa: 5, team: 'team_b', position: { x: 5, y: 0, layer: 0 } });
    const ally = makeUnit({ id: 'ally', spd: 10, team: 'team_a', position: { x: 0, y: 0, layer: 0 }, hp: 100, maxHpBase: 100 });
    const cover = makeUnit({ id: 'chris', spd: 10, team: 'team_a', position: { x: 1, y: 0, layer: 0 }, hp: 100, maxHpBase: 100, loadout: COVER_LOADOUT });
    const state: GameState = { ...makeGameState({ units: [attacker, ally, cover] }), scenarioTier: 2 };
    const ctx = runDamagePipeline({
      state,
      catalog: cat,
      attacker,
      target: ally,
      ability: ATTACK,
      sourceActionSeq: 0,
      seed: 0,
      registry: defaultDamageHandlers,
    });
    // Raw base = pa 5 × power 4 = 20; 20 % redirected = 4; ally keeps 16.
    expect(ctx.baseDamage).toBe(20);
    expect(ctx.finalDamage).toBe(16);
    const redirect = (ctx.emittedActions ?? []).find((a) => a.type === 'system_cover_redirect');
    expect(redirect).toBeDefined();
    expect((redirect as Extract<Action, { type: 'system_cover_redirect' }>).payload.amount).toBe(4);
  });
});

describe('reduceCoverRedirect — the bearer soaks through their own mitigation', () => {
  function redirectAction(amount: number, coverId = 'chris') {
    return {
      type: 'system_cover_redirect' as const,
      source: 'system' as const,
      sequenceNumber: 1,
      timestamp: { tick: 0, ct: 0 },
      seed: 0,
      chainDepth: 0,
      isReaction: false,
      payload: {
        coverId: unitId(coverId),
        coveredId: unitId('ally'),
        attackerId: unitId('att'),
        sourceAbilityId: ATTACK.id,
        amount,
      },
    };
  }

  it('applies the full raw soak to a bearer with no mitigation', () => {
    const cat = catalogWithCover();
    const attacker = makeUnit({ id: 'att', spd: 10, team: 'team_b' });
    const cover = makeUnit({ id: 'chris', spd: 10, team: 'team_a', hp: 100, maxHpBase: 100, loadout: COVER_LOADOUT });
    const state = makeGameState({ units: [attacker, cover] });
    const { newState, outcome } = reduceCoverRedirect(state, redirectAction(20), cat);
    expect(outcome.damageDealt).toBe(20);
    expect(newState.units.get(unitId('chris'))!.vitals.hp).toBe(80);
  });

  it('mitigates the soak by the bearer’s resistance (his defenses make it better)', () => {
    const cat = catalogWithCover();
    const attacker = makeUnit({ id: 'att', spd: 10, team: 'team_b' });
    const cover = makeUnit({
      id: 'chris',
      spd: 10,
      team: 'team_a',
      hp: 100,
      maxHpBase: 100,
      loadout: COVER_LOADOUT,
      resistances: new Map<DamageTag, number>([['physical', 50]]),
    });
    const state = makeGameState({ units: [attacker, cover] });
    const { outcome } = reduceCoverRedirect(state, redirectAction(20), cat);
    // 50 % physical resistance → soaks 10, not 20.
    expect(outcome.damageDealt).toBe(10);
  });

  it('no-ops for a KO’d bearer', () => {
    const cat = catalogWithCover();
    const attacker = makeUnit({ id: 'att', spd: 10, team: 'team_b' });
    const cover = makeUnit({ id: 'chris', spd: 10, team: 'team_a', hp: 0, maxHpBase: 100, loadout: COVER_LOADOUT });
    const state = makeGameState({ units: [attacker, cover] });
    const { outcome, newState } = reduceCoverRedirect(state, redirectAction(20), cat);
    expect(outcome.damageDealt).toBe(0);
    expect(newState).toBe(state);
  });

  it('resolves cleanly against a Counter-equipped bearer (reactions do NOT fire on a soak)', () => {
    const counter = compileReactionAbility(
      { id: abilityId('counter'), name: 'Counter', bucket: bucketId('reaction'), baseCost: 1, availability: 'available' },
      {
        triggerOn: ['onActionTargeted'],
        triggerCondition: { type: 'damage_received', minDamage: 1 },
        effects: [{ kind: 'use_ability', abilityId: abilityId('attack'), targetSelector: 'attacker' }],
      },
    );
    const cat = createCatalog({
      statusTypes: [],
      abilities: [ATTACK, coverPassive(), counter],
      commandSets: [],
      classes: [knightClass()],
      items: [],
      rulesets: [makeTestRuleset({ damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE })],
    });
    const attacker = makeUnit({ id: 'att', spd: 10, team: 'team_b' });
    const cover = makeUnit({
      id: 'chris',
      spd: 10,
      team: 'team_a',
      hp: 100,
      maxHpBase: 100,
      loadout: loadoutOf({
        passive: [
          [BUCKET_SUPPORT, [abilityId('test_cover')]],
          [bucketId('reaction'), [abilityId('counter')]],
        ],
      }),
    });
    const state = makeGameState({ units: [attacker, cover] });
    const { outcome, generatedActions } = reduceCoverRedirect(state, redirectAction(20), cat);
    expect(outcome.damageDealt).toBe(20);
    // Mitigation-only: no counter-attack (use_ability) emitted by the soak.
    expect(generatedActions.some((a) => a.type === 'use_ability')).toBe(false);
  });
});
