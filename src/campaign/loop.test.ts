// TABA campaign — loop transition + bootstrap tests (the pure state machine).

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '@content/index.ts';
import { createInitialState, type GameState, type Unit } from '@engine/index.ts';
import {
  battleWasWon,
  bootstrapRosterVitals,
  currentNode,
  deployableRoster,
  isComplete,
  resolveWin,
  routeToNode,
  startCampaign,
} from './loop.ts';
import { M1_CAMPAIGN_GRAPH, M1_NODES } from './node.ts';
import { getNode, requireBattle, type CampaignNode } from './graph.ts';
import { foldCampaignRoster } from './snapshot-fold.ts';
import { summarizeBattleResult } from './battle-result.ts';
import { m0Roster } from './roster.ts';
import type { CampaignUnit } from './types.ts';

const catalog = loadDefaultCatalog();
const GRAPH = M1_CAMPAIGN_GRAPH;
const START = getNode(GRAPH, M1_NODES.riverRidge); // the fork node
const TERMINAL = getNode(GRAPH, M1_NODES.theReturn); // no win-edges

// A terminal state for `node`, with `winner` deciding the outcome and the
// first deployed unit forced `lost` (removed) to exercise apply-back.
function terminalState(
  node: CampaignNode,
  deployed: ReadonlyArray<CampaignUnit>,
  winner: 'player' | 'enemy',
): GameState {
  const battle = requireBattle(node);
  const config = foldCampaignRoster(battle.template, deployed, battle.playerTeam, catalog);
  const state = createInitialState(config, catalog);
  const units = new Map(state.units);
  const lost: Unit = { ...units.get(deployed[0]!.id)!, vitals: { hp: 0, mp: 0 }, removed: true };
  units.set(deployed[0]!.id, lost);
  const enemyTeam = battle.template.teams.find((t) => t.id !== battle.playerTeam)!.id;
  return {
    ...state,
    units,
    outcome: {
      winner: winner === 'player' ? battle.playerTeam : enemyTeam,
      conditionIndex: 0,
      description: 'test',
    },
  };
}

describe('startCampaign + bootstrap', () => {
  it('starts at the graph entry node, in progress, with the full roster', () => {
    const state = startCampaign(GRAPH, m0Roster, catalog);
    expect(state.currentNodeId).toBe(GRAPH.startId);
    expect(state.phase).toBe('in_progress');
    expect(state.roster).toHaveLength(m0Roster.length);
  });

  it('bootstraps a roster LARGER than one node deploy cap to effective full', () => {
    // m0Roster (N=8) exceeds the start node's slot count (5) — the chunked
    // probe must still heal every unit, and to AT LEAST the provisional base-max.
    expect(m0Roster.length).toBeGreaterThan(requireBattle(START).deployCap);
    const healed = bootstrapRosterVitals(m0Roster, START, catalog);
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
    const healed = bootstrapRosterVitals(m0Roster, START, catalog);
    const gainedMp = healed.some((u, i) => u.vitals.mp > m0Roster[i]!.vitals.mp);
    expect(gainedMp).toBe(true);
  });
});

describe('selectors', () => {
  it('currentNode resolves the position node id', () => {
    const a = startCampaign(GRAPH, m0Roster, catalog);
    expect(currentNode(GRAPH, a).id).toBe(START.id);
    expect(currentNode(GRAPH, { ...a, currentNodeId: M1_NODES.stonebridge }).id).toBe(
      M1_NODES.stonebridge,
    );
  });

  it('deployableRoster excludes lost units', () => {
    const state = startCampaign(GRAPH, m0Roster, catalog);
    const withLost = {
      ...state,
      roster: [{ ...state.roster[0]!, fate: 'lost' as const }, ...state.roster.slice(1)],
    };
    expect(deployableRoster(withLost)).toHaveLength(state.roster.length - 1);
    expect(deployableRoster(withLost).some((u) => u.id === state.roster[0]!.id)).toBe(false);
  });

  it('battleWasWon reads the outcome winner', () => {
    const deployed = m0Roster.slice(0, 3);
    expect(battleWasWon(summarizeBattleResult(terminalState(START, deployed, 'player')), START)).toBe(
      true,
    );
    expect(battleWasWon(summarizeBattleResult(terminalState(START, deployed, 'enemy')), START)).toBe(
      false,
    );
  });
});

describe('resolveWin', () => {
  const deployed = m0Roster.slice(0, 3);

  it('applies the result back and stays in progress at a non-terminal node', () => {
    const start = startCampaign(GRAPH, m0Roster, catalog);
    const finalState = terminalState(START, deployed, 'player');
    const result = summarizeBattleResult(finalState);
    const resolved = resolveWin(start, GRAPH, result, finalState, catalog);

    // Position does NOT move on resolveWin — it holds at the won node for the
    // interstitial; routeToNode advances it.
    expect(resolved.currentNodeId).toBe(START.id);
    expect(resolved.phase).toBe('in_progress');
    // The forced-lost first deployed unit is marked on the durable roster.
    expect(resolved.roster.find((u) => u.id === deployed[0]!.id)!.fate).toBe('lost');
  });

  it('marks the campaign won after a TERMINAL node', () => {
    const atTerminal = {
      ...startCampaign(GRAPH, m0Roster, catalog),
      currentNodeId: TERMINAL.id,
    };
    const finalState = terminalState(TERMINAL, deployed, 'player');
    const result = summarizeBattleResult(finalState);
    const done = resolveWin(atTerminal, GRAPH, result, finalState, catalog);

    expect(done.currentNodeId).toBe(TERMINAL.id);
    expect(done.phase).toBe('won');
    expect(isComplete(done)).toBe(true);
  });
});

describe('routeToNode', () => {
  it('advances position along a legal win-choice', () => {
    const start = startCampaign(GRAPH, m0Roster, catalog);
    const routed = routeToNode(start, GRAPH, M1_NODES.marshmoor);
    expect(routed.currentNodeId).toBe(M1_NODES.marshmoor);
    // The roster is carried unchanged (resolveWin already healed it).
    expect(routed.roster).toBe(start.roster);
  });

  it('throws on an illegal route (not a win-choice from the current node)', () => {
    const start = startCampaign(GRAPH, m0Roster, catalog);
    // The Return is not directly reachable from the start node.
    expect(() => routeToNode(start, GRAPH, M1_NODES.theReturn)).toThrow(/not a win-choice/);
  });
});
