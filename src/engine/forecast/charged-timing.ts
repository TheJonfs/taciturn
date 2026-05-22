// Charged-action timing forecast — accurate ticks-to-resolve via CT
// schedule walk (item #3, session 26.5).
//
// Pre-26.5 the estimate was `ceil(actionSpeed / casterSpeed)` computed
// at the UI layer (`src/ui/forecast-compose.ts`). That formula ignored
// other in-flight charges that would resolve first and reshape the
// schedule, AND misinterpreted `actionSpeed` as a threshold when the
// reducer actually uses it as the climb-rate (`chargedAction.speed =
// ability.actionSpeed`). Both problems vanish if we hand the question
// to `projectUpcoming`, which already does the full schedule walk for
// every entity (units + charged actions) per ADR-0003.
//
// Approach: construct a hypothetical state with a sentinel ChargedAction
// appended at ct=0 with speed=ability.actionSpeed, run projectUpcoming
// against it, find the sentinel by id. Its `ticksFromNow` is the
// accurate `ticksToResolve`; its index is `eventsBeforeResolve`. The
// surrounding events are returned for the forecast mini-timeline (item
// #7) to render without recomputing.
//
// Stop-status edge case: if `computeActionSpeed` would return 0 because
// the caster has a pausing status (per ADR-0023), the hypothetical
// charged action's speed is 0 and `projectUpcoming` simply won't
// include it — the function returns `null`, which callers render as
// "stalled" or skip the timing section.
//
// Pure: no state mutation, no random draws. Returns `null` when timing
// can't be projected (zero/negative speed, caster missing, horizon too
// short to see the resolution).

import type { ActiveAbilityDefinition, Catalog } from '../catalog/index.ts';
import type { ProjectedEvent } from '../ct/index.ts';
import {
  chargedActionId as mkChargedActionId,
  type ChargedAction,
  type GameState,
  type Position,
  type TargetRef,
  type Unit,
  type UnitId,
} from '../types/index.ts';
import { projectUpcoming } from '../ct/projection.ts';
import { computeBaseActionSpeed } from '../ct/speed.ts';

// Sentinel id for the hypothetical charged action in the dry-run state.
// Unique enough that it won't collide with `ca:<actor>:<seq>` ids from
// real chargedActions in `reducers.ts`.
const SENTINEL_ID = mkChargedActionId('__forecast_preview__');

// Default horizon — matches `projectUpcoming`'s typical 20-event window.
// Callers can raise this for very-slow charges; under v1 tuning, an
// action speed of 10 resolves in 10 ticks and almost always appears
// within 20 events.
const DEFAULT_HORIZON = 20;

export interface EstimateChargedTimingArgs {
  readonly state: GameState;
  readonly catalog: Catalog;
  readonly caster: Unit;
  readonly ability: ActiveAbilityDefinition;
  // Anchor of the targeted ability — used to derive `targets` for the
  // hypothetical charged action so the projection has consistent shape.
  // Not load-bearing for tick math today but keeps the hypothetical
  // shape parallel to the real reducer's construction.
  readonly anchor: Position;
  // The unit whose "next turn" the forecast compares against the
  // resolve (the "✓ resolves before / ✗ resolves after" line). Usually
  // the spell's primary target.
  readonly concernedUnitId?: UnitId;
  // Override the projection horizon. Defaults to 20.
  readonly horizon?: number;
}

export interface ChargedTimingResult {
  // Ticks until the hypothetical charged action would resolve in the
  // walked schedule.
  readonly ticksToResolve: number;
  // Number of other events that fire before the resolution.
  readonly eventsBeforeResolve: number;
  // The resolution event itself plus the surrounding window for the
  // mini-timeline render (item #7). The window is centered on the
  // resolve up to the horizon boundary.
  readonly resolutionEvent: ProjectedEvent;
  readonly surroundingEvents: ReadonlyArray<ProjectedEvent>;
  // 0-indexed position of `resolutionEvent` inside `surroundingEvents`.
  readonly resolutionIndex: number;
  // The concerned unit's next turn after the resolve, when both fall
  // within the horizon. Drives the "before / after" comparison.
  readonly targetNextTurn: {
    readonly event: ProjectedEvent;
    readonly index: number;
  } | null;
  // True iff the resolve fires before the concerned unit's next turn
  // (the "good outcome" for damage abilities). `null` when the target
  // has no upcoming turn in the projection.
  readonly resolvesBeforeTargetTurn: boolean | null;
}

export function estimateChargedTiming(
  args: EstimateChargedTimingArgs,
): ChargedTimingResult | null {
  // Speed = 0 means a pausing status would block the climb (Stop, etc.)
  // or the ability's actionSpeed is itself 0. Either way the resolve is
  // un-projectable.
  if (args.ability.actionSpeed <= 0) return null;

  // Hypothetical chargedAction matching what `reduceUseAbility` would
  // produce on commit (`ct: 0, speed: computeBaseActionSpeed(...)`).
  // Routing the speed through `computeBaseActionSpeed` keeps the
  // forecast accurate when equipment / status `modifyActionSpeed`
  // contributors apply at commit time (per ADR-0056). Targets are
  // derived from the anchor + ability targeting kind so that a future
  // schedule-walking change that reads action.targets (e.g.,
  // target-died invalidation) gets a realistic shape; today the walk
  // doesn't read them.
  const targets: TargetRef[] = buildSyntheticTargets(args);
  const hypothetical: ChargedAction = {
    id: SENTINEL_ID,
    casterId: args.caster.id,
    ct: 0,
    speed: computeBaseActionSpeed(args.state, args.catalog, args.caster, args.ability),
    abilityId: args.ability.id,
    targets,
    sourceSequenceNumber: -1,
  };

  const hypotheticalState: GameState = {
    ...args.state,
    chargedActions: [...args.state.chargedActions, hypothetical],
  };

  const horizon = args.horizon ?? DEFAULT_HORIZON;
  const events = projectUpcoming(hypotheticalState, horizon, args.catalog);
  const idx = events.findIndex(
    (e) => e.entityKind === 'charged_action' && e.entityId === SENTINEL_ID,
  );
  if (idx < 0) return null;
  const resolutionEvent = events[idx]!;

  // Surrounding-window slice. Mirrors `projectChargedResolution`'s ~7-
  // event idiom: up to 3 events before + the resolution + up to 3 after.
  // The mini-timeline (item #7) consumes this directly.
  const lo = Math.max(0, idx - 3);
  const hi = Math.min(events.length, idx + 4);
  const surroundingEvents = events.slice(lo, hi);
  const resolutionIndex = idx - lo;

  // Find the target's NEXT turn from now (first matching unit-event in
  // the projection — could be before OR after the resolve). The "good
  // outcome" is `resolutionEvent.ticksFromNow <= targetNextTurn.ticksFromNow`
  // — the spell lands first and the target can't move out of the way.
  // Strict-less-than would miss the same-tick tiebreak case where the
  // charged action wins via entityKind ordering; <= is the more honest
  // comparison.
  let targetNextTurn: ChargedTimingResult['targetNextTurn'] = null;
  let resolvesBeforeTargetTurn: boolean | null = null;
  if (args.concernedUnitId !== undefined) {
    for (let i = 0; i < events.length; i++) {
      const ev = events[i]!;
      if (ev.entityKind === 'unit' && ev.entityId === args.concernedUnitId) {
        targetNextTurn = { event: ev, index: i };
        resolvesBeforeTargetTurn = resolutionEvent.ticksFromNow <= ev.ticksFromNow;
        break;
      }
    }
  }

  return {
    ticksToResolve: resolutionEvent.ticksFromNow,
    eventsBeforeResolve: idx,
    resolutionEvent,
    surroundingEvents,
    resolutionIndex,
    targetNextTurn,
    resolvesBeforeTargetTurn,
  };
}

// Build the hypothetical chargedAction's `targets` from the ability's
// targeting kind and the anchor. The projection walker doesn't read
// these fields today, so shape correctness matters more than exact
// content; a hypothetical line/cone with one anchor tile is sufficient.
function buildSyntheticTargets(args: EstimateChargedTimingArgs): TargetRef[] {
  const kind = args.ability.targeting.kind;
  if (kind === 'self') {
    return [{ kind: 'unit', unitId: args.caster.id }];
  }
  // `single_unit`, `tile`, and `unit_or_tile` all produce a one-element
  // list anchored at the user's chosen position. If the anchor lands on
  // a unit AND the targeting kind supports unit-mode, emit a unit
  // target; otherwise a tile target. `unit_or_tile` (post-S38) defaults
  // to unit-mode here; the forecast layer doesn't know whether the
  // player will pick tile-mode at cast time, but the cast-vs-target-turn
  // ordering is identical either way.
  const occupant = findUnitAt(args.state, args.anchor);
  if (occupant !== null && (kind === 'single_unit' || kind === 'unit_or_tile')) {
    return [{ kind: 'unit', unitId: occupant.id }];
  }
  return [{ kind: 'tile', position: args.anchor }];
}

function findUnitAt(state: GameState, position: Position): Unit | null {
  for (const u of state.units.values()) {
    if (
      u.position.x === position.x &&
      u.position.y === position.y &&
      u.position.layer === position.layer
    ) {
      return u;
    }
  }
  return null;
}
