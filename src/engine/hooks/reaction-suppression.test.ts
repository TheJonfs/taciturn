// ADR-0131 — Stop (and any future `suppressesReactions` status) suppresses
// ALL of a reactor's reactions at the `runOnActionTargeted` choke point.
//
// These tests pin both halves of the decision:
//   1. The unit-level gate: a reactor carrying a `suppressesReactions`
//      status returns no reactions, across reaction *kinds* (Counter's
//      use_ability AND Damage Split's reflect system_damage), so the gate
//      is uniform rather than ability-specific.
//   2. The contrast: Don't Act (which carries NO such flag) still lets
//      reactions through — reflex vs. volition is preserved.
//   3. The commit path: a Stopped Counter-user that's attacked commits no
//      counter-attack, while the same setup without Stop does.

import { describe, expect, it } from 'vitest';
import { makeGameState, makeUnit, activeTurnFor } from '../ct/test-fixtures.ts';
import { flatMap } from '../map/test-fixtures.ts';
import { runOnActionTargeted } from './runners.ts';
import { commitAction } from '../actions/commit.ts';
import { createCatalog } from '../catalog/index.ts';
import { defaultRuleset } from '../../content/rulesets/default.ts';
import { ACTIVE_BUCKET_IDS, PASSIVE_BUCKET_IDS } from '../abilities/constants.ts';
import { counter } from '../../content/abilities/counter.ts';
import { damageSplit } from '../../content/abilities/damage-split.ts';
import { stop } from '../../content/statuses/stop.ts';
import { dontAct } from '../../content/statuses/dont-act.ts';
import {
  abilityId,
  bucketId,
  classId,
  commandSetId,
  statusTypeId,
  type AbilityId,
  type ActiveAbilityDefinition,
  type ClassDefinition,
  type CommandSetDefinition,
  type DamageTag,
  type Loadout,
  type ProposedAction,
  type StatusInstance,
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

function reactorClassDef(): ClassDefinition {
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

function loadoutWithReactions(reactions: ReadonlyArray<AbilityId>): Loadout {
  const actionBuckets: Record<string, ReadonlyArray<ReturnType<typeof commandSetId>>> = {};
  for (const b of ACTIVE_BUCKET_IDS) actionBuckets[b] = [];
  actionBuckets[bucketId('first_action')] = [commandSetId('battle_skill')];
  const passiveBuckets: Record<string, ReadonlyArray<AbilityId>> = {};
  for (const b of PASSIVE_BUCKET_IDS) passiveBuckets[b] = [];
  passiveBuckets[bucketId('reaction')] = reactions;
  return { actionBuckets, passiveBuckets };
}

function makeCat() {
  return createCatalog({
    statusTypes: [stop, dontAct],
    abilities: [attackAbilityDef(), counter, damageSplit],
    commandSets: [battleSkillDef()],
    classes: [reactorClassDef()],
    items: [],
    rulesets: [defaultRuleset],
  });
}

function statusInstance(typeId: ReturnType<typeof statusTypeId>): StatusInstance {
  return { typeId, source: { unitId: null, actionSeq: null }, remainingDuration: 12 };
}

const PHYSICAL = new Set<DamageTag>(['physical']);

describe('ADR-0131 — Stop suppresses reactions (unit-level gate)', () => {
  function reactorWith(opts: {
    readonly reactions: ReadonlyArray<AbilityId>;
    readonly statuses?: ReadonlyArray<StatusInstance>;
  }) {
    const cat = makeCat();
    const reactor = makeUnit({
      id: 'reactor',
      spd: 10,
      brave: 100,
      hp: 100,
      loadout: loadoutWithReactions(opts.reactions),
      ...(opts.statuses !== undefined ? { statuses: opts.statuses } : {}),
    });
    const attacker = makeUnit({ id: 'attacker', spd: 10, team: 'team_b' });
    const state = makeGameState({ units: [reactor, attacker] });
    const incoming: ProposedAction = {
      type: 'use_ability',
      source: 'player',
      actorId: attacker.id,
      payload: { abilityId: abilityId('attack'), target: { kind: 'unit', unitId: reactor.id } },
    };
    return { cat, state, reactor, incoming };
  }

  it('Counter fires normally without Stop', () => {
    const { cat, state, reactor, incoming } = reactorWith({ reactions: [abilityId('counter')] });
    const reactions = runOnActionTargeted(state, cat, {
      unit: reactor,
      incomingAction: incoming,
      damageDealt: 50,
      damageTags: PHYSICAL,
      seed: 7,
    });
    expect(reactions.some((r) => r.action.type === 'use_ability')).toBe(true);
  });

  it('Counter is suppressed while Stopped', () => {
    const { cat, state, reactor, incoming } = reactorWith({
      reactions: [abilityId('counter')],
      statuses: [statusInstance(statusTypeId('stop'))],
    });
    const reactions = runOnActionTargeted(state, cat, {
      unit: reactor,
      incomingAction: incoming,
      damageDealt: 50,
      damageTags: PHYSICAL,
      seed: 7,
    });
    expect(reactions).toEqual([]);
  });

  it('Damage Split (reflect, a different reaction kind) is also suppressed while Stopped', () => {
    const { cat, state, reactor, incoming } = reactorWith({
      reactions: [abilityId('damage_split')],
      statuses: [statusInstance(statusTypeId('stop'))],
    });
    const reactions = runOnActionTargeted(state, cat, {
      unit: reactor,
      incomingAction: incoming,
      damageDealt: 50,
      damageTags: PHYSICAL,
      seed: 7,
    });
    expect(reactions).toEqual([]);
  });

  it('Don’t Act does NOT suppress reactions (reflex vs. volition preserved)', () => {
    const { cat, state, reactor, incoming } = reactorWith({
      reactions: [abilityId('counter')],
      statuses: [statusInstance(statusTypeId('dont_act'))],
    });
    const reactions = runOnActionTargeted(state, cat, {
      unit: reactor,
      incomingAction: incoming,
      damageDealt: 50,
      damageTags: PHYSICAL,
      seed: 7,
    });
    expect(reactions.some((r) => r.action.type === 'use_ability')).toBe(true);
  });
});

describe('ADR-0131 — Stop suppresses reactions (commit path)', () => {
  function commitSetup(stopped: boolean) {
    const cat = makeCat();
    const reactor = makeUnit({
      id: 'reactor',
      spd: 10,
      brave: 100,
      hp: 100,
      position: { x: 0, y: 0, layer: 0 },
      loadout: loadoutWithReactions([abilityId('counter')]),
      ...(stopped ? { statuses: [statusInstance(statusTypeId('stop'))] } : {}),
    });
    const attacker = makeUnit({
      id: 'attacker',
      spd: 10,
      team: 'team_b',
      hp: 100,
      position: { x: 1, y: 0, layer: 0 },
    });
    const state = makeGameState({
      units: [reactor, attacker],
      map: flatMap(4, 4),
      turnState: activeTurnFor(attacker.id),
    });
    const incoming: ProposedAction = {
      type: 'use_ability',
      source: 'player',
      actorId: attacker.id,
      payload: { abilityId: abilityId('attack'), target: { kind: 'unit', unitId: reactor.id } },
    };
    return { cat, state, reactor, incoming };
  }

  it('a non-Stopped Counter-user counters the attack', () => {
    const { cat, state, reactor, incoming } = commitSetup(false);
    const result = commitAction(state, incoming, cat);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const counterAttack = result.committed.some(
      (a) => a.type === 'use_ability' && a.actorId === reactor.id,
    );
    expect(counterAttack).toBe(true);
  });

  it('a Stopped Counter-user does NOT counter', () => {
    const { cat, state, reactor, incoming } = commitSetup(true);
    const result = commitAction(state, incoming, cat);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const counterAttack = result.committed.some(
      (a) => a.type === 'use_ability' && a.actorId === reactor.id,
    );
    expect(counterAttack).toBe(false);
  });
});
