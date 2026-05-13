## ADR-0069: Pipeline stage re-ordering for `fire_on_damage_dealt` + mid-chain drain on freshly-KO'd targets + orchestrator hook-blocked recovery

**Status:** Accepted
**Date:** 2026-05-13

## Context

Session 31's broad playtest (post-equipment-complete milestone) surfaced two engine bugs that both reduce to "the wrong invariant was read at the wrong stage":

1. **Bolt Hammer's Lightning Strike proc fired on missed physical swings.** The contributor (`attackProcContributor`, per ADR-0064) gates on `ctx.hit === true` — a strict equality check that is logically correct. The bug lives upstream: the production damage pipeline registers `fire_on_damage_dealt` at the `attacker` stage, which executes **before** the `target` stage's `evasion_check`. At the time the proc handler is invoked, `ctx.hit` is still its pipeline-default `true` (see `pipeline.ts:83`). `evasion_check` then sets `ctx.hit = false` for a missed roll, but the proc emission has already gone onto `ctx.emittedActions` and propagated to `generatedActions`. Net: every physical swing emits the proc at its rolled chance regardless of evasion.

2. **Rasp Pendant's MP drain silently zeroed when the spell delivered a fatal hit.** The contributor (`finalDamageDrainContributor`, per ADR-0065) pre-fires correctly: it reads pre-damage HP (always > 0 for a valid attack target) and emits `system_mp_drain` with the requested amount. `resolveAbilityEffect` then applies the damage to the target (target HP drops to 0) and forwards the emission to `generatedActions`. By the time `commitAction` reduces the drain action, the target's HP is ≤ 0 — and `reduceSystemMpDrain` short-circuited to all-zero applied fields per ADR-0065's "KO'd target / source is a no-op" decision. The action-log formatter further suppresses zero-applied entries for cleanliness, so the drain became invisible.

Both bugs survived the Session 30 substrate landing because the integration tests use the test-fixture pipeline (`DEFAULT_TEST_DAMAGE_PIPELINE`) which constructed `ctx` manually with `hit: false` for the proc miss case and called `runOnFinalDamage` directly for the drain case — neither test exercised the full production pipeline + chain. The bugs were observable only via playtest.

A coupled display-side bug also surfaced (the unit detail panel's Resistances section was reading `unit.resistances.entries()` directly, bypassing `runModifyResistance`); the fix is mechanical and called out under "Consequences" rather than warranting its own ADR. Same for the maxHp render path, which had captured `unit.baseStats.maxHpBase` at mount.

A third coupled bug — the more critical one — was a soft-lock / white-screen Chris hit when he attempted to Move on a unit afflicted with Don't Move. The menu-gating fix (`src/ui/action-menu.tsx` reads `unit.statuses` and greys the Move / Act buttons) is a UX workaround: it prevents the player from reaching the crash, but doesn't fix the underlying mechanism. The actual crash lived in `DemoOrchestrator.step()`: any `commitAction` failure — including legitimate runtime refusals like `hook_blocked` — threw an `Error`, which propagated through the Pixi ticker pump and crashed the React tree. Future hook-blocking statuses (Berserk, Silence-on-a-cast, etc.) would have hit the same crash through other paths. This ADR includes the root fix: the orchestrator now communicates `hook_blocked` / `validation` / `battle_decided` rejections to the caller via a structured field on the step result, rather than throwing.

## Decision

**Three coupled changes; all engine-internal, no new substrate surface:**

**(1) Pipeline re-ordering.** `fire_on_damage_dealt` moves from the `attacker` stage to the `target` stage, positioned **after** `evasion_check` and **before** `resistance_check` + `fire_on_damage_received`. The `attacker` stage retains its slot in the stage list with an empty handler array; the slot is reserved for future handlers that need to fire pre-evasion against the attacker (no v1 consumer).

After:
```
target: ['evasion_check', 'fire_on_damage_dealt', 'resistance_check', 'fire_on_damage_received']
```

`ctx.hit` is now resolved by the time the proc gate evaluates: a missed swing emits no proc, a hit swing emits at the rolled chance. Replay determinism preserved — the proc roll's per-action seed sub-stream (`PROC_ROLL_SUB_STREAM`, per ADR-0064) is independent of stage order.

The same change applies to `DEFAULT_TEST_DAMAGE_PIPELINE` in `src/engine/catalog/test-fixtures.ts` so test fixtures mirror production.

**(2) Reducer's KO short-circuit dropped.** `reduceSystemMpDrain` no longer checks `targetUnit.vitals.hp <= 0 || sourceUnit.vitals.hp <= 0`. The missing-unit check (`sourceUnit === undefined || targetUnit === undefined`) stays — it protects against ID-points-nowhere fixtures. The contributor's pre-fire HP gate (in `finalDamageDrainContributor`) still filters "target was already dead before the swing"; the mid-chain "swing's damage just KO'd the target" case now transfers MP normally, because the drain semantics are "10% of the damage you just dealt" — applies regardless of whether the target survived.

Symmetric for the source: a Knight whose Bolt Hammer-procced Lightning Strike triggers a Counter that KOs the Knight still receives any queued MP drain in the same chain. MP transfer doesn't depend on HP > 0.

**(3) Ignition's hook-timing comment updated.** The Fire Mage's `ignition` passive carries a comment that read "onDamageDealt fires at the attacker stage, before evasion_check"; that's no longer true. Updated to reflect the new ordering. Ignition's behavior is unaffected: it gates on `'magical'` damage tags, magical damage skips evasion, and the comment is documentation-only.

**(4) `DemoOrchestrator.step()` returns rejections instead of throwing on controller-submitted commit failures.** `OrchestratorStep` gains an optional `rejection: { action; stage; reason }` field. When a controller-submitted action returns `ok: false`, the orchestrator populates `rejection` and returns a step with `committed: []` and the engine state unchanged. The pump (`BattleView.tsx`) reads the rejection for dev-visibility logging; the UI flow's `animationEnded` rAF poll handles menu-return automatically (the renderer stays idle because no actions were enqueued).

Scheduler-emitted system actions (`turn_start`, `charged_action_resolve` from `advanceToNextEvent`) continue to throw on failure — those are engine-internal and any rejection there indicates a programmer error, not a runtime refusal. The narrow path that throws is `DemoOrchestrator.step()`'s first commit at line 93; the controller-submitted path at line 132 no longer throws.

## Rationale

**Stage re-ordering over contributor-side workarounds.** The proc-on-miss bug could be patched by having the contributor consult something other than `ctx.hit` — but `ctx.hit` is the canonical "did the attack land" signal that every existing miss-aware consumer reads. Patching contributor by contributor would put the burden on every future `onDamageDealt` handler author to know that `ctx.hit` isn't reliable at the attacker stage. Moving the registration is one edit; the gate semantics stay simple and correct.

**Why the target stage, not a new stage?** A new "post-evasion-attacker" stage would add architectural surface for no semantic gain. The target stage already runs post-evasion; placing `fire_on_damage_dealt` there gives it the resolved hit value without a new stage primitive. The ordering within the target stage matters: the proc handler fires **before** `resistance_check` so the procced ability's own pipeline run computes resistance fresh (the emission is a separate `use_ability`, not a re-roll of the parent swing's resistance).

**Why between evasion_check and resistance_check, not last in the target stage?** Both positions work for the proc case. Putting it before `resistance_check` matches the conceptual reading ("attacker-side things fire at the attacker stage; resistance modifies for the target after"). The procced ability re-runs the full pipeline on its own, so the parent ctx's resistance state is irrelevant to the emission's downstream behavior.

**KO gate dropped, not narrowed.** Possible alternatives: gate only on the `source` (drop the target check, keep the source check), or check "was the target alive at action-emit time" via a payload-carried flag. The simpler answer is the right one: MP doesn't depend on HP. A KO'd unit can have any MP value; the reducer simply transfers what each side can give/accept. The contributor pre-filter (already pre-31.5) ensures we don't emit a drain at a long-dead target; the reducer's post-31.5 stance is "if the action arrives, transfer what the bounds allow."

**`finalDamageDrainContributor`'s pre-fire HP gate stays.** Its purpose is different: the contributor reads pre-damage HP to determine whether a drain SHOULD emit. A target at HP 0 before the attack isn't a valid victim, so no drain emits. The reducer's stance is: if the drain emitted, transfer what each unit holds.

**Ignition comment update is documentation hygiene.** Stale comments mislead future readers; one quick edit keeps the file truthful. No behavior change.

**Orchestrator rejection over throw.** The throw treated hook_blocked failures as programmer errors. They aren't — they're legitimate runtime refusals: the engine and the active statuses did exactly what they should. The menu-gating fix removes the specific Don't Move / Don't Act path to the crash, but any future hook-blocking status (Berserk, Silence-on-a-cast at resolution, future Confusion/Sleep variants) would have re-introduced the soft-lock through a different click sequence. Routing rejections back to the caller via a structured field is one structural change that covers all current and future hook-blocking content.

**Why no useTurnFlow change.** The UI flow's `animationEnded` event (fired by the rAF idle poll once `renderer.isIdle()`) already has a global handler that transitions from any state back to `action-menu` (or `idle`). When a controller-submitted action is rejected, no actions enqueue on the renderer — so the renderer is already idle, the rAF fires `animationEnded` on the next frame, and the menu returns to top-level automatically. No flow reducer change needed; no toast/feedback layer to plumb. The orchestrator-side fix is self-sufficient.

**Why scheduler-emitted commits still throw.** Those represent engine-internal commits (`turn_start` after `advanceToNextEvent`). A failure there indicates a programmer error: the engine emitted an action it should validate against itself. Keeping the throw narrow preserves the "fail loud" discipline where it's load-bearing without surfacing it for legitimate runtime refusals.

## Consequences

- **Damage pipeline `attacker` stage is empty in v1.** Reserved for future content. Symmetric to the `environment` stage which has been empty since session-14.

- **`fire_on_damage_dealt` runs once per per-target damage event at the target stage.** AoE casts still call the pipeline per target; the per-target stage order remains as authored, so the proc rolls once per target with its own seed sub-stream slot. No new chain behavior.

- **Bolt Hammer's effective proc rate drops to 25% × hit-rate.** A 75%-accuracy swing now produces an effective ~19% proc-per-attempt rate, matching the equipment doc's framing. Playtest read: the prior "fires on every swing regardless of accuracy" behavior was visually obvious and felt off; the corrected behavior matches the design intent.

- **Rasp Pendant's drain now lands on fatal hits.** A Lightning Mage who casts a finishing-blow spell with Rasp Pendant equipped gains 10% of the final damage in MP, even when the target is KO'd. Verified end-to-end via session-31-5 regression test.

- **Ignition's emission still works.** Magical damage skips evasion (no hit roll); the proc-handler stage now runs `evasion_check` (no-op for magical), then Ignition's `passiveHook('onDamageDealt')` (emits `system_apply_status`), then `resistance_check` + `fire_on_damage_received`. Same emission chain as pre-31.5; the only difference is comment hygiene.

- **Display-side resistance fix (unit detail panel) is a coupled-but-distinct change.** The panel's Resistances section was reading `unit.resistances.entries()` directly without consulting `runModifyResistance`. Session 31.5 rewrites the section to walk a fixed elemental-tag set, thread each through `runModifyResistance`, and include the tag if native exists OR a contributor returns non-zero — matching `composeResistance`'s inclusion rule. No engine substrate change; one read site rewritten.

- **maxHp lift to per-frame read.** Mirroring ADR-0058's maxMp pattern, the renderer now reads `maxHp` per frame via `runModifyStatQuery` rather than capturing `unit.baseStats.maxHpBase` at mount. The snapshot's `maxHp` field is retained for backward shape compatibility but unused at the read site.

- **MP snapshot tween (polish #5 partial).** The animator now tracks `mp` on `UnitVisualSnapshot` so MP changes settle in sync with the action's flash, not ahead of it. Statuses still snap to current engine state — a per-action-type status tracking pass remains future work.

- **`OrchestratorStep.rejection` is optional and backward-compatible.** Existing callers that ignore the field (everything pre-31.5, plus existing tests) continue to work — a step with `committed: []` is the same shape they already handle when the controller returns `pending`. The new field surfaces the failure mode that previously crashed the pump.

- **Replay determinism preserved.** Rejections don't enter the action log; the engine state is unchanged when a rejection fires. Replays that don't include the rejected action produce the same trace as before. (Replay didn't include the rejected action pre-31.5 either — the throw happened post-validation but pre-state-change, so the action never landed in the log; the only behavior change is whether the React tree survived.)

- **Tests: 846 passing pre-fix → 846 passing post-fix.** Session-30 integration tests' "KO'd target is a no-op" test was updated to reflect the new semantics (drain transfers even on KO'd target; the contributor pre-filter handles the "already-dead before the swing" case). One ruleset assertion (`stages.attacker` / `stages.target`) updated to match the new ordering. No new tests in this ADR; session-31-5 regression coverage is in `session-31-5-integration.test.ts`.

## Alternatives considered

**Patch the contributor to read a "resolved-hit" flag.** Rejected — would push the timing concern onto every future `onDamageDealt` handler author. The hook surface should mean what its name suggests; "damage dealt" implies a resolved hit.

**Add a new stage `post-evasion` between target and the rest.** Rejected — single-handler stages are architectural overkill for this gain. The target stage already runs post-evasion.

**Cap the proc gate at the runner level (return ctx unchanged if `ctx.hit` is undefined).** Rejected — the bug is order-of-execution, not data-validity. The runner-level patch would silently swallow the gate's intent rather than fix it.

**Narrow the reducer's KO gate to source-only.** Considered — keep the source check (a KO'd source can't gain MP). Rejected as needless asymmetry: a KO'd source CAN still be the recipient of drain math (the resulting MP delta is moot but recorded). Simpler to drop both checks; the missing-unit check still protects against invalid IDs.

**Mark the drain action with a "was-fatal" flag at emission time so the reducer can branch.** Rejected — emission time would have to know whether the attack will be fatal, which is a coupling between the contributor and the upcoming damage application. The reducer can just transfer based on MP.

**Skip the polish-pass ADR (treat the resistance display and maxHp lift as pure UI fixes).** Rejected — the bugs surfaced from a shared root (read-the-wrong-thing-at-the-wrong-time), and grouping them in a single ADR keeps the rationale discoverable.

**Keep the orchestrator's throw and only fix the soft-lock via menu gating.** Rejected per Chris's call. Menu gating prevents the specific Don't Move / Don't Act crash but doesn't address the underlying brittleness; future hook-blocking content would re-introduce it. The orchestrator-side fix is small (one return-instead-of-throw branch) and structurally covers all current and future cases.

**Thread the rejection through `useTurnFlow` as a new event.** Considered — useful for surfacing player-facing reasons (e.g., a status-line "Can't move while afflicted with Don't Move"). Rejected for this session's scope: the existing `animationEnded` recovery is sufficient for menu-return; a player-facing toast/status-line is its own future polish item.

**Make `validation` rejections still throw (only catch hook_blocked / battle_decided).** Considered — validation failures arguably indicate a UI/engine drift bug that should surface loudly. Rejected: race conditions (animation queue, status changes mid-flow) can legitimately produce a validation failure on a player-submitted action. Better to recover gracefully and log the reason than to crash the React tree on a transient drift.

## References

- `src/content/rulesets/default.ts` — `DEFAULT_DAMAGE_PIPELINE` (target-stage re-order).
- `src/engine/catalog/test-fixtures.ts` — `DEFAULT_TEST_DAMAGE_PIPELINE` (mirror).
- `src/content/abilities/ignition.ts` — updated hook-timing comment.
- `src/engine/actions/reducers.ts:reduceSystemMpDrain` — KO short-circuit dropped.
- `src/engine/actions/session-30-integration.test.ts` — "KO'd target is a no-op" test rewritten to assert mid-chain drain transfer.
- `src/engine/actions/session-31-5-integration.test.ts` — new regression coverage (proc-on-miss, mid-chain fatal-hit drain, magical-cast drain).
- `src/app/demo/orchestrator.ts` — `OrchestratorRejection` type; `step()` returns rejections instead of throwing on controller-submitted commit failures.
- `src/app/demo/orchestrator.test.ts` — regression: orchestrator returns rejection (no throw) on hook_blocked.
- `src/app/BattleView.tsx` — pump reads `step.rejection` and logs to console.
- `src/ui/unit-detail-panel.tsx` — Resistances section rewritten to thread through `runModifyResistance`.
- `src/renderer/battle-renderer.ts:applyVisualState` — maxHp lifted to per-frame read.
- `src/renderer/animator.ts` — `UnitVisualSnapshot.mp` added; flash finalize settles MP.
- ADR-0019 — evasion_check ordering at the target stage (preserved).
- ADR-0056 — equipment contributor pattern + `modifyResistance` chain (preserved).
- ADR-0057 — resistance absorption (preserved; the `absorbed` gate in the drain contributor is unchanged).
- ADR-0064 — `attackProcContributor` + `onDamageDealt` emission lane (the stage-ordering fix preserves the contributor's gate intent).
- ADR-0065 — `onFinalDamage` + `system_mp_drain` (the reducer's KO short-circuit was authored here; this ADR supersedes that decision for the target-side check).
- ADR-0068 — rider bypass surface (preserved; `isRiderCast` helper extracted as a parallel refactor in Session 31.5).
