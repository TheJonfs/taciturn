// Session 74 — status exclusivity groups (ADR-0124).
//
// The permanent equipment buff forms (haste / protect / shell / regen_auto)
// and their timed cast siblings (quickening / protect_cast / shell_cast /
// regen) are distinct status types that share an effect. Before this change
// they coexisted and compounded — Boots of Haste (`haste`, ×1.5 Speed) plus a
// cast Haste (`quickening`, ×1.5) multiplied to ×2.25. The `exclusivityGroup`
// field makes same-group different-typed applications mutually exclusive: the
// first holder keeps the slot (equipment grants apply at battle start), and a
// later sibling application is rejected.

import { describe, expect, it } from 'vitest';
import { computeSpeed } from '../ct/speed.ts';
import { makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { loadDefaultCatalog } from '../../content/index.ts';
import { applyStatus } from './apply.ts';
import { statusTypeId, type GameState, type UnitId } from '../types/index.ts';

const cat = loadDefaultCatalog();

function applied(state: GameState, targetId: UnitId, typeId: string, duration?: number) {
  return applyStatus(
    state,
    {
      targetId,
      typeId: statusTypeId(typeId),
      sourceUnitId: null,
      sourceActionSeq: null,
      ...(duration !== undefined ? { duration } : {}),
    },
    cat,
  );
}

describe('S74 — status exclusivity groups', () => {
  it('rejects a cast Haste (quickening) when equipment Haste already holds the slot', () => {
    const u = makeUnit({ id: 'u', spd: 10 });
    const withHaste = applied(makeGameState({ units: [u] }), u.id, 'haste').newState;
    expect(withHaste.units.get(u.id)!.statuses).toHaveLength(1);

    const { newState, result } = applied(withHaste, u.id, 'quickening', 6);
    expect(result).toEqual({ kind: 'rejected', reason: 'exclusivity_group' });
    // Still only the original haste — no quickening added.
    expect(newState.units.get(u.id)!.statuses).toHaveLength(1);
    expect(newState.units.get(u.id)!.statuses[0]!.typeId).toEqual(statusTypeId('haste'));
  });

  it('does not compound Speed: haste + attempted quickening stays ×1.5, not ×2.25', () => {
    const u = makeUnit({ id: 'u', spd: 10 });
    let state = applied(makeGameState({ units: [u] }), u.id, 'haste').newState;
    state = applied(state, u.id, 'quickening', 6).newState; // rejected
    expect(computeSpeed(state, u.id, cat)).toBe(15); // 10 × 1.5, not 22.5
  });

  it('still refreshes a same-type re-application (exclusivity does not block it)', () => {
    const u = makeUnit({ id: 'u', spd: 10 });
    let state = applied(makeGameState({ units: [u] }), u.id, 'quickening', 6).newState;
    const { result } = applied(state, u.id, 'quickening', 6);
    expect(result.kind).toBe('refreshed');
  });

  it('leaves different groups independent: haste + protect both apply', () => {
    const u = makeUnit({ id: 'u', spd: 10 });
    let state = applied(makeGameState({ units: [u] }), u.id, 'haste').newState;
    const { result, newState } = applied(state, u.id, 'protect');
    expect(result.kind).toBe('applied');
    expect(newState.units.get(u.id)!.statuses).toHaveLength(2);
  });

  it('applies to the regen pair too (regen_auto blocks a cast regen)', () => {
    const u = makeUnit({ id: 'u', spd: 10 });
    const state = applied(makeGameState({ units: [u] }), u.id, 'regen_auto').newState;
    const { result } = applied(state, u.id, 'regen', 6);
    expect(result).toEqual({ kind: 'rejected', reason: 'exclusivity_group' });
  });
});
