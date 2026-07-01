// InterstitialRunner — the generic between-node beat walker (TABA M1).
//
// Renders an ordered `InterstitialBeat[]` one beat at a time, advancing on
// each beat's signal and calling `onComplete` with the merged outputs when the
// sequence ends. The runner is DELIBERATELY IGNORANT of specific beat types:
// it dispatches through `BEAT_RENDERERS` keyed by `beat.type` and never
// switches on the type itself. Adding a beat type (M1.5 story-scene, later
// rewards/shops) means adding a descriptor variant + a registry entry — the
// runner is untouched (taba-m1-brief watch-for: keep the set open).
//
// `onExitToTitle` is an ambient escape hatch passed to every beat (abandon the
// run) — separate from `onAdvance` (proceed through the sequence).

import { useRef, useState, type ReactElement } from 'react';
import type { BeatOutput, InterstitialBeat } from '@campaign/index.ts';
import { ResultSummaryBeatView } from './ResultSummaryBeatView.tsx';
import { WorldMapBeatView } from './WorldMapBeatView.tsx';

export interface BeatRendererProps {
  readonly beat: InterstitialBeat;
  readonly onAdvance: (output?: BeatOutput) => void;
  readonly onExitToTitle: () => void;
}

export type BeatRenderer = (props: BeatRendererProps) => ReactElement;

// The open registry — exhaustive over the current beat union (a new variant
// forces a new entry here, by type), but the runner reads it by string.
const BEAT_RENDERERS: Readonly<Record<InterstitialBeat['type'], BeatRenderer>> = {
  'result-summary': ResultSummaryBeatView,
  'world-map-choice': WorldMapBeatView,
};

export interface InterstitialRunnerProps {
  readonly beats: ReadonlyArray<InterstitialBeat>;
  readonly onComplete: (output: BeatOutput) => void;
  readonly onExitToTitle: () => void;
}

export function InterstitialRunner({
  beats,
  onComplete,
  onExitToTitle,
}: InterstitialRunnerProps): ReactElement {
  const [index, setIndex] = useState(0);
  const accumulated = useRef<BeatOutput>({});

  const beat = beats[index];
  if (beat === undefined) {
    // Empty or over-run sequence — nothing to render. The driver guards
    // against building an empty interstitial, so this is defensive only.
    return <></>;
  }

  const advance = (output?: BeatOutput): void => {
    if (output !== undefined) {
      accumulated.current = { ...accumulated.current, ...output };
    }
    const next = index + 1;
    if (next < beats.length) setIndex(next);
    else onComplete(accumulated.current);
  };

  const Renderer = BEAT_RENDERERS[beat.type];
  return <Renderer beat={beat} onAdvance={advance} onExitToTitle={onExitToTitle} />;
}
