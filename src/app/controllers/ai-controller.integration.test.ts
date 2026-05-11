// Integration test for the basic AI controller. Pits the greedy
// placeholder controller against the new AI controller in the v1 demo
// battle, headless, across several master seeds.
//
// What this test is and isn't:
//
//   - It is an end-to-end smoke test. Termination + determinism +
//     "the AI is competitive" are the bars. A failure here means the
//     AI produced a decision that the orchestrator couldn't commit, or
//     deadlocked, or regressed below the placeholder controller.
//
//   - It is NOT a strength benchmark. The demo battle is a symmetric
//     2v2 with identical stats and loadouts: whichever side acts first
//     gets to set the tempo, and Counter / Cure now muddy the picture
//     further (counter-fire, mid-fight heals). To factor out the
//     first-mover bias each seed is run twice with team assignments
//     swapped — the AI must win at least its share of the matchups it
//     plausibly should.
//
// The test deliberately uses real content (loadDefaultCatalog,
// demoBattle) — that's the integration surface we ship.

import { describe, expect, it } from 'vitest';
import {
  abilities,
  classes,
  commandSets,
  items,
  statusTypes,
} from '@content/index.ts';
import { defaultRuleset } from '@content/rulesets/default.ts';
import { demoBattle } from '@content/battles/demo.ts';
import {
  createCatalog,
  createInitialState,
  type BattleConfig,
  type Catalog,
  type TeamId,
} from '@engine/index.ts';
import { DemoOrchestrator, greedyMeleeController, type ControllerMap } from '../demo/index.ts';
import { createBasicAiController } from './ai-controller.ts';

// Build a catalog whose default ruleset pins initial CT to 0 — preserves
// the calibration of the AI-vs-greedy win-rate assertion against the
// session-25 default-ruleset switch to `uniform_int { 0, 20 }` (ADR-0050).
// Inline overlay rather than an exported helper since this is the only
// calibration-sensitive consumer.
function calibrationCatalog(): Catalog {
  return createCatalog({
    statusTypes,
    abilities,
    commandSets,
    classes,
    items,
    rulesets: [{ ...defaultRuleset, initialCT: { kind: 'fixed', value: 0 } }],
  });
}

interface RunResult {
  readonly winner: string | null;
  readonly steps: number;
  readonly decided: boolean;
}

function runBattle(opts: {
  readonly seed: number;
  readonly aiTeam: TeamId;
  readonly greedyTeam: TeamId;
  readonly maxSteps?: number;
}): RunResult {
  const catalog = calibrationCatalog();
  const config: BattleConfig = { ...demoBattle, masterSeed: opts.seed };
  const initialState = createInitialState(config, catalog);
  const controllers: ControllerMap = new Map([
    [opts.aiTeam, createBasicAiController()],
    [opts.greedyTeam, greedyMeleeController()],
  ]);
  const orch = new DemoOrchestrator(initialState, catalog, controllers);
  let steps = 0;
  const maxSteps = opts.maxSteps ?? 1000;
  while (steps < maxSteps) {
    const step = orch.step();
    steps += 1;
    if (step.done) break;
  }
  const outcome = orch.getState().outcome;
  return {
    winner: outcome === undefined ? null : String(outcome.winner),
    steps,
    decided: outcome !== undefined,
  };
}

describe('basic AI vs greedy controller — full demo battle', () => {
  const seeds = [0x1, 0x42, 0xABCDEF, 0xDEC0DE, 0xCAFEBABE];
  const teamA = demoBattle.teams[0]!.id;
  const teamB = demoBattle.teams[1]!.id;

  it('every battle terminates within a sane step bound', () => {
    for (const seed of seeds) {
      for (const [aiTeam, greedyTeam] of [
        [teamA, teamB],
        [teamB, teamA],
      ] as const) {
        const result = runBattle({ seed, aiTeam, greedyTeam });
        expect(
          result.decided,
          `seed=${seed.toString(16)} aiTeam=${String(aiTeam)} did not decide in ${result.steps} steps`,
        ).toBe(true);
      }
    }
  });

  it('basic AI wins at least as many matchups as greedy across both team assignments', () => {
    const matchups = seeds.flatMap((seed) =>
      ([
        [teamA, teamB],
        [teamB, teamA],
      ] as const).map(([aiTeam, greedyTeam]) => ({
        seed,
        aiTeam,
        result: runBattle({ seed, aiTeam, greedyTeam }),
      })),
    );

    const aiWins = matchups.filter((m) => m.result.winner === String(m.aiTeam)).length;
    const greedyWins = matchups.filter((m) =>
      m.result.winner !== null && m.result.winner !== String(m.aiTeam),
    ).length;

    // The demo battle is a symmetric 2v2 where first-mover tends to
    // win. Across both team assignments the AI should not lose more
    // matchups than greedy — i.e., the heuristic isn't strictly worse
    // than picking the closest enemy.
    expect(
      aiWins >= greedyWins,
      `basic AI underperformed greedy: ai=${aiWins} greedy=${greedyWins}\n${JSON.stringify(
        matchups.map((m) => ({
          seed: m.seed.toString(16),
          aiTeam: String(m.aiTeam),
          winner: m.result.winner,
        })),
        null,
        2,
      )}`,
    ).toBe(true);
  });

  it('is deterministic — same seed and team assignment produces the same outcome', () => {
    const seed = 0xDEC0DE;
    const a = runBattle({ seed, aiTeam: teamA, greedyTeam: teamB });
    const b = runBattle({ seed, aiTeam: teamA, greedyTeam: teamB });
    expect(a.winner).toEqual(b.winner);
    expect(a.steps).toEqual(b.steps);
  });
});
