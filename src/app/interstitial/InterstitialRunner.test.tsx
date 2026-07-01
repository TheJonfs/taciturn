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
import { M1_NODES, type BeatOutput, type InterstitialBeat } from '@campaign/index.ts';

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
  { type: 'result-summary', resolution: 'win', nodeName: 'River Ridge', units: [], campaignComplete: false },
  {
    type: 'world-map-choice',
    fromNodeId: M1_NODES.riverRidge,
    choices: [{ id: M1_NODES.stonebridge, name: 'Stonebridge' }],
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
    clickText(container, 'March to Stonebridge');

    expect(completed).toEqual({ nextNodeId: M1_NODES.stonebridge });

    act(() => root.unmount());
    container.remove();
  });
});
