// TABA economy — navigable-map travel model tests (M3 Stage 1).

import { describe, expect, it } from 'vitest';
import { getNode } from './graph.ts';
import { newCampaign } from './loop.ts';
import { M1_CAMPAIGN_GRAPH, M1_NODES } from './node.ts';
import { m0Roster } from './roster.ts';
import {
  hasArmedStory,
  hasAvailability,
  isFarmableNow,
  isHubNow,
  isStoryCleared,
  isTravelChoice,
  travelChoices,
} from './travel.ts';
import type { CampaignState } from './types.ts';

const GRAPH = M1_CAMPAIGN_GRAPH;
const node = (id: string) => getNode(GRAPH, id);

function stateWith(overrides: Partial<CampaignState>): CampaignState {
  return { ...newCampaign(m0Roster, M1_NODES.riverRidge), ...overrides };
}

describe('capability selectors', () => {
  it('an uncleared node has an armed story and no open valve', () => {
    const fresh = stateWith({});
    expect(hasArmedStory(fresh, node(M1_NODES.riverRidge))).toBe(true);
    expect(isStoryCleared(fresh, node(M1_NODES.riverRidge))).toBe(false);
    expect(isFarmableNow(fresh, node(M1_NODES.riverRidge))).toBe(false);
  });

  it('clearing the story beat disarms it and opens the farmable valve', () => {
    const cleared = stateWith({ clearedStoryBeats: [M1_NODES.riverRidge] });
    expect(hasArmedStory(cleared, node(M1_NODES.riverRidge))).toBe(false);
    expect(isFarmableNow(cleared, node(M1_NODES.riverRidge))).toBe(true);
  });

  it('a cleared non-farmable node offers nothing (The Crossing)', () => {
    const cleared = stateWith({
      visited: [M1_NODES.riverRidge, M1_NODES.theCrossing],
      clearedStoryBeats: [M1_NODES.theCrossing],
    });
    expect(hasAvailability(cleared, node(M1_NODES.theCrossing))).toBe(false);
  });

  it('hub-ness opens on visit, independent of the valve (Stonebridge)', () => {
    const visitedOnly = stateWith({ visited: [M1_NODES.riverRidge, M1_NODES.stonebridge] });
    expect(isHubNow(visitedOnly, node(M1_NODES.stonebridge))).toBe(true);
    // …but its skirmish valve needs the story beat cleared.
    expect(isFarmableNow(visitedOnly, node(M1_NODES.stonebridge))).toBe(false);
  });
});

describe('travelChoices', () => {
  it('a fresh campaign offers only the armed start (unreachable in practice — the map only shows post-clear)', () => {
    const choices = travelChoices(GRAPH, stateWith({}));
    expect(choices.map((c) => [c.id, c.kind])).toEqual([[M1_NODES.riverRidge, 'advance']]);
  });

  it('clearing the start opens its fork as frontier + itself as returnable', () => {
    const cleared = stateWith({ clearedStoryBeats: [M1_NODES.riverRidge] });
    const choices = travelChoices(GRAPH, cleared);
    expect(choices.map((c) => [c.id, c.kind])).toEqual([
      [M1_NODES.stonebridge, 'advance'],
      [M1_NODES.marshmoor, 'advance'],
      [M1_NODES.riverRidge, 'revisit'],
    ]);
    expect(choices[2]!.farmable).toBe(true);
  });

  it('deep progress accumulates returnables without ever losing the frontier', () => {
    // Cleared start + Stonebridge; standing at Stonebridge.
    const mid = stateWith({
      currentNodeId: M1_NODES.stonebridge,
      visited: [M1_NODES.riverRidge, M1_NODES.stonebridge],
      clearedStoryBeats: [M1_NODES.riverRidge, M1_NODES.stonebridge],
    });
    const ids = travelChoices(GRAPH, mid).map((c) => c.id);
    // Frontier: Stonebridge's fork (Mountain Pass / The Return) + the still-
    // uncleared Marshmoor branch off the cleared start.
    expect(ids).toContain(M1_NODES.mountainPass);
    expect(ids).toContain(M1_NODES.theReturn);
    expect(ids).toContain(M1_NODES.marshmoor);
    // Returnables: both cleared farmable nodes (Stonebridge = the current
    // node, still offered — self re-entry).
    expect(ids).toContain(M1_NODES.riverRidge);
    expect(ids).toContain(M1_NODES.stonebridge);
  });

  it('a hub stays a destination even with its valve shut (badge = trade)', () => {
    // Visited-but-uncleared Stonebridge: not farmable yet, but it trades.
    const visitedHub = stateWith({
      currentNodeId: M1_NODES.stonebridge,
      visited: [M1_NODES.riverRidge, M1_NODES.stonebridge],
      clearedStoryBeats: [M1_NODES.riverRidge],
    });
    const stonebridge = travelChoices(GRAPH, visitedHub).find((c) => c.id === M1_NODES.stonebridge);
    // Its story is still armed, so it's frontier — and flagged as a hub.
    expect(stonebridge?.kind).toBe('advance');
    expect(stonebridge?.hub).toBe(true);
  });

  it('isTravelChoice mirrors the list (the routeToNode guard)', () => {
    const cleared = stateWith({ clearedStoryBeats: [M1_NODES.riverRidge] });
    expect(isTravelChoice(GRAPH, cleared, M1_NODES.marshmoor)).toBe(true);
    expect(isTravelChoice(GRAPH, cleared, M1_NODES.theReturn)).toBe(false);
  });
});

describe('a PURE market town (isHub, no beats) — visit-completes semantics', () => {
  // A synthetic graph threading a battlefield-less town INTO the road:
  //   River Ridge → Watford Market → Stonebridge
  // The town must not block progression (its win-edges open on VISIT, since
  // there is no story beat to clear) and must trade like any hub.
  const TOWN = 'node-watford-market';
  const townGraph = {
    startId: M1_NODES.riverRidge,
    nodes: [
      getNode(GRAPH, M1_NODES.riverRidge),
      { id: TOWN, name: 'Watford Market', chapter: 1, engagements: [], isHub: true },
      getNode(GRAPH, M1_NODES.stonebridge),
    ],
    edges: [
      { from: M1_NODES.riverRidge, to: TOWN, on: 'win' as const },
      { from: TOWN, to: M1_NODES.stonebridge, on: 'win' as const },
    ],
  };
  const town = townGraph.nodes[1]!;

  it('an unvisited town is a frontier destination off a cleared node', () => {
    const cleared = stateWith({ clearedStoryBeats: [M1_NODES.riverRidge] });
    const choices = travelChoices(townGraph, cleared);
    expect(choices.map((c) => [c.id, c.kind])).toContainEqual([TOWN, 'advance']);
    // …and nothing beyond it is reachable yet.
    expect(choices.some((c) => c.id === M1_NODES.stonebridge)).toBe(false);
  });

  it('VISITING the town completes its (empty) story — its own win-edges open', () => {
    const atTown = stateWith({
      currentNodeId: TOWN,
      visited: [M1_NODES.riverRidge, TOWN],
      clearedStoryBeats: [M1_NODES.riverRidge],
    });
    expect(isStoryCleared(atTown, town)).toBe(true);
    expect(hasArmedStory(atTown, town)).toBe(false);
    const ids = travelChoices(townGraph, atTown).map((c) => c.id);
    expect(ids).toContain(M1_NODES.stonebridge); // progression THROUGH the town
    expect(ids).toContain(TOWN); // and the town stays returnable (hub)
  });

  it('the visited town is a returnable hub, never farmable (no battlefield)', () => {
    const past = stateWith({
      currentNodeId: M1_NODES.stonebridge,
      visited: [M1_NODES.riverRidge, TOWN, M1_NODES.stonebridge],
      clearedStoryBeats: [M1_NODES.riverRidge, M1_NODES.stonebridge],
    });
    const choice = travelChoices(townGraph, past).find((c) => c.id === TOWN);
    expect(choice?.kind).toBe('revisit');
    expect(choice?.hub).toBe(true);
    expect(choice?.farmable).toBe(false);
    expect(isFarmableNow(past, town)).toBe(false);
  });
});
