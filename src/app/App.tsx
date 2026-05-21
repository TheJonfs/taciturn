// App — the top-level screen selector.
//
// Session 34 introduced simple state-based routing (title → setup →
// battle). Session 43 generalizes the setup pipeline to two teams: each
// team is built in sequence through the same team builder, each carries
// a Human/AI control flag chosen on the setup screen, and each human
// team gets a manual deployment phase (AI teams deploy via the heuristic
// in `computeAiDeploymentResult`). Pass-and-play handoff prompts sit
// between phases when control changes hands. The graph is still small
// and known, so no router library.

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { flushSync } from 'react-dom';
import { BattleView } from './BattleView.tsx';
import { TitleScreen } from './TitleScreen.tsx';
import { BattleSetupScreen } from './BattleSetupScreen.tsx';
import { TeamBuilderScreen } from './TeamBuilderScreen.tsx';
import { DeploymentScreen } from './DeploymentScreen.tsx';
import { HandoffScreen } from './HandoffScreen.tsx';
import { ErrorSurface } from './error-surface.tsx';
import {
  buildDeployedBattleConfig,
  computeAiDeploymentResult,
  type DeploymentResult,
} from './deployment-config.ts';
import { loadDefaultCatalog } from '@content/index.ts';
import { riverRidgeBattle } from '@content/battles/river-ridge-battle.ts';
import { buildTeamBattleConfig, type BuiltTeam } from '@content/teams/index.ts';
import type { BattleConfig, Catalog, TeamControl, TeamId } from '@engine/index.ts';
import { TEAM_PALETTE, TEAM_PALETTE_FALLBACK_CSS } from '@renderer/index.ts';
import type { TeamBuilderState } from '@ui/index.ts';

type Screen = 'title' | 'setup' | 'teamBuilder' | 'deployment' | 'battle';
type Slot = 0 | 1;

const TEAM_IDS: readonly [TeamId, TeamId] = [
  riverRidgeBattle.teams[0]!.id,
  riverRidgeBattle.teams[1]!.id,
];
const TEAM_NAMES: readonly [string, string] = [
  riverRidgeBattle.teams[0]!.name,
  riverRidgeBattle.teams[1]!.name,
];

function teamCss(team: TeamId): string {
  return TEAM_PALETTE.get(team)?.css ?? TEAM_PALETTE_FALLBACK_CSS;
}

interface Handoff {
  readonly title: string;
  readonly body: string;
  readonly cta: string;
  readonly accent: string;
}

export function App() {
  const [screen, setScreen] = useState<Screen>('title');

  // Catalog held in a ref one-shot (stable identity across Fast Refresh,
  // same discipline as the battle screens). Used to compute AI teams'
  // heuristic deployments before the battle starts.
  const catalogRef = useRef<Catalog | null>(null);
  if (catalogRef.current === null) {
    catalogRef.current = loadDefaultCatalog();
  }
  const catalog = catalogRef.current;

  // Per-team control, chosen on the setup screen. Default Team A human /
  // Team B AI — the classic single-player flow.
  const [controls, setControls] = useState<readonly [TeamControl, TeamControl]>([
    'human',
    'ai',
  ]);

  // The team being built right now (0 = Team A, 1 = Team B). The builder
  // runs once per slot in sequence.
  const [builderSlot, setBuilderSlot] = useState<Slot>(0);
  // Assembled teams (null until built). Index by slot.
  const builtTeamsRef = useRef<[BuiltTeam | null, BuiltTeam | null]>([null, null]);
  // In-progress builder drafts per slot, so back-navigation doesn't lose
  // work (S37 lift, applied per team).
  const [drafts, setDrafts] = useState<[TeamBuilderState | null, TeamBuilderState | null]>([
    null,
    null,
  ]);

  // The progressively-folded battle config: starts as both teams folded
  // in (with AI heuristic deployments applied), then each human
  // deployment is folded on top before the next phase. `null` until both
  // teams are built.
  const [deployedConfig, setDeployedConfig] = useState<BattleConfig | null>(null);
  // Human teams still needing a manual deployment, in turn order, and a
  // cursor into that queue.
  const [deployQueue, setDeployQueue] = useState<ReadonlyArray<TeamId>>([]);
  const [deployIndex, setDeployIndex] = useState<number>(0);

  // Pass-and-play handoff prompt. When non-null it overlays everything;
  // `handoffNextRef` holds the continuation run on confirm (a ref so the
  // callback never goes stale across renders).
  const [handoff, setHandoff] = useState<Handoff | null>(null);
  const handoffNextRef = useRef<() => void>(() => {});
  const showHandoff = useCallback((h: Handoff, next: () => void): void => {
    handoffNextRef.current = next;
    setHandoff(h);
  }, []);
  const confirmHandoff = useCallback((): void => {
    const next = handoffNextRef.current;
    handoffNextRef.current = () => {};
    setHandoff(null);
    next();
  }, []);

  const [transitioning, setTransitioning] = useState<boolean>(false);
  useEffect(() => {
    if (screen === 'title' && transitioning) setTransitioning(false);
  }, [screen, transitioning]);

  const resetSetup = useCallback((): void => {
    builtTeamsRef.current = [null, null];
    setDrafts([null, null]);
    setBuilderSlot(0);
    setDeployedConfig(null);
    setDeployQueue([]);
    setDeployIndex(0);
    setHandoff(null);
  }, []);

  const goToTitle = useCallback(
    (fromBattle?: boolean) => {
      if (fromBattle === true) {
        flushSync(() => setTransitioning(true));
      }
      resetSetup();
      setScreen('title');
    },
    [resetSetup],
  );

  // ===== Setup pipeline =====

  // Assemble the two built teams onto River Ridge, stamping each team's
  // control flag. Placeholder positions come from the map template; they
  // get overwritten by deployment (human) or the heuristic (AI).
  const assemble = useCallback(
    (teamA: BuiltTeam, teamB: BuiltTeam): BattleConfig => {
      let cfg = buildTeamBattleConfig(riverRidgeBattle, teamA, TEAM_IDS[0]);
      cfg = buildTeamBattleConfig(cfg, teamB, TEAM_IDS[1]);
      return {
        ...cfg,
        teams: cfg.teams.map((t, i) => ({ ...t, control: controls[i] ?? t.control })),
      };
    },
    [controls],
  );

  // Begin the deployment pipeline once both teams are built: fold every
  // AI team's heuristic deployment, then route to manual deployment for
  // the human teams (or straight to battle if there are none).
  const beginDeployment = useCallback(
    (teamA: BuiltTeam, teamB: BuiltTeam): void => {
      const assembled = assemble(teamA, teamB);
      let folded = assembled;
      for (const team of assembled.teams) {
        if (team.control === 'ai') {
          folded = buildDeployedBattleConfig(
            folded,
            computeAiDeploymentResult(folded, catalog, team.id),
          );
        }
      }
      const humanQueue = assembled.teams
        .filter((t) => t.control === 'human')
        .map((t) => t.id);
      setDeployedConfig(folded);
      setDeployQueue(humanQueue);
      setDeployIndex(0);
      setScreen(humanQueue.length === 0 ? 'battle' : 'deployment');
    },
    [assemble, catalog],
  );

  const handleBuilderContinue = useCallback(
    (team: BuiltTeam): void => {
      const slot = builderSlot;
      builtTeamsRef.current[slot] = team;
      if (slot === 0) {
        const goBuildB = (): void => {
          setBuilderSlot(1);
          setScreen('teamBuilder');
        };
        // A handoff before building Team B only makes sense when a
        // *different* human is about to build it (pass-and-play). When
        // the same person configures both sides (human-vs-AI, AI-vs-AI),
        // skip straight through.
        if (controls[0] === 'human' && controls[1] === 'human') {
          showHandoff(
            {
              title: `${TEAM_NAMES[1]} — your turn`,
              body: `Pass the device to the ${TEAM_NAMES[1]} player to build their team.`,
              cta: 'Build team',
              accent: teamCss(TEAM_IDS[1]),
            },
            goBuildB,
          );
        } else {
          goBuildB();
        }
        return;
      }
      // Slot 1 done — both teams built.
      beginDeployment(builtTeamsRef.current[0]!, team);
    },
    [builderSlot, controls, showHandoff, beginDeployment],
  );

  const handleDeploymentCommit = useCallback(
    (result: DeploymentResult): void => {
      setDeployedConfig((prev) => (prev === null ? prev : buildDeployedBattleConfig(prev, result)));
      const nextIndex = deployIndex + 1;
      if (nextIndex >= deployQueue.length) {
        setScreen('battle');
        return;
      }
      const nextTeam = deployQueue[nextIndex]!;
      const nextName = TEAM_NAMES[TEAM_IDS.indexOf(nextTeam) as 0 | 1];
      showHandoff(
        {
          title: `${nextName} — deploy`,
          body: `Pass the device to the ${nextName} player to place their units.`,
          cta: 'Deploy',
          accent: teamCss(nextTeam),
        },
        () => {
          setDeployIndex(nextIndex);
          setScreen('deployment');
        },
      );
    },
    [deployIndex, deployQueue, showHandoff],
  );

  const setDraftForSlot = useCallback(
    (draft: TeamBuilderState): void => {
      setDrafts((prev) => {
        const next: [TeamBuilderState | null, TeamBuilderState | null] = [prev[0], prev[1]];
        next[builderSlot] = draft;
        return next;
      });
    },
    [builderSlot],
  );

  const deployingTeam = deployQueue[deployIndex];

  return (
    <div style={shellStyle}>
      {screen === 'title' && <TitleScreen onStart={() => setScreen('setup')} />}

      {screen === 'setup' && (
        <BattleSetupScreen
          controls={controls}
          onControlsChange={setControls}
          onStart={() => {
            // Re-enter the builder at Team A. Drafts persist across the
            // Setup ↔ Builder round-trip (S37); only return-to-title
            // clears them (`goToTitle` → `resetSetup`).
            setBuilderSlot(0);
            setScreen('teamBuilder');
          }}
          onBack={goToTitle}
        />
      )}

      {screen === 'teamBuilder' && (
        <TeamBuilderScreen
          key={builderSlot}
          teamLabel={`Team ${builderSlot === 0 ? 'A' : 'B'} (${TEAM_NAMES[builderSlot]})`}
          control={controls[builderSlot]!}
          continueLabel={builderSlot === 0 ? 'Continue to Team B' : 'Continue to Deployment'}
          initialDraft={drafts[builderSlot]}
          onDraftChange={setDraftForSlot}
          onContinue={handleBuilderContinue}
          onBack={() => setScreen('setup')}
        />
      )}

      {screen === 'deployment' && deployedConfig !== null && deployingTeam !== undefined && (
        <DeploymentScreen
          key={deployingTeam}
          template={deployedConfig}
          deployingTeam={deployingTeam}
          onCommit={handleDeploymentCommit}
          onBack={() => setScreen('setup')}
        />
      )}

      {screen === 'battle' && deployedConfig !== null && (
        <BattleView
          template={deployedConfig}
          deploymentResult={null}
          onExitToSetup={() => setScreen('setup')}
          onExitToTitle={() => goToTitle(true)}
        />
      )}

      {/* Pass-and-play handoff prompt — overlays whatever phase is
          mounted underneath until the incoming player confirms. */}
      {handoff !== null && (
        <div style={handoffOverlayStyle}>
          <HandoffScreen
            title={handoff.title}
            body={handoff.body}
            cta={handoff.cta}
            accent={handoff.accent}
            onConfirm={confirmHandoff}
          />
        </div>
      )}

      <ErrorSurface />
      {transitioning && <TransitionOverlay label="Returning to Main Menu…" />}
    </div>
  );
}

// Full-screen overlay shown during slow screen transitions (the
// battle → title route, primarily).
function TransitionOverlay({ label }: { readonly label: string }) {
  return (
    <div style={transitionOverlayStyle} role="status" aria-live="polite">
      <div style={transitionLabelStyle}>{label}</div>
    </div>
  );
}

const shellStyle: CSSProperties = {
  width: '100vw',
  height: '100vh',
  overflow: 'hidden',
  background: '#0e0f12',
  color: '#e7e9ee',
  fontFamily: 'system-ui, sans-serif',
};

const handoffOverlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 9_000,
};

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
