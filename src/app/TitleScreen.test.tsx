// Session 34: TitleScreen smoke + interaction tests.
//
// Bare `react-dom/client` + `act` (the repo has no @testing-library).

import { describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { TitleScreen } from './TitleScreen.tsx';

function findButton(container: HTMLElement, text: string): HTMLButtonElement {
  const btn = Array.from(container.querySelectorAll('button')).find(
    (b) => b.textContent === text,
  );
  if (btn === undefined) throw new Error(`button "${text}" not found`);
  return btn;
}

describe('TitleScreen', () => {
  it('renders the menu without throwing', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(<TitleScreen onStart={() => {}} />);
    });
    expect(findButton(container, 'New Battle')).toBeTruthy();
    expect(findButton(container, 'Continue').disabled).toBe(true);
    expect(findButton(container, 'Settings').disabled).toBe(true);
    expect(findButton(container, 'Quit').disabled).toBe(true);
    act(() => root.unmount());
    container.remove();
  });

  it('calls onStart when New Battle is clicked', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onStart = vi.fn();
    act(() => {
      root.render(<TitleScreen onStart={onStart} />);
    });
    act(() => {
      findButton(container, 'New Battle').click();
    });
    expect(onStart).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
    container.remove();
  });

  it('calls onStart on Enter keydown', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onStart = vi.fn();
    act(() => {
      root.render(<TitleScreen onStart={onStart} />);
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    });
    expect(onStart).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
    container.remove();
  });
});
