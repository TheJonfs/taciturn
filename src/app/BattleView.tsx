// BattleView — React component that owns the runtime lifecycle for
// rendering a single battle.
//
// Session 23 posture: interaction layer live. Team A is player-driven
// via the turn-flow state machine (`useTurnFlow`) feeding a
// `UiController`; Team B is basic AI. ESC opens a pause overlay that
// halts both the orchestrator pump and the renderer's animator.
//
// What this component owns:
//   - Catalog load + initial GameState construction.
//   - PixiJS Application init + BattleRenderer mount.
//   - DemoOrchestrator pump on the Pixi ticker, suspended while paused.
//   - Camera input listeners (WASD pan, mouse wheel zoom).
//   - ESC keyboard binding: cancel out of a picking sub-state, else
//     open the pause overlay.
//   - The React HUD layout (4-region shell + optional pause overlay).
//   - Settings provider scoped to the battle.
//
// The battle config consumed at runtime arrives as the `template`
// prop — River Ridge with the team builder's assembled team folded
// into team_a (Session 36). `demoBattle` remains the engine smoke-test
// fixture (consumed by `orchestrator.test.ts` and
// `ai-controller.integration.test.ts`).

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Application } from 'pixi.js';
import { BattleErrorBoundary } from './BattleErrorBoundary.tsx';
import {
  recordWebglContextLost,
  recordWebglContextRestored,
} from './error-surface.tsx';
import { buildDeployedBattleConfig, type DeploymentResult } from './deployment-config.ts';
import { loadDefaultCatalog } from '@content/index.ts';
import {
  createInitialState,
  enumeratePreBattleActions,
  type BattleConfig,
  type Catalog,
  type ChargedActionId,
  type GameState,
  type TeamId,
  type UnitId,
} from '@engine/index.ts';
import {
  BattleRenderer,
  TEAM_PALETTE,
  TEAM_PALETTE_FALLBACK_CSS,
  type PanInput,
} from '@renderer/index.ts';
import {
  BattleHud,
  ChargedActionDetailPanel,
  ForecastTooltip,
  PauseOverlay,
  ResultsScreen,
  TurnTransitionAlert,
  UnitDetailPanel,
  useSettings,
  useTurnFlow,
} from '@ui/index.ts';
import { HandoffScreen } from './HandoffScreen.tsx';
import {
  createBasicAiController,
  createUiController,
  type UiController,
} from './controllers/index.ts';
import {
  DemoOrchestrator,
  type ControllerMap,
} from './demo/index.ts';

const BACKGROUND = '#0e0f12';

// Wheel-zoom step. A 100px wheel delta produces this much zoom-factor
// change. Tuned so a single notch on a typical mouse wheel feels like
// a discrete zoom step rather than a snap.
const WHEEL_ZOOM_STEP = 0.0015;

export interface BattleViewProps {
  // The battle config to run — River Ridge with the team builder's
  // assembled team folded into team_a (Session 36). `App` derives it;
  // `BattleView` folds the deployment result on top before
  // `createInitialState`.
  readonly template: BattleConfig;
  // The committed deployment from `DeploymentScreen` (Session 35).
  // `null` falls back to the template's placeholder placements — kept
  // so the battle is still launchable in isolation (tests, a future
  // skip-deployment debug path).
  readonly deploymentResult: DeploymentResult | null;
  // Navigation out of the battle, surfaced on the results screen.
  readonly onExitToSetup: () => void;
  readonly onExitToTitle: () => void;
}

export function BattleView(props: BattleViewProps) {
  // Settings come from the app-root `SettingsProvider` (main.tsx) so the
  // pause-menu toggles persist across screens and the pre-battle phases
  // (App's pass-and-play handoffs) read the same flags.
  return (
    <BattleErrorBoundary>
      <BattleViewInner {...props} />
    </BattleErrorBoundary>
  );
}

function BattleViewInner({
  template,
  deploymentResult,
  onExitToSetup,
  onExitToTitle,
}: BattleViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // The catalog is loaded once and held in a ref — not `useMemo`. A ref
  // survives React Fast Refresh with stable identity; `useMemo` does
  // not (Fast Refresh recomputes it). A fresh `catalog` identity would
  // change the mount effect's deps (`[catalog, uiController]`) and force
  // a full Pixi teardown + re-init on every content-file edit — the S34
  // HMR root cause. Same pattern as `uiControllerRef` below.
  const catalogRef = useRef<Catalog | null>(null);
  if (catalogRef.current === null) {
    catalogRef.current = loadDefaultCatalog();
  }
  const catalog = catalogRef.current;

  // Engine state surfaced to React. Updated from inside the pump after
  // each commit. Renderer's visual state is independent.
  const [latestState, setLatestState] = useState<GameState | null>(null);
  const [renderer, setRenderer] = useState<BattleRenderer | null>(null);
  // `paused` is the modal ESC pause (opens the overlay menu). `halted` is
  // the lightweight on-screen Pause/Play toggle: it freezes the
  // orchestrator pump + animator without any overlay, so the player can
  // freely inspect units, the log, and tile details while play is stopped
  // (especially useful in AI-vs-AI). Either one halts the pump.
  const [paused, setPaused] = useState<boolean>(false);
  const [halted, setHalted] = useState<boolean>(false);
  const [detailUnitId, setDetailUnitId] = useState<UnitId | null>(null);
  const [chargedDetailId, setChargedDetailId] = useState<ChargedActionId | null>(null);
  // When the results screen has been dismissed by the user, we don't
  // re-show it on subsequent re-renders. Stored separately from
  // `latestState.outcome` so the player can close + re-open via... well,
  // they can't re-open in v1; "closed" is final until next battle.
  const [resultsDismissed, setResultsDismissed] = useState<boolean>(false);
  // Pass-and-play mid-battle handoff (S43). Non-null while the device is
  // changing hands between two human teams; the overlay blocks input
  // until the incoming player confirms. `lastHumanTeamRef` remembers the
  // previous human team so we only prompt on an actual human→human swap.
  const [battleHandoff, setBattleHandoff] = useState<{
    readonly name: string;
    readonly color: string;
  } | null>(null);
  const lastHumanTeamRef = useRef<TeamId | null>(null);

  // The UiController persists across renders — it's the orchestrator's
  // single-slot queue, not React state.
  const uiControllerRef = useRef<UiController | null>(null);
  if (uiControllerRef.current === null) {
    uiControllerRef.current = createUiController();
  }
  const uiController = uiControllerRef.current;

  const settingsApi = useSettings();
  // The teams a human at the keyboard drives. Defaults to whatever the
  // battle config marks `control: 'human'` — Team A in the classic
  // single-player flow, both teams in pass-and-play, neither in AI vs.
  // AI (in which case the action menu never activates and the AI
  // controllers run both sides).
  const humanTeams = useMemo(
    () => new Set(template.teams.filter((t) => t.control === 'human').map((t) => t.id)),
    [template],
  );

  // Turn-flow hook owns the player's per-turn state machine. It wires
  // the renderer's highlights / click / hover to the menu's choices
  // and submits proposed actions to the uiController on commit.
  const turnFlow = useTurnFlow({
    state: latestState,
    catalog,
    renderer,
    uiController,
    humanTeams,
    confirmStep: settingsApi.settings.confirmStep,
    onInspectUnit: (id) => setDetailUnitId(id),
  });

  // Mirror the paused/halted flags into the renderer so the animator
  // freezes for either the modal pause or the on-screen Pause toggle.
  useEffect(() => {
    renderer?.setPaused(paused || halted);
  }, [renderer, paused, halted]);

  // Mount the renderer + orchestrator on first render.
  useEffect(() => {
    const host = containerRef.current;
    if (host === null) return;

    let disposed = false;
    let cleanup: (() => void) | null = null;

    void (async () => {
      // Session 35-36: fold the deployment phase's chosen placements
      // into the `template` config (Blue's placements replaced, Red's
      // authored placements retained). `template` is itself the team
      // builder's output (River Ridge with team_a built by the player);
      // the engine is downstream-blind — `createInitialState` consumes
      // the result like any battle config. `null` deployment falls back
      // to the template's placeholder placements.
      const battleConfig =
        deploymentResult !== null
          ? buildDeployedBattleConfig(template, deploymentResult)
          : template;

      const initialState = createInitialState(battleConfig, catalog);
      // Per ADR-0071 (Session 32): equipment auto-status grants and the
      // ruleset-derived initial-CT randomization land as logged actions
      // commit by the orchestrator's pre-battle phase. Compute the queue
      // here so the orchestrator just plays it back.
      const preBattleActions = enumeratePreBattleActions(
        initialState,
        battleConfig,
        catalog,
      );

      const app = new Application();
      await app.init({
        background: BACKGROUND,
        antialias: true,
        resizeTo: host,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
      });

      // The async init may have raced an unmount.
      if (disposed) {
        app.destroy(true, { children: true, texture: false });
        return;
      }

      host.appendChild(app.canvas);
      // Capture the canvas element now. The cleanup function must not
      // read `app.canvas` after `battleRenderer.destroy()` runs
      // `app.destroy()` — the Pixi v8 getter reads through the (now
      // null) renderer and throws (S34 HMR root cause).
      const canvas = app.canvas;

      // WebGL context-loss handlers (post-S38 playtest debrief). The
      // canvas can lose its WebGL context under GPU pressure, browser
      // throttling, or driver issues. The browser default after a
      // context-loss event is to *not* attempt restoration — we
      // `preventDefault()` so the context can be restored. Both events
      // forward to the global error surface so the player sees a
      // banner with the same UX as other crashes.
      //
      // S50: contextRestored now triggers static-layer redraws against
      // the live renderer. Pre-S50 the handler only logged the event
      // and suggested a reload because partial-restore left the
      // elevation-label layer dark (the S38 / S50-reported symptom —
      // Text-based bitmaps don't auto-restore the way Graphics do).
      // `redrawStaticLayers` re-runs the static layer draw calls
      // against the cached map data, restoring the elevation numbers
      // and re-painting the cliff-edge + tile layers defensively.
      // Unit sprites self-heal via the orchestrator pump's per-frame
      // applyVisualState. The handler closure captures `battleRenderer`
      // by reference so the right renderer instance gets refreshed
      // even across Fast Refresh re-mounts.
      let restoreTargetRenderer: BattleRenderer | null = null;
      const onContextLost = (event: Event): void => {
        event.preventDefault();
        recordWebglContextLost('canvas.webglcontextlost fired');
      };
      const onContextRestored = (): void => {
        recordWebglContextRestored();
        restoreTargetRenderer?.redrawStaticLayers();
      };
      canvas.addEventListener('webglcontextlost', onContextLost as EventListener, false);
      canvas.addEventListener(
        'webglcontextrestored',
        onContextRestored as EventListener,
        false,
      );

      const battleRenderer = new BattleRenderer(app);
      restoreTargetRenderer = battleRenderer;
      battleRenderer.mount(initialState, catalog);
      setLatestState(initialState);
      setRenderer(battleRenderer);

      // Per-team dispatch (S43): each team routes to the UI controller
      // (shared — only one human acts at a time, even in pass-and-play)
      // or a fresh AI controller, per its `control` flag. Human-vs-AI,
      // pass-and-play, and AI-vs-AI all fall out of this one wiring.
      const controllers: ControllerMap = new Map(
        battleConfig.teams.map((team) => [
          team.id,
          team.control === 'human' ? uiController.controller : createBasicAiController(),
        ]),
      );
      const orchestrator = new DemoOrchestrator(
        initialState,
        catalog,
        controllers,
        preBattleActions,
      );

      // Camera input — keyboard for pan, wheel for zoom.
      const panState: { left: boolean; right: boolean; up: boolean; down: boolean } = {
        left: false,
        right: false,
        up: false,
        down: false,
      };
      const pushPan = () => {
        const input: PanInput = { ...panState };
        battleRenderer.setPanInput(input);
      };
      const setPanFlag = (key: string, on: boolean): boolean => {
        switch (key) {
          case 'w':
          case 'W':
          case 'ArrowUp':
            panState.up = on;
            return true;
          case 's':
          case 'S':
          case 'ArrowDown':
            panState.down = on;
            return true;
          case 'a':
          case 'A':
          case 'ArrowLeft':
            panState.left = on;
            return true;
          case 'd':
          case 'D':
          case 'ArrowRight':
            panState.right = on;
            return true;
          default:
            return false;
        }
      };
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.repeat) return;
        if (setPanFlag(e.key, true)) {
          e.preventDefault();
          pushPan();
        }
      };
      const onKeyUp = (e: KeyboardEvent) => {
        if (setPanFlag(e.key, false)) {
          e.preventDefault();
          pushPan();
        }
      };
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        const rect = app.canvas.getBoundingClientRect();
        const focal = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        };
        const factor = Math.exp(-e.deltaY * WHEEL_ZOOM_STEP);
        battleRenderer.applyZoomAt(factor, focal);
      };
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      canvas.addEventListener('wheel', onWheel, { passive: false });

      // Reflect host-element resizes into the camera.
      const resizeObserver = new ResizeObserver(() => {
        battleRenderer.setScreenSize(app.renderer.width, app.renderer.height);
      });
      resizeObserver.observe(host);

      // Pump: whenever the renderer's animator is idle, ask the
      // orchestrator for the next step and feed actions to the
      // renderer. Sync engine state into React after each commit.
      // Suspended while paused; the renderer also halts its animator
      // tick via `setPaused`.
      let finished = false;
      const pump = () => {
        if (finished) return;
        if (pausedRef.current || haltedRef.current) return;
        if (!battleRenderer.isIdle()) return;
        const step = orchestrator.step();
        if (step.committed.length > 0) {
          battleRenderer.playActions(step.committed, step.newState);
          setLatestState(step.newState);
        }
        if (step.rejection !== undefined) {
          // Session 31.5: a controller-submitted action was refused by
          // the engine (e.g., Don't Move's onActionAttempted block).
          // The flow's rAF idle poll handles the menu-return on the
          // next tick. Surface the reason for dev visibility; a player-
          // facing toast / status-line message is future polish.
          // eslint-disable-next-line no-console
          console.info(
            `[orchestrator] ${step.rejection.action.type} refused (${step.rejection.stage}): ${step.rejection.reason}`,
          );
        }
        if (step.done) {
          finished = true;
        }
      };
      app.ticker.add(pump);

      // Dev-only debug surface for browser-preview verification when the
      // tab is hidden (Pixi throttles its ticker; the pump never fires).
      if (import.meta.env.DEV) {
        let debugClock = performance.now();
        const debug = {
          tick: (ms = 16) => {
            debugClock += ms;
            app.ticker.update(debugClock);
          },
          pump: (n: number, msPerTick = 16) => {
            for (let i = 0; i < n; i++) {
              debugClock += msPerTick;
              app.ticker.update(debugClock);
            }
          },
          getState: () => orchestrator.getState(),
          isIdle: () => battleRenderer.isIdle(),
          fitMap: () => battleRenderer.fitMap(),
          uiSubmit: (action: import('@engine/index.ts').ProposedAction) => uiController.submit(action),
          uiEndTurn: () => uiController.endTurn(),
        };
        (window as unknown as { __taciturnDebug: typeof debug }).__taciturnDebug = debug;
      }

      cleanup = () => {
        finished = true;
        app.ticker.remove(pump);
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        canvas.removeEventListener('wheel', onWheel);
        canvas.removeEventListener(
          'webglcontextlost',
          onContextLost as EventListener,
          false,
        );
        canvas.removeEventListener(
          'webglcontextrestored',
          onContextRestored as EventListener,
          false,
        );
        resizeObserver.disconnect();
        battleRenderer.destroy();
        // `app.destroy(true, …)` (inside `battleRenderer.destroy()`)
        // detaches the canvas via `removeView`; this guarded removal is
        // a defensive no-op against the captured element, never the
        // post-destroy `app.canvas` getter.
        if (host.contains(canvas)) {
          host.removeChild(canvas);
        }
        // Drop the now-destroyed renderer/state from React state so the
        // post-cleanup tree sees the same clean slate as the initial
        // mount (`renderer === null`). Without this, a Fast Refresh
        // re-run of this effect leaves the destroyed `BattleRenderer` in
        // state, and `useTurnFlow`'s highlight effects call into it —
        // `setHighlights` on a destroyed Pixi context throws (S34 HMR
        // root cause, second layer). On a real unmount these setters are
        // harmless no-ops.
        setRenderer(null);
        setLatestState(null);
        if (import.meta.env.DEV) {
          delete (window as unknown as { __taciturnDebug?: unknown }).__taciturnDebug;
        }
      };
    })();

    return () => {
      disposed = true;
      if (cleanup !== null) cleanup();
    };
    // `template` and `deploymentResult` are props set once by `App`
    // when routing into the battle screen — stable for this BattleView's
    // lifetime and across Fast Refresh, so including them doesn't
    // reintroduce the S34 mount-effect churn.
  }, [catalog, uiController, template, deploymentResult]);

  // Mirror the paused/halted state into refs so the pump closure
  // (captured once on mount) can read the latest values without
  // re-registering.
  const pausedRef = useRef<boolean>(false);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  const haltedRef = useRef<boolean>(false);
  useEffect(() => {
    haltedRef.current = halted;
  }, [halted]);

  // ESC handler: cancel out of a picking sub-state if we're in one;
  // otherwise open / close the pause overlay. While the overlay is
  // open, ESC closes it (Resume).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      if (paused) {
        setPaused(false);
        return;
      }
      // If we're mid-pick, prefer cancel over pause.
      const kind = turnFlow.state.kind;
      if (
        kind === 'move-select' ||
        kind === 'command-set-select' ||
        kind === 'ability-list' ||
        kind === 'target-select' ||
        kind === 'await-confirm' ||
        kind === 'wait-confirm'
      ) {
        turnFlow.cancel();
        return;
      }
      setPaused(true);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [paused, turnFlow]);

  const outcome = latestState?.outcome;
  const detailUnit = detailUnitId !== null && latestState !== null
    ? latestState.units.get(detailUnitId) ?? null
    : null;
  const showResults = outcome !== undefined && !paused && !resultsDismissed;

  // Active-team signaling inputs (S43): whose turn it is, and that team's
  // display name + canonical color. Drives the banner, the menu glow, and
  // the turn-transition alert.
  const activeTeam: TeamId | null = turnFlow.activeUnit?.team ?? null;
  const activeTeamName =
    activeTeam !== null && latestState !== null
      ? latestState.teams.find((t) => t.id === activeTeam)?.name ?? null
      : null;
  const activeTeamColor =
    activeTeam !== null
      ? TEAM_PALETTE.get(activeTeam)?.css ?? TEAM_PALETTE_FALLBACK_CSS
      : null;

  // Pass-and-play handoff trigger: when the active team changes from one
  // human team to a *different* human team. Only relevant with more than
  // one human team (true pass-and-play); AI turns don't move the marker.
  useEffect(() => {
    if (activeTeam === null || !humanTeams.has(activeTeam)) return;
    const prev = lastHumanTeamRef.current;
    lastHumanTeamRef.current = activeTeam;
    if (
      settingsApi.settings.passAndPlayHandoff &&
      humanTeams.size > 1 &&
      prev !== null &&
      prev !== activeTeam
    ) {
      setBattleHandoff({
        name: activeTeamName ?? 'Next player',
        color: activeTeamColor ?? TEAM_PALETTE_FALLBACK_CSS,
      });
    }
  }, [activeTeam, humanTeams, activeTeamName, activeTeamColor, settingsApi.settings.passAndPlayHandoff]);

  // Hover-counterpart forwarder — flows from the HUD's hover handlers
  // through to the renderer's sprite-pulse channel.
  const handleHoverParticipants = (ids: ReadonlyArray<UnitId>): void => {
    renderer?.setCounterpartUnits(ids);
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div
        ref={containerRef}
        style={{
          position: 'absolute',
          inset: 0,
          background: BACKGROUND,
        }}
      />
      <BattleHud
        state={latestState}
        catalog={catalog}
        turnFlow={turnFlow}
        onHoverParticipants={handleHoverParticipants}
        onOpenUnitDetail={(id) => setDetailUnitId(id)}
        onOpenChargedActionDetail={(id) => setChargedDetailId(id)}
        activeTeamName={activeTeamName}
        activeTeamColor={activeTeamColor}
        showActiveTeamBanner={settingsApi.settings.activeTeamBanner}
        highlightActiveMenu={settingsApi.settings.activeTeamMenuHighlight}
      />
      {settingsApi.settings.turnTransitionAlert && (
        <TurnTransitionAlert
          activeTeam={activeTeam}
          teamName={activeTeamName}
          color={activeTeamColor ?? TEAM_PALETTE_FALLBACK_CSS}
        />
      )}
      {/* On-screen Pause/Play toggle — freezes the AI/turn pump and the
          animator *without* an overlay, so the player can inspect units,
          the log, and tile details while stopped (the only such control
          in AI-vs-AI, which has no action menu). Distinct from the ESC
          modal pause. Hidden behind the modal pause and on the results
          screen. */}
      {!paused && !showResults && (
        <button
          type="button"
          style={pauseButtonStyle}
          onClick={() => setHalted((h) => !h)}
          aria-label={halted ? 'Resume battle' : 'Pause battle'}
          title={halted ? 'Resume' : 'Pause'}
        >
          {halted ? '▶ Play' : '‖ Pause'}
        </button>
      )}
      <ForecastTooltip
        forecast={turnFlow.forecast}
        catalog={catalog}
        cursor={turnFlow.cursorScreen}
      />
      {detailUnit !== null && latestState !== null && (
        <UnitDetailPanel
          state={latestState}
          catalog={catalog}
          unit={detailUnit}
          onClose={() => setDetailUnitId(null)}
        />
      )}
      {chargedDetailId !== null && latestState !== null && (
        <ChargedActionDetailPanel
          state={latestState}
          catalog={catalog}
          renderer={renderer}
          chargedActionId={chargedDetailId}
          onClose={() => setChargedDetailId(null)}
        />
      )}
      {paused && (
        <PauseOverlay onResume={() => setPaused(false)} onMainMenu={onExitToTitle} />
      )}
      {showResults && latestState !== null && outcome !== undefined && (
        <ResultsScreen
          state={latestState}
          outcome={outcome}
          catalog={catalog}
          onClose={() => setResultsDismissed(true)}
          onNewBattle={onExitToSetup}
          onMainMenu={onExitToTitle}
        />
      )}
      {/* Pass-and-play turn handoff — covers the board until the incoming
          player confirms, so they don't act on the previous player's
          screen. The orchestrator is already idling on the human
          controller's turn, so no pump pause is needed. */}
      {battleHandoff !== null && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 200 }}>
          <HandoffScreen
            title={`${battleHandoff.name} — your turn`}
            body={`Pass the device to the ${battleHandoff.name} player.`}
            cta="Take turn"
            accent={battleHandoff.color}
            onConfirm={() => setBattleHandoff(null)}
          />
        </div>
      )}
    </div>
  );
}

const pauseButtonStyle: CSSProperties = {
  position: 'absolute',
  top: 3,
  right: 12,
  zIndex: 50,
  padding: '6px 12px',
  fontSize: 13,
  fontFamily: 'system-ui, sans-serif',
  background: 'rgba(28, 30, 35, 0.9)',
  color: '#e7e9ee',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: '#3a4150',
  borderRadius: 6,
  cursor: 'pointer',
  pointerEvents: 'auto',
};
