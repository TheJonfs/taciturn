// TABA campaign — loop transition + bootstrap tests (the pure state machine).

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '@content/index.ts';
import { createInitialState, type GameState, type Unit } from '@engine/index.ts';
import {
  applyBattleBeatWin,
  battleWasWon,
  bootstrapRosterVitals,
  currentNode,
  deployableRoster,
  isComplete,
  resolveNode,
  routeToNode,
  startCampaign,
} from './loop.ts';
import { CAMPAIGN_GRAPH, CAMPAIGN_NODES } from './node.ts';
import { allNodeBeats, getNode, type CampaignNode } from './graph.ts';
import { firstBattleBeat, type NodeBattle } from './sequence.ts';
import { foldCampaignRoster } from './snapshot-fold.ts';
import { summarizeBattleResult } from './battle-result.ts';
import { GIL_PER_ENEMY_LEVEL, STARTING_GIL } from './economy-config.ts';
import { m0Roster } from './roster.ts';
import type { CampaignUnit } from './types.ts';

const catalog = loadDefaultCatalog();
const GRAPH = CAMPAIGN_GRAPH;
const START = getNode(GRAPH, CAMPAIGN_NODES.zarghidas); // battle-less hub start (probe fallback)
const FIRST_BATTLE = getNode(GRAPH, CAMPAIGN_NODES.oskun); // the first battle node
const TERMINAL = getNode(GRAPH, CAMPAIGN_NODES.rukVillage); // no win-edges

// The (single) battle a node's beat sequence launches.
const battleOf = (node: CampaignNode): NodeBattle => firstBattleBeat(allNodeBeats(node))!.battle;

// A terminal state for `node`, with `winner` deciding the outcome and the
// first deployed unit forced `lost` (removed) to exercise apply-back.
function terminalState(
  node: CampaignNode,
  deployed: ReadonlyArray<CampaignUnit>,
  winner: 'player' | 'enemy',
): GameState {
  const battle = battleOf(node);
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
    expect(state.gil).toBe(STARTING_GIL);
  });

  it('bootstraps a roster LARGER than one node deploy cap to effective full', () => {
    // m0Roster (N=8) exceeds the start node's slot count (5) — the chunked
    // probe must still heal every unit, and to AT LEAST the provisional base-max.
    expect(m0Roster.length).toBeGreaterThan(battleOf(FIRST_BATTLE).deployCap);
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
    expect(currentNode(GRAPH, { ...a, currentNodeId: CAMPAIGN_NODES.oskun }).id).toBe(
      CAMPAIGN_NODES.oskun,
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

  it('battleWasWon reads the outcome winner against the battle-beat player team', () => {
    const deployed = m0Roster.slice(0, 3);
    const team = battleOf(FIRST_BATTLE).playerTeam;
    expect(battleWasWon(summarizeBattleResult(terminalState(FIRST_BATTLE, deployed, 'player')), team)).toBe(
      true,
    );
    expect(battleWasWon(summarizeBattleResult(terminalState(FIRST_BATTLE, deployed, 'enemy')), team)).toBe(
      false,
    );
  });
});

describe('applyBattleBeatWin + resolveNode', () => {
  const deployed = m0Roster.slice(0, 3);

  it('applyBattleBeatWin applies the result back but does NOT move the phase', () => {
    const start = startCampaign(GRAPH, m0Roster, catalog);
    const finalState = terminalState(FIRST_BATTLE, deployed, 'player');
    const result = summarizeBattleResult(finalState);
    const applied = applyBattleBeatWin(start, result, finalState, catalog, battleOf(FIRST_BATTLE).playerTeam);

    // Apply-back heals/marks-lost; phase holds (the NODE resolves separately).
    expect(applied.phase).toBe('in_progress');
    expect(applied.currentNodeId).toBe(START.id);
    // The forced-lost first deployed unit is marked on the durable roster.
    expect(applied.roster.find((u) => u.id === deployed[0]!.id)!.fate).toBe('lost');
  });

  it('applyBattleBeatWin pays the gil award: X × Σ(enemy levels) (M3 economy Stage 0)', () => {
    const start = startCampaign(GRAPH, m0Roster, catalog);
    const finalState = terminalState(FIRST_BATTLE, deployed, 'player');
    const playerTeam = battleOf(FIRST_BATTLE).playerTeam;
    const applied = applyBattleBeatWin(start, summarizeBattleResult(finalState), finalState, catalog, playerTeam);

    let enemyLevels = 0;
    for (const u of finalState.units.values()) {
      if (u.team !== playerTeam) enemyLevels += u.level;
    }
    expect(enemyLevels).toBeGreaterThan(0); // the fixture really has enemies
    expect(applied.gil).toBe(start.gil + GIL_PER_ENEMY_LEVEL * enemyLevels);
  });

  it('resolveNode enters awaiting_route at a non-terminal node (position holds)', () => {
    const start = startCampaign(GRAPH, m0Roster, catalog);
    const resolved = resolveNode(start, GRAPH);
    // Position does NOT move — it holds at the resolved node, now choosing next;
    // routeToNode advances it. This is the state saved right after the battle.
    expect(resolved.currentNodeId).toBe(START.id);
    expect(resolved.phase).toBe('awaiting_route');
    expect(isComplete(resolved)).toBe(false);
  });

  it('resolveNode marks the campaign won at a TERMINAL node', () => {
    const atTerminal = { ...startCampaign(GRAPH, m0Roster, catalog), currentNodeId: TERMINAL.id };
    const done = resolveNode(atTerminal, GRAPH);
    expect(done.currentNodeId).toBe(TERMINAL.id);
    expect(done.phase).toBe('won');
    expect(isComplete(done)).toBe(true);
  });

  it("resolveNode stamps the just-cleared hub's own stock as seen (S95 WI2)", () => {
    // Clearing Zarghidas unlocks its starter kit while the party stands
    // there — leaving must not badge the shop they were just in.
    const resolved = resolveNode(startCampaign(GRAPH, m0Roster, catalog), GRAPH);
    expect(resolved.shopStockSeen?.[CAMPAIGN_NODES.zarghidas]).toContain('iron_sword');
  });

  it('resolveNode works for a battle-less standalone node (no apply-back ran)', () => {
    // Zelmonia Castle is a standalone story node; it still resolves + routes.
    const atCrossing = { ...startCampaign(GRAPH, m0Roster, catalog), currentNodeId: CAMPAIGN_NODES.zelmoniaCastle };
    const resolved = resolveNode(atCrossing, GRAPH);
    expect(resolved.phase).toBe('awaiting_route');
    expect(resolved.roster).toBe(atCrossing.roster); // unchanged — no battle
  });
});

describe('routeToNode', () => {
  it('advances position along a legal win-choice and clears awaiting_route', () => {
    // Simulate the real sequence: a resolved (awaiting_route, beat-cleared)
    // state, then pick — resolveNode is what opens the node's win-edges.
    const awaiting = resolveNode(startCampaign(GRAPH, m0Roster, catalog), GRAPH);
    const routed = routeToNode(awaiting, GRAPH, CAMPAIGN_NODES.oskun);
    expect(routed.currentNodeId).toBe(CAMPAIGN_NODES.oskun);
    expect(routed.phase).toBe('in_progress'); // ready to fight the chosen node
    // Travel stamps the destination as visited (M3 economy Stage 1).
    expect(routed.visited).toContain(CAMPAIGN_NODES.oskun);
    // The roster is carried unchanged (applyBattleBeatWin already healed it).
    expect(routed.roster).toBe(awaiting.roster);
  });

  it('throws on an illegal route (not a travel choice)', () => {
    const start = startCampaign(GRAPH, m0Roster, catalog);
    // The finale is not reachable from an uncleared start node.
    expect(() => routeToNode(start, GRAPH, CAMPAIGN_NODES.rukVillage)).toThrow(/not a travel choice/);
  });

  it('allows RETURN travel to a visited, cleared node with availability (M3 Stage 1)', () => {
    // Clear the start (a hub), advance to Oskun — then travel BACK to it.
    const cleared = resolveNode(startCampaign(GRAPH, m0Roster, catalog), GRAPH);
    const atOskun = routeToNode(cleared, GRAPH, CAMPAIGN_NODES.oskun);
    const back = routeToNode(atOskun, GRAPH, CAMPAIGN_NODES.zarghidas);
    expect(back.currentNodeId).toBe(CAMPAIGN_NODES.zarghidas);
    // …and its cleared beat STAYS cleared (re-entry must not replay it).
    expect(back.clearedStoryBeats).toContain(CAMPAIGN_NODES.zarghidas);
  });

  it("routeToNode restamps the arrival hub's stock as seen (S95 WI2)", () => {
    // Erase the seen record, then walk back to Zarghidas — arrival stamps it.
    const cleared = resolveNode(startCampaign(GRAPH, m0Roster, catalog), GRAPH);
    const atOskun = { ...routeToNode(cleared, GRAPH, CAMPAIGN_NODES.oskun), shopStockSeen: {} };
    const back = routeToNode(atOskun, GRAPH, CAMPAIGN_NODES.zarghidas);
    expect(back.shopStockSeen?.[CAMPAIGN_NODES.zarghidas]).toContain('iron_sword');
  });

  it('refuses travel to a visited DEAD node (no hub, no valve — Old Ordal)', () => {
    const state = {
      ...startCampaign(GRAPH, m0Roster, catalog),
      currentNodeId: CAMPAIGN_NODES.mountEska,
      visited: [CAMPAIGN_NODES.oldOrdal, CAMPAIGN_NODES.mountEska],
      clearedStoryBeats: [CAMPAIGN_NODES.oldOrdal],
    };
    expect(() => routeToNode(state, GRAPH, CAMPAIGN_NODES.oldOrdal)).toThrow(/not a travel choice/);
  });
});
