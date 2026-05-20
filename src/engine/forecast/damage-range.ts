// Damage-range forecast — projects {min, expected, max} for a hypothetical
// cast without committing. Composes the AI's existing `projectExpectedDamage`
// shape (per ADR-0033 / ADR-0042) by varying the variance bounds: min runs
// the projection at `variance.min`, max at `variance.max`, expected at the
// midpoint. Every other random handler (evasion, crit) is handled by the
// projection registry as an expected-value substitute, so all three bounds
// share the same hit-chance × crit-expectation treatment.
//
// Used by the UI's forecast hover panel (see `src/ui/forecast-panel.tsx`).

import { projectDamageContext, projectExpectedDamage } from '../../ai/projection.ts';
import { resolvePhysicalVarianceBand } from '../damage/handlers.ts';
import type { ActiveAbilityDefinition, Catalog } from '../catalog/index.ts';
import type { GameState, Unit } from '../types/index.ts';

// Forecast regime — what the numbers represent at this resistance level.
//  - `'damage'`: standard outgoing damage (target loses HP).
//  - `'heal'`: the ability is natively healing-tagged (Cure) — target
//     gains HP.
//  - `'absorbed'`: the ability is natively damaging, but the target's
//     resistance > 100 flipped the result to healing per ADR-0057. The
//     min/expected/max are the absorbed heal amounts; the forecast
//     panel and AI scoring distinguish absorption from native heals
//     because the messaging differs ("absorbed for X" vs "heals for X").
export type DamageRangeRegime = 'damage' | 'heal' | 'absorbed';

export interface DamageRange {
  readonly min: number;
  readonly expected: number;
  readonly max: number;
  readonly regime: DamageRangeRegime;
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
    return { min: 0, expected: 0, max: 0, regime: 'damage' };
  }
  // Resolve the EFFECTIVE variance band — the weapon's band overrides the
  // ability's static one (knives use a Speed-based `attacker_speed` band,
  // per ADR-0067 / Session 40). Before Session 42 this read the ability's
  // static `damage.variance` directly, so knife forecasts ignored the
  // Speed-driven spread and badly under-projected (a Speed-16 knife rolls
  // ~1.6×, not ~1.0×). Now the same resolver the live pipeline uses backs
  // the forecast, so they agree.
  const variance = resolvePhysicalVarianceBand(
    args.state,
    args.catalog,
    args.attacker,
    args.ability,
  );
  // Build min/max ability variants — pure structural copies with the
  // variance band collapsed to a single point at the effective band's
  // endpoints. The projection's variance handler honors a degenerate
  // (`min === max`) band directly (the "pinned-factor" path), so min uses
  // `variance.min` and max uses `variance.max`; the unmodified ability's
  // expected midpoint auto-resolves the same effective band.
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
  // Inspect the projection context at the expected variance midpoint to
  // determine the regime (native damage / native heal / absorption).
  // The numbers themselves come from `projectExpectedDamage`, which
  // returns 0 for absorption (its passive-avoidance shape for AI
  // scoring); for the forecast panel we need the actual absorbed
  // amounts, so we read them off the projection ctx for the absorption
  // case and from `projectExpectedDamage` otherwise.
  const expectedCtx = projectDamageContext({ ...args, ability: args.ability });
  const isNativelyHealing = damage.tags.includes('healing');
  const projectionFlippedToHeal = !isNativelyHealing && expectedCtx.damageTags.has('healing');
  if (projectionFlippedToHeal) {
    const minCtx = projectDamageContext({ ...args, ability: minAbility });
    const maxCtx = projectDamageContext({ ...args, ability: maxAbility });
    return {
      min: minCtx.finalDamage ?? 0,
      expected: expectedCtx.finalDamage ?? 0,
      max: maxCtx.finalDamage ?? 0,
      regime: 'absorbed',
    };
  }
  const expected = projectExpectedDamage({ ...args, ability: args.ability });
  const min = projectExpectedDamage({ ...args, ability: minAbility });
  const max = projectExpectedDamage({ ...args, ability: maxAbility });
  return {
    min,
    expected,
    max,
    regime: isNativelyHealing ? 'heal' : 'damage',
  };
}
