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
import { CAMPAIGN_GRAPH, CAMPAIGN_NODES, m0Roster, startCampaign } from '@campaign/index.ts';

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

describe('CampaignApp — routing into a node with a leading story run', () => {
  it('plays the routed-into node’s dialogue instead of skipping to the next map', () => {
    // Resume at Zarghidas's world-map (awaiting_route); its only win-choice
    // is Oskun Fields, whose engagement opens with a story scene.
    const base = startCampaign(CAMPAIGN_GRAPH, m0Roster, catalog);
    const atZarghidasMap = {
      ...base,
      // Travel-model invariants (M3 Stage 1): the position is visited, and
      // awaiting_route means the node's story beat is cleared — that's what
      // opens its win-edge to Oskun as a frontier choice.
      clearedStoryBeats: [CAMPAIGN_NODES.zarghidas],
      phase: 'awaiting_route' as const,
    };
    const { container, root } = mount(
      <CampaignApp initialState={atZarghidasMap} catalog={catalog} onExitToTitle={() => {}} />,
    );

    // The world map for Zarghidas → route to Oskun Fields.
    expect(container.textContent).toContain('The Road Ahead');
    clickAria(container, 'March to Oskun Fields');

    // Oskun's FIRST scene line must render — not be skipped by a stale
    // runner cursor landing on the trailing world-map beat.
    expect(container.textContent).toContain('Wiegraf Folles');
    expect(container.textContent).not.toContain('The Road Ahead');

    act(() => root.unmount());
    container.remove();
  });
});

describe('CampaignApp — re-entering a CLEARED node (M3 economy Stage 1)', () => {
  it('shows the location menu instead of replaying the cleared story beat', () => {
    // Traveled back to cleared, farmable Oskun (in_progress at it — the
    // exact state a reload lands on mid-return). Entry resolution must offer
    // the skirmish, NOT the intro dialogue or the story battle's formation.
    const base = startCampaign(CAMPAIGN_GRAPH, m0Roster, catalog);
    const backAtClearedOskun = {
      ...base,
      currentNodeId: CAMPAIGN_NODES.oskun,
      visited: [CAMPAIGN_NODES.zarghidas, CAMPAIGN_NODES.oskun],
      clearedStoryBeats: [CAMPAIGN_NODES.zarghidas, CAMPAIGN_NODES.oskun],
      phase: 'in_progress' as const,
    };
    const { container, root } = mount(
      <CampaignApp initialState={backAtClearedOskun} catalog={catalog} onExitToTitle={() => {}} />,
    );

    // The location menu, with the skirmish valve open…
    expect(container.textContent).toContain('Skirmish');
    expect(container.textContent).toContain('enemy level');
    // …and no trace of the cleared beat (its opening line) or the map.
    expect(container.textContent).not.toContain('Wiegraf Folles');
    expect(container.textContent).not.toContain('The Road Ahead');

    act(() => root.unmount());
    container.remove();
  });
});
