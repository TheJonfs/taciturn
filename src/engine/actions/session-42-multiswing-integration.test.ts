// Session 42 — Two Weapons multi-swing dispatch + Remedy non-clearable.
//
// Reducer-level integration against the real default catalog:
//   - A dual-wielder (Two Weapons + a weapon in each hand) using a
//     `multiWeapon` attack resolves TWO swings (two per-target results).
//   - Without Two Weapons, with only one weapon, or on a single-swing
//     ability (Lightning Stab), it collapses to one swing.
//   - Remedy clears classic ailments (Poison) but not stat-reduction
//     debuffs (PA Down) — the `remedyImmune` gate.

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '../../content/index.ts';
import { reduceUseAbility, reduceUseThrowItem } from './reducers.ts';
import { applyStatus } from '../status/apply.ts';
import { activeTurnFor, makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import {
  ACTIVE_BUCKET_IDS,
  PASSIVE_BUCKET_IDS,
} from '../abilities/constants.ts';
import {
  abilityId,
  bucketId,
  itemId,
  runModifyStatQuery,
  statusTypeId,
  unitId,
  type AbilityId,
  type Action,
  type GameState,
  type Loadout,
  type Unit,
  type UnitEquipment,
} from '@engine/index.ts';

const catalog = loadDefaultCatalog();

function loadoutWithSupport(passives: ReadonlyArray<AbilityId>): Loadout {
  const actionBuckets: Record<string, ReadonlyArray<never>> = {};
  for (const b of ACTIVE_BUCKET_IDS) actionBuckets[b] = [];
  const passiveBuckets: Record<string, ReadonlyArray<AbilityId>> = {};
  for (const b of PASSIVE_BUCKET_IDS) passiveBuckets[b] = [];
  passiveBuckets[bucketId('support')] = passives;
  return { actionBuckets, passiveBuckets } as Loadout;
}

function gameStateWith(units: ReadonlyArray<Unit>): GameState {
  return makeGameState({
    units,
    map: {
      width: 5,
      height: 5,
      tiles: Array.from({ length: 25 }, (_, i) => ({
        x: i % 5,
        y: Math.floor(i / 5),
        layer: 0,
        elevation: 2,
        terrain: 'ground' as const,
        properties: [],
      })),
    },
    turnState: activeTurnFor(units[0]!.id),
  });
}

function attacker(opts: {
  twoWeapons: boolean;
  equipment: UnitEquipment;
}): Unit {
  return makeUnit({
    id: 'atk',
    spd: 14,
    pa: 12,
    classId: 'assassin',
    position: { x: 0, y: 0, layer: 0 },
    loadout: opts.twoWeapons
      ? loadoutWithSupport([abilityId('two_weapons')])
      : loadoutWithSupport([]),
    equipment: opts.equipment,
  });
}

function defender(): Unit {
  return makeUnit({
    id: 'def',
    spd: 8,
    classId: 'assassin', // 8/4/0 evasion; back hit (facing N, attacker W) keeps it simple
    hp: 400,
    maxHpBase: 400,
    position: { x: 1, y: 0, layer: 0 },
  });
}

const TWO_KNIVES: UnitEquipment = {
  leftHand: itemId('chefs_knife'),
  rightHand: itemId('sai'),
  headgear: null,
  armor: null,
  accessory: null,
};

const ONE_KNIFE: UnitEquipment = {
  leftHand: null,
  rightHand: itemId('sai'),
  headgear: null,
  armor: null,
  accessory: null,
};

function attackAction(targetId: ReturnType<typeof unitId>, ability: AbilityId): Extract<Action, { type: 'use_ability' }> {
  return {
    type: 'use_ability',
    sequenceNumber: 1,
    source: 'player',
    timestamp: { tick: 0, ct: 0 },
    seed: 12345,
    chainDepth: 0,
    isReaction: false,
    actorId: unitId('atk'),
    payload: { abilityId: ability, target: { kind: 'unit', unitId: targetId } },
  };
}

describe('Two Weapons multi-swing dispatch', () => {
  it('dual-wielder with two weapons swings twice (two per-target results)', () => {
    const atk = attacker({ twoWeapons: true, equipment: TWO_KNIVES });
    const def = defender();
    const state = gameStateWith([atk, def]);
    const { outcome } = reduceUseAbility(state, attackAction(def.id, abilityId('attack')), catalog);
    expect(outcome.perTargetResults).toHaveLength(2);
    // Both results target the same defender.
    for (const r of outcome.perTargetResults) {
      expect(r.target).toEqual({ kind: 'unit', unitId: def.id });
    }
  });

  it('without Two Weapons, two weapons still swing once', () => {
    const atk = attacker({ twoWeapons: false, equipment: TWO_KNIVES });
    const def = defender();
    const state = gameStateWith([atk, def]);
    const { outcome } = reduceUseAbility(state, attackAction(def.id, abilityId('attack')), catalog);
    expect(outcome.perTargetResults).toHaveLength(1);
  });

  it('Two Weapons but only one weapon equipped swings once', () => {
    const atk = attacker({ twoWeapons: true, equipment: ONE_KNIFE });
    const def = defender();
    const state = gameStateWith([atk, def]);
    const { outcome } = reduceUseAbility(state, attackAction(def.id, abilityId('attack')), catalog);
    expect(outcome.perTargetResults).toHaveLength(1);
  });

  it('Lightning Stab (single-swing rider ability) swings once even with Two Weapons', () => {
    const atk = attacker({ twoWeapons: true, equipment: TWO_KNIVES });
    const def = defender();
    const state = gameStateWith([atk, def]);
    const { outcome } = reduceUseAbility(state, attackAction(def.id, abilityId('lightning_stab')), catalog);
    expect(outcome.perTargetResults).toHaveLength(1);
  });

  it('multi-swing deals more total damage than single-swing (same seed)', () => {
    const def1 = defender();
    const single = reduceUseAbility(
      gameStateWith([attacker({ twoWeapons: false, equipment: ONE_KNIFE }), def1]),
      attackAction(def1.id, abilityId('attack')),
      catalog,
    );
    const def2 = defender();
    const dual = reduceUseAbility(
      gameStateWith([attacker({ twoWeapons: true, equipment: TWO_KNIVES }), def2]),
      attackAction(def2.id, abilityId('attack')),
      catalog,
    );
    const sum = (o: typeof single.outcome) =>
      o.perTargetResults.reduce((acc, r) => acc + (r.damage ?? 0), 0);
    // Two swings (even at PA × 0.75) out-damage one swing at full PA here:
    // 12 × 0.75 = 9 effective PA × two knives vs 12 PA × one knife.
    expect(sum(dual.outcome)).toBeGreaterThan(sum(single.outcome));
  });
});

describe('The Offering — swings-per-weapon (ADR-0080)', () => {
  const OFFERING: UnitEquipment = {
    leftHand: null,
    rightHand: itemId('sai'),
    headgear: null,
    armor: null,
    accessory: itemId('the_offering'),
  };
  const OFFERING_TWO_KNIVES: UnitEquipment = {
    leftHand: itemId('chefs_knife'),
    rightHand: itemId('sai'),
    headgear: null,
    armor: null,
    accessory: itemId('the_offering'),
  };

  it('doubles the basic Attack: one weapon swings twice', () => {
    const atk = attacker({ twoWeapons: false, equipment: OFFERING });
    const def = defender();
    const state = gameStateWith([atk, def]);
    const { outcome } = reduceUseAbility(state, attackAction(def.id, abilityId('attack')), catalog);
    expect(outcome.perTargetResults).toHaveLength(2);
  });

  it('stacks with Two Weapons: two weapons × twice = four swings', () => {
    const atk = attacker({ twoWeapons: true, equipment: OFFERING_TWO_KNIVES });
    const def = defender();
    const state = gameStateWith([atk, def]);
    const { outcome } = reduceUseAbility(state, attackAction(def.id, abilityId('attack')), catalog);
    expect(outcome.perTargetResults).toHaveLength(4);
  });

  it('does NOT double a reaction-issued Attack (Counter)', () => {
    const atk = attacker({ twoWeapons: false, equipment: OFFERING });
    const def = defender();
    const state = gameStateWith([atk, def]);
    const reactionAttack: Extract<Action, { type: 'use_ability' }> = {
      ...attackAction(def.id, abilityId('attack')),
      isReaction: true,
    };
    const { outcome } = reduceUseAbility(state, reactionAttack, catalog);
    expect(outcome.perTargetResults).toHaveLength(1);
  });

  it('does NOT double a Battle Skill (Power Attack — not the basic Attack)', () => {
    const atk = attacker({ twoWeapons: false, equipment: OFFERING });
    // Power Attack costs MP; give the attacker a pool.
    const atkWithMp = { ...atk, vitals: { ...atk.vitals, mp: 30 } };
    const def = defender();
    const state = gameStateWith([atkWithMp, def]);
    const { outcome } = reduceUseAbility(state, attackAction(def.id, abilityId('power_attack')), catalog);
    expect(outcome.perTargetResults).toHaveLength(1);
  });

  it('applies its −2 PA via statMods (composes before Two Weapons × 0.75)', () => {
    // Single Sai (no PA mod) + The Offering isolates the math: the
    // off-hand chefs_knife in OFFERING_TWO_KNIVES carries +1 PA, which
    // would otherwise confound the trade.
    const atk = makeUnit({
      id: 'atk',
      spd: 14,
      pa: 12,
      classId: 'assassin',
      loadout: loadoutWithSupport([abilityId('two_weapons')]),
      equipment: OFFERING, // Sai + The Offering only
    });
    const state = gameStateWith([atk, defender()]);
    // (base 12 − 2 Offering) = 10, then Two Weapons × 0.75 = 7.5 → 7.
    expect(runModifyStatQuery(state, catalog, { unit: atk, statName: 'pa', baseValue: 12 })).toBe(7);
  });
});

describe('Remedy non-clearable stat debuffs (Session 42)', () => {
  it('clears Poison but leaves PA Down', () => {
    const thrower = makeUnit({
      id: 'atk',
      spd: 10,
      pa: 8,
      position: { x: 0, y: 0, layer: 0 },
      stockpile: new Map([[itemId('remedy'), 1]]),
    });
    let target = makeUnit({
      id: 'def',
      spd: 8,
      hp: 100,
      maxHpBase: 100,
      position: { x: 1, y: 0, layer: 0 },
    });
    let state = gameStateWith([thrower, target]);
    for (const id of ['poison', 'pa_down']) {
      state = applyStatus(
        state,
        { targetId: target.id, typeId: statusTypeId(id), sourceUnitId: null, sourceActionSeq: null },
        catalog,
      ).newState;
    }
    target = state.units.get(target.id)!;
    expect(target.statuses.map((s) => s.typeId)).toEqual(
      expect.arrayContaining([statusTypeId('poison'), statusTypeId('pa_down')]),
    );

    const action: Extract<Action, { type: 'use_throw_item' }> = {
      type: 'use_throw_item',
      sequenceNumber: 2,
      source: 'player',
      timestamp: { tick: 0, ct: 0 },
      seed: 0,
      chainDepth: 0,
      isReaction: false,
      actorId: thrower.id,
      payload: { itemId: itemId('remedy'), target: { kind: 'unit', unitId: target.id } },
    };
    const { newState } = reduceUseThrowItem(state, action, catalog);
    const after = newState.units.get(target.id)!;
    const typeIds = after.statuses.map((s) => s.typeId);
    expect(typeIds).not.toContain(statusTypeId('poison')); // ailment cured
    expect(typeIds).toContain(statusTypeId('pa_down')); // stat debuff survives
  });
});
