// Headless both-AI full-battle runner — the Session 75 auto-drive seam.
//
// WHY THIS EXISTS. Since S70 the in-app Human/AI setup toggle ignores
// synthetic/DOM clicks, so the implementer can't auto-drive a both-AI
// battle in the browser preview. Every AI feature (S73 cohesion, S74
// A/B) has therefore shipped feel-unverified at the *battle* level —
// validation has been unit-test-only against constructed states. This
// runner closes that gap from the other direction: it boots a full,
// organic both-AI battle headlessly (no UI, no clicking) and runs it to
// completion, returning the deterministic action log for inspection.
//
// It composes exactly the pieces `App` + `BattleView` compose for a live
// both-AI battle — `buildTeamBattleConfig` → AI deployment fold →
// `createInitialState` → `enumeratePreBattleActions` →
// `DemoOrchestrator` driven by two `createBasicAiController()`s — but
// without React or Pixi. The existing `ai-controller.integration.test.ts`
// already proved the engine+AI drive headlessly; this generalizes that
// to *real built teams on a real map* so the battle is emergent, not the
// symmetric demo fixture.
//
// TEST/DEBUG-ONLY. Nothing in the production app imports this module —
// it is dead code in the shipped bundle (tree-shaken away). There is no
// player-facing surface and no debug backdoor; the seam is reachable
// only from tests and the env-gated `both-ai-sim.test.ts` dev harness.
// See ADR-0130.

import {
  createInitialState,
  enumeratePreBattleActions,
  type Action,
  type BattleConfig,
  type Catalog,
  type GameState,
  type TeamId,
} from '@engine/index.ts';
import { loadDefaultCatalog } from '@content/index.ts';
import { deploymentZonesFor } from '@content/deployment/index.ts';
import { buildTeamBattleConfig, type BuiltTeam } from '@content/teams/index.ts';
import { riverRidgeBattle } from '@content/battles/river-ridge-battle.ts';
import { stonebridgeBattle } from '@content/battles/stonebridge-battle.ts';
import { marshmoorBattle } from '@content/battles/marshmoor-battle.ts';
import { mountainPassBattle } from '@content/battles/mountain-pass-battle.ts';
import {
  buildDeployedBattleConfig,
  computeAiDeploymentResult,
} from '../deployment-config.ts';
import { createBasicAiController } from '../controllers/index.ts';
import { DemoOrchestrator, type ControllerMap } from './index.ts';

// The maps the runner can stage a battle on. Mirrors `App`'s `MapId` /
// `MAP_OPTIONS` but redeclared here so the runner never imports the React
// `App` module. Both teams in every config are declared in the same
// order, so the canonical team ids come from any one of them.
export type HeadlessMapId = 'river_ridge' | 'stonebridge' | 'marshmoor' | 'mountain_pass';

const MAP_CONFIGS: Readonly<Record<HeadlessMapId, BattleConfig>> = {
  river_ridge: riverRidgeBattle,
  stonebridge: stonebridgeBattle,
  marshmoor: marshmoorBattle,
  mountain_pass: mountainPassBattle,
};

const TEAM_IDS: readonly [TeamId, TeamId] = [
  riverRidgeBattle.teams[0]!.id,
  riverRidgeBattle.teams[1]!.id,
];

export interface HeadlessBattleOptions {
  // Team folded into team_a (slot 0) and team_b (slot 1).
  readonly teamA: BuiltTeam;
  readonly teamB: BuiltTeam;
  readonly mapId: HeadlessMapId;
  readonly seed: number;
  // Hard ceiling on orchestrator steps — a stall guard, not a normal
  // exit. v1 content always decides well within this; an undecided
  // result means the battle hit the bound (surfaced via `decided`).
  readonly maxSteps?: number;
  // Override the catalog (tests pin initial-CT for determinism). Defaults
  // to the shipped catalog so the battle is the one the app would run.
  readonly catalog?: Catalog;
}

export interface HeadlessBattleResult {
  // The fully-folded config actually run (both built teams + both AI
  // deployments applied). Useful for mapping ids → teams/classes.
  readonly config: BattleConfig;
  readonly catalog: Catalog;
  readonly initialState: GameState;
  readonly finalState: GameState;
  // Every action committed across the whole battle, in commit order
  // (root actions + chain reactions + system fan-out). The deterministic
  // source of truth for behavior assertions.
  readonly log: ReadonlyArray<Action>;
  // The winning team, or null when the battle didn't decide within
  // `maxSteps`.
  readonly winner: TeamId | null;
  readonly decided: boolean;
  readonly steps: number;
}

const DEFAULT_MAX_STEPS = 5_000;

// Boot and run a full both-AI battle to completion, headless. The two
// built teams are folded onto the chosen map, both teams' deployments are
// computed by the AI heuristic (same path the live app uses for AI
// teams), and both sides are driven by the basic AI controller. Returns
// the complete action log plus the final state and outcome.
export function runHeadlessBattle(opts: HeadlessBattleOptions): HeadlessBattleResult {
  const catalog = opts.catalog ?? loadDefaultCatalog();
  const mapTemplate = MAP_CONFIGS[opts.mapId];

  // Fold both built teams onto the map template, stamp both as AI, and
  // pin the master seed. Mirrors `App.assemble`.
  let config = buildTeamBattleConfig(mapTemplate, opts.teamA, TEAM_IDS[0]);
  config = buildTeamBattleConfig(config, opts.teamB, TEAM_IDS[1]);
  config = {
    ...config,
    masterSeed: opts.seed,
    teams: config.teams.map((t) => ({ ...t, control: 'ai' as const })),
  };

  // Fold both teams' AI deployments (both are AI here). Mirrors
  // `App.beginDeployment`'s AI branch.
  const zones = deploymentZonesFor(opts.mapId);
  for (const team of config.teams) {
    config = buildDeployedBattleConfig(
      config,
      computeAiDeploymentResult(config, catalog, team.id, zones),
    );
  }

  const initialState = createInitialState(config, catalog);
  const preBattleActions = enumeratePreBattleActions(initialState, config, catalog);

  const controllers: ControllerMap = new Map(
    config.teams.map((team) => [team.id, createBasicAiController()]),
  );
  const orchestrator = new DemoOrchestrator(
    initialState,
    catalog,
    controllers,
    preBattleActions,
  );

  const log: Action[] = [];
  const maxSteps = opts.maxSteps ?? DEFAULT_MAX_STEPS;
  let steps = 0;
  while (steps < maxSteps) {
    const step = orchestrator.step();
    steps += 1;
    for (const action of step.committed) log.push(action);
    if (step.done) break;
  }

  const finalState = orchestrator.getState();
  const outcome = finalState.outcome;
  return {
    config,
    catalog,
    initialState,
    finalState,
    log,
    winner: outcome?.winner ?? null,
    decided: outcome !== undefined,
    steps,
  };
}
