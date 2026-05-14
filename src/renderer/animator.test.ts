// Animator action-type coverage tests. The animator's `buildAnim` is an
// exhaustive switch over `Action['type']`; the default branch calls
// `assertNever` so a missing case throws at runtime. Session 32 surfaced
// this when the new `system_set_ct` action type (ADR-0071) shipped
// without an animator case — the orchestrator's pre-battle phase
// committed the first `system_set_ct` and the animator threw mid-pump,
// freezing the React tree.
//
// Tests below feed each "no v1 visual" action type through `enqueue` +
// `tick` and confirm the animator drains the action without throwing
// and ends idle. Future action types added to the engine should grow a
// case here.

import { Animator } from './animator.ts';
import type { Action } from '@engine/index.ts';

function baseEnvelope(seq: number) {
  return {
    sequenceNumber: seq,
    source: 'system' as const,
    timestamp: { tick: 0, ct: 0 },
    seed: 1,
    chainDepth: 0,
    isReaction: false,
  };
}

describe('Animator — no-visual action types drain cleanly (Session 32 regression)', () => {
  it.each([
    'system_apply_status',
    'system_ct_push',
    'system_set_ct',
    'status_remove',
    'status_decrement_stack',
    'status_tick',
    'wait',
  ])('drains %s without throwing and ends idle', (type) => {
    const animator = new Animator();
    // A minimal action of the given type. The animator only reads `type`
    // for the switch; payload shapes are not inspected for the no-visual
    // branches. Cast through unknown to bypass strict payload typing in
    // this test fixture.
    const action = {
      ...baseEnvelope(1),
      type,
      payload: {},
    } as unknown as Action;

    expect(() => animator.enqueue([action])).not.toThrow();
    expect(() => animator.tick(16)).not.toThrow();
    expect(animator.isIdle()).toBe(true);
  });

  it('drains a sequence of pre-battle actions (system_apply_status + system_set_ct) end-to-end', () => {
    // Per ADR-0071 the orchestrator's pre-battle phase emits a
    // deterministic queue of these. Confirm the animator drains them
    // and ends idle without surface effects on the snapshot store.
    const animator = new Animator();
    const actions: Action[] = [
      { ...baseEnvelope(0), type: 'system_apply_status', payload: {} } as unknown as Action,
      { ...baseEnvelope(1), type: 'system_apply_status', payload: {} } as unknown as Action,
      { ...baseEnvelope(2), type: 'system_set_ct', payload: {} } as unknown as Action,
      { ...baseEnvelope(3), type: 'system_set_ct', payload: {} } as unknown as Action,
      { ...baseEnvelope(4), type: 'system_set_ct', payload: {} } as unknown as Action,
    ];
    expect(() => animator.enqueue(actions)).not.toThrow();
    expect(() => animator.tick(16)).not.toThrow();
    expect(animator.isIdle()).toBe(true);
  });
});
