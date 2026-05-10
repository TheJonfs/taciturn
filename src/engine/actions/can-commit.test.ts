// Tests for canCommitAction — the controller-side pre-flight wrapper.
//
// Two cases cover the contract:
//   1. validateAction fails → returns false (no turn in progress).
//   2. runOnActionAttempted returns 'blocked' → returns false (Don't
//      Move attached to the actor blocks a structurally-valid Move).
//   3. Both pass → returns true.

import { describe, expect, it } from 'vitest';
import {
  classId,
  commandSetId,
  statusTypeId,
  type ClassDefinition,
  type ProposedAction,
  type StatusEffectType,
} from '../types/index.ts';
import { createCatalog } from '../catalog/index.ts';
import { statusHook } from '../status/hooks.ts';
import { activeTurnFor, makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { flatMap } from '../map/test-fixtures.ts';
import { knightLoadout, makeAbilitiesCatalog } from '../abilities/test-fixtures.ts';
import { defaultTestRulesets } from '../catalog/test-fixtures.ts';
import { canCommitAction } from './can-commit.ts';

function dontMoveStatus(): StatusEffectType {
  return {
    id: statusTypeId('dont_move'),
    name: "Don't Move",
    tags: ['negative', 'physical'],
    durationMode: 'per_unit_ct',
    stackingRule: 'REFRESH',
    hooks: [
      statusHook('onActionAttempted', (args) => {
        if (args.action.type !== 'move') return { kind: 'allowed' };
        return { kind: 'blocked', reason: "can't move" };
      }),
    ],
  };
}

function knightClass(): ClassDefinition {
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
    equipmentSlots: { leftHand: true, rightHand: true, headgear: true, armor: true, accessory: true },
    firstActionCommandSet: commandSetId('battle_skill'),
    freeAbilities: new Set(),
  };
}

describe('canCommitAction', () => {
  it('returns false when validateAction rejects (no turn in progress)', () => {
    const cat = makeAbilitiesCatalog({});
    const u = makeUnit({ id: 'u1', spd: 10, loadout: knightLoadout() });
    // No turnState → validation fails.
    const state = makeGameState({ units: [u], map: flatMap(3, 3) });
    const move: ProposedAction = {
      type: 'move',
      source: 'player',
      actorId: u.id,
      payload: { destination: { x: 1, y: 0, layer: 0 } },
    };
    expect(canCommitAction(state, cat, u, move)).toBe(false);
  });

  it("returns false when runOnActionAttempted blocks (Don't Move on actor)", () => {
    const cat = createCatalog({
      statusTypes: [dontMoveStatus()],
      abilities: [],
      commandSets: [],
      classes: [knightClass()],
      items: [],
      rulesets: defaultTestRulesets,
    });
    const u = makeUnit({
      id: 'u1',
      spd: 10,
      loadout: knightLoadout(),
      position: { x: 1, y: 1, layer: 0 },
      statuses: [
        {
          typeId: statusTypeId('dont_move'),
          source: { unitId: null, actionSeq: null },
          remainingDuration: 24,
        },
      ],
    });
    const state = makeGameState({
      units: [u],
      map: flatMap(3, 3),
      turnState: activeTurnFor(u.id),
    });
    const move: ProposedAction = {
      type: 'move',
      source: 'player',
      actorId: u.id,
      payload: { destination: { x: 2, y: 1, layer: 0 } },
    };
    // validateAction would pass: Move with budget, destination reachable.
    // canCommitAction should reject because Don't Move's onActionAttempted
    // returns 'blocked'.
    expect(canCommitAction(state, cat, u, move)).toBe(false);
  });

  it('returns true when validation passes and no hook blocks', () => {
    const cat = makeAbilitiesCatalog({});
    const u = makeUnit({
      id: 'u1',
      spd: 10,
      loadout: knightLoadout(),
      position: { x: 1, y: 1, layer: 0 },
    });
    const state = makeGameState({
      units: [u],
      map: flatMap(3, 3),
      turnState: activeTurnFor(u.id),
    });
    const move: ProposedAction = {
      type: 'move',
      source: 'player',
      actorId: u.id,
      payload: { destination: { x: 2, y: 1, layer: 0 } },
    };
    expect(canCommitAction(state, cat, u, move)).toBe(true);
  });
});
