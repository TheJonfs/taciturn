// Action — the unit of state transition in the engine.
// See docs/design/core-types.md ("Action") and docs/design/action-resolution.md.
//
// Skeleton for session 1. The full discriminated union of payloads and
// outcomes is filled in by session 7 (action types and reducer); the fields
// here are the universal envelope shared by every action kind. Session 1
// only needs the type to exist so GameState.actionLog is well-typed.

import type { UnitId } from './ids.ts';

export type ActionType =
  | 'move'
  | 'use_ability'
  | 'wait'
  | 'set_facing'
  | 'turn_start'
  | 'turn_end'
  | 'charged_action_resolve'
  | 'status_tick';

export type ActionSource = 'player' | 'system';

// Payload and outcome shapes are per-action-type; pinned down in session 7.
export type ActionPayload = unknown;
export type ActionOutcome = unknown;

export interface Action {
  readonly sequenceNumber: number;
  readonly type: ActionType;
  readonly source: ActionSource;
  readonly actorId?: UnitId;
  readonly timestamp: { readonly tick: number; readonly ct: number };
  readonly seed: number;
  readonly payload: ActionPayload;
  readonly outcome?: ActionOutcome;
}
