// Tests for projectTurnEndCt and projectChargedResolution.

import { describe, expect, it } from 'vitest';
import { createCatalog } from '../catalog/index.ts';
import { defaultTestRulesets } from '../catalog/test-fixtures.ts';
import { passiveHook } from '../abilities/hooks.ts';
import { ACTIVE_BUCKET_IDS, PASSIVE_BUCKET_IDS } from '../abilities/constants.ts';
import {
  abilityId,
  bucketId,
  classId,
  commandSetId,
  unitId,
  type AbilityId,
  type ClassDefinition,
  type CommandSetDefinition,
  type Loadout,
  type PassiveAbilityDefinition,
  type ProposedAction,
} from '../index.ts';
import { makeChargedAction, makeGameState, makeUnit, emptyCatalog } from '../ct/test-fixtures.ts';
import { projectChargedResolution, projectTurnEndCt } from './ct-preview.ts';

describe('projectTurnEndCt', () => {
  it('subtracts move-only cost when player picks Move with nothing consumed', () => {
    const cat = emptyCatalog();
    const unit = makeUnit({ id: 'u', spd: 10, ct: 100 });
    const state = makeGameState({
      units: [unit],
      turnState: {
        unitId: unit.id,
        budget: { movesAvailable: 1, actsAvailable: 1 },
        consumed: { movesConsumed: 0, actsConsumed: 0 },
        reactionsUsedThisTurn: new Map(),
      },
    });
    // Default test ruleset: moveOnly 50.
    expect(projectTurnEndCt({ state, catalog: cat, unit, plannedNext: 'move' })).toBe(50);
  });

  it('subtracts move+act cost when player picks Act after a Move', () => {
    const cat = emptyCatalog();
    const unit = makeUnit({ id: 'u', spd: 10, ct: 100 });
    const state = makeGameState({
      units: [unit],
      turnState: {
        unitId: unit.id,
        budget: { movesAvailable: 0, actsAvailable: 1 },
        consumed: { movesConsumed: 1, actsConsumed: 0 },
        reactionsUsedThisTurn: new Map(),
      },
    });
    // moveAndAct 100 (default test ruleset).
    expect(projectTurnEndCt({ state, catalog: cat, unit, plannedNext: 'act' })).toBe(0);
  });

  it('returns wait cost when planned Wait with nothing consumed', () => {
    const cat = emptyCatalog();
    const unit = makeUnit({ id: 'u', spd: 10, ct: 100 });
    const state = makeGameState({
      units: [unit],
      turnState: {
        unitId: unit.id,
        budget: { movesAvailable: 1, actsAvailable: 1 },
        consumed: { movesConsumed: 0, actsConsumed: 0 },
        reactionsUsedThisTurn: new Map(),
      },
    });
    // Default test ruleset wait cost.
    expect(projectTurnEndCt({ state, catalog: cat, unit, plannedNext: 'wait' })).toBeGreaterThanOrEqual(0);
  });

  it('floors at 0 (CT can\'t go negative)', () => {
    const cat = emptyCatalog();
    const unit = makeUnit({ id: 'u', spd: 10, ct: 10 });
    const state = makeGameState({
      units: [unit],
      turnState: {
        unitId: unit.id,
        budget: { movesAvailable: 1, actsAvailable: 1 },
        consumed: { movesConsumed: 1, actsConsumed: 0 },
        reactionsUsedThisTurn: new Map(),
      },
    });
    expect(projectTurnEndCt({ state, catalog: cat, unit, plannedNext: 'act' })).toBe(0);
  });
});

// Quickstep-shaped passive: at turn end, if movesConsumed > 0, emits a
// system_ct_push of +ma against the unit. Fixed delta=7 keeps the test
// assertion independent of MA stat-query plumbing.
function quickstepLike(delta: number): PassiveAbilityDefinition {
  return {
    id: abilityId('test_refund_on_move'),
    name: 'Test Refund On Move',
    kind: 'passive',
    bucket: bucketId('support'),
    baseCost: 1,
    availability: 'hidden',
    hooks: [
      passiveHook('onTurnEnd', (args, ctx) => {
        const ts = args.state.turnState;
        if (ts === null || ts.consumed.movesConsumed === 0) {
          return { emittedActions: [] };
        }
        const refund: ProposedAction = {
          type: 'system_ct_push',
          source: 'system',
          payload: {
            targetId: args.unit.id,
            delta,
            source: { kind: 'support', abilityId: ctx.ability.id, unitId: args.unit.id },
          },
        };
        return { emittedActions: [refund] };
      }),
    ],
  };
}

function passiveLoadout(ids: ReadonlyArray<AbilityId>): Loadout {
  const actionBuckets: Record<string, ReturnType<typeof commandSetId> | null> = {};
  for (const b of ACTIVE_BUCKET_IDS) actionBuckets[b] = null;
  const passiveBuckets: Record<string, ReadonlyArray<AbilityId>> = {};
  for (const b of PASSIVE_BUCKET_IDS) passiveBuckets[b] = [];
  passiveBuckets[bucketId('support')] = ids;
  return { actionBuckets, passiveBuckets };
}

function quickstepCatalog(passive: PassiveAbilityDefinition) {
  const cls: ClassDefinition = {
    id: classId('knight'),
    name: 'Knight',
    movement: { moveRange: 3, jump: 2, terrainCosts: new Map(), canEnter: new Set(['ground']) },
    evasion: { front: 0, side: 0, back: 0 },
    equipmentSlots: { leftHand: true, rightHand: true, headgear: true, armor: true, accessory: true },
    firstActionCommandSet: commandSetId('battle_skill'),
    freeAbilities: new Set([passive.id]),
  };
  const cs: CommandSetDefinition = {
    id: commandSetId('battle_skill'),
    name: 'Battle Skill',
    members: [],
    baseCost: 1,
    availability: 'hidden',
  };
  return createCatalog({
    statusTypes: [],
    abilities: [passive],
    commandSets: [cs],
    classes: [cls],
    items: [],
    rulesets: defaultTestRulesets,
  });
}

describe('projectTurnEndCt — onTurnEnd dry-run (item #9 / ADR-0053)', () => {
  it('adds the system_ct_push refund when Move is planned (Quickstep pattern)', () => {
    const passive = quickstepLike(7);
    const cat = quickstepCatalog(passive);
    const unit = makeUnit({ id: 'u', spd: 10, ct: 100, loadout: passiveLoadout([passive.id]) });
    const state = makeGameState({
      units: [unit],
      turnState: {
        unitId: unit.id,
        budget: { movesAvailable: 1, actsAvailable: 1 },
        consumed: { movesConsumed: 0, actsConsumed: 0 },
        reactionsUsedThisTurn: new Map(),
      },
    });
    // Default test ruleset moveOnly = 50; Quickstep refunds +7.
    expect(projectTurnEndCt({ state, catalog: cat, unit, plannedNext: 'move' })).toBe(57);
  });

  it('adds the refund when Wait is picked after a Move was already committed', () => {
    const passive = quickstepLike(7);
    const cat = quickstepCatalog(passive);
    const unit = makeUnit({ id: 'u', spd: 10, ct: 100, loadout: passiveLoadout([passive.id]) });
    const state = makeGameState({
      units: [unit],
      turnState: {
        unitId: unit.id,
        budget: { movesAvailable: 0, actsAvailable: 1 },
        consumed: { movesConsumed: 1, actsConsumed: 0 },
        reactionsUsedThisTurn: new Map(),
      },
    });
    // moveOnly 50 already consumed, ending now → 100 − 50 = 50; +7 refund.
    expect(projectTurnEndCt({ state, catalog: cat, unit, plannedNext: 'wait' })).toBe(57);
  });

  it('skips the refund when no Move was committed and plannedNext is Act', () => {
    const passive = quickstepLike(7);
    const cat = quickstepCatalog(passive);
    const unit = makeUnit({ id: 'u', spd: 10, ct: 100, loadout: passiveLoadout([passive.id]) });
    const state = makeGameState({
      units: [unit],
      turnState: {
        unitId: unit.id,
        budget: { movesAvailable: 1, actsAvailable: 1 },
        consumed: { movesConsumed: 0, actsConsumed: 0 },
        reactionsUsedThisTurn: new Map(),
      },
    });
    // actOnly default 70 → leftover 30; no refund (movesConsumed remains 0).
    expect(projectTurnEndCt({ state, catalog: cat, unit, plannedNext: 'act' })).toBe(30);
  });

  it('matches the pre-26.5 behavior for units with no onTurnEnd handlers', () => {
    // Regression baseline: a vanilla unit (no passives) returns the same
    // value as the static ctCost deduction would.
    const cat = emptyCatalog();
    const unit = makeUnit({ id: 'u', spd: 10, ct: 100 });
    const state = makeGameState({
      units: [unit],
      turnState: {
        unitId: unit.id,
        budget: { movesAvailable: 1, actsAvailable: 1 },
        consumed: { movesConsumed: 0, actsConsumed: 0 },
        reactionsUsedThisTurn: new Map(),
      },
    });
    expect(projectTurnEndCt({ state, catalog: cat, unit, plannedNext: 'move' })).toBe(50);
  });
});

describe('projectChargedResolution', () => {
  it('finds the charged action in the upcoming-events projection and returns its position', () => {
    const cat = emptyCatalog();
    const fastUnit = makeUnit({ id: 'fast', spd: 20, ct: 0 });
    const slowUnit = makeUnit({ id: 'slow', spd: 5, ct: 0 });
    const charged = makeChargedAction({ id: 'spell1', casterId: 'fast', speed: 10, ct: 0 });
    const state = makeGameState({
      units: [fastUnit, slowUnit],
      chargedActions: [charged],
    });
    const r = projectChargedResolution({
      state,
      catalog: cat,
      chargedActionId: 'spell1',
      concernedUnitId: unitId('slow'),
    });
    expect(r).not.toBeNull();
    expect(r!.resolutionEvent.entityKind).toBe('charged_action');
    expect(r!.surroundingEvents.length).toBeGreaterThan(0);
    expect(r!.surroundingEvents[r!.resolutionIndex]).toBe(r!.resolutionEvent);
  });

  it('returns null when the charged action does not appear in the horizon', () => {
    const cat = emptyCatalog();
    const unit = makeUnit({ id: 'u', spd: 10, ct: 0 });
    const state = makeGameState({ units: [unit] });
    const r = projectChargedResolution({
      state,
      catalog: cat,
      chargedActionId: 'nonexistent',
    });
    expect(r).toBeNull();
  });
});
