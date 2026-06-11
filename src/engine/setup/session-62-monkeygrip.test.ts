// Session 62 — Monkeygrip (ADR-0100), the real createInitialState behavior.
// Monkeygrip is a declarative Support passive carrying `relaxesTwoHandedGrip`.
// The equip validator reads that flag off the loadout's passives and relaxes
// the two-handed-occupies-both-hands rule, so a two-hander can pair with an
// off-hand item. Without it, the same loadout is rejected at setup.

import { describe, expect, it } from 'vitest';
import { createCatalog } from '../catalog/index.ts';
import { defaultTestRulesets } from '../catalog/test-fixtures.ts';
import { makeCommandSet, makeKnight, knightLoadout } from '../abilities/test-fixtures.ts';
import { flatMap } from '../map/test-fixtures.ts';
import {
  bucketId,
  classId,
  rulesetId,
  teamId,
  unitId,
  type BattleConfig,
  type Loadout,
  type UnitPlacement,
} from '../types/index.ts';
import { BattleConfigError, createInitialState } from './create-initial-state.ts';
import { monkeygrip } from '../../content/abilities/monkeygrip.ts';
import { absolom } from '../../content/items/absolom.ts'; // two-handed Knight Sword
import { longSword } from '../../content/items/long-sword.ts'; // one-handed off-hand

function catalog() {
  return createCatalog({
    statusTypes: [],
    abilities: [monkeygrip],
    commandSets: [makeCommandSet({ id: 'battle_skill' })],
    classes: [makeKnight()],
    items: [absolom, longSword],
    rulesets: defaultTestRulesets,
  });
}

function placement(loadout: Loadout): UnitPlacement {
  return {
    id: unitId('u'),
    name: 'u',
    team: teamId('team_a'),
    classId: classId('knight'),
    position: { x: 0, y: 0, layer: 0 },
    facing: 'N',
    baseStats: {
      spd: 10, pa: 5, ma: 4, maxHpBase: 100, maxMpBase: 50,
      brave: 100, faith: 80, crit_chance: 0, crit_multiplier: 1,
    },
    loadout,
    // Two-handed sword in the main hand + a one-handed weapon off-hand —
    // illegal under the two-handed rule unless Monkeygrip relaxes it.
    equipment: {
      rightHand: absolom.id,
      leftHand: longSword.id,
      headgear: null,
      armor: null,
      accessory: null,
    },
  };
}

function configWith(loadout: Loadout): BattleConfig {
  return {
    battleId: 'monkeygrip-test',
    rulesetId: rulesetId('default'),
    map: flatMap(5, 5),
    teams: [{ id: teamId('team_a'), name: 'team_a', control: 'human' }],
    units: [placement(loadout)],
    victoryConditions: [
      { kind: 'defeat_all', side: teamId('team_b'), description: 'defeat enemies' },
    ],
    masterSeed: 1,
  };
}

describe('Monkeygrip — two-handed equip relaxation', () => {
  it('WITHOUT Monkeygrip: a two-hander + off-hand item is rejected at setup', () => {
    const cat = catalog();
    const cfg = configWith(knightLoadout());
    expect(() => createInitialState(cfg, cat)).toThrow(BattleConfigError);
    expect(() => createInitialState(cfg, cat)).toThrow(/two-handed|forbids/i);
  });

  it('WITH Monkeygrip: the same loadout is legal and both hands stay equipped', () => {
    const cat = catalog();
    const cfg = configWith(
      knightLoadout({ passive: [[bucketId('support'), [monkeygrip.id]]] }),
    );
    expect(() => createInitialState(cfg, cat)).not.toThrow();
    const state = createInitialState(cfg, cat);
    const u = state.units.get(unitId('u'))!;
    expect(u.equipment.rightHand).toBe(absolom.id);
    expect(u.equipment.leftHand).toBe(longSword.id);
  });
});
