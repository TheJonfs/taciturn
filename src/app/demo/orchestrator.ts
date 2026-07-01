// Demo orchestrator — drives the engine for the v1 visible demo battle.
//
// Lives outside `src/engine/` because the orchestration loop (controller
// dispatch, animation handoff, scheduler advancement) is the layer that
// composes the engine's pure pieces with the rest of the app. Engine
// reducers and validators stay pure and ignorant of "what's next."
//
// Session 11's UI replaces the controller for player-controlled teams;
// session 12's AI replaces the controller for opponent teams. The
// orchestrator is the same — only the controller wiring changes.
//
// The orchestrator exposes `step()`: commit exactly one root action and
// return everything that committed (root + any chain reactions /
// system fan-out). The renderer animates each committed action in
// order, then asks for the next step. Between steps the engine state is
// authoritative; the renderer's visual state is a tween over it.

import {
  advanceToNextEvent,
  commitAction,
  effectiveController,
  type Action,
  type Catalog,
  type GameState,
  type ProposedAction,
  type TeamId,
  type Unit,
  type UnitId,
} from '@engine/index.ts';

// A controller's decision for the active unit's next step. One of three:
//   - `commit`: take this concrete ProposedAction.
//   - `end-turn`: I'm done; orchestrator commits `turn_end`.
//   - `pending`: I have nothing yet (e.g., the UI is waiting on user
//     input). Orchestrator commits nothing this step and re-asks later.
//
// The `commit` wrapper is a deliberate type-discrimination wedge: a
// bare ProposedAction has a `type` field but no `kind`, so wrapping
// gives the union a clean discriminator without forcing each
// non-action variant to invent a fake action shape.
export type ControllerDecision =
  | { readonly kind: 'commit'; readonly action: ProposedAction }
  | { readonly kind: 'end-turn' }
  | { readonly kind: 'pending' };

// Called only when `state.turnState !== null` and the active unit's
// team matches this controller. Pure: no side effects, no I/O.
export type Controller = (state: GameState, catalog: Catalog) => ControllerDecision;

export type ControllerMap = ReadonlyMap<TeamId, Controller>;

// Rejection record for a controller-submitted action that the engine
// refused at commit time. Pre-Session-31.5 the orchestrator threw on
// any commit failure — including legitimate runtime refusals like
// `hook_blocked` (Don't Move / Don't Act / Silence) and `battle_decided`.
// The throw propagated through the pump loop and crashed the React tree.
//
// Per Session 31.5: the orchestrator now communicates these via the
// step's `rejection` field instead of throwing. The pump can re-step
// (the controller's queued decision was drained, so the controller will
// report `pending` until the UI / AI submits something new). The UI's
// own `animationEnded` recovery (via the rAF idle poll) brings the menu
// back to the top level automatically.
//
// Scheduler-emitted system actions (turn_start, charged_action_resolve)
// still throw on failure — those are engine-internal and any rejection
// indicates a programmer error, not a runtime refusal.
export interface OrchestratorRejection {
  readonly action: ProposedAction;
  readonly stage: 'validation' | 'hook_blocked' | 'battle_decided';
  readonly reason: string;
}

export interface OrchestratorStep {
  // Engine state after this step's commits.
  readonly newState: GameState;
  // Every action that committed this step (root + chain), in commit order.
  // Empty when the orchestrator has nothing more to do (battle decided
  // or scheduler exhausted) OR when a controller-submitted action was
  // rejected (see `rejection`).
  readonly committed: ReadonlyArray<Action>;
  // True when the orchestrator has reached a terminal state and `step()`
  // will keep returning empty results. Renderer uses this to stop
  // pumping.
  readonly done: boolean;
  // Set when a controller-submitted action was refused by the engine.
  // The action's controller-side queue was already drained when the
  // orchestrator pulled the decision, so callers don't need to do
  // anything to recover — the controller will return `pending` on the
  // next step. Callers may log / surface the reason to the player.
  readonly rejection?: OrchestratorRejection;
}

export class DemoOrchestrator {
  private state: GameState;
  private readonly catalog: Catalog;
  private readonly controllers: ControllerMap;
  // Per ADR-0071 (Session 32): pre-battle action queue. The orchestrator
  // commits each entry through `commitAction` before the first scheduler
  // advance fires, so the action log captures equipment auto-status grants
  // (Tintinibar's Regen, Sorcerer's Robe's Shell) and the ruleset-derived
  // initial-CT randomization from sequence 0 forward. The queue is
  // pre-computed by the caller via `enumeratePreBattleActions` so the
  // orchestrator doesn't need the BattleConfig at construction time.
  // Empty when the caller doesn't supply one (e.g. older test fixtures
  // that build state by hand) — `step()` just falls through to the
  // scheduler-advance branch.
  private preBattleQueue: ProposedAction[];

  // Soft-lock guard (S63). Records the last controller-submitted root
  // action that the engine *rejected*, keyed by the active unit. If the
  // same unit re-submits the byte-identical action with no intervening
  // progress, `step()` forces a `turn_end` to break the loop rather than
  // re-rejecting forever. A deterministic controller (the AI) re-proposes
  // its single best action every tick, so a permanently-blocked action
  // (e.g. a Taunted unit whose top choice stays blocked — see the S63
  // Taunt audit) would otherwise spin the pump indefinitely. Human
  // controllers are immune: their decision drains to `pending` between
  // submissions, which clears this field, so a human may freely retry a
  // blocked action without being force-ended.
  private pendingRejection: { readonly unitId: UnitId; readonly signature: string } | null = null;

  constructor(
    initialState: GameState,
    catalog: Catalog,
    controllers: ControllerMap,
    preBattleActions: ReadonlyArray<ProposedAction> = [],
  ) {
    this.state = initialState;
    this.catalog = catalog;
    this.controllers = controllers;
    this.preBattleQueue = [...preBattleActions];
  }

  getState(): GameState {
    return this.state;
  }

  // --- Debug-only escape hatches (dev tooling; NOT part of normal flow) ---
  // Gated behind `import.meta.env.DEV` at the call site (the DebugBattleMenu),
  // so they never reach a production build.

  // Force the battle to a terminal outcome with `winner`, bypassing the
  // victory-condition system so an ARBITRARY side can "win" regardless of the
  // board. Stamps `state.outcome` directly (not through the reducer — the
  // battle is ending, so consistency for further steps doesn't matter). The
  // pump's next `step()` sees the outcome and stops; BattleView's onBattleEnd /
  // ResultsScreen consume it. Returns the new state so the caller can mirror it
  // into React.
  debugForceOutcome(winner: TeamId): GameState {
    this.state = {
      ...this.state,
      outcome: { winner, conditionIndex: 0, description: 'debug: forced outcome' },
    };
    return this.state;
  }

  // Remove a single unit mid-battle via the SAME reducer path normal
  // crystallization uses (`system_unit_removed`), so turn order, CT, and the
  // victory check all stay consistent and the renderer can animate it from the
  // returned committed actions. The battle continues (unless this empties a
  // team, in which case the reducer's victory check ends it). Returns null if
  // the commit is refused (e.g. the unit is already removed).
  debugRemoveUnit(targetId: UnitId): { committed: ReadonlyArray<Action>; newState: GameState } | null {
    const proposed: ProposedAction = {
      type: 'system_unit_removed',
      source: 'system',
      payload: { targetId },
    };
    const result = commitAction(this.state, proposed, this.catalog);
    if (!result.ok) return null;
    this.state = result.newState;
    return { committed: result.committed, newState: result.newState };
  }

  step(): OrchestratorStep {
    if (this.state.outcome !== undefined) {
      return { newState: this.state, committed: [], done: true };
    }

    // Pre-battle phase (Session 32 / ADR-0071). Drains queued
    // `system_apply_status` and `system_set_ct` actions one-per-step
    // before the first turn fires. Failures throw — these are
    // engine-emitted actions that should always validate.
    if (this.preBattleQueue.length > 0) {
      const proposed = this.preBattleQueue.shift()!;
      const result = commitAction(this.state, proposed, this.catalog, {
        checkVictoryConditions: false,
      });
      if (!result.ok) {
        throw new Error(
          `DemoOrchestrator: pre-battle commit failed at ${proposed.type}: ${result.reason}`,
        );
      }
      this.state = result.newState;
      return {
        newState: this.state,
        committed: result.committed,
        done: false,
      };
    }

    if (this.state.turnState === null) {
      // Turn boundary — drop any stale rejection memory from the unit
      // whose turn just ended.
      this.pendingRejection = null;
      // Between turns: advance the CT scheduler to the next trigger and
      // commit the resulting `turn_start` (or `charged_action_resolve`).
      const sched = advanceToNextEvent(this.state, this.catalog);
      if (sched === null) {
        // No entity can ever trigger — terminal stall. v1 content won't
        // produce this; defensive end.
        return { newState: this.state, committed: [], done: true };
      }
      this.state = sched.newState;
      const result = commitAction(this.state, sched.proposed, this.catalog);
      if (!result.ok) {
        throw new Error(
          `DemoOrchestrator: commit failed at scheduler-emitted ${sched.proposed.type}: ${result.reason}`,
        );
      }
      this.state = result.newState;
      return {
        newState: this.state,
        committed: result.committed,
        done: this.state.outcome !== undefined,
      };
    }

    // A turn is in progress. Ask this team's controller for the next
    // decision. Mid-turn KO of the active unit is now handled by the
    // engine's post-chain checkpoint in `commitAction` (per ADR-0023,
    // superseding ADR-0013): an active unit that ends a chain at HP 0
    // gets an automatic `turn_end` from the engine, so by the time the
    // orchestrator next reads turnState the active unit is alive (or
    // turnState is null and we're between turns).
    const actor = this.state.units.get(this.state.turnState.unitId);
    if (actor === undefined) {
      throw new Error('DemoOrchestrator: active unit missing from state');
    }
    const controller = this.pickController(actor);
    const decision = controller(this.state, this.catalog);

    if (decision.kind === 'pending') {
      // Controller has no decision yet (UI awaiting input). Commit
      // nothing; pump will re-ask next tick. A `pending` step is genuine
      // progress for the soft-lock guard — it means the controller is
      // waiting on fresh input rather than re-asserting a blocked action —
      // so clear the rejection memory (this is what exempts human retries).
      this.pendingRejection = null;
      return { newState: this.state, committed: [], done: false };
    }

    const action: ProposedAction =
      decision.kind === 'end-turn'
        ? { type: 'turn_end', source: 'system', payload: { unitId: actor.id } }
        : decision.action;

    const result = commitAction(this.state, action, this.catalog);
    if (!result.ok) {
      // Session 31.5: controller-submitted action refused by the engine
      // (Don't Move's hook block, Silence on a cast, post-state-change
      // validation drift). No state change; surface the rejection
      // upward so the pump can log / surface a reason. The UI flow's
      // `animationEnded` rAF poll handles the menu-return recovery
      // (the renderer stays idle, so `isIdle()` is true on the next
      // tick).
      const rejection = { action, stage: result.stage, reason: result.reason };
      // Soft-lock guard (S63): if this is the same unit re-submitting the
      // byte-identical action it was just rejected for, the controller is
      // stuck in a deterministic loop (no state changed, so it will keep
      // proposing the same blocked action). Force a `turn_end` to break it.
      const signature = `${String(actor.id)}|${JSON.stringify(action)}`;
      const looping =
        this.pendingRejection !== null &&
        this.pendingRejection.unitId === actor.id &&
        this.pendingRejection.signature === signature;
      if (looping) {
        this.pendingRejection = null;
        const forcedEnd: ProposedAction = {
          type: 'turn_end',
          source: 'system',
          payload: { unitId: actor.id },
        };
        const endResult = commitAction(this.state, forcedEnd, this.catalog);
        if (!endResult.ok) {
          // turn_end should always validate for the active unit; a failure
          // here is an engine bug, not a runtime refusal — stay loud.
          throw new Error(
            `DemoOrchestrator: forced turn_end after repeated rejection of ${action.type} failed: ${endResult.reason}`,
          );
        }
        this.state = endResult.newState;
        // Surface the originating rejection (the reason the turn was cut)
        // alongside the forced turn_end's commits.
        return {
          newState: this.state,
          committed: endResult.committed,
          done: this.state.outcome !== undefined,
          rejection,
        };
      }
      this.pendingRejection = { unitId: actor.id, signature };
      return {
        newState: this.state,
        committed: [],
        done: this.state.outcome !== undefined,
        rejection,
      };
    }
    this.pendingRejection = null;
    this.state = result.newState;
    return {
      newState: this.state,
      committed: result.committed,
      done: this.state.outcome !== undefined,
    };
  }

  private pickController(actor: Unit): Controller {
    // Control-override (Thief — Steal Heart): a charmed unit is driven by the
    // charmer's team, not its own, for the charm's duration. effectiveController
    // returns actor.team for everyone else. Win/loss & friend/foe still key off
    // actor.team (v1 control-only scope — ADR-0111).
    const controllingTeam = effectiveController(actor, this.catalog);
    const controller = this.controllers.get(controllingTeam);
    if (controller === undefined) {
      throw new Error(
        `DemoOrchestrator: no controller registered for team ${JSON.stringify(controllingTeam)}`,
      );
    }
    return controller;
  }
}
