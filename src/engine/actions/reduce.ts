// Reducer dispatcher — branches on `action.type` and calls the matching
// per-kind reducer in `reducers.ts`. Pure: same `(state, action,
// catalog)` always yields the same `ReduceResult`.
//
// The reducer is *only* concerned with applying a single action's
// effects to state and reporting its outcome + any generated chain
// actions. It does NOT validate, log, or process the chain — that's
// `commitAction`'s job.

import type { Catalog } from '../catalog/index.ts';
import type { Action, ActionOutcome, GameState, ProposedAction } from '../types/index.ts';
import {
  reduceBattleEnd,
  reduceChargedActionResolve,
  reduceMove,
  reduceSetFacing,
  reduceStatusDecrementStack,
  reduceStatusRemove,
  reduceStatusTick,
  reduceSystemApplyStatus,
  reduceSystemCtPush,
  reduceSystemDamage,
  reduceSystemHeal,
  reduceSystemMpDrain,
  reduceTurnEnd,
  reduceTurnStart,
  reduceUseAbility,
  reduceWait,
  type ReduceResult,
} from './reducers.ts';

export interface ReducerOutput {
  readonly newState: GameState;
  readonly outcome: ActionOutcome;
  readonly generatedActions: ReadonlyArray<ProposedAction>;
  // Reactions are forwarded as-is from the per-kind reducer's
  // ReduceResult.generatedReactions. Absent for branches that don't
  // emit reactions; commitAction tags these with isReaction = true.
  readonly generatedReactions?: ReadonlyArray<ProposedAction>;
}

export function reduce(state: GameState, action: Action, catalog: Catalog): ReducerOutput {
  switch (action.type) {
    case 'move':
      return reduceMove(state, action, catalog) as ReduceResult<ActionOutcome>;
    case 'use_ability':
      return reduceUseAbility(state, action, catalog) as ReduceResult<ActionOutcome>;
    case 'wait':
      return reduceWait(state, action) as ReduceResult<ActionOutcome>;
    case 'set_facing':
      return reduceSetFacing(state, action) as ReduceResult<ActionOutcome>;
    case 'turn_start':
      return reduceTurnStart(state, action, catalog) as ReduceResult<ActionOutcome>;
    case 'turn_end':
      return reduceTurnEnd(state, action, catalog) as ReduceResult<ActionOutcome>;
    case 'status_tick':
      return reduceStatusTick(state, action, catalog) as ReduceResult<ActionOutcome>;
    case 'system_heal':
      return reduceSystemHeal(state, action, catalog) as ReduceResult<ActionOutcome>;
    case 'system_damage':
      return reduceSystemDamage(state, action, catalog) as ReduceResult<ActionOutcome>;
    case 'system_mp_drain':
      return reduceSystemMpDrain(state, action, catalog) as ReduceResult<ActionOutcome>;
    case 'system_apply_status':
      return reduceSystemApplyStatus(state, action, catalog) as ReduceResult<ActionOutcome>;
    case 'system_ct_push':
      return reduceSystemCtPush(state, action) as ReduceResult<ActionOutcome>;
    case 'status_remove':
      return reduceStatusRemove(state, action, catalog) as ReduceResult<ActionOutcome>;
    case 'status_decrement_stack':
      return reduceStatusDecrementStack(state, action, catalog) as ReduceResult<ActionOutcome>;
    case 'charged_action_resolve':
      return reduceChargedActionResolve(state, action, catalog) as ReduceResult<ActionOutcome>;
    case 'battle_end':
      return reduceBattleEnd(state, action) as ReduceResult<ActionOutcome>;
  }
}
