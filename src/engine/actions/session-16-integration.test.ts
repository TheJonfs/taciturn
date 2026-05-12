// Session 16 integration tests — exercises the engine pieces that
// land alongside Earth Mage:
//
//   1. Status application formula end-to-end
//      (Faith × MA × resistance × modifiers, per BMG / ADR-0024).
//   2. modifyHitChance via Blind: hit chance halved.
//   3. modifyStatusApplicationChance via Earth Communion: × 1.25.
//   4. queryTurnSkipped suppressStatusTicks: Stop suppresses, Charging doesn't.
//   5. Regen tick → onTick → system_heal pipeline.
//   6. system_apply_status reducer (used by Earth Resilience).
//   7. status_remove and status_decrement_stack reducers.
//   8. Reaction compiler: Counter still works; Earth Resilience triggers.
//   9. Charged-resolution status-rider regression (carry from session 15).
//
// Each test uses inline content fixtures so the engine stays decoupled
// from src/content/.

import { describe, expect, it } from 'vitest';
import { createCatalog } from '../catalog/index.ts';
import {
  DEFAULT_TEST_DAMAGE_PIPELINE,
  defaultTestRulesets,
  makeTestRuleset,
} from '../catalog/test-fixtures.ts';
import { activeTurnFor, makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { passiveHook } from '../abilities/hooks.ts';
import {
  ACTIVE_BUCKET_IDS,
  PASSIVE_BUCKET_IDS,
  bucketKind,
} from '../abilities/constants.ts';
import { compileReaction } from '../abilities/reaction-compiler.ts';
import { flatMap } from '../map/test-fixtures.ts';
import {
  abilityId,
  bucketId,
  classId,
  commandSetId,
  statusTypeId,
  unitId,
  type AbilityId,
  type ActiveAbilityDefinition,
  type ClassDefinition,
  type CommandSetDefinition,
  type Loadout,
  type PassiveAbilityDefinition,
  type ProposedAction,
  type StatusEffectType,
} from '@engine/index.ts';
import { statusHook } from '../status/hooks.ts';
import { commitAction } from './commit.ts';
import { applyStatus } from '../status/apply.ts';
import { reduceStatusTick } from './reducers.ts';

// --- Fixture builders ---

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

function mageClass(): ClassDefinition {
  return {
    id: classId('earth_mage'),
    name: 'Earth Mage',
    movement: { moveRange: 3, jump: 3, terrainCosts: new Map(), canEnter: new Set(['ground']) },
    evasion: { front: 8, side: 5, back: 0 },
    equipmentSlots: { leftHand: true, rightHand: true, headgear: true, armor: true, accessory: true },
    firstActionCommandSet: commandSetId('earth_spells'),
    freeAbilities: new Set(),
  };
}

function attackAbility(power_coefficient = 4): ActiveAbilityDefinition {
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
    hitRoll: { accuracy: 100 },
  };
}

function magicalDebuffAbility(args: {
  baseChance?: number;
  power_coefficient?: number;
  actionSpeed?: number;
} = {}): ActiveAbilityDefinition {
  return {
    id: abilityId('earth_strike'),
    name: 'Earth Strike',
    kind: 'active',
    bucket: bucketId('first_action'),
    baseCost: 1,
    availability: 'hidden',
    tags: ['magical', 'earth'],
    targeting: {
      kind: 'single_unit',
      range: { horizontal: 4, vertical: 2 },
      rangeMode: 'arc',
    },
    actionSpeed: args.actionSpeed ?? 0,
    mpCost: 4,
    effects: {
      damage: { tags: ['magical', 'earth'], power_coefficient: args.power_coefficient ?? 6 },
      statusEffects: [
        {
          typeId: statusTypeId('movement_debuff'),
          target: 'primary_target',
          baseChance: args.baseChance ?? 60,
          duration: 36,
        },
      ],
    },
  };
}

function earthCurseAbility(): ActiveAbilityDefinition {
  return {
    id: abilityId('earth_curse'),
    name: 'Earth Curse',
    kind: 'active',
    bucket: bucketId('first_action'),
    baseCost: 1,
    availability: 'hidden',
    tags: ['magical', 'earth'],
    targeting: {
      kind: 'single_unit',
      range: { horizontal: 4, vertical: 2 },
      rangeMode: 'arc',
    },
    actionSpeed: 0,
    mpCost: 8,
    effects: {
      statusEffects: [
        { typeId: statusTypeId('blind'), target: 'primary_target', baseChance: 50, duration: 24 },
        { typeId: statusTypeId('silence'), target: 'primary_target', baseChance: 50, duration: 24 },
      ],
    },
  };
}

function silencedAbility(): ActiveAbilityDefinition {
  return {
    id: abilityId('cure'),
    name: 'Cure',
    kind: 'active',
    bucket: bucketId('secondary_command_sets'),
    baseCost: 1,
    availability: 'hidden',
    tags: ['magical', 'voice'],
    targeting: { kind: 'single_unit', range: { horizontal: 4, vertical: 3 }, rangeMode: 'arc' },
    actionSpeed: 0,
    mpCost: 4,
    effects: { damage: { tags: ['holy', 'healing'], power_coefficient: 5 } },
  };
}

function blindStatus(): StatusEffectType {
  return {
    id: statusTypeId('blind'),
    name: 'Blind',
    tags: ['negative'],
    durationMode: 'per_unit_ct',
    stackingRule: 'REFRESH',
    hooks: [statusHook('modifyHitChance', (args) => args.baseHitChance * 0.5)],
  };
}

function silenceStatus(): StatusEffectType {
  return {
    id: statusTypeId('silence'),
    name: 'Silence',
    tags: ['negative'],
    durationMode: 'per_unit_ct',
    stackingRule: 'REFRESH',
    hooks: [
      statusHook('onActionAttempted', (args) => {
        if (args.action.type !== 'use_ability') return { kind: 'allowed' };
        if (args.abilityTags.has('magical') || args.abilityTags.has('voice')) {
          return { kind: 'blocked', reason: 'silenced' };
        }
        return { kind: 'allowed' };
      }),
    ],
  };
}

function regenStatus(): StatusEffectType {
  return {
    id: statusTypeId('regen'),
    name: 'Regen',
    tags: ['positive'],
    durationMode: 'per_unit_ct',
    stackingRule: 'REFRESH',
    hooks: [
      statusHook('onTick', (args) => ({
        emittedActions: [
          {
            type: 'system_heal',
            source: 'system',
            payload: {
              targetId: args.unit.id,
              // Test uses a fixed amount for determinism. Production
              // Regen reads Faith and MaxHP via runModifyStatQuery.
              amount: 5,
              tags: ['healing'],
              source: { kind: 'status_tick', statusTypeId: args.statusTypeId, unitId: args.unit.id },
            },
          },
        ],
      })),
    ],
  };
}

function movementDebuffStatus(): StatusEffectType {
  return {
    id: statusTypeId('movement_debuff'),
    name: 'Movement Debuff',
    tags: ['negative'],
    durationMode: 'per_unit_ct',
    stackingRule: 'REFRESH',
    defaultMagnitude: 1,
    hooks: [
      statusHook('modifyStatQuery', (args, ctx) => {
        if (args.statName !== 'moveRange' && args.statName !== 'jump') return args.baseValue;
        return Math.max(0, args.baseValue - (ctx.instance.magnitude ?? 1));
      }),
    ],
  };
}

function movementSelfBuffStatus(): StatusEffectType {
  return {
    id: statusTypeId('movement_self_buff'),
    name: 'Earthen Resolve',
    tags: ['positive'],
    durationMode: 'per_unit_ct',
    stackingRule: 'STACK_INDEPENDENT',
    defaultMagnitude: 1,
    hooks: [
      statusHook('modifyStatQuery', (args, ctx) => {
        if (args.statName !== 'moveRange' && args.statName !== 'jump') return args.baseValue;
        return args.baseValue + (ctx.instance.magnitude ?? 1);
      }),
    ],
  };
}

function chargingStatus(): StatusEffectType {
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

function stopStatus(): StatusEffectType {
  return {
    id: statusTypeId('stop'),
    name: 'Stop',
    tags: ['negative'],
    durationMode: 'per_unit_ct',
    stackingRule: 'REFRESH',
    hooks: [
      statusHook('queryTurnSkipped', () => ({ reason: 'stopped', suppressStatusTicks: true })),
    ],
  };
}

function earthCommunionPassive(factor = 1.25): PassiveAbilityDefinition {
  return {
    id: abilityId('earth_communion'),
    name: 'Earth Communion',
    kind: 'passive',
    bucket: bucketId('support'),
    baseCost: 1,
    availability: 'hidden',
    hooks:[
      passiveHook('modifyStatusApplicationChance', (args) => args.baseChance * factor),
    ],
  };
}

function earthResiliencePassive(): PassiveAbilityDefinition {
  return {
    id: abilityId('earth_resilience'),
    name: 'Earth Resilience',
    kind: 'passive',
    bucket: bucketId('reaction'),
    baseCost: 2,
    availability: 'hidden',
    hooks: compileReaction({
      triggerOn: ['onActionTargeted'],
      triggerCondition: { type: 'damage_received', minDamage: 1, damageTagsNone: ['healing'] },
      effects: [
        {
          kind: 'apply_status',
          statusTypeId: statusTypeId('movement_self_buff'),
          targetSelector: 'self',
          magnitude: 1,
          duration: 24,
        },
      ],
    }),
  };
}

function counterPassive(): PassiveAbilityDefinition {
  return {
    id: abilityId('counter'),
    name: 'Counter',
    kind: 'passive',
    bucket: bucketId('reaction'),
    baseCost: 1,
    availability: 'hidden',
    hooks:compileReaction({
      triggerOn: ['onActionTargeted'],
      triggerCondition: {
        type: 'damage_received',
        damageTagsAny: ['physical'],
        damageTagsNone: ['healing'],
        minDamage: 0,
      },
      effects: [
        { kind: 'use_ability', abilityId: abilityId('attack'), targetSelector: 'attacker' },
      ],
    }),
  };
}

function battleSkill(): CommandSetDefinition {
  return {
    id: commandSetId('battle_skill'),
    name: 'Battle Skill',
    members: [abilityId('attack')],
    baseCost: 1,
    availability: 'hidden',
  };
}

function earthSpells(): CommandSetDefinition {
  return {
    id: commandSetId('earth_spells'),
    name: 'Earth Spells',
    members: [abilityId('earth_strike'), abilityId('earth_curse')],
    baseCost: 1,
    availability: 'hidden',
  };
}

function whiteMagic(): CommandSetDefinition {
  return {
    id: commandSetId('white_magic'),
    name: 'White Magic',
    members: [abilityId('cure')],
    baseCost: 1,
    availability: 'hidden',
  };
}

function loadoutWith(args: {
  firstActionSet?: ReturnType<typeof commandSetId>;
  secondActionSet?: ReturnType<typeof commandSetId>;
  reactions?: AbilityId[];
  supports?: AbilityId[];
} = {}): Loadout {
  const actionBuckets: Record<string, ReadonlyArray<ReturnType<typeof commandSetId>>> = {};
  for (const b of ACTIVE_BUCKET_IDS) actionBuckets[b] = [];
  if (args.firstActionSet) actionBuckets[bucketId('first_action')] = [args.firstActionSet];
  if (args.secondActionSet) actionBuckets[bucketId('secondary_command_sets')] = [args.secondActionSet];
  const passiveBuckets: Record<string, ReadonlyArray<AbilityId>> = {};
  for (const b of PASSIVE_BUCKET_IDS) passiveBuckets[b] = [];
  if (args.reactions) passiveBuckets[bucketId('reaction')] = args.reactions;
  if (args.supports) passiveBuckets[bucketId('support')] = args.supports;
  return { actionBuckets, passiveBuckets };
}

function rulesetWithFullPipeline() {
  return makeTestRuleset({
    damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE,
    perUnitPerTurnReactions: 3,
  });
}

// Filtered ruleset uses the actual content rulesets where possible
const teamsAB = [
  { id: 'team_a' as const },
  { id: 'team_b' as const },
] as const;
void teamsAB;

// --- Tests ---

describe('session 16 — modifyHitChance hook (Blind)', () => {
  it('Blind halves hit chance via the modifyHitChance chain', () => {
    // We can't easily assert the float roll without controlling it, so
    // we check state structure and that the chain composes — using a
    // 0% Blind (factor 0) which should clamp to the 5% floor and
    // produce a non-100% expected hit. Here we verify Blind applies
    // by counting hits across many seeds vs the no-Blind baseline.
    const blind = blindStatus();
    const attack = attackAbility(/* power */ 4);
    const ruleset = rulesetWithFullPipeline();
    const cat = createCatalog({
      statusTypes: [blind],
      abilities: [attack],
      commandSets: [battleSkill()],
      classes: [knightClass()],
      items: [],
      rulesets: [ruleset],
    });

    function runOne(targetBlind: boolean, seed: number): boolean {
      const a = makeUnit({
        id: 'a',
        spd: 10,
        pa: 5,
        loadout: loadoutWith({ firstActionSet: commandSetId('battle_skill') }),
        position: { x: 0, y: 0, layer: 0 },
      });
      const b = makeUnit({
        id: 'b',
        spd: 10,
        hp: 100,
        team: 'team_b',
        loadout: loadoutWith(),
        position: { x: 1, y: 0, layer: 0 },
        ...(targetBlind
          ? {
              statuses: [
                {
                  typeId: statusTypeId('blind'),
                  source: { unitId: null, actionSeq: null },
                  remainingDuration: 99,
                },
              ],
            }
          : {}),
      });
      const state = makeGameState({
        units: [a, b],
        map: flatMap(3, 3),
        turnState: activeTurnFor(a.id),
        masterSeed: seed,
      });
      const action: ProposedAction = {
        type: 'use_ability',
        source: 'player',
        actorId: a.id,
        payload: { abilityId: abilityId('attack'), target: { kind: 'unit', unitId: b.id } },
      };
      const r = commitAction(state, action, cat);
      if (!r.ok) return false;
      const used = r.committed[0]!;
      if (used.type !== 'use_ability') return false;
      return used.outcome!.perTargetResults[0]!.hit;
    }

    // Sample 30 seeds. Blind reduces hit chance by half from a baseline
    // of 1.0 (Knight has 0 evasion, accuracy 100, no elevation). Expect
    // ~50% hits with Blind, ~100% without.
    let hitsWithBlind = 0;
    let hitsWithoutBlind = 0;
    for (let s = 1; s <= 30; s++) {
      if (runOne(true, s)) hitsWithBlind++;
      if (runOne(false, s)) hitsWithoutBlind++;
    }
    expect(hitsWithoutBlind).toBe(30); // always hit
    expect(hitsWithBlind).toBeGreaterThan(8);
    expect(hitsWithBlind).toBeLessThan(22);
  });
});

describe('session 16 — modifyStatusApplicationChance hook (Earth Communion)', () => {
  it('Earth Communion multiplies status chance by 1.25 in the formula', () => {
    // Test with deterministic high MA × Faith so the chance exceeds
    // 1.0 with the modifier and stays at 1.0 without. The modifier
    // visibly shifts a borderline case from miss to hit.
    const debuff = movementDebuffStatus();
    const earthStrike = magicalDebuffAbility({ baseChance: 50 });
    const communion = earthCommunionPassive(1.25);
    const ruleset = rulesetWithFullPipeline();
    const cat = createCatalog({
      statusTypes: [debuff],
      abilities: [earthStrike, communion],
      commandSets: [earthSpells()],
      classes: [mageClass()],
      items: [],
      rulesets: [ruleset],
    });

    function runOne(withCommunion: boolean, seed: number): boolean {
      const a = makeUnit({
        id: 'a',
        spd: 10,
        ma: 10,
        faith: 100,
        mp: 100,
        classId: 'earth_mage',
        loadout: loadoutWith({
          firstActionSet: commandSetId('earth_spells'),
          ...(withCommunion ? { supports: [abilityId('earth_communion')] } : {}),
        }),
        position: { x: 0, y: 0, layer: 0 },
      });
      const b = makeUnit({
        id: 'b',
        spd: 10,
        hp: 100,
        faith: 100,
        team: 'team_b',
        loadout: loadoutWith(),
        position: { x: 2, y: 0, layer: 0 },
      });
      const state = makeGameState({
        units: [a, b],
        map: flatMap(5, 5),
        turnState: activeTurnFor(a.id),
        masterSeed: seed,
      });
      const action: ProposedAction = {
        type: 'use_ability',
        source: 'player',
        actorId: a.id,
        payload: { abilityId: abilityId('earth_strike'), target: { kind: 'unit', unitId: b.id } },
      };
      const r = commitAction(state, action, cat);
      if (!r.ok) return false;
      const used = r.committed[0]!;
      if (used.type !== 'use_ability') return false;
      const statuses = used.outcome!.perTargetResults[0]!.statusesApplied ?? [];
      return statuses.some((s) => s.kind === 'applied' || s.kind === 'refreshed');
    }

    // Without Communion: base 50% × Faith 1.0 × MA factor (0.9 + 10/10 = 1.9) = 0.95.
    // With Communion: × 1.25 = 1.1875 → clamped to 1.0 → always lands.
    let appliedWith = 0;
    let appliedWithout = 0;
    for (let s = 1; s <= 20; s++) {
      if (runOne(true, s)) appliedWith++;
      if (runOne(false, s)) appliedWithout++;
    }
    expect(appliedWith).toBe(20); // always — chance clamped to 1.0
    expect(appliedWithout).toBeLessThan(20); // not always — chance ~0.95
  });
});

describe('session 16 — queryTurnSkipped suppressStatusTicks', () => {
  it('Charging skips turn but per-unit-CT statuses still tick', () => {
    const charging = chargingStatus();
    const regen = regenStatus();
    const ruleset = rulesetWithFullPipeline();
    const cat = createCatalog({
      statusTypes: [charging, regen],
      abilities: [],
      commandSets: [battleSkill()],
      classes: [knightClass()],
      items: [],
      rulesets: [ruleset],
    });
    const u = makeUnit({
      id: 'u',
      spd: 10,
      ct: 100,
      hp: 50,
      maxHpBase: 100,
      loadout: loadoutWith(),
      statuses: [
        {
          typeId: statusTypeId('charging'),
          source: { unitId: unitId('u'), actionSeq: null },
          remainingDuration: null,
        },
        {
          typeId: statusTypeId('regen'),
          source: { unitId: null, actionSeq: null },
          remainingDuration: 36,
        },
      ],
    });
    const state = makeGameState({ units: [u], map: flatMap(3, 3) });
    const r = commitAction(
      state,
      { type: 'turn_start', source: 'system', payload: { unitId: u.id } },
      cat,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Expect: turn_start (skipped) + status_tick (regen ticking) +
    // system_heal (regen's emission) + turn_end. 4 actions.
    const types = r.committed.map((c) => c.type);
    expect(types).toContain('status_tick');
    expect(types).toContain('system_heal');
    expect(types).toContain('turn_end');
    // Regen healed: HP went up.
    expect(r.newState.units.get(u.id)!.vitals.hp).toBeGreaterThan(50);
  });

  it('Stop skips turn AND suppresses per-unit-CT status ticks', () => {
    const stop = stopStatus();
    const regen = regenStatus();
    const ruleset = rulesetWithFullPipeline();
    const cat = createCatalog({
      statusTypes: [stop, regen],
      abilities: [],
      commandSets: [battleSkill()],
      classes: [knightClass()],
      items: [],
      rulesets: [ruleset],
    });
    const u = makeUnit({
      id: 'u',
      spd: 10,
      ct: 100,
      hp: 50,
      maxHpBase: 100,
      loadout: loadoutWith(),
      statuses: [
        {
          typeId: statusTypeId('stop'),
          source: { unitId: null, actionSeq: null },
          remainingDuration: 24,
        },
        {
          typeId: statusTypeId('regen'),
          source: { unitId: null, actionSeq: null },
          remainingDuration: 36,
        },
      ],
    });
    const state = makeGameState({ units: [u], map: flatMap(3, 3) });
    const r = commitAction(
      state,
      { type: 'turn_start', source: 'system', payload: { unitId: u.id } },
      cat,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const types = r.committed.map((c) => c.type);
    // Stop suppresses ticks: only turn_start + turn_end.
    expect(types).toEqual(['turn_start', 'turn_end']);
    // HP unchanged.
    expect(r.newState.units.get(u.id)!.vitals.hp).toBe(50);
  });
});

describe('session 16 — Regen tick → system_heal', () => {
  it('Regen heals via onTick emission of system_heal', () => {
    const regen = regenStatus();
    const cat = createCatalog({
      statusTypes: [regen],
      abilities: [],
      commandSets: [battleSkill()],
      classes: [knightClass()],
      items: [],
      rulesets: defaultTestRulesets,
    });
    const u = makeUnit({
      id: 'u',
      spd: 10,
      ct: 100,
      hp: 70,
      maxHpBase: 100,
      loadout: loadoutWith(),
      statuses: [
        {
          typeId: statusTypeId('regen'),
          source: { unitId: null, actionSeq: null },
          remainingDuration: 36,
        },
      ],
    });
    const state = makeGameState({ units: [u], map: flatMap(3, 3), turnState: activeTurnFor(u.id) });
    // Run the status_tick reducer directly to see the emission.
    const result = reduceStatusTick(
      state,
      {
        type: 'status_tick',
        sequenceNumber: 0,
        source: 'system',
        timestamp: { tick: 0, ct: 0 },
        seed: 0,
        chainDepth: 0,
        isReaction: false,
        payload: { unitId: u.id, statusTypeId: statusTypeId('regen') },
      },
      cat,
    );
    expect(result.outcome.removed).toBe(false);
    expect(result.generatedActions).toHaveLength(1);
    expect(result.generatedActions[0]!.type).toBe('system_heal');
  });

  it('system_heal does not over-cap at maxHp', () => {
    const regen = regenStatus();
    const cat = createCatalog({
      statusTypes: [regen],
      abilities: [],
      commandSets: [battleSkill()],
      classes: [knightClass()],
      items: [],
      rulesets: defaultTestRulesets,
    });
    const u = makeUnit({
      id: 'u',
      spd: 10,
      ct: 100,
      hp: 98, // 2 below max
      maxHpBase: 100,
      loadout: loadoutWith(),
      statuses: [
        {
          typeId: statusTypeId('regen'),
          source: { unitId: null, actionSeq: null },
          remainingDuration: 36,
        },
      ],
    });
    const state = makeGameState({ units: [u], map: flatMap(3, 3) });
    const r = commitAction(
      state,
      { type: 'turn_start', source: 'system', payload: { unitId: u.id } },
      cat,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.newState.units.get(u.id)!.vitals.hp).toBe(100); // capped, not 103
  });

  it('system_heal is no-op on KO\'d target', () => {
    const regen = regenStatus();
    const cat = createCatalog({
      statusTypes: [regen],
      abilities: [],
      commandSets: [battleSkill()],
      classes: [knightClass()],
      items: [],
      rulesets: defaultTestRulesets,
    });
    const u = makeUnit({
      id: 'u',
      spd: 10,
      ct: 100,
      hp: 0, // KO'd
      maxHpBase: 100,
      loadout: loadoutWith(),
      statuses: [
        {
          typeId: statusTypeId('regen'),
          source: { unitId: null, actionSeq: null },
          remainingDuration: 36,
        },
      ],
    });
    const state = makeGameState({ units: [u], map: flatMap(3, 3) });
    // Direct system_heal reducer call.
    const r = commitAction(
      state,
      {
        type: 'system_heal',
        source: 'system',
        payload: {
          targetId: u.id,
          amount: 5,
          tags: ['healing'],
          source: { kind: 'status_tick', statusTypeId: statusTypeId('regen'), unitId: u.id },
        },
      },
      cat,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.newState.units.get(u.id)!.vitals.hp).toBe(0);
  });
});

describe('session 16 — Counter still works (reaction compiler regression)', () => {
  it('Counter triggers on physical attack via the compiled passive', () => {
    const attack = attackAbility(4);
    const counter = counterPassive();
    const ruleset = rulesetWithFullPipeline();
    const cat = createCatalog({
      statusTypes: [],
      abilities: [attack, counter],
      commandSets: [battleSkill()],
      classes: [knightClass()],
      items: [],
      rulesets: [ruleset],
    });
    const a = makeUnit({
      id: 'a',
      spd: 10,
      pa: 5,
      hp: 100,
      brave: 100,
      loadout: loadoutWith({ firstActionSet: commandSetId('battle_skill') }),
      position: { x: 0, y: 0, layer: 0 },
    });
    const b = makeUnit({
      id: 'b',
      spd: 10,
      pa: 5,
      hp: 100,
      brave: 100,
      team: 'team_b',
      loadout: loadoutWith({ reactions: [abilityId('counter')] }),
      position: { x: 1, y: 0, layer: 0 },
    });
    const state = makeGameState({
      units: [a, b],
      map: flatMap(3, 3),
      turnState: activeTurnFor(a.id),
    });
    const r = commitAction(
      state,
      {
        type: 'use_ability',
        source: 'player',
        actorId: a.id,
        payload: { abilityId: abilityId('attack'), target: { kind: 'unit', unitId: b.id } },
      },
      cat,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Two use_ability commits: a → b (attack), b → a (Counter).
    const useAbilityCommits = r.committed.filter((c) => c.type === 'use_ability');
    expect(useAbilityCommits).toHaveLength(2);
    // The reactor (a) lost HP to the counter.
    expect(r.newState.units.get(a.id)!.vitals.hp).toBeLessThan(100);
  });
});

describe('session 16 — Earth Resilience triggers and applies movement_self_buff', () => {
  it('Earth Resilience applies its self-buff via system_apply_status', () => {
    const attack = attackAbility(4);
    const buff = movementSelfBuffStatus();
    const resilience = earthResiliencePassive();
    const ruleset = rulesetWithFullPipeline();
    const cat = createCatalog({
      statusTypes: [buff],
      abilities: [attack, resilience],
      commandSets: [battleSkill()],
      classes: [knightClass()],
      items: [],
      rulesets: [ruleset],
    });
    const a = makeUnit({
      id: 'a',
      spd: 10,
      pa: 5,
      hp: 100,
      brave: 100,
      loadout: loadoutWith({ firstActionSet: commandSetId('battle_skill') }),
      position: { x: 0, y: 0, layer: 0 },
    });
    const b = makeUnit({
      id: 'b',
      spd: 10,
      hp: 100,
      brave: 100,
      team: 'team_b',
      loadout: loadoutWith({ reactions: [abilityId('earth_resilience')] }),
      position: { x: 1, y: 0, layer: 0 },
    });
    const state = makeGameState({
      units: [a, b],
      map: flatMap(3, 3),
      turnState: activeTurnFor(a.id),
    });
    const r = commitAction(
      state,
      {
        type: 'use_ability',
        source: 'player',
        actorId: a.id,
        payload: { abilityId: abilityId('attack'), target: { kind: 'unit', unitId: b.id } },
      },
      cat,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const types = r.committed.map((c) => c.type);
    expect(types).toContain('system_apply_status');
    // Reactor now has the movement_self_buff status.
    const reactor = r.newState.units.get(b.id)!;
    expect(reactor.statuses.some((s) => s.typeId === statusTypeId('movement_self_buff'))).toBe(
      true,
    );
  });

  it('Earth Resilience does NOT trigger on healing-tagged hits', () => {
    const cure = silencedAbility(); // healing+holy tags, but voice/magical
    const buff = movementSelfBuffStatus();
    const resilience = earthResiliencePassive();
    const ruleset = rulesetWithFullPipeline();
    const cat = createCatalog({
      statusTypes: [buff],
      abilities: [cure, resilience],
      commandSets: [whiteMagic()],
      classes: [knightClass()],
      items: [],
      rulesets: [ruleset],
    });
    const a = makeUnit({
      id: 'a',
      spd: 10,
      ma: 5,
      mp: 20,
      hp: 100,
      faith: 100,
      brave: 100,
      loadout: loadoutWith({ firstActionSet: commandSetId('white_magic') }),
      position: { x: 0, y: 0, layer: 0 },
    });
    const b = makeUnit({
      id: 'b',
      spd: 10,
      hp: 50,
      maxHpBase: 100,
      faith: 100,
      brave: 100,
      team: 'team_a', // ally so Cure heals
      loadout: loadoutWith({ reactions: [abilityId('earth_resilience')] }),
      position: { x: 1, y: 0, layer: 0 },
    });
    const state = makeGameState({
      units: [a, b],
      map: flatMap(3, 3),
      turnState: activeTurnFor(a.id),
    });
    const r = commitAction(
      state,
      {
        type: 'use_ability',
        source: 'player',
        actorId: a.id,
        payload: { abilityId: abilityId('cure'), target: { kind: 'unit', unitId: b.id } },
      },
      cat,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // No system_apply_status; Earth Resilience filtered out healing.
    const types = r.committed.map((c) => c.type);
    expect(types).not.toContain('system_apply_status');
  });
});

describe('session 16 — Silence blocks magical/voice actions', () => {
  it('Silence on caster blocks a use_ability with magical tag', () => {
    const earthStrike = magicalDebuffAbility();
    const silence = silenceStatus();
    const debuff = movementDebuffStatus();
    const ruleset = rulesetWithFullPipeline();
    const cat = createCatalog({
      statusTypes: [silence, debuff],
      abilities: [earthStrike],
      commandSets: [earthSpells()],
      classes: [mageClass()],
      items: [],
      rulesets: [ruleset],
    });
    const a = makeUnit({
      id: 'a',
      spd: 10,
      ma: 5,
      mp: 20,
      classId: 'earth_mage',
      loadout: loadoutWith({ firstActionSet: commandSetId('earth_spells') }),
      position: { x: 0, y: 0, layer: 0 },
      statuses: [
        {
          typeId: statusTypeId('silence'),
          source: { unitId: null, actionSeq: null },
          remainingDuration: 24,
        },
      ],
    });
    const b = makeUnit({
      id: 'b',
      spd: 10,
      hp: 100,
      team: 'team_b',
      loadout: loadoutWith(),
      position: { x: 2, y: 0, layer: 0 },
    });
    const state = makeGameState({
      units: [a, b],
      map: flatMap(5, 5),
      turnState: activeTurnFor(a.id),
    });
    const r = commitAction(
      state,
      {
        type: 'use_ability',
        source: 'player',
        actorId: a.id,
        payload: { abilityId: abilityId('earth_strike'), target: { kind: 'unit', unitId: b.id } },
      },
      cat,
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.stage).toBe('hook_blocked');
    expect(r.reason).toBe('silenced');
  });
});

describe('session 16 — charged-resolution status-rider regression (carry from 15)', () => {
  it('charged earth_strike applies its debuff status at resolution time', () => {
    const earthStrike = magicalDebuffAbility({ baseChance: 100, actionSpeed: 25 });
    const charging = chargingStatus();
    const debuff = movementDebuffStatus();
    const ruleset = makeTestRuleset({
      damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE,
      perUnitPerTurnReactions: 3,
      chargingStatusTypeId: statusTypeId('charging'),
    });
    const cat = createCatalog({
      statusTypes: [charging, debuff],
      abilities: [earthStrike],
      commandSets: [earthSpells()],
      classes: [mageClass()],
      items: [],
      rulesets: [ruleset],
    });
    const a = makeUnit({
      id: 'a',
      spd: 10,
      ma: 10,
      mp: 20,
      faith: 100,
      classId: 'earth_mage',
      loadout: loadoutWith({ firstActionSet: commandSetId('earth_spells') }),
      position: { x: 0, y: 0, layer: 0 },
    });
    const b = makeUnit({
      id: 'b',
      spd: 10,
      hp: 100,
      faith: 100,
      team: 'team_b',
      loadout: loadoutWith(),
      position: { x: 2, y: 0, layer: 0 },
    });
    const state = makeGameState({
      units: [a, b],
      map: flatMap(5, 5),
      turnState: activeTurnFor(a.id),
    });
    // Commit the charged use_ability — caster gets Charging, ChargedAction queues.
    const r1 = commitAction(
      state,
      {
        type: 'use_ability',
        source: 'player',
        actorId: a.id,
        payload: { abilityId: abilityId('earth_strike'), target: { kind: 'unit', unitId: b.id } },
      },
      cat,
    );
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    expect(r1.newState.chargedActions).toHaveLength(1);

    // Resolve the charge.
    const ca = r1.newState.chargedActions[0]!;
    const r2 = commitAction(
      r1.newState,
      {
        type: 'charged_action_resolve',
        source: 'system',
        payload: { chargedActionId: ca.id },
      },
      cat,
    );
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    // Damage AND status applied.
    const targetAfter = r2.newState.units.get(b.id)!;
    expect(targetAfter.vitals.hp).toBeLessThan(100);
    expect(
      targetAfter.statuses.some((s) => s.typeId === statusTypeId('movement_debuff')),
    ).toBe(true);
  });
});

describe('session 16 — status_remove reducer', () => {
  it('removes a named status (idempotent on missing)', () => {
    const stop = stopStatus();
    const cat = createCatalog({
      statusTypes: [stop],
      abilities: [],
      commandSets: [battleSkill()],
      classes: [knightClass()],
      items: [],
      rulesets: defaultTestRulesets,
    });
    const u = makeUnit({
      id: 'u',
      spd: 10,
      hp: 100,
      loadout: loadoutWith(),
      statuses: [
        {
          typeId: statusTypeId('stop'),
          source: { unitId: null, actionSeq: null },
          remainingDuration: 24,
        },
      ],
    });
    const state = makeGameState({ units: [u], map: flatMap(3, 3) });
    const r = commitAction(
      state,
      {
        type: 'status_remove',
        source: 'system',
        payload: { targetId: u.id, statusTypeId: statusTypeId('stop') },
      },
      cat,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.newState.units.get(u.id)!.statuses).toHaveLength(0);
    // Idempotent: removing again succeeds with removed: false.
    const r2 = commitAction(
      r.newState,
      {
        type: 'status_remove',
        source: 'system',
        payload: { targetId: u.id, statusTypeId: statusTypeId('stop') },
      },
      cat,
    );
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect((r2.committed[0]!.outcome as { readonly removed: boolean }).removed).toBe(false);
  });
});

describe('session 16 — status_decrement_stack reducer', () => {
  it('decrements stack count; removes when stacks reach 0', () => {
    const burnLike: StatusEffectType = {
      id: statusTypeId('burn'),
      name: 'Burn',
      tags: ['negative'],
      durationMode: 'conditional',
      stackingRule: 'STACK_INDEPENDENT',
      hooks: [],
    };
    const cat = createCatalog({
      statusTypes: [burnLike],
      abilities: [],
      commandSets: [battleSkill()],
      classes: [knightClass()],
      items: [],
      rulesets: defaultTestRulesets,
    });
    const u = makeUnit({
      id: 'u',
      spd: 10,
      loadout: loadoutWith(),
      statuses: [
        {
          typeId: statusTypeId('burn'),
          source: { unitId: null, actionSeq: null },
          remainingDuration: null,
          stacks: 2,
        },
      ],
    });
    const state = makeGameState({ units: [u], map: flatMap(3, 3) });
    // Decrement once → stacks 1.
    const r1 = commitAction(
      state,
      {
        type: 'status_decrement_stack',
        source: 'system',
        payload: { targetId: u.id, statusTypeId: statusTypeId('burn') },
      },
      cat,
    );
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    expect(r1.newState.units.get(u.id)!.statuses[0]!.stacks).toBe(1);
    // Decrement again → stacks 0 → instance removed.
    const r2 = commitAction(
      r1.newState,
      {
        type: 'status_decrement_stack',
        source: 'system',
        payload: { targetId: u.id, statusTypeId: statusTypeId('burn') },
      },
      cat,
    );
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect(r2.newState.units.get(u.id)!.statuses).toHaveLength(0);
  });
});

void bucketKind;
void applyStatus;
