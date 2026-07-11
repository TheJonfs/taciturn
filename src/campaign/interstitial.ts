// TABA campaign — the presentational interstitial beats + their builders.
//
// A node is a beat sequence (M1.5 battle-as-beat, sequence.ts). Its `battle`
// beats are the structural, engine-launching kind; its OTHER beats are
// PRESENTATIONAL — single screens the generic runner dispatches by type and
// never switches on. This module owns those presentational descriptors (plain
// data) + the small builders the driver composes runs from. The React runner +
// per-type renderers live in the app layer (src/app/interstitial/); adding a
// beat type (M1.5's story-scene, later rewards/shops) is a descriptor variant +
// a renderer + a registry entry, never a runner edit (watch-for: keep the set
// open).
//
// The presentational beats:
//   - `story-scene` — authored dialogue (sequence.ts; authored on the node AND
//     replayed here as a presentational beat — same descriptor, one renderer).
//   - `result-summary` — the post-battle screen. ONE beat type with win /
//     loss / campaign-complete variants, so victory, defeat, and the
//     between-node result are a single path, not three forked screens
//     (watch-for: don't fork the result screen). Injected by the driver after a
//     battle beat (outcome-built — brief D2), never authored.
//   - `world-map-choice` — the choose-next screen. Injected by the driver when a
//     non-terminal node resolves; its advance carries the chosen next-node id.
//
// Runs the driver composes (taba-m1_5-brief):
//   pre-battle story        → [story-scene, ...]                (authored, verbatim)
//   post-battle, non-terminal → [result-summary(win), ...trailing story, world-map-choice]
//   post-battle, terminal   → [result-summary(win, campaignComplete)]
//   loss                    → [result-summary(loss)]            (advance = retry)
//   standalone story, non-terminal → [...story, world-map-choice]
//   resume at awaiting_route → [world-map-choice]               (result is gone)

import type { UnitId, Vitals } from '@engine/index.ts';
import type { BattleResult, UnitOutcome } from './battle-result.ts';
import { winChoices, type CampaignGraph, type CampaignNode } from './graph.ts';
import type { StorySceneBeat } from './sequence.ts';
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
  // Gil the battle paid (M3 economy Stage 0) — the win's spoils line.
  // 0 on a loss (losses pay nothing) and the line is suppressed.
  readonly gilEarned: number;
  // True only on a terminal win — this beat is the campaign's victory screen.
  readonly campaignComplete: boolean;
}

export interface WorldMapChoiceBeat {
  readonly type: 'world-map-choice';
  // The node just cleared (the map's "you are here").
  readonly fromNodeId: string;
  // The selectable next nodes (the cleared node's win-edges, authored order).
  readonly choices: ReadonlyArray<{ readonly id: string; readonly name: string }>;
  // The party's current gil balance (M3 economy Stage 0) — the map header's
  // purse display, snapshotted at beat build (beats are immutable data).
  readonly gil: number;
}

// The open set of PRESENTATIONAL beat descriptors the runner dispatches by
// type. `story-scene` is authored (sequence.ts) but replayed here as a peer;
// `result-summary` / `world-map-choice` are driver-injected runtime beats.
// (The structural `battle` beat is NOT here — it launches the engine and is
// walked by the driver, not rendered by the runner.)
export type InterstitialBeat = StorySceneBeat | ResultSummaryBeat | WorldMapChoiceBeat;

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

// Build the post-battle-beat result-summary. Pure: the caller (the app driver)
// feeds the roster it should show (the battle's final vitals, via the result)
// + whether the battle was won + whether winning it completes the campaign.
// `won` comes from `battleWasWon`; `campaignComplete` is true only when this is
// the node's LAST battle beat AND the node is terminal (`isComplete` after
// `resolveNode`). The driver decides what FOLLOWS this beat (trailing story,
// world-map, retry) — this only builds the one screen.
export function buildResultSummaryBeat(params: {
  readonly node: CampaignNode;
  readonly roster: ReadonlyArray<CampaignUnit>;
  readonly result: BattleResult;
  readonly won: boolean;
  readonly campaignComplete: boolean;
  // Gil the battle paid (`computeGilReward` on a win; a loss passes 0).
  readonly gilEarned: number;
}): ResultSummaryBeat {
  const { node, roster, result, won, campaignComplete, gilEarned } = params;
  return {
    type: 'result-summary',
    resolution: won ? 'win' : 'loss',
    nodeName: node.name,
    units: buildUnitResultLines(roster, result),
    gilEarned,
    campaignComplete: won && campaignComplete,
  };
}

// The world-map-choice beat for a node. Built by the driver when a non-terminal
// node resolves, and on RESUME into an `awaiting_route` save (where the
// transient BattleResult is gone, so there's no result-summary to replay and
// the player resumes directly at the map choice).
export function buildRouteChoiceBeat(
  graph: CampaignGraph,
  nodeId: string,
  gil: number,
): WorldMapChoiceBeat {
  return {
    type: 'world-map-choice',
    fromNodeId: nodeId,
    choices: winChoices(graph, nodeId).map((n) => ({ id: n.id, name: n.name })),
    gil,
  };
}

// The world-map-choice as a single-beat run — the RESUME-at-`awaiting_route`
// entry (kept as a run for the runner's `beats` prop).
export function buildRouteChoice(
  graph: CampaignGraph,
  nodeId: string,
  gil: number,
): ReadonlyArray<InterstitialBeat> {
  return [buildRouteChoiceBeat(graph, nodeId, gil)];
}
