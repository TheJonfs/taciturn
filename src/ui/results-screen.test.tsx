// Session 34: ResultsScreen continuity-button wiring.
//
// The New Battle / Main Menu buttons gained real destinations this
// session (routing through battle-setup / back to title); Rematch
// stays a disabled placeholder. Fixture is a fresh River Ridge initial
// state plus a synthetic decided outcome — enough for the derived-stat
// helpers and the button row to render.
//
// Bare `react-dom/client` + `act` (the repo has no @testing-library).

import { describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createInitialState, type BattleOutcome } from '@engine/index.ts';
import { loadDefaultCatalog } from '@content/index.ts';
import { riverRidgeBattle } from '@content/battles/river-ridge-battle.ts';
import { ResultsScreen } from './results-screen.tsx';

function findButton(container: HTMLElement, text: string): HTMLButtonElement {
  const btn = Array.from(container.querySelectorAll('button')).find(
    (b) => b.textContent === text,
  );
  if (btn === undefined) throw new Error(`button "${text}" not found`);
  return btn;
}

function buildFixture() {
  const catalog = loadDefaultCatalog();
  const state = createInitialState(riverRidgeBattle, catalog);
  const outcome: BattleOutcome = {
    winner: riverRidgeBattle.teams[0]!.id,
    conditionIndex: 0,
    description: '',
  };
  return { catalog, state, outcome };
}

describe('ResultsScreen continuity buttons', () => {
  it('calls onNewBattle when New Battle is clicked', () => {
    const { catalog, state, outcome } = buildFixture();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onNewBattle = vi.fn();
    act(() => {
      root.render(
        <ResultsScreen
          state={state}
          outcome={outcome}
          catalog={catalog}
          onClose={() => {}}
          onNewBattle={onNewBattle}
          onMainMenu={() => {}}
        />,
      );
    });
    act(() => {
      findButton(container, 'New Battle').click();
    });
    expect(onNewBattle).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
    container.remove();
  });

  it('calls onMainMenu when Main Menu is clicked', () => {
    const { catalog, state, outcome } = buildFixture();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onMainMenu = vi.fn();
    act(() => {
      root.render(
        <ResultsScreen
          state={state}
          outcome={outcome}
          catalog={catalog}
          onClose={() => {}}
          onNewBattle={() => {}}
          onMainMenu={onMainMenu}
        />,
      );
    });
    act(() => {
      findButton(container, 'Main Menu').click();
    });
    expect(onMainMenu).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
    container.remove();
  });

  it('leaves Rematch disabled (no destination yet)', () => {
    const { catalog, state, outcome } = buildFixture();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <ResultsScreen
          state={state}
          outcome={outcome}
          catalog={catalog}
          onClose={() => {}}
          onNewBattle={() => {}}
          onMainMenu={() => {}}
        />,
      );
    });
    expect(findButton(container, 'Rematch').disabled).toBe(true);
    act(() => root.unmount());
    container.remove();
  });
});
