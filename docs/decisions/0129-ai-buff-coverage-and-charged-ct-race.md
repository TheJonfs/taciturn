## ADR-0129: AI buff-coverage targeting + charged-attack CT-race devaluation

**Status:** Accepted
**Date:** 2026-06-26

## Context

Two S74 AI increments, both reasoning over positions/CT, both within the existing
unified-scoring framework (no new substrate):

- **A — AoE-buff targeting.** `scoreAllyBuff` was single-target: it scored an
  AoE ally-buff (Auramancy's Haste / Protect / Shell, a diamond-1 footprint) by
  the one anchor ally's value, ignoring how many allies the footprint covers. So
  the AI could aim a cluster buff at a lonely ally. This is the natural partner
  to S73's buff-aware cohesion (ADR-0123): allies gather, but the caster wasn't
  aiming at the gathering.
- **B — charged-attack CT race.** The Hunter's Charged Attack is tile-pinned
  (S74): it hits whoever stands on the pinned tile at resolution and whiffs if
  they've moved off. The AI scored it optimistically against the enemy standing
  there *now*, ignoring that a fast target reaches its next turn — and can vacate
  the tile — before the charge resolves.

## Decision

- **A — coverage-weighted anchor.** Factor the per-ally buff value into a shared
  `buffPotency` (MA × #offensive-abilities × damping; 0 for a unit with no
  offense or one already carrying every buff the ability applies). Add
  `scoreAoeBuff`: anchored at a candidate ally's tile, it sums `buffPotency` over
  every beneficiary the footprint covers (caster included when
  `excludeCaster: false`), and deducts the potency of any enemy caught in the
  footprint (Auramancy is friendly-fire + `excludeCaster: false`, so buffing an
  enemy is an own-goal). `bestActFromSource` routes AoE buffs through it;
  single-target buffs still use `scoreAllyBuff`. **Subordinate by construction**
  — it competes on the same scale as every other Act and never stalls for a
  better cluster (that's the move-phase cohesion's job).

- **B — CT-race devaluation, not a ban.** `chargedTilePinValueFactor` runs the
  race via `estimateChargedTiming` (the same forecast the UI's resolve-timeline
  uses) with `concernedUnitId = target`. If `resolvesBeforeTargetTurn === false`
  (the target acts before the charge lands), multiply the tile-pin's score by
  `CHARGED_TILE_PIN_DODGE_PENALTY = 0.35`. `null` (target Stopped / no upcoming
  turn) or `true` (charge lands first) → full value. The AI prefers a target that
  won't act, or another action, but still charges freely against slow / Stopped /
  non-acting targets — no never-charge regression. Offensive half only; **a pure
  CT-race check, no movement prediction** (the target's likely tile is out of
  scope).

## Consequences

- An AI Enchanter aims Auramancy at the densest reachable ally cluster; it won't
  buff a non-beneficiary or an already-buffed ally, and won't splash an enemy if
  a cleaner anchor scores higher.
- The AI declines a tile-pinned charged attack on a target that will dodge it by
  acting first, preferring a non-acting target or another action.
- Both are AI-scoring-only (no game-rule / content / UX change). The 0.35 penalty
  is a playtest dial. Feel is unverified — both-AI battles still can't be
  auto-driven in the preview (since S70); validation is unit-test-only.

## Alternatives considered

- **A: anchor on empty tiles too (not just ally tiles).** The optimal diamond
  center can be an empty tile, but iterating ally tiles as anchors already aims at
  the gathering and stays bounded; empty-tile search is a deferred refinement.
- **B: ban the dodgeable charge outright.** Too blunt — a high-value kill-shot
  charge can still be worth the gamble; the multiplicative penalty lets value win
  when it's large enough. Also rejected: full movement prediction (lead the
  target to its likely tile) — out of scope, the defensive/dodge-incoming half
  stays deferred with the predictive-positional threat-model.
