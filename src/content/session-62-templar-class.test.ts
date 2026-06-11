// Session 62 — Templar class assembly. Wires the (already-built and tested)
// abilities, weapons, and innates into a registered, playable class: the
// stat block, the Templar Arts command set (Cure / Raise / Jump), the four
// innates as free abilities, and Knight head/body gear permission.

import { describe, expect, it } from 'vitest';
import {
  abilityId,
  bucketId,
  classId,
  commandSetId,
  rulesetId,
  teamId,
  unitId,
  runModifyStatQuery,
  type BattleConfig,
  type Loadout,
} from '@engine/index.ts';
import { createInitialState } from '../engine/setup/create-initial-state.ts';
import { ACTIVE_BUCKET_IDS, PASSIVE_BUCKET_IDS } from '../engine/abilities/constants.ts';
import { flatMap } from '../engine/map/test-fixtures.ts';
import { loadDefaultCatalog } from './index.ts';
import { templar } from './classes/templar.ts';
import { templarArts } from './command-sets/templar-arts.ts';
import { classBaselineStats } from './classes/baseline-stats.ts';
import { cure } from './abilities/cure.ts';
import { raise } from './abilities/raise.ts';
import { jump } from './abilities/jump.ts';
import { crusadersHelm } from './items/crusaders-helm.ts';
import { steelHelm } from './items/steel-helm.ts';
import { tacticalMask } from './items/tactical-mask.ts';
import { soldiersLeathers } from './items/soldiers-leathers.ts';
import { spikedMail } from './items/spiked-mail.ts';
import { warPlate } from './items/war-plate.ts';
import { escutcheon } from './items/escutcheon.ts';
import { warriorsAegis } from './items/warriors-aegis.ts';
import { managuard } from './items/managuard.ts';

const TEMPLAR = classId('templar');

describe('Templar class — registration + stat line', () => {
  const cat = loadDefaultCatalog();

  it('is registered in the default catalog', () => {
    expect(cat.hasClass(TEMPLAR)).toBe(true);
    expect(cat.getClass(TEMPLAR).name).toBe('Templar');
  });

  it('has the spec stat block (HP 132 / MP 36 / PA 6 / MA 6 / Speed 8), dominant MA', () => {
    expect(classBaselineStats.get(TEMPLAR)).toEqual({
      maxHpBase: 132,
      maxMpBase: 36,
      pa: 6,
      ma: 6,
      spd: 8,
    });
    expect(templar.dominantStat).toBe('ma');
  });

  it('has Move 2 / Jump 3 and evasion 10 / 6 / 2', () => {
    expect(templar.movement.moveRange).toBe(2);
    expect(templar.movement.jump).toBe(3);
    expect(templar.evasion).toEqual({ front: 10, side: 6, back: 2 });
  });
});

describe('Templar class — command set + innates', () => {
  it('first action is Templar Arts (Cure / Raise / Jump)', () => {
    expect(templar.firstActionCommandSet).toBe(commandSetId('templar_arts'));
    expect(templarArts.members).toEqual([
      abilityId('cure'),
      abilityId('raise'),
      abilityId('jump'),
    ]);
    expect(templarArts.availability).toBe('available');
  });

  it('grants Attack + the four innates free', () => {
    for (const id of ['attack', 'emissary', 'monkeygrip', 'unified_calling', 'faithstrider']) {
      expect(templar.freeAbilities.has(abilityId(id))).toBe(true);
    }
  });

  it('surfaces Cure / Raise / Jump (availability flipped to available)', () => {
    expect(cure.availability).toBe('available');
    expect(raise.availability).toBe('available');
    expect(jump.availability).toBe('available');
  });
});

describe('Templar class — gear permission', () => {
  it('may wear the six Knight head/body pieces (and Knight still can)', () => {
    for (const item of [crusadersHelm, steelHelm, tacticalMask, soldiersLeathers, spikedMail, warPlate]) {
      expect(item.classRestrictions).toContain(TEMPLAR);
      expect(item.classRestrictions).toContain(classId('knight'));
    }
  });

  it('also gains the Knight shields (Chris, S62 — Knight head/body + shields)', () => {
    for (const shield of [escutcheon, warriorsAegis, managuard]) {
      expect(shield.classRestrictions).toContain(TEMPLAR);
      expect(shield.classRestrictions).toContain(classId('knight'));
    }
  });
});

describe('Templar class — battle construction (smoke)', () => {
  // A real Templar build slots its four innates — each free (cost 0, so they
  // don't eat the 3-point reaction/support/movement budgets, per the
  // concept-notes "innate is free, separate from the budgets"). `freeAbilities`
  // zeroes the cost; the abilities are still slotted to be active (the Knight's
  // free passives work the same way).
  function templarLoadout(): Loadout {
    const actionBuckets: Record<string, ReadonlyArray<ReturnType<typeof commandSetId>>> = {};
    for (const b of ACTIVE_BUCKET_IDS) actionBuckets[b] = [];
    actionBuckets[bucketId('first_action')] = [commandSetId('templar_arts')];
    const passiveBuckets: Record<string, ReadonlyArray<ReturnType<typeof abilityId>>> = {};
    for (const b of PASSIVE_BUCKET_IDS) passiveBuckets[b] = [];
    passiveBuckets[bucketId('movement')] = [abilityId('faithstrider')];
    passiveBuckets[bucketId('support')] = [abilityId('emissary'), abilityId('monkeygrip')];
    passiveBuckets[bucketId('reaction')] = [abilityId('unified_calling')];
    return { actionBuckets, passiveBuckets };
  }

  it('a Templar unit constructs with its stat block and its (free) innates active', () => {
    const cat = loadDefaultCatalog();
    const stats = classBaselineStats.get(TEMPLAR)!;
    const config: BattleConfig = {
      battleId: 'templar-smoke',
      rulesetId: rulesetId('default'),
      map: flatMap(6, 6),
      teams: [{ id: teamId('team_a'), name: 'team_a', control: 'human' }],
      units: [
        {
          id: unitId('t'),
          name: 'Templar',
          team: teamId('team_a'),
          classId: TEMPLAR,
          position: { x: 0, y: 0, layer: 0 },
          facing: 'N',
          baseStats: { ...stats, brave: 70, faith: 70, crit_chance: 5, crit_multiplier: 1.5 },
          loadout: templarLoadout(),
        },
      ],
      victoryConditions: [{ kind: 'defeat_all', side: teamId('team_b'), description: 'x' }],
      masterSeed: 1,
    };
    const state = createInitialState(config, cat);
    const u = state.units.get(unitId('t'))!;
    expect(u).toBeDefined();
    // Stat block applied: vitals filled from computed max HP (132, no gear).
    expect(u.vitals.hp).toBe(132);
    // The slotted (free) Faithstrider is live → +1 moveRange (2 → 3) and
    // +10 faith (70 → 80) — proving the innate kit is wired and the loadout
    // validated with all four innates at zero cost.
    expect(runModifyStatQuery(state, cat, { unit: u, statName: 'moveRange', baseValue: 2 })).toBe(3);
    expect(runModifyStatQuery(state, cat, { unit: u, statName: 'faith', baseValue: 70 })).toBe(80);
  });
});
