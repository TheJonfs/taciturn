// Turn-flow state machine — pure reducer driving the player's per-turn
// experience. See `docs/twentyOneDesign/battle-ui-architecture.md`
// §"Decision Loop State Machine".
//
// States (excluding pause, which is orthogonal — owned at the
// BattleView level as a top-level flag):
//
//   idle               — not our turn, or animation in progress.
//   action-menu        — top-level Move/Act/Wait shown.
//   move-select        — picking a destination tile.
//   command-set-select — picking which command set to draw from (only
//                        entered when the active unit has more than one
//                        active command set; single-set units skip this).
//   ability-list       — picking an ability within the chosen set.
//   target-select      — picking the target unit / tile for the ability.
//   await-confirm      — modal confirm step (gated by settings). Shows
//                        the proposed action for Confirm/Cancel review.
//   animation          — orchestrator processing; animator playing.
//
// Cancellation backstack (matches design doc):
//   target-select   → ability-list  (same command set)
//   await-confirm   → target-select (same ability)
//   ability-list    → command-set-select | action-menu (depending on
//                                                       prior fan-out)
//   command-set-select → action-menu
//   move-select     → action-menu
//
// The reducer is pure: it knows nothing about the renderer, the engine,
// or the uiController. The accompanying `use-turn-flow` hook layers
// side effects on top (legal-target memos, highlight repaints, tile-
// click wiring, uiController submissions).

import type { AbilityId, CommandSetId, Direction, Position, ProposedAction } from '@engine/index.ts';

export type TurnFlowState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'action-menu' }
  | { readonly kind: 'move-select' }
  | { readonly kind: 'command-set-select' }
  | {
      readonly kind: 'ability-list';
      readonly commandSetId: CommandSetId;
      // Number of active command sets at the moment the player chose
      // Act. Carried forward so cancel-from-ability-list knows whether
      // to return to command-set-select or straight to action-menu.
      readonly commandSetCount: number;
    }
  | {
      readonly kind: 'target-select';
      // `null` for free abilities invoked directly from the action menu
      // (e.g., universal Attack). For command-set-sourced abilities,
      // the source set's id is carried so cancel restores to the
      // ability list.
      readonly commandSetId: CommandSetId | null;
      readonly commandSetCount: number;
      readonly abilityId: AbilityId;
      // The tile the pointer is currently over while target-selecting.
      // Updated as the hover handler fires; used by the AoE preview.
      // `null` when the pointer is outside the map.
      readonly hoverTarget: Position | null;
    }
  | {
      readonly kind: 'await-confirm';
      readonly commandSetId: CommandSetId | null;
      readonly commandSetCount: number;
      readonly abilityId: AbilityId;
      // The fully-formed action the player picked. The hook submits
      // this to the uiController when the player confirms.
      readonly action: ProposedAction;
    }
  // Cardinal-direction facing picker shown when the player clicks
  // "End turn." Per the design doc's WAIT-CONFIRM state: pick a facing,
  // then commit Wait + facing → TURN_END.
  | { readonly kind: 'wait-confirm' }
  | { readonly kind: 'animation' };

export type TurnFlowEvent =
  // Lifecycle: our turn started / ended; animator drained.
  | { readonly kind: 'activeTurnStart' }
  | { readonly kind: 'activeTurnEnd' }
  // Animator drained — return to action-menu if we still have budget,
  // else idle (turn will end externally).
  | { readonly kind: 'animationEnded'; readonly stillOurTurn: boolean }
  // Top-level menu picks.
  | { readonly kind: 'pickMove' }
  | { readonly kind: 'pickAct'; readonly commandSets: ReadonlyArray<CommandSetId> }
  // Direct free-ability invocation (universal Attack, etc.). Skips
  // command-set-select and ability-list; goes straight to target-select.
  | { readonly kind: 'pickFreeAbility'; readonly abilityId: AbilityId }
  | { readonly kind: 'pickWait' }
  // Sub-picks.
  | { readonly kind: 'pickCommandSet'; readonly commandSetId: CommandSetId }
  | { readonly kind: 'pickAbility'; readonly abilityId: AbilityId }
  // Hover during target-select — updates the AoE preview surface.
  | { readonly kind: 'hoverTarget'; readonly position: Position | null }
  // Player committed to a destination / target / wait. Transition to
  // animation (or await-confirm if confirmStep is on for target picks).
  | { readonly kind: 'commitMove' }
  | {
      readonly kind: 'commitTarget';
      readonly action: ProposedAction;
      readonly confirmStep: boolean;
    }
  // Player chose a facing in wait-confirm and committed.
  | { readonly kind: 'commitWait'; readonly facing: Direction }
  // From await-confirm.
  | { readonly kind: 'confirmAccept' }
  // Back-out one step.
  | { readonly kind: 'cancel' };

export const INITIAL_TURN_FLOW: TurnFlowState = { kind: 'idle' };

export function transition(
  state: TurnFlowState,
  event: TurnFlowEvent,
): TurnFlowState {
  // Lifecycle events override the current state regardless of where
  // we are. A turn switch shouldn't leave us mid-target-select.
  if (event.kind === 'activeTurnStart') {
    return { kind: 'action-menu' };
  }
  if (event.kind === 'activeTurnEnd') {
    return { kind: 'idle' };
  }
  if (event.kind === 'animationEnded') {
    return event.stillOurTurn ? { kind: 'action-menu' } : { kind: 'idle' };
  }

  switch (state.kind) {
    case 'idle':
      // Inputs from menu states do nothing while idle. The lifecycle
      // events above are the only way to leave idle.
      return state;

    case 'action-menu':
      if (event.kind === 'pickMove') return { kind: 'move-select' };
      if (event.kind === 'pickWait') return { kind: 'wait-confirm' };
      if (event.kind === 'pickFreeAbility') {
        return {
          kind: 'target-select',
          commandSetId: null,
          commandSetCount: 0,
          abilityId: event.abilityId,
          hoverTarget: null,
        };
      }
      if (event.kind === 'pickAct') {
        if (event.commandSets.length === 0) return state;
        if (event.commandSets.length === 1) {
          return {
            kind: 'ability-list',
            commandSetId: event.commandSets[0]!,
            commandSetCount: 1,
          };
        }
        return { kind: 'command-set-select' };
      }
      return state;

    case 'wait-confirm':
      if (event.kind === 'cancel') return { kind: 'action-menu' };
      if (event.kind === 'commitWait') return { kind: 'animation' };
      return state;

    case 'move-select':
      if (event.kind === 'cancel') return { kind: 'action-menu' };
      if (event.kind === 'commitMove') return { kind: 'animation' };
      return state;

    case 'command-set-select':
      if (event.kind === 'cancel') return { kind: 'action-menu' };
      if (event.kind === 'pickCommandSet') {
        return {
          kind: 'ability-list',
          commandSetId: event.commandSetId,
          // Reached from command-set-select implies >1 sets.
          commandSetCount: 2,
        };
      }
      return state;

    case 'ability-list':
      if (event.kind === 'cancel') {
        return state.commandSetCount > 1
          ? { kind: 'command-set-select' }
          : { kind: 'action-menu' };
      }
      if (event.kind === 'pickAbility') {
        return {
          kind: 'target-select',
          commandSetId: state.commandSetId,
          commandSetCount: state.commandSetCount,
          abilityId: event.abilityId,
          hoverTarget: null,
        };
      }
      return state;

    case 'target-select':
      if (event.kind === 'cancel') {
        // Free-ability invocations (commandSetId === null) cancel back
        // to action-menu directly; command-set-sourced abilities return
        // to the ability list.
        if (state.commandSetId === null) {
          return { kind: 'action-menu' };
        }
        return {
          kind: 'ability-list',
          commandSetId: state.commandSetId,
          commandSetCount: state.commandSetCount,
        };
      }
      if (event.kind === 'hoverTarget') {
        return { ...state, hoverTarget: event.position };
      }
      if (event.kind === 'commitTarget') {
        if (event.confirmStep) {
          return {
            kind: 'await-confirm',
            commandSetId: state.commandSetId,
            commandSetCount: state.commandSetCount,
            abilityId: state.abilityId,
            action: event.action,
          };
        }
        return { kind: 'animation' };
      }
      return state;

    case 'await-confirm':
      if (event.kind === 'cancel') {
        return {
          kind: 'target-select',
          commandSetId: state.commandSetId,
          commandSetCount: state.commandSetCount,
          abilityId: state.abilityId,
          hoverTarget: null,
        } as TurnFlowState;
      }
      if (event.kind === 'confirmAccept') return { kind: 'animation' };
      return state;

    case 'animation':
      // Only animationEnded (handled above) leaves animation. Other
      // events are ignored — the UI is fully disabled here.
      return state;
  }
}

// Convenience predicates the menu components use to gate input.
export function isInteractive(state: TurnFlowState): boolean {
  return state.kind !== 'idle' && state.kind !== 'animation';
}

export function isAtMenu(state: TurnFlowState): boolean {
  return state.kind === 'action-menu';
}
