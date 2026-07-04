// TABA campaign — apply-back tests.
// Closes the spine's return leg: survived/downed heal to effective full and
// stay `active`; lost is marked (record retained); benched units (no battle
// summary) pass through untouched; matching is by STABLE id (player-side
// only). The heal target is the catalog-aware effective max.

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '@content/index.ts';
import {
  createInitialState,
  teamId,
  type Action,
  type GameState,
  type TeamId,
  type Unit,
  type UnitId,
} from '@engine/index.ts';
import { DEFAULT_JP_PER_CONNECTING_ACTION } from './progression/index.ts';
import { riverRidgeBattle } from '@content/battles/river-ridge-battle.ts';
import { applyBattleResult } from './apply-back.ts';
import { summarizeBattleResult } from './battle-result.ts';
import { foldCampaignRoster } from './snapshot-fold.ts';
import { effectiveMaxVitals } from './vitals.ts';
import { m0Roster } from './roster.ts';
import type { CampaignUnit } from './types.ts';

const catalog = loadDefaultCatalog();
const PLAYER: TeamId = teamId('team_a');

// Three deployed units (wounded going in, to prove the heal) + one benched.
const deployed: ReadonlyArray<CampaignUnit> = m0Roster.slice(0, 3).map((u) => ({
  ...u,
  vitals: { hp: 1, mp: 0 },
}));
const benched: CampaignUnit = { ...m0Roster[3]!, vitals: { hp: 5, mp: 5 } };
const roster: ReadonlyArray<CampaignUnit> = [...deployed, benched];

function terminalState(): GameState {
  const config = foldCampaignRoster(riverRidgeBattle, deployed, PLAYER, catalog);
  const state = createInitialState(config, catalog);
  const units = new Map(state.units);
  const patch = (id: CampaignUnit['id'], f: (u: Unit) => Unit): void => {
    units.set(id, f(units.get(id)!));
  };
  patch(deployed[0]!.id, (u) => ({ ...u, vitals: { ...u.vitals, hp: 9 } })); // survived
  patch(deployed[1]!.id, (u) => ({ ...u, vitals: { ...u.vitals, hp: 0 } })); // downed
  patch(deployed[2]!.id, (u) => ({ ...u, vitals: { ...u.vitals, hp: 0 }, removed: true })); // lost
  return {
    ...state,
    units,
    outcome: { winner: PLAYER, conditionIndex: 0, description: 'test' },
  };
}

describe('applyBattleResult', () => {
  it('heals survived and downed units to effective full, keeps them active (D-E)', () => {
    const finalState = terminalState();
    const result = summarizeBattleResult(finalState);
    const updated = applyBattleResult(roster, result, finalState, catalog);

    for (const idx of [0, 1]) {
      const before = deployed[idx]!;
      const after = updated.find((u) => u.id === before.id)!;
      const full = effectiveMaxVitals(finalState, catalog, finalState.units.get(before.id)!);
      expect(after.fate).toBe('active');
      expect(after.vitals).toEqual(full);
      expect(after.vitals.hp).toBeGreaterThan(before.vitals.hp); // actually healed
    }
  });

  it('marks the lost unit `lost` and RETAINS the record (not deleted, D-D)', () => {
    const finalState = terminalState();
    const result = summarizeBattleResult(finalState);
    const updated = applyBattleResult(roster, result, finalState, catalog);

    const lost = updated.find((u) => u.id === deployed[2]!.id);
    expect(lost).toBeDefined(); // still on the roster
    expect(lost!.fate).toBe('lost');
    // Roster length is preserved — nothing dropped here (Formation drops
    // `lost` units from the next DEPLOY selection, not from the roster).
    expect(updated).toHaveLength(roster.length);
  });

  it('passes benched units (no battle summary) through untouched', () => {
    const finalState = terminalState();
    const result = summarizeBattleResult(finalState);
    const updated = applyBattleResult(roster, result, finalState, catalog);

    const after = updated.find((u) => u.id === benched.id)!;
    expect(after).toEqual(benched); // identical — didn't fight
  });

  it('banks per-action JP into survived/downed ledgers, but NOT the lost unit', () => {
    // A connecting use_ability by a unit; only actorId/isReaction/outcome are
    // read by the earning walk, so we build just those.
    const connect = (actor: UnitId, seq: number): Action =>
      ({
        sequenceNumber: seq,
        source: { kind: 'player' },
        actorId: actor,
        timestamp: { tick: 0, ct: 0 },
        seed: 0,
        chainDepth: 0,
        isReaction: false,
        type: 'use_ability',
        payload: {},
        outcome: { kind: 'use_ability', perTargetResults: [{ hit: true }] },
      }) as unknown as Action;

    const base = terminalState();
    const finalState: GameState = {
      ...base,
      actionLog: [
        connect(deployed[0]!.id, 0), // survived — two connecting actions
        connect(deployed[0]!.id, 1),
        connect(deployed[1]!.id, 2), // downed — one
        connect(deployed[2]!.id, 3), // lost — one (must NOT bank)
      ],
    };
    const result = summarizeBattleResult(finalState);
    const updated = applyBattleResult(roster, result, finalState, catalog);

    const R = DEFAULT_JP_PER_CONNECTING_ACTION;
    const earnedOf = (id: CampaignUnit['id']): number =>
      updated.find((u) => u.id === id)!.jpLedger.earned;
    expect(earnedOf(deployed[0]!.id)).toBe(2 * R); // survived banks
    expect(earnedOf(deployed[1]!.id)).toBe(1 * R); // downed banks
    expect(earnedOf(deployed[2]!.id)).toBe(0); // lost banks nothing
    expect(updated.find((u) => u.id === deployed[2]!.id)!.fate).toBe('lost');
  });

  it('ignores enemy final-state units (player-side only, matched by id)', () => {
    const finalState = terminalState();
    const result = summarizeBattleResult(finalState);
    // The result summarized enemies too, but apply-back only touches roster
    // ids — the returned roster has exactly the roster's units, no enemies.
    const updated = applyBattleResult(roster, result, finalState, catalog);
    expect(updated.map((u) => u.id).sort()).toEqual(roster.map((u) => u.id).sort());
  });
});
