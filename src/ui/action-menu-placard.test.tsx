// S95 (WI4): the not-our-turn placard. A GUEST is player-side but AI-driven —
// its turn must read as an ally acting alone, not "Opponent's turn" (the S93
// leftover). The placard branch early-returns off {isOurTurn, activeUnit}, so
// a minimal TurnFlow stub is enough.
//
// Bare `react-dom/client` + `act` (the repo has no @testing-library).

import { describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { makeUnit } from '../engine/ct/test-fixtures.ts';
import { loadDefaultCatalog } from '@content/index.ts';
import type { Unit } from '@engine/index.ts';
import { ActionMenu } from './action-menu.tsx';
import type { TurnFlow } from './use-turn-flow.ts';

const catalog = loadDefaultCatalog();

function renderPlacard(activeUnit: Unit | null): string {
  const turnFlow = { state: { kind: 'idle' }, isOurTurn: false, activeUnit } as unknown as TurnFlow;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <ActionMenu turnFlow={turnFlow} catalog={catalog} engineState={null} onOpenUnitDetail={undefined} />,
    );
  });
  const text = container.textContent ?? '';
  act(() => root.unmount());
  container.remove();
  return text;
}

describe('ActionMenu not-our-turn placard (S95 WI4)', () => {
  it("a GUEST's turn reads as an ally acting, by name — not the opponent", () => {
    const sera: Unit = { ...makeUnit({ id: 'sera', spd: 10 }), name: 'Sera', guest: true };
    const text = renderPlacard(sera);
    expect(text).toContain("Ally's turn — Sera");
    expect(text).not.toContain('Opponent');
  });

  it("an enemy's turn still reads Opponent's turn", () => {
    const foe: Unit = { ...makeUnit({ id: 'foe', spd: 10, team: 'team_b' }), name: 'Bandit' };
    expect(renderPlacard(foe)).toContain("Opponent's turn");
  });
});
