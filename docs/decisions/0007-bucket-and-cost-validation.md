## ADR-0007: Bucket-and-cost validation surface

**Status:** Accepted
**Date:** 2026-05-03

## Context

`docs/design/ability-slots.md` defines a per-character loadout as a mapping of named buckets to either CommandSet references (active buckets) or AbilityId lists (passive buckets), validated by per-bucket capacity vs. sum-of-cost. Both capacity and cost are *computed* per character — class, equipment, level, and traits all contribute modifiers.

Session 5 lands the bucket / cost / validation / equip surface and authors enough content (Move +1, Float, Fly, plus the Knight's Battle Skill command set) to demonstrate the pipeline end-to-end. The shape of `getCost`, `getCapacity`, `validateLoadout`, and the equip operations propagates to every UI screen, AI evaluation, and (eventually) every reducer that has to gate on loadout legality. Picking the wrong shape now means revisiting every consumer.

The plausible options for validation:

1. **First-error validation.** `validateLoadout` returns `true` or `{ violation: ... }` (single). Simple but UI shows one problem at a time, frustrating for cascading invalidations after a class change.
2. **Structured violations.** `validateLoadout` returns `{ ok: true }` or `{ ok: false, violations: [...] }` enumerating *every* problem. Slightly more work; UI gets a complete picture.
3. **Rich result with suggested fixes.** `validate` returns violations plus auto-resolution candidates ("unequip the most-recently-added overflowing ability"). Powerful, but the design doc explicitly flags resolution policy as an open question — building it now would freeze the wrong policy.

For equip:

A. **Mutating equip.** `equip(state, change)` mutates the unit's loadout in place. Conflicts with the immutable-state ground rule.
B. **Result-typed equip.** `equip(state, change, catalog) → { ok: true; state } | { ok: false; validation }`. Pure function; success and failure are first-class. Caller decides whether to commit, retry, or surface the failure.
C. **Throwing equip.** `equip` throws on invalid changes. Forces try/catch at every call site; ugly for the predictable "user dragged something into the wrong bucket" path.

For where capacity baselines live:

I. **Hardcoded constants.** Per-bucket numbers in `engine/abilities/constants.ts`. Quick to write; baseline lives in code.
II. **Ruleset-determined.** Baselines in `RulesetDefinition` (session 6); engine reads via the active ruleset. Matches the architecture-overview commitment that "swapping any of the three layers does not require engine code changes."

## Decision

**Validation: option 2.** `validateLoadout` returns `{ ok: true }` or `{ ok: false; violations: ReadonlyArray<LoadoutViolation> }` and enumerates every problem in one pass. The discriminated `LoadoutViolation` union (`unknown_ability`, `wrong_bucket`, `wrong_kind_for_bucket`, `over_capacity`, `unknown_command_set`, `unknown_bucket`) gives UI a typed surface to display.

Resolution suggestions (option 3) are explicitly *not* part of the result. The design doc's open question on cascading invalidation policy stays open; once a UX choice is made, the resolver lives elsewhere — `validateLoadout` reports facts.

**Equip: option B.** Three operations (`equipPassive`, `unequipPassive`, `setActiveBucket`) each return `EquipResult = { ok: true; state } | { ok: false; validation }`. They internally call `validateLoadout` against the candidate loadout and only commit on success. They never mutate input state. They never throw on validation failure (range errors like out-of-bounds index *do* throw — that's a programmer bug, not a user-facing failure).

**Capacity baselines: option I for v1, II long-term.** The session-5 baseline lives in `engine/abilities/constants.ts` (`BASELINE_BUCKET_CAPACITIES` — the 1/1/3/3/3 numbers). Session 6 promotes this into `RulesetDefinition` so alternate rulesets can override. This mirrors `engine/ct/constants.ts` (SPEED_FLOOR, ASSUMED_TURN_CT_COST, TRIGGER_THRESHOLD) — same pattern: constants today, ruleset tomorrow.

Bucket *identity* (the five named buckets) stays in `constants.ts` permanently, not the ruleset. They're engine surface; rulesets tune their numbers, not their existence.

## Consequences

- **Validation is enumerable.** UI can show "you're over capacity in Movement *and* you have an unknown ability in Reaction" in one pass. AI search code that wants to prune invalid loadouts gets a structured signal.
- **Equip is composable.** `setActiveBucket(state, …)` can be chained: `equipPassive(setActiveBucket(state, …).state, …)` — pattern for batch UI changes that all need to validate atomically.
- **Equip failures don't blow up the caller.** UI handles `{ ok: false }` by showing the violation; nothing has to wrap equip in try/catch.
- **Cost is a one-knob extension point.** Today only the class's `freeAbilities` set zeros costs. Equipment-driven discounts, status-driven costs, etc. compose into `getCost` additively when their source-kinds land.
- **Capacity is symmetric.** `getCapacity` has the same single-extension-point shape. Equipment that grants `+1 Reaction capacity` slots in as one new modifier source when equipment lands.
- **CommandSet is a first-class catalog kind.** Active buckets reference CommandSetIds, not ability lists. Within-set learning state lives separately (deferred to progression) — the bucket system stays uniform across the active/passive split.
- **First Action being class-pinned is *not* enforced by the validator today.** The validator reports legality of whatever the loadout carries; it's `equipAbility` and (eventually) the reducer's job to refuse changes that break the pin. Flagged in the handoff for session 7.
- **Cascading invalidation is the caller's problem.** When a class change drops Reaction capacity below currently-equipped cost, validation will fail; resolution lives in the UI / reducer. ADR-0007 deliberately punts on the policy, matching the design doc's open question.

## Alternatives considered

- **First-error validation.** Rejected — known to be insufficient for the cascading-invalidation flow; would force re-validation rounds in UI for a single underlying change.
- **Throwing equip.** Rejected — equip failure is a *normal* runtime path (player tries an invalid loadout); throwing makes call sites uglier and conflates user errors with bugs.
- **Result wrapper with auto-fix suggestions.** Rejected — premature; the design doc's open question on cascading invalidation policy hasn't resolved.
- **Bucket-capacity-as-RulesetDefinition this session.** Rejected — would require landing partial RulesetDefinition shape now to get one field, polluting the session 6 design space. Constants today, ruleset tomorrow is the cleaner sequencing.
- **Storing computed cost / capacity on the loadout.** Rejected per CLAUDE.md ground rule 5 — both are computed on read. The same reasoning that keeps Speed and movement profile uncached applies here: caching creates consistency bugs when modifier sources change.
