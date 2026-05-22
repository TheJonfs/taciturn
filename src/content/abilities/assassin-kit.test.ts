// Session 42 — Assassin kit + Two Weapons substrate + formula variants.
//
// Passive-hook, formula, and content-shape tests against the real
// default catalog. Multi-swing *dispatch* (per-swing damage / proc
// scoping through the reducer) lives in
// engine/actions/session-42-multiswing-integration.test.ts.

import { describe, expect, it } from 'vitest';
import {
  abilityId,
  bucketId,
  classId,
  commandSetId,
  computeSpeed,
  runModifyDualWield,
  runModifyStatQuery,
  statusTypeId,
  type AbilityId,
  type Loadout,
} from '@engine/index.ts';
import { loadDefaultCatalog } from '../index.ts';
import { computeStatusChance } from '../../engine/status/chance.ts';
import { applyStatus } from '../../engine/status/apply.ts';
import { makeGameState, makeUnit } from '../../engine/ct/test-fixtures.ts';
import {
  ACTIVE_BUCKET_IDS,
  PASSIVE_BUCKET_IDS,
} from '../../engine/abilities/constants.ts';
import { flatMap } from '../../engine/map/test-fixtures.ts';
import { classBaselineStats } from '../classes/baseline-stats.ts';
import { assassin } from '../classes/assassin.ts';
import { braveDown } from '../statuses/brave-down.ts';
import { faithDown } from '../statuses/faith-down.ts';
import { speedSave } from '../statuses/speed-save.ts';

const catalog = loadDefaultCatalog();

function loadoutWith(bucket: string, passives: ReadonlyArray<AbilityId>): Loadout {
  const actionBuckets: Record<string, ReadonlyArray<ReturnType<typeof commandSetId>>> = {};
  for (const b of ACTIVE_BUCKET_IDS) actionBuckets[b] = [];
  const passiveBuckets: Record<string, ReadonlyArray<AbilityId>> = {};
  for (const b of PASSIVE_BUCKET_IDS) passiveBuckets[b] = [];
  passiveBuckets[bucket] = passives;
  return { actionBuckets, passiveBuckets };
}

describe('Two Weapons (Support)', () => {
  it('grants dual-wield via modifyDualWield', () => {
    const u = makeUnit({
      id: 'u',
      spd: 14,
      classId: 'assassin',
      loadout: loadoutWith(bucketId('support'), [abilityId('two_weapons')]),
    });
    const state = makeGameState({ units: [u], map: flatMap(3, 3) });
    expect(runModifyDualWield(state, catalog, { unit: u })).toBe(true);
  });

  it('a unit without Two Weapons does not dual-wield', () => {
    const u = makeUnit({ id: 'u', spd: 14, classId: 'assassin' });
    const state = makeGameState({ units: [u], map: flatMap(3, 3) });
    expect(runModifyDualWield(state, catalog, { unit: u })).toBe(false);
  });

  it('multiplies PA by 0.75 (floor) via modifyStatQuery', () => {
    const u = makeUnit({
      id: 'u',
      spd: 14,
      pa: 6, // Assassin baseline
      classId: 'assassin',
      loadout: loadoutWith(bucketId('support'), [abilityId('two_weapons')]),
    });
    const state = makeGameState({ units: [u], map: flatMap(3, 3) });
    // 6 × 0.75 = 4.5 → 4 via floor.
    expect(runModifyStatQuery(state, catalog, { unit: u, statName: 'pa', baseValue: 6 })).toBe(4);
  });

  it('does not modify MA or Speed', () => {
    const u = makeUnit({
      id: 'u',
      spd: 14,
      ma: 3,
      classId: 'assassin',
      loadout: loadoutWith(bucketId('support'), [abilityId('two_weapons')]),
    });
    const state = makeGameState({ units: [u], map: flatMap(3, 3) });
    expect(runModifyStatQuery(state, catalog, { unit: u, statName: 'ma', baseValue: 3 })).toBe(3);
    expect(runModifyStatQuery(state, catalog, { unit: u, statName: 'spd', baseValue: 14 })).toBe(14);
  });
});

describe('Fleet of Foot (Movement)', () => {
  it('grants +1 moveRange and +1 jump', () => {
    const u = makeUnit({
      id: 'u',
      spd: 14,
      classId: 'assassin',
      loadout: loadoutWith(bucketId('movement'), [abilityId('fleet_of_foot')]),
    });
    const state = makeGameState({ units: [u], map: flatMap(3, 3) });
    expect(runModifyStatQuery(state, catalog, { unit: u, statName: 'moveRange', baseValue: 4 })).toBe(5);
    expect(runModifyStatQuery(state, catalog, { unit: u, statName: 'jump', baseValue: 4 })).toBe(5);
  });

  it('does not modify PA', () => {
    const u = makeUnit({
      id: 'u',
      spd: 14,
      pa: 6,
      classId: 'assassin',
      loadout: loadoutWith(bucketId('movement'), [abilityId('fleet_of_foot')]),
    });
    const state = makeGameState({ units: [u], map: flatMap(3, 3) });
    expect(runModifyStatQuery(state, catalog, { unit: u, statName: 'pa', baseValue: 6 })).toBe(6);
  });
});

describe('Speed Save status (accumulator)', () => {
  it('adds its magnitude to Speed and accumulates onto one instance', () => {
    const unit = makeUnit({ id: 'u', spd: 14, classId: 'assassin' });
    let state = makeGameState({ units: [unit], map: flatMap(3, 3) });
    const apply = () => {
      state = applyStatus(
        state,
        { targetId: unit.id, typeId: statusTypeId('speed_save'), sourceUnitId: null, sourceActionSeq: null, magnitude: 1 },
        catalog,
      ).newState;
    };
    apply();
    expect(computeSpeed(state, unit.id, catalog)).toBe(15);
    apply();
    // STACK_ADDITIVE sums onto a single instance → +2, and one instance.
    const u = state.units.get(unit.id)!;
    expect(u.statuses.filter((s) => s.typeId === statusTypeId('speed_save'))).toHaveLength(1);
    expect(computeSpeed(state, unit.id, catalog)).toBe(16);
  });

  it('is buff-polarity (Remedy never clears it)', () => {
    expect(speedSave.aiHints?.polarity).toBe('buff');
  });
});

describe('Stat-reduction debuffs are Remedy-immune (Session 42)', () => {
  it('brave_down / faith_down declare remedyImmune and reduce their stat', () => {
    expect(braveDown.remedyImmune).toBe(true);
    expect(faithDown.remedyImmune).toBe(true);
    for (const id of ['pa_down', 'ma_down', 'speed_down', 'brave_down', 'faith_down']) {
      expect(catalog.getStatusType(statusTypeId(id)).remedyImmune).toBe(true);
    }
  });

  it('classic ailments stay Remedy-clearable (not remedyImmune)', () => {
    for (const id of ['poison', 'blind', 'silence', 'stop']) {
      expect(catalog.getStatusType(statusTypeId(id)).remedyImmune).not.toBe(true);
    }
  });
});

describe('Brave-and-Speed / Faith-and-Speed formula variants', () => {
  function chance(factors: { brave?: boolean; faith?: boolean; speed?: boolean; ma?: boolean }, casterSpd: number) {
    const caster = makeUnit({ id: 'c', spd: casterSpd, brave: 70, faith: 70 });
    const target = makeUnit({ id: 't', spd: 10, brave: 80, faith: 80, position: { x: 1, y: 0, layer: 0 } });
    const state = makeGameState({ units: [caster, target], map: flatMap(3, 3) });
    return computeStatusChance({
      state,
      catalog,
      caster,
      target,
      statusType: catalog.getStatusType(statusTypeId('stop')),
      ability: null,
      baseChance: 60,
      factors,
    });
  }

  it('Brave-and-Speed = baseFraction × (cb/100) × (tb/100) × (0.9 + spd/20)', () => {
    // 0.6 × 0.7 × 0.8 × (0.9 + 14/20) = 0.6 × 0.56 × 1.6 = 0.5376
    expect(chance({ brave: true, speed: true }, 14)).toBeCloseTo(0.5376, 4);
  });

  it('Speed term scales with caster Speed', () => {
    // Faster caster → higher chance. Speed 20 → factor 1.9.
    expect(chance({ brave: true, speed: true }, 20)).toBeCloseTo(0.6 * 0.56 * 1.9, 4);
  });

  it('Faith-and-Speed = baseFraction × (cf/100) × (tf/100) × (0.9 + spd/20)', () => {
    // 0.6 × 0.7 × 0.8 × 1.6 = 0.5376 (same numbers; faith 70/80 here)
    expect(chance({ faith: true, speed: true }, 14)).toBeCloseTo(0.5376, 4);
  });

  it('backward-compat: Brave-and-MA (no speed) is unchanged', () => {
    // 0.6 × (0.7 × 0.8) × (0.9 + ma/10). makeUnit ma default 4 → 1.3.
    expect(chance({ brave: true, ma: true }, 14)).toBeCloseTo(0.6 * 0.56 * 1.3, 4);
  });
});

describe('Assassin class definition', () => {
  it('baseline stats: HP 96 / MP 24 / PA 6 / MA 3 / Speed 14', () => {
    const s = classBaselineStats.get(classId('assassin'))!;
    expect(s).toEqual({ maxHpBase: 96, maxMpBase: 24, pa: 6, ma: 3, spd: 14 });
  });

  it('evasion 8 / 4 / 0', () => {
    expect(assassin.evasion).toEqual({ front: 8, side: 4, back: 0 });
  });

  it('native free R/S/M: Two Weapons, Speed Save, Fleet of Foot (+ attack)', () => {
    expect(assassin.freeAbilities.has(abilityId('two_weapons'))).toBe(true);
    expect(assassin.freeAbilities.has(abilityId('speed_save'))).toBe(true);
    expect(assassin.freeAbilities.has(abilityId('fleet_of_foot'))).toBe(true);
    expect(assassin.freeAbilities.has(abilityId('attack'))).toBe(true);
  });

  it('first-action command set is Shadow Arts', () => {
    expect(assassin.firstActionCommandSet).toBe(commandSetId('shadow_arts'));
    const set = catalog.getCommandSet(commandSetId('shadow_arts'));
    expect(set.members).toEqual([
      abilityId('shadow_stitch'),
      abilityId('blowdart'),
      abilityId('undermine'),
      abilityId('sow_doubt'),
    ]);
  });
});
