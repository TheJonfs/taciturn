// Session 41 — Knight R/S/M kit (Martial Expertise + Bravestrider)
// happy-path effect tests. Each ability is verified via its hook's
// runner against a minimally-equipped fixture. Mirrors the pattern in
// movement-abilities.test.ts.

import { describe, expect, it } from 'vitest';
import {
  abilityId,
  bucketId,
  classId,
  commandSetId,
  runModifyStatQuery,
  type AbilityId,
  type ClassDefinition,
  type CommandSetDefinition,
  type Loadout,
} from '@engine/index.ts';
import { createCatalog } from '../../engine/catalog/index.ts';
import {
  DEFAULT_TEST_DAMAGE_PIPELINE,
  makeTestRuleset,
} from '../../engine/catalog/test-fixtures.ts';
import {
  activeTurnFor,
  makeGameState,
  makeUnit,
} from '../../engine/ct/test-fixtures.ts';
import {
  ACTIVE_BUCKET_IDS,
  PASSIVE_BUCKET_IDS,
} from '../../engine/abilities/constants.ts';
import { flatMap } from '../../engine/map/test-fixtures.ts';
import { knight } from '../classes/knight.ts';
import { bravestrider } from './bravestrider.ts';
import { martialExpertise } from './martial-expertise.ts';
import { powerAttack } from './power-attack.ts';
import { stasisSword } from './stasis-sword.ts';
import { taunt } from './taunt.ts';

function knightClass(freeAbilities: ReadonlyArray<string>): ClassDefinition {
  return {
    id: classId('knight'),
    name: 'Knight',
    movement: {
      moveRange: 3,
      jump: 2,
      terrainCosts: new Map(),
      canEnter: new Set(['ground']),
    },
    evasion: { front: 0, side: 0, back: 0 },
    equipmentSlots: {
      leftHand: true,
      rightHand: true,
      headgear: true,
      armor: true,
      accessory: true,
    },
    firstActionCommandSet: commandSetId('battle_skill'),
    freeAbilities: new Set(freeAbilities.map(abilityId)),
    dominantStat: 'pa',
  };
}

function battleSkillSet(): CommandSetDefinition {
  return {
    id: commandSetId('battle_skill'),
    name: 'Battle Skill',
    members: [],
    baseCost: 1,
    availability: 'hidden',
  };
}

function loadoutWith(bucket: string, passives: ReadonlyArray<AbilityId>): Loadout {
  const actionBuckets: Record<string, ReadonlyArray<ReturnType<typeof commandSetId>>> = {};
  for (const b of ACTIVE_BUCKET_IDS) actionBuckets[b] = [];
  const passiveBuckets: Record<string, ReadonlyArray<AbilityId>> = {};
  for (const b of PASSIVE_BUCKET_IDS) passiveBuckets[b] = [];
  passiveBuckets[bucket] = passives;
  return { actionBuckets, passiveBuckets };
}

function setupCatalog(ids: ReadonlyArray<string>) {
  const ability = (id: string) => {
    switch (id) {
      case 'martial_expertise':
        return martialExpertise;
      case 'bravestrider':
        return bravestrider;
      default:
        throw new Error(`unknown test ability ${id}`);
    }
  };
  return createCatalog({
    statusTypes: [],
    abilities: ids.map(ability),
    commandSets: [battleSkillSet()],
    classes: [knightClass(ids)],
    items: [],
    rulesets: [makeTestRuleset({ damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE })],
  });
}

describe('Martial Expertise', () => {
  it('multiplies PA by 1.25 (floor) via modifyStatQuery', () => {
    const cat = setupCatalog(['martial_expertise']);
    const u = makeUnit({
      id: 'u',
      spd: 10,
      pa: 11, // Knight baseline
      loadout: loadoutWith(bucketId('support'), [martialExpertise.id]),
    });
    const state = makeGameState({ units: [u], map: flatMap(3, 3) });
    const pa = runModifyStatQuery(state, cat, {
      unit: u,
      statName: 'pa',
      baseValue: 11,
    });
    // 11 × 1.25 = 13.75 → 13 via Math.floor.
    expect(pa).toBe(13);
  });

  it('does not modify MA, Speed, or moveRange', () => {
    const cat = setupCatalog(['martial_expertise']);
    const u = makeUnit({
      id: 'u',
      spd: 9,
      pa: 11,
      ma: 4,
      loadout: loadoutWith(bucketId('support'), [martialExpertise.id]),
    });
    const state = makeGameState({ units: [u], map: flatMap(3, 3) });
    expect(
      runModifyStatQuery(state, cat, { unit: u, statName: 'ma', baseValue: 4 }),
    ).toBe(4);
    expect(
      runModifyStatQuery(state, cat, { unit: u, statName: 'spd', baseValue: 9 }),
    ).toBe(9);
    expect(
      runModifyStatQuery(state, cat, { unit: u, statName: 'moveRange', baseValue: 3 }),
    ).toBe(3);
  });

  it('floors integer-friendly values (PA 4 → 5)', () => {
    const cat = setupCatalog(['martial_expertise']);
    const u = makeUnit({
      id: 'u',
      spd: 10,
      pa: 4,
      loadout: loadoutWith(bucketId('support'), [martialExpertise.id]),
    });
    const state = makeGameState({ units: [u], map: flatMap(3, 3) });
    // 4 × 1.25 = 5.0 → 5 via floor.
    expect(
      runModifyStatQuery(state, cat, { unit: u, statName: 'pa', baseValue: 4 }),
    ).toBe(5);
  });
});

describe('Bravestrider', () => {
  it('grants +1 moveRange and +10 brave via modifyStatQuery', () => {
    const cat = setupCatalog(['bravestrider']);
    const u = makeUnit({
      id: 'u',
      spd: 10,
      loadout: loadoutWith(bucketId('movement'), [bravestrider.id]),
    });
    const state = makeGameState({ units: [u], map: flatMap(3, 3) });
    expect(
      runModifyStatQuery(state, cat, { unit: u, statName: 'moveRange', baseValue: 3 }),
    ).toBe(4);
    expect(
      runModifyStatQuery(state, cat, { unit: u, statName: 'brave', baseValue: 70 }),
    ).toBe(80);
  });

  it('does not modify PA, MA, or Speed', () => {
    const cat = setupCatalog(['bravestrider']);
    const u = makeUnit({
      id: 'u',
      spd: 10,
      pa: 11,
      ma: 4,
      loadout: loadoutWith(bucketId('movement'), [bravestrider.id]),
    });
    const state = makeGameState({ units: [u], map: flatMap(3, 3) });
    expect(
      runModifyStatQuery(state, cat, { unit: u, statName: 'pa', baseValue: 11 }),
    ).toBe(11);
    expect(
      runModifyStatQuery(state, cat, { unit: u, statName: 'ma', baseValue: 4 }),
    ).toBe(4);
    expect(
      runModifyStatQuery(state, cat, { unit: u, statName: 'spd', baseValue: 10 }),
    ).toBe(10);
  });
});

describe('Knight class definition (S41)', () => {
  it('evasion is 12 / 7 / 0 (best-front-in-v1)', () => {
    expect(knight.evasion.front).toBe(12);
    expect(knight.evasion.side).toBe(7);
    expect(knight.evasion.back).toBe(0);
  });

  it('freeAbilities are attack + counter + martial_expertise + bravestrider', () => {
    expect(knight.freeAbilities.has(abilityId('attack'))).toBe(true);
    expect(knight.freeAbilities.has(abilityId('counter'))).toBe(true);
    expect(knight.freeAbilities.has(abilityId('martial_expertise'))).toBe(true);
    expect(knight.freeAbilities.has(abilityId('bravestrider'))).toBe(true);
  });

  it('does not include the prior Damage Reduction or Move +1 in freeAbilities (still in catalog as cross-class options)', () => {
    expect(knight.freeAbilities.has(abilityId('damage_reduction'))).toBe(false);
    expect(knight.freeAbilities.has(abilityId('move_plus_1'))).toBe(false);
  });
});

describe('Battle Skill MP costs (S41)', () => {
  it('Power Attack mpCost is 6 (S41 +2 from 4)', () => {
    expect(powerAttack.mpCost).toBe(6);
  });

  it('Stasis Sword mpCost is 8 (S41 +2 from 6)', () => {
    expect(stasisSword.mpCost).toBe(8);
  });

  it('Taunt mpCost is 6 (S41 +2 from 4)', () => {
    expect(taunt.mpCost).toBe(6);
  });
});

// Quiet the activeTurnFor import for the linter — re-exported via the
// catalog setup pathway; not directly consumed in these tests.
void activeTurnFor;
