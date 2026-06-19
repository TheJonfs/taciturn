// DeploymentScreen — the deployment phase (Session 35 / Phase E).
//
// Sits between battle setup and the battle proper. The player places
// their team's units onto the map's deployment-zone tiles, chooses a
// facing for each, then commits with "Start Battle". The commit
// produces a `DeploymentResult` that `App` threads into `BattleView`,
// which folds it into the battle config before `createInitialState`.
//
// Why a separate screen rather than a sub-mode of `BattleView` (the
// Session 35 brief's primary plan): `BattleRenderer.destroy()` is
// lifecycle-coupled to `app.destroy()`, so a "deployment mode" inside
// `BattleView` couldn't simply gate an already-mounted renderer — it
// would need a parallel Pixi-app lifecycle anyway. A separate screen
// gives a clean prop contract (`DeploymentResult` in, battle config
// out) and keeps `BattleView` — already large and HMR-delicate —
// untouched. (Audit-confirmed; Chris's call.)
//
// Renderer lifecycle mirrors `BattleView`'s HMR-hardened pattern: the
// catalog and the full initial state live in `useRef` one-shots (stable
// identity across Fast Refresh), the canvas element is captured before
// `destroy()`, and the cleanup drops the renderer from React state.
//
// Vs-AI, Blue-only this session. The deployment flow is team-
// parameterized (`currentTeam`), so the future pass-and-play extension
// is a routing change — deploy Blue, then re-enter for Red — not a
// rewrite of this screen.

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
} from 'react';
import { Application } from 'pixi.js';
import { BattleErrorBoundary } from './BattleErrorBoundary.tsx';
import { loadDefaultCatalog } from '@content/index.ts';
import {
  createInitialState,
  unitId,
  validateDeploymentZones,
  validateMap,
  type BattleConfig,
  type Catalog,
  type DeploymentZoneConfig,
  type Direction,
  type GameState,
  type TeamId,
  type Unit,
} from '@engine/index.ts';
import { BattleRenderer } from '@renderer/index.ts';
import { DeploymentFacingPicker, DeploymentRosterPanel, useDeploymentFlow } from '@ui/index.ts';
import type { DeploymentResult } from './deployment-config.ts';

const BACKGROUND = '#0e0f12';
const ROSTER_PANEL_WIDTH = 264;

// Wheel-zoom step — same tuning as BattleView's camera.
const WHEEL_ZOOM_STEP = 0.0015;

export interface DeploymentScreenProps {
  // The battle config to deploy onto — River Ridge with both teams'
  // assembled units folded in, plus any already-committed deployments
  // (S43: when both teams are human, Team A deploys first and its
  // placements are folded before Team B's deployment screen mounts).
  readonly template: BattleConfig;
  // The deployment-zone config for this battle (S70 — zones live beside
  // the terrain now). Paired with `template.map` by the combiner; the
  // screen tints it, gates placement on it, and validates it.
  readonly zones: DeploymentZoneConfig;
  // Which team is placing units this pass (S43). Earlier sessions
  // hardcoded `teams[0]`; the unified flow deploys each human team in
  // turn order, so the caller names the team.
  readonly deployingTeam: TeamId;
  // Commit: the player placed every unit and clicked "Start Battle".
  readonly onCommit: (result: DeploymentResult) => void;
  // Escape hatch: "Back to Setup" / Escape from idle / validation
  // failure all route here.
  readonly onBack: () => void;
}

export function DeploymentScreen(props: DeploymentScreenProps): ReactElement {
  return (
    <BattleErrorBoundary>
      <DeploymentScreenInner {...props} />
    </BattleErrorBoundary>
  );
}

function DeploymentScreenInner({
  template,
  zones,
  deployingTeam,
  onCommit,
  onBack,
}: DeploymentScreenProps): ReactElement {
  // The catalog is loaded once and held in a ref (not `useMemo`) so its
  // identity is stable across Fast Refresh — same discipline as
  // BattleView (the S34 HMR root-cause fix).
  const catalogRef = useRef<Catalog | null>(null);
  if (catalogRef.current === null) {
    catalogRef.current = loadDefaultCatalog();
  }
  const catalog = catalogRef.current;

  const currentTeam: TeamId = deployingTeam;

  // Validate the terrain (`validateMap`) and the deployment-zone config
  // against the per-team roster sizes (`validateDeploymentZones`, S70 —
  // zone coverage moved off the map). Pure + cheap → `useMemo`. A failure
  // short-circuits to an error panel with a "Back to Setup" affordance
  // rather than mounting the renderer. Errors from both checks merge so
  // the author sees terrain and zone problems together.
  const validation = useMemo(() => {
    const registry = catalog.getRuleset(template.rulesetId).terrain.tags;
    const requiredZonesPerTeam = new Map<TeamId, number>();
    for (const team of template.teams) {
      const count = template.units.filter((u) => u.team === team.id).length;
      requiredZonesPerTeam.set(team.id, count);
    }
    const terrain = validateMap(template.map, registry);
    const zoneCheck = validateDeploymentZones(zones, template.map, {
      requiredZonesPerTeam,
    });
    return {
      ok: terrain.ok && zoneCheck.ok,
      errors: [...terrain.errors, ...zoneCheck.errors],
    };
  }, [catalog, template, zones]);

  // Full initial state — the source of canonical `Unit` objects for the
  // roster. `createInitialState` is pure; held in a `useRef` one-shot so
  // its identity (and the derived roster) stays stable across Fast
  // Refresh, keeping the mount effect's deps from churning.
  const fullStateRef = useRef<GameState | null>(null);
  if (fullStateRef.current === null && validation.ok) {
    fullStateRef.current = createInitialState(template, catalog);
  }
  const fullState = fullStateRef.current;

  const rosterUnits = useMemo<ReadonlyArray<Unit>>(() => {
    if (fullState === null) return [];
    return [...fullState.units.values()].filter((u) => u.team === currentTeam);
  }, [fullState, currentTeam]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [renderer, setRenderer] = useState<BattleRenderer | null>(null);

  // Mount the renderer with an opponent-only preview state — the
  // deploying team's units are absent here and added incrementally by
  // the deployment flow as the player places them (`setDeploymentUnit`,
  // which bypasses the animator). Skipped entirely on validation
  // failure (no `fullState`).
  useEffect(() => {
    if (fullState === null) return;
    const host = containerRef.current;
    if (host === null) return;

    let disposed = false;
    let cleanup: (() => void) | null = null;

    void (async () => {
      const previewState: GameState = {
        ...fullState,
        units: new Map(
          [...fullState.units].filter(([, u]) => u.team !== currentTeam),
        ),
      };

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
      // Capture the canvas now — the cleanup must not read `app.canvas`
      // after `battleRenderer.destroy()` runs `app.destroy()` (the Pixi
      // v8 getter reads through the now-null renderer and throws; S34
      // HMR root cause).
      const canvas = app.canvas;

      const battleRenderer = new BattleRenderer(app);
      // Pass `currentTeam` as the player team: the preview state holds
      // only the opponent's units, so the first-unit inference would
      // pick the opponent and flip the wrong portraits. With the
      // deploying team named explicitly, the opponent's sprites flip to
      // face the player.
      battleRenderer.mount(previewState, catalog, currentTeam);
      battleRenderer.fitMap();
      setRenderer(battleRenderer);

      // Wheel zoom — lets the player inspect the 14×14 board. Pan is
      // omitted (the arrow keys belong to the facing picker; `fitMap`
      // shows the whole board by default).
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
        // Drop the destroyed renderer from React state so a Fast
        // Refresh re-run of this effect sees a clean slate.
        setRenderer(null);
      };
    })();

    return () => {
      disposed = true;
      if (cleanup !== null) cleanup();
    };
  }, [catalog, fullState, currentTeam]);

  const flow = useDeploymentFlow({
    renderer,
    zones,
    currentTeam,
    rosterUnits,
  });

  // Dev-only debug surface — the deployment-mode parallel to
  // BattleView's `__taciturnDebug`. Synthetic Pixi pointer events don't
  // reach the renderer's federated event system in a headless preview,
  // so the canvas tile-click can't be driven there; this exposes the
  // deployment flow so the full place → facing → commit loop is still
  // verifiable. Stripped from production builds.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const debug = {
      state: () => flow.state,
      isComplete: () => flow.isComplete,
      roster: () => flow.rosterUnits.map((u) => String(u.id)),
      selectTile: (x: number, y: number) =>
        flow.dispatch({ kind: 'selectTile', tile: { x, y, layer: 0 } }),
      pickUnit: (id: string) =>
        flow.dispatch({ kind: 'pickUnit', unitId: unitId(id) }),
      pickFacing: (facing: Direction) =>
        flow.dispatch({ kind: 'pickFacing', facing }),
      cancel: () => flow.dispatch({ kind: 'cancel' }),
    };
    (
      window as unknown as { __taciturnDeployDebug: typeof debug }
    ).__taciturnDeployDebug = debug;
    return () => {
      delete (window as unknown as { __taciturnDeployDebug?: unknown })
        .__taciturnDeployDebug;
    };
  }, [flow]);

  // Escape: cancel the current selection if mid-flow; otherwise leave
  // to battle setup. Single owner of Escape (the facing picker handles
  // only the arrow keys), mirroring BattleView's ESC handler.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      if (flow.state.phase.kind !== 'idle') {
        flow.cancel();
        return;
      }
      onBack();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [flow, onBack]);

  if (!validation.ok) {
    return (
      <div style={errorRootStyle}>
        <div style={errorCardStyle}>
          <div style={errorTitleStyle}>Can&apos;t deploy on this map</div>
          <div style={errorBodyStyle}>
            {validation.errors[0]?.message ??
              "This map's deployment zones don't support the current team size."}
          </div>
          <button type="button" style={primaryButtonStyle} onClick={onBack}>
            Back to Setup
          </button>
        </div>
      </div>
    );
  }

  const teamName =
    template.teams.find((t) => t.id === currentTeam)?.name ?? String(currentTeam);

  const handleStartBattle = (): void => {
    onCommit({ team: currentTeam, placements: flow.state.placements });
  };

  return (
    <div style={rootStyle}>
      <div ref={containerRef} style={canvasHostStyle} />
      {/* `fullState` is non-null here: the `!validation.ok` branch
          returned above, and `fullStateRef` is populated whenever
          validation succeeds. */}
      <DeploymentRosterPanel
        flow={flow}
        catalog={catalog}
        battleState={fullState!}
        teamName={teamName}
      />
      <DeploymentFacingPicker flow={flow} />
      <div style={controlBarStyle}>
        <button type="button" style={secondaryButtonStyle} onClick={onBack}>
          Back to Setup
        </button>
        <button
          type="button"
          style={{
            ...primaryButtonStyle,
            ...(flow.isComplete ? {} : disabledButtonStyle),
          }}
          onClick={handleStartBattle}
          disabled={!flow.isComplete}
        >
          Start Battle
        </button>
      </div>
    </div>
  );
}

// ---- styles ----

const rootStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  background: BACKGROUND,
};

const canvasHostStyle: CSSProperties = {
  position: 'absolute',
  top: 0,
  bottom: 0,
  right: 0,
  left: ROSTER_PANEL_WIDTH,
  background: BACKGROUND,
};

const controlBarStyle: CSSProperties = {
  position: 'absolute',
  top: 16,
  right: 16,
  display: 'flex',
  gap: 8,
  zIndex: 6,
};

const buttonBaseStyle: CSSProperties = {
  padding: '8px 16px',
  fontSize: 13,
  borderRadius: 5,
  borderWidth: 1,
  borderStyle: 'solid',
  fontFamily: 'inherit',
  cursor: 'pointer',
};

const primaryButtonStyle: CSSProperties = {
  ...buttonBaseStyle,
  background: '#2a3140',
  color: '#e7e9ee',
  borderColor: '#3a4150',
};

const secondaryButtonStyle: CSSProperties = {
  ...buttonBaseStyle,
  background: '#1c1e23',
  color: '#b9bcc4',
  borderColor: '#2c2f36',
};

const disabledButtonStyle: CSSProperties = {
  opacity: 0.4,
  cursor: 'not-allowed',
};

const errorRootStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: BACKGROUND,
};

const errorCardStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  padding: 28,
  maxWidth: 420,
  background: 'rgba(28, 30, 35, 0.98)',
  border: '1px solid #2c2f36',
  borderRadius: 10,
};

const errorTitleStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  color: '#f6e5a8',
};

const errorBodyStyle: CSSProperties = {
  fontSize: 13,
  lineHeight: 1.5,
  color: '#b9bcc4',
};
