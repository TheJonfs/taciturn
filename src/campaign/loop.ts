// TABA campaign — the pure loop transitions.
//
// The campaign is a state machine wrapping the pure battle (campaign-
// decomposition §3). This module holds the PURE pieces of that machine —
// start, the win-advance transition, and the small selectors the UI driver
// (Chunk 3's React layer) reads. Side effects (localStorage, the
// interactive battle) live in the app layer; everything here is testable in
// isolation.
//
// Flow: startCampaign → [node: deploy K-of-N → fight → summarize] →
//   win  → advanceOnWin (apply-back heals, nodeIndex++, phase) → save →
//          next node, or `won` past the last node.
//   loss → state UNCHANGED; the UI re-enters the same node (retry from the
//          between-battle autosave, which is exactly this state). No
//          apply-back runs, so a failed attempt is discarded wholesale.

import type { Catalog, GameState } from '@engine/index.ts';
import { applyBattleResult } from './apply-back.ts';
import type { BattleResult } from './battle-result.ts';
import type { CampaignNode } from './node.ts';
import { probeEffectiveMaxes } from './snapshot-fold.ts';
import { CAMPAIGN_SCHEMA_VERSION } from './serialization.ts';
import type { CampaignState, CampaignUnit } from './types.ts';

// Start a fresh campaign at node A, normalizing the authored roster's
// provisional vitals to effective full (the bootstrap — see
// bootstrapRosterVitals). The single place `schemaVersion` is stamped onto
// a new run.
export function startCampaign(
  graph: ReadonlyArray<CampaignNode>,
  roster: ReadonlyArray<CampaignUnit>,
  catalog: Catalog,
): CampaignState {
  const first = graph[0];
  if (first === undefined) throw new Error('startCampaign: empty node graph');
  return {
    schemaVersion: CAMPAIGN_SCHEMA_VERSION,
    roster: bootstrapRosterVitals(roster, first, catalog),
    nodeIndex: 0,
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
  const maxes = probeEffectiveMaxes(node.template, roster, node.playerTeam, catalog);
  return roster.map((unit) => ({ ...unit, vitals: maxes.get(unit.id)! }));
}

// The node the campaign is currently at. Throws past the end (a completed
// campaign has no current node — check `isComplete` first).
export function currentNode(
  graph: ReadonlyArray<CampaignNode>,
  state: CampaignState,
): CampaignNode {
  const node = graph[state.nodeIndex];
  if (node === undefined) {
    throw new Error(
      `currentNode: nodeIndex ${state.nodeIndex} is out of range for a ${graph.length}-node graph`,
    );
  }
  return node;
}

// The roster units eligible to deploy: `active` only (`lost` units are
// retained on the roster but dropped from selection — D-D).
export function deployableRoster(state: CampaignState): ReadonlyArray<CampaignUnit> {
  return state.roster.filter((u) => u.fate === 'active');
}

// Did the player win this battle? (Rout outcome — winner is the player team.)
export function battleWasWon(result: BattleResult, node: CampaignNode): boolean {
  return result.outcome.winner === node.playerTeam;
}

// The win transition: apply the battle result back to the roster (heal
// survivors/downed, mark lost), advance to the next node, and decide
// whether the campaign is now complete. Call ONLY on a win; a loss leaves
// the state untouched (retry re-enters the same node).
export function advanceOnWin(
  state: CampaignState,
  graph: ReadonlyArray<CampaignNode>,
  result: BattleResult,
  finalState: GameState,
  catalog: Catalog,
): CampaignState {
  const roster = applyBattleResult(state.roster, result, finalState, catalog);
  const nodeIndex = state.nodeIndex + 1;
  const phase = nodeIndex >= graph.length ? 'won' : 'in_progress';
  return { ...state, roster, nodeIndex, phase };
}

export function isComplete(state: CampaignState): boolean {
  return state.phase === 'won';
}

// Wrap an already-prepared roster into a fresh node-A `CampaignState`
// WITHOUT the vitals bootstrap. `startCampaign` is the real entry (it
// bootstraps); this is the catalog-free factory used where vitals don't
// matter (serialization round-trips, tests).
export function newCampaign(roster: ReadonlyArray<CampaignUnit>): CampaignState {
  return {
    schemaVersion: CAMPAIGN_SCHEMA_VERSION,
    roster,
    nodeIndex: 0,
    phase: 'in_progress',
  };
}
