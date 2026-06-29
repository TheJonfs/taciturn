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
      root.render(<TitleScreen onStart={() => {}} onNewCampaign={() => {}} />);
    });
    expect(findButton(container, 'New Battle')).toBeTruthy();
    expect(findButton(container, 'New Campaign')).toBeTruthy();
    // Resume is disabled when no save (onResumeCampaign omitted).
    expect(findButton(container, 'Resume Campaign').disabled).toBe(true);
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
      root.render(<TitleScreen onStart={onStart} onNewCampaign={() => {}} />);
    });
    act(() => {
      findButton(container, 'New Battle').click();
    });
    expect(onStart).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
    container.remove();
  });

  it('calls onNewCampaign when New Campaign is clicked', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onNewCampaign = vi.fn();
    act(() => {
      root.render(<TitleScreen onStart={() => {}} onNewCampaign={onNewCampaign} />);
    });
    act(() => {
      findButton(container, 'New Campaign').click();
    });
    expect(onNewCampaign).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
    container.remove();
  });

  it('enables and fires Resume Campaign when a resume handler is provided', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onResumeCampaign = vi.fn();
    act(() => {
      root.render(
        <TitleScreen onStart={() => {}} onNewCampaign={() => {}} onResumeCampaign={onResumeCampaign} />,
      );
    });
    const resume = findButton(container, 'Resume Campaign');
    expect(resume.disabled).toBe(false);
    act(() => resume.click());
    expect(onResumeCampaign).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
    container.remove();
  });

  it('calls onStart on Enter keydown', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onStart = vi.fn();
    act(() => {
      root.render(<TitleScreen onStart={onStart} onNewCampaign={() => {}} />);
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    });
    expect(onStart).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
    container.remove();
  });
});
