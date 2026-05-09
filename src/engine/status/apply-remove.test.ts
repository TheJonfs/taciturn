import { computeSpeed } from '../ct/speed.ts';
import { makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { loadDefaultCatalog } from '../../content/index.ts';
import { applyStatus } from './apply.ts';
import { statusHook } from './hooks.ts';
import { removeStatus } from './remove.ts';
import {
  asStatusTypeId,
  catalogWith,
  makeStatusInstance,
  makeStatusType,
} from './test-fixtures.ts';
import { statusTypeId, unitId } from '../types/index.ts';

describe('applyStatus', () => {
  const haste = makeStatusType({ id: 'haste', defaultMagnitude: 1.5 });
  const cat = catalogWith([haste]);

  it('appends a new instance with default magnitude when none exists', () => {
    const u = makeUnit({ id: 'u1', spd: 10 });
    const state = makeGameState({ units: [u] });
    const { newState, result } = applyStatus(
      state,
      {
        targetId: u.id,
        typeId: statusTypeId('haste'),
        sourceUnitId: null,
        sourceActionSeq: null,
        duration: 5,
      },
      cat,
    );
    expect(result.kind).toBe('applied');
    const newUnit = newState.units.get(u.id)!;
    expect(newUnit.statuses).toHaveLength(1);
    expect(newUnit.statuses[0]!.magnitude).toBe(1.5);
    expect(newUnit.statuses[0]!.remainingDuration).toBe(5);
  });

  it('respects an explicit magnitude over the type default', () => {
    const u = makeUnit({ id: 'u1', spd: 10 });
    const state = makeGameState({ units: [u] });
    const { newState } = applyStatus(
      state,
      {
        targetId: u.id,
        typeId: statusTypeId('haste'),
        sourceUnitId: null,
        sourceActionSeq: null,
        magnitude: 2,
        duration: 5,
      },
      cat,
    );
    expect(newState.units.get(u.id)!.statuses[0]!.magnitude).toBe(2);
  });

  it('throws when a duration-counted status is applied without a duration', () => {
    const u = makeUnit({ id: 'u1', spd: 10 });
    const state = makeGameState({ units: [u] });
    expect(() =>
      applyStatus(
        state,
        {
          targetId: u.id,
          typeId: statusTypeId('haste'),
          sourceUnitId: null,
          sourceActionSeq: null,
        },
        cat,
      ),
    ).toThrow(/requires an explicit duration/);
  });

  it('forces remainingDuration to null for permanent status types', () => {
    const permaType = makeStatusType({ id: 'permatype' });
    const permaCat = catalogWith([{ ...permaType, durationMode: 'permanent' }]);
    const u = makeUnit({ id: 'u1', spd: 10 });
    const state = makeGameState({ units: [u] });
    const { newState } = applyStatus(
      state,
      {
        targetId: u.id,
        typeId: asStatusTypeId('permatype'),
        sourceUnitId: null,
        sourceActionSeq: null,
        duration: 99, // ignored
      },
      permaCat,
    );
    expect(newState.units.get(u.id)!.statuses[0]!.remainingDuration).toBeNull();
  });

  it('records source attribution from the applier', () => {
    const u = makeUnit({ id: 'target', spd: 10 });
    const state = makeGameState({ units: [u] });
    const { newState } = applyStatus(
      state,
      {
        targetId: u.id,
        typeId: statusTypeId('haste'),
        sourceUnitId: unitId('caster'),
        sourceActionSeq: 42,
        duration: 5,
      },
      cat,
    );
    const inst = newState.units.get(u.id)!.statuses[0]!;
    expect(inst.source.unitId).toBe('caster');
    expect(inst.source.actionSeq).toBe(42);
  });

  it('REFRESH outcome on second apply: same magnitude, new duration', () => {
    const u = makeUnit({ id: 'u1', spd: 10 });
    const s1 = makeGameState({ units: [u] });
    const { newState: s2 } = applyStatus(
      s1,
      {
        targetId: u.id,
        typeId: statusTypeId('haste'),
        sourceUnitId: null,
        sourceActionSeq: null,
        magnitude: 1.5,
        duration: 3,
      },
      cat,
    );
    const { newState: s3, result } = applyStatus(
      s2,
      {
        targetId: u.id,
        typeId: statusTypeId('haste'),
        sourceUnitId: null,
        sourceActionSeq: null,
        magnitude: 99, // ignored on REFRESH
        duration: 10,
      },
      cat,
    );
    expect(result.kind).toBe('refreshed');
    const inst = s3.units.get(u.id)!.statuses[0]!;
    expect(inst.magnitude).toBe(1.5);
    expect(inst.remainingDuration).toBe(10);
  });

  it('does not mutate the original state', () => {
    const u = makeUnit({ id: 'u1', spd: 10 });
    const state = makeGameState({ units: [u] });
    applyStatus(
      state,
      {
        targetId: u.id,
        typeId: statusTypeId('haste'),
        sourceUnitId: null,
        sourceActionSeq: null,
        duration: 5,
      },
      cat,
    );
    expect(state.units.get(u.id)!.statuses).toEqual([]);
  });

  it('preserves the relative order of other-type statuses (REFRESH path)', () => {
    const haste2 = makeStatusType({ id: 'haste' });
    const poison = makeStatusType({ id: 'poison' });
    const c = catalogWith([haste2, poison]);
    const u = makeUnit({
      id: 'u1',
      spd: 10,
      statuses: [
        makeStatusInstance({ typeId: 'haste', magnitude: 1.5, remainingDuration: 3 }),
        makeStatusInstance({ typeId: 'poison', magnitude: 5 }),
      ],
    });
    const state = makeGameState({ units: [u] });
    const { newState } = applyStatus(
      state,
      {
        targetId: u.id,
        typeId: statusTypeId('haste'),
        sourceUnitId: null,
        sourceActionSeq: null,
        magnitude: 2,
        duration: 8,
      },
      c,
    );
    const newStatuses = newState.units.get(u.id)!.statuses;
    expect(newStatuses.map((s) => s.typeId)).toEqual(['haste', 'poison']);
    expect(newStatuses[0]!.remainingDuration).toBe(8);
  });

  it('fires onApply only for genuinely new instances (not on REFRESH)', () => {
    let appliedCount = 0;
    const watched = makeStatusType({
      id: 'watched',
      hooks: [statusHook('onApply', () => void appliedCount++)],
    });
    const c = catalogWith([watched]);
    const u = makeUnit({ id: 'u1', spd: 10 });
    let state = makeGameState({ units: [u] });

    state = applyStatus(
      state,
      {
        targetId: u.id,
        typeId: statusTypeId('watched'),
        sourceUnitId: null,
        sourceActionSeq: null,
        duration: 5,
      },
      c,
    ).newState;
    expect(appliedCount).toBe(1);

    // Refresh — should not fire onApply.
    applyStatus(
      state,
      {
        targetId: u.id,
        typeId: statusTypeId('watched'),
        sourceUnitId: null,
        sourceActionSeq: null,
        duration: 10,
      },
      c,
    );
    expect(appliedCount).toBe(1);
  });

  it('REPLACE fires onRemove for the previous and onApply for the new', () => {
    const events: string[] = [];
    const t = makeStatusType({
      id: 'replaceable',
      stackingRule: 'REPLACE',
      hooks: [
        statusHook('onApply', (_a, ctx) => {
          events.push(`apply:${ctx.instance.magnitude}`);
        }),
        statusHook('onRemove', (_a, ctx) => {
          events.push(`remove:${ctx.instance.magnitude}`);
        }),
      ],
    });
    const c = catalogWith([t]);
    const u = makeUnit({ id: 'u1', spd: 10 });
    let state = makeGameState({ units: [u] });
    state = applyStatus(
      state,
      {
        targetId: u.id,
        typeId: statusTypeId('replaceable'),
        sourceUnitId: null,
        sourceActionSeq: null,
        magnitude: 1,
        duration: 5,
      },
      c,
    ).newState;
    applyStatus(
      state,
      {
        targetId: u.id,
        typeId: statusTypeId('replaceable'),
        sourceUnitId: null,
        sourceActionSeq: null,
        magnitude: 2,
        duration: 5,
      },
      c,
    );
    expect(events).toEqual(['apply:1', 'remove:1', 'apply:2']);
  });
});

describe('removeStatus', () => {
  const haste = makeStatusType({ id: 'haste' });
  const cat = catalogWith([haste]);

  it('removes every instance of the named type and reports them', () => {
    const u = makeUnit({
      id: 'u1',
      spd: 10,
      statuses: [
        makeStatusInstance({ typeId: 'haste', magnitude: 1.5 }),
        makeStatusInstance({ typeId: 'haste', magnitude: 2 }),
      ],
    });
    const state = makeGameState({ units: [u] });
    const { newState, removed } = removeStatus(
      state,
      { targetId: u.id, typeId: statusTypeId('haste') },
      cat,
    );
    expect(removed).toHaveLength(2);
    expect(newState.units.get(u.id)!.statuses).toEqual([]);
  });

  it('is a no-op when the type is not present (returns original state by reference)', () => {
    const u = makeUnit({ id: 'u1', spd: 10 });
    const state = makeGameState({ units: [u] });
    const { newState, removed } = removeStatus(
      state,
      { targetId: u.id, typeId: statusTypeId('haste') },
      cat,
    );
    expect(removed).toEqual([]);
    expect(newState).toBe(state);
  });

  it('preserves the order of other-type statuses', () => {
    const poison = makeStatusType({ id: 'poison' });
    const c = catalogWith([haste, poison]);
    const u = makeUnit({
      id: 'u1',
      spd: 10,
      statuses: [
        makeStatusInstance({ typeId: 'poison' }),
        makeStatusInstance({ typeId: 'haste' }),
        makeStatusInstance({ typeId: 'poison' }),
      ],
    });
    const state = makeGameState({ units: [u] });
    const { newState } = removeStatus(state, { targetId: u.id, typeId: statusTypeId('haste') }, c);
    expect(newState.units.get(u.id)!.statuses.map((s) => s.typeId)).toEqual(['poison', 'poison']);
  });

  it('fires onRemove for every removed instance', () => {
    const removed: number[] = [];
    const t = makeStatusType({
      id: 'tracked',
      stackingRule: 'STACK_INDEPENDENT',
      hooks: [
        statusHook('onRemove', (_a, ctx) => {
          removed.push(ctx.instance.magnitude ?? -1);
        }),
      ],
    });
    const c = catalogWith([t]);
    const u = makeUnit({
      id: 'u1',
      spd: 10,
      statuses: [
        makeStatusInstance({ typeId: 'tracked', magnitude: 1 }),
        makeStatusInstance({ typeId: 'tracked', magnitude: 2 }),
      ],
    });
    const state = makeGameState({ units: [u] });
    removeStatus(state, { targetId: u.id, typeId: statusTypeId('tracked') }, c);
    expect(removed).toEqual([1, 2]);
  });
});

describe('Haste end-to-end (apply + computeSpeed + remove)', () => {
  // Uses the real Haste from src/content/statuses/haste.ts via loadDefaultCatalog.
  const cat = loadDefaultCatalog();

  it('without Haste, computeSpeed is the unit base Speed', () => {
    const u = makeUnit({ id: 'u1', spd: 10 });
    const state = makeGameState({ units: [u] });
    expect(computeSpeed(state, u.id, cat)).toBe(10);
  });

  it('with Haste applied at default magnitude (1.5x), Speed scales accordingly', () => {
    const u = makeUnit({ id: 'u1', spd: 10 });
    const initial = makeGameState({ units: [u] });
    const { newState } = applyStatus(
      initial,
      {
        targetId: u.id,
        typeId: statusTypeId('haste'),
        sourceUnitId: null,
        sourceActionSeq: null,
        duration: 5,
      },
      cat,
    );
    expect(computeSpeed(newState, u.id, cat)).toBe(15);
  });

  it('removing Haste returns Speed to base', () => {
    const u = makeUnit({ id: 'u1', spd: 10 });
    let state = makeGameState({ units: [u] });
    state = applyStatus(
      state,
      {
        targetId: u.id,
        typeId: statusTypeId('haste'),
        sourceUnitId: null,
        sourceActionSeq: null,
        duration: 5,
      },
      cat,
    ).newState;
    state = removeStatus(state, { targetId: u.id, typeId: statusTypeId('haste') }, cat).newState;
    expect(computeSpeed(state, u.id, cat)).toBe(10);
  });

  it('a second Haste apply REFRESHes — magnitude unchanged, Speed unchanged', () => {
    // Per ADR-0028, Haste's durationMode is `permanent_per_unit_ct` —
    // remainingDuration is forced to null by the apply pipeline. The
    // REFRESH stacking rule still applies (magnitude on the new
    // instance is ignored, the existing instance's magnitude wins),
    // but there is no duration to refresh.
    const u = makeUnit({ id: 'u1', spd: 10 });
    let state = makeGameState({ units: [u] });
    state = applyStatus(
      state,
      {
        targetId: u.id,
        typeId: statusTypeId('haste'),
        sourceUnitId: null,
        sourceActionSeq: null,
      },
      cat,
    ).newState;
    state = applyStatus(
      state,
      {
        targetId: u.id,
        typeId: statusTypeId('haste'),
        sourceUnitId: null,
        sourceActionSeq: null,
        magnitude: 99, // ignored on REFRESH
      },
      cat,
    ).newState;
    expect(computeSpeed(state, u.id, cat)).toBe(15);
    expect(state.units.get(u.id)!.statuses[0]!.remainingDuration).toBeNull();
  });
});
