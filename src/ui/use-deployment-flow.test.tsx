// Tile-click routing test for `useDeploymentFlow`: a raw renderer tile
// click is resolved into the right deployment event — select an
// eligible in-zone tile, lift a placed unit, or cancel on an off-zone
// click.
//
// The renderer is faked (the hook only needs it to register the
// tile-click handler); the deployment flow itself is the real reducer.
// Bare `react-dom/client` + `act` harness, same as `App.test.tsx`.

import { describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { loadDefaultCatalog } from '@content/index.ts';
import {
  createInitialState,
  teamId,
  unitId,
  type Position,
  type Unit,
} from '@engine/index.ts';
import { deploymentZonesFor } from '@content/deployment/index.ts';
import { riverRidgeBattle } from '@content/battles/river-ridge-battle.ts';
import type { BattleRenderer } from '@renderer/index.ts';
import { useDeploymentFlow, type DeploymentFlow } from './use-deployment-flow.ts';

const BLUE = teamId('team_a');
const catalog = loadDefaultCatalog();
const rosterUnits: ReadonlyArray<Unit> = [
  ...createInitialState(riverRidgeBattle, catalog).units.values(),
].filter((u) => u.team === BLUE);

// A renderer stub that captures the tile-click handler the hook
// registers, so a test can fire synthetic clicks. Everything else is a
// no-op — the hook's other renderer calls don't affect routing.
function makeFakeRenderer(): {
  renderer: BattleRenderer;
  clickTile: (pos: Position) => void;
} {
  let tileClick: ((pos: Position) => void) | null = null;
  const fake = {
    drawDeploymentZone: () => {},
    clearDeploymentZone: () => {},
    setOnTileClick: (h: ((pos: Position) => void) | null) => {
      tileClick = h;
    },
    setOnDeploymentFacingPick: () => {},
    showDeploymentFacing: () => {},
    setDeploymentUnit: () => {},
    removeDeploymentUnit: () => {},
  };
  return {
    renderer: fake as unknown as BattleRenderer,
    clickTile: (pos) => tileClick?.(pos),
  };
}

// Module-level capture of the latest flow value the harness rendered.
let capturedFlow: DeploymentFlow;
function Harness({ renderer }: { renderer: BattleRenderer }) {
  capturedFlow = useDeploymentFlow({
    renderer,
    zones: deploymentZonesFor('river_ridge'),
    currentTeam: BLUE,
    rosterUnits,
  });
  return null;
}

function mount(renderer: BattleRenderer): () => void {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<Harness renderer={renderer} />);
  });
  return () => {
    act(() => root.unmount());
    container.remove();
  };
}

// River Ridge: Blue zone is rows 0-2 cols 5-8; Red zone rows 11-13.
const blueZoneTile: Position = { x: 5, y: 0, layer: 0 };
const redZoneTile: Position = { x: 5, y: 11, layer: 0 };
const offZoneTile: Position = { x: 0, y: 0, layer: 0 }; // deep water, no zone

describe('useDeploymentFlow — tile-click routing', () => {
  it('an eligible Blue-zone tile click routes to selectTile', () => {
    const { renderer, clickTile } = makeFakeRenderer();
    const cleanup = mount(renderer);
    act(() => clickTile(blueZoneTile));
    expect(capturedFlow.state.phase).toEqual({
      kind: 'tile_selected',
      tile: blueZoneTile,
    });
    cleanup();
  });

  it('an opponent-zone tile click is not eligible — cancels instead', () => {
    const { renderer, clickTile } = makeFakeRenderer();
    const cleanup = mount(renderer);
    act(() => clickTile(blueZoneTile)); // → tile_selected
    act(() => clickTile(redZoneTile)); // not Blue's zone → cancel
    expect(capturedFlow.state.phase.kind).toBe('idle');
    cleanup();
  });

  it('an off-zone tile click cancels the current selection', () => {
    const { renderer, clickTile } = makeFakeRenderer();
    const cleanup = mount(renderer);
    act(() => clickTile(blueZoneTile)); // → tile_selected
    act(() => clickTile(offZoneTile)); // deep water → cancel
    expect(capturedFlow.state.phase.kind).toBe('idle');
    cleanup();
  });

  it('clicking a placed unit lifts it back to the roster', () => {
    const { renderer, clickTile } = makeFakeRenderer();
    const cleanup = mount(renderer);
    // Place a unit: select tile → pick unit → pick facing.
    act(() => clickTile(blueZoneTile));
    act(() => capturedFlow.pickUnit(unitId('blue_knight_n')));
    act(() => capturedFlow.pickFacing('S'));
    expect(capturedFlow.state.placements.has(unitId('blue_knight_n'))).toBe(true);

    // Clicking that same tile now resolves to a lift, not a select.
    act(() => clickTile(blueZoneTile));
    expect(capturedFlow.state.placements.has(unitId('blue_knight_n'))).toBe(false);
    expect(capturedFlow.state.phase).toEqual({
      kind: 'tile_selected',
      tile: blueZoneTile,
    });
    cleanup();
  });
});
