// App — the top-level screen selector.
//
// Session 34 (Phase E kickoff): v1's navigation graph is small and known
// — title, battle setup, and the battle itself (the results screen is an
// overlay *inside* `BattleView`, not a separate screen). Simple
// state-based routing is the minimum viable shape; no router library.
// If the screen graph grows (deep-linking, settings sub-pages), a router
// migration is a small, deliberate change later.

import { useMemo, useState } from 'react';
import { BattleView } from './BattleView.tsx';
import { TitleScreen } from './TitleScreen.tsx';
import { BattleSetupScreen } from './BattleSetupScreen.tsx';
import { TeamBuilderScreen } from './TeamBuilderScreen.tsx';
import { DeploymentScreen } from './DeploymentScreen.tsx';
import type { DeploymentResult } from './deployment-config.ts';
import { riverRidgeBattle } from '@content/battles/river-ridge-battle.ts';
import { buildTeamBattleConfig, type BuiltTeam } from '@content/teams/index.ts';

type Screen = 'title' | 'setup' | 'teamBuilder' | 'deployment' | 'battle';

export function App() {
  const [screen, setScreen] = useState<Screen>('title');
  // The team assembled in the team builder (Session 36). `null` until
  // the player completes the builder; the deployment phase and battle
  // are folded onto this team's config.
  const [builtTeam, setBuiltTeam] = useState<BuiltTeam | null>(null);
  // The committed deployment, threaded from DeploymentScreen into
  // BattleView. `null` until the player commits a deployment (and on
  // the title / setup screens). Per Session 35 (Phase E).
  const [deploymentResult, setDeploymentResult] = useState<DeploymentResult | null>(null);

  // The battle config the deployment phase + battle run against: River
  // Ridge with the built team folded into team_a. Falls back to the
  // authored River Ridge roster when no team has been built yet (kept
  // so the downstream screens stay launchable in isolation).
  const teamBattleConfig = useMemo(
    () =>
      builtTeam !== null
        ? buildTeamBattleConfig(
            riverRidgeBattle,
            builtTeam,
            riverRidgeBattle.teams[0]!.id,
          )
        : riverRidgeBattle,
    [builtTeam],
  );

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: '#0e0f12',
        color: '#e7e9ee',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {screen === 'title' && <TitleScreen onStart={() => setScreen('setup')} />}
      {screen === 'setup' && (
        <BattleSetupScreen
          onStart={() => setScreen('teamBuilder')}
          onBack={() => setScreen('title')}
        />
      )}
      {screen === 'teamBuilder' && (
        <TeamBuilderScreen
          onContinue={(team) => {
            setBuiltTeam(team);
            setScreen('deployment');
          }}
          onBack={() => setScreen('setup')}
        />
      )}
      {screen === 'deployment' && (
        // Conditional render means leaving 'deployment' fully unmounts
        // `DeploymentScreen` — its mount-effect cleanup tears down Pixi.
        <DeploymentScreen
          template={teamBattleConfig}
          onCommit={(result) => {
            setDeploymentResult(result);
            setScreen('battle');
          }}
          onBack={() => setScreen('teamBuilder')}
        />
      )}
      {screen === 'battle' && (
        // Conditional render means leaving 'battle' fully unmounts
        // `BattleView` — its mount-effect cleanup tears down Pixi, and
        // re-entry mounts a fresh battle. No `key` needed.
        <BattleView
          template={teamBattleConfig}
          deploymentResult={deploymentResult}
          onExitToSetup={() => setScreen('setup')}
          onExitToTitle={() => setScreen('title')}
        />
      )}
    </div>
  );
}
