// Ch1 substrate (WI4) — guest control routing: a player-team unit
// flagged `guest` is driven by the AI-controlled team's controller,
// never the human team's. The demo battle (team_a human / team_b ai)
// plus one guest on team_a exercises the orchestrator's pickController
// branch end-to-end.

import { loadDefaultCatalog } from '@content/index.ts';
import { demoBattle } from '@content/battles/demo.ts';
import { createInitialState, unitId, type BattleConfig, type GameState, type UnitId, type UnitPlacement } from '@engine/index.ts';
import { DemoOrchestrator, greedyMeleeController } from './index.ts';
import type { Controller } from './orchestrator.ts';

const MAX_STEPS = 500;

// A recording wrapper: which active units did this controller act for?
function recordingController(seen: Set<UnitId>): Controller {
  const inner = greedyMeleeController();
  return (state: GameState, catalog) => {
    if (state.turnState !== null) seen.add(state.turnState.unitId);
    return inner(state, catalog);
  };
}

// A free tile on the demo map for the guest to stand on.
function freeTile(config: BattleConfig): { x: number; y: number; layer: number } {
  const occupied = new Set(config.units.map((u) => `${u.position.x},${u.position.y}`));
  for (let y = 0; y < config.map.height; y++) {
    for (let x = 0; x < config.map.width; x++) {
      if (!occupied.has(`${x},${y}`)) return { x, y, layer: 0 };
    }
  }
  throw new Error('demo map has no free tile');
}

describe('guest control routing', () => {
  it('the guest acts on the AI controller, never the human one', () => {
    const catalog = loadDefaultCatalog();
    const guestId = unitId('guest_ally');
    const donor = demoBattle.units.find((u) => u.team === demoBattle.teams[0]!.id)!;
    const guest: UnitPlacement = {
      ...donor,
      id: guestId,
      name: 'Guest Ally',
      position: freeTile(demoBattle),
      guest: true,
    };
    const config: BattleConfig = { ...demoBattle, units: [...demoBattle.units, guest] };
    const initial = createInitialState(config, catalog);
    expect(initial.units.get(guestId)?.guest).toBe(true);

    const humanSaw = new Set<UnitId>();
    const aiSaw = new Set<UnitId>();
    const controllers = new Map([
      [demoBattle.teams[0]!.id, recordingController(humanSaw)], // 'human' team_a
      [demoBattle.teams[1]!.id, recordingController(aiSaw)], // 'ai' team_b
    ]);
    const orchestrator = new DemoOrchestrator(initial, catalog, controllers);

    let steps = 0;
    while (steps < MAX_STEPS) {
      const result = orchestrator.step();
      steps++;
      if (result.done) break;
    }

    // The guest took turns, and every one of them ran on the AI-team
    // controller; the human-team controller never drove it.
    expect(aiSaw.has(guestId)).toBe(true);
    expect(humanSaw.has(guestId)).toBe(false);
    // Sanity: the human controller still drove its own units.
    expect(humanSaw.size).toBeGreaterThan(0);
  });
});
