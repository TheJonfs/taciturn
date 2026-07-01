// TABA campaign — the pure loop transitions.
//
// The campaign is a state machine wrapping the pure battle (campaign-
// decomposition §3). This module holds the PURE pieces of that machine —
// start, the win transitions, and the small selectors the UI driver reads.
// Side effects (localStorage, the interactive battle) live in the app layer;
// everything here is testable in isolation.
//
// M1 flow (branching — taba-m1-brief): startCampaign → [node: deploy K-of-N →
//   fight → summarize] →
//   win  → resolveWin (apply-back heals, mark terminal) → interstitial beats
//          (result → world-map choice) → routeToNode (follow the chosen
//          win-edge) → save → next node, or `won` at a terminal node.
//   loss → state UNCHANGED; the driver re-enters the same node (retry from the
//          between-battle autosave, which is exactly this state). No
//          apply-back runs, so a failed attempt is discarded wholesale.
//
// The win is split into resolveWin (apply-back; position holds at the won node
// while its interstitial runs) and routeToNode (the player's map choice
// advances position) — M0's single advanceOnWin couldn't branch because the
// next node wasn't a choice.

import type { Catalog, GameState } from '@engine/index.ts';
import { applyBattleResult } from './apply-back.ts';
import type { BattleResult } from './battle-result.ts';
import {
  getNode,
  isTerminal,
  isWinChoice,
  requireBattle,
  type CampaignGraph,
  type CampaignNode,
} from './graph.ts';
import { probeEffectiveMaxes } from './snapshot-fold.ts';
import { CAMPAIGN_SCHEMA_VERSION } from './serialization.ts';
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
  return {
    schemaVersion: CAMPAIGN_SCHEMA_VERSION,
    roster: bootstrapRosterVitals(roster, start, catalog),
    currentNodeId: graph.startId,
    phase: 'in_progress',
  };
}

// Heal the whole roster to effective full (equipment-composed). The authored
// roster carries PROVISIONAL base-max vitals (catalog-free); this is the
// one-time bootstrap that makes the very first deployment of each unit land
// at true full, the same value apply-back maintains thereafter (D-E). Uses
// the fold's probe, chunked so a roster larger than one node's slot count
// still resolves.
export function bootstrapRosterVitals(
  roster: ReadonlyArray<CampaignUnit>,
  node: CampaignNode,
  catalog: Catalog,
): ReadonlyArray<CampaignUnit> {
  const battle = requireBattle(node);
  const maxes = probeEffectiveMaxes(battle.template, roster, battle.playerTeam, catalog);
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

// Did the player win this battle? (Rout outcome — winner is the player team.)
export function battleWasWon(result: BattleResult, node: CampaignNode): boolean {
  return result.outcome.winner === requireBattle(node).playerTeam;
}

// The first half of the win transition: apply the battle result back to the
// roster (heal survivors/downed, mark lost) and decide whether the won node
// was terminal (campaign complete). POSITION DOES NOT MOVE here — it stays at
// the won node while its interstitial (result summary, then the world-map
// choice) runs; routeToNode advances it once the player picks. Call ONLY on a
// win; a loss leaves the state untouched (retry re-enters the same node).
export function resolveWin(
  state: CampaignState,
  graph: CampaignGraph,
  result: BattleResult,
  finalState: GameState,
  catalog: Catalog,
): CampaignState {
  const roster = applyBattleResult(state.roster, result, finalState, catalog);
  const phase = isTerminal(graph, state.currentNodeId) ? 'won' : 'in_progress';
  return { ...state, roster, phase };
}

// The second half of the win transition: the player picked `nextNodeId` at the
// world map. Validate it is a legal win-choice from the current node (fail
// loud on an illegal route) and advance position to it. The roster already
// carries the resolveWin apply-back; this only moves position.
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
  return { ...state, currentNodeId: nextNodeId };
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
    currentNodeId: startNodeId,
    phase: 'in_progress',
  };
}
