// TABA economy — the skirmish valve + its STUB party generator (M3 Stage 1).
//
// A farmable node offers an on-demand, repeatable skirmish (click to fight —
// no random-encounter timer, no anti-farm friction; reload-risk is the
// intended governor). It borrows the node's own battlefield (the first battle
// beat's template/zones/deploy cap) and fights a GENERATED enemy party at the
// node's resolved level, so all three rewards (XP/JP via apply-back, gil via
// the award) scale off the one lever.
//
// `generateSkirmishParty` IS THE SEAM (brief D3): the stub below spawns N
// generics of simple Tier-1 classes at the resolved level, each with its
// class's standard starting kit and NO equipment ("plain gear" — also keeps
// effect weapons off enemy loadouts, the standing AI-valuation deferral).
// M4's real generator replaces this function at this signature; nothing else
// moves.

import { EMPTY_UNIT_EQUIPMENT, bucketId, classId, type Catalog, type ClassId, type Loadout } from '@engine/index.ts';
import { authoredEnemy } from './authored-enemy.ts';
import { partyAverageLevel, resolveEnemyLevel } from './enemy-level.ts';
import { allNodeBeats, type CampaignNode } from './graph.ts';
import { COMPONENT_CATALOG, seedStartingKit } from './progression/index.ts';
import { firstBattleBeat, type NodeBattle } from './sequence.ts';
import type { CampaignState, CampaignUnit } from './types.ts';

// The stub's class rotation — simple Tier-1 classes only (brief D3). A
// party of N takes the first N in order, so small parties skew physical
// and larger ones round out with the mage line.
const STUB_CLASS_ROTATION: ReadonlyArray<ClassId> = [
  classId('monk'),
  classId('fire_mage'),
  classId('hunter'),
  classId('water_mage'),
  classId('alchemist'),
  classId('earth_mage'),
];

// Throwaway flavor names, rotation-aligned (index-matched to the classes).
const STUB_NAMES: ReadonlyArray<string> = [
  'Wayside Brawler',
  'Hedge Pyromancer',
  'Poacher',
  'Fen Hydrologist',
  'Roadside Tinker',
  'Dust Geosage',
];

// THE M4 SEAM. Generate the skirmish's enemy party: `count` generics at
// `level`, Tier-1 classes, standard class kits, no gear. Deterministic —
// same inputs, same party (the repeat-farm variance lever belongs to the
// real generator, not the stub).
export function generateSkirmishParty(
  level: number,
  count: number,
  catalog: Catalog,
): ReadonlyArray<CampaignUnit> {
  return Array.from({ length: count }, (_, i) => {
    const cls = STUB_CLASS_ROTATION[i % STUB_CLASS_ROTATION.length]!;
    // The class's first-action command set is its whole stub loadout; the
    // starting kit derives the matching unlocks so its actives are usable.
    const loadout: Loadout = {
      actionBuckets: { [bucketId('first_action')]: [catalog.getClass(cls).firstActionCommandSet] },
      passiveBuckets: {},
    };
    const kit = seedStartingKit(cls, loadout, catalog, COMPONENT_CATALOG);
    return authoredEnemy({
      id: `skirmish-enemy-${i + 1}`,
      name: STUB_NAMES[i % STUB_NAMES.length]!,
      classId: cls,
      level,
      loadout,
      equipment: EMPTY_UNIT_EQUIPMENT,
      unlocks: kit.unlocks,
    });
  });
}

// Build the skirmish encounter for a farmable node: the node's own
// battlefield with the template's authored enemies REPLACED by the generated
// party (extra authored enemy slots are dropped — a skirmish fights exactly
// the generated party, never leftover story enemies). Party size N =
// min(deploy cap, authored enemy positions) — the map only has so many
// places to stand. Throws on a node with no battle beat (not farmable by
// construction — see `isFarmableNow`).
export function buildSkirmishBattle(
  node: CampaignNode,
  state: CampaignState,
  catalog: Catalog,
): NodeBattle {
  const beat = firstBattleBeat(allNodeBeats(node));
  if (beat === undefined) {
    throw new Error(`buildSkirmishBattle: node "${node.id}" has no battle beat to borrow a battlefield from`);
  }
  const { template, playerTeam, zones, deployCap } = beat.battle;

  const enemySlots = template.units.filter((u) => u.team !== playerTeam);
  if (enemySlots.length === 0) {
    throw new Error(`buildSkirmishBattle: node "${node.id}" template authors no enemy positions`);
  }
  const count = Math.min(deployCap, enemySlots.length);

  const level = resolveEnemyLevel(partyAverageLevel(state.roster), node.offset ?? 0);
  const enemies = generateSkirmishParty(level, count, catalog);

  // Keep only the first `count` enemy positions; the fold re-skins exactly
  // those with the generated party (foldEnemyTeam leaves EXTRA slots as
  // authored, so the trim is what guarantees an all-generated opposition).
  const keptEnemySlots = enemySlots.slice(0, count);
  // Guests are story-battle authored (WI4): a skirmish borrowing this
  // battlefield never inherits the story fight's guest allies.
  const players = template.units.filter((u) => u.team === playerTeam && u.guest !== true);
  return {
    template: { ...template, units: [...players, ...keptEnemySlots] },
    playerTeam,
    zones,
    deployCap,
    enemies,
  };
}

// The level a skirmish AT this node resolves to right now (the location menu
// shows it so the player can price the fight before committing).
export function skirmishLevelAt(node: CampaignNode, state: CampaignState): number {
  return resolveEnemyLevel(partyAverageLevel(state.roster), node.offset ?? 0);
}
