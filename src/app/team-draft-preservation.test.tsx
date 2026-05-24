// Session 37: team-build draft preservation across back-navigation.
//
// Lifts `teamDraft` into `App` (per S37 decision 1). The draft survives
// Team Builder ↔ Setup ↔ Deployment back-and-forth and is cleared on
// (a) return-to-title and (b) battle start (deployment commit).
//
// Driven by the `Load Default…` select — the simplest mutation surface
// in the team builder that puts known classes onto every unit and
// becomes visible in the "Editing Unit N — <ClassName>" header.

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

function findSelect(container: HTMLElement): HTMLSelectElement {
  const sel = container.querySelector('select');
  if (sel === null) throw new Error('no <select> on team builder screen');
  return sel as HTMLSelectElement;
}

// Drive the "Load Default…" select via a React-friendly value setter +
// dispatched change event. Mirrors the standard pattern for testing
// controlled selects without @testing-library.
function selectOption(select: HTMLSelectElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLSelectElement.prototype,
    'value',
  )?.set;
  setter?.call(select, value);
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

function gotoTeamBuilder(container: HTMLElement): void {
  act(() => {
    findButton(container, 'New Battle').click();
  });
  act(() => {
    findButton(container, 'Start River Ridge').click();
  });
}

describe('Session 37 — team-build draft preservation', () => {
  it('preserves the draft across Team Builder → Setup → Team Builder', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(<App />);
    });

    gotoTeamBuilder(container);

    // Fresh draft — no class on Unit 1.
    expect(container.textContent).toContain('Editing Unit 1');
    expect(container.textContent).not.toContain('Editing Unit 1 — Knight');

    // Load the Gravity Well template — Unit 1 is the Knight.
    act(() => {
      selectOption(findSelect(container), 'gravity-well');
    });
    expect(container.textContent).toContain('Editing Unit 1 — Knight');

    // Back to Setup, then forward into Team Builder again.
    act(() => {
      findButton(container, 'Back to Setup').click();
    });
    act(() => {
      findButton(container, 'Start River Ridge').click();
    });

    // The draft was preserved — Unit 1 is still the Knight.
    expect(container.textContent).toContain('Editing Unit 1 — Knight');

    act(() => root.unmount());
    container.remove();
  });

  it('clears the draft on return-to-title', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(<App />);
    });

    gotoTeamBuilder(container);
    act(() => {
      selectOption(findSelect(container), 'gravity-well');
    });
    expect(container.textContent).toContain('Editing Unit 1 — Knight');

    // Back to Setup, then Back (to Title).
    act(() => {
      findButton(container, 'Back to Setup').click();
    });
    act(() => {
      findButton(container, 'Back').click();
    });
    // On title — confirm.
    expect(findButton(container, 'New Battle')).toBeTruthy();

    // Forward again to a fresh Team Builder.
    gotoTeamBuilder(container);
    expect(container.textContent).toContain('Editing Unit 1');
    expect(container.textContent).not.toContain('Editing Unit 1 — Knight');

    act(() => root.unmount());
    container.remove();
  });

  // Team Builder ↔ Deployment round-trip preservation, and the
  // commit-clears-draft semantics, are covered by manual browser
  // verification — DeploymentScreen mounts a live Pixi `Application`
  // that jsdom can't drive (per CLAUDE.md's "UI/renderer tests are
  // deferred"). The wiring under test is the same `teamDraft` lift that
  // the two cases above exercise; what's different at the deployment
  // edge is the `onCommit` path setting `teamDraft = null`, which is
  // a one-line clear adjacent to the test cases above.

  it('preserves an edited unit name across Team Builder back-navigation (S38)', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(<App />);
    });

    gotoTeamBuilder(container);

    // Load a template so Unit 1 has a class (and an auto-picked name).
    act(() => {
      selectOption(findSelect(container), 'gravity-well');
    });

    // Change the name input on the focused unit (slot 0).
    const nameInput = container.querySelector(
      'input[placeholder="Unit name"]',
    ) as HTMLInputElement | null;
    expect(nameInput).not.toBeNull();
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set;
    act(() => {
      setter?.call(nameInput, 'Aldwin');
      nameInput!.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(
      (container.querySelector('input[placeholder="Unit name"]') as HTMLInputElement)
        .value,
    ).toBe('Aldwin');

    // Back to Setup, then forward into Team Builder again.
    act(() => {
      findButton(container, 'Back to Setup').click();
    });
    act(() => {
      findButton(container, 'Start River Ridge').click();
    });

    // The edited name was preserved.
    expect(
      (container.querySelector('input[placeholder="Unit name"]') as HTMLInputElement)
        .value,
    ).toBe('Aldwin');

    act(() => root.unmount());
    container.remove();
  });
});
