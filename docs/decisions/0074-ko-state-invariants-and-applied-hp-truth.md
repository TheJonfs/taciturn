## ADR-0074: KO-state invariants + per-target `hpAfter` (applied-HP truth) + centralized victory-condition check

**Status:** Accepted
**Date:** 2026-05-14
**Amended:** 2026-05-14 (Session 33.5A — post-state absolutes generalized; see amendment at end)

## Context

Chris's first River Ridge playtest surfaced a cluster of bugs that the Session 33.5 brief framed as four separate defects:

- **#2** — a Cure-like heal raised a KO'd unit's HP from 0 to 35.
- **#3** — a "ghost unit" sat at 1 HP with a red X displayed, no KO in the log, still taking turns.
- **#4** — a unit the engine had correctly KO'd did not show the KO indicator.
- **#5** — an extra turn fired after the last enemy of a side was eliminated.

The brief's working hypothesis for #2/#3 was that ADR-0070's KO'd-target healing gate had been applied at one heal-application site but not uniformly — i.e. a missing gate somewhere.

**The current-tree audit contradicted that hypothesis.** Engine-wide there are exactly two runtime HP-increase sites, and *both were already gated*:

- `applyDamageToTarget`'s healing branch — `if (isHealing && currentTarget.vitals.hp <= 0) return state;` (ADR-0070).
- `reduceSystemHeal` — `if (target.vitals.hp <= 0) { ...applied: 0 }` (the symmetric gate, predating ADR-0070).

(`fillVitalsFromComputedMaxes` is the only other HP write, and it runs once at battle construction.) There is also **no separate KO flag**: a unit is KO'd iff `vitals.hp <= 0`, derived freshly everywhere it matters (`isKO` in the scheduler, `validateAction`, `evaluateBattleOutcome`, etc.). So there is no "partial KO state" that a stray heal could leave half-cleared, and HP-rise-from-zero is already structurally impossible through both gated paths.

The real root cause of #2/#3/#4 is in the **renderer**, not the engine. `Animator.buildFlashFromTargets` settled a unit's visual HP with `hpAfter = snap.hp - damage + healing` — arithmetic on the *previous snapshot* using the per-target result's *computed* `damage`/`healing` magnitudes. When the engine gates an application, the per-target result still records the computed magnitude (e.g. `healing: 35`) for the action log, but applies nothing. The animator then did `0 - 0 + 35 = 35` and showed a KO'd unit at 35 HP with no red X (`koAfter: 35 <= 0` is false). Once the snapshot drifted from engine truth, every subsequent flash compounded the drift — which is the "1 HP ghost" of #3.

Bug #5 is unrelated to the heal cluster: `evaluateBattleOutcome` was invoked only inside `reduceTurnEnd`. A `charged_action_resolve` (a between-turns scheduler event, not a turn) that eliminated the last enemy never triggered the check, so the scheduler advanced to the next `turn_start` before the battle closed.

## Decision

**(1) Codify the KO-state invariants (no new gate needed — the gates already hold).**

- **A KO'd unit (`hp <= 0`) receives no healing.** Enforced at both runtime heal-application sites. Holds for explicit heals (Cure and future content), absorption tag-flips (ADR-0057), and Regen-style `system_heal` ticks alike.
- **KO is derived, never stored.** A unit is KO'd iff `vitals.hp <= 0`. There is no KO flag to set, clear, or leave inconsistent. The transition is symmetric and automatic in both directions — which is *why* the gates are sufficient: block the heal and HP simply cannot leave 0.
- **HP-rise-from-zero is therefore structurally impossible in v1.** Future Raise / Phoenix Down content will be an explicit, separate application path that opts out of the gate (paralleling the `system_apply_status` "explicit revive abilities are their own opt-in" pattern) — not a side effect of ordinary healing.

No centralized `canApplyHeal` helper is introduced: the two sites are one-line guards that are already correct, and a shared helper for two correct call sites is abstraction the code does not yet need. Codifying the invariant here is the durable record; a third heal-application site is the trigger to revisit the helper.

**(2) The per-target result carries applied-HP truth: `AbilityTargetResult.hpAfter`.**

`resolveAbilityEffect` records the target unit's actual post-application HP (read from `workingState` after the damage/heal pipeline commits) onto the per-target result. `damage` / `healing` remain the *computed* magnitudes — what the action log shows — while `hpAfter` is the *applied* truth. They diverge exactly when the engine gates an application.

`Animator.buildFlashFromTargets` settles `hpAfter` and `koAfter` from `result.hpAfter` rather than re-deriving them. This makes the engine the single source of truth for the number (per the architecture's "renderer reads engine state" rule) and fixes #2, #3, and #4 with one change. It also closes a real engine-side inconsistency that reached beyond the renderer: AI projection and replay assertions consume per-target results, and a result that claims `healing: 35` when nothing was applied is a lie regardless of who reads it.

The action log's KO walker (`deriveKoEvents` in `ui/derived-events.ts`) is the second `hpAfter` consumer. It reconstructs running HP from the log to emit `[ko]` rows; a post-implementation playtest exposed that it (a) initialized running HP from `baseStats.maxHpBase` — the *class base*, which excludes equipment HP — so every equipped unit's tracker started tens of HP low, and (b) re-derived HP by `damage`/`healing` delta arithmetic. A heavy-but-non-fatal hit (a Maelstrom dealing 133 to a 137-HP Wizard's-Robe mage) crossed the walker's phantom zero and emitted a spurious `[ko]` row for a unit the engine had at 4 HP. The fix applies the same principle: initialize from the *computed* max HP (`runModifyStatQuery` for `maxHp`, equipment/status modifiers folded in — `deriveKoEvents` / `derivePerUnitStats` gain a `catalog` parameter), and anchor to `result.hpAfter` when present rather than trusting the delta. `system_damage` / `system_heal` (which carry an applied delta but no absolute HP) keep delta-tracking off the now-correct initial value.

**(3) The victory-condition check is centralized in `commitAction`, fired after every action.**

`reduceTurnEnd` no longer emits `battle_end`. Instead `commitAction` evaluates `evaluateBattleOutcome` after each action in the chain commits; the first action that satisfies a condition enqueues a single `battle_end` (a `battleEndEnqueued` latch prevents a second enqueue while the first is still in the queue). Any action — a unit's turn action, a `charged_action_resolve`, a status tick, a reaction — can be the one that decides the battle, and it decides at the moment it becomes true rather than at the next turn boundary. This also generalizes cleanly to future victory-condition kinds (`reach_tile`, `survive_turns`, `protect_unit`), which are not naturally turn_end-aligned.

The pre-battle phase opts out via a new `CommitOptions.checkVictoryConditions: false`, passed by `runPreBattlePhase` and the orchestrator's pre-battle step. Setup actions (`system_set_ct`, equipment auto-statuses) run before the battle proper; a degenerate-but-valid setup must not "decide" the battle before the first turn fires.

## Rationale

**Why codify rather than re-fix.** The brief expected a missing gate. The audit found the gates complete. Writing an ADR that says "the gates already hold; here is why that is sufficient (KO is derived, not stored)" prevents the next session from re-running the same diagnostic and re-reaching for a helper that isn't needed. The invariant is the deliverable, not a code change.

**Why `hpAfter` over the brief's "snapshot polls engine state."** The brief's decision-3 options were (A) the reducer signals a "KO'd this step" event the animator consumes, or (B) the animator polls engine state each frame. `hpAfter` is neither: the engine reports the post-state on the per-target result the animator *already consumes*, so the flash-finalize architecture is untouched and no new event type or polling loop is added. It is the smallest change that makes the renderer derive from truth, and it happens to also repair the misreported magnitude for every other per-target-result consumer.

**Why `damage` / `healing` stay as computed magnitudes.** The action log says "healed for 35" / "took 78" — the *attempted* number is the player-facing story. `hpAfter` is the *mechanical* result. Keeping both, with clearly separated meanings, serves the log and the renderer without either lying to the other. (How the log should phrase a gated heal — "no effect — already KO'd" vs. suppression — is a downstream formatter concern, unchanged here.)

**Why the victory check moved to `commitAction`, not "after turn_end at the right edge."** The brief's decision-4 alternative B was to keep the check at the turn boundary but fix its ordering. The bug is not an ordering slip — `charged_action_resolve` genuinely has no turn_end. Checking after every commit removes the entire class of "this action path forgot to check" bugs, and the check is cheap (a unit-count scan per team). The `battleEndEnqueued` latch keeps it idempotent within a chain.

**Why pre-battle opts out via a flag rather than a GameState phase field.** The phase distinction already lives in the orchestrator (ADR-0071); `commitAction` is engine-level and called by the orchestrator. A `CommitOptions` flag lets the two known pre-battle call sites opt out explicitly without widening the `GameState` shape for a setup-only concern. The default is "check" — combat callers inherit the right behavior with no change.

## Consequences

- **`AbilityTargetResult` gains an optional `hpAfter`.** Backward-compatible: existing consumers ignore unknown fields; the animator reads it, with the pre-existing `damage`/`healing` arithmetic retained only as a fallback for results that don't carry it (tile-kind targets never reach the flash unit-spec path; unit-kind targets always carry it in v1).
- **`reduceTurnEnd` no longer emits `battle_end`.** Tests that called `reduceTurnEnd` directly and asserted `battle_end` in its `generatedActions` would need updating — none existed; the battle-outcome integration coverage runs through `commitAction` and is unaffected.
- **`commitAction` signature gains an optional `options` parameter.** All combat call sites are unchanged (default checks). The two pre-battle call sites (`runPreBattlePhase`, `DemoOrchestrator`'s pre-battle drain) pass `{ checkVictoryConditions: false }`.
- **`deriveKoEvents` / `derivePerUnitStats` gain a `catalog` parameter.** Both UI callers (`formatActionLog`, `ResultsScreen`) already hold a `catalog`; the walker needs it to compute each unit's true max HP. `derived-events.test.ts` passes `loadDefaultCatalog()`.
- **Battle-end now fires mid-chain.** A `charged_action_resolve`, reaction, or status tick that eliminates the last enemy closes the battle in the same `commitAction` call; the existing battle-decided guard at the loop head drains anything still queued. Visible to callers as `battle_end` appearing in `committed` for that action rather than for a later `turn_end`.
- **Replay determinism preserved.** All changes are deterministic given `(state, action, seed)`. `hpAfter` is a read of committed state; the victory check and the KO walker are pure evaluations; the pre-battle opt-out is a static call-site flag.
- **Tests:** +7 — two in `session-33-5-integration.test.ts` (`hpAfter` reports applied truth on a gated heal and on ordinary damage), one in `charged-action-integration.test.ts` (`charged_action_resolve` KO of the last enemy emits `battle_end` in the same commit and the scheduler then refuses to advance), two in `animator.test.ts` (flash settles HP/KO from `hpAfter` — KO'd-stays-KO'd and live-target-heals-correctly), two in `derived-events.test.ts` (the KO walker anchors to `hpAfter` — a heavy non-fatal hit emits no phantom `[ko]`; a hit leaving the target at 0 emits a KO regardless of the `damage` magnitude). Total: 975 passing across 81 files.

## Alternatives considered

**A centralized `canApplyHeal(unit)` / `applyHealSafely` helper.** The brief's decision-1 option B. Rejected for v1: both heal-application sites are already correctly gated one-liners; a shared helper for two correct call sites is premature. The invariant is codified here instead; a third heal site is the trigger to revisit.

**Treating #2/#3 as engine heal-gate bugs.** Rejected after the audit — the gates are complete. Pursuing a "missing gate" fix would have shipped a no-op change and left the actual (renderer) bug in place.

**Animator polls engine state each frame (brief decision-3 option B).** Rejected — a larger architectural change (threading post-commit state into the animator, per-frame derivation) than the bug warrants. `hpAfter` on the existing per-target result achieves "derive from truth" without touching the flash-finalize model.

**A "KO'd this step" event from the damage reducer (brief decision-3 option A).** Rejected — it only addresses the KO-indicator half (#4) and not the ghost-HP half (#2/#3), which is about the *number*, not just the KO bit. `hpAfter` covers both.

**Keep the victory check at turn_end, fix its ordering (brief decision-4 option B).** Rejected — `charged_action_resolve` has no turn_end; the gap is structural, not an off-by-one. Checking after every commit removes the class of bug.

**A `phase` field on `GameState` to gate the pre-battle opt-out.** Rejected for v1 — the phase already lives in the orchestrator (ADR-0071); a `CommitOptions` flag at the two known pre-battle call sites is a smaller seam than widening the state shape for a setup-only concern.

## References

- `src/engine/types/action.ts` — `AbilityTargetResult.hpAfter`.
- `src/engine/actions/reducers.ts` — `resolveAbilityEffect` records `hpAfter`; `reduceTurnEnd` no longer emits `battle_end`; `applyDamageToTarget` / `reduceSystemHeal` KO'd-target gates (unchanged, codified here).
- `src/engine/actions/commit.ts` — `CommitOptions`; the post-commit victory-condition checkpoint + `battleEndEnqueued` latch.
- `src/engine/setup/create-initial-state.ts`, `src/app/demo/orchestrator.ts` — pre-battle call sites pass `checkVictoryConditions: false`.
- `src/renderer/animator.ts` — `buildFlashFromTargets` settles HP/KO from `result.hpAfter`.
- `src/engine/actions/session-33-5-integration.test.ts`, `charged-action-integration.test.ts`, `src/renderer/animator.test.ts` — regression coverage.
- ADR-0057 — resistance absorption activation via tag-flip (the absorption heal still gates here).
- ADR-0070 — the `applyDamageToTarget` KO'd-target healing gate (this ADR codifies the invariant it introduced and extends the renderer side).
- ADR-0071 — pre-battle action-source + orchestrator phase (the pre-battle opt-out composes with this).
- `docs/design/turn-structure.md` — "Battle outcomes" (the victory-condition checkpoint moves from turn_end to per-action).

---

## Amendment (Session 33.5A, 2026-05-14): post-state absolutes generalized to MP + system damage/heal

### Context

A post-Session-33.5 architectural review framed the bug cluster this ADR fixed (#2/#3/#4 — animator HP arithmetic; the phantom `[ko]` — KO-walker HP arithmetic) as instances of **one pattern**: a UI/renderer consumer wants an *absolute* post-state value, the engine outcome only reports a *magnitude/delta* (`damage`, `healing`, `applied`, `mpSpent`), so the consumer reconstructs the absolute by arithmetic on its own prior value — which drifts whenever the engine gates or clamps an application. `hpAfter` on `AbilityTargetResult` closed this for HP on ability per-target results. The same gap remained in three places: animator MP settling (a latent bug — the same drift, just less scrutinized because MP swings are smaller), the KO walker's residual delta-reconstruction for `system_damage` / `system_heal`, and the dead `UnitVisualSnapshot.maxHp` field.

### Decision

**The principle generalizes: every engine outcome that moves HP or MP reports the applied *absolute* alongside the magnitude. UI/renderer consumers settle from the absolute; they never do arithmetic on magnitudes.** The magnitudes (`damage`, `healing`, `applied`, `mpSpent`, `sourceApplied`, `targetApplied`) stay — they are the action-log's player-facing story — but they are no longer load-bearing for any consumer that needs a post-state value.

New outcome fields, all optional, all populated from committed `workingState` in the reducer, all populating the *unchanged* value on gated/no-op paths (so a consumer never has to special-case "the engine did nothing"):

- `UseAbilityOutcome.mpAfter` — caster MP after the cast (instant path *and* the charged-cast commit, which deducts MP up front).
- `ChargedActionResolveOutcome.mpAfter` — caster MP at resolve. A charged cast's MP was spent at the `use_ability` commit, so this is the *unchanged* current value; it keeps the renderer anchored without re-deriving.
- `SystemMpDrainOutcome.sourceMpAfter` / `targetMpAfter` — both ends of the transfer. Populated per-unit; absent only for an end not in state.
- `SystemDamageOutcome.hpAfter` / `SystemHealOutcome.hpAfter` — target HP after application. Engine-clamped — an overkill `system_damage` reports `hpAfter: 0`. Populated on the gated KO'd-target paths with the unchanged value; absent only for a target not in state.

Consumer changes:

- **`Animator.buildFlashFromTargets`** settles caster MP from `mpAfter` — the `mpDelta = -(outcome.mpSpent)` arithmetic is gone. The charged-cast commit, previously a bare `pause` that never settled MP (a latent visual gap), now settles the caster's MP bar in sync with a brief cast beat.
- **The `system_mp_drain` animator path** settles both ends from `sourceMpAfter` / `targetMpAfter`.
- **The `system_damage` / `system_heal` animator paths** settle HP from `outcome.hpAfter` — the `snap.hp ∓ applied` arithmetic is gone. (This was an audit-revealed fourth delta-arithmetic site; folded into the same pass.)
- **`deriveKoEvents` (`ui/derived-events.ts`)** anchors to `hpAfter` for *every* HP-changing action type. The running-HP map is now purely a "last reported HP" cache; KO detection is the positive-to-≤0 crossing on reported values; **no reconstruction branches remain**. `damageDealtByAction` returns engine absolutes only.
- **`derivePerUnitStats.damageTaken`** now reports **absorbed-by** (actual HP lost, `before - hpAfter`) rather than **dealt-at** (summed `r.damage` magnitude). A 133-damage hit on a 4-HP unit tallies 4, not 133. `damageDealt` / `healingDealt` stay as dealt-at magnitudes — an actor "dealt" / "healed for" what it threw, regardless of overkill / overheal; the asymmetry is intentional.

**`UnitVisualSnapshot.maxHp` (the animator snapshot) is removed**, along with `FlashTargetSpec.maxHpAfter`. The renderer live-reads effective max HP per-frame via `runModifyStatQuery` (S31.5 polish #6, `battle-renderer.ts`) — the snapshot field was captured at mount and never read. (`UnitVisualState.maxHp` / `maxMp` in `unit-layer.ts` are a *different* type, genuinely read by the bar draws, and stay; only `unit-layer.ts`'s wrong mount-time placeholder was corrected — seeded from current vitals, a correct full bar for v1's full-HP-at-start units, overwritten frame 1 by the live-read path.)

### Why an amendment, not a new ADR

The three items are concrete extensions of the *same* decision — "the renderer derives from engine-reported truth" — generalized from one field on one outcome to the full HP/MP outcome surface. The engine-outcome-shape changes are additive and need no independent rationale; a new ADR would carry cost without new design content.

### Defensive fold-in: error boundary around `BattleViewInner`

Orthogonal to the post-state-absolutes work but folded into the same session: a React error boundary (`BattleErrorBoundary` in `BattleView.tsx`) now wraps `BattleViewInner`. A render-time throw — most reliably the content-file HMR path (S33.5 carry-forward) — previously unmounted the React tree to a blank canvas with no recovery affordance. The boundary catches the throw, logs it for dev visibility, and degrades to a fallback panel with a hard-refresh button. It is a defensive add: it does **not** fix the underlying HMR/Pixi-init crash (still carry-forward) — only stops it from black-screening.

### Consequences (amendment)

- **Five outcome interfaces gain optional fields.** Backward-compatible — additive, populated from committed state, deterministic. Replay and AI projection see the absolutes for free.
- **`deriveKoEvents` no longer carries a delta-reconstruction fallback.** `damageDealtByAction` skips any entry without an engine-reported `hpAfter` (tile-kind ability targets; a system damage/heal whose target left state) — those changed no unit's HP, so contributing nothing is correct.
- **`derivePerUnitStats.damageTaken` semantics changed** (dealt-at → absorbed-by). The metric is a stat-report consumer (results screen / future MVP metric); not load-bearing on game state.
- **Tests:** +21 — 11 in `session-33-5a-integration.test.ts` (new — reducer-side population of all five fields, incl. gated/clamped/missing-unit paths), +5 in `animator.test.ts` (MP settle from `mpAfter`; `system_mp_drain` from both absolutes; `system_damage` / `system_heal` from `hpAfter`), +3 in `derived-events.test.ts` (KO walker anchors to `system_damage` `hpAfter`; `damageTaken` absorbed-by on overkill), +2 in `BattleView.test.tsx` (new — the error boundary catches a synthetic throw / passes children through). Existing `derived-events.test.ts` / `action-log-format.test.ts` fixtures updated to carry `hpAfter` (the new contract). Total: 996 passing across 83 files.

### References (amendment)

- `src/engine/types/action.ts` — `UseAbilityOutcome.mpAfter`, `ChargedActionResolveOutcome.mpAfter`, `SystemMpDrainOutcome.{source,target}MpAfter`, `SystemDamageOutcome.hpAfter`, `SystemHealOutcome.hpAfter`.
- `src/engine/actions/reducers.ts` — `reduceUseAbility` / `commitCharged` / `finalizeResolution` (caster `mpAfter`), `reduceSystemMpDrain`, `reduceSystemDamage`, `reduceSystemHeal`.
- `src/renderer/animator.ts` — `buildFlashFromTargets` MP settle; `system_mp_drain` / `system_damage` / `system_heal` cases; `UnitVisualSnapshot.maxHp` + `FlashTargetSpec.maxHpAfter` removed.
- `src/ui/derived-events.ts` — `deriveKoEvents`, `damageDealtByAction`, `derivePerUnitStats`.
- `src/renderer/battle-renderer.ts`, `src/renderer/unit-layer.ts` — snapshot-maxHp cleanup; mount-placeholder correction.
- `src/app/BattleView.tsx` — `BattleErrorBoundary`.
- ADR-0058 — `maxMp` lifted to live `runModifyStatQuery` reads (the sibling pattern the snapshot-maxHp cleanup completes for `maxHp`).
