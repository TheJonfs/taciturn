// CampaignApp — the TABA campaign flow driver (M1: branching + interstitial).
//
// Wraps the pure battle as a state machine (campaign-decomposition §3),
// reusing the existing DeploymentScreen + BattleView through the additive
// `onBattleEnd` hook (ADR-0133). It owns the campaign sub-flow; the MW setup
// chain is untouched.
//
//   formation → (fold roster) → deployment → battle → onBattleEnd
//     win  → resolveWin (apply-back) → interstitial beats:
//              result-summary → (non-terminal) world-map-choice →
//              routeToNode + autosave → next node's formation
//              (terminal) → result-summary is the victory → Title
//     loss → interstitial: result-summary(loss) → Retry (re-enter the node
//            from the autosave) / Quit. A loss runs no apply-back, so the
//            failed attempt is discarded wholesale.
//
// The between-node interstitial is an ordered beat-sequence run by a generic
// runner (taba-m1-brief Chunk 2) — the slot M1.5 story-scenes plug into.

import { useState, type ReactElement } from 'react';
import { BattleView } from './BattleView.tsx';
import { DeploymentScreen } from './DeploymentScreen.tsx';
import { FormationScreen } from './FormationScreen.tsx';
import { InterstitialRunner } from './interstitial/InterstitialRunner.tsx';
import { buildDeployedBattleConfig, type DeploymentResult } from './deployment-config.ts';
import {
  M1_CAMPAIGN_GRAPH,
  battleWasWon,
  buildInterstitial,
  clearSavedCampaign,
  currentNode,
  deployableRoster,
  foldCampaignRoster,
  isComplete,
  requireBattle,
  resolveWin,
  routeToNode,
  saveCampaign,
  summarizeBattleResult,
  type BeatOutput,
  type CampaignState,
  type CampaignUnit,
  type InterstitialBeat,
} from '@campaign/index.ts';
import type { BattleConfig, Catalog, GameState, TeamId } from '@engine/index.ts';

type SubScreen = 'formation' | 'deployment' | 'battle' | 'interstitial';

// The captured between-node phase: the beats to run plus the resolved state
// the completion handler routes from. `resolved` is the post-apply-back state
// on a win, or the unchanged state on a loss (retry).
interface InterstitialSession {
  readonly beats: ReadonlyArray<InterstitialBeat>;
  readonly resolved: CampaignState;
  readonly won: boolean;
  readonly complete: boolean;
}

export interface CampaignAppProps {
  // The starting state — a fresh `startCampaign(...)` or a resumed save.
  // (The owner has already autosaved it; CampaignApp saves on each advance.)
  readonly initialState: CampaignState;
  readonly catalog: Catalog;
  readonly onExitToTitle: () => void;
}

const GRAPH = M1_CAMPAIGN_GRAPH;

export function CampaignApp({ initialState, catalog, onExitToTitle }: CampaignAppProps): ReactElement {
  const [state, setState] = useState<CampaignState>(initialState);
  const [sub, setSub] = useState<SubScreen>('formation');
  // The fold + deployment-in-progress config for the current node.
  const [fightConfig, setFightConfig] = useState<BattleConfig | null>(null);
  // The active between-node interstitial (null outside it). A nonce keys the
  // runner so each interstitial mounts fresh (resets its beat cursor).
  const [interstitial, setInterstitial] = useState<InterstitialSession | null>(null);
  const [interstitialNonce, setInterstitialNonce] = useState(0);

  // Position always resolves — currentNodeId holds at the (possibly terminal)
  // node; the phase, not the node lookup, carries completion.
  const node = currentNode(GRAPH, state);
  const battle = requireBattle(node);

  function handleFormationConfirm(selected: ReadonlyArray<CampaignUnit>): void {
    const folded = foldCampaignRoster(battle.template, selected, battle.playerTeam, catalog);
    setFightConfig(stampControls(folded, battle.playerTeam));
    setSub('deployment');
  }

  function handleDeploymentCommit(result: DeploymentResult): void {
    setFightConfig((prev) => (prev === null ? prev : buildDeployedBattleConfig(prev, result)));
    setSub('battle');
  }

  function handleBattleEnd(finalState: GameState): void {
    const result = summarizeBattleResult(finalState);
    const won = battleWasWon(result, node);
    const resolved = won ? resolveWin(state, GRAPH, result, finalState, catalog) : state;
    const complete = won && isComplete(resolved);
    // Terminal win: drop the save immediately (M0 parity — Resume goes dark,
    // reloading on the victory beat returns to a clean title).
    if (complete) clearSavedCampaign();

    const beats = buildInterstitial({
      graph: GRAPH,
      node,
      roster: resolved.roster,
      result,
      won,
      campaignComplete: complete,
    });

    setInterstitial({ beats, resolved, won, complete });
    setInterstitialNonce((n) => n + 1);
    setState(resolved);
    setSub('interstitial');
  }

  function handleInterstitialComplete(output: BeatOutput): void {
    const session = interstitial;
    setInterstitial(null);
    if (session === null) return;

    if (!session.won) {
      // Loss → retry the same node from the unchanged state (== the autosave).
      setFightConfig(null);
      setSub('formation');
      return;
    }
    if (session.complete) {
      // Terminal win — the victory beat was shown, the save already cleared.
      onExitToTitle();
      return;
    }
    // Non-terminal win → route along the chosen win-edge, autosave at the next
    // node (the retry checkpoint), and enter its formation.
    const nextNodeId = output.nextNodeId;
    if (nextNodeId === undefined) {
      throw new Error('CampaignApp: non-terminal win interstitial produced no route');
    }
    const routed = routeToNode(session.resolved, GRAPH, nextNodeId);
    saveCampaign(routed);
    setState(routed);
    setFightConfig(null);
    setSub('formation');
  }

  if (sub === 'interstitial' && interstitial !== null) {
    return (
      <InterstitialRunner
        key={interstitialNonce}
        beats={interstitial.beats}
        onComplete={handleInterstitialComplete}
        onExitToTitle={onExitToTitle}
      />
    );
  }

  if (sub === 'formation') {
    return (
      <FormationScreen
        nodeName={node.name}
        roster={deployableRoster(state)}
        deployCap={battle.deployCap}
        catalog={catalog}
        onConfirm={handleFormationConfirm}
        onQuit={onExitToTitle}
      />
    );
  }

  if (sub === 'deployment' && fightConfig !== null) {
    return (
      <DeploymentScreen
        template={fightConfig}
        zones={battle.zones}
        deployingTeam={battle.playerTeam}
        onCommit={handleDeploymentCommit}
        onBack={() => setSub('formation')}
      />
    );
  }

  if (sub === 'battle' && fightConfig !== null) {
    return (
      <BattleView
        template={fightConfig}
        deploymentResult={null}
        onBattleEnd={handleBattleEnd}
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
// CampaignApp correct regardless of which template a node reuses.
function stampControls(config: BattleConfig, playerTeam: TeamId): BattleConfig {
  return {
    ...config,
    teams: config.teams.map((t) => ({
      ...t,
      control: t.id === playerTeam ? 'human' : 'ai',
    })),
  };
}
