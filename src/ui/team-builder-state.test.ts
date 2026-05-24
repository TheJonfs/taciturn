// Team builder state — mutation, validity, and engine-agreement tests.

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '@content/index.ts';
import {
  currentTestTeam,
  defensiveFront,
  mageVarietyPack,
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
import { ivalicianNames } from '@content/names/index.ts';
import {
  buildDefaultLoadout,
  classCanEquip,
  computeTeamValidity,
  createEmptyTeamBuilderState,
  draftAbilityCost,
  draftBucketCapacity,
  MAX_TEAM_SIZE,
  setBrave,
  setClass,
  setEquipment,
  setFaith,
  setUnitName,
  teamBuilderStateFromBuiltTeam,
  teamBuilderStateToBuiltTeam,
  togglePassive,
  toggleSecondaryCommandSet,
  UNIT_NAME_MAX_LENGTH,
} from './team-builder-state.ts';

const catalog = loadDefaultCatalog();
const RULESET_ID = riverRidgeBattle.rulesetId;

describe('team builder state — construction', () => {
  it('createEmptyTeamBuilderState yields MAX_TEAM_SIZE empty (valid-but-empty) slots; team is invalid until a unit is added', () => {
    const state = createEmptyTeamBuilderState();
    expect(state.units).toHaveLength(MAX_TEAM_SIZE);
    for (const unit of state.units) {
      expect(unit.classId).toBeNull();
    }
    const validity = computeTeamValidity(state, catalog, RULESET_ID);
    // S48: per-slot validity is "valid-but-empty" — empty slots don't
    // fail validation in isolation.
    expect(validity.units.every((u) => u.valid)).toBe(true);
    // But the team itself is invalid until at least one slot is filled.
    expect(validity.activeUnitCount).toBe(0);
    expect(validity.valid).toBe(false);
  });

  it('teamBuilderStateFromBuiltTeam round-trips a template; shorter templates pad with empty slots', () => {
    const state = teamBuilderStateFromBuiltTeam(currentTestTeam);
    expect(state.name).toBe(currentTestTeam.name);
    // S48: state always presents MAX_TEAM_SIZE slots; legacy 4-unit
    // templates load with their 4 filled + (MAX_TEAM_SIZE - 4) empty.
    expect(state.units).toHaveLength(MAX_TEAM_SIZE);
    currentTestTeam.units.forEach((source, i) => {
      const unit = state.units[i]!;
      expect(unit.classId).toBe(source.classId);
      expect(unit.brave).toBe(source.baseStats.brave);
      expect(unit.faith).toBe(source.baseStats.faith);
      expect(unit.equipment).toEqual(source.equipment);
      expect(unit.loadout).toEqual(source.loadout);
    });
    // Trailing slot(s) are empty.
    for (let i = currentTestTeam.units.length; i < MAX_TEAM_SIZE; i++) {
      expect(state.units[i]!.classId).toBeNull();
    }
  });

  it('teamBuilderStateToBuiltTeam reproduces a loaded template (empty slots filtered out)', () => {
    const state = teamBuilderStateFromBuiltTeam(currentTestTeam);
    const rebuilt = teamBuilderStateToBuiltTeam(state, catalog);
    // S48: empty padding slots are filtered out so a round-trip
    // preserves the original (shorter) template length.
    expect(rebuilt.units).toEqual(currentTestTeam.units);
  });

  it('teamBuilderStateToBuiltTeam throws when no slot has a class', () => {
    const state = createEmptyTeamBuilderState();
    expect(() => teamBuilderStateToBuiltTeam(state, catalog)).toThrow(
      /no active units/,
    );
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
    state = setEquipment(state, 0, 'armor', itemId('war_plate'), catalog);
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

describe('team builder state — unit naming (Session 38)', () => {
  it('an empty draft has every unit unnamed', () => {
    const state = createEmptyTeamBuilderState();
    for (const unit of state.units) {
      expect(unit.name).toBeUndefined();
    }
  });

  it('setClass auto-picks an Ivalician name on first class assignment', () => {
    const state = setClass(createEmptyTeamBuilderState(), 0, classId('knight'), catalog);
    expect(state.units[0]!.name).toBeDefined();
    expect(ivalicianNames).toContain(state.units[0]!.name!);
  });

  it('setClass preserves the existing name on a reclass', () => {
    let state = setClass(createEmptyTeamBuilderState(), 0, classId('knight'), catalog);
    const firstName = state.units[0]!.name!;
    state = setClass(state, 0, classId('water_mage'), catalog);
    expect(state.units[0]!.name).toBe(firstName);
  });

  it('setClass auto-picks a name not used by sibling units', () => {
    let state = setClass(createEmptyTeamBuilderState(), 0, classId('knight'), catalog);
    state = setClass(state, 1, classId('water_mage'), catalog);
    state = setClass(state, 2, classId('fire_mage'), catalog);
    state = setClass(state, 3, classId('lightning_mage'), catalog);
    // S48: skip any trailing empty slots — they carry no name.
    const names = state.units
      .filter((u) => u.classId !== null)
      .map((u) => u.name!);
    expect(names).toHaveLength(4);
    expect(new Set(names).size).toBe(4);
  });

  it('setUnitName trims and stores a non-empty name', () => {
    let state = setClass(createEmptyTeamBuilderState(), 0, classId('knight'), catalog);
    state = setUnitName(state, 0, '  Aldric  ');
    expect(state.units[0]!.name).toBe('Aldric');
  });

  it('setUnitName caps a long name at UNIT_NAME_MAX_LENGTH', () => {
    let state = setClass(createEmptyTeamBuilderState(), 0, classId('knight'), catalog);
    const long = 'A'.repeat(UNIT_NAME_MAX_LENGTH * 2);
    state = setUnitName(state, 0, long);
    expect(state.units[0]!.name!.length).toBe(UNIT_NAME_MAX_LENGTH);
  });

  it('setUnitName re-rolls when the input is empty (after trim)', () => {
    let state = setClass(createEmptyTeamBuilderState(), 0, classId('knight'), catalog);
    const before = state.units[0]!.name!;
    state = setUnitName(state, 0, '   ');
    const after = state.units[0]!.name!;
    expect(after).toBeDefined();
    // Re-roll explicitly excludes the prior name, so we get a different one.
    expect(after).not.toBe(before);
    expect(ivalicianNames).toContain(after);
  });

  it('teamBuilderStateFromBuiltTeam carries the template-authored names', () => {
    const state = teamBuilderStateFromBuiltTeam(currentTestTeam);
    // S48: only the first N slots come from the template; trailing
    // pad-slots are empty (no name).
    currentTestTeam.units.forEach((source, i) => {
      expect(state.units[i]!.name).toBe(source.name);
    });
  });

  it('teamBuilderStateToBuiltTeam emits the unit name (or class fallback)', () => {
    let state = setClass(createEmptyTeamBuilderState(), 0, classId('knight'), catalog);
    state = setClass(state, 1, classId('water_mage'), catalog);
    state = setClass(state, 2, classId('fire_mage'), catalog);
    state = setClass(state, 3, classId('lightning_mage'), catalog);
    state = setUnitName(state, 0, 'Aldric');
    const built = teamBuilderStateToBuiltTeam(state, catalog);
    expect(built.units[0]!.name).toBe('Aldric');
    // Auto-picked names propagate through to the BuiltTeam too.
    expect(ivalicianNames).toContain(built.units[1]!.name);
  });
});

describe('team builder state — validity', () => {
  it('a loaded template is valid', () => {
    const state = teamBuilderStateFromBuiltTeam(currentTestTeam);
    expect(computeTeamValidity(state, catalog, RULESET_ID).valid).toBe(true);
    const variety = teamBuilderStateFromBuiltTeam(mageVarietyPack);
    expect(computeTeamValidity(variety, catalog, RULESET_ID).valid).toBe(true);
    const defensive = teamBuilderStateFromBuiltTeam(defensiveFront);
    expect(computeTeamValidity(defensive, catalog, RULESET_ID).valid).toBe(true);
  });

  it('flags a duplicated equipment item across the team', () => {
    let state = teamBuilderStateFromBuiltTeam(currentTestTeam);
    // Knight (slot 0) wears Diamond Bracelet; force it onto the
    // Lightning Mage (slot 1) too, replacing Boots of Haste.
    state = setEquipment(state, 1, 'accessory', itemId('diamond_bracelet'), catalog);
    const validity = computeTeamValidity(state, catalog, RULESET_ID);
    expect(validity.duplicateItemIds).toContain(itemId('diamond_bracelet'));
    expect(validity.valid).toBe(false);
  });

  it('flags an equipment item the unit class cannot use', () => {
    let state = teamBuilderStateFromBuiltTeam(currentTestTeam);
    // Slot a Knight-only war plate onto the Water Mage (unit index 1).
    state = setEquipment(state, 1, 'armor', itemId('war_plate'), catalog);
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

  it('flags dual-wielding (two weapons across the hand slots)', () => {
    let state = setClass(createEmptyTeamBuilderState(), 0, classId('knight'), catalog);
    // Long Sword + War Axe — both weapons.
    state = setEquipment(state, 0, 'rightHand', itemId('long_sword'), catalog);
    state = setEquipment(state, 0, 'leftHand', itemId('war_axe'), catalog);
    const validity = computeTeamValidity(state, catalog, RULESET_ID);
    expect(validity.units[0]!.dualWielding).toBe(true);
    expect(validity.units[0]!.valid).toBe(false);
    expect(validity.valid).toBe(false);
  });

  it('weapon + shield (one of each) is allowed', () => {
    let state = setClass(createEmptyTeamBuilderState(), 0, classId('knight'), catalog);
    state = setEquipment(state, 0, 'rightHand', itemId('long_sword'), catalog);
    state = setEquipment(state, 0, 'leftHand', itemId('managuard'), catalog);
    const validity = computeTeamValidity(state, catalog, RULESET_ID);
    expect(validity.units[0]!.dualWielding).toBe(false);
  });

  it('Two Weapons (Assassin) makes two-weapon dual-wield legal (Session 42)', () => {
    // Assassin has native Two Weapons (modifyDualWield), so a weapon in
    // each hand is valid rather than flagged.
    let state = setClass(createEmptyTeamBuilderState(), 0, classId('assassin'), catalog);
    state = setEquipment(state, 0, 'rightHand', itemId('sai'), catalog);
    state = setEquipment(state, 0, 'leftHand', itemId('chefs_knife'), catalog);
    const validity = computeTeamValidity(state, catalog, RULESET_ID);
    expect(validity.units[0]!.dualWielding).toBe(false);
    expect(validity.units[0]!.valid).toBe(true);
  });

  it('equipping a two-handed bow clears the off-hand (Session 45)', () => {
    let state = setClass(createEmptyTeamBuilderState(), 0, classId('hunter'), catalog);
    // Shield first, then a two-handed Longbow in the other hand.
    state = setEquipment(state, 0, 'leftHand', itemId('managuard'), catalog);
    state = setEquipment(state, 0, 'rightHand', itemId('longbow'), catalog);
    expect(state.units[0]!.equipment.rightHand).toBe(itemId('longbow'));
    expect(state.units[0]!.equipment.leftHand).toBeNull();
    expect(computeTeamValidity(state, catalog, RULESET_ID).units[0]!.twoHandedConflict).toBe(false);
  });

  it('flags a two-handed weapon sharing a hand with an off-hand item (Session 45)', () => {
    // Build the illegal state directly (the picker auto-clears, so this
    // guards loaded templates / edge states).
    let state = setClass(createEmptyTeamBuilderState(), 0, classId('hunter'), catalog);
    state = {
      ...state,
      units: state.units.map((u, i) =>
        i === 0
          ? { ...u, equipment: { ...u.equipment, rightHand: itemId('longbow'), leftHand: itemId('managuard') } }
          : u,
      ) as unknown as typeof state.units,
    };
    const validity = computeTeamValidity(state, catalog, RULESET_ID);
    expect(validity.units[0]!.twoHandedConflict).toBe(true);
    expect(validity.units[0]!.valid).toBe(false);
  });

  // ---- S48 variable team size ----

  it('a 1-unit team is valid — single-unit teams clear the minimum (S48)', () => {
    let state = setClass(createEmptyTeamBuilderState(), 0, classId('knight'), catalog);
    const validity = computeTeamValidity(state, catalog, RULESET_ID);
    expect(validity.activeUnitCount).toBe(1);
    expect(validity.valid).toBe(true);
  });

  it('a 5-unit team is valid — every slot filled with a distinct class (S48)', () => {
    let state = setClass(createEmptyTeamBuilderState(), 0, classId('knight'), catalog);
    state = setClass(state, 1, classId('water_mage'), catalog);
    state = setClass(state, 2, classId('fire_mage'), catalog);
    state = setClass(state, 3, classId('lightning_mage'), catalog);
    state = setClass(state, 4, classId('earth_mage'), catalog);
    const validity = computeTeamValidity(state, catalog, RULESET_ID);
    expect(validity.activeUnitCount).toBe(MAX_TEAM_SIZE);
    expect(validity.valid).toBe(true);
  });

  it('a 5-unit team folds through buildTeamBattleConfig + createInitialState (S48)', () => {
    let state = setClass(createEmptyTeamBuilderState(), 0, classId('knight'), catalog);
    state = setClass(state, 1, classId('water_mage'), catalog);
    state = setClass(state, 2, classId('fire_mage'), catalog);
    state = setClass(state, 3, classId('lightning_mage'), catalog);
    state = setClass(state, 4, classId('earth_mage'), catalog);
    const built = teamBuilderStateToBuiltTeam(state, catalog);
    expect(built.units).toHaveLength(MAX_TEAM_SIZE);
    const config = buildTeamBattleConfig(
      riverRidgeBattle,
      built,
      teamId('team_a'),
    );
    const initial = createInitialState(config, catalog);
    // 5 player units + every authored team_b unit.
    const otherTeamCount = riverRidgeBattle.units.filter(
      (u) => u.team !== teamId('team_a'),
    ).length;
    expect(initial.units.size).toBe(MAX_TEAM_SIZE + otherTeamCount);
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
