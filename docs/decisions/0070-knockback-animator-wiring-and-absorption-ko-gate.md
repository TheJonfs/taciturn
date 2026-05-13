## ADR-0070: Knockback animator wiring via per-target `displacedTo` + absorption tag-flip gates on KO'd targets

**Status:** Accepted
**Date:** 2026-05-13

## Context

Two playtest bugs surfaced after the Session 31.5 fix pass:

1. **Knockback marker desync.** Maelstrom's knockback rider correctly moved the Earth Mage's `unit.position` in engine state (clicking the new tile opened the Earth Mage's detail panel — engine-side state was right), but the unit's sprite on the canvas stayed at the original tile. The reducer's knockback path at `src/engine/actions/reducers.ts` (the `if (damage.knockback !== undefined)` block) called `applyKnockback`, then `withUnit(state, { ...target, position: knockResult.finalPosition })`. The animator drives `snap.position` from `move` action tweens — and knockback isn't a `move` action. The code itself flagged this with a comment: *"Today the renderer pulls through unrecognized visuals; the position change shows up on the next animatable action's snapshot refresh."* The renderer's sprite remained stale until the unit moved on its own turn.

2. **Absorption tag-flip revives KO'd targets.** Per ADR-0057, a Lightning attack on a unit with > 100 Lightning resistance tag-flips the damage to healing in the cap stage; downstream consumers route through the existing healing path naturally. But `applyDamageToTarget`'s healing branch had no gate against raising a 0-HP unit's HP. Sequence Chris observed: Earth Mage took damage from earlier sources (Burn ticks / direct hits) and was KO'd — action log emitted the "KO'd" message. Then a subsequent Lightning attack from the Lightning Mage hit the still-listed-but-KO'd Earth Mage. The cap stage's absorption flip turned the result into healing (the target's resistance map was unchanged by KO). `applyDamageToTarget` ran `nextHp = currentTarget.vitals.hp + finalDamage` → `0 + healAmount` → positive HP. Earth Mage was now alive again. The scheduler's `buildSnapshot` saw HP > 0, picked them for the next turn, and a normal `turn_start` fired. The action menu surfaced for a unit who should have been inert.

The parallel gate already existed for status applications: `system_apply_status` short-circuits when the target is KO'd (`vitals.hp <= 0`) — "DoTs don't tick on KO'd units; symmetric for fresh applies." Healing-tagged damage just needed the symmetric gate.

## Decision

**Two coupled changes, each surgical:**

**(1) Per-target result carries displacement (`AbilityTargetResult.displacedTo?: Position`).** The reducer's knockback path records `knockResult.finalPosition` onto the per-target result when `stepsTaken > 0`. The renderer's `buildFlashFromTargets` converts the new position to a `ScreenPoint` (via `positionCenter`) and pushes it onto the `FlashTargetSpec` as `positionAfter`. The animator's flash finalize settles `snap.position = positionAfter`, so the sprite jumps to the new tile in sync with the damage flash — the same finalize point that already writes `snap.hp`, `snap.maxHp`, `snap.ko`, and (per Session 31.5 polish #5) `snap.mp`.

**(2) `applyDamageToTarget` gates the healing branch on `hp > 0`.** A new branch:
```ts
if (isHealing && currentTarget.vitals.hp <= 0) return state;
```
inserted between the existing `isHealing` check and the `nextHp` computation. KO'd targets are inert for healing-flagged effects — both ambient (absorption tag-flip) and explicit (Cure on a corpse). Matches the FFT precedent that ambient healing doesn't revive; explicit Raise / Phoenix Down is required (deferred in v1).

## Rationale

**Per-target `displacedTo` over an `OutcomeMoveEvent` action.** The natural alternative is to emit a `system_move` (or similar) action onto `pipelineEmissions` that the chain processes, with the animator building a move-tween from it. Rejected as overkill for v1: knockback's path is already known at reducer time; threading the destination onto the per-target result piggybacks on the existing flash infrastructure (which already iterates per-target specs at finalize) and adds zero action types to the chain. A future move-style tween animation can read `displacedTo` as the destination and `knockResult.path` (already logged) for the in-between tiles; today's instant settle is acceptable visually because the flash is what the player tracks for impact.

**Settle at flash finalize, not via an intermediate tween.** The flash is a triangular envelope (~150 ms peak). Settling the position at finalize means the sprite teleports to the new tile when the flash ends, matching the impact beat. A move-style tween over a knockback path would compete with the flash for the player's attention; FFT-style knockbacks read as "thrown back," which is what the instant settle conveys. Future polish can revisit if knockback distance > 1 becomes common.

**Gate in `applyDamageToTarget`, not in the cap stage.** The cap stage's tag-flip is the right place to detect absorption — it has the in-flight context (resistance multiplier, base damage) and produces the canonical "absorbed" sentinel for downstream consumers (action log formatter, `system_mp_drain` contributor's `absorbed` arg, etc.). Stopping the flip there would break those consumers. The gate has to live at the apply site, where state-vs-effect alignment is the concern.

**KO'd target gate over a "would-revive" check.** An alternative: only block the healing when `currentTarget.vitals.hp === 0 && nextHp > 0` (i.e., specifically the "this would resurrect" case). Rejected — the simpler reading is "KO'd units don't receive healing." A more nuanced rule would surprise content authors who reason about "what does Cure on a dead unit do?" and would diverge from the symmetric `system_apply_status` gate. Uniform rule, one gate.

**No change to the cap stage's absorption flip.** Pipeline-internal — the ctx still tag-flips and reports `absorbed: true` on the target result. The `system_mp_drain` contributor (per ADR-0065) still receives `absorbed: true` and gates its drain accordingly. Only the application-side HP write is suppressed. Consequences for the action log: an absorbed attack on a KO'd target produces a per-target result with `absorbed: true` and `healing: amount`, but engine state doesn't change. The action log can render this as "absorbed (no effect — already KO'd)" or simply suppress; that's a downstream formatter concern not load-bearing for the gate.

**Engine vs UI fix asymmetry.** Bug A's fix touches the engine output (`AbilityTargetResult` gains a field) so the renderer can consume it. Bug B's fix is engine-internal (apply-time gate). Different layers, same session — both are root-cause fixes, not workarounds. Per the Session 31.5 pattern (see ADR-0069's orchestrator change), the discipline is: address the underlying behavior, not just the symptom the player sees.

## Consequences

- **`AbilityTargetResult` gains an optional field.** Existing consumers (action log, AI projection, replay assertion) ignore unknown fields; the addition is backward-compatible. New consumers (the animator's `buildFlashFromTargets`) read it.

- **Knockback's `knockResult.path` is still unused.** The destination is enough for the instant-settle behavior; the intermediate path stays available for future tween work. The `KnockbackResult` type doesn't change.

- **`applyDamageToTarget`'s gate covers both absorption and explicit healing.** A future Cure ability cast on a KO'd unit returns engine state unchanged. Action log surfaces the cast with a 0-result heal (per-target `healing: amount` is recorded but applies to no actual HP delta). When explicit Raise / Phoenix Down content ships, it'll use a separate code path (per ADR convention) that explicitly bypasses the KO gate — paralleling the `system_apply_status` gate's "explicit revive abilities are their own opt-in" pattern.

- **No change to the scheduler.** The scheduler's `buildSnapshot` correctly filters KO'd units (per `isKO`). The bug was upstream — the unit's HP shouldn't have come back to > 0 in the first place. Fixing the apply gate fixes the symptom at the root; the scheduler doesn't need to be re-audited.

- **Replay determinism preserved.** Both fixes are deterministic given `(state, action, seed)`. The animator change is purely visual. The apply-time gate doesn't add randomness.

- **`fireOnFinalDamage` (postFinalize stage) still fires on absorbed-into-KO'd-target hits.** The `damageDealt` arg is the cap-stage value (the absorbed amount), and `absorbed: true` is passed. Rasp Pendant's contributor gates on `absorbed` (skips emission) — unchanged. Future post-finalize handlers that want to react to "absorbed, but had no real effect because target was KO'd" can gate on both `absorbed` AND a state read of target HP. v1 has no such consumer; the contract is consistent.

- **Tests:** 2 new regression tests in `session-31-5-integration.test.ts` covering:
  - `AbilityTargetResult` carries `displacedTo` after a knockback rider fires through `reduceUseAbility`.
  - A Lightning hit on a KO'd high-resistance target does NOT raise HP (engine state unchanged).

  Total session test count: 859 passing across 71 files (up from 857).

## Alternatives considered

**Emit a `system_move` action from the knockback path.** Rejected — would add a new action type for a purely cosmetic concern. The per-target result field reuses existing plumbing.

**Tween the knockback as a multi-step path animation.** Deferred — the path is logged on `knockResult.path` and accessible to future polish. v1's instant settle is acceptable and matches the impact-flash beat.

**Gate the cap stage's absorption tag-flip on `target.vitals.hp > 0` instead of in apply.** Rejected — the cap stage is pipeline-internal and other consumers (action log, Rasp Pendant gate via `absorbed` arg) read the tag-flip as a signal. Suppressing the flip would break those.

**Use a stricter "this would resurrect" check (`hp === 0 && nextHp > 0`).** Rejected — uniform "KO'd targets don't receive healing" is simpler to reason about, matches the existing `system_apply_status` gate, and avoids surprising content authors.

**Document the KO-gate semantics in `docs/design/action-resolution.md` rather than an ADR.** Considered — the design doc is the right durable home, but the change touches absorption's surface (ADR-0057's superseded territory) and the knockback animator wiring is a renderer/engine seam worth recording as a decision. Both updates can happen; the ADR is the authoritative record, the design doc edit is the durable cross-reference.

**Author an explicit Raise ability in v1 to differentiate.** Out of scope — Phase E content; not blocked by this gate.

## References

- `src/engine/types/action.ts` — `AbilityTargetResult.displacedTo`.
- `src/engine/actions/reducers.ts` — knockback path records `displacedTo`; `applyDamageToTarget` gates healing on `hp > 0`.
- `src/renderer/animator.ts` — `FlashTargetSpec.positionAfter`; flash finalize settles `snap.position`.
- `src/engine/actions/session-31-5-integration.test.ts` — regression coverage.
- ADR-0026 — knockback's existence as a "side effect of an effect" (preserves: this ADR adds animator visibility without changing the engine's call shape).
- ADR-0057 — resistance absorption activation via tag-flip (this ADR adds a downstream gate; doesn't change the flip itself).
- ADR-0065 — `onFinalDamage` + `system_mp_drain` (the `absorbed` gate at the contributor is unchanged).
- ADR-0069 — Session 31.5's coupled pipeline / reducer fixes (sibling).
