// Thief (12th class) — chunk 1: class skeleton, the three straightforward
// Thief Arts actives (Steal HP / Steal MP / Steal Buffs), and the three
// native RSM (Slip Free / Momentum / Move +2). Exercises the new effect
// substrate (lifesteal rider, mpDrain effect, stealBuffs strip-and-transfer)
// and the new target-side `modifyIncomingStatusDuration` hook (Slip Free).

import { describe, expect, it } from 'vitest';
import {
  abilityId,
  bucketId,
  classId,
  commandSetId,
  itemId,
  rulesetId,
  statusTypeId,
  teamId,
  unitId,
  runModifyStatQuery,
  type BattleConfig,
  type Loadout,
  type ProposedAction,
} from '@engine/index.ts';
import { createInitialState } from '../engine/setup/create-initial-state.ts';
import { commitAction } from '../engine/actions/commit.ts';
import { reduceSystemMpDrain } from '../engine/actions/reducers.ts';
import { applyStatus } from '../engine/status/apply.ts';
import { runOnActionResolved } from '../engine/hooks/runners.ts';
import { computeThiefContestChance } from '../engine/status/chance.ts';
import { ACTIVE_BUCKET_IDS, PASSIVE_BUCKET_IDS } from '../engine/abilities/constants.ts';
import { activeTurnFor, makeGameState, makeUnit } from '../engine/ct/test-fixtures.ts';
import { flatMap } from '../engine/map/test-fixtures.ts';
import { loadDefaultCatalog } from './index.ts';
import { thief } from './classes/thief.ts';
import { thiefArts } from './command-sets/thief-arts.ts';
import { classBaselineStats } from './classes/baseline-stats.ts';

const THIEF = classId('thief');

// ---------------------------------------------------------------------------
// Registration + stat line
// ---------------------------------------------------------------------------

describe('Thief class — registration + stat line', () => {
  const cat = loadDefaultCatalog();

  it('is registered in the default catalog', () => {
    expect(cat.hasClass(THIEF)).toBe(true);
    expect(cat.getClass(THIEF).name).toBe('Thief');
  });

  it('has the spec stat block (HP 90 / MP 28 / PA 7 / MA 3 / Speed 11), dominant PA', () => {
    expect(classBaselineStats.get(THIEF)).toEqual({
      maxHpBase: 90,
      maxMpBase: 28,
      pa: 7,
      ma: 3,
      spd: 11,
    });
    expect(thief.dominantStat).toBe('pa');
  });

  it('has Move 3 / Jump 3 and evasion 8 / 4 / 0, universal gear', () => {
    expect(thief.movement.moveRange).toBe(3);
    expect(thief.movement.jump).toBe(3);
    expect(thief.evasion).toEqual({ front: 8, side: 4, back: 0 });
    expect(thief.equipmentSlots).toEqual({
      leftHand: true,
      rightHand: true,
      headgear: true,
      armor: true,
      accessory: true,
    });
  });

  it('first action is Thief Arts (Steal HP / MP / Buffs); grants Attack + the 3 RSM free', () => {
    expect(thief.firstActionCommandSet).toBe(commandSetId('thief_arts'));
    expect(thiefArts.members).toEqual([
      abilityId('steal_hp'),
      abilityId('steal_mp'),
      abilityId('steal_buffs'),
    ]);
    for (const id of ['attack', 'slip_free', 'momentum', 'move_plus_2']) {
      expect(thief.freeAbilities.has(abilityId(id))).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Battle-construction helpers
// ---------------------------------------------------------------------------

function thiefLoadout(): Loadout {
  const actionBuckets: Record<string, ReadonlyArray<ReturnType<typeof commandSetId>>> = {};
  for (const b of ACTIVE_BUCKET_IDS) actionBuckets[b] = [];
  actionBuckets[bucketId('first_action')] = [commandSetId('thief_arts')];
  const passiveBuckets: Record<string, ReadonlyArray<ReturnType<typeof abilityId>>> = {};
  for (const b of PASSIVE_BUCKET_IDS) passiveBuckets[b] = [];
  passiveBuckets[bucketId('reaction')] = [abilityId('slip_free')];
  passiveBuckets[bucketId('support')] = [abilityId('momentum')];
  passiveBuckets[bucketId('movement')] = [abilityId('move_plus_2')];
  return { actionBuckets, passiveBuckets };
}

interface ThiefBattleOpts {
  readonly thiefMp?: number;
  readonly thiefHp?: number;
  readonly thiefBrave?: number;
  readonly thiefWeapon?: boolean;
  readonly targetMp?: number;
  readonly targetHp?: number;
  readonly targetBrave?: number;
  readonly masterSeed?: number;
}

// Thief (team_a) at (0,0) facing E; target (team_b) at (1,0) facing E — so a
// Thief strike lands on the target's BACK (thief back-evasion 0): the evasion
// gate is purely the weapon accuracy, removing facing variance from the test.
function buildThiefBattle(opts: ThiefBattleOpts = {}) {
  const cat = loadDefaultCatalog();
  const stats = classBaselineStats.get(THIEF)!;
  const config: BattleConfig = {
    battleId: 'thief-test',
    rulesetId: rulesetId('default'),
    map: flatMap(6, 6),
    teams: [
      { id: teamId('team_a'), name: 'team_a', control: 'human' },
      { id: teamId('team_b'), name: 'team_b', control: 'ai' },
    ],
    units: [
      {
        id: unitId('thief'),
        name: 'Thief',
        team: teamId('team_a'),
        classId: THIEF,
        position: { x: 0, y: 0, layer: 0 },
        facing: 'E',
        baseStats: {
          ...stats,
          brave: opts.thiefBrave ?? 70,
          faith: 70,
          crit_chance: 0,
          crit_multiplier: 1,
        },
        loadout: thiefLoadout(),
        ...(opts.thiefWeapon === true
          ? {
              equipment: {
                leftHand: itemId('long_sword'),
                rightHand: null,
                headgear: null,
                armor: null,
                accessory: null,
              },
            }
          : {}),
        ...(opts.thiefHp !== undefined ? { vitals: { hp: opts.thiefHp, mp: opts.thiefMp ?? 28 } } : {}),
        ...(opts.thiefHp === undefined && opts.thiefMp !== undefined
          ? { vitals: { hp: 90, mp: opts.thiefMp } }
          : {}),
      },
      {
        id: unitId('mark'),
        name: 'Mark',
        team: teamId('team_b'),
        classId: classId('water_mage'),
        position: { x: 1, y: 0, layer: 0 },
        facing: 'E',
        baseStats: {
          maxHpBase: opts.targetHp ?? 120,
          maxMpBase: 48,
          pa: 4,
          ma: 12,
          spd: 10,
          brave: opts.targetBrave ?? 70,
          faith: 70,
          crit_chance: 0,
          crit_multiplier: 1,
        },
        loadout: { actionBuckets: markActive(), passiveBuckets: emptyPassive() },
        ...(opts.targetHp !== undefined || opts.targetMp !== undefined
          ? { vitals: { hp: opts.targetHp ?? 120, mp: opts.targetMp ?? 48 } }
          : {}),
      },
    ],
    victoryConditions: [{ kind: 'defeat_all', side: teamId('team_b'), description: 'x' }],
    masterSeed: opts.masterSeed ?? 1,
  };
  let state = createInitialState(config, cat);
  state = { ...state, turnState: activeTurnFor(unitId('thief')) };
  return { state, cat };
}

// The target is a Water Mage; its first-action bucket must pin its class
// command set (water_spells) or createInitialState rejects the loadout.
function markActive(): Record<string, ReadonlyArray<ReturnType<typeof commandSetId>>> {
  const m: Record<string, ReadonlyArray<ReturnType<typeof commandSetId>>> = {};
  for (const b of ACTIVE_BUCKET_IDS) m[b] = [];
  m[bucketId('first_action')] = [commandSetId('water_spells')];
  return m;
}
function emptyPassive(): Record<string, ReadonlyArray<ReturnType<typeof abilityId>>> {
  const m: Record<string, ReadonlyArray<ReturnType<typeof abilityId>>> = {};
  for (const b of PASSIVE_BUCKET_IDS) m[b] = [];
  return m;
}

function useAbility(ability: string): ProposedAction {
  return {
    type: 'use_ability',
    source: 'player',
    actorId: unitId('thief'),
    payload: {
      abilityId: abilityId(ability),
      target: { kind: 'unit', unitId: unitId('mark') },
    },
  };
}

// ---------------------------------------------------------------------------
// Smoke: construction + the movement / support passives
// ---------------------------------------------------------------------------

describe('Thief class — battle construction (smoke)', () => {
  it('constructs with the stat block; Move +2 lifts effective Move 3 → 5', () => {
    const { state, cat } = buildThiefBattle();
    const u = state.units.get(unitId('thief'))!;
    expect(u.vitals.hp).toBe(90);
    expect(runModifyStatQuery(state, cat, { unit: u, statName: 'moveRange', baseValue: 3 })).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Steal MP — drain PA×3, restore 50% of MP actually removed
// ---------------------------------------------------------------------------

describe('Steal MP', () => {
  it('drains PA×3 from the target and restores 50% of MP removed (unarmed → back-hit lands)', () => {
    // Thief PA 7 → drain 21. Caster MP 5 (headroom 23). Target MP 40.
    const { state, cat } = buildThiefBattle({ thiefMp: 5, targetMp: 40 });
    const res = commitAction(state, useAbility('steal_mp'), cat);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const drains = res.committed.filter((a) => a.type === 'system_mp_drain');
    expect(drains).toHaveLength(1);
    const markAfter = res.newState.units.get(unitId('mark'))!;
    const thiefAfter = res.newState.units.get(unitId('thief'))!;
    // Target lost the full 21. Thief: 5 − 3 (cast cost) + floor(0.5 × 21)=10 = 12.
    expect(markAfter.vitals.mp).toBe(40 - 21);
    expect(thiefAfter.vitals.mp).toBe(5 - 3 + 10);
  });

  it('restore keys off MP actually removed, not the nominal PA×3 (near-empty target)', () => {
    // Target only has 6 MP; drain request 21 → removes 6; restore floor(0.5×6)=3.
    const { state, cat } = buildThiefBattle({ thiefMp: 5, targetMp: 6 });
    const res = commitAction(state, useAbility('steal_mp'), cat);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const markAfter = res.newState.units.get(unitId('mark'))!;
    const thiefAfter = res.newState.units.get(unitId('thief'))!;
    expect(markAfter.vitals.mp).toBe(0);
    // Thief: 5 − 3 (cast cost) + floor(0.5 × 6)=3 = 5.
    expect(thiefAfter.vitals.mp).toBe(5 - 3 + 3);
  });
});

// ---------------------------------------------------------------------------
// Steal HP — 75% weapon damage, heal 50% of damage dealt
// ---------------------------------------------------------------------------

describe('Steal HP', () => {
  it('deals weapon damage and heals the Thief 50% of damage dealt', () => {
    const { state, cat } = buildThiefBattle({ thiefWeapon: true, thiefHp: 40, targetHp: 200 });
    const res = commitAction(state, useAbility('steal_hp'), cat);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const markAfter = res.newState.units.get(unitId('mark'))!;
    const thiefAfter = res.newState.units.get(unitId('thief'))!;
    const dealt = 200 - markAfter.vitals.hp;
    expect(dealt).toBeGreaterThan(0); // back-hit (evasion 0) landed
    const heals = res.committed.filter((a) => a.type === 'system_heal');
    expect(heals).toHaveLength(1);
    // Thief healed floor(0.5 × dealt) from 40.
    expect(thiefAfter.vitals.hp).toBe(40 + Math.floor(dealt * 0.5));
  });
});

// ---------------------------------------------------------------------------
// Steal Buffs — strip positive-polarity statuses, transfer to the Thief
// ---------------------------------------------------------------------------

describe('Steal Buffs', () => {
  it('on a successful contest, strips Haste off the target and applies it to the Thief', () => {
    // High caster Brave / low target Brave → contest ~95% (capped); seed picked
    // so the contest lands.
    const { state, cat } = buildThiefBattle({ thiefBrave: 100, targetBrave: 1, masterSeed: 7 });
    // Apply Haste to the target first (an enemy-applied buff to be stolen).
    const seeded = applyStatus(
      state,
      {
        targetId: unitId('mark'),
        typeId: statusTypeId('haste'),
        sourceUnitId: unitId('mark'),
        sourceActionSeq: 0,
        duration: 3,
      },
      cat,
    ).newState;
    const res = commitAction(seeded, useAbility('steal_buffs'), cat);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const markAfter = res.newState.units.get(unitId('mark'))!;
    const thiefAfter = res.newState.units.get(unitId('thief'))!;
    expect(markAfter.statuses.some((s) => s.typeId === statusTypeId('haste'))).toBe(false);
    expect(thiefAfter.statuses.some((s) => s.typeId === statusTypeId('haste'))).toBe(true);
  });

  it('the contest chance uses the additive Brave/PA form (base 33)', () => {
    const { state, cat } = buildThiefBattle({ thiefBrave: 85, targetBrave: 70 });
    const caster = state.units.get(unitId('thief'))!;
    const target = state.units.get(unitId('mark'))!;
    // 33 + 3×7 + 0.5×(85 − 70) = 33 + 21 + 7.5 = 61.5.
    expect(
      computeThiefContestChance({ state, catalog: cat, caster, target, baseChance: 33 }),
    ).toBeCloseTo(61.5, 5);
  });
});

// ---------------------------------------------------------------------------
// Momentum — CT refund on a non-magical action (basic Attack included)
// ---------------------------------------------------------------------------

describe('Momentum', () => {
  const { state, cat } = buildThiefBattle();
  const thiefUnit = () => state.units.get(unitId('thief'))!;

  function refundFor(ability: string): number {
    const ab = cat.getAbility(abilityId(ability));
    if (ab.kind !== 'active') throw new Error('expected active');
    const emissions = runOnActionResolved(state, cat, {
      unit: thiefUnit(),
      action: useAbility(ability),
      ability: ab,
    });
    const pushes = emissions.filter((a) => a.type === 'system_ct_push');
    return pushes.reduce((sum, p) => sum + (p.type === 'system_ct_push' ? p.payload.delta : 0), 0);
  }

  it('refunds +10 CT after the basic Attack (a non-magical action)', () => {
    expect(refundFor('attack')).toBe(10);
  });

  it('refunds after the non-magical Steal arts', () => {
    expect(refundFor('steal_hp')).toBe(10);
    expect(refundFor('steal_mp')).toBe(10);
  });

  it('does NOT refund after a Move (null ability)', () => {
    const emissions = runOnActionResolved(state, cat, {
      unit: thiefUnit(),
      action: {
        type: 'move',
        source: 'player',
        actorId: unitId('thief'),
        payload: { destination: { x: 0, y: 0, layer: 0 } },
      },
      ability: null,
    });
    expect(emissions.filter((a) => a.type === 'system_ct_push')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Slip Free — advance an incoming debuff one tick at apply (Brave-gated)
// ---------------------------------------------------------------------------

describe('Slip Free', () => {
  it('shaves one tick off an incoming negative finite debuff (Brave roll fires)', () => {
    // Brave 100 → the reaction-style gate always fires.
    const { state, cat } = buildThiefBattle({ thiefBrave: 100 });
    const applied = applyStatus(
      state,
      {
        targetId: unitId('thief'),
        typeId: statusTypeId('stop'),
        sourceUnitId: unitId('mark'),
        sourceActionSeq: 0,
        duration: 3,
        seed: 1234,
      },
      cat,
    );
    const thiefAfter = applied.newState.units.get(unitId('thief'))!;
    const stop = thiefAfter.statuses.find((s) => s.typeId === statusTypeId('stop'))!;
    expect(stop).toBeDefined();
    expect(stop.remainingDuration).toBe(2);
  });

  it('negates a 1-tick debuff outright (duration → 0 → not applied)', () => {
    const { state, cat } = buildThiefBattle({ thiefBrave: 100 });
    const applied = applyStatus(
      state,
      {
        targetId: unitId('thief'),
        typeId: statusTypeId('stop'),
        sourceUnitId: unitId('mark'),
        sourceActionSeq: 0,
        duration: 1,
        seed: 1234,
      },
      cat,
    );
    expect(applied.result.kind).toBe('resisted');
    const thiefAfter = applied.newState.units.get(unitId('thief'))!;
    expect(thiefAfter.statuses.some((s) => s.typeId === statusTypeId('stop'))).toBe(false);
  });

  it('does not shave a self-applied status (the Thief is not its own enemy)', () => {
    const { state, cat } = buildThiefBattle({ thiefBrave: 100 });
    const applied = applyStatus(
      state,
      {
        targetId: unitId('thief'),
        typeId: statusTypeId('stop'),
        sourceUnitId: unitId('thief'), // self-applied
        sourceActionSeq: 0,
        duration: 3,
        seed: 1234,
      },
      cat,
    );
    const thiefAfter = applied.newState.units.get(unitId('thief'))!;
    const stop = thiefAfter.statuses.find((s) => s.typeId === statusTypeId('stop'))!;
    expect(stop.remainingDuration).toBe(3);
  });

  it('does not fire when Brave is 0 (the gate never triggers)', () => {
    const { state, cat } = buildThiefBattle({ thiefBrave: 0 });
    const applied = applyStatus(
      state,
      {
        targetId: unitId('thief'),
        typeId: statusTypeId('stop'),
        sourceUnitId: unitId('mark'),
        sourceActionSeq: 0,
        duration: 3,
        seed: 1234,
      },
      cat,
    );
    const thiefAfter = applied.newState.units.get(unitId('thief'))!;
    const stop = thiefAfter.statuses.find((s) => s.typeId === statusTypeId('stop'))!;
    expect(stop.remainingDuration).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// reduceSystemMpDrain — restoreFraction (the Steal MP substrate)
// ---------------------------------------------------------------------------

describe('system_mp_drain restoreFraction', () => {
  const cat = loadDefaultCatalog();

  it('restoreFraction 0.5 removes the full amount but credits the source half', () => {
    const source = makeUnit({ id: 'src', spd: 10, maxMpBase: 28, mp: 5 });
    const target = makeUnit({ id: 'tgt', spd: 10, maxMpBase: 48, mp: 40, position: { x: 1, y: 0, layer: 0 } });
    const state = makeGameState({ units: [source, target] });
    const res = reduceSystemMpDrain(
      state,
      {
        type: 'system_mp_drain',
        sequenceNumber: 1,
        source: 'system',
        timestamp: { tick: 0, ct: 0 },
        seed: 0,
        chainDepth: 0,
        isReaction: false,
        payload: { source: unitId('src'), target: unitId('tgt'), amount: 20, restoreFraction: 0.5 },
      },
      cat,
    );
    expect(res.outcome.targetApplied).toBe(20);
    expect(res.outcome.sourceApplied).toBe(10);
    expect(res.newState.units.get(unitId('tgt'))!.vitals.mp).toBe(20);
    expect(res.newState.units.get(unitId('src'))!.vitals.mp).toBe(15);
  });

  it('default (no restoreFraction) is a full transfer — Rasp Pendant unchanged', () => {
    const source = makeUnit({ id: 'src', spd: 10, maxMpBase: 28, mp: 0 });
    const target = makeUnit({ id: 'tgt', spd: 10, maxMpBase: 48, mp: 10, position: { x: 1, y: 0, layer: 0 } });
    const state = makeGameState({ units: [source, target] });
    const res = reduceSystemMpDrain(
      state,
      {
        type: 'system_mp_drain',
        sequenceNumber: 1,
        source: 'system',
        timestamp: { tick: 0, ct: 0 },
        seed: 0,
        chainDepth: 0,
        isReaction: false,
        payload: { source: unitId('src'), target: unitId('tgt'), amount: 8 },
      },
      cat,
    );
    expect(res.outcome.targetApplied).toBe(8);
    expect(res.outcome.sourceApplied).toBe(8);
  });
});
