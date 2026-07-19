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
import { COMPONENT_CATALOG, EMPTY_EARNED_BY_CLASS, type CampaignUnit, type UnlockToken } from './index.ts';
import { reclassUnit } from './reclass.ts';

const catalog = loadDefaultCatalog();
const CAT = COMPONENT_CATALOG;
const tok = (id: string): UnlockToken => ({ kind: 'ability', id: abilityId(id) });

// A knight with a secondary command set + a Knight-native reaction (Counter),
// plus optional extra unlocks/passives supplied per test.
function knight(over: Partial<CampaignUnit> = {}): CampaignUnit {
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
    ...over,
  };
}

describe('reclassUnit', () => {
  it('rebinds first_action to the new class command set', () => {
    const out = reclassUnit(knight(), classId('monk'), catalog, CAT);
    expect(out.classId).toBe(classId('monk'));
    expect(out.loadout.actionBuckets[bucketId('first_action')]).toEqual([
      catalog.getClass(classId('monk')).firstActionCommandSet,
    ]);
  });

  it('UNEQUIPS a passive no longer legal in the new class (old-class native, unexported)', () => {
    // Counter is Knight-native and not unlocked → illegal on a Monk → stripped.
    const out = reclassUnit(knight(), classId('monk'), catalog, CAT);
    expect(out.loadout.passiveBuckets[bucketId('reaction')]).toEqual([]);
  });

  it('KEEPS a still-legal passive (exported / new-class native) through the reclass', () => {
    // combat_focus (Alchemist reaction) unlocked → exported → legal anywhere.
    const u = knight({
      unlocks: [tok('combat_focus')],
      loadout: {
        actionBuckets: { [bucketId('first_action')]: [commandSetId('battle_skill')] },
        passiveBuckets: { [bucketId('reaction')]: [abilityId('counter'), abilityId('combat_focus')] },
      },
    });
    const out = reclassUnit(u, classId('monk'), catalog, CAT);
    // Counter stripped (illegal), Combat Focus kept (exported).
    expect(out.loadout.passiveBuckets[bucketId('reaction')]).toEqual([abilityId('combat_focus')]);
  });

  it('preserves a still-valid secondary command set', () => {
    const out = reclassUnit(knight(), classId('monk'), catalog, CAT);
    expect(out.loadout.actionBuckets[bucketId('secondary_command_sets')]).toEqual([
      commandSetId('thief_arts'),
    ]);
  });

  it('clears a secondary command that now duplicates the new primary', () => {
    // Secondary = Martial Arts (Monk's command); reclass to Monk → redundant → cleared.
    const u = knight({
      loadout: {
        actionBuckets: {
          [bucketId('first_action')]: [commandSetId('battle_skill')],
          [bucketId('secondary_command_sets')]: [commandSetId('martial_arts')],
        },
        passiveBuckets: {},
      },
    });
    const out = reclassUnit(u, classId('monk'), catalog, CAT);
    expect(out.loadout.actionBuckets[bucketId('secondary_command_sets')]).toEqual([]);
  });

  it('re-normalizes vitals to the NEW class curves (S96 — no stale HP/MP through a reclass)', () => {
    const out = reclassUnit(knight(), classId('monk'), catalog, CAT);
    // The fixture's arbitrary {100, 20} must be replaced by the Monk's
    // effective full at L20 — whatever it is, it isn't the stale carry.
    expect(out.vitals).not.toEqual({ hp: 100, mp: 20 });
    expect(out.vitals.hp).toBeGreaterThan(0);
  });

  it('is a no-op (same reference) when already in the target class', () => {
    const u = knight();
    expect(reclassUnit(u, classId('knight'), catalog, CAT)).toBe(u);
  });

  it('does not mutate the input unit', () => {
    const u = knight();
    reclassUnit(u, classId('monk'), catalog, CAT);
    expect(u.classId).toBe(classId('knight'));
    expect(u.loadout.actionBuckets[bucketId('first_action')]).toEqual([commandSetId('battle_skill')]);
    expect(u.loadout.passiveBuckets[bucketId('reaction')]).toEqual([abilityId('counter')]);
  });

  // TABA chapter-1 plot-units: the `classAccessOverride` is a DURABLE unit field
  // (the plot-unique relief valve). It must survive the reclass round-trip — a
  // plot-unique reclasses OUT to its Tier-1 fallback and BACK to its override
  // class — else the anti-dead-end would evaporate on first reclass. This is the
  // "one load-bearing mechanic" the brief flags to confirm.
  it('preserves classAccessOverride across a reclass round-trip', () => {
    const override = [classId('assassin'), classId('monk')] as const;
    const thessaly = knight({
      classId: classId('assassin'),
      classAccessOverride: [...override],
      loadout: {
        actionBuckets: { [bucketId('first_action')]: [commandSetId('thief_arts')] },
        passiveBuckets: {},
      },
    });
    const toFallback = reclassUnit(thessaly, classId('monk'), catalog, CAT);
    expect(toFallback.classAccessOverride).toEqual([...override]);
    const back = reclassUnit(toFallback, classId('assassin'), catalog, CAT);
    expect(back.classId).toBe(classId('assassin'));
    expect(back.classAccessOverride).toEqual([...override]);
  });
});
