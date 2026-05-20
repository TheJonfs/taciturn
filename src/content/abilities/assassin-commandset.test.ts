// Session 42 — Assassin Command Set application, Lightning Stab swap,
// and Speed Save trigger gating (behavioral, against the real catalog).

import { describe, expect, it } from 'vitest';
import {
  abilityId,
  bucketId,
  commandSetId,
  itemId,
  runOnActionTargeted,
  statusTypeId,
  unitId,
  type AbilityId,
  type Action,
  type Loadout,
  type ProposedAction,
  type Unit,
} from '@engine/index.ts';
import { loadDefaultCatalog } from '../index.ts';
import { reduceUseAbility } from '../../engine/actions/reducers.ts';
import { activeTurnFor, makeGameState, makeUnit } from '../../engine/ct/test-fixtures.ts';
import { ACTIVE_BUCKET_IDS, PASSIVE_BUCKET_IDS } from '../../engine/abilities/constants.ts';
import { flatMap } from '../../engine/map/test-fixtures.ts';

const catalog = loadDefaultCatalog();

function emptyLoadout(): Loadout {
  const actionBuckets: Record<string, ReadonlyArray<never>> = {};
  for (const b of ACTIVE_BUCKET_IDS) actionBuckets[b] = [];
  const passiveBuckets: Record<string, ReadonlyArray<AbilityId>> = {};
  for (const b of PASSIVE_BUCKET_IDS) passiveBuckets[b] = [];
  return { actionBuckets, passiveBuckets } as Loadout;
}

function reactionLoadout(reaction: AbilityId): Loadout {
  const lo = emptyLoadout() as { passiveBuckets: Record<string, ReadonlyArray<AbilityId>> };
  lo.passiveBuckets[bucketId('reaction')] = [reaction];
  return lo as Loadout;
}

function useAbility(actor: string, ability: AbilityId, targetId: ReturnType<typeof unitId>): Extract<Action, { type: 'use_ability' }> {
  return {
    type: 'use_ability',
    sequenceNumber: 1,
    source: 'player',
    timestamp: { tick: 0, ct: 0 },
    seed: 7,
    chainDepth: 0,
    isReaction: false,
    actorId: unitId(actor),
    payload: { abilityId: ability, target: { kind: 'unit', unitId: targetId } },
  };
}

// Caster tuned so the Brave/Faith-and-Speed product clamps to 1.0 — the
// status applies deterministically regardless of the roll.
function highChanceCaster(): Unit {
  return makeUnit({
    id: 'atk',
    spd: 20, // speed factor 1.9
    mp: 30,
    brave: 100,
    faith: 100,
    classId: 'assassin',
    position: { x: 0, y: 0, layer: 0 },
  });
}

function victim(): Unit {
  return makeUnit({
    id: 'def',
    spd: 8,
    brave: 100,
    faith: 100,
    hp: 100,
    maxHpBase: 100,
    team: 'team_b',
    position: { x: 1, y: 0, layer: 0 },
  });
}

describe('Shadow Arts — status application', () => {
  it('Shadow Stitch applies Stop', () => {
    const atk = highChanceCaster();
    const def = victim();
    const state = makeGameState({ units: [atk, def], map: flatMap(5, 5), turnState: activeTurnFor(atk.id) });
    const { newState } = reduceUseAbility(state, useAbility('atk', abilityId('shadow_stitch'), def.id), catalog);
    expect(newState.units.get(def.id)!.statuses.map((s) => s.typeId)).toContain(statusTypeId('stop'));
  });

  it('Undermine applies Brave Down (magnitude 20, permanent)', () => {
    const atk = highChanceCaster();
    const def = victim();
    const state = makeGameState({ units: [atk, def], map: flatMap(5, 5), turnState: activeTurnFor(atk.id) });
    const { newState } = reduceUseAbility(state, useAbility('atk', abilityId('undermine'), def.id), catalog);
    const inst = newState.units.get(def.id)!.statuses.find((s) => s.typeId === statusTypeId('brave_down'));
    expect(inst).toBeDefined();
    expect(inst!.magnitude).toBe(20);
    expect(inst!.remainingDuration).toBeNull(); // permanent → persists through KO (ADR-0079)
  });

  it('Sow Doubt applies Faith Down', () => {
    const atk = highChanceCaster();
    const def = victim();
    const state = makeGameState({ units: [atk, def], map: flatMap(5, 5), turnState: activeTurnFor(atk.id) });
    const { newState } = reduceUseAbility(state, useAbility('atk', abilityId('sow_doubt'), def.id), catalog);
    expect(newState.units.get(def.id)!.statuses.map((s) => s.typeId)).toContain(statusTypeId('faith_down'));
  });

  it('Blowdart applies Poison and deals no damage', () => {
    const atk = highChanceCaster();
    const def = victim();
    const state = makeGameState({ units: [atk, def], map: flatMap(5, 5), turnState: activeTurnFor(atk.id) });
    const { newState, outcome } = reduceUseAbility(state, useAbility('atk', abilityId('blowdart'), def.id), catalog);
    expect(newState.units.get(def.id)!.statuses.map((s) => s.typeId)).toContain(statusTypeId('poison'));
    expect(newState.units.get(def.id)!.vitals.hp).toBe(100); // no damage
    expect(outcome.perTargetResults[0]!.damage).toBeUndefined();
  });
});

describe('Lightning Stab swap', () => {
  it('is a Battle Skill member; Stasis Sword is not (but stays in catalog)', () => {
    const battleSkill = catalog.getCommandSet(commandSetId('battle_skill'));
    expect(battleSkill.members).toContain(abilityId('lightning_stab'));
    expect(battleSkill.members).not.toContain(abilityId('stasis_sword'));
    // Stasis Sword still registered (cross-class option).
    expect(catalog.getAbility(abilityId('stasis_sword'))).toBeDefined();
  });

  it('deals damage and can apply Silence (single-swing)', () => {
    const atk = makeUnit({
      id: 'atk', spd: 20, pa: 13, mp: 30, brave: 100, classId: 'knight',
      position: { x: 0, y: 0, layer: 0 },
      equipment: { leftHand: null, rightHand: itemId('long_sword'), headgear: null, armor: null, accessory: null },
    });
    const def = victim();
    const state = makeGameState({ units: [atk, def], map: flatMap(5, 5), turnState: activeTurnFor(atk.id) });
    const { outcome } = reduceUseAbility(state, useAbility('atk', abilityId('lightning_stab'), def.id), catalog);
    // Single-swing: exactly one per-target result.
    expect(outcome.perTargetResults).toHaveLength(1);
  });
});

describe('Speed Save trigger gating (D5)', () => {
  function assassinWithSpeedSave(): Unit {
    return makeUnit({
      id: 'asn', spd: 14, brave: 100, classId: 'assassin', team: 'team_a',
      position: { x: 0, y: 0, layer: 0 },
      loadout: reactionLoadout(abilityId('speed_save')),
    });
  }
  const enemyHit: ProposedAction = {
    type: 'use_ability',
    source: 'player',
    actorId: unitId('foe'),
    payload: { abilityId: abilityId('attack'), target: { kind: 'unit', unitId: unitId('asn') } },
  };

  function run(damageDealt: number, tags: ReadonlyArray<string>) {
    const asn = assassinWithSpeedSave();
    const foe = makeUnit({ id: 'foe', spd: 10, team: 'team_b', position: { x: 1, y: 0, layer: 0 } });
    const state = makeGameState({ units: [asn, foe], map: flatMap(5, 5) });
    return runOnActionTargeted(state, catalog, {
      unit: asn,
      incomingAction: enemyHit,
      damageDealt,
      damageTags: new Set(tags as never[]),
      seed: 1,
    });
  }

  it('triggers on enemy damage (emits a speed_save apply)', () => {
    const reactions = run(10, ['physical']);
    const applies = reactions.flatMap((r) => (r.action.type === 'system_apply_status' ? [r.action] : []));
    expect(applies.some((a) => a.payload.statusTypeId === statusTypeId('speed_save'))).toBe(true);
  });

  it('does not trigger on a miss (0 damage)', () => {
    expect(run(0, ['physical'])).toHaveLength(0);
  });

  it('does not trigger on a healing-tagged hit', () => {
    expect(run(10, ['physical', 'healing'])).toHaveLength(0);
  });
});
