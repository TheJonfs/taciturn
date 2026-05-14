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

import { describe, expect, it } from 'vitest';
import { Animator, type UnitVisualSnapshot } from './animator.ts';
import { unitId, type Action } from '@engine/index.ts';

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
});

// ADR-0074: the engine reports the target's actual post-application HP on
// `AbilityTargetResult.hpAfter`. The animator's flash settles its visual
// from that truth rather than re-deriving HP by arithmetic on the
// recorded `damage`/`healing` magnitudes — which diverge from engine
// state whenever an application is gated (a heal on a KO'd target records
// a positive `healing` but applies nothing). That divergence was the root
// cause of the River Ridge playtest's ghost-HP / missing-red-X bugs.
describe('Animator — flash settles HP/KO from result.hpAfter (ADR-0074)', () => {
  function snapshotOf(overrides: Partial<UnitVisualSnapshot>): UnitVisualSnapshot {
    return {
      position: { x: 0, y: 0 },
      facing: 'N',
      hp: 100,
      mp: 0,
      ko: false,
      flash: 0,
      ...overrides,
    };
  }

  function healAction(targetId: string, healing: number, hpAfter: number): Action {
    return {
      ...baseEnvelope(1),
      type: 'use_ability',
      actorId: unitId('caster'),
      payload: {},
      outcome: {
        kind: 'use_ability',
        perTargetResults: [
          {
            target: { kind: 'unit', unitId: unitId(targetId) },
            hit: true,
            healing,
            hpAfter,
          },
        ],
      },
    } as unknown as Action;
  }

  it("a heal recorded against a KO'd target leaves the visual KO'd (hpAfter wins over healing)", () => {
    const animator = new Animator();
    animator.initSnapshot(unitId('t'), snapshotOf({ hp: 0, ko: true }));
    // The engine gated the heal: the result carries `healing: 35` (for the
    // action log) but `hpAfter: 0` (the applied truth).
    animator.enqueue([healAction('t', 35, 0)]);
    animator.tick(1000); // well past the flash duration
    const snap = animator.getSnapshot(unitId('t'))!;
    expect(snap.hp).toBe(0);
    expect(snap.ko).toBe(true);
  });

  it('a real heal on a live target settles the visual to the engine-reported hpAfter', () => {
    const animator = new Animator();
    animator.initSnapshot(unitId('t'), snapshotOf({ hp: 40, ko: false }));
    animator.enqueue([healAction('t', 35, 75)]);
    animator.tick(1000);
    const snap = animator.getSnapshot(unitId('t'))!;
    expect(snap.hp).toBe(75);
    expect(snap.ko).toBe(false);
  });
});

// Session 33.5A (ADR-0074 amendment): the renderer settles MP and
// system-damage/heal HP from engine-reported *absolutes*, never UI
// arithmetic on magnitude deltas. `UseAbilityOutcome.mpAfter`,
// `SystemMpDrainOutcome.{source,target}MpAfter`,
// `SystemDamageOutcome.hpAfter` / `SystemHealOutcome.hpAfter`.
describe('Animator — MP / system HP settle from engine absolutes (S33.5A / ADR-0074)', () => {
  function snap(overrides: Partial<UnitVisualSnapshot>): UnitVisualSnapshot {
    return {
      position: { x: 0, y: 0 },
      facing: 'N',
      hp: 100,
      mp: 0,
      ko: false,
      flash: 0,
      ...overrides,
    };
  }

  it('an instant cast settles the caster MP from outcome.mpAfter (not snap.mp - mpSpent)', () => {
    const animator = new Animator();
    animator.initSnapshot(unitId('caster'), snap({ mp: 30 }));
    const action = {
      ...baseEnvelope(1),
      type: 'use_ability',
      actorId: unitId('caster'),
      payload: {},
      outcome: { kind: 'use_ability', perTargetResults: [], mpSpent: 8, mpAfter: 22 },
    } as unknown as Action;
    animator.enqueue([action]);
    animator.tick(1000);
    expect(animator.getSnapshot(unitId('caster'))!.mp).toBe(22);
  });

  it('a charged-cast commit settles the caster MP (the cost is paid up front)', () => {
    const animator = new Animator();
    animator.initSnapshot(unitId('caster'), snap({ mp: 30 }));
    const action = {
      ...baseEnvelope(1),
      type: 'use_ability',
      actorId: unitId('caster'),
      payload: {},
      outcome: {
        kind: 'use_ability',
        perTargetResults: [],
        mpSpent: 8,
        mpAfter: 22,
        chargedActionId: 'ca1',
      },
    } as unknown as Action;
    animator.enqueue([action]);
    animator.tick(1000);
    expect(animator.getSnapshot(unitId('caster'))!.mp).toBe(22);
  });

  it('system_mp_drain settles both ends from sourceMpAfter / targetMpAfter', () => {
    const animator = new Animator();
    animator.initSnapshot(unitId('src'), snap({ mp: 10 }));
    animator.initSnapshot(unitId('tgt'), snap({ mp: 50 }));
    const action = {
      ...baseEnvelope(1),
      type: 'system_mp_drain',
      payload: { source: unitId('src'), target: unitId('tgt'), amount: 8 },
      outcome: {
        kind: 'system_mp_drain',
        source: unitId('src'),
        target: unitId('tgt'),
        requested: 8,
        sourceApplied: 8,
        targetApplied: 8,
        sourceMpAfter: 18,
        targetMpAfter: 42,
      },
    } as unknown as Action;
    animator.enqueue([action]);
    animator.tick(1000);
    expect(animator.getSnapshot(unitId('src'))!.mp).toBe(18);
    expect(animator.getSnapshot(unitId('tgt'))!.mp).toBe(42);
  });

  it('system_damage settles HP/KO from outcome.hpAfter — engine-clamped, not snap arithmetic', () => {
    const animator = new Animator();
    // Snapshot at 4 HP; an overkill tick of 133 would underflow to a
    // negative if reconstructed by `snap.hp - applied`. The engine reports
    // `applied: 4, hpAfter: 0` — the animator anchors to the absolute.
    animator.initSnapshot(unitId('t'), snap({ hp: 4 }));
    const action = {
      ...baseEnvelope(1),
      type: 'system_damage',
      payload: { targetId: unitId('t'), amount: 133 },
      outcome: { kind: 'system_damage', targetId: unitId('t'), amount: 133, applied: 4, hpAfter: 0 },
    } as unknown as Action;
    animator.enqueue([action]);
    animator.tick(1000);
    const s = animator.getSnapshot(unitId('t'))!;
    expect(s.hp).toBe(0);
    expect(s.ko).toBe(true);
  });

  it('system_heal settles HP from outcome.hpAfter', () => {
    const animator = new Animator();
    animator.initSnapshot(unitId('t'), snap({ hp: 60 }));
    const action = {
      ...baseEnvelope(1),
      type: 'system_heal',
      payload: { targetId: unitId('t'), amount: 25 },
      outcome: { kind: 'system_heal', targetId: unitId('t'), amount: 25, applied: 25, hpAfter: 85 },
    } as unknown as Action;
    animator.enqueue([action]);
    animator.tick(1000);
    expect(animator.getSnapshot(unitId('t'))!.hp).toBe(85);
  });
});

describe('Animator — pre-battle drain (Session 32 regression, continued)', () => {
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
