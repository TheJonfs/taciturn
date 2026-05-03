# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When starting a session, read this file and process every item — act on it, promote it elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a reason. Items do not accumulate. If there are no notes to leave, replace the contents with `_No handoff this session._` so the next session knows the file has been processed.

What belongs here:

- Things noticed but not acted on.
- Implementation choices considered and rejected.
- Suggested scope or sequencing for the next session.
- Watch-for items and open questions that aren't ADR-worthy.

What does *not* belong here:

- Decisions (those are ADRs).
- What changed (that's the commit message).
- System design (that's the design docs).
- Long-running plan (that's `docs/roadmap.md`).

---

## From session 2026-05-03 (damage pipeline + reactions)

### Suggested next-session scope

Roadmap session 9: **Turn flow.** Wraps the engine into a complete turn cycle. Concrete deliverables per `docs/design/turn-structure.md`:

- Turn-skip handling: Stop blocks the whole turn (skip turn_start budget setup, skip to turn_end). Sleep / Petrify likewise. The skip path emits `turn_start` with `outcome.skipped: true` and a `skipReason`; `turn_end` follows immediately with the right CT cost.
- Facing choice handling. After a unit's last act commits, the engine prompts for a final facing direction; the action loop hands the controller a `set_facing` opportunity before `turn_end`. Wait skips this (the design doc says wait-with-facing is a UI affordance, not an engine concept).
- Battle-outcome evaluation. After every turn_end, `evaluateBattleOutcome(state)` checks each `BattleConfig.victoryConditions` clause and produces an `OngoingOutcome | DecidedOutcome`. v1 conditions: `'eliminate_team'`, `'eliminate_unit'`, optional turn-limit. Once the outcome decides, no further turns are scheduled; the action log carries a `battle_decided` system event.
- Turn-budget mid-turn modifiers. Today the budget is set at turn_start and decremented as actions commit. Statuses that *grant* an extra Move or Act mid-turn (a one-shot Quicken-style effect) need the budget to be readable / writable through a hook surface. The design doc names "Per-turn budgets" as the answer; session 9 lights up the `modifyStatQuery`-equivalent for budgets (a new hook name like `modifyTurnBudget`), or — alternative — actions emit `budget_grant` system actions that the reducer applies. Pick at session 9; lean toward the action-emission pattern since it's already how everything else works.
- The `evaluateBattleOutcome` test should include the case where a Counter chain's final reaction KOs the last enemy unit — proving the chain processor reaches a stable state before victory is read.

Two specific carries from this session that session 9 should fold in:

1. **Reaction validation throws on out-of-range counters.** Today validation runs the full range check on a reaction; if Counter's target is out of (the ability's) range, the chain action fails and `commitAction` throws because mid-chain validation failure is a programmer-error path. The right behavior per the design intent is a "fizzle" — the reaction silently drops. Session 9 lands the fizzle (probably by relaxing the chain validation rule to "validation failure on a chain action drops it rather than throwing, with a `reaction_fizzled` system event"). The session-7 chain-depth-cap throw stays loud; this is a different category.
2. **Reaction cap applies even when the reaction would change the world meaningfully.** Today a unit gets one Counter per turn; the second physical hit produces no reaction. That's correct for v1 but worth flagging — "more than one reaction per turn" is on the FFT-feature radar (Counter Magic + regular Counter, etc.) and the ruleset's `perUnitPerTurnReactions` is the single knob. When a content design needs per-passive reaction caps (Counter once, Magic Counter once independently), the bookkeeping shape on `turnState.reactionsUsedThisTurn` widens from `Map<UnitId, number>` to a per-passive map. Defer until content forces.

### Things noticed during the damage-pipeline session

- **The damage pipeline does not write the `hit` field; it stays `true` for v1.** `DamageContext.hit` is initialized to `true` and no v1 handler flips it. The reducer reads `ctx.hit` when applying damage (a missed attack still goes through the pipeline but applies 0 damage) — when an evasion handler ships, it sets `hit: false` at the target stage, the cap stage clamps to 0, and the apply step is a no-op. The shape works; just no consumer yet.

- **`resolveUnitTarget` returns `null` for `self`-targeted abilities.** The damage path is gated on `targetUnit !== null`, so self-target damage abilities don't run the pipeline today. When a self-heal (self-targeted Cure) ships, the gate widens — pass `actor` as both attacker and target. v1 has no such ability; the gate is the right v1 behavior.

- **`DamageContext.attacker` and `DamageContext.target` are full Unit refs, not IDs.** Pipeline handlers use them inline rather than re-resolving from state every time. This is safe because the pipeline is read-only against state — handlers may update `ctx.attacker`/`ctx.target` (a hypothetical "swap target" handler), and the reducer reads from `ctx.target.id` to apply final damage to the *current* state's view of that unit (which may differ from `ctx.target` if a chain action mutated the target between the pipeline run and the apply step — but that doesn't happen in v1; the pipeline runs and the apply happens in the same reducer call without intervening commits).

- **`maxHpBase` is on `BaseStats`; `'maxHp'` is the queried name.** This matches the `spd` / `'spd'` pattern. Future content writes Max HP modifiers as `modifyStatQuery` handlers gating on `args.statName === 'maxHp'`. Status / passive / equipment authors don't need to think about whether they're modifying a stored or computed value — they hook the query name.

- **Default-ruleset `damagePipeline.stages.base` lists *both* `physical_pa_wp` and `healing_base`.** Each gates on its tag and short-circuits when the tag isn't present. Listing both is fine because the wrong-tag handler is a no-op. This is forward-compatible with multi-tag abilities (a Smite that's both physical and holy-healing in one fire).

- **`runOnActionTargeted`'s args got `damageDealt` and `damageTags` as optional fields.** Reaction handlers gate on these without re-resolving the catalog. The runner does not pre-filter; reaction passives that *don't* care about damage (a hypothetical "react to any incoming UseAbility" passive) still get a useful `incomingAction`.

- **Status application now branches on post-damage HP.** A target that died to the damage doesn't get the status. The reducer reads `state.units.get(target.id)?.vitals.hp === 0` after the pipeline applies and skips the status path if so. A status-only ability (no `effects.damage`) skips the pipeline and applies unconditionally as before.

- **`ReduceResult<T>` gained an optional `generatedReactions` field.** Only `reduceUseAbility` populates it; the dispatcher (`reduce.ts`) forwards it; `commitAction` reads both arrays. Future reducers that want to emit reactions (a damage-dealing status_tick that triggers reactions, say) populate the same field.

- **`validateAction(state, action, catalog, opts?)` — opts adds `{ isReaction?: boolean }`.** Reaction-aware. Existing call sites still work; the flag defaults to false.

- **The variance roll is mulberry32-style.** Deterministic given `(seed, subIndex)`. Single sub-index (0) per pipeline run today; multi-target abilities will need stable per-target sub-indices (target ID or per-target ordinal).

- **`makeUnit` test fixture defaults: pa=5, ma=4, maxHpBase=100.** Knight-ish. Tests that need a glass-cannon / tank can override per-call.

- **`makeTestRuleset` gained `damagePipelineStages` and `perUnitPerTurnReactions` overrides.** Default still ships the empty stage list (so existing reducer tests stay damage-free); damage-flow tests opt in via `DEFAULT_TEST_DAMAGE_PIPELINE`.

- **Counter content lives at `src/content/abilities/counter.ts`.** Reaction-bucket passive; gates on damageDealt > 0, physical tag, and not-self. Future reactions (Auto-Potion, Reflect) follow the same shape with different gates.

- **The session-7 carry "`onActionTargeted` short-circuits on `blocked`" stays unaddressed because no blocker content shipped.** Counter doesn't block; it returns reactions. When Stop / Don't Move / Silence content lands as `onActionAttempted` blockers, that surface gets exercised. Counter's `onActionTargeted` is post-application; semantics are unrelated.

### Things considered but did not do

- **A separate healing pipeline.** Rejected per the design doc's explicit guidance: "Healing follows the same pipeline structure with sign flipped — worth modeling as the same pipeline with a tag rather than a parallel system, so that effects like 'your healing is reduced when poisoned' are one hook handler rather than duplicated logic." The polarity flip at finalize + clamp at maxHp − hp at cap is the whole difference.

- **Charged-action resolution.** Per the session intro discussion (Q2), kept the session-7 throw. The full plumbing — `reduceUseAbility` creates the ChargedAction + applies Charging; `reduceChargedActionResolve` runs the held effect through the pipeline and removes Charging — needs interruption rules (KO / displacement / target loss) that warrant their own session.

- **Magical formula handler.** Per the session intro discussion (Q1), MVP'd to physical + healing. Cure is healing; no v1 ability is "magical damage." When magical-damage content (Fire, Bolt, etc.) ships in a content-expansion pass, `magical_ma_mult` lands as a new handler ref and joins the base stage list.

- **Evasion / hit checks.** Out of scope. Today every action hits. When evasion ships, it's an attacker-stage handler that runs an accuracy roll (using a sub-index of the seed) and may set `ctx.hit = false`; the cap stage clamps to 0 on miss; the apply step no-ops.

- **`ctx.attacker` / `ctx.target` as IDs only (no Unit refs).** Considered for the rule-4 (identity by ID) purity, but the pipeline doesn't mutate state mid-run, so refs stay valid. Inline refs save handlers a `getUnit` call per access.

- **Per-handler reaction caps.** Considered for the design's "Counter once + Magic Counter once independently" path. Rejected as future-proofing without a v1 consumer; today's `Map<UnitId, number>` is enough. Widens to `Map<UnitId, Map<HandlerKey, number>>` when content forces.

- **Threading the catalog into PassiveHookContext.** Considered as an alternative to enriching `onActionTargeted`'s args with `damageDealt` / `damageTags`. Rejected: the args-enrichment path is the right shape because the runner already has the catalog, the handler doesn't need to re-look-up the ability, and future hook surfaces (an Auto-Potion checking the target's items) will need richer args anyway.

- **Tracking `direction: 'damage' | 'healing'` on the `DamageContext`.** Defined the field on `DamageResolution` (the post-pipeline summary shape) but the pipeline itself doesn't carry it — handlers read `ctx.damageTags.has('healing')` directly. Less indirection. The `DamageResolution` type ships exported but isn't yet returned to any consumer; reducer consumers read finalDamage + tags directly. Drop `DamageResolution` if no v1 consumer materializes by session 9.

- **Pre-filtering the `onActionTargeted` runner on damage > 0.** Considered — would let Counter-style handlers ignore damage gates. Rejected: the runner knows nothing about handler intent, and handlers that *want* to fire on every targeted action (a "react when targeted" passive) need the un-filtered call. Handlers gate.

- **Computed `maxHp(state, unitId, catalog)` helper alongside `computeSpeed`.** Considered. The cap stage already calls `runModifyStatQuery` with `'maxHp'` and the unit's `baseStats.maxHpBase`. Extracting that into a named helper is cosmetic; `runModifyStatQuery` is already a helper. Add when a second consumer (UI HP-bar render) materializes.

### Open questions for later sessions (not blocking)

- **Reaction fizzle vs. throw on chain validation failure.** When a Counter targets an attacker who's out of the Counter's ability range, validation fails. Today `commitAction` throws on mid-chain validation failure (it's a programmer-error path). The design intent is "fizzle silently" with a `reaction_fizzled` system event. Land alongside session 9's turn-flow / battle-outcome work since it touches the same chain processor.

- **`DamageResolution` shape.** Exported from `engine/types/damage.ts` but no consumer reads it today. The reducer composes its own slice of pipeline output (finalDamage, tags) inline. Either drop the type or wire it through as the pipeline's public return alongside the context. Defer until a UI / log consumer wants a structured per-damage-event shape.

- **Variance sub-indexing.** Single sub-index (0) per pipeline run. Multi-target AoE needs stable per-target sub-indices. Lands when the AoE targeting variant ships.

- **Mid-pipeline status applications affecting resolution.** Per the design's open question — a status saying "next attack against me automatically misses" — when does it fire? Currently positioned at target stage (an `onDamageReceived` handler can set `ctx.hit = false`). When the first such content lands, verify the position holds.

- **Per-ability formula overrides.** v1 ships PA × power and MA × power as the only base formulas. Per-ability formulas (FFT's MA × Y squared for some spells, Charge +X effects, etc.) land as either ability-specific handler refs or a richer DamageSpec with formula refs. Defer until ability content needs it.

- **`charged_action_resolve` running through the same pipeline.** When charged actions land, the resolver runs the held effect through `runDamagePipeline` exactly the same way. The Charging-status removal pairs with the pipeline's apply step. Watch-for: the seed for the charged effect is the *charged-action-resolve* action's seed, not the original UseAbility's seed. Per ADR-0009 / ADR-0010 that's correct (each action gets its own seed); cite it explicitly when content arrives.

- **Onlooker hooks (third-party damage observation).** A status on a *third* unit observing damage between A and B — not modeled today. The hook surface fires on attacker (`onDamageDealt`) and target (`onDamageReceived`) only. Land if content needs it (probably as an `onAnyDamage` runner that walks every unit in the battle).
