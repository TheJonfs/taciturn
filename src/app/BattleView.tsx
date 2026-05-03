// BattleView — React component that owns the runtime lifecycle for
// rendering a single battle:
//   - Loads the catalog and constructs the initial GameState.
//   - Spins up a PixiJS Application and a BattleRenderer.
//   - Owns the DemoOrchestrator and pumps it whenever the renderer is
//     idle. The orchestrator commits one action chain per pump; the
//     renderer plays them out, signals idle, and the cycle continues
//     until the battle decides.
//   - Renders the win banner when state.outcome lands.
//
// The orchestrator/renderer split keeps engine work synchronous and
// renderer work animated — the React component is the glue.

import { useEffect, useRef, useState } from 'react';
import { Application } from 'pixi.js';
import { loadDefaultCatalog } from '@content/index.ts';
import { demoBattle } from '@content/battles/demo.ts';
import { createInitialState, type GameState } from '@engine/index.ts';
import { BattleRenderer } from '@renderer/index.ts';
import {
  DemoOrchestrator,
  greedyMeleeController,
  type ControllerMap,
} from './demo/index.ts';

const BACKGROUND = '#0e0f12';

export function BattleView() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [outcome, setOutcome] = useState<GameState['outcome']>(undefined);

  useEffect(() => {
    const host = containerRef.current;
    if (host === null) return;

    let disposed = false;
    let cleanup: (() => void) | null = null;

    void (async () => {
      const catalog = loadDefaultCatalog();
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

      const renderer = new BattleRenderer(app);
      renderer.mount(initialState);

      const controller = greedyMeleeController();
      const controllers: ControllerMap = new Map([
        [demoBattle.teams[0]!.id, controller],
        [demoBattle.teams[1]!.id, controller],
      ]);
      const orchestrator = new DemoOrchestrator(initialState, catalog, controllers);

      // Pump: whenever the renderer's animator is idle, ask the
      // orchestrator for the next step and feed the actions to the
      // renderer. Stops naturally once the orchestrator reports done.
      let finished = false;
      const pump = () => {
        if (finished) return;
        if (!renderer.isIdle()) return;
        const step = orchestrator.step();
        if (step.committed.length > 0) {
          renderer.playActions(step.committed, step.newState);
        }
        if (step.done) {
          finished = true;
          setOutcome(step.newState.outcome);
        }
      };
      app.ticker.add(pump);

      cleanup = () => {
        finished = true;
        app.ticker.remove(pump);
        renderer.destroy();
        if (host.contains(app.canvas)) {
          host.removeChild(app.canvas);
        }
      };
    })();

    return () => {
      disposed = true;
      if (cleanup !== null) cleanup();
    };
  }, []);

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
