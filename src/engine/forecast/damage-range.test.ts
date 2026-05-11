// Tests for projectDamageRange.

import { describe, expect, it } from 'vitest';
import {
  abilityId,
  bucketId,
  classId,
  commandSetId,
  createCatalog,
  type ActiveAbilityDefinition,
  type ClassDefinition,
} from '../index.ts';
import {
  DEFAULT_TEST_DAMAGE_PIPELINE,
  makeTestRuleset,
} from '../catalog/test-fixtures.ts';
import { makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { projectDamageRange } from './damage-range.ts';

function knightClass(): ClassDefinition {
  return {
    id: classId('knight'),
    name: 'Knight',
    movement: { moveRange: 3, jump: 2, terrainCosts: new Map(), canEnter: new Set(['ground']) },
    evasion: { front: 0, side: 0, back: 0 },
    equipmentSlots: { leftHand: true, rightHand: true, headgear: true, armor: true, accessory: true },
    firstActionCommandSet: commandSetId('battle_skill'),
    freeAbilities: new Set(),
  };
}

function ability(opts: {
  readonly power_coefficient?: number;
  readonly variance?: { readonly min: number; readonly max: number };
}): ActiveAbilityDefinition {
  return {
    id: abilityId('attack'),
    name: 'Attack',
    kind: 'active',
    bucket: bucketId('first_action'),
    baseCost: 1,
    targeting: { kind: 'single_unit', range: { horizontal: 1, vertical: 3 }, rangeMode: 'melee' },
    actionSpeed: 0,
    mpCost: 0,
    effects: {
      damage: {
        tags: ['physical'],
        power_coefficient: opts.power_coefficient ?? 4,
        ...(opts.variance !== undefined ? { variance: opts.variance } : {}),
      },
    },
  };
}

function makeCatalog(ab: ActiveAbilityDefinition) {
  return createCatalog({
    statusTypes: [],
    abilities: [ab],
    commandSets: [],
    classes: [knightClass()],
    items: [],
    rulesets: [makeTestRuleset({ damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE })],
  });
}

describe('projectDamageRange', () => {
  it('collapses to a single value when variance is flat (no variance band)', () => {
    const attack = ability({ power_coefficient: 4 });
    const attacker = makeUnit({ id: 'a', spd: 10, pa: 5 });
    const target = makeUnit({ id: 'b', spd: 10, hp: 100 });
    const cat = makeCatalog(attack);
    const state = makeGameState({ units: [attacker, target] });
    const r = projectDamageRange({ state, catalog: cat, attacker, target, ability: attack });
    expect(r.min).toBe(20);
    expect(r.expected).toBe(20);
    expect(r.max).toBe(20);
  });

  it('returns the variance band as min/expected/max with expected at midpoint', () => {
    const attack = ability({ power_coefficient: 4, variance: { min: 0.5, max: 1.5 } });
    const attacker = makeUnit({ id: 'a', spd: 10, pa: 5 });
    const target = makeUnit({ id: 'b', spd: 10, hp: 100 });
    const cat = makeCatalog(attack);
    const state = makeGameState({ units: [attacker, target] });
    const r = projectDamageRange({ state, catalog: cat, attacker, target, ability: attack });
    // Base 20 → min 0.5×=10, expected 1.0×=20, max 1.5×=30.
    expect(r.min).toBe(10);
    expect(r.expected).toBe(20);
    expect(r.max).toBe(30);
  });

  it('returns zero range for an ability without a damage spec', () => {
    const debuff: ActiveAbilityDefinition = {
      id: abilityId('debuff'),
      name: 'Debuff',
      kind: 'active',
      bucket: bucketId('first_action'),
      baseCost: 1,
      targeting: { kind: 'single_unit', range: { horizontal: 4, vertical: 3 }, rangeMode: 'arc' },
      actionSpeed: 0,
      mpCost: 6,
      effects: {},
    };
    const attacker = makeUnit({ id: 'a', spd: 10 });
    const target = makeUnit({ id: 'b', spd: 10, hp: 100 });
    const cat = makeCatalog(debuff);
    const state = makeGameState({ units: [attacker, target] });
    const r = projectDamageRange({ state, catalog: cat, attacker, target, ability: debuff });
    expect(r).toEqual({ min: 0, expected: 0, max: 0 });
  });
});
