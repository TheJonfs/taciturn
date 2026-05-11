// Session 26 — happy-path effect tests for the four new movement
// passives. Each ability is verified via its hook's runner against a
// minimally-equipped fixture. Composition with other abilities and the
// full reducer is covered separately (engine hook tests; AI-vs-AI
// integration test) — these tests pin the local contract.

import { describe, expect, it } from 'vitest';
import {
  abilityId,
  bucketId,
  classId,
  commandSetId,
  runModifyStatQuery,
  runModifyTerrainCosts,
  type AbilityId,
  type ClassDefinition,
  type CommandSetDefinition,
  type Loadout,
  type TerrainType,
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
import { commitAction } from '../../engine/actions/commit.ts';
import { bedrockStride } from './bedrock-stride.ts';
import { hotfoot } from './hotfoot.ts';
import { quickstep } from './quickstep.ts';
import { tidewalker } from './tidewalker.ts';

function knightClass(freeAbilities: ReadonlyArray<string>): ClassDefinition {
  return {
    id: classId('knight'),
    name: 'Knight',
    movement: { moveRange: 3, jump: 2, terrainCosts: new Map(), canEnter: new Set(['ground']) },
    evasion: { front: 0, side: 0, back: 0 },
    equipmentSlots: { leftHand: true, rightHand: true, headgear: true, armor: true, accessory: true },
    firstActionCommandSet: commandSetId('battle_skill'),
    freeAbilities: new Set(freeAbilities.map(abilityId)),
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
  const actionBuckets: Record<string, ReturnType<typeof commandSetId> | null> = {};
  for (const b of ACTIVE_BUCKET_IDS) actionBuckets[b] = null;
  const passiveBuckets: Record<string, ReadonlyArray<AbilityId>> = {};
  for (const b of PASSIVE_BUCKET_IDS) passiveBuckets[b] = [];
  passiveBuckets[bucket] = passives;
  return { actionBuckets, passiveBuckets };
}

function rulesetFull() {
  return makeTestRuleset({
    damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE,
    perUnitPerTurnReactions: 3,
  });
}

function setupCatalog(ids: ReadonlyArray<string>) {
  const ability = (id: string) => {
    switch (id) {
      case 'bedrock_stride': return bedrockStride;
      case 'hotfoot': return hotfoot;
      case 'tidewalker': return tidewalker;
      case 'quickstep': return quickstep;
      default: throw new Error(`unknown test ability ${id}`);
    }
  };
  return createCatalog({
    statusTypes: [],
    abilities: ids.map(ability),
    commandSets: [battleSkillSet()],
    classes: [knightClass(ids)],
    items: [],
    rulesets: [rulesetFull()],
  });
}

describe('Bedrock Stride', () => {
  it('grants +1 moveRange via modifyStatQuery', () => {
    const cat = setupCatalog(['bedrock_stride']);
    const u = makeUnit({
      id: 'u',
      spd: 10,
      loadout: loadoutWith(bucketId('movement'), [bedrockStride.id]),
    });
    const state = makeGameState({ units: [u], map: flatMap(3, 3) });
    const moveRange = runModifyStatQuery(state, cat, {
      unit: u,
      statName: 'moveRange',
      baseValue: 3,
    });
    expect(moveRange).toBe(4);
  });

  it('does not modify spd', () => {
    const cat = setupCatalog(['bedrock_stride']);
    const u = makeUnit({
      id: 'u',
      spd: 10,
      loadout: loadoutWith(bucketId('movement'), [bedrockStride.id]),
    });
    const state = makeGameState({ units: [u], map: flatMap(3, 3) });
    const spd = runModifyStatQuery(state, cat, {
      unit: u,
      statName: 'spd',
      baseValue: 10,
    });
    expect(spd).toBe(10);
  });

  it('nullifies falling system_damage end-to-end', () => {
    const cat = setupCatalog(['bedrock_stride']);
    const u = makeUnit({
      id: 'u',
      spd: 10,
      hp: 50,
      maxHpBase: 60,
      loadout: loadoutWith(bucketId('movement'), [bedrockStride.id]),
    });
    const state = makeGameState({ units: [u], map: flatMap(3, 3) });
    const r = commitAction(
      state,
      {
        type: 'system_damage',
        source: 'system',
        payload: {
          targetId: u.id,
          amount: 30,
          tags: ['physical'],
          source: { kind: 'falling', unitId: u.id, dropDistance: 5 },
        },
      },
      cat,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.newState.units.get(u.id)!.vitals.hp).toBe(50);
  });
});

describe('Hotfoot', () => {
  it('grants +1 moveRange and +1 spd', () => {
    const cat = setupCatalog(['hotfoot']);
    const u = makeUnit({
      id: 'u',
      spd: 10,
      loadout: loadoutWith(bucketId('movement'), [hotfoot.id]),
    });
    const state = makeGameState({ units: [u], map: flatMap(3, 3) });
    expect(
      runModifyStatQuery(state, cat, { unit: u, statName: 'moveRange', baseValue: 3 }),
    ).toBe(4);
    expect(
      runModifyStatQuery(state, cat, { unit: u, statName: 'spd', baseValue: 10 }),
    ).toBe(11);
  });

  it('does not modify unrelated stats (pa)', () => {
    const cat = setupCatalog(['hotfoot']);
    const u = makeUnit({
      id: 'u',
      spd: 10,
      pa: 5,
      loadout: loadoutWith(bucketId('movement'), [hotfoot.id]),
    });
    const state = makeGameState({ units: [u], map: flatMap(3, 3) });
    expect(
      runModifyStatQuery(state, cat, { unit: u, statName: 'pa', baseValue: 5 }),
    ).toBe(5);
  });
});

describe('Tidewalker', () => {
  it('floors water tile cost at 1 (no-op when base is already 1)', () => {
    const cat = setupCatalog(['tidewalker']);
    const u = makeUnit({
      id: 'u',
      spd: 10,
      loadout: loadoutWith(bucketId('movement'), [tidewalker.id]),
    });
    const state = makeGameState({ units: [u], map: flatMap(3, 3) });
    const base = new Map<TerrainType, number>();
    const result = runModifyTerrainCosts(state, cat, { unit: u, baseValue: base });
    expect(result.get('water')).toBe(1);
  });

  it('reduces an elevated water cost by 1', () => {
    const cat = setupCatalog(['tidewalker']);
    const u = makeUnit({
      id: 'u',
      spd: 10,
      loadout: loadoutWith(bucketId('movement'), [tidewalker.id]),
    });
    const state = makeGameState({ units: [u], map: flatMap(3, 3) });
    const base = new Map<TerrainType, number>([['water', 3]]);
    const result = runModifyTerrainCosts(state, cat, { unit: u, baseValue: base });
    expect(result.get('water')).toBe(2);
  });

  it('clamps to 1 when the running cost is already at the floor', () => {
    const cat = setupCatalog(['tidewalker']);
    const u = makeUnit({
      id: 'u',
      spd: 10,
      loadout: loadoutWith(bucketId('movement'), [tidewalker.id]),
    });
    const state = makeGameState({ units: [u], map: flatMap(3, 3) });
    const base = new Map<TerrainType, number>([['water', 1]]);
    const result = runModifyTerrainCosts(state, cat, { unit: u, baseValue: base });
    expect(result.get('water')).toBe(1);
  });
});

describe('Quickstep', () => {
  it('emits system_ct_push of +MA when a Move was committed this turn', () => {
    const cat = setupCatalog(['quickstep']);
    const u = makeUnit({
      id: 'u',
      spd: 10,
      ma: 8,
      hp: 50,
      maxHpBase: 60,
      ct: 100,
      loadout: loadoutWith(bucketId('movement'), [quickstep.id]),
    });
    const turn = activeTurnFor(u.id);
    const state = makeGameState({
      units: [u],
      map: flatMap(3, 3),
      turnState: { ...turn, consumed: { movesConsumed: 1, actsConsumed: 0 } },
    });
    const r = commitAction(
      state,
      { type: 'turn_end', source: 'system', payload: { unitId: u.id } },
      cat,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const pushed = r.committed.find((a) => a.type === 'system_ct_push');
    expect(pushed).toBeDefined();
    if (pushed && pushed.type === 'system_ct_push') {
      expect(pushed.payload.delta).toBe(8);
      expect(pushed.payload.targetId).toBe(u.id);
    }
  });

  it('no emission when no Move was committed', () => {
    const cat = setupCatalog(['quickstep']);
    const u = makeUnit({
      id: 'u',
      spd: 10,
      ma: 8,
      hp: 50,
      maxHpBase: 60,
      ct: 100,
      loadout: loadoutWith(bucketId('movement'), [quickstep.id]),
    });
    const turn = activeTurnFor(u.id);
    const state = makeGameState({
      units: [u],
      map: flatMap(3, 3),
      turnState: { ...turn, consumed: { movesConsumed: 0, actsConsumed: 1 } },
    });
    const r = commitAction(
      state,
      { type: 'turn_end', source: 'system', payload: { unitId: u.id } },
      cat,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const pushed = r.committed.find((a) => a.type === 'system_ct_push');
    expect(pushed).toBeUndefined();
  });
});
