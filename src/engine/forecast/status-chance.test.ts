// Tests for projectStatusChances and the underlying computeStatusChance.

import { describe, expect, it } from 'vitest';
import {
  abilityId,
  bucketId,
  classId,
  commandSetId,
  computeStatusChance,
  createCatalog,
  rollStatusChance,
  statusTypeId,
  type ActiveAbilityDefinition,
  type ClassDefinition,
} from '../index.ts';
import { makeTestRuleset, DEFAULT_TEST_DAMAGE_PIPELINE } from '../catalog/test-fixtures.ts';
import { makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { makeStatusType } from '../status/test-fixtures.ts';
import { projectStatusChances } from './status-chance.ts';

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

describe('computeStatusChance / rollStatusChance parity', () => {
  it('rollStatusChance returns the same chance value computeStatusChance produces', () => {
    const stun = makeStatusType({ id: 'stun' });
    const cat = createCatalog({
      statusTypes: [stun],
      abilities: [],
      commandSets: [],
      classes: [knightClass()],
      items: [],
      rulesets: [makeTestRuleset({ damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE })],
    });
    const caster = makeUnit({ id: 'a', spd: 10, ma: 7, faith: 80 });
    const target = makeUnit({ id: 'b', spd: 10, faith: 80 });
    const state = makeGameState({ units: [caster, target] });

    const args = {
      state,
      catalog: cat,
      caster,
      target,
      statusType: stun,
      ability: null,
      baseChance: 100,
    } as const;
    const pure = computeStatusChance(args);
    const rolled = rollStatusChance({ ...args, seed: 42 });
    expect(rolled.chance).toBeCloseTo(pure, 10);
  });
});

describe('projectStatusChances', () => {
  it('returns one forecast per declared status effect with the post-modifier chance', () => {
    const stun = makeStatusType({ id: 'stun' });
    const blind = makeStatusType({ id: 'blind' });
    const ab: ActiveAbilityDefinition = {
      id: abilityId('stunbolt'),
      name: 'Stunbolt',
      kind: 'active',
      bucket: bucketId('first_action'),
      baseCost: 1,
      availability: 'hidden',
      targeting: { kind: 'single_unit', range: { horizontal: 4, vertical: 3 }, rangeMode: 'arc' },
      actionSpeed: 0,
      mpCost: 6,
      effects: {
        statusEffects: [
          { typeId: statusTypeId('stun'), target: 'primary_target', baseChance: 100 },
          { typeId: statusTypeId('blind'), target: 'primary_target', baseChance: 50 },
        ],
      },
    };
    const cat = createCatalog({
      statusTypes: [stun, blind],
      abilities: [ab],
      commandSets: [],
      classes: [knightClass()],
      items: [],
      rulesets: [makeTestRuleset({ damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE })],
    });
    const caster = makeUnit({ id: 'a', spd: 10, ma: 7, faith: 80 });
    const target = makeUnit({ id: 'b', spd: 10, faith: 80 });
    const state = makeGameState({ units: [caster, target] });

    const forecasts = projectStatusChances({ state, catalog: cat, caster, target, ability: ab });
    expect(forecasts).toHaveLength(2);
    expect(forecasts[0]!.statusTypeId).toBe(statusTypeId('stun'));
    expect(forecasts[1]!.statusTypeId).toBe(statusTypeId('blind'));
    // Stun base 100 should be higher than Blind base 50 with the same factors.
    expect(forecasts[0]!.chance).toBeGreaterThan(forecasts[1]!.chance);
  });

  it('returns empty when the ability declares no status effects', () => {
    const ab: ActiveAbilityDefinition = {
      id: abilityId('plain'),
      name: 'Plain',
      kind: 'active',
      bucket: bucketId('first_action'),
      baseCost: 1,
      availability: 'hidden',
      targeting: { kind: 'single_unit', range: { horizontal: 4, vertical: 3 }, rangeMode: 'arc' },
      actionSpeed: 0,
      mpCost: 0,
      effects: { damage: { tags: ['physical'], power_coefficient: 4 } },
    };
    const cat = createCatalog({
      statusTypes: [],
      abilities: [ab],
      commandSets: [],
      classes: [knightClass()],
      items: [],
      rulesets: [makeTestRuleset({ damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE })],
    });
    const caster = makeUnit({ id: 'a', spd: 10 });
    const target = makeUnit({ id: 'b', spd: 10 });
    const state = makeGameState({ units: [caster, target] });

    expect(projectStatusChances({ state, catalog: cat, caster, target, ability: ab })).toHaveLength(0);
  });
});
