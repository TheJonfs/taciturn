## ADR-0010: Damage pipeline, reaction enqueueing, and reaction-aware validation

**Status:** Accepted
**Date:** 2026-05-03

## Context

Session 8 lands the damage layer on top of session 7's action loop. The design doc (`docs/design/action-resolution.md` "Damage pipeline") fixes the seven-stage flow — base → attacker → target → environment → variance → cap → finalize — and the resolution-hook ordering. Implementation has to choose:

1. **Where `DamageContext` lives.** The hook signatures `onDamageDealt` and `onDamageReceived` need to name a damage type. Either keep them at `unknown`, define `DamageContext` in `engine/types/`, or define it in a new `engine/damage/` module that hooks/ then imports from.
2. **How handlers register.** A static module-exported map keyed by string ref, a runtime registry passed alongside catalog, or static-named exports referenced directly from the ruleset.
3. **How healing is modeled.** A separate pipeline, the same pipeline with branched handlers per direction, or the same pipeline with a polarity flip at finalize keyed off the `'healing'` tag.
4. **How reactions enter the chain.** Reuse `generatedActions` (and tag at commit time), or split into a separate `generatedReactions` field on `ReduceResult`.
5. **Reaction validation.** Reactions fire during another unit's turn — they fail today's `validateUseAbility` (active-turn check, actsAvailable check). Either skip validation for reactions, split validation into structural-vs-turn-state layers, or thread an `isReaction` flag through.
6. **Default-handler scope for v1.** Whether to ship the FFT-flavored physical formula and the magical formula and elemental amplifications and evasion all at once, or MVP it down to physical and healing.
7. **chargeTicks > 0.** Whether session 8 lights up the charged-action plumbing or keeps the session-7 throw.
8. **Stat additions.** Damage formulas need PA, MA, and a max-HP cap. Either add `pa`/`ma`/`maxHpBase` to `BaseStats` and `'pa'`/`'ma'`/`'maxHp'` to `StatName` (consistent with the existing `spd`/`moveRange`/`jump` pattern), or pull values from per-ability data only.

## Decision

**`DamageContext` lives in `engine/types/`.** Putting it there keeps the layering arrow `types/ → ø` while letting `hooks/` reference it from the same level the rest of its imports come from. The context references its source ability via `sourceAbilityId` (CLAUDE rule 4 — identity by ID); pipeline handlers re-resolve through the catalog when they need ability fields. Unit refs are kept inline because the pipeline does not mutate state mid-run, so the refs stay valid for its duration.

**Handlers register through a registry passed to the orchestrator.** `DamageHandler = (ctx, env) → ctx`. The default registry (`defaultDamageHandlers`) is a string-keyed `Map` exported from `engine/damage/default-handlers.ts`; the default ruleset's `damagePipeline.stages.*` lists handler refs from that map. The pipeline orchestrator takes the registry as a parameter, which lets a future custom ruleset pass its own registry (with handlers the default map doesn't carry) without engine changes. v1 ships the default registry only.

**Healing is the same pipeline with a polarity flip at finalize.** The `'healing'` tag triggers the `healing_base` handler at the base stage (MA × power) and tells the cap stage to clamp at `(maxHp − currentHp)` rather than at 0. The reducer reads the tag set after the pipeline returns to decide whether to add to or subtract from the target's HP. Effects like "your healing is reduced when poisoned" become one `onDamageReceived` handler that reads `ctx.damageTags.has('healing')` rather than a duplicate code path.

**Reactions ride a separate `generatedReactions` field on `ReduceResult`.** The dispatcher (`reduce.ts`) forwards the field; `commitAction` reads both `generatedActions` (enqueued with `isReaction: false`) and `generatedReactions` (enqueued with `isReaction: true`). Today only the damage-bearing UseAbility branch produces reactions; status-tick fan-out from `turn_start` and future system emissions stay on the non-reaction field. The split keeps the existing reducer signatures backward-compatible (the field is optional) while making the reaction tag a property of the *generator*, not of the action's own payload.

**Reaction validation skips active-turn / budget checks; everything else still applies.** `validateAction` accepts an optional `{ isReaction?: boolean }` parameter. When true, `validateUseAbility` runs the actor-existence and KO checks (universal invariants), the ability-exists check, the MP-cost check, and the range / targeting-mode check, but skips the active-turn-belongs-to-actor check and the `actsAvailable > 0` check. `commitAction` passes the queue entry's `isReaction` flag to `validateAction`. This matches the design's "reactions consume from a separate per-unit-per-turn reaction limit" rule without making validation reaction-specific in shape — every other field is the same.

**v1 default handlers cover physical and healing only.** Per the session intro discussion (Q1): MVP the stages. The default registry ships:
- `physical_pa_wp` (base, gates on `'physical'` tag) — `baseDamage = PA × power`.
- `healing_base` (base, gates on `'healing'` tag) — `baseDamage = MA × power`.
- `fire_on_damage_dealt` (attacker) — drives the `onDamageDealt` hook chain.
- `fire_on_damage_received` (target) — drives the `onDamageReceived` hook chain.
- `variance_roll` (variance) — uniform roll within the ability's variance band, deterministic by the action's seed.
- `clamp_min_max` (cap) — floor at 0 for damage; clamp at `(maxHp − currentHp)` for healing.
- `finalize` (finalize) — integer floor, write `finalDamage`.

Magical attacks, elemental amplifications, evasion / hit checks, holy/dark interactions, environmental modifiers (elevation differential, weather) all add as additional handlers later — the pipeline supports them today; only the registry and ruleset stage lists grow.

**chargeTicks > 0 stays a throw.** Per the session intro discussion (Q2), charged-action resolution is its own subtle problem (KO interruption, displacement, target-loss cancellation) and lands as a separate session. The session-7 throw remains.

**`pa`, `ma`, `maxHpBase` are added to `BaseStats`; `'pa'`, `'ma'`, `'maxHp'` to `StatName`.** Following the same stored-baseline / hook-modifiable-effective-value split as `spd`. The base handlers read the effective stat through `runModifyStatQuery` so attack-up / strength-buff / shell-style statuses compose at the right point. `maxHp` is read only at the cap stage (the only consumer in v1); a future content expansion adding "Max HP +20%" gear registers on `modifyStatQuery` against the `'maxHp'` name and the cap stage reflects it without further engine changes.

## Consequences

- The seven-stage order is architectural and is not reorderable by the ruleset. The ruleset chooses *which* handlers run *within* each stage; the stages themselves are a property of the engine. If a future game design needs a different order (an "evasion before base damage" ruleset, say), that's a flag-day engine change, not a ruleset edit.

- **Reactions are validated, just with a relaxed rule set.** This means a Counter that targets a unit out of melee range still fails validation — the chain action throws, surfacing the bug. Reactions that produce *invalid* (vs. capped) actions are programmer errors in the content. Today only Counter is exercised; future Auto-Potion / Reflect content surfaces edge cases here.

- The `damageDealt` / `damageTags` enrichment of `onActionTargeted`'s args is a hook-surface widening. The new fields are optional, so existing handlers keep working — but content that wants to react to non-damage actions (a "respond when targeted by any spell" reaction) still gets a useful `incomingAction`. The runner does not pre-filter; handlers gate.

- The damage handler registry is engine code. Custom rulesets that want extra handlers must pass a richer registry to the pipeline. v1 ships the default; no production caller needs the override path yet.

- **Status application now branches on post-damage HP.** Per the design doc's "Status application runs after damage application" rule, a target that died to the damage doesn't get the status. The reducer reads `state.units.get(target.id).vitals.hp === 0` after the pipeline applies and skips the status path if so. The earlier session-7 path (status always applies) is no longer reachable from a damage-bearing ability; status-only abilities (no `effects.damage`) still apply unconditionally.

- **The base stage handlers gate on tags, not on order.** Listing both `physical_pa_wp` and `healing_base` in the base stage's handler list is fine; the wrong-tag handler short-circuits without contributing. This means a future "physical + healing same ability" (a paladin's Smite that damages enemies and heals allies in an AoE, say) lands without a stage-list edit — only the AoE per-target dispatch needs to choose a sign per target. v1 does not yet ship that content; the pipeline supports it.

- **Variance uses a tiny mulberry32-style mixer, not the full per-action seed stream.** v1 has one variance roll per pipeline run. When multi-target abilities ship and need multiple variance rolls in one action, the handler refines to a "(seed, sub-index) → uniform" function with a stable per-target sub-index. The mixer's deterministic output today is enough for v1; the upgrade is local.

- **Validation now has a fourth parameter (`opts: ValidateOptions`).** All existing call sites use the no-opts form (which preserves the old behavior). Reaction-aware callers pass `{ isReaction: true }`. UI code that pre-validates a reaction action (the "did Counter fire?" preview) calls validation with the flag set; non-reaction UI paths are unchanged.

- **Action outcome `damage` and `healing` fields are now populated.** UI code reading `AbilityTargetResult.damage` sees the integer applied to vitals; `AbilityTargetResult.healing` for the inverse. `hit` is also populated (true unless a future evasion handler decides otherwise).

## Open questions / deferred

- **Charged-action resolution.** When the first content with `chargeTicks > 0` lands, `reduceUseAbility` creates a `ChargedAction` + applies the Charging status; `reduceChargedActionResolve` runs the held effect through the pipeline (this same pipeline) and removes the Charging status. KO / displacement / target-loss cancellation needs an `onChargeInterrupted` hook (per the design doc's open question). Defer to its own session.

- **Magical, elemental, holy/dark, evasion, environmental handlers.** These are content-expansion-pass adds, not architecture. The handler registry and ruleset stage list grow; the engine doesn't change.

- **Specific damage formulas per ability (FFT MA × Y squared, Charge +X, etc.).** The `power` field on `DamageSpec` is enough for the v1 demo. Per-ability-formula overrides land as either ability-specific handlers (a `'spell_squared_formula'` ref the ability lists) or a richer DamageSpec with formula refs.

- **Variance sub-stream indexing for multi-target abilities.** When AoE lands, the variance handler needs a stable sub-index (per-target ID or per-target ordinal) so each target's roll is deterministic-and-distinct.

- **Reaction validation and target-out-of-range.** Today a Counter against an attacker who is out of the counter's range fails validation and throws mid-chain. The design doc doesn't say what should happen — silently drop, log a `reaction_capped`-like event, allow the reaction to fizzle? Defer until content surfaces a real case.
