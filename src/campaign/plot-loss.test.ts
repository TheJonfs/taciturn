// TABA S100 (Fix 2) — plot-unit must-survive composition tests.
// `withPlotLossCondition` is the campaign-side half of the plot-loss fix:
// the engine's `unit_lost` predicate semantics are pinned in
// engine/turn/evaluate-battle-outcome.test.ts; here we pin WHO the campaign
// puts at risk (deployed plot uniques; never guests, never generics) and
// WHERE the condition lands (prepended, enemy team as winner).

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '@content/index.ts';
import { teamId } from '@engine/index.ts';
import type { TeamId } from '@engine/index.ts';
import { riverRidgeBattle } from '@content/battles/river-ridge-battle.ts';
import { ch1StartingRoster } from './ch1-roster.ts';
import { PLOT_UNIT_IDS } from './plot-unit-ids.ts';
import { PLOT_LOSS_DESCRIPTION, withPlotLossCondition } from './plot-loss.ts';
import { foldBattle } from './snapshot-fold.ts';
import type { NodeBattle } from './sequence.ts';

const catalog = loadDefaultCatalog();
const PLAYER: TeamId = teamId('team_a'); // River Ridge's Blue team
const ENEMY: TeamId = teamId('team_b');

// Deterministic rng for the roster's generic rolls — the plot pair
// (Lumen/Chris) is authored regardless of rolls.
const roster = ch1StartingRoster(() => 0.5, catalog);
const plotUnits = roster.filter((u) =>
  (Object.values(PLOT_UNIT_IDS) as ReadonlyArray<string>).includes(u.id),
);
const generics = roster.filter(
  (u) => !(Object.values(PLOT_UNIT_IDS) as ReadonlyArray<string>).includes(u.id),
);

const battle: NodeBattle = {
  template: riverRidgeBattle,
  playerTeam: PLAYER,
  zones: { teams: [] },
  deployCap: 5,
};

describe('withPlotLossCondition', () => {
  it('prepends a unit_lost loss condition covering every deployed plot unique', () => {
    const config = foldBattle(battle, [plotUnits[0]!, plotUnits[1]!, generics[0]!], catalog);
    const first = config.victoryConditions[0]!;
    expect(first.kind).toBe('predicate');
    if (first.kind !== 'predicate') return;
    expect(first.predicate).toEqual({
      kind: 'unit_lost',
      anyOf: [plotUnits[0]!.id, plotUnits[1]!.id],
    });
    expect(first.winner).toBe(ENEMY);
    expect(first.description).toBe(PLOT_LOSS_DESCRIPTION);
    // The authored conditions survive, shifted one down.
    expect(config.victoryConditions.length).toBe(riverRidgeBattle.victoryConditions.length + 1);
  });

  it('a generics-only deployment composes NO loss condition (generics permadie freely)', () => {
    const config = foldBattle(battle, generics.slice(0, 3), catalog);
    expect(config.victoryConditions).toEqual(riverRidgeBattle.victoryConditions);
  });

  it('a guest plot unique is NOT must-survive (guest flag excludes)', () => {
    // Hand-build a config that fields a plot id as a guest placement.
    const guestConfig = {
      ...riverRidgeBattle,
      units: riverRidgeBattle.units.map((u, i) =>
        i === 0 ? { ...u, id: PLOT_UNIT_IDS.sera, guest: true as const } : u,
      ),
    };
    const out = withPlotLossCondition(guestConfig, PLAYER);
    expect(out.victoryConditions).toEqual(riverRidgeBattle.victoryConditions);
  });

  it('a plot id on the ENEMY team is not the player’s problem', () => {
    const enemyConfig = {
      ...riverRidgeBattle,
      units: riverRidgeBattle.units.map((u) =>
        u.team === ENEMY ? { ...u, id: PLOT_UNIT_IDS.clio } : u,
      ),
    };
    const out = withPlotLossCondition(enemyConfig, PLAYER);
    expect(out.victoryConditions).toEqual(riverRidgeBattle.victoryConditions);
  });
});
