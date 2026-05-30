// Session 54 (ADR-0089) — barrier-TTL global tick. S53 decremented a
// barrier's TTL only on its OWNER's turn_start, so a KO'd / Stopped owner
// (who takes no turns) froze its barriers' countdown forever. S54 ticks
// EVERY unit's barriers on EVERY turn_start, independent of owner state.

import { describe, expect, it } from 'vitest';
import { reduceTurnStart } from './reducers.ts';
import { emptyCatalog, makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { mapWith } from '../map/test-fixtures.ts';
import {
  abilityId,
  unitId,
  type Action,
  type Unit,
  type WorldcraftBarrierEffect,
} from '@engine/index.ts';

const catalog = emptyCatalog();

function barrierEntry(ttl: number): WorldcraftBarrierEffect {
  return {
    kind: 'barrier',
    abilityId: abilityId('barrier'),
    barrierTiles: [{ x: 2, y: 0, layer: 0 }],
    castTick: 0,
    ttl,
  };
}

function withBarrier(u: Unit, ttl: number): Unit {
  return { ...u, worldcraftEffects: [barrierEntry(ttl)] };
}

function map() {
  return mapWith({
    width: 4,
    height: 1,
    tiles: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }],
  });
}

function turnStart(id: ReturnType<typeof unitId>): Extract<Action, { type: 'turn_start' }> {
  return {
    type: 'turn_start', source: 'system', payload: { unitId: id },
    sequenceNumber: 0, seed: 0, timestamp: { tick: 0, ct: 0 }, chainDepth: 0, isReaction: false,
  };
}

describe('Barrier TTL — global turn-start tick', () => {
  it("decrements an owner's barrier on a non-owner's turn_start", () => {
    const owner = withBarrier(makeUnit({ id: 'owner', spd: 8, team: 'team_a' }), 3);
    const mover = makeUnit({ id: 'mover', spd: 9, team: 'team_b', position: { x: 0, y: 0, layer: 0 } });
    const state = makeGameState({ units: [owner, mover], map: map() });
    const r = reduceTurnStart(state, turnStart(mover.id), catalog);
    const ownerAfter = r.newState.units.get(owner.id)!;
    const entry = ownerAfter.worldcraftEffects[0] as WorldcraftBarrierEffect;
    expect(entry.ttl).toBe(2);
    // Not expired yet → no clear action.
    expect(r.generatedActions.some((a) => a.type === 'system_barrier_change')).toBe(false);
  });

  it('ticks and expires a barrier whose owner is KO’d (owner takes no turns)', () => {
    const koOwner = { ...withBarrier(makeUnit({ id: 'owner', spd: 8, team: 'team_a', hp: 0 }), 1), turnsKOd: 1 };
    const mover = makeUnit({ id: 'mover', spd: 9, team: 'team_b', position: { x: 0, y: 0, layer: 0 } });
    const state = makeGameState({ units: [koOwner, mover], map: map() });
    const r = reduceTurnStart(state, turnStart(mover.id), catalog);
    // Barrier expired: queue pruned + a clear action for its tile.
    expect(r.newState.units.get(koOwner.id)!.worldcraftEffects).toHaveLength(0);
    const clear = r.generatedActions.find((a) => a.type === 'system_barrier_change');
    expect(clear).toBeDefined();
    const tc = (clear as Extract<Action, { type: 'system_barrier_change' }>).payload.tileChanges;
    expect(tc[0]).toMatchObject({ x: 2, y: 0, layer: 0, barrier: null });
  });

  it('ticks the turn-taking owner’s own barrier too', () => {
    const owner = withBarrier(makeUnit({ id: 'owner', spd: 8, team: 'team_a' }), 5);
    const state = makeGameState({ units: [owner], map: map() });
    const r = reduceTurnStart(state, turnStart(owner.id), catalog);
    const entry = r.newState.units.get(owner.id)!.worldcraftEffects[0] as WorldcraftBarrierEffect;
    expect(entry.ttl).toBe(4);
  });

  it('is a no-op for units holding no barrier effects', () => {
    const plain = makeUnit({ id: 'plain', spd: 8, team: 'team_a' });
    const state = makeGameState({ units: [plain], map: map() });
    const r = reduceTurnStart(state, turnStart(plain.id), catalog);
    expect(r.generatedActions.some((a) => a.type === 'system_barrier_change')).toBe(false);
  });
});
