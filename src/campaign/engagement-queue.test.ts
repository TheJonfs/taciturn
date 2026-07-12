// Engagement queues + per-beat edge gating (M3) — the brief's acceptance
// scenario as a pure-selector test.
//
// The camp shape (Igros-style): a hub CAMP with a 2-engagement queue.
// Engagement A plays on first visit and opens ONLY the road to Mission X;
// engagement B arms when Mission X clears (an armsAfter at ANOTHER node —
// the leave-and-return pattern), plays on a later visit, and opens the road
// to the Finale. The camp trades throughout.
//
//        start ──→ camp ──[opens on A]──→ mission-x
//                   │
//                   └──[opens on camp-return (B)]──→ finale

import { describe, expect, it } from 'vitest';
import { engagementBeatId, type CampaignGraph } from './graph.ts';
import { newCampaign, resolveNode } from './loop.ts';
import { placeholderBattleBeat, placeholderSceneBeat } from './placeholder-beat.ts';
import type { CampaignState } from './types.ts';
import {
  currentEngagement,
  hasArmedStory,
  isEdgeOpen,
  isEngagementArmed,
  isStoryCleared,
  travelChoices,
} from './travel.ts';

const CAMP_A = 'node-camp'; // first engagement defaults to the node id
const CAMP_B = 'camp-return';

const GRAPH: CampaignGraph = {
  startId: 'node-start',
  nodes: [
    { id: 'node-start', name: 'Start', chapter: 1, engagements: [{ beats: [placeholderBattleBeat('river_ridge')] }] },
    {
      id: 'node-camp',
      name: 'Camp',
      chapter: 1,
      engagements: [
        { beats: [placeholderSceneBeat('camp scene one')] },
        {
          storyBeatId: CAMP_B,
          beats: [placeholderSceneBeat('camp scene two')],
          armsAfter: 'node-mission-x',
        },
      ],
      isHub: true,
    },
    { id: 'node-mission-x', name: 'Mission X', chapter: 1, engagements: [{ beats: [placeholderBattleBeat('river_ridge')] }] },
    { id: 'node-finale', name: 'Finale', chapter: 1, engagements: [{ beats: [placeholderBattleBeat('river_ridge')] }] },
  ],
  edges: [
    { from: 'node-start', to: 'node-camp', on: 'win' },
    { from: 'node-camp', to: 'node-mission-x', on: 'win', opensOnBeat: CAMP_A },
    { from: 'node-camp', to: 'node-finale', on: 'win', opensOnBeat: CAMP_B },
  ],
};

const camp = GRAPH.nodes[1]!;
const at = (nodeId: string, visited: string[], cleared: string[]): CampaignState => ({
  ...newCampaign([], nodeId),
  visited,
  clearedStoryBeats: cleared,
});

describe('engagement beat ids', () => {
  it('the first engagement defaults to the node id (pre-queue save compat)', () => {
    expect(engagementBeatId(camp, 0)).toBe('node-camp');
    expect(engagementBeatId(camp, 1)).toBe(CAMP_B);
  });

  it('a later engagement without an explicit id fails loud', () => {
    const bad = { ...camp, engagements: [camp.engagements[0]!, { beats: [] }] };
    expect(() => engagementBeatId(bad, 1)).toThrow(/no explicit storyBeatId/);
  });
});

describe('the camp queue, visit by visit', () => {
  it('first visit: engagement A is current; nothing beyond the camp is open', () => {
    const state = at('node-camp', ['node-start', 'node-camp'], ['node-start']);
    expect(currentEngagement(state, camp)).toMatchObject({ index: 0, beatId: CAMP_A });
    expect(isEngagementArmed(state, camp, 1)).toBe(false); // mission X not cleared
    const ids = travelChoices(GRAPH, state).map((c) => c.id);
    expect(ids).not.toContain('node-mission-x');
    expect(ids).not.toContain('node-finale');
  });

  it('A cleared: only the A-gated road opens; the camp reads temporally cleared (hub keeps trading)', () => {
    const state = at('node-camp', ['node-start', 'node-camp'], ['node-start', CAMP_A]);
    // B waits on Mission X, so nothing is armed RIGHT NOW → story-complete.
    expect(isStoryCleared(state, camp)).toBe(true);
    expect(hasArmedStory(state, camp)).toBe(false);
    const choices = travelChoices(GRAPH, state);
    expect(choices.map((c) => [c.id, c.kind])).toContainEqual(['node-mission-x', 'advance']);
    expect(choices.some((c) => c.id === 'node-finale')).toBe(false);
    // The camp stays a returnable hub between engagements.
    expect(choices.find((c) => c.id === 'node-camp')).toMatchObject({ kind: 'revisit', hub: true });
  });

  it('mission X cleared: B arms — the camp flips back to an armed story (advance), finale still closed', () => {
    const state = at(
      'node-mission-x',
      ['node-start', 'node-camp', 'node-mission-x'],
      ['node-start', CAMP_A, 'node-mission-x'],
    );
    expect(isEngagementArmed(state, camp, 1)).toBe(true);
    expect(currentEngagement(state, camp)).toMatchObject({ index: 1, beatId: CAMP_B });
    expect(isStoryCleared(state, camp)).toBe(false); // temporal — armed again
    const choices = travelChoices(GRAPH, state);
    expect(choices.find((c) => c.id === 'node-camp')?.kind).toBe('advance');
    expect(choices.some((c) => c.id === 'node-finale')).toBe(false);
    // MONOTONIC gating: the A-gated road does not close when the camp re-arms.
    expect(isEdgeOpen(state, GRAPH, GRAPH.edges[1]!)).toBe(true);
  });

  it('B cleared: its gated road opens and the queue is exhausted', () => {
    const state = at(
      'node-camp',
      ['node-start', 'node-camp', 'node-mission-x'],
      ['node-start', CAMP_A, 'node-mission-x', CAMP_B],
    );
    expect(currentEngagement(state, camp)).toBeUndefined();
    expect(isStoryCleared(state, camp)).toBe(true);
    expect(travelChoices(GRAPH, state).map((c) => [c.id, c.kind])).toContainEqual(['node-finale', 'advance']);
  });
});

describe('resolveNode under a queue', () => {
  it('clears the CURRENT engagement per resolution — A on the first visit, B on the return', () => {
    const first = at('node-camp', ['node-start', 'node-camp'], ['node-start']);
    const afterA = resolveNode(first, GRAPH);
    expect(afterA.clearedStoryBeats).toContain(CAMP_A);
    expect(afterA.clearedStoryBeats).not.toContain(CAMP_B);
    expect(afterA.phase).toBe('awaiting_route');

    const back = {
      ...afterA,
      visited: [...afterA.visited, 'node-mission-x'],
      clearedStoryBeats: [...afterA.clearedStoryBeats, 'node-mission-x'],
      phase: 'in_progress' as const,
    };
    const afterB = resolveNode(back, GRAPH);
    expect(afterB.clearedStoryBeats).toContain(CAMP_B);
  });

  it('fails loud when nothing is armed to clear', () => {
    const exhausted = at(
      'node-camp',
      ['node-start', 'node-camp'],
      ['node-start', CAMP_A, 'node-mission-x', CAMP_B],
    );
    expect(() => resolveNode(exhausted, GRAPH)).toThrow(/no armed engagement/);
  });
});

describe('default arming (no armsAfter) chains sequentially', () => {
  const inn: CampaignGraph = {
    startId: 'node-inn',
    nodes: [
      {
        id: 'node-inn',
        name: 'Inn',
        chapter: 1,
        engagements: [
          { beats: [placeholderSceneBeat('one')] },
          { storyBeatId: 'inn-2', beats: [placeholderSceneBeat('two')] },
        ],
      },
    ],
    edges: [],
  };
  const node = inn.nodes[0]!;

  it('clearing the first engagement immediately arms the next (default = previous)', () => {
    const fresh = at('node-inn', ['node-inn'], []);
    expect(currentEngagement(fresh, node)).toMatchObject({ index: 0 });
    const afterFirst = at('node-inn', ['node-inn'], ['node-inn']);
    expect(currentEngagement(afterFirst, node)).toMatchObject({ index: 1, beatId: 'inn-2' });
    expect(isStoryCleared(afterFirst, node)).toBe(false);
  });
});
