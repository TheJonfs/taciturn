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
  type Action,
  type Catalog,
  type GameState,
  type ProposedAction,
  type TeamId,
  type Unit,
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

export interface OrchestratorStep {
  // Engine state after this step's commits.
  readonly newState: GameState;
  // Every action that committed this step (root + chain), in commit order.
  // Empty when the orchestrator has nothing more to do (battle decided
  // or scheduler exhausted).
  readonly committed: ReadonlyArray<Action>;
  // True when the orchestrator has reached a terminal state and `step()`
  // will keep returning empty results. Renderer uses this to stop
  // pumping.
  readonly done: boolean;
}

export class DemoOrchestrator {
  private state: GameState;
  private readonly catalog: Catalog;
  private readonly controllers: ControllerMap;

  constructor(initialState: GameState, catalog: Catalog, controllers: ControllerMap) {
    this.state = initialState;
    this.catalog = catalog;
    this.controllers = controllers;
  }

  getState(): GameState {
    return this.state;
  }

  step(): OrchestratorStep {
    if (this.state.outcome !== undefined) {
      return { newState: this.state, committed: [], done: true };
    }

    if (this.state.turnState === null) {
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
    // decision.
    const actor = this.state.units.get(this.state.turnState.unitId);
    if (actor === undefined) {
      throw new Error('DemoOrchestrator: active unit missing from state');
    }
    const controller = this.pickController(actor);
    const decision = controller(this.state, this.catalog);

    if (decision.kind === 'pending') {
      // Controller has no decision yet (UI awaiting input). Commit
      // nothing; pump will re-ask next tick.
      return { newState: this.state, committed: [], done: false };
    }

    const action: ProposedAction =
      decision.kind === 'end-turn'
        ? { type: 'turn_end', source: 'system', payload: { unitId: actor.id } }
        : decision.action;

    const result = commitAction(this.state, action, this.catalog);
    if (!result.ok) {
      throw new Error(
        `DemoOrchestrator: commit failed for ${action.type} by ${JSON.stringify(actor.id)}: ${result.reason}`,
      );
    }
    this.state = result.newState;
    return {
      newState: this.state,
      committed: result.committed,
      done: this.state.outcome !== undefined,
    };
  }

  private pickController(actor: Unit): Controller {
    const controller = this.controllers.get(actor.team);
    if (controller === undefined) {
      throw new Error(
        `DemoOrchestrator: no controller registered for team ${JSON.stringify(actor.team)}`,
      );
    }
    return controller;
  }
}
