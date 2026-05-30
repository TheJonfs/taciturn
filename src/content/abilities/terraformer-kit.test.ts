// Session 54 — Terraformer class + native R/S/M, against the real default
// catalog: the ClassDefinition (stats / dominant stat / Move tier / free
// abilities / command set) and the two new passives (Ignore Height's Jump
// override, Expert Former's Worldcraft-cap bump). Worldcraft command-set
// resolution itself is covered in worldcraft/worldcraft.test.ts.

import { describe, expect, it } from 'vitest';
import {
  abilityId,
  classId,
  commandSetId,
  runModifyStatQuery,
  type AbilityId,
  type Loadout,
} from '@engine/index.ts';
import { loadDefaultCatalog } from '../index.ts';
import { makeGameState, makeUnit } from '../../engine/ct/test-fixtures.ts';
import { flatMap } from '../../engine/map/test-fixtures.ts';
import { ACTIVE_BUCKET_IDS, PASSIVE_BUCKET_IDS } from '../../engine/abilities/constants.ts';
import { classBaselineStats, classDominantStats } from '../classes/baseline-stats.ts';
import { terraformer } from '../classes/terraformer.ts';

const catalog = loadDefaultCatalog();

function loadoutWith(bucket: string, passives: ReadonlyArray<AbilityId>): Loadout {
  const actionBuckets: Record<string, ReadonlyArray<ReturnType<typeof commandSetId>>> = {};
  for (const b of ACTIVE_BUCKET_IDS) actionBuckets[b] = [];
  const passiveBuckets: Record<string, ReadonlyArray<AbilityId>> = {};
  for (const b of PASSIVE_BUCKET_IDS) passiveBuckets[b] = [];
  passiveBuckets[bucket] = passives;
  return { actionBuckets, passiveBuckets };
}

describe('Terraformer class definition', () => {
  it('is registered in the catalog', () => {
    expect(catalog.hasClass(classId('terraformer'))).toBe(true);
    expect(catalog.getClass(classId('terraformer'))).toBe(terraformer);
  });

  it('baseline stats: HP 105 / MP 35 / PA 6 / MA 8 / Speed 8', () => {
    expect(classBaselineStats.get(classId('terraformer'))!).toEqual({
      maxHpBase: 105, maxMpBase: 35, pa: 6, ma: 8, spd: 8,
    });
  });

  it('is MA-dominant (definition and parallel map agree)', () => {
    expect(terraformer.dominantStat).toBe('ma');
    expect(classDominantStats.get(classId('terraformer'))).toBe('ma');
  });

  it('Move 2 / Jump 2 — the slow-caster mobility tier', () => {
    expect(terraformer.movement.moveRange).toBe(2);
    expect(terraformer.movement.jump).toBe(2);
  });

  it('evasion 6 / 3 / 0', () => {
    expect(terraformer.evasion).toEqual({ front: 6, side: 3, back: 0 });
  });

  it('first action command set is Worldcraft', () => {
    expect(terraformer.firstActionCommandSet).toBe(commandSetId('worldcraft'));
  });

  it('free abilities: attack, damage_split, ignore_height, expert_former', () => {
    expect(terraformer.freeAbilities).toEqual(
      new Set([
        abilityId('attack'),
        abilityId('damage_split'),
        abilityId('ignore_height'),
        abilityId('expert_former'),
      ]),
    );
  });
});

describe('Ignore Height (Movement passive)', () => {
  it('overrides Jump to 99 when equipped', () => {
    const u = makeUnit({
      id: 'u', spd: 8, classId: 'terraformer',
      loadout: loadoutWith('movement', [abilityId('ignore_height')]),
    });
    const state = makeGameState({ units: [u], map: flatMap(3, 3) });
    const jump = runModifyStatQuery(state, catalog, { unit: u, statName: 'jump', baseValue: 2 });
    expect(jump).toBe(99);
  });

  it('leaves Jump untouched when not equipped', () => {
    const u = makeUnit({ id: 'u', spd: 8, classId: 'terraformer' });
    const state = makeGameState({ units: [u], map: flatMap(3, 3) });
    const jump = runModifyStatQuery(state, catalog, { unit: u, statName: 'jump', baseValue: 2 });
    expect(jump).toBe(2);
  });
});

describe('Expert Former (Support passive)', () => {
  it('raises the Worldcraft effect cap by +2 (2 → 4) when equipped', () => {
    const u = makeUnit({
      id: 'u', spd: 8, classId: 'terraformer',
      loadout: loadoutWith('support', [abilityId('expert_former')]),
    });
    const state = makeGameState({ units: [u], map: flatMap(3, 3) });
    const cap = runModifyStatQuery(state, catalog, {
      unit: u, statName: 'worldcraft_effect_cap', baseValue: 2,
    });
    expect(cap).toBe(4);
  });

  it('leaves the cap at base when not equipped', () => {
    const u = makeUnit({ id: 'u', spd: 8, classId: 'terraformer' });
    const state = makeGameState({ units: [u], map: flatMap(3, 3) });
    const cap = runModifyStatQuery(state, catalog, {
      unit: u, statName: 'worldcraft_effect_cap', baseValue: 2,
    });
    expect(cap).toBe(2);
  });
});
