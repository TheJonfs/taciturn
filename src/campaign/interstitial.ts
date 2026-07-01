// TABA campaign — the interstitial beat-sequence (the between-node phase).
//
// After a node resolves, the campaign plays an ORDERED SEQUENCE OF TYPED BEATS
// before routing to the next node (taba-m1-brief Chunk 2). This module owns
// the PURE half: the beat *descriptors* (plain data) and the builder that
// assembles the sequence for a resolved node. The React *runner* + per-type
// renderers live in the app layer (src/app/interstitial/); the runner walks
// the sequence generically and never switches on a beat type — so M1.5's
// story beat (and later rewards/shops) plug in by adding a descriptor variant
// + a renderer, never by editing the runner (watch-for: keep the set open).
//
// M1 ships two beat types:
//   - `result-summary` — the post-battle screen. ONE beat type with win /
//     loss / campaign-complete variants, so victory, defeat, and the
//     between-node result are a single path, not three forked screens
//     (watch-for: don't fork the result screen).
//   - `world-map-choice` — the choose-next screen (Chunk 3). Present only on a
//     non-terminal win; its advance carries the chosen next-node id.
//
// Sequences M1 builds:
//   win, non-terminal → [result-summary(win), world-map-choice]
//   win, terminal     → [result-summary(win, campaignComplete)]
//   loss              → [result-summary(loss)]   (advance = retry; no routing)

import type { UnitId, Vitals } from '@engine/index.ts';
import type { BattleResult, UnitOutcome } from './battle-result.ts';
import { winChoices, type CampaignGraph, type CampaignNode } from './graph.ts';
import type { CampaignUnit } from './types.ts';

// How a resolved node turned out, from the campaign's point of view.
export type NodeResolution = 'win' | 'loss';

// One deployed player unit's line on the result-summary, taken from the
// battle's final state (NOT the post-heal roster — the screen shows how the
// battle left them).
export interface UnitResultLine {
  readonly id: UnitId;
  readonly name: string;
  readonly outcome: UnitOutcome; // survived | downed | lost
  readonly vitals: Vitals;
}

export interface ResultSummaryBeat {
  readonly type: 'result-summary';
  readonly resolution: NodeResolution;
  readonly nodeName: string;
  // Per-deployed-unit outcome lines (player roster only; enemies excluded).
  readonly units: ReadonlyArray<UnitResultLine>;
  // True only on a terminal win — this beat is the campaign's victory screen.
  readonly campaignComplete: boolean;
}

export interface WorldMapChoiceBeat {
  readonly type: 'world-map-choice';
  // The node just cleared (the map's "you are here").
  readonly fromNodeId: string;
  // The selectable next nodes (the cleared node's win-edges, authored order).
  readonly choices: ReadonlyArray<{ readonly id: string; readonly name: string }>;
}

// The open set of beat descriptors. M1.5 extends this union (story-scene
// beat); the runner doesn't change.
export type InterstitialBeat = ResultSummaryBeat | WorldMapChoiceBeat;

// What a beat hands back when it advances. Only world-map-choice produces a
// route in M1; the field is optional so other beats advance with no output.
export interface BeatOutput {
  readonly nextNodeId?: string;
}

// Build the result-summary's per-unit lines: every player roster unit that
// actually fought (i.e. appears in the battle result), in roster order,
// carrying the outcome + vitals the battle left them with.
export function buildUnitResultLines(
  roster: ReadonlyArray<CampaignUnit>,
  result: BattleResult,
): ReadonlyArray<UnitResultLine> {
  const lines: UnitResultLine[] = [];
  for (const unit of roster) {
    const summary = result.units.get(unit.id);
    if (summary === undefined) continue; // not deployed in this battle
    lines.push({ id: unit.id, name: unit.name, outcome: summary.outcome, vitals: summary.vitals });
  }
  return lines;
}

// Assemble the interstitial beat sequence for a just-resolved node. Pure: the
// caller (the app driver) feeds the resolved state's roster + the battle
// result; this decides the beats. `won` comes from `battleWasWon`;
// `campaignComplete` from `isComplete(resolveWin(...))`.
export function buildInterstitial(params: {
  readonly graph: CampaignGraph;
  readonly node: CampaignNode;
  readonly roster: ReadonlyArray<CampaignUnit>;
  readonly result: BattleResult;
  readonly won: boolean;
  readonly campaignComplete: boolean;
}): ReadonlyArray<InterstitialBeat> {
  const { graph, node, roster, result, won, campaignComplete } = params;
  const units = buildUnitResultLines(roster, result);

  const summary: ResultSummaryBeat = {
    type: 'result-summary',
    resolution: won ? 'win' : 'loss',
    nodeName: node.name,
    units,
    campaignComplete: won && campaignComplete,
  };

  // Loss, or a terminal win: the result-summary is the whole interstitial.
  if (!won || campaignComplete) return [summary];

  // Non-terminal win: result, then the world-map choose-next beat.
  const mapBeat: WorldMapChoiceBeat = {
    type: 'world-map-choice',
    fromNodeId: node.id,
    choices: winChoices(graph, node.id).map((n) => ({ id: n.id, name: n.name })),
  };
  return [summary, mapBeat];
}
