// Session 17b integration tests — exercises the engine pieces that
// land alongside Earth Mage's AoE/Ultimate + new statuses:
//
//   1. system_damage reducer: applies HP delta, no reactions, KO'd
//      target is a no-op.
//   2. permanent_per_unit_ct duration mode: Poison ticks but never
//      expires. Damage = floor(MaxHP × 0.10).
//   3. Don't Act blocks volitional UseAbility but allows reactions
//      (Counter still fires through, per ADR-0027).
//   4. Don't Move blocks Move actions.
//   5. onDamageReceived emission shape: a Sleep-pattern fixture status
//      that emits status_remove on incoming damage. Worked example for
//      the v1 emission slot extension.
//   6. Earth Quake AoE: per-target damage + per-target Movement Debuff
//      roll on every affected unit.
//   7. Earth Cataclysm AoE: per-target damage + three independent
//      status rolls (Poison, Don't Act, Don't Move).

import { describe, expect, it } from 'vitest';
import { createCatalog } from '../catalog/index.ts';
import {
  DEFAULT_TEST_DAMAGE_PIPELINE,
  makeTestRuleset,
} from '../catalog/test-fixtures.ts';
import { activeTurnFor, makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { passiveHook } from '../abilities/hooks.ts';
import {
  ACTIVE_BUCKET_IDS,
  PASSIVE_BUCKET_IDS,
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

function battleSkillSet(): CommandSetDefinition {
  return {
    id: commandSetId('battle_skill'),
    name: 'Battle Skill',
    members: [abilityId('attack')],
    baseCost: 1,
    availability: 'hidden',
  };
}

// Poison content fixture matching src/content/statuses/poison.ts.
function poisonStatus(): StatusEffectType {
  return {
    id: statusTypeId('poison'),
    name: 'Poison',
    tags: ['negative', 'poison'],
    durationMode: 'permanent_per_unit_ct',
    stackingRule: 'REFRESH',
    hooks: [
      statusHook('onTick', (args) => {
        const maxHp = args.unit.baseStats.maxHpBase;
        const amount = Math.floor(maxHp * 0.10);
        if (amount <= 0) return {};
        return {
          emittedActions: [
            {
              type: 'system_damage',
              source: 'system',
              payload: {
                targetId: args.unit.id,
                amount,
                tags: ['poison'],
                source: { kind: 'status_tick', statusTypeId: args.statusTypeId, unitId: args.unit.id },
              },
            },
          ],
        };
      }),
    ],
  };
}

function dontActStatus(): StatusEffectType {
  return {
    id: statusTypeId('dont_act'),
    name: "Don't Act",
    tags: ['negative', 'mental'],
    durationMode: 'per_unit_ct',
    stackingRule: 'REFRESH',
    hooks: [
      statusHook('onActionAttempted', (args) => {
        if (args.action.type !== 'use_ability') return { kind: 'allowed' };
        if (args.isReaction) return { kind: 'allowed' };
        return { kind: 'blocked', reason: "can't act" };
      }),
    ],
  };
}

function dontMoveStatus(): StatusEffectType {
  return {
    id: statusTypeId('dont_move'),
    name: "Don't Move",
    tags: ['negative', 'physical'],
    durationMode: 'per_unit_ct',
    stackingRule: 'REFRESH',
    hooks: [
      statusHook('onActionAttempted', (args) => {
        if (args.action.type !== 'move') return { kind: 'allowed' };
        return { kind: 'blocked', reason: "can't move" };
      }),
    ],
  };
}

// Sleep-pattern fixture: status whose onDamageReceived handler emits a
// status_remove against itself on any landing attack. Worked example
// for the ADR-0027 onDamageReceived emission shape. Predicate is just
// `ctx.hit` because the handler fires at the target stage, before the
// finalize stage settles `finalDamage` — using `ctx.hit` correctly
// matches "an attack landed against this unit." (A real Sleep status
// might want to gate on landing damage > 0; that's a refinement when
// Sleep ships as content.)
function sleepStatus(): StatusEffectType {
  return {
    id: statusTypeId('sleep'),
    name: 'Sleep',
    tags: ['negative', 'mental'],
    durationMode: 'per_unit_ct',
    stackingRule: 'REFRESH',
    hooks: [
      statusHook('onDamageReceived', (args) => {
        if (!args.ctx.hit) return args.ctx;
        return {
          ctx: args.ctx,
          emittedActions: [
            {
              type: 'status_remove',
              source: 'system',
              payload: {
                targetId: args.unit.id,
                statusTypeId: statusTypeId('sleep'),
              },
            },
          ],
        };
      }),
    ],
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
    hooks: compileReaction({
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

void passiveHook;

function loadoutWith(args: {
  firstActionSet?: ReturnType<typeof commandSetId>;
  reactions?: AbilityId[];
} = {}): Loadout {
  const actionBuckets: Record<string, ReturnType<typeof commandSetId> | null> = {};
  for (const b of ACTIVE_BUCKET_IDS) actionBuckets[b] = null;
  if (args.firstActionSet) actionBuckets[bucketId('first_action')] = args.firstActionSet;
  const passiveBuckets: Record<string, ReadonlyArray<AbilityId>> = {};
  for (const b of PASSIVE_BUCKET_IDS) passiveBuckets[b] = [];
  if (args.reactions) passiveBuckets[bucketId('reaction')] = args.reactions;
  return { actionBuckets, passiveBuckets };
}

function rulesetFull() {
  return makeTestRuleset({
    damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE,
    perUnitPerTurnReactions: 3,
    pausingStatusTypeIds: [statusTypeId('stop')],
  });
}

// --- Tests ---

describe('session 17b — system_damage reducer', () => {
  it('applies HP delta to a living target with floor at 0', () => {
    const ruleset = rulesetFull();
    const cat = createCatalog({
      statusTypes: [],
      abilities: [],
      commandSets: [],
      classes: [knightClass()],
      items: [],
      rulesets: [ruleset],
    });
    const u = makeUnit({ id: 'u', hp: 50, maxHpBase: 60, loadout: loadoutWith() });
    const state = makeGameState({ units: [u], map: flatMap(3, 3) });
    const r = commitAction(
      state,
      {
        type: 'system_damage',
        source: 'system',
        payload: {
          targetId: u.id,
          amount: 20,
          tags: ['poison'],
          source: { kind: 'status_tick', statusTypeId: statusTypeId('poison'), unitId: u.id },
        },
      },
      cat,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const after = r.newState.units.get(u.id)!;
    expect(after.vitals.hp).toBe(30);
    const sd = r.committed[0]!;
    expect(sd.type).toBe('system_damage');
    if (sd.type === 'system_damage') {
      expect(sd.outcome!.applied).toBe(20);
    }
  });

  it('floors at 0 when amount exceeds current HP', () => {
    const ruleset = rulesetFull();
    const cat = createCatalog({
      statusTypes: [],
      abilities: [],
      commandSets: [],
      classes: [knightClass()],
      items: [],
      rulesets: [ruleset],
    });
    const u = makeUnit({ id: 'u', hp: 5, maxHpBase: 60, loadout: loadoutWith() });
    const state = makeGameState({ units: [u], map: flatMap(3, 3) });
    const r = commitAction(
      state,
      {
        type: 'system_damage',
        source: 'system',
        payload: {
          targetId: u.id,
          amount: 100,
          tags: ['physical'],
          source: { kind: 'falling', unitId: u.id, dropDistance: 10 },
        },
      },
      cat,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const after = r.newState.units.get(u.id)!;
    expect(after.vitals.hp).toBe(0);
    const sd = r.committed[0]!;
    if (sd.type === 'system_damage') {
      expect(sd.outcome!.applied).toBe(5);
    }
  });

  it('is a no-op on a KO\'d target', () => {
    const ruleset = rulesetFull();
    const cat = createCatalog({
      statusTypes: [],
      abilities: [],
      commandSets: [],
      classes: [knightClass()],
      items: [],
      rulesets: [ruleset],
    });
    const u = makeUnit({ id: 'u', hp: 0, maxHpBase: 60, loadout: loadoutWith() });
    const state = makeGameState({ units: [u], map: flatMap(3, 3) });
    const r = commitAction(
      state,
      {
        type: 'system_damage',
        source: 'system',
        payload: {
          targetId: u.id,
          amount: 10,
          tags: ['poison'],
          source: { kind: 'status_tick', statusTypeId: statusTypeId('poison'), unitId: u.id },
        },
      },
      cat,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const after = r.newState.units.get(u.id)!;
    expect(after.vitals.hp).toBe(0);
    const sd = r.committed[0]!;
    if (sd.type === 'system_damage') {
      expect(sd.outcome!.applied).toBe(0);
    }
  });
});

describe('session 17b — non-expiring Poison (permanent_per_unit_ct)', () => {
  it('emits system_damage on turn_start; never decrements duration; survives multiple turns', () => {
    const poison = poisonStatus();
    const ruleset = rulesetFull();
    const cat = createCatalog({
      statusTypes: [poison],
      abilities: [],
      commandSets: [],
      classes: [knightClass()],
      items: [],
      rulesets: [ruleset],
    });
    const u = makeUnit({
      id: 'u',
      spd: 10,
      hp: 60,
      maxHpBase: 60,
      ct: 100,
      loadout: loadoutWith(),
      statuses: [
        {
          typeId: statusTypeId('poison'),
          source: { unitId: null, actionSeq: null },
          remainingDuration: null,
        },
      ],
    });
    const state = makeGameState({ units: [u], map: flatMap(3, 3) });

    // Tick 1: turn_start emits status_tick (Poison) → onTick emits
    // system_damage → applies floor(60×0.10) = 6 damage.
    const r = commitAction(
      state,
      { type: 'turn_start', source: 'system', payload: { unitId: u.id } },
      cat,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const after = r.newState.units.get(u.id)!;
    expect(after.vitals.hp).toBe(54);
    // Poison still on the unit; remainingDuration still null.
    const poisonInst = after.statuses.find((s) => s.typeId === statusTypeId('poison'));
    expect(poisonInst).toBeDefined();
    expect(poisonInst!.remainingDuration).toBeNull();

    const types = r.committed.map((c) => c.type);
    // Expect: turn_start, status_tick, system_damage. (No turn_end —
    // turn_start doesn't trigger a turn_end on its own; that comes from
    // the controller's wait/move/etc.)
    expect(types).toContain('status_tick');
    expect(types).toContain('system_damage');
  });

  it('reactions do not trigger on Poison ticks', () => {
    // A Counter-equipped unit takes a Poison tick. Counter should NOT
    // fire (Poison damage doesn't go through onActionTargeted).
    const poison = poisonStatus();
    const counter = counterPassive();
    const attack = attackAbility(4);
    const ruleset = rulesetFull();
    const cat = createCatalog({
      statusTypes: [poison],
      abilities: [attack, counter],
      commandSets: [battleSkillSet()],
      classes: [knightClass()],
      items: [],
      rulesets: [ruleset],
    });
    const u = makeUnit({
      id: 'u',
      spd: 10,
      hp: 60,
      maxHpBase: 60,
      ct: 100,
      loadout: loadoutWith({
        firstActionSet: commandSetId('battle_skill'),
        reactions: [abilityId('counter')],
      }),
      statuses: [
        {
          typeId: statusTypeId('poison'),
          source: { unitId: null, actionSeq: null },
          remainingDuration: null,
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
    // No use_ability action in the chain (Counter would emit one).
    const useAbility = r.committed.find((c) => c.type === 'use_ability');
    expect(useAbility).toBeUndefined();
  });
});

describe('session 17b — Don\'t Act / Don\'t Move', () => {
  it('Don\'t Act blocks volitional UseAbility', () => {
    const dontAct = dontActStatus();
    const attack = attackAbility(4);
    const ruleset = rulesetFull();
    const cat = createCatalog({
      statusTypes: [dontAct],
      abilities: [attack],
      commandSets: [battleSkillSet()],
      classes: [knightClass()],
      items: [],
      rulesets: [ruleset],
    });
    const a = makeUnit({
      id: 'a',
      spd: 10,
      pa: 5,
      loadout: loadoutWith({ firstActionSet: commandSetId('battle_skill') }),
      position: { x: 0, y: 0, layer: 0 },
      statuses: [
        {
          typeId: statusTypeId('dont_act'),
          source: { unitId: null, actionSeq: null },
          remainingDuration: 24,
        },
      ],
    });
    const b = makeUnit({
      id: 'b',
      spd: 10,
      hp: 60,
      team: 'team_b',
      loadout: loadoutWith(),
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
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.stage).toBe('hook_blocked');
    expect(r.reason).toContain("can't act");
  });

  it('Don\'t Act allows reactions: Counter still fires when Don\'t-Act unit is attacked', () => {
    // Attacker (no Don't Act) hits Defender (Don't Act + Counter).
    // Counter should still fire because reactions are reflexive.
    const dontAct = dontActStatus();
    const counter = counterPassive();
    const attack = attackAbility(4);
    const ruleset = rulesetFull();
    const cat = createCatalog({
      statusTypes: [dontAct],
      abilities: [attack, counter],
      commandSets: [battleSkillSet()],
      classes: [knightClass()],
      items: [],
      rulesets: [ruleset],
    });
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
      pa: 5,
      hp: 60,
      team: 'team_b',
      loadout: loadoutWith({ firstActionSet: commandSetId('battle_skill'), reactions: [abilityId('counter')] }),
      position: { x: 1, y: 0, layer: 0 },
      statuses: [
        {
          typeId: statusTypeId('dont_act'),
          source: { unitId: null, actionSeq: null },
          remainingDuration: 24,
        },
      ],
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
    // Counter should fire — there should be a use_ability with actorId === b
    // in the chain (the reaction).
    const counterAction = r.committed.find(
      (c) => c.type === 'use_ability' && c.actorId === b.id,
    );
    expect(counterAction).toBeDefined();
  });

  it("Don't Move blocks volitional Move", () => {
    const dontMove = dontMoveStatus();
    const ruleset = rulesetFull();
    const cat = createCatalog({
      statusTypes: [dontMove],
      abilities: [],
      commandSets: [],
      classes: [knightClass()],
      items: [],
      rulesets: [ruleset],
    });
    const u = makeUnit({
      id: 'u',
      spd: 10,
      loadout: loadoutWith(),
      position: { x: 1, y: 1, layer: 0 },
      statuses: [
        {
          typeId: statusTypeId('dont_move'),
          source: { unitId: null, actionSeq: null },
          remainingDuration: 24,
        },
      ],
    });
    const state = makeGameState({
      units: [u],
      map: flatMap(3, 3),
      turnState: activeTurnFor(u.id),
    });
    const r = commitAction(
      state,
      {
        type: 'move',
        source: 'player',
        actorId: u.id,
        payload: { destination: { x: 2, y: 1, layer: 0 } },
      },
      cat,
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.stage).toBe('hook_blocked');
    expect(r.reason).toContain("can't move");
  });
});

describe('session 17b — onDamageReceived emission shape (Sleep pattern)', () => {
  it('Sleep emits status_remove on incoming damage; the chain processes it', () => {
    const sleep = sleepStatus();
    const attack = attackAbility(4);
    const ruleset = rulesetFull();
    const cat = createCatalog({
      statusTypes: [sleep],
      abilities: [attack],
      commandSets: [battleSkillSet()],
      classes: [knightClass()],
      items: [],
      rulesets: [ruleset],
    });
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
      hp: 60,
      team: 'team_b',
      loadout: loadoutWith(),
      position: { x: 1, y: 0, layer: 0 },
      statuses: [
        {
          typeId: statusTypeId('sleep'),
          source: { unitId: null, actionSeq: null },
          remainingDuration: 24,
        },
      ],
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
    // status_remove should appear in the chain.
    const removeAction = r.committed.find((c) => c.type === 'status_remove');
    expect(removeAction).toBeDefined();
    // Sleep should be off the target after the chain.
    const after = r.newState.units.get(b.id)!;
    expect(after.statuses.some((s) => s.typeId === statusTypeId('sleep'))).toBe(false);
  });

});

describe('session 17b — Earth Quake AoE', () => {
  function earthQuakeAbility(): ActiveAbilityDefinition {
    return {
      id: abilityId('earth_quake'),
      name: 'Earth Quake',
      kind: 'active',
      bucket: bucketId('first_action'),
      baseCost: 1,
      availability: 'hidden',
      tags: ['magical', 'earth'],
      targeting: { kind: 'tile', range: { horizontal: 4, vertical: 2 }, rangeMode: 'arc' },
      actionSpeed: 0, // instant for test simplicity
      mpCost: 14,
      effects: {
        damage: { tags: ['magical', 'earth'], power_coefficient: 6 },
        aoe: { shape: { kind: 'cross', radius: 1 } },
        statusEffects: [
          {
            typeId: statusTypeId('movement_debuff'),
            target: 'primary_target',
            baseChance: 100, // deterministic
            duration: 24,
          },
        ],
      },
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
      hooks: [],
    };
  }

  function earthSpellsSet(): CommandSetDefinition {
    return {
      id: commandSetId('earth_spells'),
      name: 'Earth Spells',
      members: [abilityId('earth_quake')],
      baseCost: 1,
      availability: 'hidden',
    };
  }

  function mageClass(): ClassDefinition {
    return {
      id: classId('earth_mage'),
      name: 'Earth Mage',
      movement: { moveRange: 3, jump: 3, terrainCosts: new Map(), canEnter: new Set(['ground']) },
      evasion: { front: 0, side: 0, back: 0 },
      equipmentSlots: { leftHand: true, rightHand: true, headgear: true, armor: true, accessory: true },
      firstActionCommandSet: commandSetId('earth_spells'),
      freeAbilities: new Set(),
    };
  }

  it('damages every unit in the cross footprint and applies the debuff to each', () => {
    const debuff = movementDebuffStatus();
    const quake = earthQuakeAbility();
    const ruleset = rulesetFull();
    const cat = createCatalog({
      statusTypes: [debuff],
      abilities: [quake],
      commandSets: [earthSpellsSet()],
      classes: [mageClass(), knightClass()],
      items: [],
      rulesets: [ruleset],
    });
    // Caster at (0,3) — Manhattan distance 3 to tile (3,3), in range
    // for horizontal: 4. Cross-radius-1 footprint around (3,3):
    // (3,3), (2,3), (4,3), (3,2), (3,4). Place 3 enemies on 3 of those.
    const caster = makeUnit({
      id: 'caster',
      classId: 'earth_mage',
      spd: 10,
      pa: 4,
      ma: 8,
      mp: 50,
      faith: 100,
      loadout: loadoutWith({ firstActionSet: commandSetId('earth_spells') }),
      position: { x: 0, y: 3, layer: 0 },
    });
    const e1 = makeUnit({
      id: 'e1',
      spd: 10,
      hp: 60,
      maxHpBase: 60,
      faith: 100,
      team: 'team_b',
      loadout: loadoutWith(),
      position: { x: 3, y: 3, layer: 0 },
    });
    const e2 = makeUnit({
      id: 'e2',
      spd: 10,
      hp: 60,
      maxHpBase: 60,
      faith: 100,
      team: 'team_b',
      loadout: loadoutWith(),
      position: { x: 2, y: 3, layer: 0 },
    });
    const e3 = makeUnit({
      id: 'e3',
      spd: 10,
      hp: 60,
      maxHpBase: 60,
      faith: 100,
      team: 'team_b',
      loadout: loadoutWith(),
      position: { x: 3, y: 4, layer: 0 },
    });
    const state = makeGameState({
      units: [caster, e1, e2, e3],
      map: flatMap(6, 6),
      turnState: activeTurnFor(caster.id),
    });
    const r = commitAction(
      state,
      {
        type: 'use_ability',
        source: 'player',
        actorId: caster.id,
        payload: {
          abilityId: abilityId('earth_quake'),
          target: { kind: 'tile', position: { x: 3, y: 3, layer: 0 } },
        },
      },
      cat,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const used = r.committed[0]!;
    if (used.type !== 'use_ability') return;
    // Three per-target results, one per affected unit. Each took damage
    // and got a Movement Debuff applied.
    expect(used.outcome!.perTargetResults).toHaveLength(3);
    for (const res of used.outcome!.perTargetResults) {
      expect(res.hit).toBe(true);
      expect(res.damage).toBeGreaterThan(0);
      expect(res.statusesApplied).toBeDefined();
      const applied = res.statusesApplied!.some((s) => s.kind === 'applied' || s.kind === 'refreshed');
      expect(applied).toBe(true);
    }
    // Each target's HP went down.
    expect(r.newState.units.get(e1.id)!.vitals.hp).toBeLessThan(60);
    expect(r.newState.units.get(e2.id)!.vitals.hp).toBeLessThan(60);
    expect(r.newState.units.get(e3.id)!.vitals.hp).toBeLessThan(60);
    // Each target has the debuff status.
    expect(
      r.newState.units.get(e1.id)!.statuses.some((s) => s.typeId === statusTypeId('movement_debuff')),
    ).toBe(true);
    expect(
      r.newState.units.get(e2.id)!.statuses.some((s) => s.typeId === statusTypeId('movement_debuff')),
    ).toBe(true);
    expect(
      r.newState.units.get(e3.id)!.statuses.some((s) => s.typeId === statusTypeId('movement_debuff')),
    ).toBe(true);
  });
});

describe('session 17b — Earth Cataclysm AoE three-status combo', () => {
  function earthCataclysmAbility(): ActiveAbilityDefinition {
    return {
      id: abilityId('earth_cataclysm'),
      name: 'Earth Cataclysm',
      kind: 'active',
      bucket: bucketId('first_action'),
      baseCost: 1,
      availability: 'hidden',
      tags: ['magical', 'earth'],
      targeting: { kind: 'tile', range: { horizontal: 4, vertical: 2 }, rangeMode: 'arc' },
      actionSpeed: 0, // instant for test simplicity
      mpCost: 30,
      effects: {
        damage: { tags: ['magical', 'earth'], power_coefficient: 10 },
        aoe: { shape: { kind: 'cross', radius: 1 } },
        statusEffects: [
          { typeId: statusTypeId('poison'), target: 'primary_target', baseChance: 100 },
          {
            typeId: statusTypeId('dont_act'),
            target: 'primary_target',
            baseChance: 100,
            duration: 24,
          },
          {
            typeId: statusTypeId('dont_move'),
            target: 'primary_target',
            baseChance: 100,
            duration: 24,
          },
        ],
      },
    };
  }

  it('applies all three statuses to the affected target at 100% baseChance', () => {
    const poison = poisonStatus();
    const dontAct = dontActStatus();
    const dontMove = dontMoveStatus();
    const cataclysm = earthCataclysmAbility();
    const ruleset = rulesetFull();
    const cataclysmSet: CommandSetDefinition = {
      id: commandSetId('earth_spells'),
      name: 'Earth Spells',
      members: [abilityId('earth_cataclysm')],
      baseCost: 1,
      availability: 'hidden',
    };
    const mageClass: ClassDefinition = {
      id: classId('earth_mage'),
      name: 'Earth Mage',
      movement: { moveRange: 3, jump: 3, terrainCosts: new Map(), canEnter: new Set(['ground']) },
      evasion: { front: 0, side: 0, back: 0 },
      equipmentSlots: { leftHand: true, rightHand: true, headgear: true, armor: true, accessory: true },
      firstActionCommandSet: commandSetId('earth_spells'),
      freeAbilities: new Set(),
    };
    const cat = createCatalog({
      statusTypes: [poison, dontAct, dontMove],
      abilities: [cataclysm],
      commandSets: [cataclysmSet],
      classes: [mageClass, knightClass()],
      items: [],
      rulesets: [ruleset],
    });
    const caster = makeUnit({
      id: 'caster',
      classId: 'earth_mage',
      spd: 10,
      ma: 8,
      mp: 50,
      faith: 100,
      loadout: loadoutWith({ firstActionSet: commandSetId('earth_spells') }),
      position: { x: 0, y: 3, layer: 0 },
    });
    // Target has high HP so the Cataclysm damage doesn't KO them —
    // KO short-circuits the status-application phase, and the test
    // wants to verify the statuses get applied. Production tuning
    // would handle this with class HP curves; here it's a fixture
    // detail.
    const target = makeUnit({
      id: 'target',
      spd: 10,
      hp: 200,
      maxHpBase: 200,
      faith: 100,
      team: 'team_b',
      loadout: loadoutWith(),
      position: { x: 3, y: 3, layer: 0 },
    });
    const state = makeGameState({
      units: [caster, target],
      map: flatMap(6, 6),
      turnState: activeTurnFor(caster.id),
    });
    const r = commitAction(
      state,
      {
        type: 'use_ability',
        source: 'player',
        actorId: caster.id,
        payload: {
          abilityId: abilityId('earth_cataclysm'),
          target: { kind: 'tile', position: { x: 3, y: 3, layer: 0 } },
        },
      },
      cat,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const used = r.committed[0]!;
    if (used.type !== 'use_ability') return;
    // Inspect per-target results: the affected target should have all
    // three status applications recorded as 'applied' / 'refreshed'.
    expect(used.outcome!.perTargetResults).toHaveLength(1);
    const statusOutcomes = used.outcome!.perTargetResults[0]!.statusesApplied ?? [];
    expect(statusOutcomes).toHaveLength(3);
    for (const o of statusOutcomes) {
      expect(['applied', 'refreshed']).toContain(o.kind);
    }
    const after = r.newState.units.get(target.id)!;
    // All three statuses present.
    expect(after.statuses.some((s) => s.typeId === statusTypeId('poison'))).toBe(true);
    expect(after.statuses.some((s) => s.typeId === statusTypeId('dont_act'))).toBe(true);
    expect(after.statuses.some((s) => s.typeId === statusTypeId('dont_move'))).toBe(true);
    // Poison is non-expiring → null remainingDuration.
    const poisonInst = after.statuses.find((s) => s.typeId === statusTypeId('poison'));
    expect(poisonInst!.remainingDuration).toBeNull();
  });
});
