// TABA campaign — HAND-AUTHORED node content (scenes, battle beats, enemy
// derivation), keyed by node id.
//
// S90 split (node-authoring structural tier): the campaign graph's STRUCTURE
// (nodes, edges, chapters, capabilities, layout) is authored by the Atlas
// graph editor and lives in the codegen-shaped `node.ts`; the CONTENT of a
// node — its story scenes, its battle beats, its authored enemy progressions
// — is hand-written here and merged in by id via `contentBeats`. The Atlas
// tool NEVER reads or writes this module, which is what makes its round-trip
// structurally lossless: derive-from-template logic like `riverRidgeEnemies`
// can't be flattened by an export because the exporter never touches it.
//
// The authored M1.5 sequence this content fills in:
//
//   River Ridge (start)   [story(intro), battle]         ← PRE-battle scene
//      ├─ win → Stonebridge  [battle, story(aftermath)]  ← POST-battle scene
//      │           ├─ win → Mountain Pass [battle] ─┐
//      │           └─ win → ─────────────────────── ┤ (skip the pass)
//      └─ win → Marshmoor [battle]                   │
//                  └─ win → The Crossing [story] ────┤  ← STANDALONE story node
//                                The Return [battle] ◄┘  (terminal)
//
// The story prose is PLACEHOLDER (taba-m1-brief: prove the slots, not the
// writing) — Ivalician-flavored filler spoken by roster units (real portraits
// via the class-portrait pipeline). M1 reuses the shipped battle templates +
// maps the lazy way (M0 discipline); authored/generated encounters are M4.

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

// --- the content table: ENGAGEMENT BEAT ID → its hand-authored beats ---
//
// Keys are effective storyBeatIds (engagement queues, M3): a single-
// engagement node's default beat id IS its node id, so the pre-queue keys
// below are unchanged; a later engagement in a queue keys by its explicit
// `storyBeatId`. Raw strings (not the generated module's id constants) so
// this module never imports node.ts — content is the dependency, structure
// the dependent. A key with no matching structural engagement is dead
// content (the codegen round-trip test would surface it); an engagement
// claiming content that isn't here fails loud in `contentBeats` at module
// init.

const NODE_CONTENT: Readonly<Record<string, ReadonlyArray<NodeBeat>>> = {
  'node-river-ridge': [introScene, riverRidgeOpener()],
  'node-stonebridge': [stonebridge(), aftermathScene],
  'node-marshmoor': [marshmoor()],
  'node-the-crossing': [crossingScene],
  'node-mountain-pass': [mountainPass()],
  // The finale revisits the River Ridge battlefield (TABA "and back again")
  // with the template's stronger default garrison.
  'node-the-return': [riverRidge()],
};

// The hand-authored beats for an engagement (by effective beat id). Throws
// loud on a missing id — a generated graph referencing content that doesn't
// exist is a wiring bug caught at module init, not a silent empty node.
export function contentBeats(beatId: string): ReadonlyArray<NodeBeat> {
  const beats = NODE_CONTENT[beatId];
  if (beats === undefined) {
    throw new Error(`contentBeats: no hand-authored content for beat id '${beatId}' (node-content.ts)`);
  }
  return beats;
}

// Does hand-authored content exist for this beat id? (The Atlas importer
// uses this to classify an engagement's beats source without throwing.)
export function hasContentBeats(beatId: string): boolean {
  return NODE_CONTENT[beatId] !== undefined;
}
