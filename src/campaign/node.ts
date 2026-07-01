// TABA campaign — the authored M1 battle-graph (a forward branching DAG).
//
// M0 was a linear A→B array; M1 authors a small but real branching graph
// (taba-m1-brief Chunk 1) on the graph model in graph.ts. It exercises every
// routing shape M1 cares about:
//
//   River Ridge (start)
//      ├─ win → Stonebridge (north fork) ───┬─ win → Mountain Pass (side) ─┐
//      │                                     └─ win → ─────────────────────┤ (skip the pass)
//      └─ win → Marshmoor (south fork) ──────────── win → ─────────────────┤
//                                                   Mountain Pass ─ win → ──┤
//                                                            The Return (terminal) ◄┘
//
//   - PLAYER-CHOICE FORK at River Ridge: win → choose Stonebridge or Marshmoor.
//   - SKIPPABLE SIDE-NODE at Stonebridge: win → take Mountain Pass OR skip
//     straight to the finale (both rejoin at The Return). No special model
//     machinery — it's just two win-edges from Stonebridge (see graph.ts).
//   - CONVERGENT TERMINAL: every route ends at The Return (a "there and back
//     again" finale that revisits the River Ridge battlefield — TABA §1).
//
// M1 reuses the shipped battle templates + maps the lazy way (M0 discipline):
// enemies are template-authored battle-local placements that never persist;
// only the player roster is durable. Authored/generated encounters are M4.
// The finale reuses the River Ridge template (4 maps, 5 battle nodes — one
// reuse is unavoidable, and the "return" framing makes it deliberate).

import { teamId } from '@engine/index.ts';
import type { TeamId } from '@engine/index.ts';
import { riverRidgeBattle } from '@content/battles/river-ridge-battle.ts';
import { stonebridgeBattle } from '@content/battles/stonebridge-battle.ts';
import { marshmoorBattle } from '@content/battles/marshmoor-battle.ts';
import { mountainPassBattle } from '@content/battles/mountain-pass-battle.ts';
import { deploymentZonesFor } from '@content/deployment/index.ts';
import type { CampaignGraph, CampaignNode } from './graph.ts';

const PLAYER: TeamId = teamId('team_a');
const M1_DEPLOY_CAP = 5;

// Node ids — stable identity (CLAUDE.md rule 4), threaded into the save as
// the campaign position. Authored as readable slugs.
export const M1_NODES = {
  riverRidge: 'node-river-ridge',
  stonebridge: 'node-stonebridge',
  marshmoor: 'node-marshmoor',
  mountainPass: 'node-mountain-pass',
  theReturn: 'node-the-return',
} as const;

const NODES: ReadonlyArray<CampaignNode> = [
  {
    id: M1_NODES.riverRidge,
    name: 'River Ridge',
    battle: {
      template: riverRidgeBattle,
      playerTeam: PLAYER,
      zones: deploymentZonesFor('river_ridge'),
      deployCap: M1_DEPLOY_CAP,
    },
  },
  {
    id: M1_NODES.stonebridge,
    name: 'Stonebridge',
    battle: {
      template: stonebridgeBattle,
      playerTeam: PLAYER,
      zones: deploymentZonesFor('stonebridge'),
      deployCap: M1_DEPLOY_CAP,
    },
  },
  {
    id: M1_NODES.marshmoor,
    name: 'Marshmoor',
    battle: {
      template: marshmoorBattle,
      playerTeam: PLAYER,
      zones: deploymentZonesFor('marshmoor'),
      deployCap: M1_DEPLOY_CAP,
    },
  },
  {
    id: M1_NODES.mountainPass,
    name: 'Mountain Pass',
    battle: {
      template: mountainPassBattle,
      playerTeam: PLAYER,
      zones: deploymentZonesFor('mountain_pass'),
      deployCap: M1_DEPLOY_CAP,
    },
  },
  {
    id: M1_NODES.theReturn,
    name: 'The Return',
    // The finale revisits the River Ridge battlefield (TABA "and back again").
    battle: {
      template: riverRidgeBattle,
      playerTeam: PLAYER,
      zones: deploymentZonesFor('river_ridge'),
      deployCap: M1_DEPLOY_CAP,
    },
  },
];

// Win-edges only (M1 authors no loss-routing; loss = retry in the driver).
// The authored order is the order the world map offers the choices.
const EDGES = [
  // River Ridge — the player-choice fork.
  { from: M1_NODES.riverRidge, to: M1_NODES.stonebridge, on: 'win' as const },
  { from: M1_NODES.riverRidge, to: M1_NODES.marshmoor, on: 'win' as const },
  // Stonebridge — the skippable side-node: take the Pass or skip to the finale.
  { from: M1_NODES.stonebridge, to: M1_NODES.mountainPass, on: 'win' as const },
  { from: M1_NODES.stonebridge, to: M1_NODES.theReturn, on: 'win' as const },
  // Marshmoor — the south route rejoins the finale directly.
  { from: M1_NODES.marshmoor, to: M1_NODES.theReturn, on: 'win' as const },
  // Mountain Pass — the side route rejoins the finale.
  { from: M1_NODES.mountainPass, to: M1_NODES.theReturn, on: 'win' as const },
  // The Return — terminal (no win-edges).
];

export const M1_CAMPAIGN_GRAPH: CampaignGraph = {
  startId: M1_NODES.riverRidge,
  nodes: NODES,
  edges: EDGES,
};
