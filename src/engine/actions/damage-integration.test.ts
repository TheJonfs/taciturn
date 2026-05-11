// End-to-end damage tests: reduceUseAbility wires the pipeline into
// vitals, a damaging UseAbility hits the log with a populated `damage`
// outcome, healing fills HP, and onActionTargeted reactions (Counter)
// chain through commitAction with `isReaction: true` so the per-unit
// reaction cap applies.

import { createCatalog } from '../catalog/index.ts';
import {
  DEFAULT_TEST_DAMAGE_PIPELINE,
  makeTestRuleset,
} from '../catalog/test-fixtures.ts';
import { makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { passiveHook } from '../abilities/hooks.ts';
import { ACTIVE_BUCKET_IDS, PASSIVE_BUCKET_IDS } from '../abilities/constants.ts';
import { flatMap } from '../map/test-fixtures.ts';
import {
  abilityId,
  bucketId,
  classId,
  commandSetId,
  unitId,
  type AbilityId,
  type ActiveAbilityDefinition,
  type ClassDefinition,
  type CommandSetDefinition,
  type Loadout,
  type PassiveAbilityDefinition,
  type ProposedAction,
} from '@engine/index.ts';
import { commitAction } from './commit.ts';

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
  };
}

function cureAbility(power_coefficient = 5): ActiveAbilityDefinition {
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

// A minimal Counter passive defined inline for test isolation. Mirrors
// the production content/abilities/counter.ts but doesn't import it
// (engine tests don't reach into content/). Per ADR-0021, Counter fires
// on the *attempt* (no damageDealt gate); the Brave roll inside
// runOnActionTargeted does the probabilistic filtering. Healing-tagged
// effects don't trigger Counter.
function counterPassive(): PassiveAbilityDefinition {
  return {
    id: abilityId('counter'),
    name: 'Counter',
    kind: 'passive',
    bucket: bucketId('reaction'),
    baseCost: 1,
    availability: 'hidden',
    hooks: [
      passiveHook('onActionTargeted', (args) => {
        const tags = args.damageTags;
        if (!tags?.has('physical')) return [];
        if (tags.has('healing')) return [];
        const incoming = args.incomingAction;
        if (incoming.type !== 'use_ability') return [];
        if (!('actorId' in incoming)) return [];
        if (incoming.actorId === args.unit.id) return [];
        const counter: ProposedAction = {
          type: 'use_ability',
          source: 'system',
          actorId: args.unit.id,
          payload: {
            abilityId: abilityId('attack'),
            target: { kind: 'unit', unitId: incoming.actorId },
          },
        };
        return [counter];
      }),
    ],
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

function loadoutWithReaction(reaction?: AbilityId): Loadout {
  const actionBuckets: Record<string, ReturnType<typeof commandSetId> | null> = {};
  for (const b of ACTIVE_BUCKET_IDS) actionBuckets[b] = null;
  actionBuckets[bucketId('first_action')] = commandSetId('battle_skill');
  const passiveBuckets: Record<string, ReadonlyArray<AbilityId>> = {};
  for (const b of PASSIVE_BUCKET_IDS) passiveBuckets[b] = [];
  if (reaction !== undefined) passiveBuckets[bucketId('reaction')] = [reaction];
  return { actionBuckets, passiveBuckets };
}

function rulesetWithFullPipeline(perUnitPerTurnReactions = 1) {
  return makeTestRuleset({
    damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE,
    perUnitPerTurnReactions,
  });
}

function defaultActiveTurn(unitIdString: string) {
  return {
    unitId: unitId(unitIdString),
    budget: { movesAvailable: 1, actsAvailable: 1 },
    consumed: { movesConsumed: 0, actsConsumed: 0 },
    reactionsUsedThisTurn: new Map(),
  };
}

describe('reduceUseAbility — damage application', () => {
  it('subtracts finalDamage from the target HP and records `damage` on the outcome', () => {
    const attack = attackAbility(/* power */ 4);
    const ruleset = rulesetWithFullPipeline();
    const cat = createCatalog({
      statusTypes: [],
      abilities: [attack],
      commandSets: [battleSkill()],
      classes: [knightClass()],
      items: [],
      rulesets: [ruleset],
    });
    const a = makeUnit({
      id: 'a',
      spd: 10,
      pa: 5,
      loadout: loadoutWithReaction(),
      position: { x: 0, y: 0, layer: 0 },
    });
    const b = makeUnit({
      id: 'b',
      spd: 10,
      hp: 100,
      maxHpBase: 100,
      team: 'team_b',
      loadout: loadoutWithReaction(),
      position: { x: 1, y: 0, layer: 0 },
    });
    const state = makeGameState({
      units: [a, b],
      map: flatMap(3, 3),
      turnState: defaultActiveTurn('a'),
    });
    const action: ProposedAction = {
      type: 'use_ability',
      source: 'player',
      actorId: a.id,
      payload: {
        abilityId: abilityId('attack'),
        target: { kind: 'unit', unitId: b.id },
      },
    };
    const r = commitAction(state, action, cat);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.newState.units.get(b.id)!.vitals.hp).toBe(80);
    const used = r.committed[0]!;
    expect(used.type).toBe('use_ability');
    if (used.type !== 'use_ability') return;
    expect(used.outcome!.perTargetResults[0]!.damage).toBe(20);
    expect(used.outcome!.perTargetResults[0]!.healing).toBeUndefined();
  });

  it('floors target HP at 0 (does not go negative)', () => {
    const attack = attackAbility(/* power */ 50); // overkill
    const ruleset = rulesetWithFullPipeline();
    const cat = createCatalog({
      statusTypes: [],
      abilities: [attack],
      commandSets: [battleSkill()],
      classes: [knightClass()],
      items: [],
      rulesets: [ruleset],
    });
    const a = makeUnit({ id: 'a', spd: 10, pa: 5, loadout: loadoutWithReaction(), position: { x: 0, y: 0, layer: 0 } });
    const b = makeUnit({
      id: 'b',
      spd: 10,
      hp: 10,
      maxHpBase: 100,
      team: 'team_b',
      loadout: loadoutWithReaction(),
      position: { x: 1, y: 0, layer: 0 },
    });
    const state = makeGameState({
      units: [a, b],
      map: flatMap(3, 3),
      turnState: defaultActiveTurn('a'),
    });
    const action: ProposedAction = {
      type: 'use_ability',
      source: 'player',
      actorId: a.id,
      payload: { abilityId: abilityId('attack'), target: { kind: 'unit', unitId: b.id } },
    };
    const r = commitAction(state, action, cat);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.newState.units.get(b.id)!.vitals.hp).toBe(0);
  });

  it('does not run the damage pipeline for status-only abilities', () => {
    // Self-buff via a status, no damage spec.
    const battleCry: ActiveAbilityDefinition = {
      id: abilityId('battle_cry'),
      name: 'Battle Cry',
      kind: 'active',
      bucket: bucketId('first_action'),
      baseCost: 1,
      availability: 'hidden',
      targeting: { kind: 'self' },
      actionSpeed: 0,
      mpCost: 0,
      effects: {},
    };
    const ruleset = rulesetWithFullPipeline();
    const cat = createCatalog({
      statusTypes: [],
      abilities: [battleCry],
      commandSets: [{ id: commandSetId('battle_skill'), name: 'BS', members: [], baseCost: 1, availability: 'hidden' }],
      classes: [knightClass()],
      items: [],
      rulesets: [ruleset],
    });
    const a = makeUnit({ id: 'a', spd: 10, pa: 5, loadout: loadoutWithReaction() });
    const state = makeGameState({ units: [a], turnState: defaultActiveTurn('a') });
    const action: ProposedAction = {
      type: 'use_ability',
      source: 'player',
      actorId: a.id,
      payload: { abilityId: abilityId('battle_cry'), target: { kind: 'self' } },
    };
    const r = commitAction(state, action, cat);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const used = r.committed[0]!;
    if (used.type !== 'use_ability') return;
    expect(used.outcome!.perTargetResults[0]!.damage).toBeUndefined();
  });
});

describe('reduceUseAbility — healing application', () => {
  it('raises target HP and records `healing` on the outcome', () => {
    const cure = cureAbility(/* power */ 5);
    const ruleset = rulesetWithFullPipeline();
    const cat = createCatalog({
      statusTypes: [],
      abilities: [cure],
      commandSets: [{ id: commandSetId('battle_skill'), name: 'BS', members: [abilityId('cure')], baseCost: 1, availability: 'hidden' }],
      classes: [knightClass()],
      items: [],
      rulesets: [ruleset],
    });
    const healer = makeUnit({
      id: 'a',
      spd: 10,
      ma: 4,
      mp: 10,
      loadout: loadoutWithReaction(),
      position: { x: 0, y: 0, layer: 0 },
    });
    const ally = makeUnit({
      id: 'b',
      spd: 10,
      hp: 50,
      maxHpBase: 100,
      loadout: loadoutWithReaction(),
      position: { x: 1, y: 0, layer: 0 },
    });
    const state = makeGameState({
      units: [healer, ally],
      map: flatMap(3, 3),
      turnState: defaultActiveTurn('a'),
    });
    const action: ProposedAction = {
      type: 'use_ability',
      source: 'player',
      actorId: healer.id,
      payload: { abilityId: abilityId('cure'), target: { kind: 'unit', unitId: ally.id } },
    };
    const r = commitAction(state, action, cat);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Healing = MA × power × Faith_factor = 4 × 5 × (0.8 × 0.8) = 12.8,
    // floored at finalize → 12. Caster and ally both default to faith 80
    // per the v1 placeholder set in stats.ts.
    expect(r.newState.units.get(ally.id)!.vitals.hp).toBe(62);
    const used = r.committed[0]!;
    if (used.type !== 'use_ability') return;
    expect(used.outcome!.perTargetResults[0]!.healing).toBe(12);
    expect(used.outcome!.perTargetResults[0]!.damage).toBeUndefined();
  });
});

describe('Counter reaction chain', () => {
  it('triggers a counter-attack when a unit takes physical damage; the reaction is logged with isReaction = true', () => {
    const attack = attackAbility(/* power */ 4);
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
      maxHpBase: 100,
      loadout: loadoutWithReaction(),
      position: { x: 0, y: 0, layer: 0 },
    });
    const b = makeUnit({
      id: 'b',
      spd: 10,
      pa: 5,
      hp: 100,
      maxHpBase: 100,
      team: 'team_b',
      loadout: loadoutWithReaction(abilityId('counter')),
      position: { x: 1, y: 0, layer: 0 },
    });
    const state = makeGameState({
      units: [a, b],
      map: flatMap(3, 3),
      turnState: defaultActiveTurn('a'),
    });
    const action: ProposedAction = {
      type: 'use_ability',
      source: 'player',
      actorId: a.id,
      payload: { abilityId: abilityId('attack'), target: { kind: 'unit', unitId: b.id } },
    };
    const r = commitAction(state, action, cat);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Two committed: original attack + counter reaction.
    expect(r.committed).toHaveLength(2);
    expect(r.committed[0]!.type).toBe('use_ability');
    expect(r.committed[0]!.isReaction).toBe(false);
    expect(r.committed[1]!.type).toBe('use_ability');
    expect(r.committed[1]!.isReaction).toBe(true);
    expect(r.committed[1]!.parentActionSeq).toBe(r.committed[0]!.sequenceNumber);
    // Both units took 20 damage (a counter-attacked b, b counter-attacked a).
    expect(r.newState.units.get(a.id)!.vitals.hp).toBe(80);
    expect(r.newState.units.get(b.id)!.vitals.hp).toBe(80);
  });

  it('respects the per-unit-per-turn reaction cap', () => {
    // Ruleset cap is 1; the second reaction-eligible damage in a single
    // turn should not produce another counter.
    const attack = attackAbility(/* power */ 4);
    const counter = counterPassive();
    const ruleset = rulesetWithFullPipeline(/* perUnitPerTurn */ 1);
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
      maxHpBase: 100,
      loadout: loadoutWithReaction(),
      position: { x: 0, y: 0, layer: 0 },
    });
    const b = makeUnit({
      id: 'b',
      spd: 10,
      pa: 5,
      hp: 100,
      maxHpBase: 100,
      team: 'team_b',
      loadout: loadoutWithReaction(abilityId('counter')),
      position: { x: 1, y: 0, layer: 0 },
    });
    let state = makeGameState({
      units: [a, b],
      map: flatMap(3, 3),
      turnState: defaultActiveTurn('a'),
    });
    // First attack — counter fires.
    const r1 = commitAction(
      state,
      {
        type: 'use_ability',
        source: 'player',
        actorId: a.id,
        payload: { abilityId: abilityId('attack'), target: { kind: 'unit', unitId: b.id } },
      },
      cat,
    );
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    state = r1.newState;
    expect(r1.committed).toHaveLength(2);
    // Restore a's act budget for a second attack (simulating a Quick or
    // a multi-action ability, since we just want to test the reaction
    // cap; the cap is per-turn, not per-action).
    state = {
      ...state,
      turnState: { ...state.turnState!, budget: { movesAvailable: 1, actsAvailable: 1 } },
    };
    const r2 = commitAction(
      state,
      {
        type: 'use_ability',
        source: 'player',
        actorId: a.id,
        payload: { abilityId: abilityId('attack'), target: { kind: 'unit', unitId: b.id } },
      },
      cat,
    );
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    // Only the second attack committed; the second counter was capped.
    expect(r2.committed).toHaveLength(1);
    expect(r2.committed[0]!.type).toBe('use_ability');
    expect(r2.committed[0]!.isReaction).toBe(false);
  });

  it('fires Counter on a missed physical attack (per ADR-0021)', () => {
    // High-evasion target with the production-flavor Counter behavior.
    // Attack has hitRoll; many seeds → some misses. Counter still fires
    // on the missed attempt (FFT-canonical, ADR-0021), gated by Brave.
    // Demo Brave 100 → deterministic trigger.
    const attack: ActiveAbilityDefinition = {
      ...attackAbility(/* power */ 4),
      hitRoll: {},
    };
    const counter = counterPassive();
    const ruleset = rulesetWithFullPipeline();
    const evasiveClass: ClassDefinition = {
      id: classId('evasive'),
      name: 'Evasive',
      movement: { moveRange: 3, jump: 2, terrainCosts: new Map(), canEnter: new Set(['ground']) },
      // Front evasion 99 → roll lands ~5% of the time after [0.05, 1.0] clamp.
      evasion: { front: 99, side: 99, back: 99 },
      equipmentSlots: { leftHand: true, rightHand: true, headgear: true, armor: true, accessory: true },
      firstActionCommandSet: commandSetId('battle_skill'),
      freeAbilities: new Set(),
    };
    const cat = createCatalog({
      statusTypes: [],
      abilities: [attack, counter],
      commandSets: [battleSkill()],
      classes: [knightClass(), evasiveClass],
      items: [],
      rulesets: [ruleset],
    });

    // Try seeds until we find one that produces a miss.
    function trial(seed: number): { ok: true; missed: boolean; counterFired: boolean } | { ok: false } {
      const a = makeUnit({
        id: 'a',
        spd: 10,
        pa: 5,
        hp: 100,
        maxHpBase: 100,
        loadout: loadoutWithReaction(),
        position: { x: 0, y: 0, layer: 0 },
      });
      const b = makeUnit({
        id: 'b',
        spd: 10,
        pa: 5,
        hp: 100,
        maxHpBase: 100,
        team: 'team_b',
        classId: 'evasive',
        loadout: loadoutWithReaction(abilityId('counter')),
        position: { x: 1, y: 0, layer: 0 },
      });
      const state = makeGameState({
        units: [a, b],
        map: flatMap(3, 3),
        turnState: defaultActiveTurn('a'),
        masterSeed: seed,
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
      if (!r.ok) return { ok: false };
      const attackCommitted = r.committed[0]!;
      if (attackCommitted.type !== 'use_ability') return { ok: false };
      const result = attackCommitted.outcome!.perTargetResults[0]!;
      const missed = !result.hit;
      const counterFired = r.committed.length > 1 && r.committed[1]!.isReaction === true;
      return { ok: true, missed, counterFired };
    }

    let foundMissedTrial = false;
    let foundHitTrial = false;
    for (let seed = 1; seed < 100 && !(foundMissedTrial && foundHitTrial); seed++) {
      const t = trial(seed);
      if (!t.ok) continue;
      if (t.missed && !foundMissedTrial) {
        // The signature assertion: Counter fires even though the attack missed.
        expect(t.counterFired).toBe(true);
        foundMissedTrial = true;
      }
      if (!t.missed && !foundHitTrial) {
        // Sanity: Counter still fires when the attack hits (regression
        // check that the gate flip didn't break the original case).
        expect(t.counterFired).toBe(true);
        foundHitTrial = true;
      }
    }
    expect(foundMissedTrial).toBe(true);
    expect(foundHitTrial).toBe(true);
  });

  it('does not counter healing (healing-tagged damage is non-physical)', () => {
    const cure = cureAbility(/* power */ 5);
    const counter = counterPassive();
    const ruleset = rulesetWithFullPipeline();
    const cat = createCatalog({
      statusTypes: [],
      abilities: [cure, counter, attackAbility()],
      commandSets: [{ id: commandSetId('battle_skill'), name: 'BS', members: [abilityId('cure')], baseCost: 1, availability: 'hidden' }],
      classes: [knightClass()],
      items: [],
      rulesets: [ruleset],
    });
    const healer = makeUnit({
      id: 'a',
      spd: 10,
      ma: 4,
      mp: 10,
      loadout: loadoutWithReaction(),
      position: { x: 0, y: 0, layer: 0 },
    });
    const ally = makeUnit({
      id: 'b',
      spd: 10,
      hp: 50,
      maxHpBase: 100,
      loadout: loadoutWithReaction(abilityId('counter')),
      position: { x: 1, y: 0, layer: 0 },
    });
    const state = makeGameState({
      units: [healer, ally],
      map: flatMap(3, 3),
      turnState: defaultActiveTurn('a'),
    });
    const r = commitAction(
      state,
      {
        type: 'use_ability',
        source: 'player',
        actorId: healer.id,
        payload: { abilityId: abilityId('cure'), target: { kind: 'unit', unitId: ally.id } },
      },
      cat,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Only the cure; no counter chained.
    expect(r.committed).toHaveLength(1);
    expect(r.committed[0]!.type).toBe('use_ability');
  });
});

describe('Magical damage end-to-end (session 14)', () => {
  function magicalSpell(args: { power_coefficient?: number; mpCost?: number } = {}): ActiveAbilityDefinition {
    return {
      id: abilityId('magical_bolt'),
      name: 'Magical Bolt',
      kind: 'active',
      bucket: bucketId('first_action'),
      baseCost: 1,
      availability: 'hidden',
      targeting: { kind: 'single_unit', range: { horizontal: 4, vertical: 3 }, rangeMode: 'arc' },
      actionSpeed: 0,
      mpCost: args.mpCost ?? 4,
      effects: { damage: { tags: ['magical'], power_coefficient: args.power_coefficient ?? 5 } },
    };
  }

  it('applies MA × power × Faith_factor as damage and deducts MP', () => {
    const spell = magicalSpell({ power_coefficient: 4, mpCost: 4 });
    const ruleset = rulesetWithFullPipeline();
    const cat = createCatalog({
      statusTypes: [],
      abilities: [spell],
      commandSets: [{ id: commandSetId('battle_skill'), name: 'BS', members: [abilityId('magical_bolt')], baseCost: 1, availability: 'hidden' }],
      classes: [knightClass()],
      items: [],
      rulesets: [ruleset],
    });
    const caster = makeUnit({
      id: 'a',
      spd: 10,
      ma: 5,
      mp: 10,
      faith: 100,
      loadout: loadoutWithReaction(),
      position: { x: 0, y: 0, layer: 0 },
    });
    const target = makeUnit({
      id: 'b',
      spd: 10,
      hp: 100,
      maxHpBase: 100,
      faith: 100,
      team: 'team_b',
      loadout: loadoutWithReaction(),
      position: { x: 1, y: 0, layer: 0 },
    });
    const state = makeGameState({
      units: [caster, target],
      map: flatMap(3, 3),
      turnState: defaultActiveTurn('a'),
    });
    const r = commitAction(
      state,
      {
        type: 'use_ability',
        source: 'player',
        actorId: caster.id,
        payload: { abilityId: abilityId('magical_bolt'), target: { kind: 'unit', unitId: target.id } },
      },
      cat,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // MA 5 × power 4 × Faith_factor (100/100) = 20. HP 100 - 20 = 80.
    expect(r.newState.units.get(target.id)!.vitals.hp).toBe(80);
    // MP deducted on commit.
    expect(r.newState.units.get(caster.id)!.vitals.mp).toBe(6);
    const used = r.committed[0]!;
    if (used.type !== 'use_ability') return;
    expect(used.outcome!.perTargetResults[0]!.damage).toBe(20);
    expect(used.outcome!.perTargetResults[0]!.healing).toBeUndefined();
  });

  it('resistance reduces magical damage; healing-tag effects bypass resistance', () => {
    const spell = magicalSpell({ power_coefficient: 4, mpCost: 4 });
    const ruleset = rulesetWithFullPipeline();
    const cat = createCatalog({
      statusTypes: [],
      abilities: [spell],
      commandSets: [{ id: commandSetId('battle_skill'), name: 'BS', members: [abilityId('magical_bolt')], baseCost: 1, availability: 'hidden' }],
      classes: [knightClass()],
      items: [],
      rulesets: [ruleset],
    });
    const caster = makeUnit({
      id: 'a',
      spd: 10,
      ma: 5,
      mp: 10,
      faith: 100,
      loadout: loadoutWithReaction(),
      position: { x: 0, y: 0, layer: 0 },
    });
    const resistantTarget = makeUnit({
      id: 'b',
      spd: 10,
      hp: 100,
      maxHpBase: 100,
      faith: 100,
      team: 'team_b',
      loadout: loadoutWithReaction(),
      position: { x: 1, y: 0, layer: 0 },
      resistances: new Map([['magical', 50]]),
    });
    const state = makeGameState({
      units: [caster, resistantTarget],
      map: flatMap(3, 3),
      turnState: defaultActiveTurn('a'),
    });
    const r = commitAction(
      state,
      {
        type: 'use_ability',
        source: 'player',
        actorId: caster.id,
        payload: { abilityId: abilityId('magical_bolt'), target: { kind: 'unit', unitId: resistantTarget.id } },
      },
      cat,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // MA 5 × power 4 × 1.0 × (1 - 50/100) = 10. HP 100 - 10 = 90.
    expect(r.newState.units.get(resistantTarget.id)!.vitals.hp).toBe(90);
  });
});

describe('MP cost timing (deduct on commit; no refund path)', () => {
  it('reduceUseAbility deducts MP on the commit path', () => {
    const cure = cureAbility(/* power */ 5);
    const ruleset = rulesetWithFullPipeline();
    const cat = createCatalog({
      statusTypes: [],
      abilities: [cure],
      commandSets: [{ id: commandSetId('battle_skill'), name: 'BS', members: [abilityId('cure')], baseCost: 1, availability: 'hidden' }],
      classes: [knightClass()],
      items: [],
      rulesets: [ruleset],
    });
    const healer = makeUnit({
      id: 'a',
      spd: 10,
      ma: 4,
      mp: 10,
      loadout: loadoutWithReaction(),
      position: { x: 0, y: 0, layer: 0 },
    });
    const ally = makeUnit({
      id: 'b',
      spd: 10,
      hp: 50,
      maxHpBase: 100,
      loadout: loadoutWithReaction(),
      position: { x: 1, y: 0, layer: 0 },
    });
    const state = makeGameState({
      units: [healer, ally],
      map: flatMap(3, 3),
      turnState: defaultActiveTurn('a'),
    });
    const r = commitAction(
      state,
      {
        type: 'use_ability',
        source: 'player',
        actorId: healer.id,
        payload: { abilityId: abilityId('cure'), target: { kind: 'unit', unitId: ally.id } },
      },
      cat,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Cure costs 4 MP — healer should have 10 - 4 = 6.
    expect(r.newState.units.get(healer.id)!.vitals.mp).toBe(6);
    // Outcome captures the same value.
    const used = r.committed[0]!;
    if (used.type !== 'use_ability') return;
    expect(used.outcome!.mpSpent).toBe(4);
  });

  it('rejects UseAbility before MP is deducted when MP is insufficient', () => {
    const cure = cureAbility(/* power */ 5);
    const ruleset = rulesetWithFullPipeline();
    const cat = createCatalog({
      statusTypes: [],
      abilities: [cure],
      commandSets: [{ id: commandSetId('battle_skill'), name: 'BS', members: [abilityId('cure')], baseCost: 1, availability: 'hidden' }],
      classes: [knightClass()],
      items: [],
      rulesets: [ruleset],
    });
    const healer = makeUnit({
      id: 'a',
      spd: 10,
      ma: 4,
      mp: 1, // less than cure's mpCost of 4
      loadout: loadoutWithReaction(),
      position: { x: 0, y: 0, layer: 0 },
    });
    const ally = makeUnit({
      id: 'b',
      spd: 10,
      hp: 50,
      maxHpBase: 100,
      loadout: loadoutWithReaction(),
      position: { x: 1, y: 0, layer: 0 },
    });
    const state = makeGameState({
      units: [healer, ally],
      map: flatMap(3, 3),
      turnState: defaultActiveTurn('a'),
    });
    const r = commitAction(
      state,
      {
        type: 'use_ability',
        source: 'player',
        actorId: healer.id,
        payload: { abilityId: abilityId('cure'), target: { kind: 'unit', unitId: ally.id } },
      },
      cat,
    );
    // Validation rejects the action; MP is unchanged on the original
    // healer because no commit occurred.
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.stage).toBe('validation');
    expect(r.reason).toMatch(/Insufficient MP/);
    // No state mutation; commit aborted before any MP deduction.
  });
});
