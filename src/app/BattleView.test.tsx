// Session 33.5A (B4): error boundary around `BattleViewInner`.
//
// `BattleViewInner` mounts PixiJS + the orchestrator pump in a large
// effect; a render-time throw — most reliably the content-file HMR path
// (S33.5 carry-forward) — otherwise unmounts the React tree to a blank
// canvas with no recovery affordance. `BattleErrorBoundary` catches the
// throw and degrades to a fallback panel with a hard-refresh button.
//
// Tested in isolation with bare `react-dom/client` + `act` (the repo has
// no @testing-library); a synthetic child throw stands in for the real
// HMR/Pixi-init crash, which this boundary degrades but does not fix.

import { describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { BattleErrorBoundary } from './BattleView.tsx';

function Boom(): never {
  throw new Error('synthetic render throw');
}

describe('BattleErrorBoundary', () => {
  it('catches a render-time throw and shows the fallback panel instead of black-screening', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    // React logs the caught error to console.error (and the boundary's
    // own componentDidCatch does too) — silence both for a clean run.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    act(() => {
      root.render(
        <BattleErrorBoundary>
          <Boom />
        </BattleErrorBoundary>,
      );
    });
    expect(container.textContent).toContain('Something went wrong');
    expect(container.querySelector('button')?.textContent).toBe('Reload');
    spy.mockRestore();
    act(() => root.unmount());
    container.remove();
  });

  it('renders children unchanged when they do not throw', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <BattleErrorBoundary>
          <div>battle ok</div>
        </BattleErrorBoundary>,
      );
    });
    expect(container.textContent).toContain('battle ok');
    expect(container.querySelector('button')).toBeNull();
    act(() => root.unmount());
    container.remove();
  });
});
