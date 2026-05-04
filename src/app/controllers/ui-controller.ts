// UiController — adapter from "user clicks in React" to the
// orchestrator's `Controller` interface.
//
// The orchestrator pulls a `ControllerDecision` from the controller
// each step. The UI is fundamentally push-driven (clicks happen when
// they happen), so this adapter holds a single-slot queue: React
// imperatively calls `submit` / `endTurn` to enqueue the next decision,
// and the controller drains the slot the next time the orchestrator
// asks. While the slot is empty, the controller returns `'pending'` so
// the orchestrator commits nothing and re-asks next pump tick.
//
// Single-slot intentionally: the v1 UI flow is "pick a sub-action
// → wait for the engine to commit → ask for the next sub-action." If
// the player clicks faster than the orchestrator drains, later clicks
// shouldn't pile up; the UI hook is responsible for not enqueueing a
// second decision until the first has drained (`hasPending()`).

import type { ProposedAction } from '@engine/index.ts';
import type { Controller, ControllerDecision } from '../demo/orchestrator.ts';

export interface UiController {
  readonly controller: Controller;
  // Queue a concrete action for the active unit. The orchestrator will
  // commit it on its next step. Throws if a decision is already queued.
  submit(action: ProposedAction): void;
  // Queue an end-turn decision. The orchestrator will commit `turn_end`.
  // Throws if a decision is already queued.
  endTurn(): void;
  // Drop any queued decision without committing it. Safe to call when
  // nothing is queued.
  cancel(): void;
  // True when a decision is queued but not yet drained.
  hasPending(): boolean;
}

export function createUiController(): UiController {
  let queued: ControllerDecision | null = null;

  const controller: Controller = () => {
    if (queued === null) return { kind: 'pending' };
    const out = queued;
    queued = null;
    return out;
  };

  function assertEmpty(label: string): void {
    if (queued !== null) {
      throw new Error(
        `UiController.${label}: a decision is already queued (kind=${queued.kind}). ` +
          `Call cancel() first or wait for it to drain.`,
      );
    }
  }

  return {
    controller,
    submit(action) {
      assertEmpty('submit');
      queued = { kind: 'commit', action };
    },
    endTurn() {
      assertEmpty('endTurn');
      queued = { kind: 'end-turn' };
    },
    cancel() {
      queued = null;
    },
    hasPending() {
      return queued !== null;
    },
  };
}
