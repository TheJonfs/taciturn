// TABA Seam 2 — the cover primitive.
//
// A reusable, parameterized "damage soak": a bearer carrying a passive with
// `coverParams` redirects a fraction of a NEARBY ALLY's incoming hit onto
// itself. The `coverRedirect` handler runs in the damage pipeline's `target`
// stage (right after evasion), so `ctx.baseDamage` is still the RAW base — no
// mitigation folded yet. On a qualifying coverer it:
//
//   1. Subtracts the redirected RAW share from the ally's hit (a negative
//      additive), so the ally keeps `(base − redirected)` and then their OWN
//      mitigation applies to the remainder — "redirect the raw, each mitigates
//      their share."
//   2. Emits a `system_cover_redirect` carrying that RAW share; its reducer
//      runs it through a mitigation-only pass against the bearer, so the
//      bearer's Protect / resistances / armor make the soak better (S84 ruling).
//
// The engine reads `coverParams` GENERICALLY off the passive definition (the
// `relaxesTwoHandedGrip` precedent) — it never references a specific ability id,
// so Chris is just instance one; generic tanks / boss minions reuse the same
// handler with different params.

import type { Catalog } from '../catalog/index.ts';
import type { CoverParams } from '../catalog/definitions/ability-definition.ts';
import { horizontalDistance, verticalDistance } from '../map/index.ts';
import { DEFAULT_SCENARIO_TIER, type GameState, type ProposedAction, type Unit } from '../types/index.ts';
import type { DamageHandler } from './registry.ts';

// The passive-driven cover parameters a unit contributes, or null if it carries
// no cover passive. Reads the first cover passive across the unit's passive
// buckets (a unit with two would use the first — no v1 case).
function coverParamsOf(unit: Unit, catalog: Catalog): CoverParams | null {
  for (const ids of Object.values(unit.loadout.passiveBuckets)) {
    for (const id of ids ?? []) {
      if (!catalog.hasAbility(id)) continue;
      const ability = catalog.getAbility(id);
      if (ability.kind === 'passive' && ability.coverParams !== undefined) {
        return ability.coverParams;
      }
    }
  }
  return null;
}

// Find the ally (if any) that covers `target` against this hit: a living,
// same-team unit that is neither the target nor the attacker, carries a cover
// passive, and sits within its range + vertical tolerance of the target.
// Deterministic pick when several qualify: larger `redirectPerTier`, then
// nearer, then lexicographically smaller id.
function findCoverer(
  state: GameState,
  catalog: Catalog,
  target: Unit,
  attackerId: string,
): { readonly unit: Unit; readonly params: CoverParams } | null {
  let best: { unit: Unit; params: CoverParams; dist: number } | null = null;
  for (const u of state.units.values()) {
    if (u.id === target.id || u.id === attackerId) continue;
    if (u.team !== target.team) continue;
    if (u.removed || u.vitals.hp <= 0) continue;
    const params = coverParamsOf(u, catalog);
    if (params === null) continue;
    const dist = horizontalDistance(u.position, target.position);
    if (dist > params.range) continue;
    if (verticalDistance(u.position.layer, target.position.layer) > params.verticalTolerance) continue;
    if (
      best === null ||
      params.redirectPerTier > best.params.redirectPerTier ||
      (params.redirectPerTier === best.params.redirectPerTier && dist < best.dist) ||
      (params.redirectPerTier === best.params.redirectPerTier && dist === best.dist && u.id < best.unit.id)
    ) {
      best = { unit: u, params, dist };
    }
  }
  return best === null ? null : { unit: best.unit, params: best.params };
}

// The redirect fraction for a coverer at the battle's scenario tier, clamped to
// `[0, maxFraction ?? 1]`.
function coverFraction(params: CoverParams, scenarioTier: number): number {
  const raw = params.redirectPerTier * scenarioTier;
  return Math.max(0, Math.min(params.maxFraction ?? 1, raw));
}

// Pipeline `target`-stage handler. No-op unless a qualifying coverer exists and
// a whole ≥1 point of raw damage would redirect.
export const coverRedirect: DamageHandler = (ctx, env) => {
  // Skip on a miss (ally evaded), a heal, or a zero base — nothing to soak.
  if (!ctx.hit) return ctx;
  if (ctx.damageTags.has('healing')) return ctx;
  if (ctx.baseDamage <= 0) return ctx;

  const target = env.state.units.get(ctx.target.id) ?? ctx.target;
  const found = findCoverer(env.state, env.catalog, target, ctx.attacker.id);
  if (found === null) return ctx;

  const fraction = coverFraction(found.params, env.state.scenarioTier ?? DEFAULT_SCENARIO_TIER);
  if (fraction <= 0) return ctx;
  const redirectedRaw = Math.floor(ctx.baseDamage * fraction);
  if (redirectedRaw <= 0) return ctx;

  const redirect: ProposedAction = {
    type: 'system_cover_redirect',
    source: 'system',
    payload: {
      coverId: found.unit.id,
      coveredId: target.id,
      attackerId: ctx.attacker.id,
      sourceAbilityId: ctx.sourceAbilityId,
      amount: redirectedRaw,
    },
  };

  return {
    ...ctx,
    // Subtract the redirected RAW from the ally's base; their own mitigation
    // then applies to what remains (additives fold before multipliers).
    additives: [...ctx.additives, { source: 'cover', amount: -redirectedRaw }],
    emittedActions: [...(ctx.emittedActions ?? []), redirect],
  };
};
