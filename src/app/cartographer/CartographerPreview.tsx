// Cartographer — live preview through the REAL battle renderer (the
// anti-drift point of the tool: what you author is what ships). Mounts
// BattleRenderer with a units-empty GameState built from the authored
// spec — terrain fills, cliff shading, elevation digits, deck lift, and
// the async terrain/bridge art all draw from the map alone. Deployment
// zones tint through the renderer's own deployment layer. The mount
// recipe (disposed guard, canvas capture, fitMap, wheel zoom) is
// DeploymentScreen's, the proven reduced-units precedent.

import { useEffect, useMemo, useRef, type CSSProperties, type ReactElement } from 'react';
import { Application } from 'pixi.js';
import {
  createInitialState,
  rulesetId,
  teamId,
  type BattleConfig,
} from '@engine/index.ts';
import { BattleRenderer } from '@renderer/index.ts';
import { loadDefaultCatalog } from '@content/index.ts';
import { buildMapFromSpec } from '@content/maps/map-format.ts';
import { buildBattleFromLineup } from '@content/battles/lineup-format.ts';
import { riverRidgeBattle } from '@content/battles/river-ridge-battle.ts';
import { enemiesFromLineup, foldEnemyTeam } from '@campaign/index.ts';
import type { CartographerModel } from './model.ts';
import { defaultZoneConfig } from './edit.ts';
import { lineupSpecFromModel } from './export-spec.ts';
import { zoneConfigToEngine } from './validate.ts';

const BACKGROUND = 0x101216;
const WHEEL_ZOOM_STEP = 0.0015;
const PREVIEW_SEED = 12345;

interface CartographerPreviewProps {
  readonly model: CartographerModel;
  readonly onClose: () => void;
}

export function CartographerPreview({ model, onClose }: CartographerPreviewProps): ReactElement {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const catalogRef = useRef<ReturnType<typeof loadDefaultCatalog> | null>(null);
  if (catalogRef.current === null) catalogRef.current = loadDefaultCatalog();
  const catalog = catalogRef.current;

  // The caller gates the overlay on zero validation errors, so the build
  // is safe; remount whenever the authored data changes (cheap at map
  // scale — the AtlasPreview remount idiom).
  //
  // With a lineup authored, the preview runs the REAL campaign chain:
  // restage the base config onto the slots, build the authored enemies
  // (class + level + enemy-kit framing), and fold them onto the enemy
  // slots — so the sprites, classes, and facings on screen are exactly
  // what a story battle on this lineup fights.
  const state = useMemo(() => {
    const map = buildMapFromSpec(model.spec);
    const lineup = model.lineup;
    if (lineup !== null && lineup.players.length > 0 && lineup.enemies.length > 0) {
      const spec = lineupSpecFromModel(model);
      const config = buildBattleFromLineup(spec, map, riverRidgeBattle);
      const folded = foldEnemyTeam(config, enemiesFromLineup(spec, catalog), teamId('team_b'), catalog);
      return createInitialState(folded, catalog);
    }
    const config: BattleConfig = {
      battleId: 'cartographer_preview',
      rulesetId: rulesetId('default'),
      map,
      teams: [
        { id: teamId('team_a'), name: 'Blue', control: 'human' },
        { id: teamId('team_b'), name: 'Red', control: 'ai' },
      ],
      units: [],
      victoryConditions: [],
      masterSeed: PREVIEW_SEED,
    };
    return createInitialState(config, catalog);
  }, [model, catalog]);

  const zones = useMemo(() => {
    const config = defaultZoneConfig(model);
    return config === undefined ? null : zoneConfigToEngine(config);
  }, [model]);

  useEffect(() => {
    const host = hostRef.current;
    if (host === null) return;

    let disposed = false;
    let cleanup: (() => void) | null = null;

    void (async () => {
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
      // Capture now — reading app.canvas after destroy() throws (Pixi v8
      // getter; the S34 HMR root cause).
      const canvas = app.canvas;

      const battleRenderer = new BattleRenderer(app);
      battleRenderer.mount(state, catalog, teamId('team_a'));
      battleRenderer.fitMap();
      if (zones !== null) {
        battleRenderer.drawDeploymentZone(zones, teamId('team_a'));
      }

      const onWheel = (e: WheelEvent): void => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const focal = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        const factor = Math.exp(-e.deltaY * WHEEL_ZOOM_STEP);
        battleRenderer.applyZoomAt(factor, focal);
      };
      canvas.addEventListener('wheel', onWheel, { passive: false });

      const resizeObserver = new ResizeObserver(() => {
        battleRenderer.setScreenSize(app.renderer.width, app.renderer.height);
      });
      resizeObserver.observe(host);

      cleanup = () => {
        canvas.removeEventListener('wheel', onWheel);
        resizeObserver.disconnect();
        battleRenderer.destroy();
        if (host.contains(canvas)) {
          host.removeChild(canvas);
        }
      };
    })();

    return () => {
      disposed = true;
      cleanup?.();
      cleanup = null;
    };
  }, [state, catalog, zones]);

  return (
    <div style={overlayStyle}>
      <div style={barStyle}>
        <span style={titleStyle}>
          Preview — the real battle renderer ({model.spec.label}); wheel zooms; zones tinted for
          Blue
        </span>
        <button type="button" style={closeStyle} onClick={onClose}>
          Close
        </button>
      </div>
      <div ref={hostRef} style={hostStyle} />
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: '#0e0f12',
  display: 'flex',
  flexDirection: 'column',
  zIndex: 10,
};

const barStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  padding: '10px 16px',
  borderBottom: '1px solid #2c2f36',
  fontSize: 13,
};

const titleStyle: CSSProperties = { flex: 1, color: '#9aa0ac' };

const hostStyle: CSSProperties = { flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' };

const closeStyle: CSSProperties = {
  padding: '5px 10px',
  fontSize: 12,
  borderRadius: 4,
  fontFamily: 'inherit',
  cursor: 'pointer',
  border: '1px solid #8f7644',
  background: 'rgba(216,178,108,.1)',
  color: '#d8b26c',
};
