// GENERATED-SHAPED — TABA campaign structural graph (Atlas graph editor).
//
// This module is the codegen output of the Atlas node-authoring tool (the
// `?atlas` dev route): nodes, win-edges (authored order = the world map's
// choice order; `opensOnBeat` gates), chapters, capabilities, and each
// node's engagement queue with per-engagement beats sources.
// Hand edits are legal TypeScript but the next Atlas export OVERWRITES THIS
// FILE WHOLESALE — story scenes, battle beats, and enemy derivation belong
// in node-content.ts (hand-authored, merged by beat id; the tool never
// touches it). The paired layout module is
// src/app/interstitial/node-layout.ts.
// The exporter's fidelity is pinned by the Atlas round-trip test.

import type { CampaignEdge, CampaignGraph, CampaignNode } from './graph.ts';
import { contentBeats } from './node-content.ts';

// Node ids — stable identity (CLAUDE.md rule 4), threaded into the save as
// the campaign position. Authored as readable slugs.
export const CAMPAIGN_NODES = {
  zarghidas: 'node-zarghidas',
  oskun: 'node-oskun',
  alvera: 'node-alvera',
  zelmoniaCastle: 'node-zelmonia-castle',
  zelmoniaHills: 'node-zelmonia-hills',
  grekForest: 'node-grek-forest',
  fortCator: 'node-fort-cator',
  ordalCanyon: 'node-ordal-canyon',
  oldOrdal: 'node-old-ordal',
  mountEska: 'node-mount-eska',
  esterRoad: 'node-ester-road',
  rukVillage: 'node-ruk-village',
  viura: 'node-viura',
} as const;

const NODES: ReadonlyArray<CampaignNode> = [
  {
    id: CAMPAIGN_NODES.zarghidas,
    name: 'Zarghidas Trade City',
    chapter: 1,
    engagements: [{ beats: contentBeats(CAMPAIGN_NODES.zarghidas) }],
    isHub: true,
  },
  {
    id: CAMPAIGN_NODES.oskun,
    name: 'Oskun Fields',
    chapter: 1,
    engagements: [{ beats: contentBeats(CAMPAIGN_NODES.oskun) }],
    offset: 1,
    farmable: true,
  },
  {
    id: CAMPAIGN_NODES.alvera,
    name: 'Alvera Village',
    chapter: 1,
    engagements: [{ beats: contentBeats(CAMPAIGN_NODES.alvera) }],
    offset: 1,
    isHub: true,
  },
  {
    id: CAMPAIGN_NODES.zelmoniaCastle,
    name: 'Zelmonia Castle',
    chapter: 1,
    engagements: [{ beats: contentBeats(CAMPAIGN_NODES.zelmoniaCastle) }],
    isHub: true,
  },
  {
    id: CAMPAIGN_NODES.zelmoniaHills,
    name: 'Zelmonia Hills',
    chapter: 1,
    engagements: [{ beats: contentBeats(CAMPAIGN_NODES.zelmoniaHills) }],
    offset: 2,
    farmable: true,
  },
  {
    id: CAMPAIGN_NODES.grekForest,
    name: 'Grek Forest',
    chapter: 1,
    engagements: [{ beats: contentBeats(CAMPAIGN_NODES.grekForest) }],
    offset: 2,
    farmable: true,
  },
  {
    id: CAMPAIGN_NODES.fortCator,
    name: 'Fort Cator',
    chapter: 1,
    engagements: [{ beats: contentBeats(CAMPAIGN_NODES.fortCator) }],
    offset: 2,
    isHub: true,
  },
  {
    id: CAMPAIGN_NODES.ordalCanyon,
    name: 'Ordal Canyon',
    chapter: 1,
    engagements: [{ beats: contentBeats(CAMPAIGN_NODES.ordalCanyon) }],
    offset: 2,
    farmable: true,
  },
  {
    id: CAMPAIGN_NODES.oldOrdal,
    name: 'Old Ordal',
    chapter: 1,
    engagements: [{ beats: contentBeats(CAMPAIGN_NODES.oldOrdal) }],
    offset: 2,
  },
  {
    id: CAMPAIGN_NODES.mountEska,
    name: 'Mount Eska',
    chapter: 1,
    engagements: [{ beats: contentBeats(CAMPAIGN_NODES.mountEska) }],
    offset: 3,
    farmable: true,
  },
  {
    id: CAMPAIGN_NODES.esterRoad,
    name: 'Ester Road',
    chapter: 1,
    engagements: [{ beats: contentBeats(CAMPAIGN_NODES.esterRoad) }],
    offset: -2,
    farmable: true,
  },
  {
    id: CAMPAIGN_NODES.rukVillage,
    name: 'Ruk Village',
    chapter: 1,
    engagements: [{ beats: contentBeats(CAMPAIGN_NODES.rukVillage) }],
    offset: 3,
  },
  {
    id: CAMPAIGN_NODES.viura,
    name: 'Viura',
    chapter: 1,
    engagements: [],
    phantom: true,
  },
];

const EDGES: ReadonlyArray<CampaignEdge> = [
  { from: CAMPAIGN_NODES.zarghidas, to: CAMPAIGN_NODES.oskun, on: 'win' },
  { from: CAMPAIGN_NODES.oskun, to: CAMPAIGN_NODES.alvera, on: 'win' },
  { from: CAMPAIGN_NODES.alvera, to: CAMPAIGN_NODES.zelmoniaCastle, on: 'win' },
  { from: CAMPAIGN_NODES.zelmoniaCastle, to: CAMPAIGN_NODES.zelmoniaHills, on: 'win' },
  { from: CAMPAIGN_NODES.zelmoniaHills, to: CAMPAIGN_NODES.grekForest, on: 'win' },
  { from: CAMPAIGN_NODES.grekForest, to: CAMPAIGN_NODES.fortCator, on: 'win' },
  { from: CAMPAIGN_NODES.fortCator, to: CAMPAIGN_NODES.ordalCanyon, on: 'win' },
  { from: CAMPAIGN_NODES.ordalCanyon, to: CAMPAIGN_NODES.oldOrdal, on: 'win' },
  { from: CAMPAIGN_NODES.oldOrdal, to: CAMPAIGN_NODES.mountEska, on: 'win' },
  { from: CAMPAIGN_NODES.oldOrdal, to: CAMPAIGN_NODES.viura, on: 'win', phantom: true },
  { from: CAMPAIGN_NODES.mountEska, to: CAMPAIGN_NODES.esterRoad, on: 'win' },
  { from: CAMPAIGN_NODES.esterRoad, to: CAMPAIGN_NODES.rukVillage, on: 'win' },
];

export const CAMPAIGN_GRAPH: CampaignGraph = {
  startId: CAMPAIGN_NODES.zarghidas,
  nodes: NODES,
  edges: EDGES,
};
