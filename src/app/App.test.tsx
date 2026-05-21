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

function findButtons(container: HTMLElement, text: string): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll('button')).filter(
    (b) => b.textContent === text,
  );
}

// Load a default template into the team builder so the team validates
// and the continue button enables. Mirrors the draft-preservation tests.
function loadDefaultTemplate(container: HTMLElement): void {
  const select = container.querySelector('select');
  if (select === null) throw new Error('no <select> on team builder screen');
  const setter = Object.getOwnPropertyDescriptor(
    HTMLSelectElement.prototype,
    'value',
  )?.set;
  act(() => {
    setter?.call(select, 'current-test-team');
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
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

describe('App — unified team flow (S43)', () => {
  it('runs the builder for Team A then Team B, with no handoff in single-player', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<App />));

    act(() => findButton(container, 'New Battle').click());
    // Default controls: Team A human, Team B AI → single-player.
    act(() => findButton(container, 'Start River Ridge').click());
    expect(container.textContent).toContain('Build Team A (Blue)');

    loadDefaultTemplate(container);
    act(() => findButton(container, 'Continue to Team B').click());

    // No handoff (not both human) — straight to the Team B builder.
    expect(container.textContent).toContain('Build Team B (Red)');
    expect(container.textContent).not.toContain('your turn');

    act(() => root.unmount());
    container.remove();
  });

  it('goes straight to Team B in pass-and-play with the handoff prompt off (default)', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<App />));

    act(() => findButton(container, 'New Battle').click());
    // Switch Team B to Human → pass-and-play. Second "Human" segment is
    // Team B's.
    const humanButtons = findButtons(container, 'Human');
    act(() => humanButtons[1]!.click());
    expect(container.textContent).toContain('Pass-and-play');

    act(() => findButton(container, 'Start River Ridge').click());
    loadDefaultTemplate(container);
    act(() => findButton(container, 'Continue to Team B').click());

    // The handoff prompt defaults OFF (it's an opt-in pause-menu setting),
    // so even both-human flows straight to the Team B builder with no
    // interstitial "pass the device" screen.
    expect(container.textContent).not.toContain('your turn');
    expect(container.textContent).toContain('Build Team B (Red)');

    act(() => root.unmount());
    container.remove();
  });

  it('steps back from the Team B builder to the Team A builder', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<App />));

    act(() => findButton(container, 'New Battle').click());
    act(() => findButton(container, 'Start River Ridge').click());
    loadDefaultTemplate(container);
    act(() => findButton(container, 'Continue to Team B').click());
    expect(container.textContent).toContain('Build Team B (Red)');

    // Back from Team B returns to the Team A builder (not all the way to
    // setup).
    act(() => findButton(container, 'Back to Team A (Blue)').click());
    expect(container.textContent).toContain('Build Team A (Blue)');

    act(() => root.unmount());
    container.remove();
  });
});
