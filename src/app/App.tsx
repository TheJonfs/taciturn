// App — the top-level screen selector.
//
// Session 34 (Phase E kickoff): v1's navigation graph is small and known
// — title, battle setup, and the battle itself (the results screen is an
// overlay *inside* `BattleView`, not a separate screen). Simple
// state-based routing is the minimum viable shape; no router library.
// If the screen graph grows (deep-linking, settings sub-pages), a router
// migration is a small, deliberate change later.

import { useState } from 'react';
import { BattleView } from './BattleView.tsx';
import { TitleScreen } from './TitleScreen.tsx';
import { BattleSetupScreen } from './BattleSetupScreen.tsx';
import { DeploymentScreen } from './DeploymentScreen.tsx';
import type { DeploymentResult } from './deployment-config.ts';

type Screen = 'title' | 'setup' | 'deployment' | 'battle';

export function App() {
  const [screen, setScreen] = useState<Screen>('title');
  // The committed deployment, threaded from DeploymentScreen into
  // BattleView. `null` until the player commits a deployment (and on
  // the title / setup screens). Per Session 35 (Phase E).
  const [deploymentResult, setDeploymentResult] = useState<DeploymentResult | null>(null);

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
          onStart={() => setScreen('deployment')}
          onBack={() => setScreen('title')}
        />
      )}
      {screen === 'deployment' && (
        // Conditional render means leaving 'deployment' fully unmounts
        // `DeploymentScreen` — its mount-effect cleanup tears down Pixi.
        <DeploymentScreen
          onCommit={(result) => {
            setDeploymentResult(result);
            setScreen('battle');
          }}
          onBack={() => setScreen('setup')}
        />
      )}
      {screen === 'battle' && (
        // Conditional render means leaving 'battle' fully unmounts
        // `BattleView` — its mount-effect cleanup tears down Pixi, and
        // re-entry mounts a fresh battle. No `key` needed.
        <BattleView
          deploymentResult={deploymentResult}
          onExitToSetup={() => setScreen('setup')}
          onExitToTitle={() => setScreen('title')}
        />
      )}
    </div>
  );
}
