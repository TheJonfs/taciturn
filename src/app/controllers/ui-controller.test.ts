// Unit tests for createUiController. The controller is pure data-flow
// (queue + drain), so these tests don't need a real GameState — the
// controller never inspects state or catalog.

import { unitId, type GameState, type ProposedAction } from '@engine/index.ts';
import { createUiController } from './ui-controller.ts';

// Stub args. The controller never reads them.
const STATE = {} as GameState;
const CATALOG = {} as never;

const ATTACK_ACTION: ProposedAction = {
  type: 'wait',
  source: 'player',
  actorId: unitId('test_actor'),
  payload: {},
};

describe('createUiController', () => {
  it('returns pending when nothing is queued', () => {
    const ui = createUiController();
    const decision = ui.controller(STATE, CATALOG);
    expect(decision).toEqual({ kind: 'pending' });
    expect(ui.hasPending()).toBe(false);
  });

  it('drains a submitted action exactly once', () => {
    const ui = createUiController();
    ui.submit(ATTACK_ACTION);
    expect(ui.hasPending()).toBe(true);

    const first = ui.controller(STATE, CATALOG);
    expect(first).toEqual({ kind: 'commit', action: ATTACK_ACTION });
    expect(ui.hasPending()).toBe(false);

    const second = ui.controller(STATE, CATALOG);
    expect(second).toEqual({ kind: 'pending' });
  });

  it('drains an end-turn decision exactly once', () => {
    const ui = createUiController();
    ui.endTurn();
    expect(ui.hasPending()).toBe(true);

    const first = ui.controller(STATE, CATALOG);
    expect(first).toEqual({ kind: 'end-turn' });
    expect(ui.hasPending()).toBe(false);

    const second = ui.controller(STATE, CATALOG);
    expect(second).toEqual({ kind: 'pending' });
  });

  it('cancel() drops a queued decision without committing', () => {
    const ui = createUiController();
    ui.submit(ATTACK_ACTION);
    expect(ui.hasPending()).toBe(true);

    ui.cancel();
    expect(ui.hasPending()).toBe(false);
    expect(ui.controller(STATE, CATALOG)).toEqual({ kind: 'pending' });
  });

  it('cancel() is a no-op when nothing is queued', () => {
    const ui = createUiController();
    expect(() => ui.cancel()).not.toThrow();
    expect(ui.hasPending()).toBe(false);
  });

  it('throws if a second action is submitted before the first drains', () => {
    const ui = createUiController();
    ui.submit(ATTACK_ACTION);
    expect(() => ui.submit(ATTACK_ACTION)).toThrow(/already queued/);
  });

  it('endTurn() after submit() defers until the submit drains, then fires', () => {
    // Wait + facing-change flow: submitWait calls submit(set_facing) and
    // then immediately endTurn(). Pre-fix this threw. Now end-turn
    // defers and surfaces on the controller pump *after* the queued
    // commit drains. Per the post-S38 playtest debrief.
    const ui = createUiController();
    ui.submit(ATTACK_ACTION);
    expect(() => ui.endTurn()).not.toThrow();
    expect(ui.hasPending()).toBe(true); // both the commit and the deferred end-turn

    const first = ui.controller(STATE, CATALOG);
    expect(first).toEqual({ kind: 'commit', action: ATTACK_ACTION });
    expect(ui.hasPending()).toBe(true); // end-turn still pending

    const second = ui.controller(STATE, CATALOG);
    expect(second).toEqual({ kind: 'end-turn' });
    expect(ui.hasPending()).toBe(false);

    const third = ui.controller(STATE, CATALOG);
    expect(third).toEqual({ kind: 'pending' });
  });

  it('cancel() unblocks subsequent submits and clears the deferred end-turn', () => {
    const ui = createUiController();
    ui.submit(ATTACK_ACTION);
    ui.endTurn(); // defers (would queue if drain happens first)
    ui.cancel();
    expect(ui.hasPending()).toBe(false);
    expect(ui.controller(STATE, CATALOG)).toEqual({ kind: 'pending' });
  });
});
