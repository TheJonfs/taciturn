// CT-preview forecast — pure projections of the active unit's end-of-turn
// CT under different action plans, plus a query for when a charged action
// will resolve relative to surrounding events. Used by the action menu's
// "end CT: N" annotations and the forecast panel's Timing subsection.
//
// Composes existing pure functions:
//   - `state.turnState.budget` (movesAvailable / actsAvailable / waitDisabled)
//   - `ruleset.ctCosts` (moveOnly / actOnly / moveAndAct / wait)
//   - `projectUpcoming` (for surrounding-events context)
//
// All functions here are pure; no random draws, no state mutation.

import { projectUpcoming, type ProjectedEvent } from '../ct/projection.ts';
import { TRIGGER_THRESHOLD } from '../ct/constants.ts';
import type { Catalog } from '../catalog/index.ts';
import { runOnTurnEnd } from '../hooks/runners.ts';
import type { GameState, Unit, UnitId } from '../types/index.ts';

// The action menu's "what if I do X next?" planning kinds. Mirrors the
// reducer's CT-cost classification but expressed in terms of the player's
// intended next step (not yet committed).
export type PlannedNextAction = 'move' | 'act' | 'wait' | 'move_and_act' | 'wait_no_act';

export interface ProjectTurnEndCtArgs {
  readonly state: GameState;
  readonly catalog: Catalog;
  readonly unit: Unit;
  // What the player would do if they committed now. Combined with the
  // already-consumed budget to determine the equivalent (move / act /
  // moveAndAct / wait) bucket.
  readonly plannedNext: PlannedNextAction;
}

// Projected CT at turn end if the active unit commits `plannedNext` now
// (consuming whatever budget that implies). Returns the CT post-cost
// plus any `system_ct_push` deltas emitted by `onTurnEnd` handlers on
// the unit (per ADR-0053). Floored at 0.
//
// The `onTurnEnd` dry-run mirrors `reduceTurnEnd`'s fire-site: a
// synthetic state is constructed with the unit's CT post-decrement and
// `turnState.consumed` reflecting `plannedNext`, then `runOnTurnEnd`
// reads emissions without committing them. Any `system_ct_push`
// targeting the unit is summed into the displayed leftover. The runner
// is pure (ADR-0053), so the dry-run is free of side effects.
//
// Used by the action menu's per-option "(end CT: N)" annotation and the
// forecast panel's "End-of-turn CT" line.
export function projectTurnEndCt(args: ProjectTurnEndCtArgs): number {
  const ruleset = args.catalog.getRuleset(args.state.ruleset.id);
  const consumed = args.state.turnState?.consumed;
  const movesConsumed = consumed?.movesConsumed ?? 0;
  const actsConsumed = consumed?.actsConsumed ?? 0;

  // Project what consumed budgets look like after `plannedNext`. Per
  // the post-MVP designer call: clicking Wait simply ends the turn with
  // the consumed-bucket cost; it doesn't add a standalone "wait" cost
  // on top of what's been done. The standalone wait cost only applies
  // when literally nothing was consumed.
  let nextMoves = movesConsumed;
  let nextActs = actsConsumed;
  switch (args.plannedNext) {
    case 'move':
      nextMoves += 1;
      break;
    case 'act':
      nextActs += 1;
      break;
    case 'move_and_act':
      nextMoves += 1;
      nextActs += 1;
      break;
    case 'wait':
    case 'wait_no_act':
      // Wait doesn't add to consumed buckets — it just triggers turn
      // end with whatever's already been done.
      break;
  }

  let ctCost: number;
  if (nextMoves > 0 && nextActs > 0) ctCost = ruleset.ctCosts.moveAndAct;
  else if (nextActs > 0) ctCost = ruleset.ctCosts.actOnly;
  else if (nextMoves > 0) ctCost = ruleset.ctCosts.moveOnly;
  else ctCost = ruleset.ctCosts.wait;

  const postCostCt = Math.max(0, args.unit.ct - ctCost);

  // Dry-run the onTurnEnd hook chain to capture any system_ct_push
  // refunds (Quickstep, future end-of-turn procs). Only meaningful when
  // the unit is mid-turn — defensive guards for the off-turn case.
  if (args.state.turnState === null) return postCostCt;
  if (args.state.turnState.unitId !== args.unit.id) return postCostCt;

  const projectedUnit: Unit = { ...args.unit, ct: postCostCt };
  const projectedTurnState = {
    ...args.state.turnState,
    consumed: { movesConsumed: nextMoves, actsConsumed: nextActs },
  };
  const projectedUnits = new Map(args.state.units);
  projectedUnits.set(args.unit.id, projectedUnit);
  const projectedState: GameState = {
    ...args.state,
    units: projectedUnits,
    turnState: projectedTurnState,
  };

  const emissions = runOnTurnEnd(projectedState, args.catalog, { unit: projectedUnit });
  let refundDelta = 0;
  for (const e of emissions) {
    if (e.type === 'system_ct_push' && e.payload.targetId === args.unit.id) {
      refundDelta += e.payload.delta;
    }
  }
  return Math.max(0, postCostCt + refundDelta);
}

// Projection of a charged action's resolution position in the event
// timeline. Returns the event itself (one of the upcoming projected
// events from `projectUpcoming`) plus a window of surrounding events,
// for the forecast panel's mini-timeline. `null` when no event matching
// the charged-action id is found within the requested horizon.
export interface ChargedResolutionProjection {
  readonly resolutionEvent: ProjectedEvent;
  readonly surroundingEvents: ReadonlyArray<ProjectedEvent>;
  // 0-indexed position of `resolutionEvent` inside `surroundingEvents`
  // (the trimmed window). For the full-projection position, see
  // `eventsBeforeResolve`.
  readonly resolutionIndex: number;
  // Count of events that fire before the resolution across the full
  // projection horizon. Equals the resolve's index in the un-trimmed
  // event list — i.e., how many turns / charged-resolves slot in
  // chronologically ahead of this one. Session 26.5 (item #3).
  readonly eventsBeforeResolve: number;
  // The next unit-turn for `concernedUnitId` after the resolution, if any
  // — used by the design doc's "Resolves BEFORE / AFTER target's next
  // turn" pass/fail line. `null` when the target has no upcoming turn in
  // the projection horizon.
  readonly targetNextTurnEvent: ProjectedEvent | null;
}

export interface ProjectChargedResolutionArgs {
  readonly state: GameState;
  readonly catalog: Catalog;
  readonly chargedActionId: string;
  // The unit whose "next turn after resolution" the caller cares about
  // — typically the target of the charged spell.
  readonly concernedUnitId?: UnitId;
  // Number of events to project. Defaults to 20 (matches the design
  // doc's projection-column horizon).
  readonly horizon?: number;
}

export function projectChargedResolution(
  args: ProjectChargedResolutionArgs,
): ChargedResolutionProjection | null {
  const horizon = args.horizon ?? 20;
  const events = projectUpcoming(args.state, horizon, args.catalog);
  const idx = events.findIndex(
    (e) => e.entityKind === 'charged_action' && String(e.entityId) === args.chargedActionId,
  );
  if (idx < 0) return null;
  const resolutionEvent = events[idx]!;
  // Show up to 3 events before and 3 after for context (~7-event window
  // per the design doc).
  const lo = Math.max(0, idx - 3);
  const hi = Math.min(events.length, idx + 4);
  const surroundingEvents = events.slice(lo, hi);
  const resolutionIndex = idx - lo;
  let targetNextTurnEvent: ProjectedEvent | null = null;
  if (args.concernedUnitId !== undefined) {
    for (let i = idx + 1; i < events.length; i++) {
      const ev = events[i]!;
      if (ev.entityKind === 'unit' && ev.entityId === args.concernedUnitId) {
        targetNextTurnEvent = ev;
        break;
      }
    }
  }
  return {
    resolutionEvent,
    surroundingEvents,
    resolutionIndex,
    eventsBeforeResolve: idx,
    targetNextTurnEvent,
  };
}

// Crude "what does CT look like right after this unit acts?" projection
// — used by the action menu for the Wait option (Wait costs vary per
// ruleset and matter for upcoming-turn planning). Exposed for callers
// that want CT relative to `TRIGGER_THRESHOLD` (e.g., a "next at 30 CT"
// signal in the forecast panel).
export function thresholdAfterTurn(currentCt: number, costApplied: number): number {
  return Math.max(0, currentCt - costApplied);
}

export { TRIGGER_THRESHOLD };
