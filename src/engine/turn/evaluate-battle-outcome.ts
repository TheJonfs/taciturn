// Evaluate the running battle's victory conditions against the current
// state.
// See docs/design/turn-structure.md ("Battle outcomes").
//
// Pure: reads state and the conditions on it, returns an EvaluatedOutcome.
// Doesn't mutate; doesn't fire hooks. The reducer (reduceTurnEnd) calls
// this and emits a `battle_end` action when decided.
//
// First-satisfied wins. Order in `state.victoryConditions` matters for
// tiebreaks — the BattleConfig author lists the most-specific conditions
// first.
//
// Adding a new VictoryCondition kind: add a discriminant in
// `engine/types/battle-outcome.ts`, then a clause in the switch below.
// The switch is exhaustive — TypeScript catches missing variants.

import {
  type EvaluatedOutcome,
  type GameState,
  type TeamId,
  type VictoryCondition,
} from '../types/index.ts';

export function evaluateBattleOutcome(state: GameState): EvaluatedOutcome {
  // Already decided — return the existing outcome verbatim. The reducer
  // shouldn't be calling this past battle-end, but the defensive
  // pass-through means a UI/AI consumer that does is harmless.
  if (state.outcome !== undefined) {
    return { kind: 'decided', decided: state.outcome };
  }

  for (let i = 0; i < state.victoryConditions.length; i++) {
    const cond = state.victoryConditions[i]!;
    const winner = checkCondition(state, cond);
    if (winner !== null) {
      return {
        kind: 'decided',
        decided: {
          winner,
          conditionIndex: i,
          description: cond.description,
        },
      };
    }
  }
  return { kind: 'ongoing' };
}

// Returns the winning TeamId when satisfied, or `null` when not. The
// per-kind clause owns both the predicate and the winner-derivation —
// kept together so future condition kinds (survive_turns, reach_tile,
// protect_unit) can encode their winner-from-state logic alongside.
function checkCondition(state: GameState, condition: VictoryCondition): TeamId | null {
  switch (condition.kind) {
    case 'defeat_all': {
      // Satisfied when every unit on `condition.side` is KO'd. A side
      // with no units trivially satisfies — the BattleConfig validator
      // should reject empty teams, but the predicate makes no
      // assumption. Winner is the first team in `state.teams` other
      // than the defeated side; v1 two-team battles unambiguous.
      for (const unit of state.units.values()) {
        if (unit.team !== condition.side) continue;
        if (unit.vitals.hp > 0) return null;
      }
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
  }
}
