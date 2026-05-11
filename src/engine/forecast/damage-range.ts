// Damage-range forecast — projects {min, expected, max} for a hypothetical
// cast without committing. Composes the AI's existing `projectExpectedDamage`
// shape (per ADR-0033 / ADR-0042) by varying the variance bounds: min runs
// the projection at `variance.min`, max at `variance.max`, expected at the
// midpoint. Every other random handler (evasion, crit) is handled by the
// projection registry as an expected-value substitute, so all three bounds
// share the same hit-chance × crit-expectation treatment.
//
// Used by the UI's forecast hover panel (see `src/ui/forecast-panel.tsx`).

import { projectExpectedDamage } from '../../ai/projection.ts';
import type { ActiveAbilityDefinition, Catalog } from '../catalog/index.ts';
import type { GameState, Unit } from '../types/index.ts';

export interface DamageRange {
  readonly min: number;
  readonly expected: number;
  readonly max: number;
}

export interface ProjectDamageRangeArgs {
  readonly state: GameState;
  readonly catalog: Catalog;
  readonly attacker: Unit;
  readonly target: Unit;
  readonly ability: ActiveAbilityDefinition;
  readonly targetCount?: number;
}

export function projectDamageRange(args: ProjectDamageRangeArgs): DamageRange {
  const damage = args.ability.effects.damage;
  if (damage === undefined) {
    return { min: 0, expected: 0, max: 0 };
  }
  const variance = damage.variance ?? { min: 1, max: 1 };
  // Build min/max ability variants — pure structural copies with the
  // variance band collapsed to a single point. The projection's variance
  // handler returns the midpoint, so a min-band ability passes its `min`
  // value as the midpoint of a degenerate [min, min] band.
  const minAbility: ActiveAbilityDefinition = {
    ...args.ability,
    effects: {
      ...args.ability.effects,
      damage: { ...damage, variance: { min: variance.min, max: variance.min } },
    },
  };
  const maxAbility: ActiveAbilityDefinition = {
    ...args.ability,
    effects: {
      ...args.ability.effects,
      damage: { ...damage, variance: { min: variance.max, max: variance.max } },
    },
  };
  const expected = projectExpectedDamage({ ...args, ability: args.ability });
  const min = projectExpectedDamage({ ...args, ability: minAbility });
  const max = projectExpectedDamage({ ...args, ability: maxAbility });
  return { min, expected, max };
}
