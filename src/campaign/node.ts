// TABA campaign — the authored campaign graph (a forward branching DAG of
// BEAT SEQUENCES).
//
// M0 was a linear A→B array; M1 authored a branching graph of single-battle
// nodes; M1.5 makes each node an ordered `beats: NodeBeat[]` where a battle is
// one beat among others (taba-m1_5-brief). It exercises every routing shape M1
// cared about, PLUS the three battle-as-beat placements the milestone proves:
//
//   River Ridge (start)   [story(intro), battle]         ← PRE-battle scene
//      ├─ win → Stonebridge  [battle, story(aftermath)]  ← POST-battle scene
//      │           ├─ win → Mountain Pass [battle] ─┐
//      │           └─ win → ─────────────────────── ┤ (skip the pass)
//      └─ win → Marshmoor [battle]                   │
//                  └─ win → The Crossing [story] ────┤  ← STANDALONE story node
//                                The Return [battle] ◄┘  (terminal)
//
//   - PLAYER-CHOICE FORK at River Ridge (win → Stonebridge or Marshmoor).
//   - SKIPPABLE SIDE-NODE at Stonebridge (take Mountain Pass or skip).
//   - STANDALONE STORY NODE on the south route (The Crossing — scene, no
//     battle); it plays its scene, then routes onward.
//   - CONVERGENT TERMINAL: every route ends at The Return, which revisits the
//     River Ridge battlefield (the "there and back again" finale — TABA §1).
//
// The story prose is PLACEHOLDER (brief: prove the slots, not the writing) —
// Ivalician-flavored filler spoken by roster units (real portraits via the
// class-portrait pipeline). M1 reuses the shipped battle templates + maps the
// lazy way (M0 discipline); authored/generated encounters are M4.

import { classId, teamId } from '@engine/index.ts';
import type { TeamId } from '@engine/index.ts';
import { riverRidgeBattle } from '@content/battles/river-ridge-battle.ts';
import { stonebridgeBattle } from '@content/battles/stonebridge-battle.ts';
import { marshmoorBattle } from '@content/battles/marshmoor-battle.ts';
import { mountainPassBattle } from '@content/battles/mountain-pass-battle.ts';
import { deploymentZonesFor } from '@content/deployment/index.ts';
import type { CampaignGraph, CampaignNode } from './graph.ts';
import type { NodeBattle, NodeBeat, StorySceneBeat } from './sequence.ts';

const PLAYER: TeamId = teamId('team_a');
const M1_DEPLOY_CAP = 5;

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

// --- battle-beat definitions (each reuses a shipped template + its zones) ---

function battle(
  template: NodeBattle['template'],
  zonesKey: Parameters<typeof deploymentZonesFor>[0],
): NodeBattle {
  return { template, playerTeam: PLAYER, zones: deploymentZonesFor(zonesKey), deployCap: M1_DEPLOY_CAP };
}

const riverRidge = (): NodeBeat => ({ type: 'battle', battle: battle(riverRidgeBattle, 'river_ridge') });
const stonebridge = (): NodeBeat => ({ type: 'battle', battle: battle(stonebridgeBattle, 'stonebridge') });
const marshmoor = (): NodeBeat => ({ type: 'battle', battle: battle(marshmoorBattle, 'marshmoor') });
const mountainPass = (): NodeBeat => ({ type: 'battle', battle: battle(mountainPassBattle, 'mountain_pass') });

// --- authored story scenes (placeholder prose — brief) ---

const introScene: StorySceneBeat = {
  type: 'story-scene',
  scene: {
    title: 'River Ridge — the march out',
    lines: [
      {
        speaker: 'Chris',
        portrait: { classId: classId('templar') },
        text: 'Fifty years of war, and it comes to this ridge. Ivalice bleeds behind us; the ford lies ahead.',
      },
      {
        speaker: 'Sera',
        portrait: { classId: classId('assassin') },
        text: 'Scouts count a full company across the water. They hold the high ground — for now.',
      },
      {
        speaker: 'Chris',
        portrait: { classId: classId('templar') },
        text: 'Then we take it back. Form up. We go out — and we come home.',
      },
    ],
  },
};

const aftermathScene: StorySceneBeat = {
  type: 'story-scene',
  scene: {
    title: 'Stonebridge — after the crossing',
    lines: [
      {
        speaker: 'Thessaly',
        portrait: { classId: classId('calculator') },
        text: 'The bridge holds. By my count we lost less than the ledger feared. Rare, that.',
      },
      {
        speaker: 'Lumen',
        portrait: { classId: classId('fire_mage') },
        text: 'Rare and welcome. Warm yourselves — the mountain road runs cold, if we take it.',
      },
    ],
  },
};

const crossingScene: StorySceneBeat = {
  type: 'story-scene',
  scene: {
    title: 'The Crossing',
    lines: [
      {
        speaker: 'Clio',
        portrait: { classId: classId('water_mage') },
        text: 'The river is quiet here. It remembers every army that ever forded it, and forgets them all the same.',
      },
      {
        speaker: 'Clio',
        portrait: { classId: classId('water_mage') },
        text: 'One more bank to cross, and the road bends back the way we came. Rest a moment. Then — the return.',
      },
    ],
  },
};

const NODES: ReadonlyArray<CampaignNode> = [
  { id: M1_NODES.riverRidge, name: 'River Ridge', beats: [introScene, riverRidge()] },
  { id: M1_NODES.stonebridge, name: 'Stonebridge', beats: [stonebridge(), aftermathScene] },
  { id: M1_NODES.marshmoor, name: 'Marshmoor', beats: [marshmoor()] },
  { id: M1_NODES.theCrossing, name: 'The Crossing', beats: [crossingScene] },
  { id: M1_NODES.mountainPass, name: 'Mountain Pass', beats: [mountainPass()] },
  // The finale revisits the River Ridge battlefield (TABA "and back again").
  { id: M1_NODES.theReturn, name: 'The Return', beats: [riverRidge()] },
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
  // Marshmoor — the south route passes through the standalone story node.
  { from: M1_NODES.marshmoor, to: M1_NODES.theCrossing, on: 'win' as const },
  // The Crossing — a battle-less node; winning is finishing its scene.
  { from: M1_NODES.theCrossing, to: M1_NODES.theReturn, on: 'win' as const },
  // Mountain Pass — the side route rejoins the finale.
  { from: M1_NODES.mountainPass, to: M1_NODES.theReturn, on: 'win' as const },
  // The Return — terminal (no win-edges).
];

export const M1_CAMPAIGN_GRAPH: CampaignGraph = {
  startId: M1_NODES.riverRidge,
  nodes: NODES,
  edges: EDGES,
};
