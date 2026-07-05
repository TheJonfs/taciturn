import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '@content/index.ts';
import {
  abilityId,
  bucketId,
  classId,
  commandSetId,
  EMPTY_UNIT_EQUIPMENT,
  type Loadout,
} from '@engine/index.ts';
import { availableInClass } from './ledger.ts';
import { COMPONENT_CATALOG } from './component-catalog-data.ts';
import { seedStartingKit } from './starting-kit.ts';
import { tokenKey } from './tokens.ts';
import { EMPTY_EARNED_BY_CLASS, type CampaignUnit } from '../types.ts';
import { unitId } from '@engine/index.ts';

const catalog = loadDefaultCatalog();
const CAT = COMPONENT_CATALOG;

// A Monk whose loadout wields Martial Arts (primary) + Thievery (secondary) and
// equips one non-native passive (Counter, a Knight reaction) plus a native one.
function monkLoadout(): Loadout {
  return {
    actionBuckets: {
      [bucketId('first_action')]: [commandSetId('martial_arts')],
      [bucketId('secondary_command_sets')]: [commandSetId('thief_arts')],
    },
    passiveBuckets: {
      [bucketId('reaction')]: [abilityId('counterpunch'), abilityId('counter')], // native + exported
    },
  };
}

describe('seedStartingKit', () => {
  const kit = seedStartingKit(classId('monk'), monkLoadout(), catalog, CAT);
  const owned = new Set(kit.unlocks.map(tokenKey));

  it("seeds the primary class's active kit", () => {
    expect(owned.has(tokenKey({ kind: 'ability', id: abilityId('bears_heave') }))).toBe(true);
    expect(owned.has(tokenKey({ kind: 'ability', id: abilityId('chakra') }))).toBe(true);
  });

  it("seeds the secondary command class's actives", () => {
    expect(owned.has(tokenKey({ kind: 'ability', id: abilityId('steal_hp') }))).toBe(true);
  });

  it('seeds an equipped non-native passive (export tax) but not a native one', () => {
    expect(owned.has(tokenKey({ kind: 'ability', id: abilityId('counter') }))).toBe(true); // Knight → exported
    expect(owned.has(tokenKey({ kind: 'ability', id: abilityId('counterpunch') }))).toBe(false); // Monk-native → free
  });

  it('leaves available JP at 0 in every seeded class (earned == spent)', () => {
    const unit: CampaignUnit = {
      id: unitId('u'),
      name: 'Nova',
      classId: classId('monk'),
      level: 25,
      brave: 70,
      faith: 70,
      loadout: monkLoadout(),
      equipment: EMPTY_UNIT_EQUIPMENT,
      vitals: { hp: 1, mp: 1 },
      xp: 0,
      earnedByClass: kit.earnedByClass,
      unlocks: kit.unlocks,
      fate: 'active',
    };
    expect(availableInClass(unit, classId('monk'), CAT)).toBe(0);
    expect(availableInClass(unit, classId('thief'), CAT)).toBe(0);
    expect(availableInClass(unit, classId('knight'), CAT)).toBe(0);
  });

  it('does not seed passive components of the primary class as spend', () => {
    // Monk passives (barehanded/vigilance/counterpunch) are free-in-class → not
    // unlocked by seeding, so they don't inflate the Monk purse.
    expect(kit.unlocks.some((t) => String(t.id) === 'vigilance')).toBe(false);
  });
});
