// CampaignApp — routing-into-a-story-node regression (TABA M1.5).
//
// The run→run transition a route creates (world-map → the next node's opening
// run) must REMOUNT the generic runner with a fresh nonce. A regression here
// reused the just-finished world-map runner's stale cursor, so a routed-into
// standalone story node skipped its dialogue and jumped straight to the next
// map. This drives that exact path — which stays entirely in presentational
// runs (no formation/battle → no Pixi), so it is unit-testable.
//
// Bare `react-dom/client` + `act` (the repo has no @testing-library).

import { describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { loadDefaultCatalog } from '@content/index.ts';
import { CampaignApp } from './CampaignApp.tsx';
import { M1_CAMPAIGN_GRAPH, M1_NODES, m0Roster, startCampaign } from '@campaign/index.ts';

const catalog = loadDefaultCatalog();

function mount(ui: React.ReactElement): { container: HTMLElement; root: Root } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(ui));
  return { container, root };
}

function clickAria(container: HTMLElement, label: string): void {
  const el = Array.from(container.querySelectorAll('button, [role="button"]')).find(
    (e) => e.getAttribute('aria-label') === label,
  );
  if (el === undefined) throw new Error(`clickable "${label}" not found`);
  act(() => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));
}

describe('CampaignApp — routing into a standalone story node', () => {
  it('plays the routed-into node’s dialogue instead of skipping to the next map', () => {
    // Resume at Marshmoor's world-map (awaiting_route); its only win-choice is
    // the standalone story node "The Crossing".
    const base = startCampaign(M1_CAMPAIGN_GRAPH, m0Roster, catalog);
    const atMarshmoorMap = {
      ...base,
      currentNodeId: M1_NODES.marshmoor,
      phase: 'awaiting_route' as const,
    };
    const { container, root } = mount(
      <CampaignApp initialState={atMarshmoorMap} catalog={catalog} onExitToTitle={() => {}} />,
    );

    // The world map for Marshmoor → route to The Crossing.
    expect(container.textContent).toContain('The Road Ahead');
    clickAria(container, 'March to The Crossing');

    // The Crossing's FIRST dialogue line must render — not be skipped by a stale
    // runner cursor landing on the trailing world-map beat.
    expect(container.textContent).toContain('The river is quiet here');
    expect(container.textContent).not.toContain('The Road Ahead');

    act(() => root.unmount());
    container.remove();
  });
});
