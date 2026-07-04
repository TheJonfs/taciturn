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
import { defaultJpBase } from './progression/index.ts';
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

  it('banks per-action JP per current class, with roster spillover, excluding lost', () => {
    // One connecting use_ability by the survived unit. The earning walk reads
    // only actorId/isReaction/outcome, so we build just those.
    const connect = (actor: UnitId): Action =>
      ({
        sequenceNumber: 0,
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

    const finalState: GameState = { ...terminalState(), actionLog: [connect(deployed[0]!.id)] };
    const updated = applyBattleResult(roster, summarizeBattleResult(finalState), finalState, catalog);

    const base = defaultJpBase(deployed[0]!.level); // actor's share at L25 = 16
    const share = Math.floor(base / 8); // spillover to every other roster unit = 2
    const jpIn = (u: CampaignUnit): number => u.earnedByClass[u.classId] ?? 0;
    const find = (id: CampaignUnit['id']): CampaignUnit => updated.find((u) => u.id === id)!;

    // Actor (survived) banks the full base into ITS current class.
    expect(jpIn(find(deployed[0]!.id))).toBe(base);
    // Downed unit banks the spillover share.
    expect(jpIn(find(deployed[1]!.id))).toBe(share);
    // Benched unit (never fought) still banks the spillover share.
    expect(jpIn(find(benched.id))).toBe(share);
    // Lost unit banks NOTHING (its own actions still fed others' spillover).
    const lost = find(deployed[2]!.id);
    expect(lost.fate).toBe('lost');
    expect(lost.earnedByClass).toEqual({});
  });

  it('carries mid-battle level-ups (final level + xp) back onto the durable unit', () => {
    const base = terminalState();
    const units = new Map(base.units);
    const survivor = deployed[0]!.id; // survived branch in terminalState()
    units.set(survivor, { ...units.get(survivor)!, level: 26, xp: 40 });
    const finalState: GameState = { ...base, units };
    const updated = applyBattleResult(roster, summarizeBattleResult(finalState), finalState, catalog);

    const after = updated.find((u) => u.id === survivor)!;
    expect(after.level).toBe(26); // leveled level is the new durable input
    expect(after.xp).toBe(40); // rollover remainder carries
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
