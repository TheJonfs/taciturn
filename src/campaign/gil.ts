// TABA economy — the party gil wallet (M3 economy brief, Stage 0).
//
// One SHARED pool on `CampaignState` (not per-unit), mutated only through the
// grant/spend pair below — the wallet's equivalent of inventory's "receipt is
// the one door". Both are pure state→state functions; persistence rides the
// existing campaign save (the wallet is just a field on the container).
//
// The award: winning any battle — story or skirmish — pays
// `GIL_PER_ENEMY_LEVEL × Σ(enemy levels)`, derived from the battle's FINAL
// state so it prices exactly the opposition that was fought (a mid-battle
// leveled enemy pays its leveled value). Losses pay nothing (the loss path
// never applies back).

import type { GameState, TeamId } from '@engine/index.ts';
import { GIL_PER_ENEMY_LEVEL } from './economy-config.ts';
import type { CampaignState } from './types.ts';

// Credit the wallet. `amount` must be a non-negative integer — a fractional
// or negative grant is a caller bug (spend is its own door), so fail loud.
export function grantGil(state: CampaignState, amount: number): CampaignState {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error(`grantGil: amount must be a non-negative integer, got ${amount}`);
  }
  if (amount === 0) return state;
  return { ...state, gil: state.gil + amount };
}

// Debit the wallet. Throws on a non-positive/fractional amount and on
// insufficient funds — the UI disables unaffordable purchases, but the state
// layer re-validates rather than trusting it (mirrors engine validation).
export function spendGil(state: CampaignState, amount: number): CampaignState {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error(`spendGil: amount must be a positive integer, got ${amount}`);
  }
  if (amount > state.gil) {
    throw new Error(`spendGil: insufficient gil (have ${state.gil}, need ${amount})`);
  }
  return { ...state, gil: state.gil - amount };
}

// The battle's gil award: `GIL_PER_ENEMY_LEVEL × Σ(levels)` over every unit
// NOT on the player's team in final state (dead and removed included — the
// award prices the whole opposition, not just the last one standing).
export function computeGilReward(finalState: GameState, playerTeam: TeamId): number {
  let levels = 0;
  for (const unit of finalState.units.values()) {
    if (unit.team !== playerTeam) levels += unit.level;
  }
  return GIL_PER_ENEMY_LEVEL * levels;
}
