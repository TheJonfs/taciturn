// CampaignApp — the TABA campaign flow driver (M1.5: battle-as-beat).
//
// A node is an ORDERED BEAT SEQUENCE (sequence.ts). This driver WALKS that
// sequence: it plays presentational beats (story scenes, and the driver-
// injected result-summary / world-map) through the generic InterstitialRunner,
// and when it reaches a `battle` beat it runs formation → deployment → battle
// for THAT beat's `NodeBattle` and resumes the sequence on battle end. M1's
// fixed formation → deployment → battle → post-battle pipeline is gone;
// `requireBattle` is gone. (campaign-decomposition §3; ADR for battle-as-beat.)
//
//   node entry → walk beats:
//     story-scene  → run the scene (presentational), advance.
//     battle       → formation → deployment → battle → onBattleEnd:
//        win  → applyBattleBeatWin (apply-back) → result-summary → resume.
//               last battle → resolveNode → (non-terminal) trailing story +
//               world-map-choice → route + autosave → next node;
//               (terminal) → result-summary(campaignComplete) → Title.
//        loss → result-summary(loss) → Retry (re-enter this battle beat, state
//               unchanged) / Quit. A loss runs no apply-back.
//     standalone story node (no battle) → run its scenes → world-map / Title.
//
// PERSISTENCE stays node-granular (M1.5 call — no v3): the only checkpoints are
// node entry (in_progress, saved by the prior route) and `awaiting_route`
// (saved right after a node's LAST battle wins — preserves "never re-fight a
// won battle"). A reload mid-sequence (e.g. during a post-battle scene) resumes
// at the world map. Save schema is unchanged (v2).

import { useState, type ReactElement } from 'react';
import { BattleView } from './BattleView.tsx';
import { DeploymentScreen } from './DeploymentScreen.tsx';
import { FormationScreen } from './FormationScreen.tsx';
import { InterstitialRunner } from './interstitial/InterstitialRunner.tsx';
import { buildDeployedBattleConfig, type DeploymentResult } from './deployment-config.ts';
import {
  M1_CAMPAIGN_GRAPH,
  applyBattleBeatWin,
  battleWasWon,
  buildResultSummaryBeat,
  buildRouteChoiceBeat,
  clearSavedCampaign,
  deployableRoster,
  foldCampaignRoster,
  getNode,
  hasBattleAtOrAfter,
  isComplete,
  resolveNode,
  routeToNode,
  saveCampaign,
  summarizeBattleResult,
  takeStoryRun,
  type BattleBeat,
  type BeatOutput,
  type CampaignNode,
  type CampaignState,
  type CampaignUnit,
  type InterstitialBeat,
} from '@campaign/index.ts';
import type { BattleConfig, Catalog, GameState, TeamId } from '@engine/index.ts';

const GRAPH = M1_CAMPAIGN_GRAPH;

// What to do when the current presentational run completes. Each carries the
// state snapshot it acts on (captured at run creation — a presentational run
// never mutates campaign state, so the snapshot stays fresh).
type RunDone =
  | { readonly kind: 'walk'; readonly state: CampaignState; readonly cursor: number }
  | { readonly kind: 'retry'; readonly battleIndex: number }
  | { readonly kind: 'route'; readonly state: CampaignState } // state = resolved awaiting_route
  | { readonly kind: 'exit' };

// The one screen the driver shows. A single discriminated state replaces M1's
// separate sub/fightConfig/interstitial fields.
type Screen =
  | { readonly kind: 'run'; readonly beats: ReadonlyArray<InterstitialBeat>; readonly done: RunDone; readonly nonce: number }
  | { readonly kind: 'formation'; readonly battleIndex: number }
  | { readonly kind: 'deployment'; readonly battleIndex: number; readonly config: BattleConfig }
  | { readonly kind: 'battle'; readonly battleIndex: number; readonly config: BattleConfig };

export interface CampaignAppProps {
  // The starting state — a fresh `startCampaign(...)` or a resumed save.
  // (The owner has already autosaved it; CampaignApp saves on each advance.)
  readonly initialState: CampaignState;
  readonly catalog: Catalog;
  readonly onExitToTitle: () => void;
}

export function CampaignApp({ initialState, catalog, onExitToTitle }: CampaignAppProps): ReactElement {
  const [state, setState] = useState<CampaignState>(initialState);
  // Monotonic key so each new presentational run remounts the runner fresh
  // (resets its beat cursor). Bumped by `showRun`. Declared BEFORE `screen` so
  // it is initialized when `planEntry` (the screen initializer) reads it.
  const [nonce, setNonce] = useState(0);
  const [screen, setScreen] = useState<Screen>(() => planEntry(initialState));

  // The battle beat currently in the formation/deployment/battle sub-flow reads
  // its NodeBattle from the node's beats by index (fresh across renders).
  const node = getNode(GRAPH, state.currentNodeId);

  // --- run plumbing ---

  // The first screen for a starting/resumed state — PURE (no save/setState).
  // Node entry is already persisted by the caller (startCampaign owner / the
  // prior route), so entry needs no save of its own.
  function planEntry(st: CampaignState): Screen {
    if (st.phase === 'awaiting_route') {
      // Resumed right after a won battle: drop straight to the world map (the
      // transient result is gone — nothing to replay before it).
      return runScreen([buildRouteChoiceBeat(GRAPH, st.currentNodeId)], { kind: 'route', state: st });
    }
    const entryNode = getNode(GRAPH, st.currentNodeId);
    const { scenes, next } = takeStoryRun(entryNode.beats, 0);
    if (next >= entryNode.beats.length) {
      // A standalone story node (no battle ahead): play its scenes, then route.
      // (A battle START node can't reach here — bootstrapRosterVitals requires
      // one. This is the resume-into-a-story-node case.)
      return resolutionRun(st, entryNode, scenes);
    }
    if (scenes.length > 0) return runScreen(scenes, { kind: 'walk', state: st, cursor: next });
    return { kind: 'formation', battleIndex: next };
  }

  // Build a run screen (does NOT bump the nonce — see showRun for the live path;
  // planEntry uses the initial nonce).
  function runScreen(beats: ReadonlyArray<InterstitialBeat>, done: RunDone): Screen {
    return { kind: 'run', beats, done, nonce };
  }

  // Show a presentational run now (bumping the nonce). An empty run would stall
  // the runner, so finish its `done` immediately instead (defensive — authoring
  // never yields one).
  function showRun(beats: ReadonlyArray<InterstitialBeat>, done: RunDone): void {
    if (beats.length === 0) {
      finishRun(done, {});
      return;
    }
    const key = nonce + 1;
    setNonce(key);
    setScreen({ kind: 'run', beats, done, nonce: key });
  }

  // A node whose sequence has ended (standalone / trailing story with no more
  // battles) — set the phase and show its closing run. No `awaiting_route`
  // checkpoint save here (a battle-less resolution has nothing to protect from
  // a re-fight); the route/exit persists on completion.
  function resolutionRun(
    st: CampaignState,
    resolvedNode: CampaignNode,
    prefixScenes: ReadonlyArray<InterstitialBeat>,
  ): Screen {
    const resolved = resolveNode(st, GRAPH);
    if (isComplete(resolved)) return runScreen([...prefixScenes], { kind: 'exit' });
    return runScreen(
      [...prefixScenes, buildRouteChoiceBeat(GRAPH, resolvedNode.id)],
      { kind: 'route', state: resolved },
    );
  }

  // --- the sequence walk ---

  // Walk the sequence of `st`'s node from `cursor`. Called mid-flow only, where
  // a battle beat is always ahead (pre-battle story → its battle; a post-battle
  // "more battles" summary → the next battle). Node resolution is handled by
  // handleBattleEnd (after a battle) and resolutionRun (standalone), never here.
  function advance(st: CampaignState, cursor: number): void {
    const walkNode = getNode(GRAPH, st.currentNodeId);
    const { scenes, next } = takeStoryRun(walkNode.beats, cursor);
    if (next >= walkNode.beats.length) {
      // Shouldn't happen from a mid-flow caller — fail loud rather than stall.
      throw new Error(
        `CampaignApp.advance: no battle beat ahead of cursor ${cursor} in node "${walkNode.id}"`,
      );
    }
    if (scenes.length > 0) {
      showRun(scenes, { kind: 'walk', state: st, cursor: next });
    } else {
      setScreen({ kind: 'formation', battleIndex: next });
    }
  }

  function finishRun(done: RunDone, output: BeatOutput): void {
    switch (done.kind) {
      case 'walk':
        advance(done.state, done.cursor);
        return;
      case 'retry':
        // Loss → re-enter this battle beat from the unchanged state.
        setScreen({ kind: 'formation', battleIndex: done.battleIndex });
        return;
      case 'exit':
        onExitToTitle();
        return;
      case 'route': {
        const nextNodeId = output.nextNodeId;
        if (nextNodeId === undefined) {
          throw new Error('CampaignApp: world-map run produced no route');
        }
        const routed = routeToNode(done.state, GRAPH, nextNodeId);
        saveCampaign(routed);
        setState(routed);
        setScreen(planEntry(routed));
        return;
      }
    }
  }

  // --- battle beat sub-flow ---

  function battleBeatAt(index: number): BattleBeat {
    const beat = node.beats[index];
    if (beat === undefined || beat.type !== 'battle') {
      throw new Error(`CampaignApp: expected a battle beat at index ${index} of node "${node.id}"`);
    }
    return beat;
  }

  function handleFormationConfirm(battleIndex: number, selected: ReadonlyArray<CampaignUnit>): void {
    const battle = battleBeatAt(battleIndex).battle;
    const folded = foldCampaignRoster(battle.template, selected, battle.playerTeam, catalog);
    setScreen({ kind: 'deployment', battleIndex, config: stampControls(folded, battle.playerTeam) });
  }

  function handleDeploymentCommit(battleIndex: number, config: BattleConfig, result: DeploymentResult): void {
    setScreen({ kind: 'battle', battleIndex, config: buildDeployedBattleConfig(config, result) });
  }

  function handleBattleEnd(battleIndex: number, finalState: GameState): void {
    const battle = battleBeatAt(battleIndex).battle;
    const result = summarizeBattleResult(finalState);
    const won = battleWasWon(result, battle.playerTeam);

    if (!won) {
      // Loss: no apply-back. Show how the battle left the deployed units, then
      // retry this same battle beat (state unchanged == the node-entry save).
      const summary = buildResultSummaryBeat({
        node,
        roster: state.roster,
        result,
        won: false,
        campaignComplete: false,
      });
      showRun([summary], { kind: 'retry', battleIndex });
      return;
    }

    // Win: apply-back for this battle beat (heal survivors, mark lost).
    const applied = applyBattleBeatWin(state, result, finalState, catalog);

    if (hasBattleAtOrAfter(node.beats, battleIndex + 1)) {
      // More battles in this node (a future multi-battle shape): show the
      // result, then resume the walk into the next battle. No node resolution
      // yet; phase stays in_progress.
      const summary = buildResultSummaryBeat({
        node,
        roster: applied.roster,
        result,
        won: true,
        campaignComplete: false,
      });
      setState(applied);
      showRun([summary], { kind: 'walk', state: applied, cursor: battleIndex + 1 });
      return;
    }

    // Last battle of the node → resolve it. Save the `awaiting_route` checkpoint
    // (or clear on a terminal win) BEFORE the closing run, so a reload doesn't
    // re-fight this won battle.
    const resolved = resolveNode(applied, GRAPH);
    const complete = isComplete(resolved);
    const summary = buildResultSummaryBeat({
      node,
      roster: resolved.roster,
      result,
      won: true,
      campaignComplete: complete,
    });
    if (complete) clearSavedCampaign();
    else saveCampaign(resolved);
    setState(resolved);

    const { scenes: trailing } = takeStoryRun(node.beats, battleIndex + 1);
    if (complete) {
      // Terminal win — the result-summary is the victory screen; then Title.
      showRun([summary, ...trailing], { kind: 'exit' });
    } else {
      showRun([summary, ...trailing, buildRouteChoiceBeat(GRAPH, node.id)], { kind: 'route', state: resolved });
    }
  }

  // --- render ---

  if (screen.kind === 'run') {
    return (
      <InterstitialRunner
        key={screen.nonce}
        beats={screen.beats}
        onComplete={(output) => finishRun(screen.done, output)}
        onExitToTitle={onExitToTitle}
      />
    );
  }

  if (screen.kind === 'formation') {
    const battle = battleBeatAt(screen.battleIndex).battle;
    return (
      <FormationScreen
        nodeName={node.name}
        roster={deployableRoster(state)}
        deployCap={battle.deployCap}
        catalog={catalog}
        onConfirm={(selected) => handleFormationConfirm(screen.battleIndex, selected)}
        onQuit={onExitToTitle}
      />
    );
  }

  if (screen.kind === 'deployment') {
    const battle = battleBeatAt(screen.battleIndex).battle;
    return (
      <DeploymentScreen
        template={screen.config}
        zones={battle.zones}
        deployingTeam={battle.playerTeam}
        onCommit={(result) => handleDeploymentCommit(screen.battleIndex, screen.config, result)}
        onBack={() => setScreen({ kind: 'formation', battleIndex: screen.battleIndex })}
      />
    );
  }

  if (screen.kind === 'battle') {
    const battleIndex = screen.battleIndex;
    return (
      <BattleView
        template={screen.config}
        deploymentResult={null}
        onBattleEnd={(finalState) => handleBattleEnd(battleIndex, finalState)}
        // Campaign owns the post-battle flow via onBattleEnd; these exits
        // are unused fallbacks (ResultsScreen is suppressed), but the prop
        // contract requires them.
        onExitToSetup={onExitToTitle}
        onExitToTitle={onExitToTitle}
      />
    );
  }

  // Unreachable in normal flow; render nothing rather than crash.
  return <></>;
}

// Stamp control flags so BattleView wires a human controller for the player
// team and AI for everyone else. The shipped node templates already set
// these (demoBattle: team_a human / team_b ai), but stamping keeps
// CampaignApp correct regardless of which template a beat reuses.
function stampControls(config: BattleConfig, playerTeam: TeamId): BattleConfig {
  return {
    ...config,
    teams: config.teams.map((t) => ({
      ...t,
      control: t.id === playerTeam ? 'human' : 'ai',
    })),
  };
}
