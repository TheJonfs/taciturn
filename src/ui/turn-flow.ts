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
//   target-select       → ability-list  (same command set)
//   await-confirm       → target-select (same ability)
//   ability-list        → command-set-select | action-menu (depending on
//                                                       prior fan-out)
//   command-set-select  → action-menu
//   move-await-confirm  → move-select   (re-pick destination)
//   move-select         → action-menu
//
// The reducer is pure: it knows nothing about the renderer, the engine,
// or the uiController. The accompanying `use-turn-flow` hook layers
// side effects on top (legal-target memos, highlight repaints, tile-
// click wiring, uiController submissions).

import type {
  AbilityId,
  CommandSetId,
  Direction,
  MathSkillParameter,
  MathSkillValue,
  Position,
  ProposedAction,
  UnitId,
} from '@engine/index.ts';

// One entry in the Act picker — either a class-granted free ability
// (Attack today; future classless utility actions) or a command set.
// Per session 25 (Chris's "Attack and Battle Skill as peers" call):
// the picker treats both kinds at the same level. Selecting a
// `free_ability` jumps straight to target-select; selecting a
// `command_set` drills into its member ability list.
export type ActEntry =
  | { readonly kind: 'free_ability'; readonly abilityId: AbilityId }
  | { readonly kind: 'command_set'; readonly commandSetId: CommandSetId };

export type TurnFlowState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'action-menu' }
  | {
      readonly kind: 'move-select';
      // The tile the pointer is currently over while move-selecting.
      // Drives the hover overlay (a single bright tile under the cursor
      // so the player sees which tile they're about to commit to before
      // clicking). `null` when the pointer is outside the legal-move set.
      readonly hoverTarget: Position | null;
    }
  | {
      // Move-confirm gate (per session 24.5 designer call): after
      // clicking a destination, the player sees a Confirm/Cancel row
      // before the move commits. Always-confirm in v1 — independent of
      // `settings.confirmStep` (which gates target-select). Settings
      // unification is a later polish pass.
      readonly kind: 'move-await-confirm';
      readonly destination: Position;
    }
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
      // For `unit_or_tile` abilities (post-S38, FFT-canonical): `true`
      // means clicks pin to the tile (spell doesn't follow the unit if
      // they move); `false` means clicks pin to the unit (FFT-default,
      // spell follows). Toggled by `toggleTileMode`. Ignored for `self`,
      // `single_unit`, and `tile` abilities — those have a single
      // sensible payload shape already. Preserved across await-confirm
      // cancel so the player doesn't have to re-toggle on each retry.
      readonly tileMode: boolean;
    }
  | {
      readonly kind: 'await-confirm';
      readonly commandSetId: CommandSetId | null;
      readonly commandSetCount: number;
      readonly abilityId: AbilityId;
      // The fully-formed action the player picked. The hook submits
      // this to the uiController when the player confirms.
      readonly action: ProposedAction;
      // Carries the tile-mode toggle state forward so a cancel back to
      // target-select restores the player's chosen mode.
      readonly tileMode: boolean;
    }
  // Cardinal-direction facing picker shown when the player clicks
  // "End turn." Per the design doc's WAIT-CONFIRM state: pick a facing,
  // then commit Wait + facing → TURN_END.
  | { readonly kind: 'wait-confirm' }
  // Session 39b: Compound's item picker. Entered when the player picks
  // the Compound ability — instead of target-select (Compound is
  // self-targeted, mechanically), the UI shows the stockpile items as
  // a sub-menu, each gated by `actor.vitals.mp >= item.compoundMpCost`.
  // The carried `commandSetId` / `commandSetCount` lets cancel return
  // to the right parent (ability-list, command-set-select, or
  // action-menu) using the same backstack logic as target-select.
  | {
      readonly kind: 'compound-item-select';
      readonly commandSetId: CommandSetId | null;
      readonly commandSetCount: number;
    }
  // Session 39b: Throw Item's item picker. Entered when the player
  // picks a target during a Throw Item action — the FSM caches the
  // chosen `targetUnitId` and presents the stockpile items, each
  // gated by `stockpile.get(itemId) > 0`. Cancel returns to
  // target-select with the same commandSetId / commandSetCount so the
  // player can re-pick the target.
  | {
      readonly kind: 'throw-item-item-select';
      readonly commandSetId: CommandSetId | null;
      readonly commandSetCount: number;
      readonly abilityId: AbilityId;
      readonly targetUnitId: UnitId;
    }
  // Session 49: Math Skill picker. Entered when the player picks a Math
  // Skill ability — instead of target-select (tile / unit click), the
  // UI surfaces parameter (CT / Height / Level / HP) and value (Prime /
  // 3 / 4 / 5) pickers plus a Cast affordance gated on both picks. The
  // renderer paints the matched-unit highlights as the player toggles
  // selections so they preview the cast before committing.
  | {
      readonly kind: 'math-skill-target-select';
      readonly commandSetId: CommandSetId | null;
      readonly commandSetCount: number;
      readonly abilityId: AbilityId;
      readonly parameter: MathSkillParameter | null;
      readonly value: MathSkillValue | null;
    }
  // Session 55: tile_set picker — the Worldcraft Barrier line. Two-phase
  // click-far-end UX: the first click sets the `anchor` tile; the second
  // click picks the far end of a straight H/V line (length 3-5 from the
  // `tile_set` targeting spec), which the hook turns into the committed
  // tile_set action. While `anchor` is null the picker is in its anchor
  // phase; once set, the extent phase. `hoverTarget` drives the candidate-
  // line preview. Cancel is two-stage (extent → re-pick anchor; anchor →
  // leave the picker, routing like target-select).
  | {
      readonly kind: 'tile-set-target-select';
      readonly commandSetId: CommandSetId | null;
      readonly commandSetCount: number;
      readonly abilityId: AbilityId;
      readonly anchor: Position | null;
      readonly hoverTarget: Position | null;
    }
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
  | { readonly kind: 'pickAct'; readonly entries: ReadonlyArray<ActEntry> }
  // Direct free-ability invocation (universal Attack, etc.). Skips
  // command-set-select and ability-list; goes straight to target-select.
  // Session 39b: `route` optionally redirects the destination:
  //   - 'compound'   → compound-item-select (Compound ability)
  //   - 'throw_item' → target-select (Throw Item; the item picker
  //                     follows the target pick via `pickThrowTarget`)
  //   - undefined    → target-select (standard ability flow)
  | { readonly kind: 'pickFreeAbility'; readonly abilityId: AbilityId; readonly route?: 'compound' | 'throw_item' | 'math_skill' | 'tile_set' }
  | { readonly kind: 'pickWait' }
  // Sub-picks.
  | { readonly kind: 'pickCommandSet'; readonly commandSetId: CommandSetId }
  | { readonly kind: 'pickAbility'; readonly abilityId: AbilityId; readonly route?: 'compound' | 'throw_item' | 'math_skill' | 'tile_set' }
  // Session 39b: Throw Item target selection. Distinct from
  // `commitTarget` because the action isn't built yet (item is
  // picked next).
  | { readonly kind: 'pickThrowTarget'; readonly targetUnitId: UnitId }
  // Session 39b: item picked from either item-select state. The
  // caller (`use-turn-flow.ts`) has already built the full
  // ProposedAction (`use_compound` or `use_throw_item`) — the FSM
  // carries it forward to animation. The item picker itself is the
  // confirmation surface (the player explicitly chose this item with
  // the cost / count shown), so confirmStep is intentionally skipped
  // for these flows.
  | { readonly kind: 'pickItem'; readonly action: ProposedAction }
  // Hover during target-select — updates the AoE preview surface.
  | { readonly kind: 'hoverTarget'; readonly position: Position | null }
  // Hover during move-select — updates the single-tile hover overlay so
  // the player sees the destination they're about to commit to.
  | { readonly kind: 'hoverMove'; readonly position: Position | null }
  // Player picked a destination tile in move-select — transition to
  // move-await-confirm. (Direct commit-without-confirm is no longer a
  // path in v1; the always-confirm gate is the only commit route.)
  | { readonly kind: 'pickMoveDestination'; readonly destination: Position }
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
  | { readonly kind: 'cancel' }
  // unit_or_tile mode toggle — flips tileMode while in target-select.
  // Ignored for non-unit_or_tile abilities (the reducer is unaware of
  // ability kinds; the UI gates the event emission).
  | { readonly kind: 'toggleTileMode' }
  // Session 49: Math Skill parameter + value picks. `pickMathSkillParameter`
  // sets parameter and clears value (re-picking parameter invalidates
  // the prior value). `pickMathSkillValue` is ignored when no parameter
  // is yet selected. Final commit rides the existing `commitTarget` event
  // with a `{ kind: 'math_skill', parameter, value }` AbilityTarget
  // payload — the picker UI builds the proposal once both are non-null.
  | { readonly kind: 'pickMathSkillParameter'; readonly parameter: MathSkillParameter }
  | { readonly kind: 'pickMathSkillValue'; readonly value: MathSkillValue }
  // Session 55: tile_set anchor pick (first click of the Barrier line). The
  // far-end pick rides the existing `commitTarget` event (the hook builds the
  // tile_set action once both ends are known), as Math Skill commits do.
  | { readonly kind: 'pickTileSetAnchor'; readonly anchor: Position };

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
      if (event.kind === 'pickMove') return { kind: 'move-select', hoverTarget: null };
      if (event.kind === 'pickWait') return { kind: 'wait-confirm' };
      if (event.kind === 'pickFreeAbility') {
        // Session 39b: route to the Alchemist submenus when requested.
        if (event.route === 'compound') {
          return {
            kind: 'compound-item-select',
            commandSetId: null,
            commandSetCount: 0,
          };
        }
        // 'throw_item' falls through to target-select (the item picker
        // follows the target pick via `pickThrowTarget`).
        return {
          kind: 'target-select',
          commandSetId: null,
          commandSetCount: 0,
          abilityId: event.abilityId,
          hoverTarget: null,
          tileMode: false,
        };
      }
      if (event.kind === 'pickAct') {
        if (event.entries.length === 0) return state;
        if (event.entries.length === 1) {
          const only = event.entries[0]!;
          if (only.kind === 'free_ability') {
            return {
              kind: 'target-select',
              commandSetId: null,
              commandSetCount: 0,
              abilityId: only.abilityId,
              hoverTarget: null,
              tileMode: false,
            };
          }
          return {
            kind: 'ability-list',
            commandSetId: only.commandSetId,
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
      if (event.kind === 'hoverMove') {
        return { ...state, hoverTarget: event.position };
      }
      if (event.kind === 'pickMoveDestination') {
        return { kind: 'move-await-confirm', destination: event.destination };
      }
      // `commitMove` is retained for backward-compat with any caller
      // that still emits it directly (move-confirm path emits its own
      // animation transition via confirmAccept). Defensive identity.
      if (event.kind === 'commitMove') return { kind: 'animation' };
      return state;

    case 'move-await-confirm':
      if (event.kind === 'cancel') return { kind: 'move-select', hoverTarget: null };
      if (event.kind === 'confirmAccept') return { kind: 'animation' };
      return state;

    case 'command-set-select':
      if (event.kind === 'cancel') return { kind: 'action-menu' };
      if (event.kind === 'pickCommandSet') {
        return {
          kind: 'ability-list',
          commandSetId: event.commandSetId,
          // Reached from command-set-select implies >1 entries in the
          // picker, so cancel from ability-list returns to picker.
          commandSetCount: 2,
        };
      }
      if (event.kind === 'pickFreeAbility') {
        // Free ability picked from the Act picker (per session 25:
        // Attack appears as a peer of command sets). Cancel from
        // target-select returns to the picker because we came from
        // a multi-entry picker — encoded by `commandSetCount: 2`.
        // Session 39b: route to compound-item-select when applicable.
        if (event.route === 'compound') {
          return { kind: 'compound-item-select', commandSetId: null, commandSetCount: 2 };
        }
        return {
          kind: 'target-select',
          commandSetId: null,
          commandSetCount: 2,
          abilityId: event.abilityId,
          hoverTarget: null,
          tileMode: false,
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
        // Session 39b: route to compound-item-select for Compound,
        // and to target-select (item picker follows) for Throw Item.
        if (event.route === 'compound') {
          return {
            kind: 'compound-item-select',
            commandSetId: state.commandSetId,
            commandSetCount: state.commandSetCount,
          };
        }
        // Session 49: Math Skill abilities go to their dedicated
        // parameter + value picker rather than target-select.
        if (event.route === 'math_skill') {
          return {
            kind: 'math-skill-target-select',
            commandSetId: state.commandSetId,
            commandSetCount: state.commandSetCount,
            abilityId: event.abilityId,
            parameter: null,
            value: null,
          };
        }
        // Session 55: tile_set abilities (Worldcraft Barrier) go to the
        // anchor → extent line picker rather than target-select.
        if (event.route === 'tile_set') {
          return {
            kind: 'tile-set-target-select',
            commandSetId: state.commandSetId,
            commandSetCount: state.commandSetCount,
            abilityId: event.abilityId,
            anchor: null,
            hoverTarget: null,
          };
        }
        return {
          kind: 'target-select',
          commandSetId: state.commandSetId,
          commandSetCount: state.commandSetCount,
          abilityId: event.abilityId,
          hoverTarget: null,
          tileMode: false,
        };
      }
      return state;

    case 'target-select':
      if (event.kind === 'cancel') {
        // Free-ability target-select: `commandSetId === null`. Cancel
        // returns to the Act picker when we came from a multi-entry
        // picker (commandSetCount > 1) — that's the common case in
        // session 25 where Attack is one of several picker peers. When
        // there was only one entry to begin with (commandSetCount: 0),
        // the picker was skipped and cancel returns to action-menu.
        if (state.commandSetId === null) {
          return state.commandSetCount > 1
            ? { kind: 'command-set-select' }
            : { kind: 'action-menu' };
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
      if (event.kind === 'toggleTileMode') {
        return { ...state, tileMode: !state.tileMode };
      }
      if (event.kind === 'commitTarget') {
        if (event.confirmStep) {
          return {
            kind: 'await-confirm',
            commandSetId: state.commandSetId,
            commandSetCount: state.commandSetCount,
            abilityId: state.abilityId,
            action: event.action,
            tileMode: state.tileMode,
          };
        }
        return { kind: 'animation' };
      }
      // Session 39b: Throw Item target picked. The action isn't built
      // yet (item is picked next); transition to the item-select
      // state carrying the chosen target. Cancel from there returns
      // to target-select for re-pick.
      if (event.kind === 'pickThrowTarget') {
        return {
          kind: 'throw-item-item-select',
          commandSetId: state.commandSetId,
          commandSetCount: state.commandSetCount,
          abilityId: state.abilityId,
          targetUnitId: event.targetUnitId,
        };
      }
      return state;

    case 'compound-item-select':
      // Session 39b. Cancel routes the same way ability-list does:
      // up to command-set-select if we came from a multi-entry picker,
      // else back to action-menu.
      if (event.kind === 'cancel') {
        if (state.commandSetId !== null) {
          return {
            kind: 'ability-list',
            commandSetId: state.commandSetId,
            commandSetCount: state.commandSetCount,
          };
        }
        return state.commandSetCount > 1
          ? { kind: 'command-set-select' }
          : { kind: 'action-menu' };
      }
      if (event.kind === 'pickItem') {
        // Item picker is the implicit confirm surface — no await-confirm.
        return { kind: 'animation' };
      }
      return state;

    case 'throw-item-item-select':
      // Session 39b. Cancel returns to target-select so the player
      // can re-pick the target without re-entering the ability list.
      if (event.kind === 'cancel') {
        return {
          kind: 'target-select',
          commandSetId: state.commandSetId,
          commandSetCount: state.commandSetCount,
          abilityId: state.abilityId,
          hoverTarget: null,
          tileMode: false,
        };
      }
      if (event.kind === 'pickItem') {
        return { kind: 'animation' };
      }
      return state;

    case 'math-skill-target-select':
      // Session 49. Cancel routes the same way target-select does — to
      // ability-list (with the source command set) or to the
      // command-set-select / action-menu fallback.
      if (event.kind === 'cancel') {
        if (state.commandSetId === null) {
          return state.commandSetCount > 1
            ? { kind: 'command-set-select' }
            : { kind: 'action-menu' };
        }
        return {
          kind: 'ability-list',
          commandSetId: state.commandSetId,
          commandSetCount: state.commandSetCount,
        };
      }
      if (event.kind === 'pickMathSkillParameter') {
        // Re-picking the parameter invalidates the prior value
        // selection. The picker UI should immediately surface the
        // value buttons; until the player picks a value, Cast is
        // disabled and the matched-unit preview shows nothing.
        return { ...state, parameter: event.parameter, value: null };
      }
      if (event.kind === 'pickMathSkillValue') {
        if (state.parameter === null) return state;
        return { ...state, value: event.value };
      }
      if (event.kind === 'commitTarget') {
        // Math Skill bypasses the await-confirm gate even when
        // confirmStep is on — the picker UI is itself the confirmation
        // surface (the player chose parameter + value explicitly with
        // the matched-unit preview in front of them). Same convention
        // as the item pickers (Compound / Throw Item) per S39b.
        return { kind: 'animation' };
      }
      return state;

    case 'tile-set-target-select':
      // Session 55. Two-stage cancel: an extent-phase cancel (anchor set)
      // drops back to anchor re-pick — like move-await-confirm → move-select.
      // An anchor-phase cancel leaves the picker, routing like target-select.
      if (event.kind === 'cancel') {
        if (state.anchor !== null) {
          return { ...state, anchor: null, hoverTarget: null };
        }
        if (state.commandSetId === null) {
          return state.commandSetCount > 1
            ? { kind: 'command-set-select' }
            : { kind: 'action-menu' };
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
      if (event.kind === 'pickTileSetAnchor') {
        return { ...state, anchor: event.anchor, hoverTarget: null };
      }
      if (event.kind === 'commitTarget') {
        // The line-building picker is itself the confirm surface (the player
        // placed both ends with the candidate line previewed), so bypass
        // await-confirm — same convention as Math Skill / the item pickers.
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
          tileMode: state.tileMode,
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
