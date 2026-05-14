// Session 34: BattleSetupScreen smoke + interaction tests.
//
// Bare `react-dom/client` + `act` (the repo has no @testing-library).

import { describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { BattleSetupScreen } from './BattleSetupScreen.tsx';

function findButton(container: HTMLElement, text: string): HTMLButtonElement {
  const btn = Array.from(container.querySelectorAll('button')).find(
    (b) => b.textContent === text,
  );
  if (btn === undefined) throw new Error(`button "${text}" not found`);
  return btn;
}

describe('BattleSetupScreen', () => {
  it('renders the River Ridge card without throwing', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(<BattleSetupScreen onStart={() => {}} onBack={() => {}} />);
    });
    expect(container.textContent).toContain('River Ridge');
    expect(findButton(container, 'Start River Ridge')).toBeTruthy();
    expect(findButton(container, 'Back')).toBeTruthy();
    act(() => root.unmount());
    container.remove();
  });

  it('calls onStart when Start River Ridge is clicked', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onStart = vi.fn();
    act(() => {
      root.render(<BattleSetupScreen onStart={onStart} onBack={() => {}} />);
    });
    act(() => {
      findButton(container, 'Start River Ridge').click();
    });
    expect(onStart).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
    container.remove();
  });

  it('calls onBack when Back is clicked', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onBack = vi.fn();
    act(() => {
      root.render(<BattleSetupScreen onStart={() => {}} onBack={onBack} />);
    });
    act(() => {
      findButton(container, 'Back').click();
    });
    expect(onBack).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
    container.remove();
  });
});
