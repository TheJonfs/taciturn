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
  // Set when `endTurn()` is called while `queued` already holds a
  // commit decision. The legitimate caller is `submitWait` (wait +
  // optional facing change in one user gesture): it submits `set_facing`
  // then immediately calls `endTurn`. Without this flag, `endTurn`
  // would throw because the previous slot hasn't drained — surfaced as
  // a recurring `UiController.endTurn: a decision is already queued`
  // throw in production playtest (post-S38). The flag fires `end-turn`
  // on the next controller pump *after* the queued commit drains, so
  // both decisions land in the right order without a sequence queue.
  let endTurnPending = false;

  const controller: Controller = () => {
    if (queued !== null) {
      const out = queued;
      queued = null;
      return out;
    }
    if (endTurnPending) {
      endTurnPending = false;
      return { kind: 'end-turn' };
    }
    return { kind: 'pending' };
  };

  return {
    controller,
    submit(action) {
      if (queued !== null) {
        throw new Error(
          `UiController.submit: a decision is already queued (kind=${queued.kind}). ` +
            `Call cancel() first or wait for it to drain.`,
        );
      }
      queued = { kind: 'commit', action };
    },
    endTurn() {
      // If a commit is already queued (the wait + facing sequence),
      // defer the end-turn rather than throw. The controller's pump
      // drains the queued commit first, then surfaces end-turn on the
      // following step.
      if (queued !== null) {
        endTurnPending = true;
        return;
      }
      endTurnPending = true;
    },
    cancel() {
      queued = null;
      endTurnPending = false;
    },
    hasPending() {
      return queued !== null || endTurnPending;
    },
  };
}
