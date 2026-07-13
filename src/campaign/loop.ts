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
import { getNode, isTerminal, type CampaignGraph, type CampaignNode } from './graph.ts';
import { currentEngagement, isTravelChoice } from './travel.ts';
import { probeBattleFor } from './probe-battle.ts';
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
    visited: [graph.startId],
    clearedStoryBeats: [],
    flags: {},
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
// The probe needs *a* battle template to read equipment-adjusted maxes: the
// start node's own first battle beat when it has one, the canonical probe
// field otherwise (probe-battle.ts — a story-only or market-town start
// bootstraps fine; the template choice can't change the numbers).
export function bootstrapRosterVitals(
  roster: ReadonlyArray<CampaignUnit>,
  node: CampaignNode,
  catalog: Catalog,
): ReadonlyArray<CampaignUnit> {
  const { template, playerTeam } = probeBattleFor(node);
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

// Resolve the current NODE once its CURRENT ENGAGEMENT has fully played
// (every battle beat won, or a story-only engagement finished). Marks that
// engagement CLEARED (the per-beat guard — this beat never replays; clearing
// it opens the edges gated on it and, once nothing is armed, the node's
// farmable/skirmish valve) and sets the phase — POSITION DOES NOT MOVE; it
// holds at the resolved node until routeToNode advances it. A terminal node
// → `won` (campaign complete); a non-terminal node → `awaiting_route` (the
// player picks the next node at the world map). The `awaiting_route` state
// is saved so a reload resumes at the world map rather than replaying the
// engagement. Battle-agnostic: works for a story-only engagement (no
// apply-back ran, roster unchanged) exactly as for a battle one. The state
// passed in is PRE-CLEAR, so `currentEngagement` still names the engagement
// that just played; a queue node's NEXT engagement becomes current only
// after this returns.
export function resolveNode(state: CampaignState, graph: CampaignGraph): CampaignState {
  const node = getNode(graph, state.currentNodeId);
  const played = currentEngagement(state, node);
  if (played === undefined) {
    // Nothing was armed here — the driver resolved a node it never played.
    throw new Error(`resolveNode: node "${node.id}" has no armed engagement to clear`);
  }
  const phase = isTerminal(graph, state.currentNodeId) ? 'won' : 'awaiting_route';
  const clearedStoryBeats = [...state.clearedStoryBeats, played.beatId];
  return { ...state, clearedStoryBeats, phase };
}

// The second half of the win transition: the player picked `nextNodeId` at the
// world map. Validate it is a legal TRAVEL destination — the frontier (a
// cleared node's win-edges: forward progress stays story-gated) or a
// returnable visited node with something on offer (M3 economy: the navigable
// map) — fail loud on an illegal route. Advance position, stamp `visited`,
// and clear `awaiting_route` back to `in_progress`. What happens on arrival
// is ENTRY RESOLUTION (the driver): an armed story beat plays; a cleared
// node offers its current availability instead (never a replay).
export function routeToNode(
  state: CampaignState,
  graph: CampaignGraph,
  nextNodeId: string,
): CampaignState {
  if (!isTravelChoice(graph, state, nextNodeId)) {
    throw new Error(
      `routeToNode: "${nextNodeId}" is not a travel choice from "${state.currentNodeId}"`,
    );
  }
  const visited = state.visited.includes(nextNodeId)
    ? state.visited
    : [...state.visited, nextNodeId];
  return { ...state, currentNodeId: nextNodeId, visited, phase: 'in_progress' };
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
    visited: [startNodeId],
    clearedStoryBeats: [],
    flags: {},
    phase: 'in_progress',
  };
}
