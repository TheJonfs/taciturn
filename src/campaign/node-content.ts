// TABA campaign — HAND-AUTHORED node content (scenes, battle beats, enemy
// derivation), keyed by node id.
//
// S90 split (node-authoring structural tier): the campaign graph's STRUCTURE
// (nodes, edges, chapters, capabilities, layout) is authored by the Atlas
// graph editor and lives in the codegen-shaped `node.ts`; the CONTENT of a
// node — its story scenes, its battle beats, its authored enemy progressions
// — is hand-written here and merged in by id via `contentBeats`. The Atlas
// tool NEVER reads or writes this module, which is what makes its round-trip
// structurally lossless.
//
// CHAPTER 1 (S93, taba-ch1-authoring-brief): the real campaign replaces the
// M1 test graph. The linear spine 0→10 out of Ivalice and back:
//
//   Zarghidas(hub) → Oskun(guest) → Alvera(hub; Clio joins) →
//   Zelmonia Castle(hub, scene) → Zelmonia Hills(Theo retreats) →
//   Grek Forest(Thessaly joins) → Fort Cator(hub) →
//   Ordal Canyon(Sera guest→join) → Old Ordal(dead; phantom road to Viura) →
//   Mount Eska(Theo returns) → Ester Road(subdue-secret) →
//   Ruk Village(finale, subdue-the-leader)
//
// Everything here is CONTENT-STUB quality by design (brief: walkable
// placeholders — structure, pacing, joins, economy and special-battle logic
// are real; dialogue, maps and enemy lineups are M4/M5):
//   - Scenes are one-line MARKER beats ("Clio joins after the battle here").
//   - Battles recycle shipped battlefields (River Ridge default; Ordal
//     Canyon on Mountain Pass) with enemy lineups from the skirmish stub
//     generator at authored fixed levels approximating the brief's offset
//     curve (the template defaults are L25-era fixtures — unplayable at L1).
//   - The special-battle logic IS authored for real: Theo Renault's
//     death-protected retreat-at-15% (nodes 3/8), the Wiegraf and Sera
//     guests (nodes 1/6), the subdue-secret outcome branches + campaign
//     flags (nodes 9/10), the staggered joins (2/4/6), and the unique drops
//     (Pendant, Flametongue, Freelancer's Charm).
//
// The catalog instance below is AUTHORING-TIME derivation only (kit seeding
// for generated lineups and named units) — the same static content data the
// app's instance is built from; the engine still reads the one catalog the
// app threads (ADR-0004 unchanged).

import {
  EMPTY_UNIT_EQUIPMENT,
  abilityId,
  bucketId,
  classId,
  itemId,
  rulesetId,
  teamId,
  unitId,
} from '@engine/index.ts';
import type {
  BattleConfig,
  Position,
  RulesetId,
  TeamId,
  UnitId,
  UnitPlacement,
  VictoryCondition,
} from '@engine/index.ts';
import { loadDefaultCatalog } from '@content/index.ts';
import { riverRidgeBattle } from '@content/battles/river-ridge-battle.ts';
import { mountainPassBattle } from '@content/battles/mountain-pass-battle.ts';
import { deploymentZonesFor } from '@content/deployment/index.ts';
import { authoredEnemy } from './authored-enemy.ts';
import { clioJoinUnit, seraJoinUnit, thessalyJoinUnit } from './ch1-roster.ts';
import { withInnatePassives } from './innate-passives.ts';
import { generateSkirmishParty } from './skirmish.ts';
import type { CampaignUnit } from './types.ts';
import type { NodeBattle, NodeBeat, StoryScene, StorySceneBeat } from './sequence.ts';

const PLAYER: TeamId = teamId('team_a');
const ENEMY: TeamId = teamId('team_b');
const CH1_DEPLOY_CAP = 5;

// Authoring-time catalog (see header note — derivation only, not the
// engine's threaded instance).
const catalog = loadDefaultCatalog();

// The ruleset every campaign battle plays under. All authored node
// templates inherit `default` (they spread from the shipped demo-derived
// configs). The between-battles Formation UI computes equipment-adjusted
// bucket capacity under this id via the engine's draft resolver
// (`draftBucketCapacity`), so it must match what `createInitialState`
// will read at battle entry — `node.test.ts` pins every authored
// template's `rulesetId` to it. If a per-node ruleset ever ships, the
// Formation UI needs to become node-aware before that pin is relaxed.
export const CAMPAIGN_RULESET_ID: RulesetId = rulesetId('default');

// --- named Ch1 characters (enemy/guest side) ---------------------------------

// Theo Renault — commander in the Ordallian army, the recurring antagonist
// (nodes 3 and 8). Death-protected in both fights: victory drives him below
// 15% and he RETREATS, surviving either way (WI1). Portrait key reserved;
// falls back to the Hunter face until the art lands in FIXED_PORTRAITS.
export const THEO_ID: UnitId = unitId('plot-theo');

function theoRenault(level: number, fullKit: boolean): CampaignUnit {
  const hunter = classId('hunter');
  return {
    ...authoredEnemy({
      id: String(THEO_ID),
      name: 'Theo Renault',
      classId: hunter,
      level,
      gender: 'male',
      loadout: withInnatePassives(
        {
          actionBuckets: { [bucketId('first_action')]: [catalog.getClass(hunter).firstActionCommandSet] },
          // The rematch (L10) fights sharper: Eagle Eye also equipped.
          // Exact JP/kit tuning is deferred (Chris, S93).
          passiveBuckets: fullKit ? { [bucketId('support')]: [abilityId('eagle_eye')] } : {},
        },
        hunter,
        catalog,
      ),
      equipment: {
        ...EMPTY_UNIT_EQUIPMENT,
        rightHand: itemId('short_bow'),
        armor: itemId('padded_vest'),
        headgear: itemId('guard_cap'),
        accessory: itemId('lightfoot'),
      },
      unlocks: fullKit
        ? [
            { kind: 'ability', id: abilityId('pin_down') },
            { kind: 'ability', id: abilityId('charged_attack') },
            { kind: 'ability', id: abilityId('scramble') },
          ]
        : [{ kind: 'ability', id: abilityId('pin_down') }],
    }),
    portrait: String(THEO_ID),
  };
}

// Wiegraf Folles — leader of the Dead Men, commonfolk volunteers. The Oskun
// guest (node 1): L2 Alchemist who knows Potion and Phoenix Down, keeping
// the first real fight very safe. Expected back as a guest at a later node.
export const WIEGRAF_ID: UnitId = unitId('plot-wiegraf');

function wiegrafGuest(): CampaignUnit {
  const alchemist = classId('alchemist');
  return {
    ...authoredEnemy({
      id: String(WIEGRAF_ID),
      name: 'Wiegraf Folles',
      classId: alchemist,
      level: 2,
      gender: 'male',
      loadout: withInnatePassives(
        {
          actionBuckets: { [bucketId('first_action')]: [catalog.getClass(alchemist).firstActionCommandSet] },
          passiveBuckets: {},
        },
        alchemist,
        catalog,
      ),
      equipment: {
        leftHand: itemId('buckler'),
        rightHand: itemId('iron_sword'),
        headgear: itemId('focus_band'),
        armor: itemId('padded_jacket'),
        accessory: itemId('diamond_bracelet'),
      },
      unlocks: [
        { kind: 'item', id: itemId('potion') },
        { kind: 'item', id: itemId('phoenix_down') },
      ],
    }),
    portrait: String(WIEGRAF_ID),
  };
}

// The Ruk Village rebel captain — the finale's subdue-the-leader target
// (node 10). A plain named enemy (no death protection: killing him is the
// standard path).
const RUK_CAPTAIN_ID: UnitId = unitId('ch1-ruk-captain');

function rukCaptain(level: number): CampaignUnit {
  const knight = classId('knight');
  return authoredEnemy({
    id: String(RUK_CAPTAIN_ID),
    name: 'Rebel Captain',
    classId: knight,
    level,
    gender: 'male',
    loadout: withInnatePassives(
      {
        actionBuckets: { [bucketId('first_action')]: [catalog.getClass(knight).firstActionCommandSet] },
        passiveBuckets: {},
      },
      knight,
      catalog,
    ),
    equipment: {
      ...EMPTY_UNIT_EQUIPMENT,
      rightHand: itemId('iron_sword'),
      armor: itemId('chain_shirt'),
    },
    unlocks: [
      { kind: 'ability', id: abilityId('power_attack') },
      { kind: 'ability', id: abilityId('bull_rush') },
    ],
  });
}

// --- placeholder lineups + template variants ---------------------------------

// Placeholder enemy lineup: the skirmish stub generator at an authored FIXED
// level (Tier-1 classes, standard kits, no gear). Levels below approximate
// the brief's offset curve against the expected party average entering each
// node — the one series playtest measures and re-pins. Real authored
// lineups are M4/M5 work; this keeps every fight walkable at an L1 start.
function lineup(level: number, count = 5): ReadonlyArray<CampaignUnit> {
  return generateSkirmishParty(level, count, catalog);
}

// A guest ally placement added to a template: fixed authored position
// OUTSIDE the deploy zone (a guest is never a deploy slot), stand-in
// statline spread from a player slot (the guest fold re-skins it with the
// real durable unit).
function withGuestSlot(template: BattleConfig, id: string, position: Position): BattleConfig {
  const base = template.units.find((u) => u.team === PLAYER && u.guest !== true);
  if (base === undefined) throw new Error('withGuestSlot: template has no player placements');
  return {
    ...template,
    units: [...template.units, { ...base, id: unitId(id), name: 'Guest', position, guest: true }],
  };
}

// Reorder the enemy team so its first slot is the deterministic LEAD:
// authored specs fold in order, so enemies[0] (Theo, the rebel captain)
// re-skins exactly this slot. Optionally death-protect it (WI1 — the flag
// survives the fold).
function withLeadEnemySlot(template: BattleConfig, protectLead: boolean): BattleConfig {
  const enemies = template.units.filter((u) => u.team === ENEMY);
  const others = template.units.filter((u) => u.team !== ENEMY);
  const lead = enemies[0];
  if (lead === undefined) throw new Error('withLeadEnemySlot: template has no enemy placements');
  const leadSlot: UnitPlacement = protectLead ? { ...lead, deathProtected: true } : lead;
  return { ...template, units: [...others, leadSlot, ...enemies.slice(1)] };
}

// Node 1 — Oskun Fields: River Ridge plus Wiegraf's guest slot at (3,1)
// (land, outside the northern deploy zone, no authored unit stands there).
const oskunTemplate: BattleConfig = {
  ...withGuestSlot(riverRidgeBattle, 'ch1-guest-slot-oskun', { x: 3, y: 1, layer: 0 }),
  battleId: 'ch1_oskun_v1',
};

// Nodes 3/8 — the Theo fights: victory = Theo under 15% (strict <, and a
// downed/retreated unit counts as below — S92 pins) OR the field swept;
// he is death-protected either way, so he always survives to return. No
// outcome tags: he always escapes, nothing to branch (substrate brief).
const theoConditions: ReadonlyArray<VictoryCondition> = [
  {
    kind: 'predicate',
    predicate: { kind: 'unit_below_hp', target: { kind: 'unit', unitId: THEO_ID }, fraction: 0.15 },
    winner: PLAYER,
    description: 'Drive Theo Renault from the field',
  },
  { kind: 'defeat_all', side: ENEMY, description: 'Defeat all enemies' },
  { kind: 'defeat_all', side: PLAYER, description: 'Defeat all enemies' },
];

const zelmoniaHillsTemplate: BattleConfig = {
  ...withLeadEnemySlot(riverRidgeBattle, true),
  battleId: 'ch1_zelmonia_hills_v1',
  victoryConditions: theoConditions,
};

const mountEskaTemplate: BattleConfig = {
  ...withLeadEnemySlot(riverRidgeBattle, true),
  battleId: 'ch1_mount_eska_v1',
  victoryConditions: theoConditions,
};

// Node 6 — Ordal Canyon on Mountain Pass (brief's map recycle), with Sera's
// guest slot at (1,3) (basin edge, outside the NW deploy zone).
const ordalCanyonTemplate: BattleConfig = {
  ...withGuestSlot(mountainPassBattle, 'ch1-guest-slot-ordal', { x: 1, y: 3, layer: 0 }),
  battleId: 'ch1_ordal_canyon_v1',
};

// Node 9 — Ester Road, the subdue-all secret: good = every rebel under 25%
// with ZERO rebel deaths (one kill makes it permanently unsatisfiable and
// the fight falls through to standard). Both wins carry outcome tags; the
// flag store records whichever fires (recordOutcomeAs 'ester').
const esterConditions: ReadonlyArray<VictoryCondition> = [
  {
    kind: 'predicate',
    predicate: {
      kind: 'all_of',
      predicates: [
        { kind: 'no_deaths', side: ENEMY },
        { kind: 'unit_below_hp', target: { kind: 'side', side: ENEMY }, fraction: 0.25 },
      ],
    },
    winner: PLAYER,
    outcome: 'ester-good',
    description: 'Subdue the deserters — every rebel beaten below quarter strength, none dead',
  },
  {
    kind: 'predicate',
    predicate: { kind: 'all_defeated', side: ENEMY },
    winner: PLAYER,
    outcome: 'ester-standard',
    description: 'Defeat all enemies',
  },
  { kind: 'defeat_all', side: PLAYER, description: 'Defeat all enemies' },
];

const esterRoadTemplate: BattleConfig = {
  ...riverRidgeBattle,
  battleId: 'ch1_ester_road_v1',
  victoryConditions: esterConditions,
};

// Node 10 — Ruk Village, the finale's subdue-the-leader secret: good = the
// rebel captain under 25% with zero rebel deaths (only the LEADER need be
// subdued; the other rebels just have to survive — substrate brief).
const rukConditions: ReadonlyArray<VictoryCondition> = [
  {
    kind: 'predicate',
    predicate: {
      kind: 'all_of',
      predicates: [
        { kind: 'no_deaths', side: ENEMY },
        { kind: 'unit_below_hp', target: { kind: 'unit', unitId: RUK_CAPTAIN_ID }, fraction: 0.25 },
      ],
    },
    winner: PLAYER,
    outcome: 'ruk-good',
    description: 'Subdue the rebel captain without a single kill',
  },
  {
    kind: 'predicate',
    predicate: { kind: 'all_defeated', side: ENEMY },
    winner: PLAYER,
    outcome: 'ruk-standard',
    description: 'Defeat all enemies',
  },
  { kind: 'defeat_all', side: PLAYER, description: 'Defeat all enemies' },
];

const rukVillageTemplate: BattleConfig = {
  ...withLeadEnemySlot(riverRidgeBattle, false),
  battleId: 'ch1_ruk_village_v1',
  victoryConditions: rukConditions,
};

// --- beat builders -----------------------------------------------------------

function battle(
  template: NodeBattle['template'],
  zonesKey: Parameters<typeof deploymentZonesFor>[0],
  extras: Partial<
    Pick<NodeBattle, 'enemies' | 'guests' | 'recordOutcomeAs' | 'onOutcome' | 'joins' | 'grants'>
  > = {},
): NodeBeat {
  return {
    type: 'battle',
    battle: {
      template,
      playerTeam: PLAYER,
      zones: deploymentZonesFor(zonesKey),
      deployCap: CH1_DEPLOY_CAP,
      ...extras,
    },
  };
}

// A placeholder MARKER scene (brief: one line each, so the chapter walks
// with its narrative rhythm before real dialogue exists — M4/M5 replaces
// these in place).
function marker(title: string, text: string): StorySceneBeat {
  return {
    type: 'story-scene',
    scene: { title, lines: [{ speaker: 'Author’s note', text }] },
  };
}

function markerScene(title: string, text: string): StoryScene {
  return marker(title, text).scene;
}

// --- the content table: ENGAGEMENT BEAT ID → its hand-authored beats ---
//
// Keys are effective storyBeatIds (engagement queues, M3): a single-
// engagement node's default beat id IS its node id. Raw strings (not the
// generated module's id constants) so this module never imports node.ts —
// content is the dependency, structure the dependent. A key with no
// matching structural engagement is dead content; an engagement claiming
// content that isn't here fails loud in `contentBeats` at module init.

const NODE_CONTENT: Readonly<Record<string, ReadonlyArray<NodeBeat>>> = {
  'node-zarghidas': [
    marker(
      'Zarghidas Trade City',
      'Opening scene: fifty years of war. Lumen and Chris muster the company — four fresh recruits — and take the road east into Ordallia.',
    ),
  ],
  'node-oskun': [
    marker(
      'Oskun Fields — the road out',
      'Wiegraf Folles and the Dead Men hold the fields; he fights alongside the company as a guest.',
    ),
    battle(oskunTemplate, 'river_ridge', {
      guests: [wiegrafGuest()],
      enemies: lineup(2),
      grants: [itemId('pendant_of_lumara')],
    }),
    marker(
      'Oskun Fields — aftermath',
      'The Dead Men march on. Lumen receives the Pendant of Lumara — the fire lesson begins.',
    ),
  ],
  'node-alvera': [
    battle(riverRidgeBattle, 'river_ridge', {
      enemies: lineup(3),
      joins: [clioJoinUnit(catalog)],
    }),
    marker('Alvera Village', 'Clio joins after the battle here. The caster market opens (gear wave 1).'),
  ],
  'node-zelmonia-castle': [
    marker(
      'Zelmonia Castle',
      'Scene: the castle armory opens its doors — the Heavy lane, Chris the customer. The road turns toward the hills.',
    ),
  ],
  'node-zelmonia-hills': [
    marker(
      'Zelmonia Hills — the commander',
      'Theo Renault, commander in the Ordallian army, bars the road. Drive him below strength and he will retreat — he cannot be slain.',
    ),
    battle(zelmoniaHillsTemplate, 'river_ridge', {
      enemies: [theoRenault(4, false), ...lineup(4, 4)],
      grants: [itemId('flametongue')],
    }),
    marker(
      'Zelmonia Hills — aftermath',
      'Theo retreats, alive. Chris takes up Flametongue — the element wheel turns.',
    ),
  ],
  'node-grek-forest': [
    battle(riverRidgeBattle, 'river_ridge', {
      enemies: lineup(6),
      joins: [thessalyJoinUnit(catalog)],
    }),
    marker('Grek Forest', 'Thessaly joins after the battle here.'),
  ],
  'node-fort-cator': [
    battle(riverRidgeBattle, 'river_ridge', { enemies: lineup(7) }),
    marker('Fort Cator', '“Sword Town” opens its market: the Cutlass lane.'),
  ],
  'node-ordal-canyon': [
    marker(
      'Ordal Canyon — a blade in the pass',
      'Sera fights alongside the company as a guest — AI-driven, uncommandable, hers alone.',
    ),
    battle(ordalCanyonTemplate, 'mountain_pass', {
      guests: [seraJoinUnit(catalog)],
      enemies: lineup(8),
      joins: [seraJoinUnit(catalog)],
    }),
    marker('Ordal Canyon — aftermath', 'Sera joins the roster — guest no more.'),
  ],
  'node-old-ordal': [
    battle(riverRidgeBattle, 'river_ridge', { enemies: lineup(9) }),
    marker(
      'Old Ordal — the road not taken',
      'Beyond the ruins the road runs on toward Viura, deep in Ordallia. The company is recalled home; the capital stays a light on the horizon. ' +
        'Word from Alvera — the arcanists have restocked.',
    ),
  ],
  'node-mount-eska': [
    marker('Mount Eska — the commander returns', 'Theo Renault again — higher ground, harder fight, same retreat.'),
    battle(mountEskaTemplate, 'river_ridge', {
      enemies: [theoRenault(10, true), ...lineup(10, 4)],
      grants: [itemId('freelancers_charm')],
    }),
    marker(
      'Mount Eska — aftermath',
      'Theo withdraws a second time. Among the abandoned baggage: the Freelancer’s Charm. ' +
        'Word from Alvera — the arcanists have restocked.',
    ),
  ],
  'node-ester-road': [
    marker(
      'Ester Road — deserters',
      'Back across the border: rebels and deserters, not soldiers. Subdue them all without a kill for the better outcome.',
    ),
    battle(esterRoadTemplate, 'river_ridge', {
      enemies: lineup(7),
      recordOutcomeAs: 'ester',
      onOutcome: {
        'ester-good': markerScene(
          'Ester Road — yielded',
          'Good outcome: the deserters yield, alive. The flag “ester = ester-good” pays off in a later chapter.',
        ),
        'ester-standard': markerScene(
          'Ester Road — the hard way',
          'Standard outcome: the deserters are cut down. The flag records it.',
        ),
      },
    }),
  ],
  'node-ruk-village': [
    marker(
      'Ruk Village — the finale',
      'The rebel captain holds the village. Subdue HIM — under quarter strength, no rebel deaths — for the better ending.',
    ),
    battle(rukVillageTemplate, 'river_ridge', {
      enemies: [rukCaptain(13), ...lineup(13, 4)],
      recordOutcomeAs: 'ruk',
      onOutcome: {
        'ruk-good': markerScene(
          'Ruk Village — mercy',
          'Good outcome: the captain yields; the village stands whole. The flag “ruk = ruk-good” pays off in a later chapter.',
        ),
        'ruk-standard': markerScene(
          'Ruk Village — the sword’s answer',
          'Standard outcome: the rebellion is put down by force. The flag records it.',
        ),
      },
    }),
  ],
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
