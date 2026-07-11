// TABA campaign — the pure loop transitions.
//
// The campaign is a state machine wrapping the pure battle (campaign-
// decomposition §3). This module holds the PURE pieces of that machine —
// start, the win transitions, and the small selectors the UI driver reads.
// Side effects (localStorage, the interactive battle) live in the app layer;
// everything here is testable in isolation.
//
// M1.5 flow (battle-as-beat — taba-m1_5-brief): startCampaign → [node: walk its
//   authored beat sequence] where each beat is played in turn:
//     story-scene beat → the driver runs the scene (presentational).
//     battle beat      → deploy K-of-N → fight → summarize:
//        win  → applyBattleBeatWin (apply-back heals/marks-lost; PHASE holds)
//               → continue the sequence.
//        loss → state UNCHANGED; retry re-enters the battle (no apply-back, so
//               the failed attempt is discarded wholesale).
//   When the sequence finishes (all battle beats won, or a standalone story
//   node ends) → resolveNode sets phase: `awaiting_route` (non-terminal — pick
//   the next node at the world map) or `won` (terminal). routeToNode follows
//   the chosen win-edge → save → next node.
//
// The node win is split into applyBattleBeatWin (apply-back, once per battle
// beat) and resolveNode (phase, once per node) — M1's single resolveWin fused
// them because a node had exactly one battle. routeToNode (the player's map
// choice advances position) stays separate — M0's single advanceOnWin couldn't
// branch because the next node wasn't a choice.

import type { Catalog, GameState, TeamId } from '@engine/index.ts';
import { applyBattleResult } from './apply-back.ts';
import type { BattleResult } from './battle-result.ts';
import { STARTING_GIL } from './economy-config.ts';
import { computeGilReward, grantGil } from './gil.ts';
import {
  getNode,
  isTerminal,
  isWinChoice,
  type CampaignGraph,
  type CampaignNode,
} from './graph.ts';
import { firstBattleBeat } from './sequence.ts';
import { probeEffectiveMaxes } from './snapshot-fold.ts';
import { CAMPAIGN_SCHEMA_VERSION } from './serialization.ts';
import { EMPTY_INVENTORY, bootstrapInventory } from './inventory.ts';
import { COMPONENT_CATALOG, seedStartingKit } from './progression/index.ts';
import type { CampaignState, CampaignUnit } from './types.ts';

// Start a fresh campaign at the graph's entry node, normalizing the authored
// roster's provisional vitals to effective full (the bootstrap — see
// bootstrapRosterVitals). The single place `schemaVersion` is stamped onto a
// new run.
export function startCampaign(
  graph: CampaignGraph,
  roster: ReadonlyArray<CampaignUnit>,
  catalog: Catalog,
): CampaignState {
  const start = getNode(graph, graph.startId);
  const seeded = seedRosterStartingKits(roster, catalog);
  const bootstrapped = bootstrapRosterVitals(seeded, start, catalog);
  return {
    schemaVersion: CAMPAIGN_SCHEMA_VERSION,
    roster: bootstrapped,
    // Day-one gear is owned by the party (grandfathered): the inventory
    // starts at exactly the equipped counts, so unequipping authored gear
    // returns it to the pool. Receipt (shops/drops/dev seed) adds on top.
    inventory: bootstrapInventory(EMPTY_INVENTORY, bootstrapped),
    gil: STARTING_GIL,
    currentNodeId: graph.startId,
    phase: 'in_progress',
  };
}

// Pre-unlock each fresh authored unit's starting kit from its loadout (TABA M2
// gating-live migration). Runs ONCE at campaign start (with the catalog
// available) so an authored unit's equipped abilities are usable when the fold
// stamps the usable-ability allowlists. Units that already carry authored
// progression (plot-uniques with pre-set unlocks/JP) are left untouched.
export function seedRosterStartingKits(
  roster: ReadonlyArray<CampaignUnit>,
  catalog: Catalog,
): ReadonlyArray<CampaignUnit> {
  return roster.map((unit) => {
    if (unit.unlocks.length > 0 || Object.keys(unit.earnedByClass).length > 0) return unit;
    const kit = seedStartingKit(unit.classId, unit.loadout, catalog, COMPONENT_CATALOG);
    return { ...unit, unlocks: kit.unlocks, earnedByClass: kit.earnedByClass };
  });
}

// Heal the whole roster to effective full (equipment-composed). The authored
// roster carries PROVISIONAL base-max vitals (catalog-free); this is the
// one-time bootstrap that makes the very first deployment of each unit land
// at true full, the same value apply-back maintains thereafter (D-E). Uses
// the fold's probe, chunked so a roster larger than one node's slot count
// still resolves.
//
// The probe needs *a* battle template to read equipment-adjusted maxes; it
// uses the start node's FIRST battle beat. A standalone story start node has
// none — bootstrap fails loud (M1.5's start is a battle node). A future
// story-only start would need a template source passed explicitly.
export function bootstrapRosterVitals(
  roster: ReadonlyArray<CampaignUnit>,
  node: CampaignNode,
  catalog: Catalog,
): ReadonlyArray<CampaignUnit> {
  const first = firstBattleBeat(node.beats);
  if (first === undefined) {
    throw new Error(
      `bootstrapRosterVitals: start node "${node.id}" has no battle beat to probe effective maxes from`,
    );
  }
  const { template, playerTeam } = first.battle;
  const maxes = probeEffectiveMaxes(template, roster, playerTeam, catalog);
  return roster.map((unit) => ({ ...unit, vitals: maxes.get(unit.id)! }));
}

// The node the campaign is currently at. Throws on an unknown id (a
// graph/position bug — getNode fails loud).
export function currentNode(graph: CampaignGraph, state: CampaignState): CampaignNode {
  return getNode(graph, state.currentNodeId);
}

// The roster units eligible to deploy: `active` only (`lost` units are
// retained on the roster but dropped from selection — D-D).
export function deployableRoster(state: CampaignState): ReadonlyArray<CampaignUnit> {
  return state.roster.filter((u) => u.fate === 'active');
}

// Did the player win this battle beat? (Rout outcome — winner is the battle
// beat's player team.)
export function battleWasWon(result: BattleResult, playerTeam: TeamId): boolean {
  return result.outcome.winner === playerTeam;
}

// Apply a single battle-beat WIN back to the roster: heal survivors/downed to
// effective full, mark lost — and pay the battle's gil award into the wallet
// (M3 economy Stage 0; XP/JP ride the apply-back inside applyBattleResult, so
// this is where ALL THREE rewards land, for story and skirmish alike). PHASE
// IS UNTOUCHED — the NODE resolves separately (resolveNode), once its whole
// beat sequence has played. Under battle-as-beat a node may hold several
// battle beats; this runs after each winning one so the next beat sees the
// healed/thinned roster. Call ONLY on a win; a loss leaves state untouched
// (retry re-enters the battle) and pays nothing.
export function applyBattleBeatWin(
  state: CampaignState,
  result: BattleResult,
  finalState: GameState,
  catalog: Catalog,
  playerTeam: TeamId,
): CampaignState {
  const roster = applyBattleResult(state.roster, result, finalState, catalog);
  return grantGil({ ...state, roster }, computeGilReward(finalState, playerTeam));
}

// Resolve the current NODE once its beat sequence has fully played (every
// battle beat won, or a standalone story node finished). Sets the phase and
// nothing else — POSITION DOES NOT MOVE; it holds at the resolved node until
// routeToNode advances it. A terminal node → `won` (campaign complete); a
// non-terminal node → `awaiting_route` (the player picks the next node at the
// world map). The `awaiting_route` state is saved so a reload resumes at the
// world map rather than replaying the node. Battle-agnostic: works for a
// standalone story node (no apply-back ran, roster unchanged) exactly as for a
// battle node.
export function resolveNode(state: CampaignState, graph: CampaignGraph): CampaignState {
  const phase = isTerminal(graph, state.currentNodeId) ? 'won' : 'awaiting_route';
  return { ...state, phase };
}

// The second half of the win transition: the player picked `nextNodeId` at the
// world map. Validate it is a legal win-choice from the current node (fail
// loud on an illegal route), advance position to it, and clear `awaiting_route`
// back to `in_progress` (about to fight the chosen node). The roster already
// carries the applyBattleBeatWin apply-back; this only moves position + phase.
export function routeToNode(
  state: CampaignState,
  graph: CampaignGraph,
  nextNodeId: string,
): CampaignState {
  if (!isWinChoice(graph, state.currentNodeId, nextNodeId)) {
    throw new Error(
      `routeToNode: "${nextNodeId}" is not a win-choice from "${state.currentNodeId}"`,
    );
  }
  return { ...state, currentNodeId: nextNodeId, phase: 'in_progress' };
}

export function isComplete(state: CampaignState): boolean {
  return state.phase === 'won';
}

// Wrap an already-prepared roster into a fresh `CampaignState` at `startNodeId`
// WITHOUT the vitals bootstrap. `startCampaign` is the real entry (it
// bootstraps); this is the catalog-free factory used where vitals don't matter
// (serialization round-trips, tests).
export function newCampaign(
  roster: ReadonlyArray<CampaignUnit>,
  startNodeId: string,
): CampaignState {
  return {
    schemaVersion: CAMPAIGN_SCHEMA_VERSION,
    roster,
    inventory: bootstrapInventory(EMPTY_INVENTORY, roster),
    gil: STARTING_GIL,
    currentNodeId: startNodeId,
    phase: 'in_progress',
  };
}
