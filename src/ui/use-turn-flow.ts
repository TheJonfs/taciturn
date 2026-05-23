// useTurnFlow — React glue around the pure `turn-flow` reducer.
//
// Owns:
//   - The turn-flow state (via `useReducer`).
//   - Lifecycle dispatch: detects active-turn boundaries and animation
//     drain from engine + renderer state; emits the matching events.
//   - Side effects: highlight repaints on state change, tile-click and
//     tile-hover wiring on the renderer, uiController submissions on
//     commit transitions.
//   - Memoized helpers the action menu reads (active command sets,
//     ability list per set, disable reasons).
//
// The hook is the only place that knows about both the renderer and the
// uiController. Components consume its return value; they don't touch
// the renderer or controller directly.

import { useEffect, useMemo, useReducer, useRef, useState, type Dispatch } from 'react';
import {
  abilityId,
  aoeFootprint,
  cardinalFromTo,
  canCommitAction,
  computeAbilityRange,
  computeBaseActionSpeed,
  computeMpCost,
  getLegalMoves,
  positionKey,
  runModifyAoeShape,
  runModifyAoeVerticalTolerance,
  tileAt,
  validateAction,
  ACTIVE_BUCKET_IDS,
  type AbilityId,
  type ActiveAbilityDefinition,
  type AoeSpec,
  type Catalog,
  type CommandSetId,
  type GameState,
  type Position,
  type ProposedAction,
  type TeamId,
  type Unit,
  type UnitId,
} from '@engine/index.ts';

const UNIVERSAL_ATTACK_ID = abilityId('attack');

// Session 39b: Alchemist's two action-menu abilities route through
// dedicated FSM submenus rather than the standard target-select →
// commitTarget flow. Detected by ability id at dispatch sites
// (ActionMenu) and at the renderer's target-click handler (so a click
// on a target during Throw Item dispatches `pickThrowTarget` instead
// of `commitTarget`).
const COMPOUND_ABILITY_ID = abilityId('compound');
const THROW_ITEM_ABILITY_ID = abilityId('throw_item');

export function abilityRoute(
  abilityIdValue: AbilityId,
): 'compound' | 'throw_item' | undefined {
  if (abilityIdValue === COMPOUND_ABILITY_ID) return 'compound';
  if (abilityIdValue === THROW_ITEM_ABILITY_ID) return 'throw_item';
  return undefined;
}
import type { BattleRenderer } from '@renderer/index.ts';
import type { UiController } from '@app/controllers/index.ts';
import {
  INITIAL_TURN_FLOW,
  transition,
  type ActEntry,
  type TurnFlowEvent,
  type TurnFlowState,
} from './turn-flow.ts';
import type { ConfirmStepPreference } from './settings-context.tsx';
import { composeForecast, type Forecast } from './forecast-compose.ts';

export interface ActionMenuAbility {
  readonly ability: ActiveAbilityDefinition;
  readonly disabled: boolean;
  readonly disableReason: string | null;
  // Per Session 29: precomputed effective MP cost and action speed so the
  // displayed values match what the commit path applies after the
  // `modifyMpCost` / `modifyActionSpeed` chains run. Without these,
  // Staff of Power's × 1.2 MP and Wand of Deepwood's +5 Earth speed
  // would show their unmodified base values in the picker.
  readonly effectiveMpCost: number;
  readonly effectiveActionSpeed: number;
}

export interface TurnFlow {
  readonly state: TurnFlowState;
  readonly activeUnit: Unit | null;
  readonly isOurTurn: boolean;
  readonly dispatch: Dispatch<TurnFlowEvent>;
  // Tile under the cursor regardless of state-machine state — drives
  // the HUD's tile-info panel (item #1, session 26.5). `null` when the
  // cursor is off-canvas or the renderer is unavailable.
  readonly cursorTile: Position | null;
  // Active command sets equipped on the active unit (sorted by bucket
  // order so the picker UI is deterministic).
  readonly activeCommandSets: ReadonlyArray<CommandSetId>;
  // Picker entries shown when the player clicks Act. Class-granted free
  // abilities (Attack) appear as peers of the equipped command sets so
  // the picker reads "Attack, Battle Skill, …" rather than splicing
  // Attack inside one of the sets. Per ADR-0051's session-25 fix.
  readonly actEntries: ReadonlyArray<ActEntry>;
  // Abilities of a specific command set, decorated with disable info.
  // Returns `null` if the active unit doesn't have this command set.
  abilitiesFor(commandSetId: CommandSetId): ReadonlyArray<ActionMenuAbility> | null;
  // Move budget remaining (drives Move button disable + greyed state).
  readonly movesAvailable: number;
  // Act budget remaining.
  readonly actsAvailable: number;
  // Wait disable info (mirrors the validateAction check).
  readonly waitDisabled: boolean;
  // Submit helpers — driven by the menu buttons.
  submitMove(destination: Position): void;
  // Commit "end turn" with a chosen facing. The hook emits a `set_facing`
  // action when the facing differs from the unit's current direction,
  // then `endTurn`. Per design doc WAIT-CONFIRM.
  submitWait(facing: import('@engine/index.ts').Direction): void;
  submitTargetedAction(action: ProposedAction): void;
  // Session 39b: submit a stockpile item pick from either
  // `compound-item-select` or `throw-item-item-select`. The caller
  // (ActionMenu) already built the `use_compound` / `use_throw_item`
  // action shape; this helper drives the FSM transition to animation
  // and submits to the controller. No await-confirm — the item
  // picker is the implicit confirm surface.
  submitItemPick(action: ProposedAction): void;
  confirmAccept(): void;
  cancel(): void;
  // Toggle tile-pin mode while target-selecting a `unit_or_tile`
  // ability. No-op otherwise (the UI gates the button on the ability's
  // targeting kind, and the reducer ignores `toggleTileMode` outside
  // target-select).
  toggleTileMode(): void;
  // Forecast payload — populated during target-select / await-confirm
  // when a hovered tile produces a meaningful preview. `null` outside
  // of those states or when no hover target is set.
  readonly forecast: Forecast | null;
  // Last cursor position (screen coords) during a hover. Drives the
  // tooltip's anchor. `null` between hovers.
  readonly cursorScreen: { readonly x: number; readonly y: number } | null;
}

export interface UseTurnFlowArgs {
  readonly state: GameState | null;
  readonly catalog: Catalog;
  readonly renderer: BattleRenderer | null;
  readonly uiController: UiController;
  // The set of teams a human at the keyboard controls. A unit's turn is
  // "ours" (drives the action menu) iff its team is in this set. A set
  // rather than a single id so pass-and-play (both teams human) flows
  // through the same hook: when the active unit's team flips from one
  // human team to the other, `isOurTurn` stays true and the menu rebuilds
  // against the new active unit. AI-controlled teams are absent, so their
  // turns leave the flow idle while the AI controller drives them.
  readonly humanTeams: ReadonlySet<TeamId>;
  readonly confirmStep: ConfirmStepPreference;
  // Optional callback fired when the player clicks a unit on the canvas
  // while in IDLE / action-menu state. Routes to the unit detail panel.
  readonly onInspectUnit?: (unitId: UnitId) => void;
}

export function useTurnFlow(args: UseTurnFlowArgs): TurnFlow {
  const { state, catalog, renderer, uiController, humanTeams, confirmStep, onInspectUnit } = args;
  const [flowState, dispatch] = useReducer(transition, INITIAL_TURN_FLOW);

  // Engine-side derived values.
  const activeUnit = useMemo<Unit | null>(() => {
    if (state === null || state.turnState === null) return null;
    return state.units.get(state.turnState.unitId) ?? null;
  }, [state]);

  const isOurTurn = activeUnit !== null && humanTeams.has(activeUnit.team);

  const movesAvailable = state?.turnState?.budget.movesAvailable ?? 0;
  const actsAvailable = state?.turnState?.budget.actsAvailable ?? 0;
  const waitDisabled = !isOurTurn;

  // Lifecycle: detect active-turn boundaries. `lastWasOurs` retains the
  // prior render's value so we only dispatch on the transitions.
  const lastWasOursRef = useRef<boolean>(false);
  useEffect(() => {
    if (isOurTurn && !lastWasOursRef.current) {
      dispatch({ kind: 'activeTurnStart' });
    } else if (!isOurTurn && lastWasOursRef.current) {
      dispatch({ kind: 'activeTurnEnd' });
      // Drop any orphan queued decision on turn boundary.
      if (uiController.hasPending()) uiController.cancel();
    }
    lastWasOursRef.current = isOurTurn;
  }, [isOurTurn, uiController]);

  // Animation drain: while in `animation`, poll the renderer's idle
  // flag and dispatch `animationEnded` when it goes idle.
  //
  // Session 31.5 polish #7: switched from setInterval(16ms) to
  // requestAnimationFrame. rAF naturally paint-syncs (no over-firing
  // between frames), avoids the ~16ms-but-not-quite-aligned drift of
  // setInterval, and pauses when the tab is hidden — which is the
  // desired behavior here too, because the animator's underlying Pixi
  // ticker is itself rAF-based and is also paused. Polling at the same
  // cadence as the animator's tick keeps the state machine fully
  // responsive when the tab is foregrounded again.
  useEffect(() => {
    if (flowState.kind !== 'animation') return;
    if (renderer === null) return;
    let cancelled = false;
    let raf = 0;
    const poll = (): void => {
      if (cancelled) return;
      if (renderer.isIdle()) {
        dispatch({ kind: 'animationEnded', stillOurTurn: isOurTurn });
        return;
      }
      raf = window.requestAnimationFrame(poll);
    };
    raf = window.requestAnimationFrame(poll);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
    };
  }, [flowState.kind, renderer, isOurTurn]);

  // ===== Loadout-derived data =====

  const activeCommandSets = useMemo<ReadonlyArray<CommandSetId>>(() => {
    if (activeUnit === null) return [];
    const out: CommandSetId[] = [];
    for (const bucketId of ACTIVE_BUCKET_IDS) {
      const entries = activeUnit.loadout.actionBuckets[bucketId] ?? [];
      for (const csId of entries) {
        if (!catalog.hasCommandSet(csId)) continue;
        out.push(csId);
      }
    }
    return out;
  }, [activeUnit, catalog]);

  // Per session 25: Attack lives at the picker level as a peer of the
  // command sets (per Chris's call). It is NOT spliced into each set's
  // ability list — the picker treats free abilities and command sets
  // uniformly via `actEntries`. `abilitiesFor` therefore walks only the
  // command set's own members.
  const abilitiesFor = useMemo(() => {
    return (commandSetId: CommandSetId): ReadonlyArray<ActionMenuAbility> | null => {
      if (activeUnit === null || state === null) return null;
      if (!catalog.hasCommandSet(commandSetId)) return null;
      const cs = catalog.getCommandSet(commandSetId);
      const out: ActionMenuAbility[] = [];
      for (const memberId of cs.members) {
        if (!catalog.hasAbility(memberId)) continue;
        const ability = catalog.getAbility(memberId);
        if (ability.kind !== 'active') continue;
        const disableReason = computeAbilityDisableReason(state, catalog, activeUnit, ability);
        // Per Session 29: precompute effective MP and action speed via
        // the canonical helpers so equipment / status / passive mods
        // shown in the picker match the committed cost.
        const effectiveMpCost = computeMpCost(state, catalog, activeUnit.id, ability.id);
        const effectiveActionSpeed = computeBaseActionSpeed(state, catalog, activeUnit, ability);
        out.push({
          ability,
          disabled: disableReason !== null,
          disableReason,
          effectiveMpCost,
          effectiveActionSpeed,
        });
      }
      return out;
    };
  }, [activeUnit, state, catalog]);

  // Picker entries shown when the player clicks Act. Class-granted free
  // abilities (Attack today) lead, followed by equipped command sets in
  // bucket order. Selecting a free ability skips straight to target-
  // select; selecting a command set drills into its member ability list.
  const actEntries = useMemo<ReadonlyArray<ActEntry>>(() => {
    if (activeUnit === null) return [];
    const out: ActEntry[] = [];
    const cls = catalog.getClass(activeUnit.classState.currentClass);
    if (cls.freeAbilities.has(UNIVERSAL_ATTACK_ID) && catalog.hasAbility(UNIVERSAL_ATTACK_ID)) {
      const attack = catalog.getAbility(UNIVERSAL_ATTACK_ID);
      if (attack.kind === 'active') {
        out.push({ kind: 'free_ability', abilityId: UNIVERSAL_ATTACK_ID });
      }
    }
    for (const csId of activeCommandSets) {
      out.push({ kind: 'command_set', commandSetId: csId });
    }
    return out;
  }, [activeUnit, catalog, activeCommandSets]);

  // ===== Targeting computations =====

  // Legal move destinations when in move-select / move-await-confirm.
  // Kept available in move-await-confirm so the renderer continues to
  // highlight the candidate set behind the confirm gate (visually the
  // player should still see what they would have picked).
  const legalMoveDestinations = useMemo<ReadonlyArray<Position>>(() => {
    if (flowState.kind !== 'move-select' && flowState.kind !== 'move-await-confirm') return [];
    if (state === null || activeUnit === null) return [];
    if (movesAvailable <= 0) return [];
    const result = getLegalMoves(state, activeUnit.id, catalog);
    const positions: Position[] = [];
    for (const path of result.reachable.values()) {
      const dest = path.destination;
      // Skip staying in place — clicking your current tile shouldn't
      // commit a no-op move.
      if (samePosition(dest, activeUnit.position)) continue;
      positions.push(dest);
    }
    return positions;
  }, [flowState.kind, state, activeUnit, movesAvailable, catalog]);

  // Legal targets for the currently-selected ability (target-select /
  // await-confirm). Empty in other states.
  const legalTargetsState = useMemo<LegalTargets>(() => {
    if (flowState.kind !== 'target-select' && flowState.kind !== 'await-confirm') {
      return EMPTY_TARGETS;
    }
    if (state === null || activeUnit === null) return EMPTY_TARGETS;
    if (actsAvailable <= 0) return EMPTY_TARGETS;
    const ability = catalog.getAbility(flowState.abilityId);
    if (ability.kind !== 'active') return EMPTY_TARGETS;
    const tileMode =
      flowState.kind === 'target-select' || flowState.kind === 'await-confirm'
        ? flowState.tileMode
        : false;
    return computeLegalTargets(state, catalog, activeUnit, ability, tileMode);
  }, [flowState, state, activeUnit, actsAvailable, catalog]);

  // AoE footprint for the hovered target (target-select only).
  const aoePreviewPositions = useMemo<ReadonlyArray<Position>>(() => {
    if (flowState.kind !== 'target-select') return [];
    if (flowState.hoverTarget === null) return [];
    if (state === null || activeUnit === null) return [];
    const ability = catalog.getAbility(flowState.abilityId);
    if (ability.kind !== 'active') return [];
    return computeAoeFootprint(state, catalog, activeUnit, ability, flowState.hoverTarget);
  }, [flowState, state, activeUnit, catalog]);

  // ===== Renderer side effects: highlights =====

  useEffect(() => {
    if (renderer === null) return;
    if (flowState.kind === 'move-select' || flowState.kind === 'move-await-confirm') {
      renderer.setHighlights(legalMoveDestinations, 'move');
    } else if (flowState.kind === 'target-select' || flowState.kind === 'await-confirm') {
      // Pick a highlight kind that hints intent: heal-tag → green,
      // otherwise attack-tag red. Mirrors the legacy `use-battle-ui`.
      const ability = catalog.getAbility((flowState as { abilityId: AbilityId }).abilityId);
      const kind = isHealingAbility(ability) ? 'heal' : 'attack';
      renderer.setHighlights(legalTargetsState.positions, kind);
    } else {
      renderer.setHighlights([], 'none');
    }
  }, [renderer, flowState, legalMoveDestinations, legalTargetsState, catalog]);

  // Overlay channel: AoE preview during target-select, single-tile move
  // hover during move-select, locked-destination highlight during move-
  // await-confirm. Reuses the 'aoe' kind (gold) — the visual idiom
  // ("preview overlay on top of the legal-target set") is the same.
  useEffect(() => {
    if (renderer === null) return;
    if (flowState.kind === 'move-select') {
      if (flowState.hoverTarget !== null) {
        // Only show the hover if it's on a legal destination — clicking
        // a non-legal tile cancels, so the hover should not promise a
        // commit that won't happen.
        const isLegal = legalMoveDestinations.some((d) =>
          samePosition(d, flowState.hoverTarget!),
        );
        renderer.setHighlightOverlay(isLegal ? [flowState.hoverTarget] : [], 'aoe');
      } else {
        renderer.setHighlightOverlay([], 'none');
      }
      return;
    }
    if (flowState.kind === 'move-await-confirm') {
      // Pin the chosen destination so the player sees what they're
      // about to commit while the confirm row is up.
      renderer.setHighlightOverlay([flowState.destination], 'aoe');
      return;
    }
    if (aoePreviewPositions.length === 0) {
      renderer.setHighlightOverlay([], 'none');
      return;
    }
    renderer.setHighlightOverlay(aoePreviewPositions, 'aoe');
  }, [renderer, flowState, aoePreviewPositions, legalMoveDestinations]);

  // ===== Renderer side effects: tile click =====

  useEffect(() => {
    if (renderer === null) return;
    const handler = (pos: Position, occupant: Unit | null): void => {
      if (state === null) return;

      // Inspection (open the unit detail panel) is allowed regardless of
      // whose turn it is — and even when *no* turn is active. The latter
      // matters when an AI-vs-AI battle is halted between turns: the
      // scheduler's mid-turn gap leaves `activeUnit` null, but the player
      // still wants to click a unit and inspect it. Checked before the
      // active-unit guard below (which the move/target branches require)
      // so a unit click in idle / action-menu always opens the panel.
      // (S43 pause-inspect fix.)
      if (
        occupant !== null &&
        onInspectUnit !== undefined &&
        (flowState.kind === 'action-menu' || flowState.kind === 'idle')
      ) {
        onInspectUnit(occupant.id);
        return;
      }

      // Move / target picking need an active unit to act with.
      if (activeUnit === null) return;

      if (flowState.kind === 'move-select') {
        const isLegal = legalMoveDestinations.some((d) => samePosition(d, pos));
        if (!isLegal) {
          // Click outside the highlight = cancel back to action-menu.
          dispatch({ kind: 'cancel' });
          return;
        }
        // Always-confirm: transition into move-await-confirm rather
        // than committing directly. The Confirm/Cancel row in the
        // action menu drives the actual commit.
        dispatch({ kind: 'pickMoveDestination', destination: pos });
        return;
      }

      if (flowState.kind === 'target-select') {
        const ability = catalog.getAbility(flowState.abilityId);
        if (ability.kind !== 'active') return;
        // Session 39b: Throw Item's target click goes to the item-
        // picker instead of building a full use_ability action. The
        // target must be an actual unit at the click position; reject
        // empty tiles.
        if (flowState.abilityId === THROW_ITEM_ABILITY_ID) {
          if (occupant === null) {
            dispatch({ kind: 'cancel' });
            return;
          }
          // Confirm the target is in legal range / LoS via the engine.
          const probeAction: ProposedAction = {
            type: 'use_throw_item',
            source: 'player',
            actorId: activeUnit.id,
            payload: {
              // The item is a placeholder for the range/LoS check; the
              // engine will reject if no stockpile entry exists for it.
              // For the click-validity gate we want the range + LoS +
              // removed-target check, which doesn't depend on item.
              // Pick the first item we know exists in the stockpile if
              // any; otherwise use any item id and let validation pass
              // through the non-stockpile gates first.
              itemId: pickAnyStockpileItem(activeUnit) ?? COMPOUND_ABILITY_ID as unknown as import('@engine/index.ts').ItemId,
              target: { kind: 'unit', unitId: occupant.id },
            },
          };
          const v = validateAction(state, probeAction, catalog);
          // If the failure is range / LoS / removed, treat as invalid
          // click and cancel. Stockpile-missing is fine (the player
          // will see the item picker reject it explicitly).
          if (!v.valid && v.reason !== undefined && !/stockpile/i.test(v.reason)) {
            if (import.meta.env.DEV) {
              // eslint-disable-next-line no-console
              console.debug(
                '[targeting] throw_item click cancel',
                `(${pos.x},${pos.y},${pos.layer})`,
                'target=',
                occupant.id,
                '— validate:',
                v.reason,
              );
            }
            dispatch({ kind: 'cancel' });
            return;
          }
          dispatch({ kind: 'pickThrowTarget', targetUnitId: occupant.id });
          return;
        }
        const action = buildAction(activeUnit.id, ability, pos, occupant, flowState.tileMode);
        if (action === null) {
          // Bug 1 instrumentation: clicking a single_unit-targeted
          // ability on a tile with no occupant returns null and cancels.
          // If the player believes there's a unit there, the renderer's
          // hit-test or the engine's `unitAt` is mismatched.
          if (import.meta.env.DEV) {
            // eslint-disable-next-line no-console
            console.debug(
              '[targeting] click cancel — buildAction null',
              `(${pos.x},${pos.y},${pos.layer})`,
              'occupant=',
              occupant?.id ?? 'null',
              'ability=',
              String(flowState.abilityId),
            );
          }
          dispatch({ kind: 'cancel' });
          return;
        }
        if (!canCommitAction(state, catalog, activeUnit, action)) {
          // Re-extract the rejection reason for diagnostics. canCommitAction
          // returns bool only; in the failure path we re-call validateAction
          // (cheap, pure) to surface why.
          if (import.meta.env.DEV) {
            const v = validateAction(state, action, catalog);
            // eslint-disable-next-line no-console
            console.debug(
              '[targeting] click cancel — canCommit false',
              `(${pos.x},${pos.y},${pos.layer})`,
              'target=',
              occupant?.id ?? 'tile',
              'ability=',
              String(flowState.abilityId),
              '— validate:',
              v.valid ? 'OK (blocked by onActionAttempted)' : v.reason ?? '(no reason)',
            );
          }
          dispatch({ kind: 'cancel' });
          return;
        }
        submitTargetedActionInternal(action);
        return;
      }
    };
    renderer.setOnTileClick(handler);
    return () => renderer.setOnTileClick(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderer, flowState, state, activeUnit, legalMoveDestinations, catalog, confirmStep, onInspectUnit]);

  // ===== Renderer side effects: tile hover =====

  // Cursor position in viewport coords — captured via a window-level
  // mousemove listener while we're in target-select (so the tooltip can
  // anchor to it). Cleared on state exit.
  const [cursorScreen, setCursorScreen] = useState<{ x: number; y: number } | null>(null);
  // Persistent cursor-tile state — always reflects the hovered tile so
  // the HUD's tile-info panel (item #1) has a signal regardless of
  // turn-flow state. `null` when off-canvas.
  const [cursorTile, setCursorTile] = useState<Position | null>(null);

  useEffect(() => {
    if (renderer === null) return;
    // Single hover handler that always updates `cursorTile` (for the
    // tile-info panel) and additionally dispatches a state-specific
    // event when in target-select / move-select.
    const handler = (pos: Position | null): void => {
      setCursorTile(pos);
      if (flowState.kind === 'target-select') {
        dispatch({ kind: 'hoverTarget', position: pos });
      } else if (flowState.kind === 'move-select') {
        dispatch({ kind: 'hoverMove', position: pos });
      }
    };
    renderer.setOnTileHover(handler);

    // Cursor-screen tracking only matters for the forecast tooltip
    // anchor — currently exercised in target-select. Other states get
    // the same handler shape but without screen tracking.
    if (flowState.kind === 'target-select') {
      const onMouseMove = (e: MouseEvent): void => {
        setCursorScreen({ x: e.clientX, y: e.clientY });
      };
      window.addEventListener('mousemove', onMouseMove);
      return () => {
        renderer.setOnTileHover(null);
        window.removeEventListener('mousemove', onMouseMove);
      };
    }
    return () => {
      renderer.setOnTileHover(null);
      if (flowState.kind !== 'move-select') setCursorScreen(null);
    };
  }, [renderer, flowState.kind]);

  // ===== Forecast composition =====

  const forecast = useMemo<Forecast | null>(() => {
    if (state === null || activeUnit === null) return null;
    if (flowState.kind !== 'target-select' && flowState.kind !== 'await-confirm') return null;
    const ability = catalog.getAbility(flowState.abilityId);
    if (ability.kind !== 'active') return null;
    const anchor =
      flowState.kind === 'target-select'
        ? flowState.hoverTarget
        : extractAnchorFromAction(flowState.action, state, activeUnit);
    if (anchor === null) return null;
    return composeForecast({
      state,
      catalog,
      caster: activeUnit,
      ability,
      anchor,
    });
  }, [state, catalog, activeUnit, flowState]);

  // ===== Submit helpers =====

  function submitMoveInternal(destination: Position): void {
    // Per session 24.5: move is always-confirm. submitMove transitions
    // to move-await-confirm; the actual uiController.submit happens in
    // confirmAccept when the player accepts the Confirm row. External
    // callers (tests / future automation) get the same behavior as the
    // tile-click handler.
    if (activeUnit === null) return;
    dispatch({ kind: 'pickMoveDestination', destination });
  }

  function submitWaitInternal(facing: import('@engine/index.ts').Direction): void {
    if (activeUnit === null) return;
    if (uiController.hasPending()) return;
    // If the chosen facing differs from the current facing, submit a
    // set_facing action first so the change is recorded on the action
    // log (turn-end alone doesn't carry facing).
    if (facing !== activeUnit.facing) {
      uiController.submit({
        type: 'set_facing',
        source: 'player',
        actorId: activeUnit.id,
        payload: { facing },
      });
    }
    uiController.endTurn();
    dispatch({ kind: 'commitWait', facing });
  }

  function submitTargetedActionInternal(action: ProposedAction): void {
    const willConfirm = confirmStep === 'confirm';
    if (willConfirm) {
      // Transition to await-confirm; defer the controller submit until
      // the player accepts.
      dispatch({ kind: 'commitTarget', action, confirmStep: true });
      return;
    }
    if (uiController.hasPending()) return;
    uiController.submit(action);
    dispatch({ kind: 'commitTarget', action, confirmStep: false });
  }

  // Session 39b: item pick from compound-item-select /
  // throw-item-item-select. No await-confirm path — the item picker
  // is the confirm surface (the player explicitly clicked the item
  // with cost + count visible).
  function submitItemPickInternal(action: ProposedAction): void {
    if (uiController.hasPending()) return;
    uiController.submit(action);
    dispatch({ kind: 'pickItem', action });
  }

  function confirmAcceptInternal(): void {
    if (uiController.hasPending()) return;
    if (flowState.kind === 'await-confirm') {
      uiController.submit(flowState.action);
      dispatch({ kind: 'confirmAccept' });
      return;
    }
    if (flowState.kind === 'move-await-confirm') {
      if (activeUnit === null) return;
      const action: ProposedAction = {
        type: 'move',
        source: 'player',
        actorId: activeUnit.id,
        payload: { destination: flowState.destination },
      };
      uiController.submit(action);
      dispatch({ kind: 'confirmAccept' });
      return;
    }
  }

  return {
    state: flowState,
    activeUnit,
    isOurTurn,
    dispatch,
    activeCommandSets,
    actEntries,
    abilitiesFor,
    movesAvailable,
    actsAvailable,
    waitDisabled,
    submitMove: submitMoveInternal,
    submitWait: submitWaitInternal,
    submitTargetedAction: submitTargetedActionInternal,
    submitItemPick: submitItemPickInternal,
    confirmAccept: confirmAcceptInternal,
    cancel: () => dispatch({ kind: 'cancel' }),
    toggleTileMode: () => dispatch({ kind: 'toggleTileMode' }),
    forecast,
    cursorScreen,
    cursorTile,
  };
}

// Extract the anchor position from a ProposedAction for await-confirm
// forecast re-composition. `self` returns the caster's position; `tile`
// returns the tile; `unit` returns the targeted unit's position.
function extractAnchorFromAction(
  action: ProposedAction,
  state: GameState,
  caster: Unit,
): Position | null {
  if (action.type !== 'use_ability') return null;
  const target = action.payload.target;
  if (target.kind === 'tile') return target.position;
  if (target.kind === 'unit') {
    const u = state.units.get(target.unitId);
    return u?.position ?? null;
  }
  if (target.kind === 'self') return caster.position;
  return null;
}

// =====================
// Helpers
// =====================

interface LegalTargets {
  readonly positions: ReadonlyArray<Position>;
  readonly unitIds: ReadonlySet<UnitId>;
  readonly tilePositions: ReadonlySet<string>; // positionKeys
}

const EMPTY_TARGETS: LegalTargets = {
  positions: [],
  unitIds: new Set(),
  tilePositions: new Set(),
};

function samePosition(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y && a.layer === b.layer;
}

// Session 39b: returns any item id present in the unit's stockpile
// with count > 0, or null when the stockpile is empty. Used by the
// throw-item click handler to construct a probe action for the
// range / LoS / removed-target validity check — the actual item
// will be picked next in the item-select state.
function pickAnyStockpileItem(unit: Unit): import('@engine/index.ts').ItemId | null {
  for (const [id, count] of unit.stockpile) {
    if (count > 0) return id;
  }
  return null;
}

function isHealingAbility(ability: ActiveAbilityDefinition | { kind: string }): boolean {
  if (ability.kind !== 'active') return false;
  const dmg = (ability as ActiveAbilityDefinition).effects.damage;
  return dmg !== undefined && dmg.tags.includes('healing');
}

function computeAbilityDisableReason(
  state: GameState,
  catalog: Catalog,
  actor: Unit,
  ability: ActiveAbilityDefinition,
): string | null {
  if (state.turnState === null || state.turnState.budget.actsAvailable <= 0) {
    return 'No Act budget remaining';
  }
  const mpCost = computeMpCost(state, catalog, actor.id, ability.id);
  if (actor.vitals.mp < mpCost) {
    return `Insufficient MP — need ${mpCost}, have ${actor.vitals.mp}`;
  }
  // We don't run runOnActionAttempted here because we'd need a concrete
  // ProposedAction (with a chosen target). The per-ability disable
  // surfaces budget + MP; status-driven blocks (Silence) show up when
  // the player picks a target and the commit pre-flight rejects.
  return null;
}

// Single-unit/tile/self/unit-or-tile target enumeration. Loops candidate
// units/tiles in range and probes validateAction; collects the legals
// for the renderer + a Set for O(1) click-side checking.
//
// `tileMode` only affects `unit_or_tile` abilities. When false (the
// FFT-default), behaves like `single_unit` (only units in range are
// legal). When true, behaves like `tile` (every reachable tile in range
// is legal, occupant or not — the player pinned the location, not the
// resident). `tileMode` is ignored for the other three targeting kinds.
function computeLegalTargets(
  state: GameState,
  catalog: Catalog,
  actor: Unit,
  ability: ActiveAbilityDefinition,
  tileMode: boolean,
): LegalTargets {
  const positions: Position[] = [];
  const unitIds = new Set<UnitId>();
  const tileKeys = new Set<string>();

  if (ability.targeting.kind === 'self') {
    positions.push(actor.position);
    unitIds.add(actor.id);
    tileKeys.add(positionKey(actor.position));
    return { positions, unitIds, tilePositions: tileKeys };
  }

  // unit_or_tile + tileMode === true: behave as tile targeting from here
  // (enumerate all in-range tiles, occupied or not).
  const treatAsTile =
    ability.targeting.kind === 'tile' ||
    (ability.targeting.kind === 'unit_or_tile' && tileMode);
  const treatAsUnit =
    ability.targeting.kind === 'single_unit' ||
    (ability.targeting.kind === 'unit_or_tile' && !tileMode);

  if (treatAsUnit) {
    for (const candidate of state.units.values()) {
      if (candidate.vitals.hp <= 0) continue;
      const proposed: ProposedAction = {
        type: 'use_ability',
        source: 'player',
        actorId: actor.id,
        payload: {
          abilityId: ability.id,
          target: { kind: 'unit', unitId: candidate.id },
        },
      };
      const result = validateAction(state, proposed, catalog);
      if (!result.valid) {
        // Bug 1 instrumentation (Session 24.5): record per-candidate
        // rejection reasons so the next playtest occurrence of "this
        // specific enemy can't be targeted but others can" produces
        // diagnostic output. See `docs/decisions/0046-bug-1-targeting-
        // hypothesis.md`. Dev-only — production builds get nothing.
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.debug(
            '[targeting] reject',
            String(ability.id),
            'on',
            String(candidate.id),
            `(${candidate.position.x},${candidate.position.y})`,
            '—',
            result.reason ?? '(no reason given)',
          );
        }
        continue;
      }
      positions.push(candidate.position);
      unitIds.add(candidate.id);
    }
    return { positions, unitIds, tilePositions: tileKeys };
  }

  // Defensive: if neither branch claimed the ability kind, fall through
  // to tile enumeration. `unit_or_tile` + tileMode lands here.
  if (!treatAsTile) return { positions, unitIds, tilePositions: tileKeys };

  // tile-targeted. Use effective range (post-`modifyAbilityRange`) so the
  // candidate window the picker scans matches what `validateAction` will
  // accept downstream.
  const range = computeAbilityRange(state, catalog, actor.id, ability).horizontal;
  for (let dy = -range; dy <= range; dy++) {
    for (let dx = -range; dx <= range; dx++) {
      const tx = actor.position.x + dx;
      const ty = actor.position.y + dy;
      if (tx < 0 || ty < 0 || tx >= state.map.width || ty >= state.map.height) continue;
      const tile = tileAt(state.map, tx, ty, 0);
      if (tile === undefined) continue;
      const pos: Position = { x: tx, y: ty, layer: 0 };
      const proposed: ProposedAction = {
        type: 'use_ability',
        source: 'player',
        actorId: actor.id,
        payload: { abilityId: ability.id, target: { kind: 'tile', position: pos } },
      };
      if (!validateAction(state, proposed, catalog).valid) continue;
      positions.push(pos);
      tileKeys.add(positionKey(pos));
    }
  }
  return { positions, unitIds, tilePositions: tileKeys };
}

function computeAoeFootprint(
  state: GameState,
  catalog: Catalog,
  actor: Unit,
  ability: ActiveAbilityDefinition,
  hoverTarget: Position,
): ReadonlyArray<Position> {
  const aoe = ability.effects.aoe;
  if (aoe === undefined) {
    // Non-AoE — overlay just the hovered target tile so single-target
    // aiming gets a "this is the locked-in target" highlight.
    return [hoverTarget];
  }
  const tiles = resolveAoeTiles(state, catalog, actor, hoverTarget, ability, aoe);
  return tiles.map((t) => ({ x: t.x, y: t.y, layer: t.layer }));
}

// Mirror of the AI's aoeTilesAffected: caster-anchored cone/line use
// `cardinalFromTo(source, anchor)`; target-anchored shapes use the
// anchor tile directly.
//
// Post-S38 fix (2026-05-17): apply `runModifyAoeShape` against the
// caster's hooks so Aether Bloom (and any future shape-modifier
// passive) grows the target-select overlay to match the actual cast
// footprint. Previously the overlay rendered the base shape while the
// engine resolved with the modified shape — the player saw a small
// diamond for Fire Storm with Aether Bloom equipped.
function resolveAoeTiles(
  state: GameState,
  catalog: Catalog,
  actor: Unit,
  anchor: Position,
  ability: ActiveAbilityDefinition,
  aoe: AoeSpec,
) {
  const source = actor.position;
  const ruleset = catalog.getRuleset(state.ruleset.id);
  const baseVerticalTolerance =
    aoe.verticalTolerance ?? ruleset.rangeDefaults.aoeVerticalTolerance;
  const verticalTolerance = runModifyAoeVerticalTolerance(state, catalog, {
    unit: actor,
    ability,
    baseValue: baseVerticalTolerance,
  });
  const finalShape = runModifyAoeShape(state, catalog, {
    unit: actor,
    ability,
    baseShape: aoe.shape,
  });

  if (finalShape.kind === 'cone' || finalShape.kind === 'line') {
    if (samePosition(source, anchor)) return [];
    const sourceTile = tileAt(state.map, source.x, source.y, source.layer);
    if (sourceTile === undefined) return [];
    const direction = cardinalFromTo(source, anchor);
    return aoeFootprint({
      map: state.map,
      shape: finalShape,
      anchor: { x: source.x, y: source.y, elevation: sourceTile.elevation },
      verticalTolerance,
      direction,
    });
  }
  const anchorTile = tileAt(state.map, anchor.x, anchor.y, anchor.layer);
  if (anchorTile === undefined) return [];
  return aoeFootprint({
    map: state.map,
    shape: finalShape,
    anchor: { x: anchor.x, y: anchor.y, elevation: anchorTile.elevation },
    verticalTolerance,
  });
}

// Build the ProposedAction for the clicked tile/unit, based on the
// ability's targeting kind. Returns null when the click doesn't match
// the targeting shape (single_unit click but no occupant, etc.).
function buildAction(
  actorId: UnitId,
  ability: ActiveAbilityDefinition,
  pos: Position,
  occupant: Unit | null,
  tileMode: boolean,
): ProposedAction | null {
  if (ability.targeting.kind === 'self') {
    return {
      type: 'use_ability',
      source: 'player',
      actorId,
      payload: { abilityId: ability.id, target: { kind: 'self' } },
    };
  }
  if (ability.targeting.kind === 'single_unit') {
    if (occupant === null) return null;
    return {
      type: 'use_ability',
      source: 'player',
      actorId,
      payload: { abilityId: ability.id, target: { kind: 'unit', unitId: occupant.id } },
    };
  }
  if (ability.targeting.kind === 'unit_or_tile') {
    // tileMode forces tile payload regardless of occupant. unit-mode
    // pins the occupant when present; absent occupant → null (no unit
    // to pin, and tileMode was off, so the click is a no-op).
    if (tileMode) {
      return {
        type: 'use_ability',
        source: 'player',
        actorId,
        payload: { abilityId: ability.id, target: { kind: 'tile', position: pos } },
      };
    }
    if (occupant === null) return null;
    return {
      type: 'use_ability',
      source: 'player',
      actorId,
      payload: { abilityId: ability.id, target: { kind: 'unit', unitId: occupant.id } },
    };
  }
  // tile
  return {
    type: 'use_ability',
    source: 'player',
    actorId,
    payload: { abilityId: ability.id, target: { kind: 'tile', position: pos } },
  };
}

