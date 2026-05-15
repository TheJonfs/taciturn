// Structural compliance tests for the "Current Test Team" template.
//
// The template must (a) be unique-per-team compliant, (b) load into a
// valid battle config (loadout + equipment validation passes), and
// (c) stay in sync with `riverRidgeBattle`'s Blue team — it is, by
// definition, that team expressed as a `BuiltTeam`.

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '@content/index.ts';
import { createInitialState, teamId } from '@engine/index.ts';
import { riverRidgeBattle } from '../battles/river-ridge-battle.ts';
import { buildTeamBattleConfig } from './build-team-battle-config.ts';
import { currentTestTeam } from './current-test-team.ts';

const EQUIPMENT_SLOTS = [
  'leftHand',
  'rightHand',
  'headgear',
  'armor',
  'accessory',
] as const;

describe('Current Test Team template', () => {
  it('has exactly four units', () => {
    expect(currentTestTeam.units).toHaveLength(4);
  });

  it('is unique-per-team compliant (no equipment item appears twice)', () => {
    const seen = new Map<string, string>();
    for (const unit of currentTestTeam.units) {
      for (const slot of EQUIPMENT_SLOTS) {
        const item = unit.equipment[slot];
        if (item === null) continue;
        const prior = seen.get(String(item));
        expect(
          prior,
          `${String(item)} appears on both ${prior} and ${unit.name}`,
        ).toBeUndefined();
        seen.set(String(item), unit.name);
      }
    }
  });

  it('loads into a valid battle config (loadout + equipment validation passes)', () => {
    const catalog = loadDefaultCatalog();
    // buildTeamBattleConfig folds the template onto River Ridge's Blue
    // slots; createInitialState runs loadout validation and equipment-
    // placement validation — an over-capacity bucket or a class-
    // restricted item in the wrong hands throws here.
    const config = buildTeamBattleConfig(
      riverRidgeBattle,
      currentTestTeam,
      teamId('team_a'),
    );
    const state = createInitialState(config, catalog);
    expect(state.units.size).toBe(riverRidgeBattle.units.length);
  });

  it("matches riverRidgeBattle's Blue team (class, loadout, equipment)", () => {
    const blueUnits = riverRidgeBattle.units.filter(
      (u) => u.team === teamId('team_a'),
    );
    expect(currentTestTeam.units).toHaveLength(blueUnits.length);
    currentTestTeam.units.forEach((templateUnit, index) => {
      const blueUnit = blueUnits[index]!;
      expect(templateUnit.classId).toBe(blueUnit.classId);
      expect(templateUnit.loadout).toEqual(blueUnit.loadout);
      expect(templateUnit.equipment).toEqual(blueUnit.equipment);
    });
  });
});
