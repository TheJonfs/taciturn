// Session 34: App-shell routing integration test.
//
// Covers the title <-> setup transitions — the pure routing logic of
// the screen-state switch. The setup -> battle transition mounts a live
// Pixi `Application` (BattleView), which is verified manually in the
// browser preview per CLAUDE.md ("UI/renderer tests are deferred"); the
// `setScreen('battle')` setter it fires is the same mechanism exercised
// here.
//
// Bare `react-dom/client` + `act` (the repo has no @testing-library).

import { describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';

function findButton(container: HTMLElement, text: string): HTMLButtonElement {
  const btn = Array.from(container.querySelectorAll('button')).find(
    (b) => b.textContent === text,
  );
  if (btn === undefined) throw new Error(`button "${text}" not found`);
  return btn;
}

describe('App routing', () => {
  it('boots into the title screen', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(<App />);
    });
    expect(findButton(container, 'New Battle')).toBeTruthy();
    expect(container.textContent).not.toContain('Start River Ridge');
    act(() => root.unmount());
    container.remove();
  });

  it('routes title -> setup on New Battle, and setup -> title on Back', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(<App />);
    });

    act(() => {
      findButton(container, 'New Battle').click();
    });
    // Now on the battle-setup screen.
    expect(findButton(container, 'Start River Ridge')).toBeTruthy();

    act(() => {
      findButton(container, 'Back').click();
    });
    // Back on the title screen.
    expect(findButton(container, 'New Battle')).toBeTruthy();
    expect(container.textContent).not.toContain('Start River Ridge');

    act(() => root.unmount());
    container.remove();
  });
});
