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
// The battle config consumed at runtime is `riverRidgeBattle` (Phase D
// content milestone, Session 33). Training Field stays as content (the
// 14×14 flat ground map) and `demoBattle` remains the engine smoke-test
// fixture (consumed by `orchestrator.test.ts` and
// `ai-controller.integration.test.ts`).

import { useEffect, useRef, useState } from 'react';
import { Application } from 'pixi.js';
import { BattleErrorBoundary } from './BattleErrorBoundary.tsx';
import { buildDeployedBattleConfig, type DeploymentResult } from './deployment-config.ts';
import { loadDefaultCatalog } from '@content/index.ts';
import { riverRidgeBattle } from '@content/battles/river-ridge-battle.ts';
import {
  createInitialState,
  enumeratePreBattleActions,
  type Catalog,
  type ChargedActionId,
  type GameState,
  type UnitId,
} from '@engine/index.ts';
import { BattleRenderer, type PanInput } from '@renderer/index.ts';
import {
  BattleHud,
  ChargedActionDetailPanel,
  ForecastTooltip,
  PauseOverlay,
  ResultsScreen,
  SettingsProvider,
  UnitDetailPanel,
  useSettings,
  useTurnFlow,
} from '@ui/index.ts';
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
  // The committed deployment from `DeploymentScreen` (Session 35).
  // `null` falls back to River Ridge's authored placements — kept so
  // the battle is still launchable in isolation (tests, a future
  // skip-deployment debug path).
  readonly deploymentResult: DeploymentResult | null;
  // Navigation out of the battle, surfaced on the results screen.
  readonly onExitToSetup: () => void;
  readonly onExitToTitle: () => void;
}

export function BattleView(props: BattleViewProps) {
  return (
    <BattleErrorBoundary>
      <SettingsProvider>
        <BattleViewInner {...props} />
      </SettingsProvider>
    </BattleErrorBoundary>
  );
}

function BattleViewInner({
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
  const [paused, setPaused] = useState<boolean>(false);
  const [detailUnitId, setDetailUnitId] = useState<UnitId | null>(null);
  const [chargedDetailId, setChargedDetailId] = useState<ChargedActionId | null>(null);
  // When the results screen has been dismissed by the user, we don't
  // re-show it on subsequent re-renders. Stored separately from
  // `latestState.outcome` so the player can close + re-open via... well,
  // they can't re-open in v1; "closed" is final until next battle.
  const [resultsDismissed, setResultsDismissed] = useState<boolean>(false);

  // The UiController persists across renders — it's the orchestrator's
  // single-slot queue, not React state.
  const uiControllerRef = useRef<UiController | null>(null);
  if (uiControllerRef.current === null) {
    uiControllerRef.current = createUiController();
  }
  const uiController = uiControllerRef.current;

  const settingsApi = useSettings();
  const uiTeam = riverRidgeBattle.teams[0]!.id;

  // Turn-flow hook owns the player's per-turn state machine. It wires
  // the renderer's highlights / click / hover to the menu's choices
  // and submits proposed actions to the uiController on commit.
  const turnFlow = useTurnFlow({
    state: latestState,
    catalog,
    renderer,
    uiController,
    uiTeam,
    confirmStep: settingsApi.settings.confirmStep,
    onInspectUnit: (id) => setDetailUnitId(id),
  });

  // Mirror the paused flag into the renderer so the animator halts.
  useEffect(() => {
    renderer?.setPaused(paused);
  }, [renderer, paused]);

  // Mount the renderer + orchestrator on first render.
  useEffect(() => {
    const host = containerRef.current;
    if (host === null) return;

    let disposed = false;
    let cleanup: (() => void) | null = null;

    void (async () => {
      // Session 35: fold the deployment phase's chosen placements into
      // the authored battle config (Blue's placements replaced, Red's
      // authored placements retained). The engine is downstream-blind —
      // `createInitialState` consumes the result like any battle config.
      // `null` falls back to River Ridge's fully-authored placements.
      const battleConfig =
        deploymentResult !== null
          ? buildDeployedBattleConfig(riverRidgeBattle, deploymentResult)
          : riverRidgeBattle;

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

      const battleRenderer = new BattleRenderer(app);
      battleRenderer.mount(initialState, catalog);
      setLatestState(initialState);
      setRenderer(battleRenderer);

      // Team A is player-driven; Team B is the basic AI.
      const controllers: ControllerMap = new Map([
        [battleConfig.teams[0]!.id, uiController.controller],
        [battleConfig.teams[1]!.id, createBasicAiController()],
      ]);
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
        if (pausedRef.current) return;
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
    // `deploymentResult` is a prop set once by `App` when routing into
    // the battle screen — stable for this BattleView's lifetime and
    // across Fast Refresh, so including it doesn't reintroduce the S34
    // mount-effect churn.
  }, [catalog, uiController, deploymentResult]);

  // Mirror the paused state into a ref so the pump closure (captured
  // once on mount) can read the latest value without re-registering.
  const pausedRef = useRef<boolean>(false);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

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
      />
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
      {paused && <PauseOverlay onResume={() => setPaused(false)} />}
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
    </div>
  );
}
