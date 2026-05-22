// Smoke test: the demo orchestrator can drive the demo battle from
// initial state to a decided outcome. Doesn't assert on which side
// wins — both Knights are symmetric and the masterSeed determines
// reaction-fire order, so the result is deterministic per seed.
//
// The cap on iterations is a safety rail: any healthy engine + dumb
// controller pair finishes a 2-unit, 60-HP, ~7-damage-per-attack battle
// in a handful of turn cycles. If this trips, either the controller is
// looping (no progress) or a reducer regression broke termination.

import { loadDefaultCatalog } from '@content/index.ts';
import { demoBattle } from '@content/battles/demo.ts';
import {
  applyStatus,
  createInitialState,
  enumeratePreBattleActions,
  statusTypeId,
  type ProposedAction,
} from '@engine/index.ts';
import { DemoOrchestrator, greedyMeleeController } from './index.ts';
import type { Controller } from './orchestrator.ts';

const MAX_STEPS = 500;

describe('DemoOrchestrator', () => {
  it('drives the demo battle to a decided outcome', () => {
    const catalog = loadDefaultCatalog();
    const initial = createInitialState(demoBattle, catalog);

    const controller = greedyMeleeController();
    const controllers = new Map([
      [demoBattle.teams[0]!.id, controller],
      [demoBattle.teams[1]!.id, controller],
    ]);
    const orchestrator = new DemoOrchestrator(initial, catalog, controllers);

    let steps = 0;
    while (steps < MAX_STEPS) {
      const result = orchestrator.step();
      steps++;
      if (result.done) break;
    }

    const finalState = orchestrator.getState();
    expect(steps).toBeLessThan(MAX_STEPS);
    expect(finalState.outcome).toBeDefined();
  });

  // Session 31.5 regression: pre-31.5 the orchestrator threw on any
  // commit failure — including legitimate runtime refusals like Don't
  // Move's onActionAttempted hook block. The throw propagated through
  // the pump loop and crashed the React tree. Now the orchestrator
  // returns a `rejection` on the step instead.
  it('returns rejection (no throw) when commitAction is hook_blocked', () => {
    const catalog = loadDefaultCatalog();
    let state = createInitialState(demoBattle, catalog);

    // Drive the engine until a turn starts so there's an active unit.
    const noopController: Controller = () => ({ kind: 'pending' });
    const controllers = new Map([
      [demoBattle.teams[0]!.id, noopController],
      [demoBattle.teams[1]!.id, noopController],
    ]);
    const orchestrator = new DemoOrchestrator(state, catalog, controllers);
    let safety = 0;
    while (orchestrator.getState().turnState === null && safety < 100) {
      orchestrator.step();
      safety++;
    }
    state = orchestrator.getState();
    const activeId = state.turnState!.unitId;

    // Apply Don't Move directly to the active unit. Engine state edits
    // outside the reducer flow normally violate the discipline, but the
    // test needs to reach the hook-block path without scripting an
    // actual ability application.
    state = applyStatus(
      state,
      {
        targetId: activeId,
        typeId: statusTypeId('dont_move'),
        sourceUnitId: null,
        sourceActionSeq: null,
        duration: 100,
      },
      catalog,
    ).newState;

    // Hand the orchestrator a controller that proposes a Move action
    // it will then expect to fail.
    const moveAction: ProposedAction = {
      type: 'move',
      source: 'player',
      actorId: activeId,
      payload: { destination: state.units.get(activeId)!.position },
    };
    const activeTeam = state.units.get(activeId)!.team;
    const submittingController: Controller = () => ({ kind: 'commit', action: moveAction });
    const blockedControllers = new Map<typeof activeTeam, Controller>([
      [activeTeam, submittingController],
    ]);
    for (const [team] of controllers) {
      if (team !== activeTeam) blockedControllers.set(team, noopController);
    }
    const blockedOrch = new DemoOrchestrator(state, catalog, blockedControllers);

    // Pre-31.5 this throws. Post-31.5 it returns a rejection.
    const result = blockedOrch.step();
    expect(result.committed).toEqual([]);
    expect(result.rejection).toBeDefined();
    expect(result.rejection!.stage).toBe('hook_blocked');
    expect(result.rejection!.action.type).toBe('move');
    // State is unchanged.
    expect(blockedOrch.getState()).toBe(state);
  });

  // Session 32 / ADR-0071 — orchestrator pre-battle phase. Equipment
  // auto-status grants and ruleset-derived initial-CT randomization
  // commit through `commitAction` before the first scheduler advance.
  it('drains pre-battle action queue before the first turn fires', () => {
    const catalog = loadDefaultCatalog();
    const initial = createInitialState(demoBattle, catalog);
    const preBattleActions = enumeratePreBattleActions(initial, demoBattle, catalog);
    // The demo battle's units have non-trivial loadouts + the default
    // ruleset uses uniform_int initial CT, so the queue is non-empty.
    expect(preBattleActions.length).toBeGreaterThan(0);

    const noopController: Controller = () => ({ kind: 'pending' });
    const controllers = new Map([
      [demoBattle.teams[0]!.id, noopController],
      [demoBattle.teams[1]!.id, noopController],
    ]);
    const orchestrator = new DemoOrchestrator(initial, catalog, controllers, preBattleActions);

    // Drain pre-battle queue: each step commits one pre-battle action,
    // and turnState stays null because no scheduler advance has fired.
    const committedTypes: string[] = [];
    for (let i = 0; i < preBattleActions.length; i++) {
      const step = orchestrator.step();
      expect(step.rejection).toBeUndefined();
      expect(step.committed.length).toBe(1);
      committedTypes.push(step.committed[0]!.type);
      // No turn has begun yet — still pre-battle.
      expect(orchestrator.getState().turnState).toBeNull();
    }
    // Pre-battle actions are `system_apply_status` (equipment grants)
    // followed by `system_set_ct` (initial CT). The action log captures
    // them from sequence 0 forward.
    for (const t of committedTypes) {
      expect(['system_apply_status', 'system_set_ct']).toContain(t);
    }

    // Next step kicks the scheduler advance + first turn_start.
    const turnStep = orchestrator.step();
    expect(turnStep.committed.some((a) => a.type === 'turn_start')).toBe(true);
  });

  it('plays back identical action log given the same seed (replay determinism)', () => {
    const catalog = loadDefaultCatalog();
    const config = demoBattle;

    const drive = () => {
      const initial = createInitialState(config, catalog);
      const queue = enumeratePreBattleActions(initial, config, catalog);
      const orchestrator = new DemoOrchestrator(initial, catalog, new Map(), queue);
      const types: string[] = [];
      for (let i = 0; i < queue.length; i++) {
        const step = orchestrator.step();
        for (const a of step.committed) types.push(a.type);
      }
      return { types, finalState: orchestrator.getState() };
    };

    const a = drive();
    const b = drive();
    expect(a.types).toEqual(b.types);
    // Action log entries match by sequence number + type.
    expect(a.finalState.actionLog.length).toBe(b.finalState.actionLog.length);
    for (let i = 0; i < a.finalState.actionLog.length; i++) {
      expect(a.finalState.actionLog[i]!.type).toBe(b.finalState.actionLog[i]!.type);
      expect(a.finalState.actionLog[i]!.sequenceNumber).toBe(
        b.finalState.actionLog[i]!.sequenceNumber,
      );
    }
  });

  it('empty pre-battle queue falls through to the scheduler advance', () => {
    const catalog = loadDefaultCatalog();
    const initial = createInitialState(demoBattle, catalog);
    const noopController: Controller = () => ({ kind: 'pending' });
    const controllers = new Map([
      [demoBattle.teams[0]!.id, noopController],
      [demoBattle.teams[1]!.id, noopController],
    ]);
    // No pre-battle actions passed — orchestrator behaves as pre-S32.
    const orchestrator = new DemoOrchestrator(initial, catalog, controllers);
    const step = orchestrator.step();
    // First step commits a scheduler-emitted action (turn_start or
    // similar). Not a pre-battle action.
    expect(step.committed.length).toBeGreaterThan(0);
    expect(step.committed[0]!.type).not.toBe('system_apply_status');
    expect(step.committed[0]!.type).not.toBe('system_set_ct');
  });
});
