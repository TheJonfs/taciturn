// BattleView — React component that owns the runtime lifecycle for
// rendering a single battle.
//
// Session 22 posture: visualization layer only. Both teams are driven
// by the basic AI; the headless DemoOrchestrator advances the battle
// while the user watches. No interaction surface this session — the
// UiController, useBattleUi hook, and ActionMenu component are still
// in the tree (controllers/, ui/) but are not wired into the runtime.
// They return in Session 23 against the new layout.
//
// What this component owns:
//   - Catalog load + initial GameState construction.
//   - PixiJS Application init + BattleRenderer mount.
//   - DemoOrchestrator pump on the Pixi ticker (idle → step → animate
//     → idle), with engine state synced into React after each commit.
//   - Camera input listeners (WASD pan, mouse wheel zoom). The
//     renderer owns the CameraController; this component just plumbs
//     keyboard / wheel events into it.
//   - The React HUD layout. v1 right-side stack has been replaced by
//     the design-doc 4-region shell (top bar / left queue tower /
//     right action-log slot / bottom action-menu slot).
//
// The battle config consumed at runtime is `trainingFieldBattle` —
// the 14×14 Training Field with the demo unit roster restaged. The
// older 6×6 `demoBattle` remains the test fixture (consumed by
// `orchestrator.test.ts` and `ai-controller.integration.test.ts`).

import { useEffect, useMemo, useRef, useState } from 'react';
import { Application } from 'pixi.js';
import { loadDefaultCatalog } from '@content/index.ts';
import { trainingFieldBattle } from '@content/battles/training-field-battle.ts';
import { createInitialState, type Catalog, type GameState } from '@engine/index.ts';
import { BattleRenderer, type PanInput } from '@renderer/index.ts';
import { BattleHud } from '@ui/index.ts';
import { createBasicAiController } from './controllers/index.ts';
import {
  DemoOrchestrator,
  type ControllerMap,
} from './demo/index.ts';

const BACKGROUND = '#0e0f12';

// Wheel-zoom step. A 100px wheel delta produces this much zoom-factor
// change. Tuned so a single notch on a typical mouse wheel feels like
// a discrete zoom step rather than a snap.
const WHEEL_ZOOM_STEP = 0.0015;

export function BattleView() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const catalog = useMemo<Catalog>(() => loadDefaultCatalog(), []);

  // Engine state surfaced to React. Updated from inside the pump after
  // each commit. Renderer's visual state is independent.
  const [latestState, setLatestState] = useState<GameState | null>(null);

  useEffect(() => {
    const host = containerRef.current;
    if (host === null) return;

    let disposed = false;
    let cleanup: (() => void) | null = null;

    void (async () => {
      const initialState = createInitialState(trainingFieldBattle, catalog);

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

      const battleRenderer = new BattleRenderer(app);
      battleRenderer.mount(initialState, catalog);
      setLatestState(initialState);

      // Both teams driven by the basic AI for Session 22. The runtime
      // is purely a viewer right now; interaction lands in Session 23.
      const controllers: ControllerMap = new Map([
        [trainingFieldBattle.teams[0]!.id, createBasicAiController()],
        [trainingFieldBattle.teams[1]!.id, createBasicAiController()],
      ]);
      const orchestrator = new DemoOrchestrator(initialState, catalog, controllers);

      // Camera input — keyboard for pan, wheel for zoom. The renderer
      // owns the CameraController; the listeners here translate DOM
      // events into setPanInput / applyZoomAt calls.
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
        // Negative deltaY = scroll up = zoom in. Map to a multiplicative
        // factor so successive notches compound naturally.
        const factor = Math.exp(-e.deltaY * WHEEL_ZOOM_STEP);
        battleRenderer.applyZoomAt(factor, focal);
      };
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      app.canvas.addEventListener('wheel', onWheel, { passive: false });

      // Reflect host-element resizes into the camera. Pixi's `resizeTo`
      // already updates `app.renderer` dimensions; the camera needs to
      // know too so its fit-zoom math stays correct.
      const resizeObserver = new ResizeObserver(() => {
        battleRenderer.setScreenSize(
          app.renderer.width,
          app.renderer.height,
        );
      });
      resizeObserver.observe(host);

      // Pump: whenever the renderer's animator is idle, ask the
      // orchestrator for the next step and feed actions to the
      // renderer. Sync engine state into React after each commit.
      let finished = false;
      const pump = () => {
        if (finished) return;
        if (!battleRenderer.isIdle()) return;
        const step = orchestrator.step();
        if (step.committed.length > 0) {
          battleRenderer.playActions(step.committed, step.newState);
          setLatestState(step.newState);
        }
        if (step.done) {
          finished = true;
        }
      };
      app.ticker.add(pump);

      // Dev-only debug surface for browser-preview verification when
      // the tab is hidden (Pixi throttles its ticker; the pump never
      // fires). Available only in dev builds — Vite tree-shakes the
      // entire branch out of production.
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
        };
        (window as unknown as { __taciturnDebug: typeof debug }).__taciturnDebug = debug;
      }

      cleanup = () => {
        finished = true;
        app.ticker.remove(pump);
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        app.canvas.removeEventListener('wheel', onWheel);
        resizeObserver.disconnect();
        battleRenderer.destroy();
        if (host.contains(app.canvas)) {
          host.removeChild(app.canvas);
        }
        if (import.meta.env.DEV) {
          delete (window as unknown as { __taciturnDebug?: unknown }).__taciturnDebug;
        }
      };
    })();

    return () => {
      disposed = true;
      if (cleanup !== null) cleanup();
    };
  }, [catalog]);

  const outcome = latestState?.outcome;

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
      <BattleHud state={latestState} catalog={catalog} />
      {outcome !== undefined && (
        <WinOverlay description={outcome.description} winner={String(outcome.winner)} />
      )}
    </div>
  );
}

function WinOverlay({ description, winner }: { description: string; winner: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        background: 'rgba(0,0,0,0.55)',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          padding: '1.25rem 2rem',
          background: '#1c1e23',
          color: '#e7e9ee',
          border: '1px solid #2c2f36',
          borderRadius: 8,
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
          boxShadow: '0 8px 28px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{ fontSize: '0.9rem', opacity: 0.7, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Battle Decided
        </div>
        <div style={{ fontSize: '1.6rem', marginTop: '0.4rem' }}>{winner} wins</div>
        <div style={{ fontSize: '0.95rem', marginTop: '0.4rem', opacity: 0.8 }}>{description}</div>
      </div>
    </div>
  );
}
