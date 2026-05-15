// AI team name rewriter — replaces the names of one team's units in a
// `BattleConfig` with names drawn from the Ivalician pool, excluding any
// already in use.
//
// Session 38: the player can name their own units in the team builder;
// the AI's Red roster is currently authored with placeholder names like
// "Red Earth Mage" in the river-ridge battle template. This helper
// re-labels the AI's units at battle-config assembly time so the
// deployed battle has Ivalician names on both sides with no collisions.
//
// Pure: the input config is not mutated; a new config with new
// `UnitPlacement`s for the targeted team is returned. RNG defaults to
// `Math.random` (fresh names per battle); tests inject a deterministic
// RNG for reproducibility.

import type { BattleConfig, TeamId } from '@engine/index.ts';
import { pickTeamNames, type Rng } from '../names/index.ts';

export interface AssignAiTeamNamesOptions {
  readonly rng?: Rng;
}

export function assignAiTeamNames(
  config: BattleConfig,
  team: TeamId,
  excludedNames: ReadonlySet<string>,
  options: AssignAiTeamNamesOptions = {},
): BattleConfig {
  const aiUnits = config.units.filter((u) => u.team === team);
  if (aiUnits.length === 0) {
    return config;
  }
  const names = pickTeamNames(aiUnits.length, excludedNames, options.rng);
  let nameIndex = 0;
  const renamed = config.units.map((unit) => {
    if (unit.team !== team) return unit;
    const name = names[nameIndex]!;
    nameIndex += 1;
    return { ...unit, name };
  });
  return { ...config, units: renamed };
}
