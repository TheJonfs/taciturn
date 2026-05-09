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

## From session 2026-05-09 (session 18: Water Mage)

### Suggested next-session scope

**Session 19 — Fire Mage + custom-trigger statuses** (per `docs/roadmap-sessions-14-20.md`).

Engine work:
- **Custom-trigger status pattern** — generalized from the Burn-specific design in BMG. A status type may declare a custom trigger condition (CT 100 reached, damage taken, action attempted, etc.) and an effect on trigger. Distinct from duration-tick and conditional duration modes.
- **`STACK_COUNT_ADDITIVE`** stacking rule per ADR-0018 (enum value already exists; `apply.ts` throws on the branch). Burn is the first consumer.
- **AoE shape modifier hook** — `modifyAoeShape` already exists (added in 17a, identity chain). Fire's "larger AoE" rider is the planned consumer; this session adds the consumer behavior.
- **Per-stack damage scaling** for stacked statuses (Burn with N stacks deals N × per-stack magnitude per ADR-0018).

Content work (plaintext-first):
- Full 7-ability Fire Mage kit: Base spell (damage + PA/MA debuff rider), Buff (PA/MA self-buff), AoE (larger-AoE rider), Debuff (Burn stacks), Ultimate (line-shape, multiple Burn stacks), Reaction (Burn-on-attacker), Support (magic damage adds 1 stack of Burn).
- New status: **Burn** (custom-trigger CT 100, damage = stack × per-stack magnitude, decrements via `status_decrement_stack`, STACK_COUNT_ADDITIVE).
- New status: **PA/MA buff/debuff** (additive stat mods with duration; one combined "Stat Buff" type with magnitude per stat, or four separate types — content designer call).

ADR-0030 (anticipated): custom-trigger pattern formalization.

The 18 substrate that 19 inherits:
- **Cone shape** is in place; if Fire's Ultimate is line-shaped (per the planning doc), session 19 might add a `'line'` shape variant — direction handling is already plumbed (`cardinalFromTo`, `direction` parameter on `aoeFootprint`).
- **`anchorMode`** is in place; line shapes (or any future caster-anchored Fire spell) plug in directly.
- **`onActionResolved`** is available; if a Fire support wants "post-action emit Burn stack" or similar, the hook is ready.
- **`damage.ctPush` / `damage.knockback`** patterns generalize to other riders. If Fire wants a "damage + apply X" rider that's not a status, the per-rider field-on-DamageSpec pattern is the model.
- **`rollAbilityChance`** helper is available for any non-status chance gate Fire's content uses.

### Things noticed during the session

- **Pre-existing TS strict-mode errors in test files** (carried from 17c handoff). Still not addressed; `npm run typecheck` passes via Vitest's loose mode but `tsc -b --noEmit` may surface them. Worth a session of cleanup at some point — defer until a natural lull.

- **Cone direction is cardinal-only.** Diagonal cones are deferred. A perfect-diagonal target snaps to one of the four axes (tie-break: horizontal). When a content consumer wants 8-direction cones, `DIRECTION_BASIS` grows by four entries and `cardinalFromTo` extends. Fire's Ultimate is line-shaped per planning, so 19 may not need this; track for whoever does.

- **AoE caster-target ctEffects throw.** v1 has no consumer. If Fire's content adds a "self-burst CT-bump as part of an AoE" pattern, the once-per-cast handling lands then (parallel to the existing caster-target status-effect pattern).

- **Knockback animation in the renderer** is still pull-through (no visual). Position update is reflected on the next animatable action's snapshot. A real knockback animation (interpolated path via `KnockbackResult.path`) is renderer work for a later session — not session 19 critical-path.

- **Faith-multiplier on CT-push magnitude.** Today's `delta = -floor(factor × MA)` is unmodulated. If a future content consumer wants Faith composition (parallel to magical damage), the helper takes the change. v1 spec was "no Faith multiplier"; flag if Fire's content wants it.

- **Cure tag fix** (`'magical'` added) was a small content-correctness fix that landed during 18 because Flow State needed it. Side-effect-free against the existing pipeline (the magical_ma_power and healing_base handlers compute the same value for healing-tagged effects, and resistance short-circuits on `'healing'` per ADR-0016). No follow-up needed.

- **Reaction-cap accounting for `system_ct_push` reactions** works correctly. The runner stamps `reactorId: args.unit.id` per emission; commit-time cap accounting reads from the queue entry, not from the action's payload. Verified end-to-end in the demo battle — the second Tidal Pull push showed `applied: 0` (cap-exhausted).

### Things considered but did not do

- **Unified rider abstraction.** A single `riders` field on `AbilityEffects` with kind / gate / args. Rejected: with two rider kinds (`ctPush`, `knockback`) and three gating shapes today, explicit fields are more readable and TypeScript-friendly. Revisit when a third / fourth rider kind ships (Fire's "apply Burn on damage" might be the inflection point — if so, this is the natural surface to redesign).

- **Storing cone direction on the shape itself.** Rejected: same cone definition needs to rotate per-cast based on caster→target geometry. Direction is a runtime concern; the shape stays direction-agnostic.

- **Cone as a `'custom'` shape with pre-computed offsets.** Rejected: cones are recurring (Maelstrom now; future cone-shaped breath weapons / line spells), and parametrizing by row widths makes the "more affecting Maelstrom" expansion (`[1, 3, 5]`) a one-line content change.

- **Generic "rider chance roll" hook.** Considered: a `modifyAbilityChance` hook (parallel to `modifyStatusApplicationChance`) for support abilities like "Tidal Wave knockbacks ×1.25." Rejected: no v1 consumer; can add when content needs it. The shape is straightforward — the existing modifier hook would be the model.

- **Faith multiplier on CT push magnitude.** Considered for parity with magical damage. Rejected per user spec — Faith is already factored into the chance to land (for chance-gated paths) or the damage hit (for damage riders); applying Faith again to the push magnitude is double-counting.

- **Naming the new hook `onAfterAction` instead of `onActionResolved`.** Rejected: existing hook family uses verbs (`onActionAttempted`, `onActionTargeted`); `onActionResolved` matches the pattern.

### Open questions for later sessions (not blocking)

- **Knockback collision cancellation in projection.** Today the AI doesn't reason about whether a knockback would actually move a target (collision cancels, falling damage applies, etc.). Tier 1.5 AI in session 20 might want this; for v1 not load-bearing.

- **Diagonal cones / line shapes.** Cardinal-only is a v1 simplification. Fire's Ultimate is line-shaped per planning — if "line" is added as a new shape, decide whether it's strictly cardinal or supports 8-direction.

- **`onActionResolved` for non-ability actions.** v1 fires it only inside `reduceUseAbility` and `reduceChargedActionResolve`. Future Move-flavored consumers (e.g., "moved this turn" passive, "took damage this turn" tracker) would extend the firing sites. Not a v1 need; flag if a content consumer surfaces.

- **`AoeSpec.anchorMode` for non-cone caster-anchored shapes.** v1 only Maelstrom uses `'caster'`. A future "self-burst" support (e.g., a Fire ability that bursts around the caster on cast) would benefit; the substrate already supports it.

- **Speed Down floor at 0.** `computeSpeed` already clamps at `ruleset.speedBounds.floor` (default 0). No per-status floor needed today, but if content adds a "below-floor" effect (e.g., negative speed for some bizarre design), the floor lives at the ruleset layer — change it there, not per-status.

### Notes for future ADRs

- **ADR for custom-trigger pattern** (anticipated session 19) — generalization of CT-100 trigger, on-damage trigger, on-action-attempt trigger. The shape needs to compose cleanly with the existing duration modes (per_unit_ct, global_ticks, turn_based, conditional, permanent, permanent_per_unit_ct) — custom-trigger is orthogonal to duration.

- **ADR for STACK_COUNT_ADDITIVE implementation** (anticipated session 19) — apply pipeline branches today throw on this rule. Implementation is per ADR-0018: existing instance gets stack count incremented; new instance starts with stacks: 1 (or the application's stack quantity); per-stack scaling for damage / magnitude.

- **ADR for diagonal cones / line shapes** if Fire's content requires them.

- **ADR for `'magic'` tag normalization across Mage classes.** Today `'magical'` is the convention (Earth, Water, Cure all use it). If Fire / Lightning use `'magic'` instead, settle on one canonical name and migrate. (Probably not needed — `'magical'` is established.)
