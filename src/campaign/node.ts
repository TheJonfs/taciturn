// GENERATED-SHAPED — TABA campaign structural graph (Atlas graph editor).
//
// This module is the codegen output of the Atlas node-authoring tool (the
// `?atlas` dev route): nodes, win-edges (authored order = the world map's
// choice order), chapters, capabilities, and each node's beats source.
// Hand edits are legal TypeScript but the next Atlas export OVERWRITES THIS
// FILE WHOLESALE — story scenes, battle beats, and enemy derivation belong
// in node-content.ts (hand-authored, merged by id; the tool never touches
// it). The paired layout module is src/app/interstitial/node-layout.ts.
// The exporter's fidelity is pinned by the Atlas round-trip test.

import type { CampaignEdge, CampaignGraph, CampaignNode } from './graph.ts';
import { contentBeats } from './node-content.ts';

// Node ids — stable identity (CLAUDE.md rule 4), threaded into the save as
// the campaign position. Authored as readable slugs.
export const M1_NODES = {
  riverRidge: 'node-river-ridge',
  stonebridge: 'node-stonebridge',
  marshmoor: 'node-marshmoor',
  theCrossing: 'node-the-crossing',
  mountainPass: 'node-mountain-pass',
  theReturn: 'node-the-return',
} as const;

const NODES: ReadonlyArray<CampaignNode> = [
  {
    id: M1_NODES.riverRidge,
    name: 'River Ridge',
    chapter: 1,
    beats: contentBeats(M1_NODES.riverRidge),
    offset: -1,
    farmable: true,
  },
  {
    id: M1_NODES.stonebridge,
    name: 'Stonebridge',
    chapter: 1,
    beats: contentBeats(M1_NODES.stonebridge),
    offset: 0,
    isHub: true,
    farmable: true,
  },
  {
    id: M1_NODES.marshmoor,
    name: 'Marshmoor',
    chapter: 1,
    beats: contentBeats(M1_NODES.marshmoor),
    offset: 0,
    farmable: true,
  },
  {
    id: M1_NODES.theCrossing,
    name: 'The Crossing',
    chapter: 1,
    beats: contentBeats(M1_NODES.theCrossing),
  },
  {
    id: M1_NODES.mountainPass,
    name: 'Mountain Pass',
    chapter: 1,
    beats: contentBeats(M1_NODES.mountainPass),
    offset: 2,
    farmable: true,
  },
  {
    id: M1_NODES.theReturn,
    name: 'The Return',
    chapter: 1,
    beats: contentBeats(M1_NODES.theReturn),
  },
];

const EDGES: ReadonlyArray<CampaignEdge> = [
  { from: M1_NODES.riverRidge, to: M1_NODES.stonebridge, on: 'win' },
  { from: M1_NODES.riverRidge, to: M1_NODES.marshmoor, on: 'win' },
  { from: M1_NODES.stonebridge, to: M1_NODES.mountainPass, on: 'win' },
  { from: M1_NODES.stonebridge, to: M1_NODES.theReturn, on: 'win' },
  { from: M1_NODES.marshmoor, to: M1_NODES.theCrossing, on: 'win' },
  { from: M1_NODES.theCrossing, to: M1_NODES.theReturn, on: 'win' },
  { from: M1_NODES.mountainPass, to: M1_NODES.theReturn, on: 'win' },
];

export const M1_CAMPAIGN_GRAPH: CampaignGraph = {
  startId: M1_NODES.riverRidge,
  nodes: NODES,
  edges: EDGES,
};
