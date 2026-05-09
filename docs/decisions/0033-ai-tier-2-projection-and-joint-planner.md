## ADR-0033: AI tier 2 — stat-aware projection, reaction tag-filter inspection, two-action joint planning, polarity hints

**Status:** Accepted
**Date:** 2026-05-09

## Context

Session 20a closed tier 1.5 of the AI: status-aware target selection (Vulnerable bonus), coarse Brave-gated reaction penalty, AoE cluster scoring, and Lightning-specific awareness (self-damage refusal, Magnetic Mark setup→exploit, Static Embrace ally selection). Three follow-up items were carried for session 20b:

1. **Stat-aware damage projection.** Replace tier 1.5's `power_coefficient` proxy — a stripped-down "ability score" that under-counted real damage — with expected-damage projection that folds in PA/MA, weapon WP, Faith × Faith, resistance, Vulnerable amplification, evasion, variance, and crit.
2. **Reaction tag-filter inspection.** Tier 1.5's `reactionPenalty` was tag-agnostic — a Lightning Mage attacking a Counter-equipped target with Lightning Strike (magical) was incorrectly penalized, even though Counter's `damageTagsAny: ['physical']` gate would never fire. The penalty needed to inspect each reaction's compiled trigger condition.
3. **Two-action turn planning.** Tier 1.5's one-decision-per-call cadence missed patterns like "step onto a tile that puts a wounded enemy in Strike range AND catches an extra enemy in a Chain Lightning AoE." Joint (Move + Act) planning would close the loop.

Plus two stretch items bundled in:

- **Polarity metadata on StatusEffectType.** Tier 1.5 hardcoded `KNOWN_BUFF_STATUS_IDS` in `src/ai/basic.ts` to gate the buff phase. A clean fix lives in content as `aiHints.polarity`.
- **Cone / line caster-anchored AoE direction planning.** Tier 1.5 skipped Maelstrom and Flame Lance because the AI didn't know how to choose a direction.

This ADR records the substrate decisions for all five.

## Decisions

### 1. Damage projection — registry-swap reusing `runDamagePipeline`

`src/ai/projection.ts` ships `projectExpectedDamage(state, catalog, attacker, target, ability, targetCount?) → number`, which runs the live `runDamagePipeline` with a custom `DamageHandlerRegistry` that swaps the three random-rolling handlers for deterministic expected-value variants:

| Handler ref | Live behavior | Projection variant |
|---|---|---|
| `variance_roll` | Rolls `r → factor in [min, max]` | Appends `(min + max) / 2` as a multiplier |
| `evasion_check` | Rolls hit vs `hit_chance`; on miss, sets `ctx.hit = false` (and finalize zeroes damage) | Appends `hit_chance` as a multiplier; never zeroes hit |
| `crit_roll` | Rolls `r < crit_chance/100`; on hit, appends `crit_multiplier` | Appends `1 + p × (crit_multiplier - 1)` as a multiplier |

Every other handler is reused from `defaultDamageHandlers` unchanged: physical / magical / healing base, resistance composition, on-damage hooks (Vulnerable's ×1.5 multiplier rides this chain naturally), clamp, finalize. The swap is exact and single-call.

**Why registry swap rather than sample-and-average:** the random handlers are the only stochastic stages, and each has a known closed-form expectation. Sampling N times would give an approximation at N× cost; the swap is exact at 1× cost. The catalog's pipeline registry is already a parameter to `runDamagePipeline`, so the substitution is a one-line override.

**Drift guard:** `src/ai/projection.test.ts` includes a contract test that asserts `projectExpectedDamage ≈ mean(N live runDamagePipeline runs)` within ±15% (physical with crit + evasion) and ±10% (magical with crit) over 600 samples. When a future content change adds a new random handler, this test fails with no projection variant defined — the intended pressure point.

**Reactions are NOT projected.** Reactions live outside the damage pipeline (in `runOnActionTargeted`); the AI's `reactionPenalty` scoring layer handles them separately. Same for `selfDamage` costs — dispatcher-emitted, not pipeline-driven.

### 2. Reaction tag-filter inspection — `reactionFields` decorative field + `compileReactionAbility` helper

`PassiveAbilityDefinition` gains an optional `reactionFields?: ReactionAbilityFields`. Populated by a new `compileReactionAbility(base, fields)` helper in `src/engine/abilities/reaction-compiler.ts` that bundles `compileReaction` (which produces the `PassiveHookRegistration[]`) with the same `fields` attached as decoration. Authors call:

```typescript
export const counter = compileReactionAbility(
  { id, name, bucket, baseCost },  // identity / cost
  {                                  // reaction shape
    triggerOn: ['onActionTargeted'],
    triggerCondition: { type: 'damage_received', damageTagsAny: ['physical'], damageTagsNone: ['healing'] },
    effects: [{ kind: 'use_ability', abilityId: abilityId('attack'), targetSelector: 'attacker' }],
  },
);
```

The AI's `reactionPenalty` reads `reactionFields.triggerCondition` per equipped reaction and only counts reactions whose tag filters (`damageTagsAny` / `damageTagsNone`) match the proposed ability's damage tags. Counter (physical-only) doesn't penalize a Lightning Strike (magical); Discharge (no tag filter) penalizes any incoming non-healing damage.

**Helper-bundled rather than author-attached:** the alternative was to ask authors to set `reactionFields: { ... }` manually alongside `hooks: compileReaction({ ... })`. That allows the two to drift — an author could update one without the other and the AI would silently ignore the new logic. The bundled helper keeps them in lockstep by construction. Direct `compileReaction` use is still supported for tests; reactions built that way lack the decoration and the AI treats them as always-firing (safe default).

**`minDamage` is not consulted by the AI.** The trigger condition can specify `minDamage: 1` (Smolder, Discharge, Tidal Pull, Earth Resilience) to require actual landed damage. The AI optimistically treats this as "would trigger" — refining requires running the projection inside the penalty calculation, which adds cost without much accuracy (typical `minDamage` is 1; projected damage is non-zero for any positive coefficient).

### 3. Two-action joint planner — `(destination, ability, target)` enumeration

`src/ai/basic.ts` gains `pickJointActOrMove(state, catalog, actor, ...)` that enumerates every (destination, ability, target) triple across the actor's reachable destinations. For each destination it calls `bestActFromSource` (the score-only inner loop, no `validateAction` required) to find the highest-scoring Act from that source. The chosen plan determines the commit:

- **Best plan's destination = actor's current position:** validate and commit the Act now.
- **Best plan's destination ≠ actor's current position:** validate and commit the Move. The next AI call recomputes from the new position; `bestActFromSource` will return the same Act (state is otherwise unchanged) and the orchestrator commits it on the next step.

Per-step move-cost dampening (`MOVE_TIE_BREAK_PENALTY = 0.001`) breaks ties in favor of staying put — without it, the AI might detour for cosmetic reasons.

**Affordability filter applied upfront.** `enumerateOffensiveAbilities`, `enumerateHealingAbilities`, and `enumerateAllyBuffAbilities` all filter by `actor.vitals.mp >= ability.mpCost`. Without this, the planner would happily score Power Attack (4 MP) on a Knight with 0 MP, pick it as the best plan, and `validateAction` would reject at commit time — the orchestrator would fall back to a useless distance-closing move. The filter pushes the validation forward into the score phase.

**Pure function.** Same `(state, catalog)` always yields the same decision. Joint planner is a function of state at decision time only; no inspection of the orchestrator or the action log.

**One-call cadence preserved.** The orchestrator's `step()` → controller → commit loop is unchanged. Joint planning happens inside the AI's decision; the orchestrator commits one action per step. "Move then Act" is two calls (Move first, then Act); the joint planner ensures the Move was Act-aware.

### 4. Polarity hint — `StatusEffectType.aiHints.polarity`

`StatusEffectType` gains `aiHints?: StatusAiHints` where `StatusAiHints = { polarity?: 'buff' | 'debuff' }`. The 6 v1 buff statuses (`haste`, `regen`, `movement_self_buff`, `pa_up`, `ma_up`, `crit_modifier`) declare `aiHints: { polarity: 'buff' }` in their content definitions. Debuff statuses are left undeclared — the AI's `isBuffStatus(catalog, typeId)` returns true only when polarity is explicitly `'buff'`, so undeclared statuses are treated as not-a-buff (the safer default).

**Why declare buffs but not debuffs:** the AI's only consumer of polarity is "is this status a buff?" (used by the buff phase to pick ally-targeting status appliers and by `isOffensive` to exclude pure-buff appliers from the offensive pool). The asymmetric requirement — only buffs need declaration — keeps the migration small (~6 status files vs ~22) without losing safety. Future polarity-aware logic that needs to distinguish "debuff" from "neither" can extend the hint enum or add a `polarity: 'debuff'` declaration.

**Decoration only — engine never reads it.** Pure metadata for AI consumers. Future content-aware tools (UI tooltip color coding, automated playtest scoring) can read it the same way.

### 5. Cone / line direction planning

`aoeTilesAffected(state, catalog, source, anchor, ability, aoe)` in `src/ai/basic.ts` previously returned `[]` for cone and line shapes (deferred to 20b). The session-20b update branches on shape kind:

- **Target-anchored shapes** (diamond, square, cross, custom): footprint blooms from `anchor` (the target tile), no direction parameter.
- **Caster-anchored cone / line** (anchorMode `'caster'`): footprint blooms from `source` (the caster's hypothetical position), oriented toward `anchor` via `cardinalFromTo(source, anchor)`.

The AI's existing tile-enumeration loop in `bestActFromSource` (which iterates every in-range tile as a potential anchor) now produces the right scoring for cone / line — each tile becomes a direction-deriving anchor, and the planner picks the direction (anchor) that maximizes cluster value.

`isOffensive` continues to reject `targeting.kind: 'self'` — no v1 cone / line ability uses self-targeting (Maelstrom and Flame Lance are `targeting.kind: 'tile'` with `aoe.anchorMode: 'caster'`). When a content consumer ships a self-targeted AoE, that gating bridge will need its own decision.

## Consequences

**Positive:**

- Damage projection unifies the AI's offensive scoring across abilities. Vulnerable amplification, crit expectation, evasion, resistance, weapon WP, and chain-bonus scaling all flow through the same code path the live engine runs at cast time. Future damage-pipeline additions compose for free; only new random-rolling handlers need explicit projection variants.
- The reaction-fields decoration formalizes the AI's introspection surface for reactions. Future AI work (reaction-effect-value inspection, multi-trigger handling) extends the decoration without changing the compiler.
- Joint planning eliminates the "Move then Act" coordination gap — a single AI decision considers both legs, even though it commits one at a time. The cadence-preserved shape means orchestrator wiring is unchanged.
- Polarity metadata moves content-side knowledge into content. Future buff statuses (Reflect, Protect, Shell, Float) declare polarity and the AI picks them up automatically.
- Cone / line direction planning lights up Maelstrom and Flame Lance for the AI. Combined with joint planning, the AI now considers "step here, then fan a cone south to catch the cluster."

**Negative / open:**

- **Joint planner cost.** Per-decision work is now O(destinations × abilities × targets) where destinations can reach 25-30 for a moveRange-4 unit on flat terrain, abilities ~5-8 per kit, and targets up to 6 in v1. Each candidate does a `projectExpectedDamage` call (a 7-stage pipeline run). Empirically this is fine on the v1 demo (decision latency well under 100ms), but could grow to a hot path in 8v8 scenarios. Profile if the AI runs every render frame in a future debug visualization mode.
- **Tier-1.5 calibrations are stale.** `MARK_SETUP_WEIGHT = 15` was tuned against the `power_coefficient` proxy where Strike's score on a full-HP Knight was 12. With projection that score is now ~60+ and Mark's setup→exploit branch only wins when the unmarked attack genuinely doesn't kill — a much narrower window. The `MARK_SETUP_WEIGHT` constant was removed; Mark scoring now computes marginal damage gain from Vulnerable directly. Other constants (`SELF_COST_DAMPING_FACTOR`, `BUFF_SCORE_DAMPING_FACTOR`) preserved with their tier-1.5 values; recalibration is a tuning-pass concern, not a tier-2 substrate concern.
- **Tier-1.5 tests required updates.** Two `basic.test.ts` tests asserted tier-1.5-specific behavior that's incorrect at tier 2: "Mark on full-HP target wins over Strike" (Strike one-shots a Knight in tier 2, so Mark's marginal value is 0); "AI penalizes Counter-equipped target with magical attacker" (tag-aware penalty correctly returns 0 for magical-vs-physical-only Counter). Both tests inverted to assert tier-2 reality. New tests added for joint planner and cone direction.
- **`minDamage` ignored in penalty calculation.** A reaction with `minDamage: 5` against an attack projected for 3 damage would not actually fire, but the AI penalizes as if it would. Refining requires running projection inside the penalty calc, which is acceptable cost-wise but adds another point of pipeline-state coupling. Defer until a content consumer makes the distinction matter.
- **Reaction-effect value inspection deferred.** The current penalty is a flat `0.15 × Brave_factor` per matching reaction. A more accurate model would weight by the reaction's own projected damage / debuff value (Discharge's discharge_strike vs Tidal Pull's CT push). Decoration supports this — the reaction's effects are inspectable — but tier 2 doesn't yet derive per-effect impact estimates.
- **Affordability filter is MP-only today.** Other validation failures (range, line-of-sight, pause / silence statuses, etc.) still happen at commit time. MP was the dominant cause; future content with conditional-cast statuses could need expanded upfront filtering.
- **Cone / line scoring uses caster-side `actor` for projection.** The projection pipeline's hooks (Vulnerable, Bulwark Stance, etc.) read attacker/target stats. For caster-anchored cone with the actor at `source`, the projection's `attacker` is a shallow-copy at `source` position. Facing-dependent bonuses (back attack, etc.) compute against `target.facing` and `attacker.position`, which is correct. Non-positional attacker bonuses unaffected.

## References

- `src/ai/projection.ts` (registry swap), `src/ai/projection.test.ts` (drift guard).
- `src/engine/abilities/reaction-compiler.ts` (`compileReactionAbility` helper), `src/engine/catalog/definitions/ability-definition.ts` (`reactionFields` decoration).
- `src/ai/basic.ts` (`pickJointActOrMove`, `bestActFromSource`, `isBuffStatus`, ability-aware `reactionPenalty`).
- `src/engine/catalog/definitions/status-effect-type.ts` (`StatusAiHints`), 6 buff status content updates.
- ADR-0024: Reaction compiler (the foundation `compileReactionAbility` builds on).
- ADR-0030 / ADR-0032: Custom-trigger statuses (Vulnerable's projection-relevant interaction).
- `docs/handoff.md` (session-20a) — listed all three tier-2 items + the two stretch items.
