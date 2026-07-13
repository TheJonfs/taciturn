// Evaluate the running battle's victory conditions against the current
// state.
// See docs/design/turn-structure.md ("Battle outcomes").
//
// Pure: reads state and the conditions on it, returns an EvaluatedOutcome.
// Doesn't mutate; doesn't fire hooks (the `unit_below_hp` predicate reads
// effective max HP through the modifyStatQuery chain, but stat queries
// are pure reads by contract). The commit loop calls this after every
// committed action (ADR-0074) and emits a `battle_end` when decided.
//
// First-satisfied wins. Order in `state.victoryConditions` matters for
// tiebreaks — the BattleConfig author lists the most-specific conditions
// first (e.g. a subdue "good" outcome before the all-defeated
// "standard" fallthrough).
//
// Adding a new VictoryCondition kind or VictoryPredicate: add a
// discriminant in `engine/types/battle-outcome.ts`, then a clause in
// the switch below. Both switches are exhaustive — TypeScript catches
// missing variants.

import type { Catalog } from '../catalog/index.ts';
import { runModifyStatQuery } from '../hooks/runners.ts';
import {
  type EvaluatedOutcome,
  type GameState,
  type TeamId,
  type Unit,
  type VictoryCondition,
  type VictoryPredicate,
} from '../types/index.ts';

export function evaluateBattleOutcome(state: GameState, catalog: Catalog): EvaluatedOutcome {
  // Already decided — return the existing outcome verbatim. The reducer
  // shouldn't be calling this past battle-end, but the defensive
  // pass-through means a UI/AI consumer that does is harmless.
  if (state.outcome !== undefined) {
    return { kind: 'decided', decided: state.outcome };
  }

  for (let i = 0; i < state.victoryConditions.length; i++) {
    const cond = state.victoryConditions[i]!;
    const winner = checkCondition(state, catalog, cond);
    if (winner !== null) {
      const outcomeTag = cond.kind === 'predicate' ? cond.outcome : undefined;
      return {
        kind: 'decided',
        decided: {
          winner,
          conditionIndex: i,
          description: cond.description,
          ...(outcomeTag !== undefined ? { outcome: outcomeTag } : {}),
        },
      };
    }
  }
  return { kind: 'ongoing' };
}

// Returns the winning TeamId when satisfied, or `null` when not. The
// per-kind clause owns both the predicate and the winner-derivation —
// `defeat_all` derives the winner from state (the other team);
// `predicate` conditions carry an explicit authored winner.
function checkCondition(
  state: GameState,
  catalog: Catalog,
  condition: VictoryCondition,
): TeamId | null {
  switch (condition.kind) {
    case 'defeat_all': {
      // Satisfied when every unit on `condition.side` is KO'd. A side
      // with no units trivially satisfies — the BattleConfig validator
      // should reject empty teams, but the predicate makes no
      // assumption. Winner is the first team in `state.teams` other
      // than the defeated side; v1 two-team battles unambiguous.
      if (!allDefeated(state, condition.side)) return null;
      const other = state.teams.find((t) => t.id !== condition.side);
      if (other === undefined) {
        // No surviving team to declare winner — should not happen with
        // a well-formed BattleConfig (every battle has at least two
        // teams, and `condition.side` is one of them). Return null so
        // the condition is treated as not-satisfied; surface the
        // inconsistency at the BattleConfig validator.
        return null;
      }
      return other.id;
    }
    case 'predicate':
      return checkPredicate(state, catalog, condition.predicate) ? condition.winner : null;
  }
}

// Ch1 substrate: the composable predicate grammar. Semantics pinned in
// battle-outcome.ts (and tests): strict `<` thresholds, retreat ≠
// death, revived units still count as having died, and a unit that is
// no longer standing counts as below any HP threshold.
function checkPredicate(state: GameState, catalog: Catalog, pred: VictoryPredicate): boolean {
  switch (pred.kind) {
    case 'all_defeated':
      return allDefeated(state, pred.side);
    case 'no_deaths': {
      for (const unit of state.units.values()) {
        if (unit.team === pred.side && unit.hasDied) return false;
      }
      return true;
    }
    case 'unit_below_hp': {
      if (pred.target.kind === 'unit') {
        const unit = state.units.get(pred.target.unitId);
        if (unit === undefined) {
          throw new Error(
            `evaluateBattleOutcome: unit_below_hp references unknown unit ${JSON.stringify(pred.target.unitId)}`,
          );
        }
        return unitBelowFraction(state, catalog, unit, pred.fraction);
      }
      for (const unit of state.units.values()) {
        if (unit.team !== pred.target.side) continue;
        if (!unitBelowFraction(state, catalog, unit, pred.fraction)) return false;
      }
      return true;
    }
    case 'all_of':
      return pred.predicates.every((p) => checkPredicate(state, catalog, p));
  }
}

function allDefeated(state: GameState, side: TeamId): boolean {
  for (const unit of state.units.values()) {
    if (unit.team !== side) continue;
    if (unit.vitals.hp > 0) return false;
  }
  return true;
}

// Strict `<` per the Ch1 brief's watch-for: an enemy sitting at exactly
// 25% of max is NOT subdued. A unit no longer standing (KO'd, removed,
// or retreated) trivially satisfies — the boss beaten straight past his
// retreat threshold by a lethal hit still ends the fight.
function unitBelowFraction(
  state: GameState,
  catalog: Catalog,
  unit: Unit,
  fraction: number,
): boolean {
  if (unit.vitals.hp <= 0 || unit.removed || unit.retreated) return true;
  const maxHp = runModifyStatQuery(state, catalog, {
    unit,
    statName: 'maxHp',
    baseValue: unit.baseStats.maxHpBase,
  });
  if (maxHp <= 0) return true;
  return unit.vitals.hp / maxHp < fraction;
}
