// TABA M3 — Freelancer's Charm, the Ch1 breadth-enabler unique, and the
// equip-legality override seam it installs (first instance).
//
// The charm: +1 secondary command-set capacity; NO class-restricted
// (Heavy/Magical-lane) body while worn — the lateral armor-identity
// cost. Enforcement lives beside the class↔item checks at battle setup
// (validateEquipmentPlacement); a future universal-equip item is
// instance two of the same `equipLegality` shape.

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from './index.ts';
import {
  BattleConfigError,
  createInitialState,
  getCapacity,
  bucketId,
  classId,
  commandSetId,
  itemId,
  rulesetId,
  teamId,
  unitId,
} from '@engine/index.ts';
import type { BattleConfig, UnitEquipment } from '@engine/index.ts';
import { flatMap } from '../engine/map/test-fixtures.ts';
import { makeGameState, makeUnit } from '../engine/ct/test-fixtures.ts';
import { freelancersCharm } from './items/freelancers-charm.ts';

const cat = loadDefaultCatalog();

const gear = (armor: string | null): UnitEquipment => ({
  leftHand: null,
  rightHand: null,
  headgear: null,
  armor: armor === null ? null : itemId(armor),
  accessory: itemId('freelancers_charm'),
});

const configWith = (equipment: UnitEquipment): BattleConfig => ({
  battleId: 'charm-test',
  rulesetId: rulesetId('default'),
  map: flatMap(5, 5),
  teams: [{ id: teamId('team_a'), name: 'A', control: 'human' as const }],
  units: [
    {
      id: unitId('u1'),
      name: 'u1',
      team: teamId('team_a'),
      classId: classId('knight'),
      position: { x: 0, y: 0, layer: 0 },
      facing: 'N',
      baseStats: { spd: 10, pa: 5, ma: 4, maxHpBase: 100, maxMpBase: 50, brave: 100, faith: 80, crit_chance: 0, crit_multiplier: 1 },
      vitals: { hp: 100, mp: 0 },
      // The first_action pin requires the class's own command set.
      loadout: {
        actionBuckets: { [bucketId('first_action')]: [commandSetId('battle_skill')] },
        passiveBuckets: {},
      },
      equipment,
    },
  ],
  victoryConditions: [
    { kind: 'defeat_all', side: teamId('team_a'), description: 'test' },
  ],
  masterSeed: 42,
});

describe("Freelancer's Charm — definition + scoping", () => {
  it("is 'hidden', grants +1 secondary command set, forbids class-restricted bodies", () => {
    expect(freelancersCharm.availability).toBe('hidden');
    expect([...(freelancersCharm.bucketCapacityMods ?? new Map())].map(([k, v]) => [String(k), v])).toEqual([
      ['secondary_command_sets', 1],
    ]);
    expect(freelancersCharm.equipLegality).toEqual({ forbidClassRestrictedInSlots: ['armor'] });
  });

  it('lifts the wearer’s secondary command-set capacity 1 → 2', () => {
    const wearer = makeUnit({ id: 'w', spd: 10, equipment: gear(null) });
    const state = makeGameState({ units: [wearer] });
    expect(getCapacity(state, unitId('w'), bucketId('secondary_command_sets'), cat)).toBe(2);
  });
});

describe('equip-legality override — setup enforcement (the seam)', () => {
  it('rejects the charm + a class-restricted body (War Plate) at battle setup', () => {
    expect(() => createInitialState(configWith(gear('war_plate')), cat)).toThrow(BattleConfigError);
    expect(() => createInitialState(configWith(gear('war_plate')), cat)).toThrow(/forbids class-restricted gear in armor/);
  });

  it('accepts the charm + an unrestricted body (Padded Vest)', () => {
    expect(() => createInitialState(configWith(gear('padded_vest')), cat)).not.toThrow();
  });

  it('accepts the charm with no body at all (travelling light is legal)', () => {
    expect(() => createInitialState(configWith(gear(null)), cat)).not.toThrow();
  });
});
