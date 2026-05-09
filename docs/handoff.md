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
- Comprehensive progress / deferred-work review (`docs/progress.md` is the durable home for that — refreshed periodically, not session-by-session).

---

## From session 2026-05-09 (session 20a: AI tier 1.5 + Burn fan-out fix + grand-handoff refresh)

### Suggested next-session scope

**Session 20b — AI tier 2** per the wave-2 split. Three sub-items composing one solid session:

1. **Stat-aware damage projection.** Replace tier 1.5's `power_coefficient` proxy with real expected-damage projection. The AI should compute, per (actor, ability, target) tuple, an estimate that folds in PA/MA, weapon WP, Faith × Faith, resistance (per-tag signedMax composition), Vulnerable amplification, evasion (with elevation modifier and facing), and crit expectation. The cleanest shape is probably a `projectExpectedDamage(state, catalog, actor, ability, target) → number` helper that mirrors `runDamagePipeline` but skips the side-effect plumbing and uses expected values for randomized stages (variance midpoint, evasion's hit_chance × full_damage, crit's crit_chance × multiplier weighted average). Lives in `src/ai/`.

2. **Reaction tag-filter inspection.** Add `reactionFields?: ReactionAbilityFields` decorative field on `PassiveAbilityDefinition` so the AI can introspect each reaction's trigger condition without running the closure. Extend `compileReaction`'s call sites to populate the field alongside the compiled hooks (or add a `compileReactionAbility(base, fields) → PassiveAbilityDefinition` helper). The AI's `reactionPenalty` then narrows from "any equipped reaction adds 0.15" to "for each reaction whose trigger condition's `damageTagsAny` / `damageTagsNone` filters match the proposed ability's tags, add brave-gated 0.15 × power-proxy of the reaction's effect." Net result: a Lightning Mage attacking a Counter-equipped target with Lightning Strike (magical) doesn't get penalized; a Knight attacking the same target with `attack` (physical) does.

3. **Two-action turn planning.** Lift the AI from one-decision-per-call to (Move + Act) joint planning. The simplest correct shape: enumerate (destination, ability, target) triples; score each as the action's score plus a small "this destination is reachable" bonus; pick the highest. Handles patterns like "step to a tile that's adjacent to two enemies, then cast Chain Lightning anchored on the cluster" that today's two-call cadence fumbles. The orchestrator's one-decision-per-call cadence stays — the AI just commits whichever leg is needed first (Move first, then re-asked for Act). Determinism requires the planner to be a pure function of `(state, catalog)`.

ADRs anticipated for 20b:

- ADR for the projection helper's contract (which stages to include, how to handle randomized vs deterministic stages, where the helper lives architecturally).
- ADR for `reactionFields` decorative field if the consensus is "this is the right shape" (likely yes; it's small and cleaner than the alternatives).

Also worth bundling into 20b if scope allows (each is small):

- **Polarity metadata on StatusEffectType.** Replaces tier 1.5's hardcoded `KNOWN_BUFF_STATUS_IDS` with `aiHints?: { polarity?: 'buff' | 'debuff' }` on the type. Each existing status declares its polarity in its definition. Removes content-side knowledge from the AI. ~30 minutes including content updates across the existing ~22 statuses.
- **Cone / line caster-anchored AoE direction planning in the AI.** Lets the AI use Maelstrom and Flame Lance. Requires picking a cardinal direction that maximizes cluster value. Probably ~1 hour.

If 20b already feels packed, defer those two to a 20c or interleave with content sessions.

### Things noticed during the session

- **Hardcoded `KNOWN_BUFF_STATUS_IDS` in `src/ai/basic.ts`.** The buff-vs-debuff polarity is content-side knowledge leaking into the AI. Tier 1.5 needed this gate (otherwise Magnetic Mark passes `isAllyBuff` and self-targets the actor, since both Static Embrace and Mark are `single_unit + statusEffects + no damage`). The clean fix is `aiHints?: { polarity?: 'buff' | 'debuff' }` on StatusEffectType — declared in content, consumed by the AI. Listed for 20b.

- **Magnetic Mark's actionSpeed direction was misdescribed in session 20.** Per Chris's mid-session clarification: actionSpeed 35 is *faster* than Strike's 30 (CT accumulates faster, charge resolves sooner). The session-20 handoff and ADR-0032's "Magnetic Mark's actionSpeed 35" paragraph both said "deliberately slow" — wrong direction. The value 35 was always correct; only the descriptive phrasing was inverted. The tactical setup→exploit pattern works precisely because Mark resolves *first*. Fixed inline in `magnetic-mark.ts` this session. Out-of-scope to retroactively amend the committed handoff or ADR.

- **Buff dampening is a band-aid for missing multi-turn planning.** The AI's `BUFF_SCORE_DAMPING_FACTOR = 0.3` keeps Static Embrace from dominating because the heuristic doesn't capture "this buff lets next turn's Storm Caller crit harder." The right answer is two-action planning (item 3 above) — but full multi-turn planning is bigger than that. For 20b, the joint-action shape is enough; truly capturing the buff payoff would want N-turn lookahead, which is out of scope. The dampening factor is a knob to leave loose.

- **AoE anchor enumeration is O(range² × abilities × enemies).** For Chain Lightning at horizontal range 4, that's a 9×9 candidate window per ability per enemy. Not a hot path today, but worth keeping in mind if the AI gets called on every render frame in a future debug mode. The current production-AI invocation rate (once per turn) makes this negligible.

- **Chain Lightning's aoeFootprint requires anchor.elevation, not anchor.layer.** Subtle Position-vs-AoeAnchor mismatch — the AI initially passed `{ x, y, layer }` and got empty footprints because `|tile.elevation - undefined| <= verticalTolerance` is always false. Fix: look up the anchor tile and read its elevation. Confirmed working via the AoE Chain Lightning test. Worth flagging for `aoeFootprint`'s caller surface — a more defensive shape would be `anchor: Position` with internal elevation lookup, but that's a bigger refactor across reducer.ts and renderer.

- **Storm Caller's `SELF_COST_DAMPING_FACTOR = 0.25` is a tuned constant.** Tier 1.5's calibration: full-HP 60 target, Storm Caller damped to 36 × 0.25 = 9 (loses to Mark's 15); low-HP 8 target, Storm Caller damped to 270 × 0.25 = 67.5 (loses to Strike's 90). This means the AI essentially never picks Storm Caller — it's always inferior to Mark (high HP) or Strike (low HP). That matches the design intent ("ultimate, used at decisive moments — not casually"). 20b's stat-aware projection might re-enable Storm Caller in narrow scenarios (specifically: when Strike + reactions + crit math says Storm Caller's expected damage minus self-cost beats Strike's expected damage). Today the AI never reaches for it.

- **Pre-existing TS strict-mode test errors persist.** Carried since session 17c; flagged again in this session's progress.md refresh. `tsc -b --noEmit` surfaces them; npm test passes via Vitest's loose mode. Defer to a focused cleanup pass.

### Things considered but did not do

- **Adding `aiHints` polarity to StatusEffectType this session.** Considered as the alternative to hardcoding. Rejected for tier 1.5: the change touches every existing status definition (~22 of them) plus the catalog type. That's ~30 minutes of churn for an item that's not blocking the AI work. Listed for 20b instead, where it can land alongside the projection helper as part of the same content-protocol pass.

- **Per-tag reaction penalty inspection.** Considered (i.e., "Counter wouldn't fire on a magical attack — don't penalize the Lightning Mage for it"). Rejected for tier 1.5: requires either decomposing `ReactionAbilityFields` from a closed closure (not feasible) or adding the decorative `reactionFields` field on `PassiveAbilityDefinition` (~20 minutes of content updates). Listed for 20b as item 2.

- **Raising MARK_SETUP_WEIGHT to make Mark dominate Strike on full-HP targets.** Considered. Rejected — at the right scaling, Mark beats Strike (12 vs 15) on a fresh target but loses to Storm Caller's damped 9. Multi-turn projection would resolve this cleanly; today's heuristic is close enough that Mark fires when it should.

- **Two-action joint planning in tier 1.5.** Considered. Rejected per the session-20 handoff agreement to split — joint planning is half a session on its own and changes the AI's call shape (state-dependent (Move, Act) decisions vs pure-function call). 20b territory.

- **Move-to-buff (closing distance to a buff target).** Considered. Rejected — the buff phase already prefers nearby allies via `targetIsInAbilityRange`; move-to-buff is a multi-turn pattern that needs the joint planner. Tier 2.

- **Inspecting `state.actionLog` for "did I just mark this target?" memory.** Considered as a way to make Mark→Strike sequences happen reliably. Rejected — the AI is stateless by design (pure function of `(state, catalog)`). The log inspection would work but conflates state with history. The cleaner answer is multi-turn projection — Tier 2.

- **Polish-pass refactors on `ai-controller.integration.test.ts`.** Considered when chasing the AoE bounds bug. The test still works as a coarse "AI doesn't crash and ≥ greedy" check; the bounds-check fix in `tilesInAbilityRange` was sufficient. No reshape needed.

### Open questions for later sessions (not blocking)

- **Should AI tier 2's projection helper use `runDamagePipeline` directly or a parallel projector?** Direct invocation gets exact accuracy at the cost of running the seven-stage chain N × M × K times per AI decision (N abilities × M targets × K hypothetical scenarios). A parallel projector that mirrors the math without side-effects is cheaper but drifts when handlers change. Decide in 20b's ADR.

- **Granularity of the `aiHints` shape.** Polarity is the obvious first hint. Other hints that might earn their keep: `damageBlocker?: boolean` (Reflect, Protect when they ship), `criticalForCaster?: boolean` (statuses the AI should prioritize re-applying when they decay). Decide as content surfaces them.

- **AI awareness of own ChargedAction.** When the Lightning Mage casts Magnetic Mark, the resulting `ChargedAction` sits in `state.chargedActions` with the caster's id. The AI's *next* decision call doesn't currently inspect this — it just sees the actor as still-alive. With actionSpeed 35, Mark resolves quickly and Charging clears, so the next AI turn is on a non-charging caster. But for slower Storm Caller casts, the AI would skip multiple turns mid-charge — the `queryTurnSkipped` mechanism handles the engine side, but the AI doesn't model "I'm committed to a follow-up that hasn't fired yet." Tier 2 + adjacent.

- **`SELF_COST_DAMPING_FACTOR` interaction with maxHpBase.** If equipment ships that grants +X maxHpBase (Iron Helm +20, Iron Mail +30 — already in catalog but not equipped on demo), Storm Caller's self-cost rises proportionally. The AI's damping doesn't model that the caster has more *room* for the cost. 20b's projection helper would handle this naturally.

- **Move scoring and AoE.** Tier 1.5's `bestOffensiveScoreFrom` enumerates tiles for tile-AoEs from each candidate destination — a 9×9 × abilities × enemies × destinations call. Cheap today but worth profiling if the demo grows to 8v8 on a 16×16 map. Defer until empirical signal.

### Notes for future ADRs

- **ADR-00X: AI projection helper.** Whatever 20b lands. Cover: stage selection (skip evasion's randomness via expected hit_chance × damage; skip variance via midpoint; skip crit's randomness via E[crit_chance × multiplier]), where the helper lives (`src/ai/projection.ts` or similar), how it stays in sync with engine handler changes (probably: a test that asserts the projection ≈ 100 runs of `runDamagePipeline` for known scenarios).

- **ADR-00Y: Reaction decorative fields.** If the call is `reactionFields?: ReactionAbilityFields` on `PassiveAbilityDefinition`, document the populate-via-author or populate-via-helper choice and the AI's read path.

- **ADR-00Z: Status polarity hint.** If we extend `StatusEffectType` with `aiHints`, document the hint enum (start with polarity; reserve room for damageBlocker, criticalForCaster). Likely a small ADR.
