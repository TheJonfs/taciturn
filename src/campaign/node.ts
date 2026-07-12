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

import { abilityId, EMPTY_UNIT_EQUIPMENT, rulesetId, teamId } from '@engine/index.ts';
import type { RulesetId, TeamId } from '@engine/index.ts';
import { riverRidgeBattle } from '@content/battles/river-ridge-battle.ts';
import { authoredEnemy } from './authored-enemy.ts';
import type { CampaignUnit } from './types.ts';
import type { UnlockToken } from './progression/index.ts';
import { stonebridgeBattle } from '@content/battles/stonebridge-battle.ts';
import { marshmoorBattle } from '@content/battles/marshmoor-battle.ts';
import { mountainPassBattle } from '@content/battles/mountain-pass-battle.ts';
import { deploymentZonesFor } from '@content/deployment/index.ts';
import type { CampaignGraph, CampaignNode } from './graph.ts';
import type { NodeBattle, NodeBeat, StorySceneBeat } from './sequence.ts';

const PLAYER: TeamId = teamId('team_a');
const M1_DEPLOY_CAP = 5;

// The ruleset every campaign battle plays under. All authored node
// templates inherit `default` (they spread from the shipped demo-derived
// configs). The between-battles Formation UI computes equipment-adjusted
// bucket capacity under this id via the engine's draft resolver
// (`draftBucketCapacity`), so it must match what `createInitialState`
// will read at battle entry — `node.test.ts` pins every authored
// template's `rulesetId` to it. If a per-node ruleset ever ships, the
// Formation UI needs to become node-aware before that pin is relaxed.
export const CAMPAIGN_RULESET_ID: RulesetId = rulesetId('default');

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
  enemies?: ReadonlyArray<CampaignUnit>,
): NodeBattle {
  return {
    template,
    playerTeam: PLAYER,
    zones: deploymentZonesFor(zonesKey),
    deployCap: M1_DEPLOY_CAP,
    ...(enemies !== undefined ? { enemies } : {}),
  };
}

// River Ridge opener tuning (TABA M2 — the first authored enemy progression).
// The player deploys L25 veterans with full seeded kits; the opener's garrison
// is a rung below — dropped to L22 and each GATED to a basic two-active kit (no
// ultimates), so battle 1 teaches the ropes without being trivial. Derived from
// the template's own enemy placements (class / loadout / equipment / position
// reused), so only level + kit breadth change. Tune freely — it's data.
const RIVER_RIDGE_ENEMY_LEVEL = 22;
const RIVER_RIDGE_ENEMY_KITS: Readonly<Record<string, ReadonlyArray<string>>> = {
  earth_mage: ['earth_strike', 'earth_quake'], // Rock Toss + Earthquake
  lightning_mage: ['lightning_strike', 'magnetic_mark'], // Bolt + Vulnerable mark
  fire_mage: ['fire_strike', 'fire_storm'], // Scorch + Fireball
  water_mage: ['water_strike', 'brine'], // Water Lash + Slow
  knight: ['power_attack', 'bull_rush'], // heavy strike + knockback
};

function riverRidgeEnemies(): ReadonlyArray<CampaignUnit> {
  const ENEMY = teamId('team_b');
  return riverRidgeBattle.units
    .filter((u) => u.team === ENEMY)
    .map((slot) => {
      const kit = RIVER_RIDGE_ENEMY_KITS[String(slot.classId)] ?? [];
      const unlocks: ReadonlyArray<UnlockToken> = kit.map((id) => ({ kind: 'ability', id: abilityId(id) }));
      return authoredEnemy({
        id: String(slot.id), // reuse the slot id so any references stay valid
        name: slot.name,
        classId: slot.classId,
        level: RIVER_RIDGE_ENEMY_LEVEL,
        loadout: slot.loadout,
        equipment: slot.equipment ?? EMPTY_UNIT_EQUIPMENT,
        unlocks,
      });
    });
}

// The opener carries the tuned garrison; the finale ("The Return") revisits the
// same battlefield but keeps the template's stronger default enemies.
const riverRidgeOpener = (): NodeBeat => ({
  type: 'battle',
  battle: battle(riverRidgeBattle, 'river_ridge', riverRidgeEnemies()),
});
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
        portrait: { kind: 'fixed', key: 'plot-chris' },
        text: 'Fifty years of war, and it comes to this ridge. Ivalice bleeds behind us; the ford lies ahead.',
      },
      {
        speaker: 'Sera',
        portrait: { kind: 'fixed', key: 'plot-sera' },
        text: 'Scouts count a full company across the water. They hold the high ground — for now.',
      },
      {
        speaker: 'Chris',
        portrait: { kind: 'fixed', key: 'plot-chris' },
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
        portrait: { kind: 'fixed', key: 'plot-thessaly' },
        text: 'The bridge holds. By my count we lost less than the ledger feared. Rare, that.',
      },
      {
        speaker: 'Lumen',
        portrait: { kind: 'fixed', key: 'plot-lumen' },
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
        portrait: { kind: 'fixed', key: 'plot-clio' },
        text: 'The river is quiet here. It remembers every army that ever forded it, and forgets them all the same.',
      },
      {
        speaker: 'Clio',
        portrait: { kind: 'fixed', key: 'plot-clio' },
        text: 'One more bank to cross, and the road bends back the way we came. Rest a moment. Then — the return.',
      },
    ],
  },
};

// M3 economy — location capabilities (orthogonal flags, brief D2). Every
// combat node opens its skirmish valve once cleared (Chris's call: farmable
// lights up on the real campaign now, not just a sandbox). Stonebridge is
// the hub (the Dorter-pattern coexistence proof: a location that hosted a
// story battle, farms, AND trades). `offset` is the one scaling lever —
// skirmish level = party average + offset (placeholder tuning; it's data).
const NODES: ReadonlyArray<CampaignNode> = [
  { id: M1_NODES.riverRidge, name: 'River Ridge', chapter: 1, beats: [introScene, riverRidgeOpener()], farmable: true, offset: -1 },
  { id: M1_NODES.stonebridge, name: 'Stonebridge', chapter: 1, beats: [stonebridge(), aftermathScene], farmable: true, isHub: true, offset: 0 },
  { id: M1_NODES.marshmoor, name: 'Marshmoor', chapter: 1, beats: [marshmoor()], farmable: true, offset: 0 },
  { id: M1_NODES.theCrossing, name: 'The Crossing', chapter: 1, beats: [crossingScene] },
  { id: M1_NODES.mountainPass, name: 'Mountain Pass', chapter: 1, beats: [mountainPass()], farmable: true, offset: 2 },
  // The finale revisits the River Ridge battlefield (TABA "and back again").
  // Terminal — clearing it completes the campaign, so its valve never opens
  // in practice; farmable is left off rather than authoring a dead flag.
  { id: M1_NODES.theReturn, name: 'The Return', chapter: 1, beats: [riverRidge()] },
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
