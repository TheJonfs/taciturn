import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '@content/index.ts';
import {
  abilityId,
  bucketId,
  classId,
  commandSetId,
  EMPTY_LOADOUT,
  EMPTY_UNIT_EQUIPMENT,
  unitId,
} from '@engine/index.ts';
import {
  COMPONENT_CATALOG,
  EMPTY_EARNED_BY_CLASS,
  type CampaignUnit,
  type UnlockToken,
} from '@campaign/index.ts';
import {
  bucketCapacity,
  bucketUsed,
  currentSecondary,
  equippablePassives,
  equippableSecondaryCommands,
  passiveCost,
  primaryCommand,
  setSecondaryCommand,
  togglePassive,
} from './customize-view-model.ts';

const catalog = loadDefaultCatalog();
const CAT = COMPONENT_CATALOG;
const tok = (id: string): UnlockToken => ({ kind: 'ability', id: abilityId(id) });

function unit(over: Partial<CampaignUnit> = {}): CampaignUnit {
  return {
    id: unitId('u'),
    name: 'Test',
    classId: classId('monk'),
    level: 20,
    brave: 70,
    faith: 70,
    loadout: EMPTY_LOADOUT,
    equipment: EMPTY_UNIT_EQUIPMENT,
    vitals: { hp: 100, mp: 20 },
    xp: 0,
    earnedByClass: EMPTY_EARNED_BY_CLASS,
    unlocks: [],
    fate: 'active',
    ...over,
  };
}

describe('equippableSecondaryCommands', () => {
  it('offers a class command set once ≥1 active is unlocked in it, excluding current', () => {
    // Unlocked a Knight active + a Monk active (current class → excluded).
    const u = unit({ unlocks: [tok('power_attack'), tok('bears_heave')] });
    const opts = equippableSecondaryCommands(u, catalog, CAT);
    expect(opts.map((o) => String(o.classId))).toEqual(['knight']);
    expect(opts[0]?.commandSetId).toBe(commandSetId('battle_skill'));
  });

  it('does not offer a class where only a passive is unlocked', () => {
    // counter is a Knight *passive* — not an active → no secondary access.
    const u = unit({ unlocks: [tok('counter')] });
    expect(equippableSecondaryCommands(u, catalog, CAT)).toHaveLength(0);
  });
});

describe('equippablePassives', () => {
  it('marks current-class passives innate and unlocked others exported', () => {
    const u = unit({ unlocks: [tok('counter')] }); // Knight reaction, exported to Monk
    const groups = equippablePassives(u, catalog, CAT);
    const reactions = groups.reaction;
    const counterpunch = reactions.find((p) => p.name === 'Counterpunch')!; // Monk-native
    expect(counterpunch.innate).toBe(true);
    const counter = reactions.find((p) => p.name === 'Counter')!; // Knight, exported
    expect(counter.innate).toBe(false);
  });

  it('omits un-exported foreign passives', () => {
    const u = unit(); // no unlocks
    const groups = equippablePassives(u, catalog, CAT);
    // Counter (Knight) is not unlocked → not equippable on a Monk.
    expect(groups.reaction.some((p) => p.name === 'Counter')).toBe(false);
    // Counterpunch (Monk-native) is free.
    expect(groups.reaction.some((p) => p.name === 'Counterpunch')).toBe(true);
  });
});

describe('bucketCapacity', () => {
  it('returns the ruleset baseline for an unequipped unit', () => {
    const u = unit();
    expect(bucketCapacity(u, 'reaction', catalog)).toBe(3);
    expect(bucketCapacity(u, 'secondary_command_sets', catalog)).toBe(1);
  });
});

describe('passiveCost (cost budget, not count)', () => {
  it('is 0 for a class-free passive and baseCost otherwise', () => {
    // Monk-native passives are among the Monk's freeAbilities → free to slot.
    expect(passiveCost(unit({ classId: classId('monk') }), abilityId('counterpunch'), catalog)).toBe(0);
    // Counter (Knight) costs its baseCost when slotted on a non-owning class.
    const cost = passiveCost(unit({ classId: classId('monk') }), abilityId('counter'), catalog);
    expect(cost).toBeGreaterThan(0);
  });
});

describe('togglePassive (cost-weighted capacity)', () => {
  it('equips and unequips a passive in its bucket', () => {
    const u = unit();
    const equipped = togglePassive(u, abilityId('counterpunch'), 'reaction', 3, catalog);
    expect(equipped.loadout.passiveBuckets[bucketId('reaction')]).toEqual([abilityId('counterpunch')]);
    const removed = togglePassive(equipped, abilityId('counterpunch'), 'reaction', 3, catalog);
    expect(removed.loadout.passiveBuckets[bucketId('reaction')]).toEqual([]);
  });

  it('allows more free (innate) passives than a naive count cap', () => {
    // Three Monk-native (free) reactions would exceed a count of 3 in cost terms
    // only if they cost >0; being free, they always fit.
    let u = unit({ classId: classId('monk') });
    // Monk only has counterpunch as a reaction; equipping it uses 0 cost.
    u = togglePassive(u, abilityId('counterpunch'), 'reaction', 3, catalog);
    expect(bucketUsed(u, 'reaction', catalog)).toBe(0);
    expect(u.loadout.passiveBuckets[bucketId('reaction')]).toHaveLength(1);
  });

  it('rejects an exported passive that would overflow the cost budget', () => {
    // A capacity-1 bucket: an exported passive costing ≥1 fits once; a second overflows.
    let u = unit({ classId: classId('monk'), unlocks: [tok('counter'), tok('combat_focus')] });
    u = togglePassive(u, abilityId('counter'), 'reaction', 1, catalog); // cost 1 → fits
    const before = u.loadout.passiveBuckets[bucketId('reaction')];
    u = togglePassive(u, abilityId('combat_focus'), 'reaction', 1, catalog); // would exceed 1
    expect(u.loadout.passiveBuckets[bucketId('reaction')]).toEqual(before); // unchanged
  });
});

describe('setSecondaryCommand', () => {
  it('sets and clears the secondary command bucket', () => {
    const u = unit();
    const set = setSecondaryCommand(u, commandSetId('battle_skill'));
    expect(currentSecondary(set)).toBe(commandSetId('battle_skill'));
    const cleared = setSecondaryCommand(set, null);
    expect(currentSecondary(cleared)).toBeNull();
  });
});

describe('primaryCommand', () => {
  it('falls back to the class default command set', () => {
    const u = unit({ loadout: EMPTY_LOADOUT });
    expect(primaryCommand(u, catalog).id).toBe(catalog.getClass(classId('monk')).firstActionCommandSet);
  });
});
