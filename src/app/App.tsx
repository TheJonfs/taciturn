// App — the top-level screen selector.
//
// Session 34 (Phase E kickoff): v1's navigation graph is small and known
// — title, battle setup, and the battle itself (the results screen is an
// overlay *inside* `BattleView`, not a separate screen). Simple
// state-based routing is the minimum viable shape; no router library.
// If the screen graph grows (deep-linking, settings sub-pages), a router
// migration is a small, deliberate change later.

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { flushSync } from 'react-dom';
import { BattleView } from './BattleView.tsx';
import { TitleScreen } from './TitleScreen.tsx';
import { BattleSetupScreen } from './BattleSetupScreen.tsx';
import { TeamBuilderScreen } from './TeamBuilderScreen.tsx';
import { DeploymentScreen } from './DeploymentScreen.tsx';
import { ErrorSurface } from './error-surface.tsx';
import type { DeploymentResult } from './deployment-config.ts';
import { riverRidgeBattle } from '@content/battles/river-ridge-battle.ts';
import {
  assignAiTeamNames,
  buildTeamBattleConfig,
  type BuiltTeam,
} from '@content/teams/index.ts';
import type { TeamBuilderState } from '@ui/index.ts';

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
  // The in-progress team-builder draft (Session 37). Lifted out of
  // `TeamBuilderScreen`'s local state so the draft survives screen
  // back-navigation (team builder ↔ setup ↔ deployment). Cleared on
  // return-to-title and on battle start (commit = team committed).
  const [teamDraft, setTeamDraft] = useState<TeamBuilderState | null>(null);
  // Transition flag — when set, a "Returning to Main Menu…" overlay
  // is rendered over everything else. Used to mask the ~5s lag when
  // the battle view unmounts (Pixi destroy + React reconciliation of
  // a large engine tree). Reported in 2026-05-17 playtest; cleared
  // by an effect when the title screen mounts. Root-cause profiling
  // is deferred — this hides the perceived lag without misleading
  // the player.
  const [transitioning, setTransitioning] = useState<boolean>(false);

  // When the title screen lands, clear the transition overlay. The
  // overlay covered the unmount lag; once we're on title the overlay
  // can come down (the next paint is the title screen itself).
  useEffect(() => {
    if (screen === 'title' && transitioning) {
      setTransitioning(false);
    }
  }, [screen, transitioning]);

  // Centralized title-return clears the in-flight team draft per S37
  // decision 1's clearing semantics. Use this anywhere a screen routes
  // back to the title.
  //
  // When routing from inside an active battle (`fromBattle: true`),
  // `flushSync` the transition flag first so the overlay paints
  // *before* the slow `setScreen('title')` triggers BattleView's
  // unmount + Pixi teardown. Without flushSync, React batches both
  // state updates into one render and the overlay never gets a paint
  // cycle before the lag begins.
  const goToTitle = useCallback((fromBattle?: boolean) => {
    // `fromBattle === true` check (not truthy) is intentional: this
    // callback is passed directly as an onClick handler in some places
    // (BattleSetupScreen onBack), and React would call it with the
    // synthetic event as the first arg — which would coerce to truthy
    // and trigger the overlay on a fast Setup→Title transition.
    if (fromBattle === true) {
      flushSync(() => setTransitioning(true));
    }
    setTeamDraft(null);
    setScreen('title');
  }, []);

  // The battle config the deployment phase + battle run against: River
  // Ridge with the built team folded into team_a, then the AI's team_b
  // re-labeled with Ivalician names that don't collide with the
  // player's. Falls back to the authored River Ridge roster (with its
  // placeholder names) when no team has been built yet so downstream
  // screens stay launchable in isolation.
  //
  // useMemo's caching keeps the AI names stable through deployment +
  // battle for one committed team and re-rolls on the next commit (per
  // S38 plan).
  const teamBattleConfig = useMemo(() => {
    if (builtTeam === null) return riverRidgeBattle;
    const playerTeamId = riverRidgeBattle.teams[0]!.id;
    const aiTeamId = riverRidgeBattle.teams[1]!.id;
    const merged = buildTeamBattleConfig(riverRidgeBattle, builtTeam, playerTeamId);
    return assignAiTeamNames(
      merged,
      aiTeamId,
      new Set(builtTeam.units.map((u) => u.name)),
    );
  }, [builtTeam]);

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
          onBack={goToTitle}
        />
      )}
      {screen === 'teamBuilder' && (
        <TeamBuilderScreen
          initialDraft={teamDraft}
          onDraftChange={setTeamDraft}
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
            // Battle-start clear per S37: deployment commit = team
            // committed; next entry to the team builder starts fresh.
            setTeamDraft(null);
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
          onExitToTitle={() => goToTitle(true)}
        />
      )}
      {/* Global error-capture surface — shows a floating banner when the
          installed `window.error` / `unhandledrejection` listeners pick
          up an exception that bypassed the React error boundary. Per the
          post-S38 white-flash incident debrief. */}
      <ErrorSurface />
      {/* Transition overlay — covers the ~5s perceived lag between
          clicking Main Menu in the battle results screen and the title
          screen actually rendering. Painted before the slow unmount via
          flushSync in `goToTitle`. */}
      {transitioning && <TransitionOverlay label="Returning to Main Menu…" />}
    </div>
  );
}

// Full-screen overlay shown during slow screen transitions (the
// battle → title route, primarily). Painted via flushSync so it
// appears on a separate render tick from the slow `setScreen` that
// triggers BattleView's unmount. Visually a centered label over a
// dim backdrop; matches the rest of the HUD's font / color tokens.
function TransitionOverlay({ label }: { readonly label: string }) {
  return (
    <div style={transitionOverlayStyle} role="status" aria-live="polite">
      <div style={transitionLabelStyle}>{label}</div>
    </div>
  );
}

const transitionOverlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 10_000,
  background: 'rgba(14, 15, 18, 0.92)',
  color: '#e7e9ee',
  fontFamily: 'system-ui, sans-serif',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 18,
  letterSpacing: '0.06em',
};

const transitionLabelStyle: CSSProperties = {
  opacity: 0.85,
  animation: 'taciturn-pulse 1.2s ease-in-out infinite',
};

// Inject a keyframes rule for the label's gentle pulse. Runs once on
// module load; idempotent (the if-check prevents duplicates under HMR).
if (typeof document !== 'undefined') {
  const STYLE_ID = 'taciturn-transition-keyframes';
  if (document.getElementById(STYLE_ID) === null) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent =
      '@keyframes taciturn-pulse { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }';
    document.head.appendChild(style);
  }
}
