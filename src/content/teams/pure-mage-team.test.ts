// Structural compliance tests for the "Pure Mage Team" template.
//
// The template must (a) be unique-per-team compliant, (b) load into a
// valid battle config, and (c) actually be four mages, one of each
// element — its whole reason for existing.

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '@content/index.ts';
import { classId, createInitialState, teamId } from '@engine/index.ts';
import { riverRidgeBattle } from '../battles/river-ridge-battle.ts';
import { buildTeamBattleConfig } from './build-team-battle-config.ts';
import { pureMageTeam } from './pure-mage-team.ts';

const EQUIPMENT_SLOTS = [
  'leftHand',
  'rightHand',
  'headgear',
  'armor',
  'accessory',
] as const;

describe('Pure Mage Team template', () => {
  it('has exactly four units', () => {
    expect(pureMageTeam.units).toHaveLength(4);
  });

  it('is four mages, one of each element', () => {
    const classes = pureMageTeam.units.map((u) => u.classId);
    expect(new Set(classes)).toEqual(
      new Set([
        classId('earth_mage'),
        classId('water_mage'),
        classId('fire_mage'),
        classId('lightning_mage'),
      ]),
    );
  });

  it('is unique-per-team compliant (no equipment item appears twice)', () => {
    const seen = new Map<string, string>();
    for (const unit of pureMageTeam.units) {
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
    const config = buildTeamBattleConfig(
      riverRidgeBattle,
      pureMageTeam,
      teamId('team_a'),
    );
    const state = createInitialState(config, catalog);
    expect(state.units.size).toBe(riverRidgeBattle.units.length);
  });
});
