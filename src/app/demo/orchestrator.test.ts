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
import { createInitialState } from '@engine/index.ts';
import { DemoOrchestrator, greedyMeleeController } from './index.ts';

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
});
