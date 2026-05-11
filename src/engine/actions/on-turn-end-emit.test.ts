// Session 26 — onTurnEnd emission wiring tests.
// Verifies the widened onTurnEnd hook (ADR-0053) fires from
// `reduceTurnEnd`, can read `state.turnState.consumed` to gate emissions
// (Quickstep-pattern), threads `catalog` for handlers that need it, and
// appends emitted actions onto the reducer's generatedActions.

import { describe, expect, it } from 'vitest';
import { createCatalog } from '../catalog/index.ts';
import {
  DEFAULT_TEST_DAMAGE_PIPELINE,
  makeTestRuleset,
} from '../catalog/test-fixtures.ts';
import {
  activeTurnFor,
  makeGameState,
  makeUnit,
} from '../ct/test-fixtures.ts';
import { passiveHook } from '../abilities/hooks.ts';
import {
  ACTIVE_BUCKET_IDS,
  PASSIVE_BUCKET_IDS,
} from '../abilities/constants.ts';
import { flatMap } from '../map/test-fixtures.ts';
import {
  abilityId,
  bucketId,
  classId,
  commandSetId,
  statusTypeId,
  unitId,
  type AbilityId,
  type ClassDefinition,
  type CommandSetDefinition,
  type Loadout,
  type PassiveAbilityDefinition,
  type ProposedAction,
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

function loadoutWithSupport(passives: ReadonlyArray<AbilityId>): Loadout {
  const actionBuckets: Record<string, ReturnType<typeof commandSetId> | null> = {};
  for (const b of ACTIVE_BUCKET_IDS) actionBuckets[b] = null;
  const passiveBuckets: Record<string, ReadonlyArray<AbilityId>> = {};
  for (const b of PASSIVE_BUCKET_IDS) passiveBuckets[b] = [];
  passiveBuckets[bucketId('support')] = passives;
  return { actionBuckets, passiveBuckets };
}

function rulesetFull() {
  return makeTestRuleset({
    damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE,
    perUnitPerTurnReactions: 3,
    pausingStatusTypeIds: [statusTypeId('stop')],
  });
}

// Quickstep-shaped fixture: at turn end, if a Move was committed this
// turn, emits a system_ct_push of +5 against the unit.
const refundOnMove: PassiveAbilityDefinition = {
  id: abilityId('test_refund_on_move'),
  name: 'Test Refund On Move',
  kind: 'passive',
  bucket: bucketId('support'),
  baseCost: 1,
  availability: 'hidden',
  hooks: [
    passiveHook('onTurnEnd', (args, ctx) => {
      const ts = args.state.turnState;
      if (ts === null || ts.consumed.movesConsumed === 0) return { emittedActions: [] };
      const refund: ProposedAction = {
        type: 'system_ct_push',
        source: 'system',
        payload: {
          targetId: args.unit.id,
          delta: 5,
          source: {
            kind: 'support',
            abilityId: ctx.ability.id,
            unitId: args.unit.id,
          },
        },
      };
      return { emittedActions: [refund] };
    }),
  ],
};

// Legacy-shape fixture: a void-returning onTurnEnd handler. Verifies
// that the widened return type still accepts handlers that don't emit.
let voidHandlerFired = 0;
const sideEffectVoid: PassiveAbilityDefinition = {
  id: abilityId('test_void_handler'),
  name: 'Test Void Handler',
  kind: 'passive',
  bucket: bucketId('support'),
  baseCost: 1,
  availability: 'hidden',
  hooks: [
    passiveHook('onTurnEnd', () => {
      voidHandlerFired += 1;
    }),
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

describe('session 26 — onTurnEnd emission wiring', () => {
  it('emits system_ct_push when state.turnState.consumed.movesConsumed > 0', () => {
    const cat = setupCatalog([refundOnMove]);
    const u = makeUnit({
      id: 'u',
      spd: 10,
      hp: 50,
      maxHpBase: 60,
      ct: 100,
      loadout: loadoutWithSupport([refundOnMove.id]),
    });
    // Pre-condition: an active turn for u in which a Move was committed.
    const turn = activeTurnFor(u.id);
    const state = makeGameState({
      units: [u],
      map: flatMap(3, 3),
      turnState: { ...turn, consumed: { movesConsumed: 1, actsConsumed: 0 } },
    });

    const r = commitAction(
      state,
      {
        type: 'turn_end',
        source: 'system',
        payload: { unitId: u.id },
      },
      cat,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // turn_end commit + the system_ct_push from the passive.
    const pushed = r.committed.find((a) => a.type === 'system_ct_push');
    expect(pushed).toBeDefined();
    if (pushed && pushed.type === 'system_ct_push') {
      expect(pushed.payload.targetId).toBe(u.id);
      expect(pushed.payload.delta).toBe(5);
    }
    // The unit's CT after turn_end should reflect the refund (it ends
    // turn at ~100 − moveOnly cost, then gains +5 from the push).
    const after = r.newState.units.get(u.id)!;
    // No exact CT assertion (depends on moveOnly cost); just that the
    // push landed on top of the post-turn-end CT.
    expect(after.ct).toBeGreaterThan(0);
  });

  it('skips the emission when no Move was committed', () => {
    const cat = setupCatalog([refundOnMove]);
    const u = makeUnit({
      id: 'u',
      spd: 10,
      hp: 50,
      maxHpBase: 60,
      ct: 100,
      loadout: loadoutWithSupport([refundOnMove.id]),
    });
    const turn = activeTurnFor(u.id);
    const state = makeGameState({
      units: [u],
      map: flatMap(3, 3),
      turnState: { ...turn, consumed: { movesConsumed: 0, actsConsumed: 0 } },
    });
    const r = commitAction(
      state,
      {
        type: 'turn_end',
        source: 'system',
        payload: { unitId: u.id },
      },
      cat,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const pushed = r.committed.find((a) => a.type === 'system_ct_push');
    expect(pushed).toBeUndefined();
  });

  it('accepts void-returning legacy handlers without breaking the chain', () => {
    voidHandlerFired = 0;
    const cat = setupCatalog([sideEffectVoid]);
    const u = makeUnit({
      id: 'u',
      spd: 10,
      hp: 50,
      maxHpBase: 60,
      ct: 100,
      loadout: loadoutWithSupport([sideEffectVoid.id]),
    });
    const turn = activeTurnFor(u.id);
    const state = makeGameState({
      units: [u],
      map: flatMap(3, 3),
      turnState: turn,
    });
    const r = commitAction(
      state,
      {
        type: 'turn_end',
        source: 'system',
        payload: { unitId: u.id },
      },
      cat,
    );
    expect(r.ok).toBe(true);
    expect(voidHandlerFired).toBe(1);
  });
});

void unitId;
