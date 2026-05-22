// Tests for `estimateChargedTiming` (session 26.5 / item #3).
// Verifies the schedule-walking projection accuracy versus the naive
// pre-26.5 `ceil(actionSpeed / casterSpeed)` formula. Key scenarios:
//
//   - lone charged action with one unit in the queue (regression
//     baseline)
//   - two charged actions in flight, faster resolves first
//   - charged action interleaved with unit turns
//   - resolveBeforeTargetTurn comparison flips correctly
//   - returns null when actionSpeed <= 0 (paused / un-projectable)

import { describe, expect, it } from 'vitest';
import {
  emptyCatalog,
  makeChargedAction,
  makeGameState,
  makeUnit,
} from '../ct/test-fixtures.ts';
import {
  abilityId,
  bucketId,
  unitId,
  type ActiveAbilityDefinition,
} from '../index.ts';
import { estimateChargedTiming } from './charged-timing.ts';

// Minimal ability fixture — only `id`, `kind`, `targeting`, and
// `actionSpeed` are read by `estimateChargedTiming`. Other fields are
// stubbed with defaults that satisfy the ActiveAbilityDefinition shape.
function chargedAbility(actionSpeed: number): ActiveAbilityDefinition {
  return {
    id: abilityId('test_spell'),
    name: 'Test Spell',
    kind: 'active',
    bucket: bucketId('first_action'),
    baseCost: 1,
    availability: 'hidden',
    mpCost: 0,
    actionSpeed,
    targeting: {
      kind: 'tile',
      range: { horizontal: 5, vertical: 1 },
      rangeMode: 'arc',
    },
    effects: {},
  };
}

describe('estimateChargedTiming', () => {
  it('returns null when actionSpeed is 0 (un-projectable)', () => {
    const cat = emptyCatalog();
    const caster = makeUnit({ id: 'caster', spd: 10, ct: 0 });
    const state = makeGameState({ units: [caster] });
    const result = estimateChargedTiming({
      state,
      catalog: cat,
      caster,
      ability: chargedAbility(0),
      anchor: { x: 0, y: 0, layer: 0 },
    });
    expect(result).toBeNull();
  });

  it('finds the hypothetical resolve in the projection (lone-charge baseline)', () => {
    // Single unit + a hypothetical actionSpeed-10 spell. The unit is at
    // ct=0 spd=10 so triggers in 10 ticks; the hypothetical resolves at
    // ct=0 speed=10 also in 10 ticks. Tiebreak (per compareForTrigger:
    // higher actualCT, then higher speed, then entityKind asc) — at the
    // moment of trigger both have actualCT=100 speed=10; tiebreak by
    // entityKind ascending → 'charged_action' < 'unit', so the charge
    // wins. eventsBeforeResolve = 0.
    const cat = emptyCatalog();
    const caster = makeUnit({ id: 'caster', spd: 10, ct: 0 });
    const state = makeGameState({ units: [caster] });
    const result = estimateChargedTiming({
      state,
      catalog: cat,
      caster,
      ability: chargedAbility(10),
      anchor: { x: 0, y: 0, layer: 0 },
    });
    expect(result).not.toBeNull();
    expect(result!.ticksToResolve).toBe(10);
    expect(result!.eventsBeforeResolve).toBe(0);
    expect(result!.resolutionEvent.entityKind).toBe('charged_action');
  });

  it('accounts for a faster in-flight charge resolving first', () => {
    // Two charges in flight + a hypothetical. The pre-existing fast
    // charge resolves before the hypothetical, so `eventsBeforeResolve`
    // should be >= 1.
    const cat = emptyCatalog();
    const caster = makeUnit({ id: 'caster', spd: 10, ct: 0 });
    // Pre-existing charge at ct=80 speed=10 → resolves in 2 ticks.
    const fastCharge = makeChargedAction({
      id: 'fast',
      casterId: 'caster',
      speed: 10,
      ct: 80,
    });
    const state = makeGameState({
      units: [caster],
      chargedActions: [fastCharge],
    });
    const result = estimateChargedTiming({
      state,
      catalog: cat,
      caster,
      ability: chargedAbility(5), // slow hypothetical, ~20 ticks to resolve
      anchor: { x: 0, y: 0, layer: 0 },
    });
    expect(result).not.toBeNull();
    // The fast charge resolves first (2 ticks); the hypothetical resolves
    // later. Naive `ceil(actionSpeed / casterSpeed) = ceil(5/10) = 1` is
    // dramatically wrong; the walk correctly shows the slower resolve
    // (~20 ticks) ordered after fast (and after a unit turn).
    expect(result!.eventsBeforeResolve).toBeGreaterThanOrEqual(1);
    expect(result!.ticksToResolve).toBeGreaterThan(2);
  });

  it('reports resolvesBeforeTargetTurn based on the concerned unit', () => {
    // Caster spd=10 + target spd=20 + actionSpeed=20 hypothetical.
    // Hypothetical takes 5 ticks (100/20=5); target's next turn at 5
    // ticks too (100/20=5). At the trigger tick both reach threshold;
    // unit wins entityKind tiebreak ascending? entityKind compares
    // 'charged_action' < 'unit' → charge resolves first. So the charge
    // resolves at ticksFromNow=5, target's next turn also at 5 but
    // appearing after in the event list — concrete: resolvesBefore is
    // true (`ticksFromNow < ticksFromNow` is false, strictly; same
    // ticks but charge-wins-tiebreak means we record the resolve first
    // in the projection; resolvesBeforeTargetTurn uses strict <).
    const cat = emptyCatalog();
    const caster = makeUnit({ id: 'caster', spd: 10, ct: 0 });
    const slowTarget = makeUnit({ id: 'slow_target', spd: 5, ct: 0 });
    const state = makeGameState({ units: [caster, slowTarget] });
    const result = estimateChargedTiming({
      state,
      catalog: cat,
      caster,
      ability: chargedAbility(20), // fast hypothetical (5 ticks)
      anchor: { x: 0, y: 0, layer: 0 },
      concernedUnitId: unitId('slow_target'),
    });
    expect(result).not.toBeNull();
    // Charge ticksToResolve = 5; slow target's turn ticksToResolve =
    // 20. Charge resolves before target.
    expect(result!.ticksToResolve).toBe(5);
    expect(result!.targetNextTurn).not.toBeNull();
    expect(result!.resolvesBeforeTargetTurn).toBe(true);
  });

  it('flips resolvesBeforeTargetTurn when the target acts first', () => {
    // Fast target acts first; slow hypothetical resolves after.
    const cat = emptyCatalog();
    const caster = makeUnit({ id: 'caster', spd: 10, ct: 0 });
    const fastTarget = makeUnit({ id: 'fast_target', spd: 50, ct: 0 });
    const state = makeGameState({ units: [caster, fastTarget] });
    const result = estimateChargedTiming({
      state,
      catalog: cat,
      caster,
      ability: chargedAbility(5), // ~20 ticks
      anchor: { x: 0, y: 0, layer: 0 },
      concernedUnitId: unitId('fast_target'),
    });
    expect(result).not.toBeNull();
    expect(result!.resolvesBeforeTargetTurn).toBe(false);
  });

  it('surroundingEvents contains the resolve at resolutionIndex', () => {
    const cat = emptyCatalog();
    const caster = makeUnit({ id: 'caster', spd: 10, ct: 0 });
    const other = makeUnit({ id: 'other', spd: 5, ct: 0 });
    const state = makeGameState({ units: [caster, other] });
    const result = estimateChargedTiming({
      state,
      catalog: cat,
      caster,
      ability: chargedAbility(15),
      anchor: { x: 0, y: 0, layer: 0 },
    });
    expect(result).not.toBeNull();
    expect(result!.surroundingEvents[result!.resolutionIndex]).toBe(
      result!.resolutionEvent,
    );
  });
});
