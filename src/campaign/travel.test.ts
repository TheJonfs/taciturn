// TABA economy — navigable-map travel model tests (M3 Stage 1).

import { describe, expect, it } from 'vitest';
import { getNode } from './graph.ts';
import { newCampaign } from './loop.ts';
import { CAMPAIGN_GRAPH, CAMPAIGN_NODES } from './node.ts';
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

const GRAPH = CAMPAIGN_GRAPH;
const node = (id: string) => getNode(GRAPH, id);

function stateWith(overrides: Partial<CampaignState>): CampaignState {
  return { ...newCampaign(m0Roster, CAMPAIGN_NODES.oskun), ...overrides };
}

describe('capability selectors', () => {
  it('an uncleared node has an armed story and no open valve', () => {
    const fresh = stateWith({});
    expect(hasArmedStory(fresh, node(CAMPAIGN_NODES.oskun))).toBe(true);
    expect(isStoryCleared(fresh, node(CAMPAIGN_NODES.oskun))).toBe(false);
    expect(isFarmableNow(fresh, node(CAMPAIGN_NODES.oskun))).toBe(false);
  });

  it('clearing the story beat disarms it and opens the farmable valve', () => {
    const cleared = stateWith({ clearedStoryBeats: [CAMPAIGN_NODES.oskun] });
    expect(hasArmedStory(cleared, node(CAMPAIGN_NODES.oskun))).toBe(false);
    expect(isFarmableNow(cleared, node(CAMPAIGN_NODES.oskun))).toBe(true);
  });

  it('a cleared DEAD node offers nothing (Old Ordal — no hub, no valve)', () => {
    const cleared = stateWith({
      visited: [CAMPAIGN_NODES.oskun, CAMPAIGN_NODES.oldOrdal],
      clearedStoryBeats: [CAMPAIGN_NODES.oldOrdal],
    });
    expect(hasAvailability(cleared, node(CAMPAIGN_NODES.oldOrdal))).toBe(false);
  });

  it('hub-ness opens on visit, independent of the valve (Alvera)', () => {
    const visitedOnly = stateWith({ visited: [CAMPAIGN_NODES.oskun, CAMPAIGN_NODES.alvera] });
    expect(isHubNow(visitedOnly, node(CAMPAIGN_NODES.alvera))).toBe(true);
    // …but a valve (where one exists) needs the story beat cleared.
    expect(isFarmableNow(visitedOnly, node(CAMPAIGN_NODES.alvera))).toBe(false);
  });
});

describe('travelChoices', () => {
  it('a fresh campaign at an uncleared node offers only that armed node', () => {
    const choices = travelChoices(GRAPH, stateWith({}));
    expect(choices.map((c) => [c.id, c.kind])).toEqual([[CAMPAIGN_NODES.oskun, 'advance']]);
  });

  it('clearing a node opens the next spine stop as frontier + itself as returnable', () => {
    const cleared = stateWith({ clearedStoryBeats: [CAMPAIGN_NODES.oskun] });
    const choices = travelChoices(GRAPH, cleared);
    expect(choices.map((c) => [c.id, c.kind])).toEqual([
      [CAMPAIGN_NODES.alvera, 'advance'],
      [CAMPAIGN_NODES.oskun, 'revisit'],
    ]);
    expect(choices[1]!.farmable).toBe(true);
  });

  it('deep progress accumulates returnables without ever losing the frontier', () => {
    // Cleared Oskun + Alvera; standing at Alvera.
    const mid = stateWith({
      currentNodeId: CAMPAIGN_NODES.alvera,
      visited: [CAMPAIGN_NODES.oskun, CAMPAIGN_NODES.alvera],
      clearedStoryBeats: [CAMPAIGN_NODES.oskun, CAMPAIGN_NODES.alvera],
    });
    const ids = travelChoices(GRAPH, mid).map((c) => c.id);
    // Frontier: the next spine stop (Zelmonia Castle).
    expect(ids).toContain(CAMPAIGN_NODES.zelmoniaCastle);
    // Returnables: the cleared farmable Oskun AND Alvera itself (a hub —
    // the current node, still offered: self re-entry).
    expect(ids).toContain(CAMPAIGN_NODES.oskun);
    expect(ids).toContain(CAMPAIGN_NODES.alvera);
  });

  it('a hub stays a destination even with its valve shut (badge = trade)', () => {
    // Visited-but-uncleared Alvera: story armed, but it trades.
    const visitedHub = stateWith({
      currentNodeId: CAMPAIGN_NODES.alvera,
      visited: [CAMPAIGN_NODES.oskun, CAMPAIGN_NODES.alvera],
      clearedStoryBeats: [CAMPAIGN_NODES.oskun],
    });
    const alvera = travelChoices(GRAPH, visitedHub).find((c) => c.id === CAMPAIGN_NODES.alvera);
    // Its story is still armed, so it's frontier — and flagged as a hub.
    expect(alvera?.kind).toBe('advance');
    expect(alvera?.hub).toBe(true);
  });

  it('the phantom Viura never appears in travel choices, even off cleared Old Ordal', () => {
    const cleared = stateWith({
      currentNodeId: CAMPAIGN_NODES.oldOrdal,
      visited: [CAMPAIGN_NODES.oldOrdal],
      clearedStoryBeats: [CAMPAIGN_NODES.oldOrdal],
    });
    const ids = travelChoices(GRAPH, cleared).map((c) => c.id);
    expect(ids).toContain(CAMPAIGN_NODES.mountEska);
    expect(ids).not.toContain(CAMPAIGN_NODES.viura);
  });

  it('isTravelChoice mirrors the list (the routeToNode guard)', () => {
    const cleared = stateWith({ clearedStoryBeats: [CAMPAIGN_NODES.oskun] });
    expect(isTravelChoice(GRAPH, cleared, CAMPAIGN_NODES.alvera)).toBe(true);
    expect(isTravelChoice(GRAPH, cleared, CAMPAIGN_NODES.rukVillage)).toBe(false);
  });
});

describe('a PURE market town (isHub, no beats) — visit-completes semantics', () => {
  // A synthetic graph threading a battlefield-less town INTO the road:
  //   Oskun → Watford Market → Alvera
  // The town must not block progression (its win-edges open on VISIT, since
  // there is no story beat to clear) and must trade like any hub.
  const TOWN = 'node-watford-market';
  const townGraph = {
    startId: CAMPAIGN_NODES.oskun,
    nodes: [
      getNode(GRAPH, CAMPAIGN_NODES.oskun),
      { id: TOWN, name: 'Watford Market', chapter: 1, engagements: [], isHub: true },
      getNode(GRAPH, CAMPAIGN_NODES.alvera),
    ],
    edges: [
      { from: CAMPAIGN_NODES.oskun, to: TOWN, on: 'win' as const },
      { from: TOWN, to: CAMPAIGN_NODES.alvera, on: 'win' as const },
    ],
  };
  const town = townGraph.nodes[1]!;

  it('an unvisited town is a frontier destination off a cleared node', () => {
    const cleared = stateWith({ clearedStoryBeats: [CAMPAIGN_NODES.oskun] });
    const choices = travelChoices(townGraph, cleared);
    expect(choices.map((c) => [c.id, c.kind])).toContainEqual([TOWN, 'advance']);
    // …and nothing beyond it is reachable yet.
    expect(choices.some((c) => c.id === CAMPAIGN_NODES.alvera)).toBe(false);
  });

  it('VISITING the town completes its (empty) story — its own win-edges open', () => {
    const atTown = stateWith({
      currentNodeId: TOWN,
      visited: [CAMPAIGN_NODES.oskun, TOWN],
      clearedStoryBeats: [CAMPAIGN_NODES.oskun],
    });
    expect(isStoryCleared(atTown, town)).toBe(true);
    expect(hasArmedStory(atTown, town)).toBe(false);
    const ids = travelChoices(townGraph, atTown).map((c) => c.id);
    expect(ids).toContain(CAMPAIGN_NODES.alvera); // progression THROUGH the town
    expect(ids).toContain(TOWN); // and the town stays returnable (hub)
  });

  it('the visited town is a returnable hub, never farmable (no battlefield)', () => {
    const past = stateWith({
      currentNodeId: CAMPAIGN_NODES.alvera,
      visited: [CAMPAIGN_NODES.oskun, TOWN, CAMPAIGN_NODES.alvera],
      clearedStoryBeats: [CAMPAIGN_NODES.oskun, CAMPAIGN_NODES.alvera],
    });
    const choice = travelChoices(townGraph, past).find((c) => c.id === TOWN);
    expect(choice?.kind).toBe('revisit');
    expect(choice?.hub).toBe(true);
    expect(choice?.farmable).toBe(false);
    expect(isFarmableNow(past, town)).toBe(false);
  });
});
