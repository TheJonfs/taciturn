// TABA campaign — result-summarizer tests.
// `summarizeBattleResult` classifies each unit from PUBLIC final state only
// (no catalog): survived / downed / lost (D-D), with final vitals + the
// decided outcome. We craft terminal states from a real folded config.

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '@content/index.ts';
import { createInitialState, teamId, type GameState, type TeamId, type Unit } from '@engine/index.ts';
import { riverRidgeBattle } from '@content/battles/river-ridge-battle.ts';
import { foldCampaignRoster } from './snapshot-fold.ts';
import { summarizeBattleResult } from './battle-result.ts';
import { m0Roster } from './roster.ts';

const catalog = loadDefaultCatalog();
const PLAYER: TeamId = teamId('team_a');
const selection = m0Roster.slice(0, 3);

function initialState(): GameState {
  const config = foldCampaignRoster(riverRidgeBattle, selection, PLAYER, catalog);
  return createInitialState(config, catalog);
}

// Overlay terminal conditions onto a fresh state: set the decided outcome
// and mutate (immutably) the three player units into the three fates.
function terminalState(): GameState {
  const state = initialState();
  const units = new Map(state.units);
  const patch = (id: (typeof selection)[number]['id'], f: (u: Unit) => Unit): void => {
    units.set(id, f(units.get(id)!));
  };
  patch(selection[0]!.id, (u) => ({ ...u, vitals: { ...u.vitals, hp: 12 } })); // survived
  patch(selection[1]!.id, (u) => ({ ...u, vitals: { ...u.vitals, hp: 0 } })); // downed
  patch(selection[2]!.id, (u) => ({ ...u, vitals: { ...u.vitals, hp: 0 }, removed: true })); // lost
  return {
    ...state,
    units,
    outcome: { winner: PLAYER, conditionIndex: 0, description: 'test win' },
  };
}

describe('summarizeBattleResult', () => {
  it('classifies survived / downed / lost from final state (D-D)', () => {
    const result = summarizeBattleResult(terminalState());
    expect(result.units.get(selection[0]!.id)!.outcome).toBe('survived');
    expect(result.units.get(selection[1]!.id)!.outcome).toBe('downed');
    expect(result.units.get(selection[2]!.id)!.outcome).toBe('lost');
  });

  it('lets `removed` win over hp (a removed unit is lost even at hp 0)', () => {
    // The downed and lost units both have hp 0; only the removed one is lost.
    const result = summarizeBattleResult(terminalState());
    expect(result.units.get(selection[1]!.id)!.outcome).toBe('downed');
    expect(result.units.get(selection[2]!.id)!.outcome).toBe('lost');
  });

  it("reports each unit's final vitals verbatim", () => {
    const result = summarizeBattleResult(terminalState());
    expect(result.units.get(selection[0]!.id)!.vitals.hp).toBe(12);
    expect(result.units.get(selection[1]!.id)!.vitals.hp).toBe(0);
  });

  it('summarizes EVERY unit in final state (enemies included; apply-back filters)', () => {
    const state = terminalState();
    const result = summarizeBattleResult(state);
    expect(result.units.size).toBe(state.units.size);
  });

  it('carries the decided outcome through', () => {
    const result = summarizeBattleResult(terminalState());
    expect(result.outcome.winner).toBe(PLAYER);
  });

  it('throws loudly on a non-terminal state (no outcome)', () => {
    expect(() => summarizeBattleResult(initialState())).toThrow(/non-terminal/);
  });
});
