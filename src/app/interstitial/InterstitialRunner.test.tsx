// InterstitialRunner — the generic beat-walker's first React test (TABA M1.5).
//
// M1 deferred a runner test (it only ever ran 1–2 beats). M1.5 runs 3+ beats,
// so this walks a mixed presentational sequence — story-scene → result-summary
// → world-map-choice — clicking through each, and asserts the runner advances
// generically (registry dispatch by `beat.type`) and calls `onComplete` with
// the merged output (the world-map's chosen route). Proves the acceptance
// criterion "the runner plays 3+ beats" and the open-set dispatch.
//
// Bare `react-dom/client` + `act` (the repo has no @testing-library — see
// App.test.tsx). SVG <g> elements have no `.click()`, so we dispatch a bubbling
// MouseEvent for the world-map node.

import { describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { InterstitialRunner } from './InterstitialRunner.tsx';
import { CAMPAIGN_NODES, type BeatOutput, type InterstitialBeat } from '@campaign/index.ts';

function mount(ui: React.ReactElement): { container: HTMLElement; root: Root } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(ui));
  return { container, root };
}

function clickText(container: HTMLElement, text: string): void {
  const el = Array.from(container.querySelectorAll('button, [role="button"]')).find(
    (e) => e.getAttribute('aria-label') === text || e.textContent === text,
  );
  if (el === undefined) throw new Error(`clickable "${text}" not found`);
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

const SEQUENCE: ReadonlyArray<InterstitialBeat> = [
  { type: 'story-scene', scene: { title: 'Scene', lines: [{ speaker: 'Sera', text: 'Onward.' }] } },
  { type: 'result-summary', resolution: 'win', nodeName: 'River Ridge', units: [], gilEarned: 0, skirmish: false, campaignComplete: false },
  {
    type: 'world-map-choice',
    fromNodeId: CAMPAIGN_NODES.oskun,
    choices: [{ id: CAMPAIGN_NODES.alvera, name: 'Alvera Village', kind: 'advance', farmable: false, hub: false }],
    gil: 0,
  },
];

describe('InterstitialRunner (3+ beat walk)', () => {
  it('advances story → result → world-map and completes with the chosen route', () => {
    let completed: BeatOutput | undefined;
    const { container, root } = mount(
      <InterstitialRunner
        beats={SEQUENCE}
        onComplete={(output) => {
          completed = output;
        }}
        onExitToTitle={() => {}}
      />,
    );

    // Beat 1 — the story scene. One line → advancing the stage proceeds.
    expect(container.textContent).toContain('Onward.');
    clickText(container, 'Advance dialogue');

    // Beat 2 — the result-summary. "River Ridge — Cleared", advance = Continue.
    expect(container.textContent).toContain('Cleared');
    expect(completed).toBeUndefined(); // not done yet
    clickText(container, 'Continue →');

    // Beat 3 — the world-map. Pick the single choice → the run completes.
    expect(container.textContent).toContain('The Road Ahead');
    clickText(container, 'March to Alvera Village');

    expect(completed).toEqual({ nextNodeId: CAMPAIGN_NODES.alvera });

    act(() => root.unmount());
    container.remove();
  });
});

describe('WorldMapBeatView — progressive reveal (S94)', () => {
  it('hides unvisited non-frontier nodes; always-visible teases show from the start', () => {
    const beat: InterstitialBeat = {
      type: 'world-map-choice',
      fromNodeId: CAMPAIGN_NODES.zarghidas,
      choices: [{ id: CAMPAIGN_NODES.oskun, name: 'Oskun Fields', kind: 'advance', farmable: false, hub: false }],
      gil: 0,
      visited: [CAMPAIGN_NODES.zarghidas],
    };
    const { container, root } = mount(
      <InterstitialRunner beats={[beat]} onComplete={() => {}} onExitToTitle={() => {}} />,
    );

    // Here + frontier render…
    expect(container.textContent).toContain('Zarghidas Trade City');
    expect(container.textContent).toContain('Oskun Fields');
    // …the authored teases render (Old Ordal + phantom Viura)…
    expect(container.textContent).toContain('Old Ordal');
    expect(container.textContent).toContain('Viura');
    // …and the rest of the chapter stays hidden.
    expect(container.textContent).not.toContain('Alvera Village');
    expect(container.textContent).not.toContain('Ruk Village');
    expect(container.textContent).not.toContain('Mount Eska');

    act(() => root.unmount());
    container.remove();
  });
});
