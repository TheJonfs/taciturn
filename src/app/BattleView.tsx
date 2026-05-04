// BattleView — React component that owns the runtime lifecycle for
// rendering a single battle:
//   - Loads the catalog and constructs the initial GameState.
//   - Spins up a PixiJS Application and a BattleRenderer.
//   - Owns the DemoOrchestrator and pumps it whenever the renderer is
//     idle. The orchestrator commits one action chain per pump; the
//     renderer plays them out, signals idle, and the cycle continues
//     until the battle decides.
//   - Mounts the React HUD (action menu, current-unit panel, turn
//     queue) and feeds it the latest GameState from the pump.
//   - Wires the HUD's UiController into the orchestrator for team_a
//     (the player team in the v1 demo). team_b stays on the greedy
//     melee controller until session 12 lands a real AI.
//
// The orchestrator/renderer split keeps engine work synchronous and
// renderer work animated — the React component is the glue.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Application } from 'pixi.js';
import { loadDefaultCatalog } from '@content/index.ts';
import { demoBattle } from '@content/battles/demo.ts';
import { createInitialState, type Catalog, type GameState } from '@engine/index.ts';
import { BattleRenderer } from '@renderer/index.ts';
import { BattleHud, useBattleUi } from '@ui/index.ts';
import { createUiController } from './controllers/index.ts';
import {
  DemoOrchestrator,
  greedyMeleeController,
  type ControllerMap,
} from './demo/index.ts';

const BACKGROUND = '#0e0f12';

export function BattleView() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Catalog is loaded once and is referentially stable for the lifetime
  // of the component — UI memos lean on this.
  const catalog = useMemo<Catalog>(() => loadDefaultCatalog(), []);

  // The UiController is created once, captured by both the orchestrator
  // (inside the effect) and the React HUD (via useBattleUi). Stable
  // identity is required so the hook's effects don't re-fire each
  // render.
  const uiController = useMemo(() => createUiController(), []);

  // Engine state surfaced to React. Updated from inside the pump after
  // each commit. The renderer's visual state is independent of this and
  // tweens between commits.
  const [latestState, setLatestState] = useState<GameState | null>(null);
  const [waiting, setWaiting] = useState<boolean>(true);
  const [renderer, setRenderer] = useState<BattleRenderer | null>(null);

  // Player team — for the demo, team_a is click-driven, team_b is
  // greedy. The HUD's "is it our turn" gating reads this.
  const uiTeam = demoBattle.teams[0]!.id;

  // Hook owns the input state machine, mounts tile-click and highlight
  // wiring on the renderer.
  const ui = useBattleUi({
    state: latestState,
    catalog,
    uiController,
    renderer,
    uiTeam,
    waiting,
  });

  useEffect(() => {
    const host = containerRef.current;
    if (host === null) return;

    let disposed = false;
    let cleanup: (() => void) | null = null;

    void (async () => {
      const initialState = createInitialState(demoBattle, catalog);

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
      battleRenderer.mount(initialState);
      setRenderer(battleRenderer);
      setLatestState(initialState);

      const controllers: ControllerMap = new Map([
        [demoBattle.teams[0]!.id, uiController.controller],
        [demoBattle.teams[1]!.id, greedyMeleeController()],
      ]);
      const orchestrator = new DemoOrchestrator(initialState, catalog, controllers);

      // Pump: whenever the renderer's animator is idle, ask the
      // orchestrator for the next step and feed the actions to the
      // renderer. Sync engine state into React after each commit so
      // the HUD re-renders. Stops naturally once the orchestrator
      // reports done.
      let finished = false;
      let lastIdle = false;
      const pump = () => {
        if (finished) return;
        const idleNow = battleRenderer.isIdle();
        // Surface "is the engine waiting on us" to React lazily so the
        // HUD doesn't re-render every frame.
        if (idleNow !== lastIdle) {
          lastIdle = idleNow;
          setWaiting(!idleNow);
        }
        if (!idleNow) return;
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

      cleanup = () => {
        finished = true;
        app.ticker.remove(pump);
        battleRenderer.destroy();
        if (host.contains(app.canvas)) {
          host.removeChild(app.canvas);
        }
        setRenderer(null);
      };
    })();

    return () => {
      disposed = true;
      if (cleanup !== null) cleanup();
    };
  }, [catalog, uiController]);

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
      <BattleHud state={latestState} catalog={catalog} ui={ui} />
      {outcome !== undefined && <WinOverlay description={outcome.description} winner={String(outcome.winner)} />}
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
