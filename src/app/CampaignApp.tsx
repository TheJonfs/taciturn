// CampaignApp — the TABA M0 campaign flow driver.
//
// Wraps the pure battle as a state machine (campaign-decomposition §3),
// reusing the existing DeploymentScreen + BattleView through the additive
// `onBattleEnd` hook (ADR-0133). It owns the campaign sub-flow; the MW
// setup chain is untouched.
//
//   formation → (fold roster) → deployment → battle → onBattleEnd
//     win  → apply-back + advance + autosave → next node's formation,
//            or the victory screen past the last node
//     loss → defeat screen → retry (re-enter the node from the autosave) /
//            quit. A loss runs no apply-back, so the failed attempt is
//            discarded wholesale.
//
// The catalog, roster, node graph, and persistence all come from the
// campaign shell; this component is just the React glue.

import { useState, type CSSProperties, type ReactElement } from 'react';
import { BattleView } from './BattleView.tsx';
import { DeploymentScreen } from './DeploymentScreen.tsx';
import { FormationScreen } from './FormationScreen.tsx';
import { buildDeployedBattleConfig, type DeploymentResult } from './deployment-config.ts';
import {
  M0_NODE_GRAPH,
  advanceOnWin,
  battleWasWon,
  currentNode,
  deployableRoster,
  foldCampaignRoster,
  isComplete,
  saveCampaign,
  summarizeBattleResult,
  type CampaignNode,
  type CampaignState,
  type CampaignUnit,
} from '@campaign/index.ts';
import type { BattleConfig, Catalog, GameState, TeamId } from '@engine/index.ts';

type SubScreen = 'formation' | 'deployment' | 'battle' | 'victory' | 'defeat';

export interface CampaignAppProps {
  // The starting state — a fresh `startCampaign(...)` or a resumed save.
  // (The owner has already autosaved it; CampaignApp saves on each advance.)
  readonly initialState: CampaignState;
  readonly catalog: Catalog;
  readonly onExitToTitle: () => void;
}

export function CampaignApp({ initialState, catalog, onExitToTitle }: CampaignAppProps): ReactElement {
  const [state, setState] = useState<CampaignState>(initialState);
  const [sub, setSub] = useState<SubScreen>(() =>
    isComplete(initialState) ? 'victory' : 'formation',
  );
  // The fold + deployment-in-progress config for the current node.
  const [fightConfig, setFightConfig] = useState<BattleConfig | null>(null);

  // Safe while in progress; the victory branch never reads it.
  const node: CampaignNode | null = isComplete(state)
    ? null
    : currentNode(M0_NODE_GRAPH, state);

  function handleFormationConfirm(selected: ReadonlyArray<CampaignUnit>): void {
    if (node === null) return;
    const folded = foldCampaignRoster(node.template, selected, node.playerTeam, catalog);
    setFightConfig(stampControls(folded, node.playerTeam));
    setSub('deployment');
  }

  function handleDeploymentCommit(result: DeploymentResult): void {
    setFightConfig((prev) => (prev === null ? prev : buildDeployedBattleConfig(prev, result)));
    setSub('battle');
  }

  function handleBattleEnd(finalState: GameState): void {
    if (node === null) return;
    const result = summarizeBattleResult(finalState);
    if (!battleWasWon(result, node)) {
      setSub('defeat');
      return;
    }
    const next = advanceOnWin(state, M0_NODE_GRAPH, result, finalState, catalog);
    saveCampaign(next); // autosave positioned at the next node (the retry checkpoint)
    setState(next);
    setFightConfig(null);
    setSub(isComplete(next) ? 'victory' : 'formation');
  }

  // Retry re-enters the current node from the autosave. `state` was not
  // advanced on the loss, so it already equals that checkpoint.
  function handleRetry(): void {
    setFightConfig(null);
    setSub('formation');
  }

  if (sub === 'victory') {
    return (
      <EndScreen
        kind="victory"
        title="Campaign Complete"
        body="Your company fought through every battle and made it there — and back again."
        onExitToTitle={onExitToTitle}
      />
    );
  }

  if (sub === 'defeat' && node !== null) {
    return (
      <EndScreen
        kind="defeat"
        title="Defeat"
        body={`Your company was routed at ${node.name}. Retry from your last save, or return to the title.`}
        onRetry={handleRetry}
        onExitToTitle={onExitToTitle}
      />
    );
  }

  if (node === null) {
    // Defensive: in-progress with no node would be a graph/index bug.
    return (
      <EndScreen
        kind="defeat"
        title="Campaign Error"
        body="The campaign reached an invalid node. Returning to the title is safe."
        onExitToTitle={onExitToTitle}
      />
    );
  }

  if (sub === 'formation') {
    return (
      <FormationScreen
        nodeName={node.name}
        nodeIndex={state.nodeIndex}
        nodeCount={M0_NODE_GRAPH.length}
        roster={deployableRoster(state)}
        deployCap={node.deployCap}
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
        zones={node.zones}
        deployingTeam={node.playerTeam}
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

// ---- end screens (victory / defeat) ----

interface EndScreenProps {
  readonly kind: 'victory' | 'defeat';
  readonly title: string;
  readonly body: string;
  readonly onRetry?: () => void;
  readonly onExitToTitle: () => void;
}

function EndScreen({ kind, title, body, onRetry, onExitToTitle }: EndScreenProps): ReactElement {
  return (
    <div style={endRootStyle}>
      <div style={endPanelStyle}>
        <h1 style={{ ...endTitleStyle, color: kind === 'victory' ? '#9fe0a8' : '#e09f9f' }}>
          {title}
        </h1>
        <p style={endBodyStyle}>{body}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          {onRetry !== undefined && (
            <button type="button" style={endPrimaryStyle} onClick={onRetry}>
              Retry Battle
            </button>
          )}
          <button
            type="button"
            style={onRetry !== undefined ? endSecondaryStyle : endPrimaryStyle}
            onClick={onExitToTitle}
          >
            Return to Title
          </button>
        </div>
      </div>
    </div>
  );
}

const endRootStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#0e0f12',
};

const endPanelStyle: CSSProperties = {
  width: 460,
  padding: '28px 32px',
  textAlign: 'center',
  background: '#16181d',
  border: '1px solid #2c2f36',
  borderRadius: 8,
};

const endTitleStyle: CSSProperties = { margin: '0 0 12px', fontSize: 24, fontWeight: 700 };
const endBodyStyle: CSSProperties = {
  margin: '0 0 22px',
  fontSize: 14,
  lineHeight: 1.5,
  color: '#c7ccd6',
};

const endButtonBaseStyle: CSSProperties = {
  padding: '10px 18px',
  fontSize: 14,
  borderRadius: 5,
  borderWidth: 1,
  borderStyle: 'solid',
  fontFamily: 'inherit',
  cursor: 'pointer',
};

const endPrimaryStyle: CSSProperties = {
  ...endButtonBaseStyle,
  background: '#2a3140',
  color: '#e7e9ee',
  borderColor: '#3a4150',
};

const endSecondaryStyle: CSSProperties = {
  ...endButtonBaseStyle,
  background: '#1c1e23',
  color: '#c7ccd6',
  borderColor: '#2c2f36',
};
