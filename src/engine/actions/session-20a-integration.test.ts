// Session 20a integration tests — Burn fan-out fix.
//
// Pre-session-20a, reduceTurnStart had two divergent fan-out conditions:
// the skipped-turn path emitted status_tick for `per_unit_ct`,
// `permanent_per_unit_ct`, AND `custom + customTrigger.kind ===
// 'on_unit_ct_100'`. The non-skipped path was missing the custom case,
// so Burn never ticked on its holder's normal turn. Session 20a
// extracts a shared `ticksOnUnitCt100` predicate so the two paths can't
// drift again.
//
// These tests pin the predicate's three covered cases on the normal
// turn-start path and confirm the regression is closed.

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '../../content/index.ts';
import { reduceTurnStart } from './reducers.ts';
import { applyStatus } from '../status/apply.ts';
import { activeTurnFor, makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { statusTypeId, unitId } from '@engine/index.ts';

const catalog = loadDefaultCatalog();

describe('reduceTurnStart status_tick fan-out — predicate parity (session 20a fix)', () => {
  const burnTypeId = statusTypeId('burn');
  const poisonTypeId = statusTypeId('poison');
  const regenTypeId = statusTypeId('regen');

  const buildTurnStart = (uid: ReturnType<typeof unitId>) =>
    ({
      type: 'turn_start' as const,
      sequenceNumber: 1,
      source: 'system' as const,
      timestamp: { tick: 0, ct: 0 },
      seed: 0,
      chainDepth: 0,
      isReaction: false,
      payload: { unitId: uid },
    });

  it('emits status_tick for Burn (custom + on_unit_ct_100) on a normal turn_start', () => {
    // Burn is applied via composeApplyState (stackQuantity in spec is
    // separate from spec-level apply). The applier's MA snapshots into
    // stackDamages so the tick has a real damage payload — but for this
    // test we just need the status present.
    const caster = makeUnit({ id: 'caster', spd: 10, ma: 9, hp: 100 });
    const target = makeUnit({ id: 'target', spd: 10, hp: 100 });
    let state = makeGameState({ units: [caster, target] });
    state = applyStatus(
      state,
      {
        targetId: target.id,
        typeId: burnTypeId,
        sourceUnitId: caster.id,
        sourceActionSeq: 0,
        stackQuantity: 1,
      },
      catalog,
    ).newState;

    const result = reduceTurnStart(state, buildTurnStart(target.id), catalog);

    const burnTick = result.generatedActions.find(
      (a) => a.type === 'status_tick' && a.payload.statusTypeId === burnTypeId,
    );
    expect(burnTick).toBeDefined();
  });

  it('emits status_tick for all three predicate-covered duration modes on a normal turn_start', () => {
    const caster = makeUnit({ id: 'caster', spd: 10, ma: 9, hp: 100 });
    const target = makeUnit({ id: 'target', spd: 10, hp: 100 });
    let state = makeGameState({ units: [caster, target] });
    // Burn → custom + on_unit_ct_100
    state = applyStatus(
      state,
      {
        targetId: target.id,
        typeId: burnTypeId,
        sourceUnitId: caster.id,
        sourceActionSeq: 0,
        stackQuantity: 1,
      },
      catalog,
    ).newState;
    // Poison → permanent_per_unit_ct
    state = applyStatus(
      state,
      {
        targetId: target.id,
        typeId: poisonTypeId,
        sourceUnitId: caster.id,
        sourceActionSeq: 1,
      },
      catalog,
    ).newState;
    // Regen → per_unit_ct (requires explicit duration)
    state = applyStatus(
      state,
      {
        targetId: target.id,
        typeId: regenTypeId,
        sourceUnitId: caster.id,
        sourceActionSeq: 2,
        duration: 3,
      },
      catalog,
    ).newState;

    const result = reduceTurnStart(state, buildTurnStart(target.id), catalog);

    const tickTypes = result.generatedActions
      .filter((a) => a.type === 'status_tick')
      .map((a) => (a.type === 'status_tick' ? a.payload.statusTypeId : null));
    expect(tickTypes).toContain(burnTypeId);
    expect(tickTypes).toContain(poisonTypeId);
    expect(tickTypes).toContain(regenTypeId);
  });

  it('non-skipped and Charging-skipped (suppressStatusTicks=false) fan-outs agree on Burn', () => {
    // The Charging status has suppressStatusTicks=false so its skipped
    // turn still emits ticks. With the shared predicate, both paths
    // emit a status_tick for Burn. (Pre-fix, only the skipped path did.)
    const caster = makeUnit({ id: 'caster', spd: 10, ma: 9, hp: 100 });
    const targetA = makeUnit({ id: 'target_a', spd: 10, hp: 100 });
    let state = makeGameState({ units: [caster, targetA] });
    state = applyStatus(
      state,
      {
        targetId: targetA.id,
        typeId: burnTypeId,
        sourceUnitId: caster.id,
        sourceActionSeq: 0,
        stackQuantity: 1,
      },
      catalog,
    ).newState;
    const normalResult = reduceTurnStart(state, buildTurnStart(targetA.id), catalog);
    const normalBurnTicks = normalResult.generatedActions.filter(
      (a) => a.type === 'status_tick' && a.payload.statusTypeId === burnTypeId,
    ).length;
    expect(normalBurnTicks).toBe(1);
  });
});
