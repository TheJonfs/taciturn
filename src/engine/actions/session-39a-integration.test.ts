// Session 39a substrate tests — Alchemist consumables + KO recovery +
// permadeath timer. Engine-only; the Alchemist class itself, its R/S/M
// abilities, the action-menu submenu, and AI heuristics land in S39b.

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '../../content/index.ts';
import { applyStatus } from '../status/apply.ts';
import {
  reduceSystemDamage,
  reduceSystemKoTick,
  reduceSystemUnitRemoved,
  reduceUseCompound,
  reduceUseThrowItem,
} from './reducers.ts';
import { validateAction } from './validate.ts';
import { advanceToNextEvent } from '../turn/scheduler.ts';
import { unitAt } from '../map/accessors.ts';
import { activeTurnFor, makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import {
  itemId,
  statusTypeId,
  type Action,
  type ItemId,
  type Unit,
} from '@engine/index.ts';

const catalog = loadDefaultCatalog();
const POTION = itemId('potion');
const PHOENIX_DOWN = itemId('phoenix_down');
const REMEDY = itemId('remedy');
const ETHER = itemId('ether');

function actorAndTarget(opts: {
  readonly actorPa?: number;
  readonly actorMp?: number;
  readonly targetHp?: number;
  readonly targetMaxHp?: number;
  readonly targetMp?: number;
  readonly targetMaxMp?: number;
  readonly stockpile?: ReadonlyMap<ItemId, number>;
}): { actor: Unit; target: Unit } {
  const actor = makeUnit({
    id: 'alch',
    spd: 8,
    pa: opts.actorPa ?? 8,
    mp: opts.actorMp ?? 40,
    position: { x: 0, y: 0, layer: 0 },
    stockpile: opts.stockpile ?? new Map(),
  });
  const target = makeUnit({
    id: 'tgt',
    spd: 10,
    pa: 5,
    hp: opts.targetHp ?? 50,
    maxHpBase: opts.targetMaxHp ?? 100,
    mp: opts.targetMp ?? 20,
    maxMpBase: opts.targetMaxMp ?? 50,
    position: { x: 1, y: 0, layer: 0 },
  });
  return { actor, target };
}

function gameStateWith(units: ReadonlyArray<Unit>): ReturnType<typeof makeGameState> {
  return makeGameState({
    units,
    map: {
      width: 5,
      height: 5,
      tiles: Array.from({ length: 25 }, (_, i) => ({
        x: i % 5,
        y: Math.floor(i / 5),
        layer: 0,
        elevation: 2,
        terrain: 'ground' as const,
        properties: [],
      })),
    },
    turnState: activeTurnFor(units[0]!.id),
  });
}

describe('S39a — Compound', () => {
  it('validates: actor must have sufficient MP for the item compoundMpCost', () => {
    const { actor, target } = actorAndTarget({ actorMp: 5 }); // Potion costs 8
    const state = gameStateWith([actor, target]);
    const res = validateAction(
      state,
      { type: 'use_compound', source: 'player', actorId: actor.id, payload: { itemId: POTION } },
      catalog,
    );
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('Insufficient MP');
  });

  it('validates: rejects non-consumable items (Compound applies only to consumables)', () => {
    const { actor, target } = actorAndTarget({});
    const state = gameStateWith([actor, target]);
    const res = validateAction(
      state,
      {
        type: 'use_compound',
        source: 'player',
        actorId: actor.id,
        payload: { itemId: itemId('long_sword') },
      },
      catalog,
    );
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('not a consumable');
  });

  it('reduces: deducts MP, increments stockpile by 1, consumes Act budget', () => {
    const { actor, target } = actorAndTarget({ actorMp: 40 });
    const state = gameStateWith([actor, target]);
    const action: Extract<Action, { type: 'use_compound' }> = {
      type: 'use_compound',
      sequenceNumber: 0,
      source: 'player',
      actorId: actor.id,
      timestamp: { tick: 0, ct: 0 },
      seed: 0,
      chainDepth: 0,
      isReaction: false,
      payload: { itemId: POTION },
    };
    const { newState, outcome } = reduceUseCompound(state, action, catalog);
    const alchAfter = newState.units.get(actor.id)!;
    expect(alchAfter.vitals.mp).toBe(40 - 8); // potion compoundMpCost
    expect(alchAfter.stockpile.get(POTION)).toBe(1);
    expect(outcome.mpSpent).toBe(8);
    expect(outcome.mpAfter).toBe(32);
    expect(outcome.stockpileAfter).toBe(1);
    expect(newState.turnState!.budget.actsAvailable).toBe(0);
  });

  it('stacks on existing stockpile without bound (no v1 cap)', () => {
    const { actor, target } = actorAndTarget({
      actorMp: 100,
      stockpile: new Map([[POTION, 5]]),
    });
    const state = gameStateWith([actor, target]);
    const action: Extract<Action, { type: 'use_compound' }> = {
      type: 'use_compound',
      sequenceNumber: 0,
      source: 'player',
      actorId: actor.id,
      timestamp: { tick: 0, ct: 0 },
      seed: 0,
      chainDepth: 0,
      isReaction: false,
      payload: { itemId: POTION },
    };
    const { newState, outcome } = reduceUseCompound(state, action, catalog);
    expect(newState.units.get(actor.id)!.stockpile.get(POTION)).toBe(6);
    expect(outcome.stockpileAfter).toBe(6);
  });
});

describe('S39a — Throw Item validation', () => {
  it('rejects when the stockpile is empty for the item', () => {
    const { actor, target } = actorAndTarget({ stockpile: new Map() });
    const state = gameStateWith([actor, target]);
    const res = validateAction(
      state,
      {
        type: 'use_throw_item',
        source: 'player',
        actorId: actor.id,
        payload: { itemId: POTION, target: { kind: 'unit', unitId: target.id } },
      },
      catalog,
    );
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('No Potion in stockpile');
  });

  it('enforces the 3 horizontal / 3 vertical range', () => {
    const { actor, target: nearTarget } = actorAndTarget({
      stockpile: new Map([[POTION, 1]]),
    });
    const farTarget = makeUnit({
      id: 'far_tgt',
      spd: 10,
      position: { x: 4, y: 4, layer: 0 }, // distance 8 from (0,0)
    });
    const state = gameStateWith([actor, nearTarget, farTarget]);
    const res = validateAction(
      state,
      {
        type: 'use_throw_item',
        source: 'player',
        actorId: actor.id,
        payload: { itemId: POTION, target: { kind: 'unit', unitId: farTarget.id } },
      },
      catalog,
    );
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('out of throw range');
  });

  it('rejects when the target is `removed` (permadead)', () => {
    const { actor, target } = actorAndTarget({
      stockpile: new Map([[PHOENIX_DOWN, 1]]),
    });
    const removedTarget: Unit = { ...target, removed: true, vitals: { hp: 0, mp: 0 } };
    const state = gameStateWith([actor, removedTarget]);
    const res = validateAction(
      state,
      {
        type: 'use_throw_item',
        source: 'player',
        actorId: actor.id,
        payload: { itemId: PHOENIX_DOWN, target: { kind: 'unit', unitId: target.id } },
      },
      catalog,
    );
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('removed from battle');
  });

  it('accepts a KO\'d target (Phoenix Down needs to target them)', () => {
    const { actor, target } = actorAndTarget({
      stockpile: new Map([[PHOENIX_DOWN, 1]]),
      targetHp: 0,
    });
    const state = gameStateWith([actor, target]);
    const res = validateAction(
      state,
      {
        type: 'use_throw_item',
        source: 'player',
        actorId: actor.id,
        payload: { itemId: PHOENIX_DOWN, target: { kind: 'unit', unitId: target.id } },
      },
      catalog,
    );
    expect(res.valid).toBe(true);
  });
});

describe('S39a — Potion', () => {
  it('restores PA × 12 HP, capped at maxHp', () => {
    const { actor, target } = actorAndTarget({
      actorPa: 8,
      stockpile: new Map([[POTION, 1]]),
      targetHp: 30,
      targetMaxHp: 100,
    });
    const state = gameStateWith([actor, target]);
    const action: Extract<Action, { type: 'use_throw_item' }> = {
      type: 'use_throw_item',
      sequenceNumber: 0,
      source: 'player',
      actorId: actor.id,
      timestamp: { tick: 0, ct: 0 },
      seed: 0,
      chainDepth: 0,
      isReaction: false,
      payload: { itemId: POTION, target: { kind: 'unit', unitId: target.id } },
    };
    const { newState, outcome } = reduceUseThrowItem(state, action, catalog);
    const tgtAfter = newState.units.get(target.id)!;
    expect(tgtAfter.vitals.hp).toBe(100); // 30 + 96 capped at 100
    expect(outcome.perTargetResults[0]!.healing).toBe(70); // applied = 100 - 30
    expect(outcome.perTargetResults[0]!.hpAfter).toBe(100);
    expect(newState.units.get(actor.id)!.stockpile.has(POTION)).toBe(false); // empty entry pruned
    expect(outcome.stockpileAfter).toBe(0);
  });

  it('does NOT heal a KO\'d target (Phoenix Down is the revival path)', () => {
    const { actor, target } = actorAndTarget({
      stockpile: new Map([[POTION, 1]]),
      targetHp: 0,
    });
    const state = gameStateWith([actor, target]);
    const action: Extract<Action, { type: 'use_throw_item' }> = {
      type: 'use_throw_item',
      sequenceNumber: 0,
      source: 'player',
      actorId: actor.id,
      timestamp: { tick: 0, ct: 0 },
      seed: 0,
      chainDepth: 0,
      isReaction: false,
      payload: { itemId: POTION, target: { kind: 'unit', unitId: target.id } },
    };
    const { newState, outcome } = reduceUseThrowItem(state, action, catalog);
    expect(newState.units.get(target.id)!.vitals.hp).toBe(0);
    expect(outcome.perTargetResults[0]!.healing).toBe(0);
    expect(outcome.perTargetResults[0]!.hpAfter).toBe(0);
  });
});

describe('S39a — Phoenix Down', () => {
  it('revives a KO\'d target: HP=1 + PA × 4 heal, turnsKOd reset, CT reset', () => {
    const koTarget = makeUnit({
      id: 'tgt',
      spd: 10,
      pa: 5,
      hp: 0,
      maxHpBase: 100,
      turnsKOd: 2,
      ct: 80, // would be ticking toward virtual threshold
      position: { x: 1, y: 0, layer: 0 },
    });
    const actor = makeUnit({
      id: 'alch',
      spd: 8,
      pa: 8,
      mp: 40,
      stockpile: new Map([[PHOENIX_DOWN, 1]]),
      position: { x: 0, y: 0, layer: 0 },
    });
    const state = gameStateWith([actor, koTarget]);
    const action: Extract<Action, { type: 'use_throw_item' }> = {
      type: 'use_throw_item',
      sequenceNumber: 0,
      source: 'player',
      actorId: actor.id,
      timestamp: { tick: 0, ct: 0 },
      seed: 0,
      chainDepth: 0,
      isReaction: false,
      payload: { itemId: PHOENIX_DOWN, target: { kind: 'unit', unitId: koTarget.id } },
    };
    const { newState, outcome } = reduceUseThrowItem(state, action, catalog);
    const tgtAfter = newState.units.get(koTarget.id)!;
    // HP = 1 (revive baseline) + 8 × 4 = 33, capped at maxHp 100.
    expect(tgtAfter.vitals.hp).toBe(33);
    expect(tgtAfter.turnsKOd).toBe(0); // reset
    expect(tgtAfter.ct).toBe(0); // resume from zero (FFT canonical, Chris's confirmation)
    expect(tgtAfter.removed).toBe(false);
    // healing total includes the 32 from hpRestore (not the +1 revive baseline).
    expect(outcome.perTargetResults[0]!.healing).toBe(32);
    expect(outcome.perTargetResults[0]!.hpAfter).toBe(33);
  });

  it('on a non-KO\'d target: skip revive (no-op), still heal PA × 4', () => {
    const { actor, target } = actorAndTarget({
      actorPa: 8,
      stockpile: new Map([[PHOENIX_DOWN, 1]]),
      targetHp: 50,
      targetMaxHp: 100,
    });
    const state = gameStateWith([actor, target]);
    const action: Extract<Action, { type: 'use_throw_item' }> = {
      type: 'use_throw_item',
      sequenceNumber: 0,
      source: 'player',
      actorId: actor.id,
      timestamp: { tick: 0, ct: 0 },
      seed: 0,
      chainDepth: 0,
      isReaction: false,
      payload: { itemId: PHOENIX_DOWN, target: { kind: 'unit', unitId: target.id } },
    };
    const { newState, outcome } = reduceUseThrowItem(state, action, catalog);
    expect(newState.units.get(target.id)!.vitals.hp).toBe(82); // 50 + 32
    expect(outcome.perTargetResults[0]!.healing).toBe(32);
  });

  it('cannot revive a `removed` (permadead) unit — rejected at validation', () => {
    const { actor, target } = actorAndTarget({
      stockpile: new Map([[PHOENIX_DOWN, 1]]),
    });
    const removedTarget: Unit = { ...target, removed: true, vitals: { hp: 0, mp: 0 } };
    const state = gameStateWith([actor, removedTarget]);
    const res = validateAction(
      state,
      {
        type: 'use_throw_item',
        source: 'player',
        actorId: actor.id,
        payload: { itemId: PHOENIX_DOWN, target: { kind: 'unit', unitId: target.id } },
      },
      catalog,
    );
    expect(res.valid).toBe(false);
  });
});

describe('S39a — Remedy', () => {
  it('clears debuff-polarity statuses but keeps buffs', () => {
    const { actor, target } = actorAndTarget({
      stockpile: new Map([[REMEDY, 1]]),
      targetHp: 50,
    });
    // Apply a buff (regen) and a debuff (poison) so Remedy has work to do.
    let state = gameStateWith([actor, target]);
    state = applyStatus(
      state,
      {
        targetId: target.id,
        typeId: statusTypeId('regen'),
        sourceUnitId: null,
        sourceActionSeq: null,
        duration: 5,
      },
      catalog,
    ).newState;
    state = applyStatus(
      state,
      {
        targetId: target.id,
        typeId: statusTypeId('poison'),
        sourceUnitId: null,
        sourceActionSeq: null,
        duration: 5,
      },
      catalog,
    ).newState;
    const beforeStatusTypes = state.units.get(target.id)!.statuses.map((s) => s.typeId);
    expect(beforeStatusTypes).toContain(statusTypeId('regen'));
    expect(beforeStatusTypes).toContain(statusTypeId('poison'));

    const action: Extract<Action, { type: 'use_throw_item' }> = {
      type: 'use_throw_item',
      sequenceNumber: 0,
      source: 'player',
      actorId: actor.id,
      timestamp: { tick: 0, ct: 0 },
      seed: 0,
      chainDepth: 0,
      isReaction: false,
      payload: { itemId: REMEDY, target: { kind: 'unit', unitId: target.id } },
    };
    const { newState } = reduceUseThrowItem(state, action, catalog);
    const afterStatusTypes = newState.units.get(target.id)!.statuses.map((s) => s.typeId);
    expect(afterStatusTypes).toContain(statusTypeId('regen')); // buff kept
    expect(afterStatusTypes).not.toContain(statusTypeId('poison')); // debuff cleared
  });

  it('does not touch KO (KO is not a status)', () => {
    const { actor, target } = actorAndTarget({
      stockpile: new Map([[REMEDY, 1]]),
      targetHp: 0,
    });
    const state = gameStateWith([actor, target]);
    const action: Extract<Action, { type: 'use_throw_item' }> = {
      type: 'use_throw_item',
      sequenceNumber: 0,
      source: 'player',
      actorId: actor.id,
      timestamp: { tick: 0, ct: 0 },
      seed: 0,
      chainDepth: 0,
      isReaction: false,
      payload: { itemId: REMEDY, target: { kind: 'unit', unitId: target.id } },
    };
    const { newState } = reduceUseThrowItem(state, action, catalog);
    expect(newState.units.get(target.id)!.vitals.hp).toBe(0); // still KO'd
  });
});

describe('S39a — Ether', () => {
  it('restores PA × 4 MP via system_mp_restore emission', () => {
    const { actor, target } = actorAndTarget({
      actorPa: 8,
      stockpile: new Map([[ETHER, 1]]),
      targetMp: 10,
      targetMaxMp: 50,
    });
    const state = gameStateWith([actor, target]);
    const action: Extract<Action, { type: 'use_throw_item' }> = {
      type: 'use_throw_item',
      sequenceNumber: 0,
      source: 'player',
      actorId: actor.id,
      timestamp: { tick: 0, ct: 0 },
      seed: 0,
      chainDepth: 0,
      isReaction: false,
      payload: { itemId: ETHER, target: { kind: 'unit', unitId: target.id } },
    };
    const { generatedActions } = reduceUseThrowItem(state, action, catalog);
    // Throw Item emits a system_mp_restore — the orchestrator applies it.
    // Re-fire the emission against newState manually to assert the math.
    expect(generatedActions).toHaveLength(1);
    expect(generatedActions[0]!.type).toBe('system_mp_restore');
    if (generatedActions[0]!.type !== 'system_mp_restore') throw new Error('unreachable');
    expect(generatedActions[0]!.payload.amount).toBe(32); // 8 × 4
    expect(generatedActions[0]!.payload.targetId).toBe(target.id);
  });
});

describe('S39a — Permadeath timer (scheduler + reducer integration)', () => {
  it('scheduler emits system_ko_tick for a KO\'d unit when its virtual CT triggers', () => {
    // Single KO'd unit alone in state — must be the next event.
    const ko = makeUnit({
      id: 'ko',
      spd: 10,
      hp: 0,
      ct: 95,
      position: { x: 0, y: 0, layer: 0 },
    });
    // Drop the turn so advanceToNextEvent will run.
    const state = makeGameState({ units: [ko] });
    const sched = advanceToNextEvent(state, catalog);
    expect(sched).not.toBe(null);
    expect(sched!.proposed.type).toBe('system_ko_tick');
    if (sched!.proposed.type !== 'system_ko_tick') throw new Error('unreachable');
    expect(sched!.proposed.payload.targetId).toBe(ko.id);
  });

  it('ko_tick reducer increments turnsKOd and resets CT to 0', () => {
    const ko = makeUnit({
      id: 'ko',
      spd: 10,
      hp: 0,
      ct: 100,
      turnsKOd: 0,
      position: { x: 0, y: 0, layer: 0 },
    });
    const state = makeGameState({ units: [ko] });
    const action: Extract<Action, { type: 'system_ko_tick' }> = {
      type: 'system_ko_tick',
      sequenceNumber: 0,
      source: 'system',
      timestamp: { tick: 0, ct: 0 },
      seed: 0,
      chainDepth: 0,
      isReaction: false,
      payload: { targetId: ko.id },
    };
    const { newState, outcome, generatedActions } = reduceSystemKoTick(state, action, catalog);
    const after = newState.units.get(ko.id)!;
    expect(after.turnsKOd).toBe(1);
    expect(after.ct).toBe(0);
    expect(after.removed).toBe(false);
    expect(outcome.removalQueued).toBe(false);
    expect(generatedActions).toHaveLength(0);
  });

  it('at threshold-1 → tick, queues system_unit_removed', () => {
    const ko = makeUnit({
      id: 'ko',
      spd: 10,
      hp: 0,
      ct: 100,
      turnsKOd: 2, // threshold is 3 in the default ruleset
      position: { x: 0, y: 0, layer: 0 },
    });
    const state = makeGameState({ units: [ko] });
    const action: Extract<Action, { type: 'system_ko_tick' }> = {
      type: 'system_ko_tick',
      sequenceNumber: 0,
      source: 'system',
      timestamp: { tick: 0, ct: 0 },
      seed: 0,
      chainDepth: 0,
      isReaction: false,
      payload: { targetId: ko.id },
    };
    const { newState, outcome, generatedActions } = reduceSystemKoTick(state, action, catalog);
    expect(newState.units.get(ko.id)!.turnsKOd).toBe(3);
    expect(outcome.removalQueued).toBe(true);
    expect(generatedActions).toHaveLength(1);
    expect(generatedActions[0]!.type).toBe('system_unit_removed');
  });

  it('system_unit_removed flips the unit\'s `removed` flag', () => {
    const ko = makeUnit({
      id: 'ko',
      spd: 10,
      hp: 0,
      turnsKOd: 3,
      position: { x: 0, y: 0, layer: 0 },
    });
    const state = makeGameState({ units: [ko] });
    const action: Extract<Action, { type: 'system_unit_removed' }> = {
      type: 'system_unit_removed',
      sequenceNumber: 0,
      source: 'system',
      timestamp: { tick: 0, ct: 0 },
      seed: 0,
      chainDepth: 0,
      isReaction: false,
      payload: { targetId: ko.id },
    };
    const { newState, outcome } = reduceSystemUnitRemoved(state, action);
    expect(newState.units.get(ko.id)!.removed).toBe(true);
    expect(outcome.turnsKOdAtRemoval).toBe(3);
  });

  it('ko_tick on a unit that revived between fire and commit is a no-op', () => {
    const revived = makeUnit({
      id: 'tgt',
      spd: 10,
      hp: 30,
      ct: 100,
      turnsKOd: 0, // already reset by the revive path
      position: { x: 0, y: 0, layer: 0 },
    });
    const state = makeGameState({ units: [revived] });
    const action: Extract<Action, { type: 'system_ko_tick' }> = {
      type: 'system_ko_tick',
      sequenceNumber: 0,
      source: 'system',
      timestamp: { tick: 0, ct: 0 },
      seed: 0,
      chainDepth: 0,
      isReaction: false,
      payload: { targetId: revived.id },
    };
    const { newState, outcome } = reduceSystemKoTick(state, action, catalog);
    expect(newState.units.get(revived.id)!.turnsKOd).toBe(0);
    expect(newState.units.get(revived.id)!.ct).toBe(100); // unchanged
    expect(outcome.removalQueued).toBe(false);
  });

  it('removed units are excluded from the scheduler snapshot entirely', () => {
    const removed = makeUnit({
      id: 'gone',
      spd: 10,
      hp: 0,
      ct: 99,
      removed: true,
      position: { x: 0, y: 0, layer: 0 },
    });
    const alive = makeUnit({
      id: 'alive',
      spd: 5,
      hp: 50,
      ct: 0,
      position: { x: 1, y: 0, layer: 0 },
    });
    const state = makeGameState({ units: [removed, alive] });
    const sched = advanceToNextEvent(state, catalog);
    // The alive unit's turn must come up, NOT a ko_tick for the removed one.
    expect(sched).not.toBe(null);
    expect(sched!.proposed.type).toBe('turn_start');
  });

  it('full virtual-CT loop: damage → KO → 3 ticks → removed', () => {
    // End-to-end: KO a unit via system_damage, then advance the scheduler
    // 3 times and confirm the unit is removed at the third tick + commit.
    const alch = makeUnit({ id: 'alch', spd: 8, position: { x: 0, y: 0, layer: 0 } });
    const dying = makeUnit({
      id: 'dying',
      spd: 10,
      hp: 5,
      ct: 0,
      position: { x: 1, y: 0, layer: 0 },
    });
    let state = makeGameState({ units: [alch, dying] });
    // KO via system_damage.
    const dmg: Action = {
      type: 'system_damage',
      sequenceNumber: 0,
      source: 'system',
      timestamp: { tick: 0, ct: 0 },
      seed: 0,
      chainDepth: 0,
      isReaction: false,
      payload: { targetId: dying.id, amount: 10, tags: [], source: { kind: 'falling', unitId: dying.id, dropDistance: 1 } },
    };
    state = reduceSystemDamage(state, dmg, catalog).newState;
    expect(state.units.get(dying.id)!.vitals.hp).toBe(0);
    expect(state.units.get(dying.id)!.removed).toBe(false);

    // Tick three virtual cycles. Each cycle advances to the next ko_tick
    // (or the alchemist's turn — we manually advance past alch turns by
    // committing their turn_start/end without action). For test brevity,
    // we apply ko_tick directly three times via the reducer.
    for (let i = 1; i <= 3; i++) {
      const tick: Action = {
        type: 'system_ko_tick',
        sequenceNumber: i,
        source: 'system',
        timestamp: { tick: 0, ct: 0 },
        seed: 0,
        chainDepth: 0,
        isReaction: false,
        payload: { targetId: dying.id },
      };
      const { newState: afterTick, outcome, generatedActions } = reduceSystemKoTick(state, tick, catalog);
      state = afterTick;
      expect(outcome.turnsKOdAfter).toBe(i);
      if (i < 3) {
        expect(outcome.removalQueued).toBe(false);
      } else {
        expect(outcome.removalQueued).toBe(true);
        // Apply the queued system_unit_removed.
        expect(generatedActions[0]!.type).toBe('system_unit_removed');
        const removalAction: Action = {
          type: 'system_unit_removed',
          sequenceNumber: 99,
          source: 'system',
          timestamp: { tick: 0, ct: 0 },
          seed: 0,
          chainDepth: 0,
          isReaction: false,
          payload: { targetId: dying.id },
        };
        state = reduceSystemUnitRemoved(state, removalAction).newState;
      }
    }
    expect(state.units.get(dying.id)!.removed).toBe(true);
  });

  it('removed units don\'t occupy tiles (unitAt returns the next-best)', () => {
    const removed = makeUnit({
      id: 'gone',
      spd: 10,
      hp: 0,
      removed: true,
      position: { x: 2, y: 2, layer: 0 },
    });
    const state = makeGameState({ units: [removed] });
    // We need a map for unitAt — synthesize one via gameStateWith pattern.
    const withMap = {
      ...state,
      map: {
        width: 5,
        height: 5,
        tiles: Array.from({ length: 25 }, (_, i) => ({
          x: i % 5,
          y: Math.floor(i / 5),
          layer: 0,
          elevation: 2,
          terrain: 'ground' as const,
          properties: [],
        })),
      },
    };
    expect(unitAt(withMap, 2, 2, 0)).toBeUndefined();
  });
});
