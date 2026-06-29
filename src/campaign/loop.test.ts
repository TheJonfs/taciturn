// TABA campaign — loop transition + bootstrap tests (the pure state machine).

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '@content/index.ts';
import { createInitialState, type GameState, type Unit } from '@engine/index.ts';
import {
  advanceOnWin,
  battleWasWon,
  bootstrapRosterVitals,
  currentNode,
  deployableRoster,
  isComplete,
  startCampaign,
} from './loop.ts';
import { M0_NODE_GRAPH } from './node.ts';
import { foldCampaignRoster } from './snapshot-fold.ts';
import { summarizeBattleResult } from './battle-result.ts';
import { m0Roster } from './roster.ts';
import type { CampaignUnit } from './types.ts';

const catalog = loadDefaultCatalog();
const NODE_A = M0_NODE_GRAPH[0]!;
const NODE_B = M0_NODE_GRAPH[1]!;

// A terminal state for `node`, with `winner` deciding the outcome and the
// first deployed unit forced `lost` (removed) to exercise apply-back.
function terminalState(
  node: typeof NODE_A,
  deployed: ReadonlyArray<CampaignUnit>,
  winner: 'player' | 'enemy',
): GameState {
  const config = foldCampaignRoster(node.template, deployed, node.playerTeam, catalog);
  const state = createInitialState(config, catalog);
  const units = new Map(state.units);
  const lost: Unit = { ...units.get(deployed[0]!.id)!, vitals: { hp: 0, mp: 0 }, removed: true };
  units.set(deployed[0]!.id, lost);
  const enemyTeam = node.template.teams.find((t) => t.id !== node.playerTeam)!.id;
  return {
    ...state,
    units,
    outcome: {
      winner: winner === 'player' ? node.playerTeam : enemyTeam,
      conditionIndex: 0,
      description: 'test',
    },
  };
}

describe('startCampaign + bootstrap', () => {
  it('starts at node A, in progress, with the full roster', () => {
    const state = startCampaign(M0_NODE_GRAPH, m0Roster, catalog);
    expect(state.nodeIndex).toBe(0);
    expect(state.phase).toBe('in_progress');
    expect(state.roster).toHaveLength(m0Roster.length);
  });

  it('bootstraps a roster LARGER than one node deploy cap to effective full', () => {
    // m0Roster (N=8) exceeds node A's slot count (5) — the chunked probe
    // must still heal every unit, and to AT LEAST the provisional base-max.
    expect(m0Roster.length).toBeGreaterThan(NODE_A.deployCap);
    const healed = bootstrapRosterVitals(m0Roster, NODE_A, catalog);
    expect(healed).toHaveLength(m0Roster.length);
    healed.forEach((u, i) => {
      expect(u.vitals.hp).toBeGreaterThanOrEqual(m0Roster[i]!.vitals.hp);
      expect(u.vitals.hp).toBeGreaterThan(0);
    });
  });

  it('produces strictly-higher MP than base for an equipment-boosted caster', () => {
    // At least one bootstrapped unit should gain MP from equipment vs the
    // provisional base-max — proving the bootstrap reads effective (not base)
    // maxes. (Casters carry +MP gear in the source templates.)
    const healed = bootstrapRosterVitals(m0Roster, NODE_A, catalog);
    const gainedMp = healed.some((u, i) => u.vitals.mp > m0Roster[i]!.vitals.mp);
    expect(gainedMp).toBe(true);
  });
});

describe('selectors', () => {
  it('currentNode tracks nodeIndex', () => {
    const a = startCampaign(M0_NODE_GRAPH, m0Roster, catalog);
    expect(currentNode(M0_NODE_GRAPH, a).id).toBe(NODE_A.id);
    expect(currentNode(M0_NODE_GRAPH, { ...a, nodeIndex: 1 }).id).toBe(NODE_B.id);
  });

  it('deployableRoster excludes lost units', () => {
    const state = startCampaign(M0_NODE_GRAPH, m0Roster, catalog);
    const withLost = {
      ...state,
      roster: [{ ...state.roster[0]!, fate: 'lost' as const }, ...state.roster.slice(1)],
    };
    expect(deployableRoster(withLost)).toHaveLength(state.roster.length - 1);
    expect(deployableRoster(withLost).some((u) => u.id === state.roster[0]!.id)).toBe(false);
  });

  it('battleWasWon reads the outcome winner', () => {
    const deployed = m0Roster.slice(0, 3);
    expect(battleWasWon(summarizeBattleResult(terminalState(NODE_A, deployed, 'player')), NODE_A)).toBe(true);
    expect(battleWasWon(summarizeBattleResult(terminalState(NODE_A, deployed, 'enemy')), NODE_A)).toBe(false);
  });
});

describe('advanceOnWin', () => {
  const deployed = m0Roster.slice(0, 3);

  it('advances node A → B, stays in progress, applies the result back', () => {
    const start = startCampaign(M0_NODE_GRAPH, m0Roster, catalog);
    const finalState = terminalState(NODE_A, deployed, 'player');
    const result = summarizeBattleResult(finalState);
    const next = advanceOnWin(start, M0_NODE_GRAPH, result, finalState, catalog);

    expect(next.nodeIndex).toBe(1);
    expect(next.phase).toBe('in_progress');
    // The forced-lost first deployed unit is marked on the durable roster.
    expect(next.roster.find((u) => u.id === deployed[0]!.id)!.fate).toBe('lost');
  });

  it('marks the campaign won after the LAST node', () => {
    const atB = { ...startCampaign(M0_NODE_GRAPH, m0Roster, catalog), nodeIndex: 1 };
    const finalState = terminalState(NODE_B, deployed, 'player');
    const result = summarizeBattleResult(finalState);
    const done = advanceOnWin(atB, M0_NODE_GRAPH, result, finalState, catalog);

    expect(done.nodeIndex).toBe(2);
    expect(done.phase).toBe('won');
    expect(isComplete(done)).toBe(true);
  });
});
