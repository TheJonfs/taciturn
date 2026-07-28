// TABA Ch1 iteration (S100, Fix 2) — plot units are must-survive.
//
// The loss-side mirror of the ADR-0149 victory-condition system: any DEPLOYED
// plot unique (PLOT_UNIT_IDS) that permadeath-removes — its KO revival window
// expires — ends the battle as a loss for the player. Composed here as a
// `unit_lost` predicate condition PREPENDED to the config's authored list
// (most-specific first, per the evaluator's ordering convention), never
// authored per battle: auto-composing over the folded config means joined
// plot units (Clio, Thessaly, Sera) are covered the day they join, and
// skirmishes are covered because they fold through the same entry point.
//
// Guests are excluded by the `guest` flag (a guest is not must-survive
// unless a battle authors its own condition), and generics are excluded by
// not being in PLOT_UNIT_IDS — they still permadie without ending the
// battle. A KO'd-but-not-yet-removed plot unit does NOT satisfy the
// predicate: revive during the countdown and the fight goes on.

import type { BattleConfig, TeamId, UnitId, VictoryCondition } from '@engine/index.ts';
import { PLOT_UNIT_IDS } from './plot-unit-ids.ts';

const PLOT_ID_SET: ReadonlySet<UnitId> = new Set(Object.values(PLOT_UNIT_IDS));

// The loss screen's line — why the battle ended.
export const PLOT_LOSS_DESCRIPTION = 'A leader of the company has fallen';

// Prepend the plot-unit loss condition when the config fields any non-guest
// plot unique on the player team; a config without one (e.g. a debug or Mage
// War battle) passes through untouched. Throws on a config with no non-player
// team — a battle the player can "lose" needs someone to win it.
export function withPlotLossCondition(config: BattleConfig, playerTeam: TeamId): BattleConfig {
  const atRisk = config.units
    .filter((u) => u.team === playerTeam && u.guest !== true && PLOT_ID_SET.has(u.id))
    .map((u) => u.id);
  if (atRisk.length === 0) return config;

  const enemyTeam = config.teams.find((t) => t.id !== playerTeam)?.id;
  if (enemyTeam === undefined) {
    throw new Error('withPlotLossCondition: config has no non-player team to win the loss');
  }

  const loss: VictoryCondition = {
    kind: 'predicate',
    predicate: { kind: 'unit_lost', anyOf: atRisk },
    winner: enemyTeam,
    description: PLOT_LOSS_DESCRIPTION,
  };
  return { ...config, victoryConditions: [loss, ...config.victoryConditions] };
}
