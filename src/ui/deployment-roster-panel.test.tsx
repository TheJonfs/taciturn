// Smoke test for the deployment roster panel: it renders every roster
// unit, dims placed entries, and delegates clicks to the deployment
// flow (pickUnit while a tile is selected, liftUnit for a placed unit).
//
// Bare `react-dom/client` + `act` (the repo has no @testing-library) —
// same harness shape as `App.test.tsx`.

import { describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { loadDefaultCatalog } from '@content/index.ts';
import { createInitialState, teamId, unitId, type Unit } from '@engine/index.ts';
import { riverRidgeBattle } from '@content/battles/river-ridge-battle.ts';
import { createDeploymentState, type DeploymentState } from './deployment-flow.ts';
import { DeploymentRosterPanel } from './deployment-roster-panel.tsx';
import type { DeploymentFlow } from './use-deployment-flow.ts';

const BLUE = teamId('team_a');
const catalog = loadDefaultCatalog();
const initialState = createInitialState(riverRidgeBattle, catalog);
const rosterUnits: ReadonlyArray<Unit> = [...initialState.units.values()].filter(
  (u) => u.team === BLUE,
);

// A `DeploymentFlow` stub with spy handlers. `state` is overridable so
// each test can drive a particular phase / placement set.
function makeFlow(state: DeploymentState): DeploymentFlow {
  return {
    state,
    rosterUnits,
    isComplete: false,
    dispatch: vi.fn(),
    pickUnit: vi.fn(),
    liftUnit: vi.fn(),
    pickFacing: vi.fn(),
    cancel: vi.fn(),
  };
}

function render(flow: DeploymentFlow): {
  container: HTMLElement;
  cleanup: () => void;
} {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <DeploymentRosterPanel
        flow={flow}
        catalog={catalog}
        battleState={initialState}
        teamName="Blue"
      />,
    );
  });
  return {
    container,
    cleanup: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

function entryButtons(container: HTMLElement): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll('button'));
}

describe('DeploymentRosterPanel', () => {
  it('renders every roster unit by name', () => {
    const { container, cleanup } = render(makeFlow(createDeploymentState(BLUE)));
    for (const unit of rosterUnits) {
      expect(container.textContent).toContain(unit.name);
    }
    cleanup();
  });

  it('dims a placed unit and leaves available units full-opacity', () => {
    const placed: DeploymentState = {
      currentTeam: BLUE,
      phase: { kind: 'idle' },
      placements: new Map([
        [
          unitId('blue_knight_n'),
          { position: { x: 5, y: 0, layer: 0 }, facing: 'S' },
        ],
      ]),
    };
    const { container, cleanup } = render(makeFlow(placed));
    const buttons = entryButtons(container);
    const knightBtn = buttons.find((b) => b.textContent?.includes('Blue Knight'))!;
    const mageBtn = buttons.find((b) =>
      b.textContent?.includes('Blue Water Mage'),
    )!;
    expect(knightBtn.style.opacity).toBe('0.55');
    expect(mageBtn.style.opacity).not.toBe('0.55');
    cleanup();
  });

  it('clicking an available entry while a tile is selected calls pickUnit', () => {
    const flow = makeFlow({
      currentTeam: BLUE,
      phase: { kind: 'tile_selected', tile: { x: 5, y: 0, layer: 0 } },
      placements: new Map(),
    });
    const { container, cleanup } = render(flow);
    const mageBtn = entryButtons(container).find((b) =>
      b.textContent?.includes('Blue Water Mage'),
    )!;
    act(() => mageBtn.click());
    expect(flow.pickUnit).toHaveBeenCalledWith(unitId('blue_water_mage'));
    cleanup();
  });

  it('clicking a placed entry calls liftUnit (re-placement)', () => {
    const flow = makeFlow({
      currentTeam: BLUE,
      phase: { kind: 'idle' },
      placements: new Map([
        [
          unitId('blue_knight_n'),
          { position: { x: 5, y: 0, layer: 0 }, facing: 'S' },
        ],
      ]),
    });
    const { container, cleanup } = render(flow);
    const knightBtn = entryButtons(container).find((b) =>
      b.textContent?.includes('Blue Knight'),
    )!;
    act(() => knightBtn.click());
    expect(flow.liftUnit).toHaveBeenCalledWith(unitId('blue_knight_n'));
    cleanup();
  });

  it('an available entry is not clickable while idle (no tile selected)', () => {
    const flow = makeFlow(createDeploymentState(BLUE));
    const { container, cleanup } = render(flow);
    const mageBtn = entryButtons(container).find((b) =>
      b.textContent?.includes('Blue Water Mage'),
    )!;
    expect(mageBtn.disabled).toBe(true);
    act(() => mageBtn.click());
    expect(flow.pickUnit).not.toHaveBeenCalled();
    cleanup();
  });
});
