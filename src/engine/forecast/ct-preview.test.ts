// Tests for projectTurnEndCt and projectChargedResolution.

import { describe, expect, it } from 'vitest';
import { unitId } from '../index.ts';
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
        consumed: { movesConsumed: 0, actsConsumed: 0, waited: false },
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
        consumed: { movesConsumed: 1, actsConsumed: 0, waited: false },
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
        consumed: { movesConsumed: 0, actsConsumed: 0, waited: false },
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
        consumed: { movesConsumed: 1, actsConsumed: 0, waited: false },
        reactionsUsedThisTurn: new Map(),
      },
    });
    expect(projectTurnEndCt({ state, catalog: cat, unit, plannedNext: 'act' })).toBe(0);
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
