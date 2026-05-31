// Session 53 — Damage Split reaction (Terraformer native R, substrate).
//
// Damage Split is built on the `reflect_damage` reaction-effect kind. When a
// damaging, non-healing attack lands on the wearer and the wearer survives,
// it emits:
//   - a `system_damage` to the attacker for the full damage taken, sourced
//     `{ kind: 'reflect', reactorId, attackerId }` (bypasses the pipeline →
//     no cascade into the attacker's reactions), and
//   - a `system_heal` to the wearer for floor(damage / 2), sourced
//     `{ kind: 'reaction', abilityId, unitId }`.
//
// These tests drive `runOnActionTargeted` directly with the real `damageSplit`
// ability equipped in the reactor's reaction bucket, then exercise the
// system_damage / system_heal reducers and the non-cascade property.

import { describe, expect, it } from 'vitest';
import { makeGameState, makeUnit, activeTurnFor } from '../ct/test-fixtures.ts';
import { flatMap } from '../map/test-fixtures.ts';
import { runOnActionTargeted } from '../hooks/runners.ts';
import { commitAction } from './commit.ts';
import { reduceSystemDamage, reduceSystemHeal } from './reducers.ts';
import { createCatalog } from '../catalog/index.ts';
import { defaultTestRulesets } from '../catalog/test-fixtures.ts';
import { defaultRuleset } from '../../content/rulesets/default.ts';
import { ACTIVE_BUCKET_IDS, PASSIVE_BUCKET_IDS } from '../abilities/constants.ts';
import { damageSplit } from '../../content/abilities/damage-split.ts';
import { abilities as allAbilities } from '../../content/abilities/index.ts';
import {
  abilityId,
  bucketId,
  classId,
  commandSetId,
  type AbilityId,
  type ActiveAbilityDefinition,
  type ClassDefinition,
  type CommandSetDefinition,
  type DamageTag,
  type Loadout,
  type ProposedAction,
} from '@engine/index.ts';

function attackAbilityDef(): ActiveAbilityDefinition {
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
    effects: { damage: { tags: ['physical', 'weapon'], power_coefficient: 4 } },
  };
}

function battleSkillDef(): CommandSetDefinition {
  return {
    id: commandSetId('battle_skill'),
    name: 'Battle Skill',
    members: [abilityId('attack')],
    baseCost: 1,
    availability: 'hidden',
  };
}

function terraClassDef(): ClassDefinition {
  return {
    id: classId('knight'),
    name: 'Knight',
    movement: { moveRange: 3, jump: 2, terrainCosts: new Map(), canEnter: new Set(['ground']) },
    evasion: { front: 0, side: 0, back: 0 },
    equipmentSlots: {
      leftHand: true,
      rightHand: true,
      headgear: true,
      armor: true,
      accessory: true,
    },
    firstActionCommandSet: commandSetId('battle_skill'),
    freeAbilities: new Set(),
    dominantStat: 'pa',
  };
}

function loadoutWithReaction(reaction?: AbilityId): Loadout {
  const actionBuckets: Record<string, ReadonlyArray<ReturnType<typeof commandSetId>>> = {};
  for (const b of ACTIVE_BUCKET_IDS) actionBuckets[b] = [];
  actionBuckets[bucketId('first_action')] = [commandSetId('battle_skill')];
  const passiveBuckets: Record<string, ReadonlyArray<AbilityId>> = {};
  for (const b of PASSIVE_BUCKET_IDS) passiveBuckets[b] = [];
  if (reaction !== undefined) passiveBuckets[bucketId('reaction')] = [reaction];
  return { actionBuckets, passiveBuckets };
}

function makeCat() {
  return createCatalog({
    statusTypes: [],
    abilities: [attackAbilityDef(), damageSplit],
    commandSets: [battleSkillDef()],
    classes: [terraClassDef()],
    items: [],
    rulesets: defaultTestRulesets,
  });
}

// Build a reactor with Damage Split equipped and an attacker on the other
// team. `reactorHp` is the post-application HP (the runner reads the unit we
// pass it — survival is gated on this).
function setup(args: { reactorHp?: number; brave?: number }) {
  const cat = makeCat();
  const reactor = makeUnit({
    id: 'reactor',
    spd: 10,
    brave: args.brave ?? 100,
    ...(args.reactorHp !== undefined ? { hp: args.reactorHp } : {}),
    loadout: loadoutWithReaction(abilityId('damage_split')),
  });
  const attacker = makeUnit({ id: 'attacker', spd: 10, team: 'team_b' });
  const state = makeGameState({ units: [reactor, attacker] });
  const incoming: ProposedAction = {
    type: 'use_ability',
    source: 'player',
    actorId: attacker.id,
    payload: { abilityId: abilityId('attack'), target: { kind: 'unit', unitId: reactor.id } },
  };
  return { cat, state, reactor, attacker, incoming };
}

describe('Session 53 — Damage Split reaction emission', () => {
  it('reflects full damage to attacker and heals half to reactor', () => {
    const { cat, state, reactor, attacker, incoming } = setup({});
    const reactions = runOnActionTargeted(state, cat, {
      unit: reactor,
      incomingAction: incoming,
      damageDealt: 50,
      damageTags: new Set<DamageTag>(['physical']),
      seed: 7,
    });
    expect(reactions).toHaveLength(2);
    const dmg = reactions.find((r) => r.action.type === 'system_damage')?.action;
    const heal = reactions.find((r) => r.action.type === 'system_heal')?.action;
    expect(dmg).toBeDefined();
    expect(heal).toBeDefined();
    if (dmg?.type !== 'system_damage' || heal?.type !== 'system_heal') return;

    expect(dmg.payload.targetId).toBe(attacker.id);
    expect(dmg.payload.amount).toBe(50);
    expect(dmg.payload.source.kind).toBe('reflect');
    if (dmg.payload.source.kind === 'reflect') {
      expect(dmg.payload.source.reactorId).toBe(reactor.id);
      expect(dmg.payload.source.attackerId).toBe(attacker.id);
    }

    expect(heal.payload.targetId).toBe(reactor.id);
    expect(heal.payload.amount).toBe(25); // floor(50 / 2)
    expect(heal.payload.source.kind).toBe('reaction');
    if (heal.payload.source.kind === 'reaction') {
      expect(heal.payload.source.unitId).toBe(reactor.id);
      expect(heal.payload.source.abilityId).toBe(abilityId('damage_split'));
    }
  });

  it('floors the self-heal on odd damage (51 → 25)', () => {
    const { cat, state, reactor, incoming } = setup({});
    const reactions = runOnActionTargeted(state, cat, {
      unit: reactor,
      incomingAction: incoming,
      damageDealt: 51,
      damageTags: new Set<DamageTag>(['physical']),
      seed: 1,
    });
    const dmg = reactions.find((r) => r.action.type === 'system_damage')?.action;
    const heal = reactions.find((r) => r.action.type === 'system_heal')?.action;
    if (dmg?.type !== 'system_damage' || heal?.type !== 'system_heal') {
      throw new Error('expected both emissions');
    }
    expect(dmg.payload.amount).toBe(51);
    expect(heal.payload.amount).toBe(25); // floor(51 / 2)
  });

  it('does not fire when the reactor was KO’d by the hit (survival gate)', () => {
    const { cat, state, reactor, incoming } = setup({ reactorHp: 0 });
    const reactions = runOnActionTargeted(state, cat, {
      unit: reactor,
      incomingAction: incoming,
      damageDealt: 50,
      damageTags: new Set<DamageTag>(['physical']),
      seed: 3,
    });
    expect(reactions).toEqual([]);
  });

  it('does not fire on a healing-tagged application', () => {
    const { cat, state, reactor, incoming } = setup({});
    const reactions = runOnActionTargeted(state, cat, {
      unit: reactor,
      incomingAction: incoming,
      // A heal lands as negative damageDealt with a healing tag; the
      // damageTagsNone gate excludes it.
      damageDealt: -20,
      damageTags: new Set<DamageTag>(['magical', 'healing']),
      seed: 3,
    });
    expect(reactions).toEqual([]);
  });

  it('does not fire on a zero-damage hit (minDamage gate)', () => {
    const { cat, state, reactor, incoming } = setup({});
    const reactions = runOnActionTargeted(state, cat, {
      unit: reactor,
      incomingAction: incoming,
      damageDealt: 0,
      damageTags: new Set<DamageTag>(['physical']),
      seed: 3,
    });
    expect(reactions).toEqual([]);
  });

  it('does not fire at Brave 0 (runner gate)', () => {
    const { cat, state, reactor, incoming } = setup({ brave: 0 });
    for (let seed = 0; seed < 20; seed++) {
      const reactions = runOnActionTargeted(state, cat, {
        unit: reactor,
        incomingAction: incoming,
        damageDealt: 50,
        damageTags: new Set<DamageTag>(['physical']),
        seed,
      });
      expect(reactions).toEqual([]);
    }
  });

  it('does not fire when the attacker is an ally (adversarial-only gate)', () => {
    const { cat, state, reactor } = setup({});
    const ally = makeUnit({ id: 'ally', spd: 10, team: reactor.team });
    const stateWithAlly = makeGameState({ units: [reactor, ally] });
    void state;
    const incoming: ProposedAction = {
      type: 'use_ability',
      source: 'player',
      actorId: ally.id,
      payload: { abilityId: abilityId('attack'), target: { kind: 'unit', unitId: reactor.id } },
    };
    const reactions = runOnActionTargeted(stateWithAlly, cat, {
      unit: reactor,
      incomingAction: incoming,
      damageDealt: 50,
      damageTags: new Set<DamageTag>(['physical']),
      seed: 3,
    });
    expect(reactions).toEqual([]);
  });
});

describe('Session 53 — Damage Split reducer effects + non-cascade', () => {
  it('the reflect system_damage reduces attacker HP and reports hpAfter', () => {
    const cat = makeCat();
    const reactor = makeUnit({ id: 'reactor', spd: 10 });
    const attacker = makeUnit({ id: 'attacker', spd: 10, team: 'team_b', hp: 100 });
    const state = makeGameState({ units: [reactor, attacker] });
    const result = reduceSystemDamage(
      state,
      {
        type: 'system_damage',
        source: 'system',
        sequenceNumber: 0,
        timestamp: { tick: 0, ct: 0 },
        seed: 0,
        chainDepth: 0,
        isReaction: true,
        payload: {
          targetId: attacker.id,
          amount: 50,
          tags: [],
          source: { kind: 'reflect', reactorId: reactor.id, attackerId: attacker.id },
        },
      },
      cat,
    );
    expect(result.outcome.applied).toBe(50);
    expect(result.outcome.hpAfter).toBe(50);
  });

  it('the self-heal system_heal restores reactor HP up to maxHp', () => {
    const cat = makeCat();
    const reactor = makeUnit({ id: 'reactor', spd: 10, hp: 40 });
    const state = makeGameState({ units: [reactor] });
    const result = reduceSystemHeal(
      state,
      {
        type: 'system_heal',
        source: 'system',
        sequenceNumber: 0,
        timestamp: { tick: 0, ct: 0 },
        seed: 0,
        chainDepth: 0,
        isReaction: true,
        payload: {
          targetId: reactor.id,
          amount: 25,
          tags: [],
          source: { kind: 'reaction', abilityId: abilityId('damage_split'), unitId: reactor.id },
        },
      },
      cat,
    );
    expect(result.outcome.applied).toBe(25);
    expect(result.outcome.hpAfter).toBe(65);
  });

  it('the reflect system_damage does not cascade into the attacker’s own Damage Split', () => {
    // The attacker also wears Damage Split. Because system_damage never
    // fires onActionTargeted, the reflect can't bounce back — the reducer
    // generates no reaction actions (only a possible KO sweep, not here).
    const cat = makeCat();
    const reactor = makeUnit({ id: 'reactor', spd: 10 });
    const attacker = makeUnit({
      id: 'attacker',
      spd: 10,
      team: 'team_b',
      hp: 100,
      brave: 100,
      loadout: loadoutWithReaction(abilityId('damage_split')),
    });
    const state = makeGameState({ units: [reactor, attacker] });
    const result = reduceSystemDamage(
      state,
      {
        type: 'system_damage',
        source: 'system',
        sequenceNumber: 0,
        timestamp: { tick: 0, ct: 0 },
        seed: 0,
        chainDepth: 0,
        isReaction: true,
        payload: {
          targetId: attacker.id,
          amount: 50,
          tags: [],
          source: { kind: 'reflect', reactorId: reactor.id, attackerId: attacker.id },
        },
      },
      cat,
    );
    expect(result.generatedActions).toEqual([]);
  });
});

describe('Session 53 — Damage Split catalog registration', () => {
  it('is registered in the production ability catalog', () => {
    expect(allAbilities.some((a) => a.id === abilityId('damage_split'))).toBe(true);
  });

  it('equips for 2 SP as a reaction passive', () => {
    expect(damageSplit.kind).toBe('passive');
    expect(damageSplit.baseCost).toBe(2);
    expect(damageSplit.bucket).toBe(bucketId('reaction'));
  });
});

// Session 55 regression: the heal half is dropped under the per-unit-per-turn
// reaction cap. Damage Split's trigger emits TWO actions (reflect + self-heal);
// pre-S55 each counted as a separate reaction, so the reflect consumed the cap
// slot (default 1) and the heal was silently dropped — the reactor took full
// damage with no heal-back on EVERY hit. The emission-level tests above never
// caught it because they don't drive the commit cap. These do.
describe('Session 55 — Damage Split self-heal survives the reaction cap (commit path)', () => {
  // Reactor at (0,0), attacker adjacent at (1,0), flat ground so a melee Attack
  // is valid; attacker takes the turn (turnState owns reactionsUsedThisTurn).
  // The minimal `defaultTestRulesets` doesn't wire the damage-pipeline stage
  // list, so a committed attack computes baseDamage 0 (the emission tests above
  // sidestep this by passing `damageDealt` directly). Use the production
  // ruleset here so the basic Attack actually lands damage and the reaction
  // fires through the real commit path.
  function makeCatProd() {
    return createCatalog({
      statusTypes: [],
      abilities: [attackAbilityDef(), damageSplit],
      commandSets: [battleSkillDef()],
      classes: [terraClassDef()],
      items: [],
      rulesets: [defaultRuleset],
    });
  }

  function commitSetup(args?: { reactionsUsed?: number }) {
    const cat = makeCatProd();
    const reactor = makeUnit({
      id: 'reactor', spd: 10, brave: 100, hp: 100,
      position: { x: 0, y: 0, layer: 0 },
      loadout: loadoutWithReaction(abilityId('damage_split')),
    });
    const attacker = makeUnit({ id: 'attacker', spd: 10, team: 'team_b', hp: 100, position: { x: 1, y: 0, layer: 0 } });
    const base = activeTurnFor(attacker.id);
    const turnState =
      args?.reactionsUsed !== undefined
        ? { ...base, reactionsUsedThisTurn: new Map([[reactor.id, args.reactionsUsed]]) }
        : base;
    const state = makeGameState({ units: [reactor, attacker], map: flatMap(4, 4), turnState });
    const incoming: ProposedAction = {
      type: 'use_ability', source: 'player', actorId: attacker.id,
      payload: { abilityId: abilityId('attack'), target: { kind: 'unit', unitId: reactor.id } },
    };
    return { cat, state, reactor, attacker, incoming };
  }

  it('heals the reactor for half the reflected damage on a single attack', () => {
    const { cat, state, reactor, attacker, incoming } = commitSetup();
    const result = commitAction(state, incoming, cat);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const r = result.newState.units.get(reactor.id)!;
    const a = result.newState.units.get(attacker.id)!;
    // Reflect to attacker == gross damage the reactor took.
    const gross = 100 - a.vitals.hp;
    expect(gross).toBeGreaterThan(0);
    const netLoss = 100 - r.vitals.hp;
    // Heal applied → net loss is gross minus floor(gross/2) = ceil(gross/2),
    // strictly less than gross. The pre-S55 bug left netLoss == gross.
    expect(netLoss).toBe(gross - Math.floor(gross / 2));
    expect(netLoss).toBeLessThan(gross);
    // The heal landed in the log, not just the reflect.
    expect(result.committed.some((x) => x.type === 'system_heal')).toBe(true);
  });

  it('drops the WHOLE reaction (reflect and heal) when the reactor is already at the cap', () => {
    const { cat, state, attacker, incoming } = commitSetup({ reactionsUsed: 1 });
    const result = commitAction(state, incoming, cat);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const a = result.newState.units.get(attacker.id)!;
    // Capped: no reflect (attacker untouched) and no heal emitted.
    expect(a.vitals.hp).toBe(100);
    expect(result.committed.some((x) => x.type === 'system_heal')).toBe(false);
    expect(result.committed.some((x) => x.type === 'system_damage')).toBe(false);
  });
});
