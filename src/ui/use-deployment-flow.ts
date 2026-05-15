// useDeploymentFlow — React glue around the pure `deployment-flow`
// reducer. Sibling to `use-turn-flow.ts`.
//
// Owns:
//   - The deployment state (via `useReducer` over the pure reducer).
//   - Renderer side effects: the zone tint (drawn once at mount), the
//     facing-arrow layer (shown only in `unit_selected`), and the
//     placed-unit sprites (added / removed / repositioned as the
//     `placements` map changes).
//   - Input wiring: resolves a raw renderer tile-click into the right
//     deployment event (lift a placed unit / select an eligible tile /
//     cancel on an off-zone click), and the facing-arrow clicks into
//     `pickFacing`.
//
// The hook is the only place that knows about the renderer; the
// `DeploymentScreen` and the roster panel / facing picker consume its
// return value. Team-parameterized by `currentTeam` — nothing here
// hardcodes Blue.

import { useEffect, useMemo, useReducer, useRef, type Dispatch } from 'react';
import {
  tileAt,
  type BattleMap,
  type Direction,
  type Position,
  type TeamId,
  type Unit,
  type UnitId,
} from '@engine/index.ts';
import type { BattleRenderer } from '@renderer/index.ts';
import {
  createDeploymentState,
  isDeploymentComplete,
  transition,
  unitPlacedOn,
  type DeploymentEvent,
  type DeploymentState,
} from './deployment-flow.ts';

export interface UseDeploymentFlowArgs {
  // `null` until the DeploymentScreen has mounted its renderer.
  readonly renderer: BattleRenderer | null;
  readonly map: BattleMap;
  readonly currentTeam: TeamId;
  // The deploying team's units — the roster. Canonical `Unit` objects
  // (from `createInitialState`); the hook overrides position + facing
  // when a unit is placed.
  readonly rosterUnits: ReadonlyArray<Unit>;
}

export interface DeploymentFlow {
  readonly state: DeploymentState;
  readonly rosterUnits: ReadonlyArray<Unit>;
  // True once every roster unit has a placement — gates "Start Battle".
  readonly isComplete: boolean;
  // Raw reducer dispatch — the wrapped helpers below cover the common
  // UI paths; `dispatch` is exposed for parity with `useTurnFlow` and
  // for the DEV debug surface (the deployment-mode equivalent of
  // BattleView's `__taciturnDebug`, since synthetic Pixi pointer events
  // can't drive the canvas tile-click in a headless preview).
  readonly dispatch: Dispatch<DeploymentEvent>;
  // Roster panel: commit the picked unit to the selected tile. No-op
  // unless the flow is in `tile_selected`.
  readonly pickUnit: (unitId: UnitId) => void;
  // Roster panel / map: lift a placed unit back to the roster and
  // re-select its prior tile (re-placement).
  readonly liftUnit: (unitId: UnitId) => void;
  // Facing picker: commit the chosen facing. No-op unless the flow is
  // in `unit_selected`.
  readonly pickFacing: (direction: Direction) => void;
  // Back out one step (Escape / picker back-arrow).
  readonly cancel: () => void;
}

export function useDeploymentFlow({
  renderer,
  map,
  currentTeam,
  rosterUnits,
}: UseDeploymentFlowArgs): DeploymentFlow {
  const [state, dispatch] = useReducer(
    transition,
    currentTeam,
    createDeploymentState,
  );

  const rosterById = useMemo(
    () => new Map(rosterUnits.map((u) => [u.id, u])),
    [rosterUnits],
  );
  const rosterIds = useMemo(() => rosterUnits.map((u) => u.id), [rosterUnits]);

  // ===== Zone tint — drawn once when the renderer is available =====
  useEffect(() => {
    if (renderer === null) return;
    renderer.drawDeploymentZone(map, currentTeam);
    return () => renderer.clearDeploymentZone();
  }, [renderer, map, currentTeam]);

  // ===== Tile-click wiring =====
  // Re-registered on `state` change so the handler closes over the
  // current placements (for the `unitPlacedOn` lift check).
  useEffect(() => {
    if (renderer === null) return;
    const handler = (pos: Position): void => {
      // A placed unit on this tile → lift it (re-placement flow).
      const placed = unitPlacedOn(state, pos);
      if (placed !== null) {
        dispatch({ kind: 'liftUnit', unitId: placed });
        return;
      }
      // An eligible empty tile in the current team's zone → select it.
      const tile = tileAt(map, pos.x, pos.y, pos.layer);
      if (tile?.deploymentZone === currentTeam) {
        dispatch({ kind: 'selectTile', tile: pos });
        return;
      }
      // Anything else (off-zone, opponent zone, neutral tile) → cancel
      // the current selection.
      dispatch({ kind: 'cancel' });
    };
    renderer.setOnTileClick(handler);
    return () => renderer.setOnTileClick(null);
  }, [renderer, state, map, currentTeam]);

  // ===== Facing-arrow click wiring — registered once =====
  useEffect(() => {
    if (renderer === null) return;
    renderer.setOnDeploymentFacingPick((direction) => {
      dispatch({ kind: 'pickFacing', facing: direction });
    });
    return () => renderer.setOnDeploymentFacingPick(null);
  }, [renderer]);

  // ===== Facing-arrow layer visibility =====
  useEffect(() => {
    if (renderer === null) return;
    if (state.phase.kind === 'unit_selected') {
      renderer.showDeploymentFacing(state.phase.tile);
    } else {
      renderer.showDeploymentFacing(null);
    }
  }, [renderer, state.phase]);

  // ===== Placed-unit sprite sync =====
  // Reconciles the renderer's deployment sprites against the current
  // `placements` map whenever it changes.
  const renderedRef = useRef<Set<UnitId>>(new Set());
  useEffect(() => {
    if (renderer === null) return;
    const placed = state.placements;
    for (const id of [...renderedRef.current]) {
      if (!placed.has(id)) {
        renderer.removeDeploymentUnit(id);
        renderedRef.current.delete(id);
      }
    }
    for (const [id, placement] of placed) {
      const base = rosterById.get(id);
      if (base === undefined) continue;
      renderer.setDeploymentUnit({
        ...base,
        position: placement.position,
        facing: placement.facing,
      });
      renderedRef.current.add(id);
    }
  }, [renderer, state.placements, rosterById]);

  return {
    state,
    rosterUnits,
    isComplete: isDeploymentComplete(state, rosterIds),
    dispatch,
    pickUnit: (unitId) => dispatch({ kind: 'pickUnit', unitId }),
    liftUnit: (unitId) => dispatch({ kind: 'liftUnit', unitId }),
    pickFacing: (direction) => dispatch({ kind: 'pickFacing', facing: direction }),
    cancel: () => dispatch({ kind: 'cancel' }),
  };
}
