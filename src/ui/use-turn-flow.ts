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
  effectiveController,
  enumerateMathSkillTargets,
  getLegalMoves,
  maxRangeFromHeightBonus,
  positionKey,
  runModifyAoeShape,
  runModifyAoeVerticalTolerance,
  tileAt,
  validateAction,
  weaponAttackAoeSpec,
  weaponRangeFromHeightSpec,
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

// Session 49: Math Skill abilities route via the new
// `math-skill-target-select` picker. Detected by `targeting.kind`
// rather than by ability id (the route applies to every Math Skill
// ability, present and future). The caller passes the catalog +
// ability id; we look up the ability and inspect its targeting.
export function abilityRoute(
  abilityIdValue: AbilityId,
  catalog?: Catalog,
): 'compound' | 'throw_item' | 'math_skill' | 'tile_set' | 'grapple_throw' | undefined {
  if (abilityIdValue === COMPOUND_ABILITY_ID) return 'compound';
  if (abilityIdValue === THROW_ITEM_ABILITY_ID) return 'throw_item';
  if (catalog !== undefined && catalog.hasAbility(abilityIdValue)) {
    const ability = catalog.getAbility(abilityIdValue);
    if (ability.kind === 'active') {
      // Session 49: Math Skill → parameter/value picker. Session 55:
      // tile_set (Worldcraft Barrier) → anchor → extent line picker.
      if (ability.targeting.kind === 'math_skill') return 'math_skill';
      if (ability.targeting.kind === 'tile_set') return 'tile_set';
      // Session 76: grapple_throw (Bear's Heave) → throwee → destination picker.
      if (ability.targeting.kind === 'grapple_throw') return 'grapple_throw';
    }
  }
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

// Whether a targeted-action submit should defer through await-confirm
// (the player explicitly accepts before the action commits) or go
// straight to the controller. Math Skill always submits directly — its
// picker UI (parameter + value + matched-unit preview) is itself the
// confirmation surface, mirroring the item pickers per S39b. The FSM
// reducer's math-skill-target-select branch on commitTarget already
// transitions straight to animation without await-confirm; this helper
// keeps the submit path aligned with that, otherwise the action is
// dropped and the cast vanishes (S50 bug fix).
//
// Session 55: tile_set (Worldcraft Barrier) submits directly for the same
// reason — its tile-set-target-select picker (anchor + previewed line) is the
// confirm surface, and that FSM branch also transitions straight to animation.
// Without this, a `confirmStep: 'confirm'` setting would dispatch commitTarget
// but never call uiController.submit — the same drop the S50 fix addressed.
export function shouldDeferToConfirm(
  action: ProposedAction,
  confirmStep: ConfirmStepPreference,
): boolean {
  if (
    action.type === 'use_ability' &&
    (action.payload.target.kind === 'math_skill' ||
      action.payload.target.kind === 'tile_set' ||
      // Session 76: the grapple-throw picker (throwee + destination) is itself
      // the confirm surface, like tile_set / Math Skill.
      action.payload.target.kind === 'grapple_throw')
  ) {
    return false;
  }
  return confirmStep === 'confirm';
}

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
  // Session 49: Math Skill picker helpers. `pickMathSkillParameter`
  // sets parameter and clears value; `pickMathSkillValue` is a no-op
  // when no parameter is yet selected. The Cast affordance commits via
  // `submitTargetedAction` once both picks are non-null.
  pickMathSkillParameter(parameter: import('@engine/index.ts').MathSkillParameter): void;
  pickMathSkillValue(value: import('@engine/index.ts').MathSkillValue): void;
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

  // Key "is it our turn" off the EFFECTIVE controller, not the unit's raw
  // team: a unit charmed by the human (Steal Heart's control-override) acts
  // for the human this turn even though its `team` is still the enemy's, and
  // a human unit charmed by the AI acts for the AI. The orchestrator already
  // routes the turn via `effectiveController`; this keeps the action menu in
  // lockstep so control doesn't soft-lock (engine waits on input the team-
  // gated UI never offered). Reverts automatically when the charm ends.
  const isOurTurn =
    activeUnit !== null && humanTeams.has(effectiveController(activeUnit, catalog));

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
    if (state === null || activeUnit === null) return [];
    const ability = catalog.getAbility(flowState.abilityId);
    if (ability.kind !== 'active') return [];
    // S76: a self-targeting AoE (the Monk's Chakra) is ALWAYS centered on the
    // caster — lock the preview to the caster's tile rather than letting it
    // follow the cursor (which read as "pick a tile to center on"). The
    // committed target is `{ kind: 'self' }` regardless of where the player
    // clicks, so the engine already centers on the caster; this aligns the
    // preview with that truth and shows immediately (no hover required).
    if (ability.targeting.kind === 'self') {
      return computeAoeFootprint(state, catalog, activeUnit, ability, activeUnit.position);
    }
    if (flowState.hoverTarget === null) return [];
    return computeAoeFootprint(state, catalog, activeUnit, ability, flowState.hoverTarget);
  }, [flowState, state, activeUnit, catalog]);

  // Session 55: Worldcraft elevation-kernel preview (Pillar/Pit single tile,
  // Hill/Valley 3×3) for the hovered target tile. Returns the authored per-
  // tile deltas for in-bounds kernel offsets — a "what this ability does to
  // the area" preview (off-map offsets are dropped; the empty-cast guard
  // still rejects an all-no-op cast at commit). Empty outside an elevation
  // Worldcraft cast.
  const worldcraftKernelPreview = useMemo<ReadonlyArray<{ position: Position; delta: number }>>(() => {
    if (flowState.kind !== 'target-select') return [];
    if (flowState.hoverTarget === null) return [];
    if (state === null || activeUnit === null) return [];
    const ability = catalog.getAbility(flowState.abilityId);
    if (ability.kind !== 'active') return [];
    const wc = ability.effects.worldcraft;
    if (wc === undefined || wc.kind !== 'elevation') return [];
    return elevationKernelCells(state.map.width, state.map.height, wc.deltas, flowState.hoverTarget);
  }, [flowState, state, activeUnit, catalog]);

  // Session 55: tile_set (Barrier) targeting candidates. Anchor phase exposes
  // the valid anchor tiles; extent phase exposes the valid far-end → line map
  // (keyed by far-end position key) for the highlight, hover preview, and
  // click commit. Null outside the tile-set picker.
  const tileSetTargeting = useMemo<
    | { readonly phase: 'anchor'; readonly anchors: ReadonlyArray<Position>; readonly lines: ReadonlyMap<string, Position[]> }
    | { readonly phase: 'extent'; readonly anchors: ReadonlyArray<Position>; readonly lines: ReadonlyMap<string, Position[]> }
    | null
  >(() => {
    if (flowState.kind !== 'tile-set-target-select') return null;
    if (state === null || activeUnit === null) return null;
    if (actsAvailable <= 0) return null;
    const ability = catalog.getAbility(flowState.abilityId);
    if (ability.kind !== 'active' || ability.targeting.kind !== 'tile_set') return null;
    if (flowState.anchor === null) {
      return { phase: 'anchor', anchors: validTileSetAnchors(state, catalog, activeUnit, ability), lines: new Map() };
    }
    return {
      phase: 'extent',
      anchors: [],
      lines: validTileSetLinesFrom(state, catalog, activeUnit, ability, flowState.anchor),
    };
  }, [flowState, state, activeUnit, actsAvailable, catalog]);

  // Session 76: grapple-throw (Bear's Heave) candidates. Throwee phase exposes
  // the units in grab range; destination phase exposes the legal destination
  // tiles for the chosen throwee. Null outside the grapple-throw picker.
  const grappleTargeting = useMemo<
    | { readonly phase: 'throwee'; readonly throwees: ReadonlyArray<Position>; readonly destinations: ReadonlyArray<Position> }
    | { readonly phase: 'destination'; readonly throwees: ReadonlyArray<Position>; readonly destinations: ReadonlyArray<Position> }
    | null
  >(() => {
    if (flowState.kind !== 'grapple-throw-target-select') return null;
    if (state === null || activeUnit === null) return null;
    if (actsAvailable <= 0) return null;
    const ability = catalog.getAbility(flowState.abilityId);
    if (ability.kind !== 'active' || ability.targeting.kind !== 'grapple_throw') return null;
    if (flowState.throweeId === null) {
      return { phase: 'throwee', throwees: validGrappleThrowees(state, catalog, activeUnit, ability), destinations: [] };
    }
    return {
      phase: 'destination',
      throwees: [],
      destinations: validGrappleDestinations(state, catalog, activeUnit, ability, flowState.throweeId),
    };
  }, [flowState, state, activeUnit, actsAvailable, catalog]);

  // ===== Renderer side effects: highlights =====

  useEffect(() => {
    if (renderer === null) return;
    if (flowState.kind === 'move-select' || flowState.kind === 'move-await-confirm') {
      renderer.setHighlights(legalMoveDestinations, 'move');
    } else if (flowState.kind === 'target-select' || flowState.kind === 'await-confirm') {
      // S75: tint by polarity — beneficial (heal / revive / buff) → green,
      // offensive (damage / debuff) → magenta, pure utility → amber. Replaces
      // the old binary heal-green / else-red, so a buff cast on allies no
      // longer reads as a hostile aim.
      const ability = catalog.getAbility((flowState as { abilityId: AbilityId }).abilityId);
      const kind = ability.kind === 'active' ? targetHighlightKind(ability, catalog) : 'attack';
      renderer.setHighlights(legalTargetsState.positions, kind);
    } else if (flowState.kind === 'math-skill-target-select') {
      // Session 49: Math Skill preview. When both parameter and value
      // are picked, paint the matched-unit positions with the heal /
      // attack tint hinting the ability's polarity (heal abilities use
      // green; damage / CT-push / buffs use red, since "would-be-hit"
      // is the universal read of the preview overlay regardless of
      // benefit direction). Empty highlights when either pick is null.
      if (flowState.parameter !== null && flowState.value !== null && state !== null) {
        const matched = enumerateMathSkillTargets(state, flowState.parameter, flowState.value);
        const ability = catalog.getAbility(flowState.abilityId);
        // S71 #12: damage / CT-push / buff Math Skills paint the matched
        // tiles with the neutral 'target' amber rather than 'attack' red.
        // Math Skill is formula-matched and can land on your own units —
        // red there read as Red Team allegiance. Heal stays green.
        const kind = isHealingAbility(ability) ? 'heal' : 'target';
        renderer.setHighlights(
          matched.map((u) => u.position),
          kind,
        );
      } else {
        renderer.setHighlights([], 'none');
      }
    } else if (flowState.kind === 'tile-set-target-select') {
      // Session 55: Barrier line picker. Anchor phase paints the tiles a line
      // can start from; extent phase paints the anchor + every valid far-end
      // (the line itself previews via the overlay channel on hover). S71 #12:
      // the neutral 'target' amber — Barrier is neither a heal nor a damage
      // cast and lands on terrain, so the old 'attack' red wrongly read as
      // Red Team aim.
      if (tileSetTargeting === null) {
        renderer.setHighlights([], 'none');
      } else if (tileSetTargeting.phase === 'anchor') {
        renderer.setHighlights(tileSetTargeting.anchors, 'target');
      } else {
        const farEnds: Position[] = [];
        for (const line of tileSetTargeting.lines.values()) {
          farEnds.push(line[line.length - 1]!);
        }
        const anchor = flowState.anchor;
        renderer.setHighlights(anchor !== null ? [anchor, ...farEnds] : farEnds, 'target');
      }
    } else if (flowState.kind === 'grapple-throw-target-select') {
      // Session 76: Bear's Heave. Throwee phase paints the grabbable units
      // (magenta 'attack' — you're picking who to seize); destination phase
      // paints the legal landing tiles (neutral 'target' amber — placement,
      // not an attack).
      if (grappleTargeting === null) {
        renderer.setHighlights([], 'none');
      } else if (grappleTargeting.phase === 'throwee') {
        renderer.setHighlights(grappleTargeting.throwees, 'attack');
      } else {
        renderer.setHighlights(grappleTargeting.destinations, 'target');
      }
    } else {
      renderer.setHighlights([], 'none');
    }
  }, [renderer, flowState, legalMoveDestinations, legalTargetsState, tileSetTargeting, grappleTargeting, catalog, state]);

  // Overlay channel: AoE preview during target-select, single-tile move
  // hover during move-select, locked-destination highlight during move-
  // await-confirm. Reuses the 'aoe' kind (gold) — the visual idiom
  // ("preview overlay on top of the legal-target set") is the same.
  useEffect(() => {
    if (renderer === null) return;
    // Session 55: the Worldcraft elevation-kernel preview owns its own channel
    // (per-tile tint + numeric label). Drawing it (or clearing it, when empty)
    // first; when it's active it replaces the plain single-tile overlay an
    // elevation cast would otherwise paint.
    renderer.setKernelOverlay(worldcraftKernelPreview);
    if (worldcraftKernelPreview.length > 0) {
      renderer.setHighlightOverlay([], 'none');
      return;
    }
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
    if (flowState.kind === 'tile-set-target-select') {
      // Session 55. Anchor phase: accent the hovered tile when it's a valid
      // anchor (a cursor-follow highlight, parallel to move-select / the AoE
      // hover) so hovering reads as responsive. Extent phase: preview the full
      // candidate line the hovered far-end would commit.
      if (tileSetTargeting?.phase === 'anchor') {
        const h = flowState.hoverTarget;
        const onAnchor = h !== null && tileSetTargeting.anchors.some((a) => samePosition(a, h));
        renderer.setHighlightOverlay(onAnchor ? [h] : [], onAnchor ? 'aoe' : 'none');
        return;
      }
      const line =
        tileSetTargeting?.phase === 'extent' && flowState.hoverTarget !== null
          ? tileSetTargeting.lines.get(positionKey(flowState.hoverTarget))
          : undefined;
      renderer.setHighlightOverlay(line ?? [], line !== undefined ? 'aoe' : 'none');
      return;
    }
    if (flowState.kind === 'grapple-throw-target-select') {
      // Session 76: accent the hovered tile when it's a valid throwee (phase 1)
      // or a valid destination (phase 2) — a cursor-follow highlight parallel to
      // move-select / the tile_set anchor hover, so travelling over eligible
      // tiles reads as responsive.
      const h = flowState.hoverTarget;
      const candidates =
        grappleTargeting?.phase === 'throwee'
          ? grappleTargeting.throwees
          : grappleTargeting?.phase === 'destination'
            ? grappleTargeting.destinations
            : [];
      const onCandidate = h !== null && candidates.some((p) => samePosition(p, h));
      renderer.setHighlightOverlay(onCandidate ? [h] : [], onCandidate ? 'aoe' : 'none');
      return;
    }
    if (aoePreviewPositions.length === 0) {
      renderer.setHighlightOverlay([], 'none');
      return;
    }
    renderer.setHighlightOverlay(aoePreviewPositions, 'aoe');
  }, [renderer, flowState, aoePreviewPositions, worldcraftKernelPreview, tileSetTargeting, grappleTargeting, legalMoveDestinations]);

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
          // The throw flow picks the target first, item second — so a
          // target is legal iff AT LEAST ONE stocked consumable can be
          // thrown at it (range/arc + the item's own gates, e.g. Phoenix
          // Down needs a KO'd target). Shared with the highlight via
          // `hasThrowableItemAt` so the two never disagree. The old code
          // probed a single *arbitrary* stocked item, which silently
          // cancelled the click when that item was incompatible (S71).
          if (!hasThrowableItemAt(state, catalog, activeUnit, occupant.id)) {
            if (import.meta.env.DEV) {
              // eslint-disable-next-line no-console
              console.debug(
                '[targeting] throw_item click cancel — no stocked item is throwable at',
                occupant.id,
                `(${pos.x},${pos.y},${pos.layer})`,
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

      if (flowState.kind === 'tile-set-target-select') {
        const ability = catalog.getAbility(flowState.abilityId);
        if (ability.kind !== 'active' || ability.targeting.kind !== 'tile_set') return;
        if (flowState.anchor === null) {
          // Anchor phase: only a tile a barrier line can start from is a valid
          // first click. Anything else cancels out (matches target-select's
          // click-outside-the-highlight behavior).
          const validAnchor =
            tileSetTargeting?.phase === 'anchor' &&
            tileSetTargeting.anchors.some((a) => samePosition(a, pos));
          if (!validAnchor) {
            dispatch({ kind: 'cancel' });
            return;
          }
          dispatch({ kind: 'pickTileSetAnchor', anchor: pos });
          return;
        }
        // Extent phase: a valid far-end commits the line; any other click
        // cancels back to anchor re-pick (the two-stage cancel clears the
        // anchor) so the player can re-aim without leaving the picker.
        const line =
          tileSetTargeting?.phase === 'extent'
            ? tileSetTargeting.lines.get(positionKey(pos))
            : undefined;
        if (line !== undefined) {
          const action = tileSetAction(activeUnit.id, ability.id, line);
          if (canCommitAction(state, catalog, activeUnit, action)) {
            submitTargetedActionInternal(action);
            return;
          }
        }
        dispatch({ kind: 'cancel' });
        return;
      }

      if (flowState.kind === 'grapple-throw-target-select') {
        const ability = catalog.getAbility(flowState.abilityId);
        if (ability.kind !== 'active' || ability.targeting.kind !== 'grapple_throw') return;
        if (flowState.throweeId === null) {
          // Throwee phase: clicking a highlighted unit grabs it. Anything else
          // cancels out (matches the target-select click-outside behavior).
          const isThrowee =
            occupant !== null &&
            grappleTargeting?.phase === 'throwee' &&
            grappleTargeting.throwees.some((p) => samePosition(p, pos));
          if (!isThrowee || occupant === null) {
            dispatch({ kind: 'cancel' });
            return;
          }
          dispatch({ kind: 'pickGrappleThrowee', throweeId: occupant.id });
          return;
        }
        // Destination phase: a legal landing tile commits the throw; any other
        // click cancels back to throwee re-pick (the two-stage cancel).
        const isDest =
          grappleTargeting?.phase === 'destination' &&
          grappleTargeting.destinations.some((p) => samePosition(p, pos));
        if (isDest) {
          const action = grappleThrowAction(activeUnit.id, ability.id, flowState.throweeId, pos);
          if (canCommitAction(state, catalog, activeUnit, action)) {
            submitTargetedActionInternal(action);
            return;
          }
        }
        dispatch({ kind: 'cancel' });
        return;
      }
    };
    renderer.setOnTileClick(handler);
    return () => renderer.setOnTileClick(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderer, flowState, state, activeUnit, legalMoveDestinations, tileSetTargeting, grappleTargeting, catalog, confirmStep, onInspectUnit]);

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
      if (
        flowState.kind === 'target-select' ||
        flowState.kind === 'tile-set-target-select' ||
        flowState.kind === 'grapple-throw-target-select'
      ) {
        // Session 55/76: tile-set / grapple-throw reuse `hoverTarget` for their
        // hover overlays.
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
    const willConfirm = shouldDeferToConfirm(action, confirmStep);
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
    pickMathSkillParameter: (parameter) => dispatch({ kind: 'pickMathSkillParameter', parameter }),
    pickMathSkillValue: (value) => dispatch({ kind: 'pickMathSkillValue', value }),
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

// Total consumables the unit currently holds across all stockpile entries.
// Gates Throw Item's availability (nothing stocked → nothing to throw).
function stockpileTotal(unit: Unit): number {
  let total = 0;
  for (const count of unit.stockpile.values()) total += count;
  return total;
}

// True iff at least one stocked consumable can legally be thrown at the
// target. The throw flow picks the target first, item second, so a target
// is legal when *some* held item validates against it (range/arc + the
// item's own gates — e.g. Phoenix Down needs a KO'd target). Shared by the
// target highlight (`computeLegalTargets`) and the target-click handler so
// the two never disagree — including for KO'd-but-not-removed allies, who
// the generic single-target highlight excludes but Phoenix Down revives.
export function hasThrowableItemAt(
  state: GameState,
  catalog: Catalog,
  actor: Unit,
  targetUnitId: UnitId,
): boolean {
  for (const [stockId, count] of actor.stockpile) {
    if (count <= 0) continue;
    const probe: ProposedAction = {
      type: 'use_throw_item',
      source: 'player',
      actorId: actor.id,
      payload: { itemId: stockId, target: { kind: 'unit', unitId: targetUnitId } },
    };
    if (validateAction(state, probe, catalog).valid) return true;
  }
  return false;
}

// S55: append every in-range Barrier tile the given (damaging) ability can
// legally hit to the target set. A barrier sits on an unoccupied tile, so the
// unit enumeration above never surfaces it; the engine accepts a `tile` target
// on a barrier tile (routing to system_barrier_damage) for any damaging
// ability, so a basic Attack / single-target spell can break a wall. No-op for
// non-damaging abilities and maps with no barriers.
function addBarrierTargets(
  state: GameState,
  catalog: Catalog,
  actor: Unit,
  ability: ActiveAbilityDefinition,
  positions: Position[],
  tileKeys: Set<string>,
): void {
  if (ability.effects.damage === undefined) return;
  for (const tile of state.map.tiles) {
    if (tile.barrier === undefined) continue;
    const pos: Position = { x: tile.x, y: tile.y, layer: tile.layer };
    const key = positionKey(pos);
    if (tileKeys.has(key)) continue;
    const proposed: ProposedAction = {
      type: 'use_ability',
      source: 'player',
      actorId: actor.id,
      payload: { abilityId: ability.id, target: { kind: 'tile', position: pos } },
    };
    if (!validateAction(state, proposed, catalog).valid) continue;
    positions.push(pos);
    tileKeys.add(key);
  }
}

function isHealingAbility(ability: ActiveAbilityDefinition | { kind: string }): boolean {
  if (ability.kind !== 'active') return false;
  const dmg = (ability as ActiveAbilityDefinition).effects.damage;
  return dmg !== undefined && dmg.tags.includes('healing');
}

// S75: choose the target-highlight tint from the ability's *polarity*
// rather than the old binary "healing → green, else red". Three buckets:
//   - beneficial (heal / revive / pure buff) → 'heal' (green)
//   - offensive  (damage / debuff)           → 'attack' (magenta)
//   - neutral    (pure utility: CT nudges, knockback, terrain, unknown) →
//     'target' (amber)
// This fixes a buff cast on allies reading as a hostile aim, and pairs with
// the recolored 'attack' tint (no longer Team-B red). Buff/debuff polarity
// is read from each applied status's `aiHints.polarity`; an unspecified
// polarity counts as non-buff (the safe, hostile-leaning default).
export function targetHighlightKind(
  ability: ActiveAbilityDefinition,
  catalog: Catalog,
): 'heal' | 'attack' | 'target' {
  const effects = ability.effects;
  if (isHealingAbility(ability) || effects.removeKO === true) return 'heal';
  // Non-healing damage (isHealingAbility already claimed the healing case).
  if (effects.damage !== undefined) return 'attack';
  const specs = effects.statusEffects ?? [];
  if (specs.length > 0) {
    let anyBuff = false;
    let anyNonBuff = false;
    for (const spec of specs) {
      const polarity = catalog.hasStatusType(spec.typeId)
        ? catalog.getStatusType(spec.typeId).aiHints?.polarity
        : undefined;
      if (polarity === 'buff') anyBuff = true;
      else anyNonBuff = true; // debuff or unspecified → treat as offensive
    }
    if (anyBuff && !anyNonBuff) return 'heal'; // pure buff → beneficial
    if (anyNonBuff) return 'attack'; // any debuff → offensive
  }
  return 'target'; // pure utility (CT / knockback / terrain) → neutral amber
}

export function computeAbilityDisableReason(
  state: GameState,
  catalog: Catalog,
  actor: Unit,
  ability: ActiveAbilityDefinition,
): string | null {
  // TABA M2 progression: a locked active (present in the command set but not
  // unlocked for this unit) is greyed. `usableActives === undefined` ⇒ ungated
  // (the Mage War default). Checked FIRST so a locked ability reads as
  // "Locked", not "Insufficient MP"; the engine's `validateUseAbility`
  // enforces the same gate — this is the legible menu-side mirror.
  if (actor.usableActives !== undefined && !actor.usableActives.has(ability.id)) {
    return 'Locked — not unlocked for this unit';
  }
  if (state.turnState === null || state.turnState.budget.actsAvailable <= 0) {
    return 'No Act budget remaining';
  }
  const mpCost = computeMpCost(state, catalog, actor.id, ability.id);
  if (actor.vitals.mp < mpCost) {
    return `Insufficient MP — need ${mpCost}, have ${actor.vitals.mp}`;
  }
  // Throw Item needs something to throw. With an empty stockpile the whole
  // flow dead-ends — the player can pick Throw Item and enter target-select,
  // but every target click probes with no stockpiled item and silently
  // cancels (the engine rejects a throw with nothing to throw). Disable it
  // up front with a Compound-first hint instead. Compound (which *creates*
  // items) has no such gate. (S71 follow-up; playtest report.)
  if (ability.id === THROW_ITEM_ABILITY_ID && stockpileTotal(actor) <= 0) {
    return 'No items to throw — Compound first';
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
export function computeLegalTargets(
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
  // TABA Ch3 (Volley Bow): a weapon-declared attack AoE means the basic
  // Attack aims at units AND empty tiles simultaneously (validateAction
  // upgrades it to unit_or_tile off the same spec) — both enumerations run.
  const weaponAoeAim = weaponAttackAoeSpec(actor, catalog, ability) !== undefined;
  const treatAsTile =
    ability.targeting.kind === 'tile' ||
    (ability.targeting.kind === 'unit_or_tile' && tileMode);
  const treatAsUnit =
    ability.targeting.kind === 'single_unit' ||
    (ability.targeting.kind === 'unit_or_tile' && !tileMode);

  if (treatAsUnit) {
    // Throw Item is target-first / item-second and isn't a `use_ability`
    // (it commits `use_throw_item`). A unit is a legal throw target iff some
    // held item validates against it — which *includes* KO'd-but-not-removed
    // units (Phoenix Down revives them). The generic single-target loop
    // below excludes KO'd units and probes the wrong action, so handle throw
    // here and keep the highlight in lockstep with the target-click.
    if (ability.id === THROW_ITEM_ABILITY_ID) {
      for (const candidate of state.units.values()) {
        if (candidate.removed) continue;
        if (hasThrowableItemAt(state, catalog, actor, candidate.id)) {
          positions.push(candidate.position);
          unitIds.add(candidate.id);
        }
      }
      return { positions, unitIds, tilePositions: tileKeys };
    }
    // Revive abilities (the Templar's Raise, `effects.removeKO`) target ONLY
    // KO'd allies — so for those we must include corpses as candidates and
    // let validateAction confirm (it requires KO'd + rejects living for
    // removeKO). For every other ability we pre-skip KO'd-but-not-removed
    // units: validateAction has no general "can't target a corpse" rule (a
    // Cure on a KO'd unit "validates" as a no-op), so without this filter
    // corpses would wrongly light up for heals/attacks. `removed` (permadeath)
    // units are never targetable. (S75 — fixes Raise highlighting nothing.)
    const reviveTargeting = ability.effects.removeKO === true;
    for (const candidate of state.units.values()) {
      if (candidate.removed) continue;
      if (candidate.vitals.hp <= 0 && !reviveTargeting) continue;
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
    // S55: a damaging single-target ability can also swing at a Worldcraft
    // Barrier sitting on an (otherwise empty) tile — the engine accepts a
    // `tile` target on a barrier tile even for `single_unit` and routes it to
    // `system_barrier_damage`. Offer those tiles so a basic Attack can break a
    // wall. validateAction applies the same range/LoS the unit path uses.
    addBarrierTargets(state, catalog, actor, ability, positions, tileKeys);
    // Volley Bow: fall through to the tile enumeration below so empty
    // ground lights up alongside the units. buildAction already routes
    // an empty-tile click to a tile target for damaging abilities, so
    // offer and click stay in lockstep.
    if (!weaponAoeAim) {
      return { positions, unitIds, tilePositions: tileKeys };
    }
  }

  // Defensive: if neither branch claimed the ability kind, fall through
  // to tile enumeration. `unit_or_tile` + tileMode lands here.
  if (!treatAsTile && !weaponAoeAim) return { positions, unitIds, tilePositions: tileKeys };

  // tile-targeted. Use effective range (post-`modifyAbilityRange`) so the
  // candidate window the picker scans matches what `validateAction` will
  // accept downstream. Session 52: widen the scanned window by the bow
  // height-range bonus this shooter could earn (vs an elev-0 target) so
  // tiles a downhill weapon shot newly reaches are offered; the
  // per-tile `validateAction` below still applies the exact per-target
  // bonus. No-op for non-bow abilities.
  const actorTile = tileAt(state.map, actor.position.x, actor.position.y, actor.position.layer);
  const range =
    computeAbilityRange(state, catalog, actor.id, ability).horizontal +
    maxRangeFromHeightBonus(
      weaponRangeFromHeightSpec(actor, catalog, ability),
      actorTile?.elevation ?? 0,
    );
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
  // Weapon-declared attack AoE (Volley Bow) previews exactly like an
  // authored one — same spec the engine dispatch injects.
  const aoe = ability.effects.aoe ?? weaponAttackAoeSpec(actor, catalog, ability);
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
export function buildAction(
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
    if (occupant === null) {
      // S55: a click on an empty tile is normally a no-op for single_unit —
      // unless a damaging ability is swinging at a Barrier there. Offer a
      // `tile` target; validateAction accepts it only when the tile bears a
      // barrier (else the caller's canCommit check cancels the click).
      return ability.effects.damage !== undefined ? tileTargetAction(actorId, ability, pos) : null;
    }
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
    // to pin, and tileMode was off, so the click is a no-op) — except a
    // damaging ability over a Barrier, which routes to the tile (S55).
    if (tileMode) {
      return tileTargetAction(actorId, ability, pos);
    }
    if (occupant === null) {
      return ability.effects.damage !== undefined ? tileTargetAction(actorId, ability, pos) : null;
    }
    return {
      type: 'use_ability',
      source: 'player',
      actorId,
      payload: { abilityId: ability.id, target: { kind: 'unit', unitId: occupant.id } },
    };
  }
  // tile
  return tileTargetAction(actorId, ability, pos);
}

function tileTargetAction(
  actorId: UnitId,
  ability: ActiveAbilityDefinition,
  pos: Position,
): ProposedAction {
  return {
    type: 'use_ability',
    source: 'player',
    actorId,
    payload: { abilityId: ability.id, target: { kind: 'tile', position: pos } },
  };
}

// Session 55: the in-bounds cells of a Worldcraft elevation kernel anchored
// at `anchor` — the per-tile authored delta the cast would apply, for the
// hover preview (Pillar/Pit single tile; Hill/Valley 3×3). Off-map offsets
// are dropped. Exported for testing.
export function elevationKernelCells(
  mapWidth: number,
  mapHeight: number,
  deltas: ReadonlyArray<{ readonly dx: number; readonly dy: number; readonly delta: number }>,
  anchor: Position,
): { position: Position; delta: number }[] {
  const cells: { position: Position; delta: number }[] = [];
  for (const d of deltas) {
    const x = anchor.x + d.dx;
    const y = anchor.y + d.dy;
    if (x < 0 || y < 0 || x >= mapWidth || y >= mapHeight) continue;
    cells.push({ position: { x, y, layer: anchor.layer }, delta: d.delta });
  }
  return cells;
}

// =====================
// Session 55: tile_set (Worldcraft Barrier) line targeting
// =====================

// The straight horizontal/vertical line from `anchor` to `far`, inclusive,
// when the two are axis-aligned and the run length is within
// [minLength, maxLength]; null otherwise. Geometry only — the engine's
// per-tile range / unoccupied / barrier-free checks are applied separately
// via validateAction (the authoritative gate). Exported for unit testing.
export function tileSetLine(
  anchor: Position,
  far: Position,
  minLength: number,
  maxLength: number,
): Position[] | null {
  if (anchor.layer !== far.layer) return null;
  const dx = far.x - anchor.x;
  const dy = far.y - anchor.y;
  if (dx !== 0 && dy !== 0) return null; // not axis-aligned
  const len = Math.max(Math.abs(dx), Math.abs(dy)) + 1;
  if (len < minLength || len > maxLength) return null;
  const sx = Math.sign(dx);
  const sy = Math.sign(dy);
  const out: Position[] = [];
  for (let i = 0; i < len; i++) {
    out.push({ x: anchor.x + sx * i, y: anchor.y + sy * i, layer: anchor.layer });
  }
  return out;
}

function tileSetAction(
  actorId: UnitId,
  abilityIdValue: AbilityId,
  positions: ReadonlyArray<Position>,
): ProposedAction {
  return {
    type: 'use_ability',
    source: 'player',
    actorId,
    payload: { abilityId: abilityIdValue, target: { kind: 'tile_set', positions } },
  };
}

// Every valid Barrier line that starts at `anchor` — one per (direction,
// length) combination that passes full engine validation. Keyed by the
// far-end position key for O(1) hit-testing on click/hover; the value is the
// full line, so preview and commit reuse the exact tiles validateAction
// accepted. Exported for testing.
export function validTileSetLinesFrom(
  state: GameState,
  catalog: Catalog,
  actor: Unit,
  ability: ActiveAbilityDefinition,
  anchor: Position,
): Map<string, Position[]> {
  const out = new Map<string, Position[]>();
  if (ability.targeting.kind !== 'tile_set') return out;
  const { minLength, maxLength } = ability.targeting;
  const dirs = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];
  for (const dir of dirs) {
    for (let len = minLength; len <= maxLength; len++) {
      const far: Position = {
        x: anchor.x + dir.dx * (len - 1),
        y: anchor.y + dir.dy * (len - 1),
        layer: anchor.layer,
      };
      const line = tileSetLine(anchor, far, minLength, maxLength);
      if (line === null) continue;
      // Skip lines that run off the map before probing the engine: the
      // tile_set validation reads tiles via `tileAt`, which throws (rather
      // than returning invalid) for out-of-bounds coords. The real picker
      // only ever sees on-map clicks, but this enumerator generates candidate
      // far-ends that can overshoot the edge.
      if (line.some((p) => p.x < 0 || p.y < 0 || p.x >= state.map.width || p.y >= state.map.height)) {
        continue;
      }
      const action = tileSetAction(actor.id, ability.id, line);
      if (!validateAction(state, action, catalog).valid) continue;
      out.set(positionKey(far), line);
    }
  }
  return out;
}

// Tiles within the ability's range from which at least one valid Barrier line
// can be drawn — the anchor-phase highlight set. A tile that's occupied,
// already has a barrier, or has no room for a 3-tile run yields no lines and
// is omitted (so the player can only anchor where a barrier can actually go).
// Exported for testing.
export function validTileSetAnchors(
  state: GameState,
  catalog: Catalog,
  actor: Unit,
  ability: ActiveAbilityDefinition,
): Position[] {
  if (ability.targeting.kind !== 'tile_set') return [];
  const range = computeAbilityRange(state, catalog, actor.id, ability).horizontal;
  const anchors: Position[] = [];
  for (let dy = -range; dy <= range; dy++) {
    for (let dx = -range; dx <= range; dx++) {
      const x = actor.position.x + dx;
      const y = actor.position.y + dy;
      if (x < 0 || y < 0 || x >= state.map.width || y >= state.map.height) continue;
      const anchor: Position = { x, y, layer: 0 };
      if (tileAt(state.map, x, y, 0) === undefined) continue;
      if (validTileSetLinesFrom(state, catalog, actor, ability, anchor).size > 0) {
        anchors.push(anchor);
      }
    }
  }
  return anchors;
}

// =====================
// Session 76: grapple_throw (Bear's Heave) targeting
// =====================

function grappleThrowAction(
  actorId: UnitId,
  abilityIdValue: AbilityId,
  throweeId: UnitId,
  destination: Position,
): ProposedAction {
  return {
    type: 'use_ability',
    source: 'player',
    actorId,
    payload: {
      abilityId: abilityIdValue,
      target: { kind: 'grapple_throw', unitId: throweeId, destination },
    },
  };
}

// Every legal destination tile for throwing `throweeId` — the diamond of
// radius `throwRadius` around the throwee, each tile run through the engine's
// authoritative `grapple_throw` validation (in-bounds / unoccupied / barrier-
// free / within the upward-elevation tolerance, plus the grab reach). Exported
// for testing.
export function validGrappleDestinations(
  state: GameState,
  catalog: Catalog,
  actor: Unit,
  ability: ActiveAbilityDefinition,
  throweeId: UnitId,
): Position[] {
  if (ability.targeting.kind !== 'grapple_throw') return [];
  const throwee = state.units.get(throweeId);
  if (throwee === undefined) return [];
  const radius = ability.targeting.throwRadius;
  const out: Position[] = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (Math.abs(dx) + Math.abs(dy) > radius) continue; // Manhattan diamond
      if (dx === 0 && dy === 0) continue;
      const x = throwee.position.x + dx;
      const y = throwee.position.y + dy;
      if (x < 0 || y < 0 || x >= state.map.width || y >= state.map.height) continue;
      const dest: Position = { x, y, layer: throwee.position.layer };
      if (tileAt(state.map, x, y, dest.layer) === undefined) continue;
      const action = grappleThrowAction(actor.id, ability.id, throweeId, dest);
      if (!validateAction(state, action, catalog).valid) continue;
      out.push(dest);
    }
  }
  return out;
}

// The units the actor can grab right now — those with at least one legal
// destination (which subsumes the grab-reach + liveness + non-self gates the
// engine enforces). Returns their positions for the throwee-phase highlight.
// Exported for testing.
export function validGrappleThrowees(
  state: GameState,
  catalog: Catalog,
  actor: Unit,
  ability: ActiveAbilityDefinition,
): Position[] {
  if (ability.targeting.kind !== 'grapple_throw') return [];
  const out: Position[] = [];
  for (const u of state.units.values()) {
    if (u.id === actor.id) continue;
    if (u.removed || u.vitals.hp <= 0 || u.airborne) continue;
    if (validGrappleDestinations(state, catalog, actor, ability, u.id).length > 0) {
      out.push(u.position);
    }
  }
  return out;
}

