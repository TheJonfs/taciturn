// Atlas acceptance — a FRESH multi-chapter skeleton authored through the
// tool's model is runtime-valid and walkable on placeholder templates:
// return travel, hub commerce, and a skirmish all function on authored
// nodes (the brief's walkability criterion), with no hand-authored content
// anywhere in the graph.

import { describe, expect, it } from 'vitest';
import {
  buildLocationMenuBeat,
  buildSkirmishBattle,
  isFarmableNow,
  isStoryCleared,
  newCampaign,
  storyBeatIdOf,
  travelChoices,
} from '@campaign/index.ts';
import { getNode } from '@campaign/graph.ts';
import { m0Roster } from '@campaign/roster.ts';
import { loadDefaultCatalog } from '@content/index.ts';
import type { AtlasGraph } from './model.ts';
import { toCampaignGraph, toNodeLayout } from './model.ts';
import { validateAtlasGraph } from './validate.ts';
import { generateLayoutModule, generateNodeModule } from './codegen.ts';
import { previewWorldMapBeat } from './preview.ts';

// Chapter 1: a start battle and a pure market town; chapter 2: a farmable
// gate. All battles are placeholders — nothing references node-content.
const SKELETON: AtlasGraph = {
  startId: 'node-emberfall',
  nodes: [
    {
      id: 'node-emberfall',
      name: 'Emberfall',
      chapter: 1,
      beatsSource: { kind: 'placeholder', templateKey: 'river_ridge' },
      farmable: true,
      x: 80,
      y: 160,
    },
    {
      id: 'node-saltmarket',
      name: 'Salt Market',
      chapter: 1,
      beatsSource: { kind: 'none' },
      isHub: true,
      x: 260,
      y: 120,
    },
    {
      id: 'node-winter-gate',
      name: 'Winter Gate',
      chapter: 2,
      beatsSource: { kind: 'placeholder', templateKey: 'stonebridge' },
      offset: 2,
      x: 440,
      y: 180,
    },
  ],
  edges: [
    { from: 'node-emberfall', to: 'node-saltmarket', on: 'win' },
    { from: 'node-saltmarket', to: 'node-winter-gate', on: 'win' },
  ],
};

const graph = toCampaignGraph(SKELETON);
const catalog = loadDefaultCatalog();

describe('atlas walkability — a fresh authored skeleton', () => {
  it('validates with no findings and codegens legal-looking modules', () => {
    expect(validateAtlasGraph(SKELETON)).toEqual([]);
    // The full type-check is tsc's job on a real export; here pin the
    // structural essentials of the emitted text.
    const nodeModule = generateNodeModule(SKELETON);
    expect(nodeModule).toContain("import { placeholderBattleBeat } from './placeholder-beat.ts';");
    expect(nodeModule).not.toContain('contentBeats'); // nothing hand-authored
    expect(nodeModule).toContain("emberfall: 'node-emberfall',");
    expect(generateLayoutModule(SKELETON)).toContain('[M1_NODES.winterGate]: { x: 440, y: 180 },');
  });

  it('the start fights on its placeholder template and clearing it opens the road', () => {
    const start = getNode(graph, 'node-emberfall');
    expect(start.beats).toHaveLength(1);
    const state = newCampaign(m0Roster, start.id);
    expect(state.roster.length).toBeGreaterThan(0); // vitals bootstrapped against the template

    const cleared = {
      ...state,
      visited: [start.id],
      clearedStoryBeats: [storyBeatIdOf(start)],
    };
    const choices = travelChoices(graph, cleared);
    expect(choices.map((c) => [c.id, c.kind])).toContainEqual(['node-saltmarket', 'advance']);
  });

  it('the pure market town trades on arrival and never blocks the road (visit-completes)', () => {
    const town = getNode(graph, 'node-saltmarket');
    const start = getNode(graph, 'node-emberfall');
    const atTown = {
      ...newCampaign(m0Roster, town.id),
      visited: [start.id, town.id],
      clearedStoryBeats: [storyBeatIdOf(start)],
    };
    // Commerce open: the location menu offers shop + recruit.
    const menu = buildLocationMenuBeat(town, atTown);
    expect(menu.options.map((o) => o.action)).toEqual(['shop', 'recruit']);
    // Visit completed its "story": the road onward is open, and the town
    // reads as a returnable hub, not an armed engagement.
    expect(isStoryCleared(atTown, town)).toBe(true);
    const choices = travelChoices(graph, atTown);
    expect(choices.map((c) => [c.id, c.kind])).toContainEqual(['node-winter-gate', 'advance']);
    expect(choices.find((c) => c.id === town.id)?.hub).toBe(true);
  });

  it('return travel + skirmish: the cleared start farms on its borrowed battlefield', () => {
    const start = getNode(graph, 'node-emberfall');
    const town = getNode(graph, 'node-saltmarket');
    const gate = getNode(graph, 'node-winter-gate');
    const deepIn = {
      ...newCampaign(m0Roster, gate.id),
      visited: [start.id, town.id, gate.id],
      clearedStoryBeats: [storyBeatIdOf(start), storyBeatIdOf(gate)],
    };
    // Return travel: both earlier stops are listed from the gate.
    const choices = travelChoices(graph, deepIn);
    expect(choices.find((c) => c.id === start.id)?.kind).toBe('revisit');
    expect(choices.find((c) => c.id === town.id)?.kind).toBe('revisit');
    // The valve is open and the skirmish borrows the placeholder template.
    expect(isFarmableNow(deepIn, start)).toBe(true);
    const skirmish = buildSkirmishBattle(start, deepIn, catalog);
    expect(skirmish.template.units.length).toBeGreaterThan(0);
    expect(skirmish.enemies !== undefined && skirmish.enemies.length).toBeGreaterThan(0);
  });

  it('the preview beat stands anywhere in the draft with the road there cleared', () => {
    const beat = previewWorldMapBeat(graph, 'node-winter-gate');
    expect(beat.fromNodeId).toBe('node-winter-gate');
    // Standing at the ch2 gate: both ch1 stops behind it are returnable.
    expect(beat.choices.map((c) => c.id)).toEqual(
      expect.arrayContaining(['node-emberfall', 'node-saltmarket']),
    );
    expect(toNodeLayout(SKELETON)['node-winter-gate']).toEqual({ x: 440, y: 180 });
  });
});
