import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '@content/index.ts';
import {
  abilityId,
  bucketId,
  classId,
  commandSetId,
  EMPTY_UNIT_EQUIPMENT,
  unitId,
} from '@engine/index.ts';
import { EMPTY_EARNED_BY_CLASS, type CampaignUnit } from './index.ts';
import { reclassUnit } from './reclass.ts';

const catalog = loadDefaultCatalog();

// A knight with a secondary command set + a passive, wielding Battle Skill.
function knight(): CampaignUnit {
  return {
    id: unitId('u'),
    name: 'Miluda',
    classId: classId('knight'),
    level: 20,
    brave: 70,
    faith: 70,
    loadout: {
      actionBuckets: {
        [bucketId('first_action')]: [commandSetId('battle_skill')],
        [bucketId('secondary_command_sets')]: [commandSetId('thief_arts')],
      },
      passiveBuckets: {
        [bucketId('reaction')]: [abilityId('counter')],
      },
    },
    equipment: EMPTY_UNIT_EQUIPMENT,
    vitals: { hp: 100, mp: 20 },
    xp: 0,
    earnedByClass: EMPTY_EARNED_BY_CLASS,
    unlocks: [],
    fate: 'active',
  };
}

describe('reclassUnit', () => {
  it('rebinds first_action to the new class command set', () => {
    const out = reclassUnit(knight(), classId('monk'), catalog);
    expect(out.classId).toBe(classId('monk'));
    expect(out.loadout.actionBuckets[bucketId('first_action')]).toEqual([
      catalog.getClass(classId('monk')).firstActionCommandSet,
    ]);
  });

  it('preserves secondary command sets and passives', () => {
    const out = reclassUnit(knight(), classId('monk'), catalog);
    expect(out.loadout.actionBuckets[bucketId('secondary_command_sets')]).toEqual([
      commandSetId('thief_arts'),
    ]);
    expect(out.loadout.passiveBuckets[bucketId('reaction')]).toEqual([abilityId('counter')]);
  });

  it('is a no-op (same reference) when already in the target class', () => {
    const u = knight();
    expect(reclassUnit(u, classId('knight'), catalog)).toBe(u);
  });

  it('does not mutate the input unit', () => {
    const u = knight();
    reclassUnit(u, classId('monk'), catalog);
    expect(u.classId).toBe(classId('knight'));
    expect(u.loadout.actionBuckets[bucketId('first_action')]).toEqual([commandSetId('battle_skill')]);
  });
});
