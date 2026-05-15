// Team builder state — mutation, validity, and engine-agreement tests.

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '@content/index.ts';
import {
  currentTestTeam,
  pureMageTeam,
  buildTeamBattleConfig,
} from '@content/teams/index.ts';
import { riverRidgeBattle } from '@content/battles/river-ridge-battle.ts';
import {
  abilityId,
  BUCKET_REACTION,
  BUCKET_SECONDARY_COMMAND_SETS,
  classId,
  commandSetId,
  createInitialState,
  getCapacity,
  getCost,
  itemId,
  teamId,
  ALL_BUCKET_IDS,
} from '@engine/index.ts';
import {
  buildDefaultLoadout,
  classCanEquip,
  computeTeamValidity,
  createEmptyTeamBuilderState,
  draftAbilityCost,
  draftBucketCapacity,
  setBrave,
  setClass,
  setEquipment,
  setFaith,
  teamBuilderStateFromBuiltTeam,
  teamBuilderStateToBuiltTeam,
  togglePassive,
  toggleSecondaryCommandSet,
} from './team-builder-state.ts';

const catalog = loadDefaultCatalog();
const RULESET_ID = riverRidgeBattle.rulesetId;

describe('team builder state — construction', () => {
  it('createEmptyTeamBuilderState yields four classless, invalid units', () => {
    const state = createEmptyTeamBuilderState();
    expect(state.units).toHaveLength(4);
    for (const unit of state.units) {
      expect(unit.classId).toBeNull();
    }
    const validity = computeTeamValidity(state, catalog, RULESET_ID);
    expect(validity.valid).toBe(false);
    expect(validity.units.every((u) => !u.valid)).toBe(true);
  });

  it('teamBuilderStateFromBuiltTeam round-trips a template', () => {
    const state = teamBuilderStateFromBuiltTeam(currentTestTeam);
    expect(state.name).toBe(currentTestTeam.name);
    state.units.forEach((unit, i) => {
      const source = currentTestTeam.units[i]!;
      expect(unit.classId).toBe(source.classId);
      expect(unit.brave).toBe(source.baseStats.brave);
      expect(unit.faith).toBe(source.baseStats.faith);
      expect(unit.equipment).toEqual(source.equipment);
      expect(unit.loadout).toEqual(source.loadout);
    });
  });

  it('teamBuilderStateToBuiltTeam reproduces a loaded template', () => {
    const state = teamBuilderStateFromBuiltTeam(currentTestTeam);
    const rebuilt = teamBuilderStateToBuiltTeam(state, catalog);
    expect(rebuilt.units).toEqual(currentTestTeam.units);
  });

  it('teamBuilderStateToBuiltTeam throws on a classless unit', () => {
    const state = createEmptyTeamBuilderState();
    expect(() => teamBuilderStateToBuiltTeam(state, catalog)).toThrow(/no class/);
  });
});

describe('team builder state — mutations', () => {
  it('setClass assigns the class and builds its default loadout', () => {
    const state = setClass(createEmptyTeamBuilderState(), 0, classId('knight'), catalog);
    const unit = state.units[0]!;
    expect(unit.classId).toBe(classId('knight'));
    expect(unit.loadout).toEqual(buildDefaultLoadout(classId('knight'), catalog));
  });

  it('setClass clears equipment the new class cannot use', () => {
    let state = setClass(createEmptyTeamBuilderState(), 0, classId('knight'), catalog);
    // war_plate is Knight-only — valid on a Knight.
    state = setEquipment(state, 0, 'armor', itemId('war_plate'));
    expect(state.units[0]!.equipment.armor).toBe(itemId('war_plate'));
    // Reclassing to Water Mage drops it (Knight-only restriction).
    state = setClass(state, 0, classId('water_mage'), catalog);
    expect(state.units[0]!.equipment.armor).toBeNull();
  });

  it('setBrave / setFaith clamp to [40, 90]', () => {
    let state = setClass(createEmptyTeamBuilderState(), 0, classId('knight'), catalog);
    state = setBrave(state, 0, 200);
    expect(state.units[0]!.brave).toBe(90);
    state = setBrave(state, 0, 10);
    expect(state.units[0]!.brave).toBe(40);
    state = setFaith(state, 0, 55);
    expect(state.units[0]!.faith).toBe(55);
  });

  it('togglePassive adds then removes a cross-class passive', () => {
    let state = setClass(createEmptyTeamBuilderState(), 0, classId('knight'), catalog);
    state = togglePassive(state, 0, BUCKET_REACTION, abilityId('earth_resilience'));
    expect(state.units[0]!.loadout.passiveBuckets[BUCKET_REACTION]).toContain(
      abilityId('earth_resilience'),
    );
    state = togglePassive(state, 0, BUCKET_REACTION, abilityId('earth_resilience'));
    expect(state.units[0]!.loadout.passiveBuckets[BUCKET_REACTION]).not.toContain(
      abilityId('earth_resilience'),
    );
  });

  it('toggleSecondaryCommandSet adds then removes a command set', () => {
    let state = setClass(createEmptyTeamBuilderState(), 0, classId('knight'), catalog);
    state = toggleSecondaryCommandSet(state, 0, commandSetId('white_magic'));
    expect(
      state.units[0]!.loadout.actionBuckets[BUCKET_SECONDARY_COMMAND_SETS],
    ).toContain(commandSetId('white_magic'));
    state = toggleSecondaryCommandSet(state, 0, commandSetId('white_magic'));
    expect(
      state.units[0]!.loadout.actionBuckets[BUCKET_SECONDARY_COMMAND_SETS],
    ).not.toContain(commandSetId('white_magic'));
  });

  it('mutations do not modify the input state', () => {
    const original = createEmptyTeamBuilderState();
    setClass(original, 0, classId('knight'), catalog);
    expect(original.units[0]!.classId).toBeNull();
  });
});

describe('team builder state — validity', () => {
  it('a loaded template is valid', () => {
    const state = teamBuilderStateFromBuiltTeam(currentTestTeam);
    expect(computeTeamValidity(state, catalog, RULESET_ID).valid).toBe(true);
    const pure = teamBuilderStateFromBuiltTeam(pureMageTeam);
    expect(computeTeamValidity(pure, catalog, RULESET_ID).valid).toBe(true);
  });

  it('flags a duplicated equipment item across the team', () => {
    let state = teamBuilderStateFromBuiltTeam(currentTestTeam);
    // Knight runs Focus Band; force it onto the Water Mage too.
    state = setEquipment(state, 1, 'headgear', itemId('focus_band'));
    const validity = computeTeamValidity(state, catalog, RULESET_ID);
    expect(validity.duplicateItemIds).toContain(itemId('focus_band'));
    expect(validity.valid).toBe(false);
  });

  it('flags an equipment item the unit class cannot use', () => {
    let state = teamBuilderStateFromBuiltTeam(currentTestTeam);
    // Slot a Knight-only war plate onto the Water Mage (unit index 1).
    state = setEquipment(state, 1, 'armor', itemId('war_plate'));
    const validity = computeTeamValidity(state, catalog, RULESET_ID);
    expect(validity.units[1]!.invalidEquipmentSlots).toContain('armor');
    expect(validity.valid).toBe(false);
  });

  it('flags a class used by more than one unit', () => {
    let state = teamBuilderStateFromBuiltTeam(currentTestTeam);
    // currentTestTeam runs four distinct classes; reclass the Water Mage
    // slot to Fire Mage so two units share a class.
    state = setClass(state, 1, classId('fire_mage'), catalog);
    const validity = computeTeamValidity(state, catalog, RULESET_ID);
    expect(validity.duplicateClassIds).toContain(classId('fire_mage'));
    expect(validity.valid).toBe(false);
  });

  it('flags an over-capacity bucket', () => {
    // Knight reaction capacity is 3; Counter is free (cost 0). Pile on
    // four cost-1 cross-class reactions → used 4 > capacity 3.
    let state = setClass(createEmptyTeamBuilderState(), 0, classId('knight'), catalog);
    for (const ability of [
      'earth_resilience',
      'smolder',
      'discharge',
      'tidal_pull',
    ]) {
      state = togglePassive(state, 0, BUCKET_REACTION, abilityId(ability));
    }
    const validity = computeTeamValidity(state, catalog, RULESET_ID);
    const overage = validity.units[0]!.bucketOverages.find(
      (o) => o.bucketId === BUCKET_REACTION,
    );
    expect(overage).toBeDefined();
    expect(overage!.used).toBeGreaterThan(overage!.capacity);
  });
});

describe('team builder state — equipment eligibility', () => {
  it('classCanEquip respects class restrictions and slot/kind', () => {
    // Knight-only war plate.
    expect(
      classCanEquip(classId('knight'), 'armor', catalog.getItem(itemId('war_plate')), catalog),
    ).toBe(true);
    expect(
      classCanEquip(
        classId('water_mage'),
        'armor',
        catalog.getItem(itemId('war_plate')),
        catalog,
      ),
    ).toBe(false);
    // A weapon cannot go in the headgear slot.
    expect(
      classCanEquip(
        classId('knight'),
        'headgear',
        catalog.getItem(itemId('long_sword')),
        catalog,
      ),
    ).toBe(false);
  });
});

// The local capacity / cost helpers must agree with the engine's
// authoritative getCapacity / getCost. This pins them so a future
// change to engine composition fails loud here rather than silently
// drifting the team builder's budget display.
describe('team builder state — engine agreement', () => {
  it('draftBucketCapacity matches getCapacity for a built team', () => {
    const config = buildTeamBattleConfig(
      riverRidgeBattle,
      currentTestTeam,
      teamId('team_a'),
    );
    const state = createInitialState(config, catalog);
    const blueUnits = config.units.filter((u) => u.team === teamId('team_a'));
    for (const placement of blueUnits) {
      for (const bucketId of ALL_BUCKET_IDS) {
        const engineValue = getCapacity(state, placement.id, bucketId, catalog);
        const draftValue = draftBucketCapacity(
          placement.equipment!,
          bucketId,
          catalog,
          RULESET_ID,
        );
        expect(draftValue, `${String(placement.id)} / ${String(bucketId)}`).toBe(
          engineValue,
        );
      }
    }
  });

  it('draftAbilityCost matches getCost (free and cross-class)', () => {
    const config = buildTeamBattleConfig(
      riverRidgeBattle,
      currentTestTeam,
      teamId('team_a'),
    );
    const state = createInitialState(config, catalog);
    const knight = config.units.find((u) => u.classId === classId('knight'))!;
    // Counter is free for the Knight; earth_resilience is cross-class.
    for (const ability of ['counter', 'earth_resilience', 'smolder']) {
      const engineValue = getCost(state, knight.id, abilityId(ability), catalog);
      const draftValue = draftAbilityCost(
        classId('knight'),
        abilityId(ability),
        catalog,
      );
      expect(draftValue, ability).toBe(engineValue);
    }
  });
});
