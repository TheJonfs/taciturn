// Battle setup — turn a BattleConfig into the immutable starting GameState.
// See docs/architecture/architecture-overview.md ("Rulesets and content")
// and ADR-0008.
//
// The construction is straightforward by design: BattleConfig declares
// what the battle is, the catalog supplies the static definitions, and
// `createInitialState` weaves them into the starting state. No
// reducer logic happens here — the result is what the action loop sees
// at sequence number 0.

import type { Catalog } from '../catalog/index.ts';
import {
  type BattleConfig,
  type GameState,
  type RulesetDefinition,
  type Unit,
  type UnitId,
  type UnitPlacement,
} from '../types/index.ts';
import { validateLoadout } from '../abilities/validate.ts';
import { TRIGGER_THRESHOLD } from '../ct/constants.ts';

export class BattleConfigError extends Error {
  override readonly name = 'BattleConfigError';
}

export function createInitialState(
  battleConfig: BattleConfig,
  catalog: Catalog,
): GameState {
  const ruleset = catalog.getRuleset(battleConfig.rulesetId);

  // Pre-build checks that don't need a constructed state.
  validateConfigStructure(battleConfig, catalog);

  const unitMap = new Map<UnitId, Unit>();
  for (const placement of battleConfig.units) {
    const unit = placementToUnit(placement, ruleset, battleConfig.masterSeed);
    unitMap.set(unit.id, unit);
  }

  const state: GameState = {
    battleId: battleConfig.battleId,
    map: battleConfig.map,
    teams: battleConfig.teams,
    ruleset: { id: battleConfig.rulesetId },
    units: unitMap,
    chargedActions: [],
    globalEffects: [],
    victoryConditions: battleConfig.victoryConditions,
    tick: 0,
    turnState: null,
    rng: { masterSeed: battleConfig.masterSeed, nextSeq: 0 },
    actionLog: [],
  };

  // Loadout validation runs against the constructed state, since the
  // canonical validateLoadout reads the unit through the state. Any
  // violation here is a battle-config authoring bug — fail loud.
  for (const unit of unitMap.values()) {
    const result = validateLoadout(state, unit.id, unit.loadout, catalog);
    if (!result.ok) {
      const summary = result.violations.map((v) => v.kind).join(', ');
      throw new BattleConfigError(
        `Unit ${JSON.stringify(unit.id)} has invalid loadout: ${summary}`,
      );
    }
  }

  return state;
}

function placementToUnit(
  placement: UnitPlacement,
  ruleset: RulesetDefinition,
  masterSeed: number,
): Unit {
  const ct = placement.initialCT ?? resolveInitialCT(ruleset, placement, masterSeed);
  return {
    id: placement.id,
    team: placement.team,
    name: placement.name,
    classState: { currentClass: placement.classId },
    loadout: placement.loadout,
    position: placement.position,
    facing: placement.facing,
    ct,
    baseStats: placement.baseStats,
    vitals: placement.vitals,
    resistances: placement.resistances ?? new Map(),
    statuses: placement.statuses ?? [],
  };
}

// Resolve the ruleset's initial-CT formula. The exhaustive switch
// lights up when new kinds are added so the new variant is consciously
// handled.
function resolveInitialCT(
  ruleset: RulesetDefinition,
  placement: UnitPlacement,
  masterSeed: number,
): number {
  switch (ruleset.initialCT.kind) {
    case 'fixed':
      return ruleset.initialCT.value;
    case 'speed_with_variance': {
      const { speedFactor, variancePct } = ruleset.initialCT;
      const base = placement.baseStats.spd * speedFactor;
      // Stable per-unit variance: hash (masterSeed, unitId) into a unit
      // float, scale to ±(variancePct/2) of the threshold, add to base.
      const v = unitFloatFromKey(masterSeed, placement.id);
      const swing = (variancePct / 100) * TRIGGER_THRESHOLD;
      const offset = (v - 0.5) * swing;
      const raw = base + offset;
      // Floor at 0; ceil one below threshold so no unit starts pre-
      // triggered (the scheduler is the path that lifts CT to ≥ 100).
      return Math.max(0, Math.min(TRIGGER_THRESHOLD - 1, Math.round(raw)));
    }
  }
}

// mulberry32-style mixer over (masterSeed XOR string-hash(id)) → unit
// float in [0, 1). Stable by construction: same masterSeed + same
// unit id always produces the same value.
function unitFloatFromKey(masterSeed: number, key: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < key.length; i++) {
    h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  }
  let s = (masterSeed ^ h) >>> 0;
  s = (s + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// Pre-build checks. Catches obvious authoring errors before state is
// constructed: duplicate unit ids, references to teams or classes that
// the BattleConfig / catalog doesn't carry. Loadout validation runs
// post-build (it reads through the state).
function validateConfigStructure(battleConfig: BattleConfig, catalog: Catalog): void {
  const declaredTeams = new Set(battleConfig.teams.map((t) => t.id));
  const seenUnitIds = new Set<UnitId>();

  for (const placement of battleConfig.units) {
    if (seenUnitIds.has(placement.id)) {
      throw new BattleConfigError(
        `BattleConfig has duplicate unit id ${JSON.stringify(placement.id)}`,
      );
    }
    seenUnitIds.add(placement.id);

    if (!declaredTeams.has(placement.team)) {
      throw new BattleConfigError(
        `Unit ${JSON.stringify(placement.id)} references team ${JSON.stringify(placement.team)} which is not declared in BattleConfig.teams`,
      );
    }

    if (!catalog.hasClass(placement.classId)) {
      throw new BattleConfigError(
        `Unit ${JSON.stringify(placement.id)} references class ${JSON.stringify(placement.classId)} which is not in the catalog`,
      );
    }
  }
}
