// TeamBuilderUnitCard — focused render tests for the Pass 1 redesign.
//
// Two things the redesign is responsible for and the integration tests
// don't pin: (1) the card surfaces the *complete* live stat line —
// including Move and Jump, which the old roster readout omitted; and (2)
// the class-as-mode toggle (compact chip ↔ full picker grid).
//
// Driven through a tiny harness that wires the real `useTeamBuilder`
// hook to the card, seeded with the Gravity Well template so slot 0 is
// the Assassin.

import { describe, expect, it } from 'vitest';
import { act, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { loadDefaultCatalog } from '@content/index.ts';
import { riverRidgeBattle } from '@content/battles/river-ridge-battle.ts';
import { gravityWell } from '@content/teams/index.ts';
import { teamBuilderStateFromBuiltTeam } from './team-builder-state.ts';
import { useTeamBuilder } from './use-team-builder.ts';
import { TeamBuilderUnitCard } from './team-builder-unit-card.tsx';

const catalog = loadDefaultCatalog();
const draft = teamBuilderStateFromBuiltTeam(gravityWell);

function Harness(): ReactElement {
  const builder = useTeamBuilder({
    mapTemplate: riverRidgeBattle,
    catalog,
    initialDraft: draft,
  });
  return <TeamBuilderUnitCard builder={builder} catalog={catalog} />;
}

function findButton(container: HTMLElement, text: string): HTMLButtonElement {
  const btn = Array.from(container.querySelectorAll('button')).find(
    (b) => b.textContent === text,
  );
  if (btn === undefined) throw new Error(`button "${text}" not found`);
  return btn;
}

function mount(): { container: HTMLElement; unmount: () => void } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<Harness />);
  });
  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe('TeamBuilderUnitCard — Pass 1', () => {
  it('renders the complete live stat line including Move and Jump', () => {
    const { container, unmount } = mount();
    // The stat block renders the seven cells contiguously; this sequence
    // (with Move and Jump present, values left as \d+ so balance tweaks
    // don't break it) appears only in the stat block, never the ability
    // list. The old roster readout stopped at SPD.
    expect(container.textContent).toMatch(
      /HP\d+MP\d+PA\d+MA\d+SPD\d+Move\d+Jump\d+/,
    );
    unmount();
  });

  it('shows the class compactly with a change control, and reopens the grid as a mode', () => {
    const { container, unmount } = mount();

    // Slot 0 is the Assassin: chip + change control, not the picker grid.
    expect(container.textContent).toContain('Change class');
    expect(container.textContent).not.toContain('Choose a class');
    // The chip shows the class and its role tagline.
    expect(container.textContent).toContain('Swift debilitating skirmisher');

    // Reopen the grid as a mode — the other classes' cards appear and a
    // Cancel control collapses it.
    act(() => findButton(container, 'Change class').click());
    expect(container.textContent).toContain('Armored melee frontline'); // Knight card
    expect(findButton(container, 'Cancel')).toBeTruthy();

    // Cancel collapses back to the chip without changing the class.
    act(() => findButton(container, 'Cancel').click());
    expect(container.textContent).toContain('Change class');
    expect(container.textContent).toContain('Swift debilitating skirmisher');

    unmount();
  });
});
