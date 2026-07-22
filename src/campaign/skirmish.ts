// TABA economy — the skirmish valve + the M4 party generator.
//
// A farmable node offers an on-demand, repeatable skirmish (click to fight —
// no random-encounter timer, no anti-farm friction; reload-risk is the
// intended governor). It borrows the node's own battlefield (the first battle
// beat's template/zones/deploy cap) and fights a GENERATED enemy party at the
// node's resolved level, so all three rewards (XP/JP via apply-back, gil via
// the award) scale off the one lever.
//
// M4 replaced the M3 stub (Tier-1 rotation, bare kits, no gear) at the seam:
// the party now rolls its CAST from the node's archetype (archetypes.ts —
// location supplies flavor, level supplies power) and each unit is a full
// composer build (enemy-generation.ts — bought-and-EQUIPPED kit, seeded
// secondary class, level-banded gear via the S89 valuation).
//
// VARIANCE: the seed derives from (node id, skirmish wins at that node) —
// repeat farming meets a different party each WIN, while save-reload never
// rerolls (losses don't advance state, so the reload-risk governor is
// untouched and replays hold). Chris's S99 call.

import { deriveActionSeed, type Catalog, type VictoryCondition } from '@engine/index.ts';
import { archetypeForNode, rollArchetypeClasses, type EnemyArchetype } from './archetypes.ts';
import { generatedEnemyUnit, stringSeed } from './enemy-generation.ts';
import { partyAverageLevel, resolveEnemyLevel } from './enemy-level.ts';
import { getFlag, setFlag } from './flags.ts';
import { allNodeBeats, type CampaignNode } from './graph.ts';
import { firstBattleBeat, type NodeBattle } from './sequence.ts';
import type { CampaignState, CampaignUnit } from './types.ts';

// --- the per-node skirmish counter (the variance stream) --------------------

// Flag key holding how many skirmishes have been WON at a node. Wins only:
// a loss ends at retry without saving, so only wins can advance state — and
// a fresh party per win is exactly the repeat-farm variance wanted.
export function skirmishWinsFlagKey(nodeId: string): string {
  return `skirmish_wins:${nodeId}`;
}

export function skirmishWinsAt(state: CampaignState, nodeId: string): number {
  const value = getFlag(state, skirmishWinsFlagKey(nodeId));
  return typeof value === 'number' ? value : 0;
}

// Bump the counter after a skirmish win (CampaignApp's battle-end flow).
export function recordSkirmishWin(state: CampaignState, nodeId: string): CampaignState {
  return setFlag(state, skirmishWinsFlagKey(nodeId), skirmishWinsAt(state, nodeId) + 1);
}

// The deterministic skirmish seed: node identity branched by fight number.
export function skirmishSeed(nodeId: string, wins: number): number {
  return deriveActionSeed(stringSeed(nodeId), wins);
}

// Per-unit composition streams branch off the party seed (salts 1000+; the
// class rolls use 200+/300+ inside archetypes.ts, gear 100+, pair class 1).
const SALT_UNIT = 1000;

// THE M4 GENERATOR (the S88 seam, cashed in). Roll `count` classes from the
// archetype's pool, then compose each enemy fully: level-budgeted kit bought
// toward a populated loadout, seeded secondary class, level-banded gear.
// Deterministic — same (level, count, seed, archetype) → same party.
export function generateSkirmishParty(
  level: number,
  count: number,
  catalog: Catalog,
  seed: number,
  archetype: EnemyArchetype,
): ReadonlyArray<CampaignUnit> {
  const rolled = rollArchetypeClasses(archetype, count, seed, catalog);
  return rolled.map((cls, i) =>
    generatedEnemyUnit({
      id: `skirmish-enemy-${i + 1}`,
      name: `${archetype.unitNamePrefix} ${catalog.getClass(cls).name}`,
      classId: cls,
      level,
      index: i,
      seed: deriveActionSeed(seed, SALT_UNIT + i),
      catalog,
    }),
  );
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
  const seed = skirmishSeed(node.id, skirmishWinsAt(state, node.id));
  const archetype = archetypeForNode(node.id, seed);
  const enemies = generateSkirmishParty(level, count, catalog, seed, archetype);

  // Keep only the first `count` enemy positions; the fold re-skins exactly
  // those with the generated party (foldEnemyTeam leaves EXTRA slots as
  // authored, so the trim is what guarantees an all-generated opposition).
  const keptEnemySlots = enemySlots.slice(0, count);
  // Guests are story-battle authored (WI4): a skirmish borrowing this
  // battlefield never inherits the story fight's guest allies.
  const players = template.units.filter((u) => u.team === playerTeam && u.guest !== true);
  // A skirmish borrows the node's BATTLEFIELD, never its STORY RULES: the
  // template's authored victory conditions can reference story units that
  // don't exist here (the Theo-node templates' `unit_below_hp` predicate
  // targets plot-theo — the evaluator fails loud on the dangling id; latent
  // since S88, surfaced by the first skirmish at a Theo node). Every
  // skirmish is a plain field fight: the standard defeat-all pair.
  const enemyTeam = template.teams.find((t) => t.id !== playerTeam);
  if (enemyTeam === undefined) {
    throw new Error(`buildSkirmishBattle: node "${node.id}" template has no enemy team`);
  }
  const skirmishConditions: ReadonlyArray<VictoryCondition> = [
    { kind: 'defeat_all', side: enemyTeam.id, description: 'Defeat all enemies' },
    { kind: 'defeat_all', side: playerTeam, description: 'Defeat all enemies' },
  ];
  return {
    template: {
      ...template,
      units: [...players, ...keptEnemySlots],
      victoryConditions: skirmishConditions,
    },
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
