// TABA economy — gil wallet tests (M3 economy brief, Stage 0).
// grant/spend are the wallet's only doors; the award derives from the
// battle's final state (all non-player-team units, dead or alive).

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '@content/index.ts';
import { createInitialState, teamId, type GameState, type TeamId } from '@engine/index.ts';
import { riverRidgeBattle } from '@content/battles/river-ridge-battle.ts';
import { GIL_PER_ENEMY_LEVEL } from './economy-config.ts';
import { computeGilReward, grantGil, spendGil } from './gil.ts';
import { newCampaign } from './loop.ts';
import { m0Roster } from './roster.ts';
import { foldCampaignRoster } from './snapshot-fold.ts';

const catalog = loadDefaultCatalog();
const PLAYER: TeamId = teamId('team_a');

const walletAt = (gil: number) => ({ ...newCampaign(m0Roster, 'node-river-ridge'), gil });

describe('grantGil / spendGil', () => {
  it('grant credits, spend debits', () => {
    const state = grantGil(walletAt(100), 250);
    expect(state.gil).toBe(350);
    expect(spendGil(state, 300).gil).toBe(50);
  });

  it('grant of 0 is a no-op (same state back)', () => {
    const state = walletAt(100);
    expect(grantGil(state, 0)).toBe(state);
  });

  it('grant rejects negative / fractional amounts', () => {
    expect(() => grantGil(walletAt(0), -5)).toThrow(/non-negative integer/);
    expect(() => grantGil(walletAt(0), 2.5)).toThrow(/non-negative integer/);
  });

  it('spend rejects non-positive / fractional amounts', () => {
    expect(() => spendGil(walletAt(100), 0)).toThrow(/positive integer/);
    expect(() => spendGil(walletAt(100), -10)).toThrow(/positive integer/);
    expect(() => spendGil(walletAt(100), 0.5)).toThrow(/positive integer/);
  });

  it('spend fails loudly on insufficient funds (state layer re-validates)', () => {
    expect(() => spendGil(walletAt(100), 101)).toThrow(/insufficient gil/);
  });
});

describe('computeGilReward', () => {
  function finalState(): GameState {
    const config = foldCampaignRoster(riverRidgeBattle, m0Roster.slice(0, 3), PLAYER, catalog);
    return createInitialState(config, catalog);
  }

  it('pays X × Σ(levels) over every non-player-team unit', () => {
    const state = finalState();
    let enemyLevels = 0;
    for (const u of state.units.values()) {
      if (u.team !== PLAYER) enemyLevels += u.level;
    }
    expect(enemyLevels).toBeGreaterThan(0);
    expect(computeGilReward(state, PLAYER)).toBe(GIL_PER_ENEMY_LEVEL * enemyLevels);
  });

  it('counts dead/removed enemies — the award prices the whole opposition', () => {
    const state = finalState();
    const units = new Map(state.units);
    // KO + remove every enemy; the award must not change.
    for (const [id, u] of units) {
      if (u.team !== PLAYER) units.set(id, { ...u, vitals: { ...u.vitals, hp: 0 }, removed: true });
    }
    expect(computeGilReward({ ...state, units }, PLAYER)).toBe(computeGilReward(state, PLAYER));
  });
});
