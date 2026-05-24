// Session 26 — modifySystemDamage hook integration tests.
// Verifies the new chain fires inside reduceSystemDamage against the
// target's hooks, can fully zero the running amount (Bedrock-Stride
// pattern), gates correctly on the SystemDamageSource discriminant,
// composes multiplicatively across multiple handlers, and clamps
// negative returns to 0. Per ADR-0052.

import { describe, expect, it } from 'vitest';
import { createCatalog } from '../catalog/index.ts';
import {
  DEFAULT_TEST_DAMAGE_PIPELINE,
  makeTestRuleset,
} from '../catalog/test-fixtures.ts';
import { makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { passiveHook } from '../abilities/hooks.ts';
import { ACTIVE_BUCKET_IDS, PASSIVE_BUCKET_IDS } from '../abilities/constants.ts';
import { flatMap } from '../map/test-fixtures.ts';
import {
  abilityId,
  bucketId,
  classId,
  commandSetId,
  statusTypeId,
  type AbilityId,
  type ClassDefinition,
  type CommandSetDefinition,
  type Loadout,
  type PassiveAbilityDefinition,
} from '@engine/index.ts';
import { commitAction } from './commit.ts';

function knightClass(freeAbilities: ReadonlyArray<string> = []): ClassDefinition {
  return {
    id: classId('knight'),
    name: 'Knight',
    movement: { moveRange: 3, jump: 2, terrainCosts: new Map(), canEnter: new Set(['ground']) },
    evasion: { front: 0, side: 0, back: 0 },
    equipmentSlots: { leftHand: true, rightHand: true, headgear: true, armor: true, accessory: true },
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

function loadoutWithMovement(passives: ReadonlyArray<AbilityId>): Loadout {
  const actionBuckets: Record<string, ReadonlyArray<ReturnType<typeof commandSetId>>> = {};
  for (const b of ACTIVE_BUCKET_IDS) actionBuckets[b] = [];
  const passiveBuckets: Record<string, ReadonlyArray<AbilityId>> = {};
  for (const b of PASSIVE_BUCKET_IDS) passiveBuckets[b] = [];
  passiveBuckets[bucketId('movement')] = passives;
  return { actionBuckets, passiveBuckets };
}

function rulesetFull() {
  return makeTestRuleset({
    damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE,
    perUnitPerTurnReactions: 3,
    pausingStatusTypeIds: [statusTypeId('stop')],
  });
}

// Bedrock-Stride-shaped fixture: zeros incoming falling damage; passes
// through everything else.
const fallImmune: PassiveAbilityDefinition = {
  id: abilityId('test_fall_immune'),
  name: 'Test Fall Immune',
  kind: 'passive',
  bucket: bucketId('movement'),
  baseCost: 1,
  availability: 'hidden',
  hooks: [
    passiveHook('modifySystemDamage', (args) =>
      args.source.kind === 'falling' ? 0 : args.baseAmount,
    ),
  ],
};

// Multiplicative-shaped fixture: halves the running amount unconditionally.
const halveSystem: PassiveAbilityDefinition = {
  id: abilityId('test_halve_system'),
  name: 'Test Halve System',
  kind: 'passive',
  bucket: bucketId('movement'),
  baseCost: 1,
  availability: 'hidden',
  hooks: [
    passiveHook('modifySystemDamage', (args) => Math.floor(args.baseAmount / 2)),
  ],
};

// Misbehaving fixture: returns a negative amount. The reducer clamps at 0.
const negativeReturn: PassiveAbilityDefinition = {
  id: abilityId('test_negative_return'),
  name: 'Test Negative Return',
  kind: 'passive',
  bucket: bucketId('movement'),
  baseCost: 1,
  availability: 'hidden',
  hooks: [
    passiveHook('modifySystemDamage', () => -100),
  ],
};

function setupCatalog(passives: ReadonlyArray<PassiveAbilityDefinition>) {
  const ruleset = rulesetFull();
  return createCatalog({
    statusTypes: [],
    abilities: passives,
    commandSets: [battleSkillSet()],
    classes: [knightClass(passives.map((p) => String(p.id)))],
    items: [],
    rulesets: [ruleset],
  });
}

describe('session 26 — modifySystemDamage hook', () => {
  it('zeros falling damage when target has a falling-gate handler', () => {
    const cat = setupCatalog([fallImmune]);
    const u = makeUnit({
      id: 'u',
      spd: 10,
      hp: 50,
      maxHpBase: 60,
      loadout: loadoutWithMovement([fallImmune.id]),
    });
    const state = makeGameState({ units: [u], map: flatMap(3, 3) });
    const r = commitAction(
      state,
      {
        type: 'system_damage',
        source: 'system',
        payload: {
          targetId: u.id,
          amount: 20,
          tags: ['physical'],
          source: { kind: 'falling', unitId: u.id, dropDistance: 4 },
        },
      },
      cat,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const after = r.newState.units.get(u.id)!;
    expect(after.vitals.hp).toBe(50); // unchanged
    const sd = r.committed[0]!;
    expect(sd.type).toBe('system_damage');
    if (sd.type === 'system_damage') {
      expect(sd.outcome!.applied).toBe(0);
      expect(sd.outcome!.amount).toBe(0); // reduced amount surfaces on outcome
    }
  });

  it('passes through non-matching source (poison tick) when handler gates on falling', () => {
    const cat = setupCatalog([fallImmune]);
    const u = makeUnit({
      id: 'u',
      spd: 10,
      hp: 50,
      maxHpBase: 60,
      loadout: loadoutWithMovement([fallImmune.id]),
    });
    const state = makeGameState({ units: [u], map: flatMap(3, 3) });
    const r = commitAction(
      state,
      {
        type: 'system_damage',
        source: 'system',
        payload: {
          targetId: u.id,
          amount: 6,
          tags: ['poison'],
          source: {
            kind: 'status_tick',
            statusTypeId: statusTypeId('poison'),
            unitId: u.id,
          },
        },
      },
      cat,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const after = r.newState.units.get(u.id)!;
    expect(after.vitals.hp).toBe(44);
    const sd = r.committed[0]!;
    if (sd.type === 'system_damage') {
      expect(sd.outcome!.applied).toBe(6);
    }
  });

  it('composes multiple handlers as a chain (halve then zero-falling)', () => {
    const cat = setupCatalog([halveSystem, fallImmune]);
    const u = makeUnit({
      id: 'u',
      spd: 10,
      hp: 50,
      maxHpBase: 60,
      loadout: loadoutWithMovement([halveSystem.id, fallImmune.id]),
    });
    const state = makeGameState({ units: [u], map: flatMap(3, 3) });
    const r = commitAction(
      state,
      {
        type: 'system_damage',
        source: 'system',
        payload: {
          targetId: u.id,
          amount: 20,
          tags: ['physical'],
          source: { kind: 'falling', unitId: u.id, dropDistance: 4 },
        },
      },
      cat,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.newState.units.get(u.id)!.vitals.hp).toBe(50);
  });

  it('halves a non-falling tick (halve-only chain)', () => {
    const cat = setupCatalog([halveSystem]);
    const u = makeUnit({
      id: 'u',
      spd: 10,
      hp: 50,
      maxHpBase: 60,
      loadout: loadoutWithMovement([halveSystem.id]),
    });
    const state = makeGameState({ units: [u], map: flatMap(3, 3) });
    const r = commitAction(
      state,
      {
        type: 'system_damage',
        source: 'system',
        payload: {
          targetId: u.id,
          amount: 20,
          tags: ['poison'],
          source: {
            kind: 'status_tick',
            statusTypeId: statusTypeId('poison'),
            unitId: u.id,
          },
        },
      },
      cat,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.newState.units.get(u.id)!.vitals.hp).toBe(40); // 50 − 10
  });

  it('clamps negative handler returns to 0', () => {
    const cat = setupCatalog([negativeReturn]);
    const u = makeUnit({
      id: 'u',
      spd: 10,
      hp: 50,
      maxHpBase: 60,
      loadout: loadoutWithMovement([negativeReturn.id]),
    });
    const state = makeGameState({ units: [u], map: flatMap(3, 3) });
    const r = commitAction(
      state,
      {
        type: 'system_damage',
        source: 'system',
        payload: {
          targetId: u.id,
          amount: 20,
          tags: ['physical'],
          source: { kind: 'falling', unitId: u.id, dropDistance: 4 },
        },
      },
      cat,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.newState.units.get(u.id)!.vitals.hp).toBe(50); // unchanged, no HP heal
  });
});
