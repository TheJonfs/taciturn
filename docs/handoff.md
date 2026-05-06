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

## From session 2026-05-06 (13.7 reconciliation resolution)

### Suggested next-session scope

Session 14 — Magical damage foundation. Per `docs/roadmap-sessions-14-20.md`, this is an engine-only session: magical damage handler, Faith pipeline, resistance system wiring, MP cost timing, healing as a tag-flipped variant. The 13.7 cleanup means the type substrate is ready — `Unit.resistances` exists, `BaseStats.faith` exists, `DamageTag` has `'earth'`, and `evasion_check` placement is settled per ADR-0019.

The prerequisites for session 14 that I want to flag explicitly:

- **Unit.resistances is empty by default** in current fixtures and demo battles. Session 14's resistance stage handler ships and reads it; until content lands per-class baseline resistances (session 16 for Earth's `earth: 25`), the existing demo battle plays through with all-zero resistances and damage numbers stay identical.
- **Brave 100 / Faith 70** on demo units is documented in `engine/types/stats.ts`'s comment; session 14's Faith_factor consumers will produce `0.7 × 0.7 = 0.49` for symmetric Faith on the demo. That's a damage-and-heal hit of about half. May want to bump faith higher for testability before tuning lands. Worth a one-line check at session start.
- **`evasion_check` handler reads class baselines (currently 0/0/0)**. Until tuning takes a real pass, every physical attack effectively auto-hits. That's fine; it preserves current test behavior.

### Things noticed during the session

- **The reconciliation report's section 6 listed 15 design questions.** All 15 are resolved by the six 13.7 ADRs plus the four scope/shape decisions Chris confirmed at the start of the session (split-scope land-now vs defer; Brave 100 / Faith 70; resistance map keyed by DamageTag; tags? on AbilityDefinition; flat evasion). No question from the original report should be carried forward; each is either an ADR, a doc update, or a code change.

- **The plan called for renaming `displayName` → `name` and `bucketCost` → `baseCost` in the spec.** The engine already used `name` and `baseCost` — no engine code change. Only the spec text changed.

- **`abilityType` (4-way) → `kind` (2-way) in the spec** matched the engine's existing 2-way discriminator with bucket as the sub-discriminator (per ADR-0005). Spec rewritten to match the engine; no engine code changed.

- **Reaction compiler / Counter refactor explicitly deferred to session 16** per the ADR-0017 implementation note. The plan's "Refactoring of existing definitions" listed Counter refactor; on the read of the conflict between ADR scope and code-refactor scope, we settled on (b) — defer behavior-changing items per their owning ADRs. The reaction compiler ships in session 16.

- **The plan flagged a contradiction between ADR scope and Code Refactors scope** for several items (hook handler `emittedActions`, `status_remove`/`status_decrement_stack` action types, STACK_COUNT_ADDITIVE apply.ts logic, reaction compiler / Counter refactor). Resolution: ADRs document the architectural decision; code refactors land *additive* shape changes (enum value, throw-on-unimplemented branch) but defer *behavior* implementation to the owning session. This kept 13.7 to mechanical work and avoided shipping infrastructure with no consumer.

- **No new test failed at any checkpoint.** 345 tests pass start to end. The mechanical nature of the renames (engine had `name`/`baseCost` already; `chargeTicks` → `actionSpeed` was a rename with the same semantics) made for a low-risk session.

### Things considered but did not do

- **Writing the reaction compiler in 13.7.** Considered as part of the "Counter refactor" code path. Skipped per ADR-0017 timing — the compiler's first new consumer is Earth's Reaction in session 16, and building it ahead of the spec's first content consumer risks the shape being wrong. When session 16 lands the compiler, Counter refactors as the worked example simultaneously.

- **Implementing the `'tile'` TargetingSpec validation in 13.7.** The type lands; the validation throws. Per the plan's split-scope rule, validation lands when the first consumer (session 15's charged tile-AoE) ships. The throw means an ability authored with `tile` targeting fails fast, not silently.

- **Adding evasion to a `baselines` group on ClassDefinition.** Current `ClassDefinition` doesn't have a `baselines` group; movement is its own field. Going flat with a top-level `evasion` field. When more baseline values arrive (resistance baseline per class, brave/faith class modifiers), reconsider grouping.

- **Updating the catalog's class-trait field per the spec's `traits?: ClassTrait[]`.** Engine `ClassDefinition` doesn't have `traits` yet; the spec describes a future-state field. No content uses class traits in v1; deferring until first consumer ships.

### Open questions for later sessions (not blocking)

- **Burn's per-stack damage value.** Battle Mechanics Guide and roadmap both list it as TBD. Recommended starting value 5–8 per ADR-0018 examples. Lands in session 19's Burn definition.

- **Speed ceiling specific value.** Per the Battle Mechanics Guide, the 3.0× base suggestion is a starting point. Tuning question; lands when Haste-stacking content makes it real (session 16+ may surface this).

- **Tags on `AbilityDefinition` use string, not a closed union.** Per the spec's "AbilityTagId is open string." If session 16 (Silence) wants stricter typing (e.g., literal-union over the known tags), the engine type can tighten then. Today: open string, no v1 ability declares tags.

- **The `'tile'` validation throw is a programmer-error throw, not a return-invalid.** Matches the convention for "not yet implemented" engine paths — throwing means the throw stack identifies which ability tried tile targeting. When session 15 lands real tile validation, this branch becomes the working code path.

- **Faith 70 may be too low for session 14 demo damage.** Faith_factor for caster→target both at 70 produces 0.49× on magical formulas — significant. May want to bump v1 default to 80 or 85 before session 14 to keep damage numbers feeling right out of the box. Quick tweak; defer to session 14 start.

### Notes for future ADRs

When the engine-side `turn_end` on KO ADR lands (session 15 fold-in per the updated roadmap), it'll supersede ADR-0013's "deferred" status. Mark ADR-0013 as superseded in its frontmatter and add a back-reference to the new ADR.
