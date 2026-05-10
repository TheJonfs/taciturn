# Session 21 Brief: Cluster 1 — Stabilization

## Context

This is the first session of the Mage War MVP arc, following the Session 20b engine + content delivery and the audit session that reconciled the test suite to the post-reconciliation baselines. The audit completed test fixture and content updates (16 content files, 4 test assertion updates) and surfaced two engine items the brief explicitly held back from implementation:

- **E1**: `crit_chance` is not clamped to `[0, 100]`, allowing stacking Crit_modifier to produce undefined behavior.
- **E9**: The AI's candidate-filter pass uses `validateAction` (pure) to filter proposed actions but doesn't run the `onActionAttempted` hook chain, so actions blocked by status effects (Don't Move, Don't Act, Stop, etc.) pass validation but fail at commit. This surfaced as two failing integration tests in `ai-controller.integration.test.ts` after the post-reconciliation tuning made Don't Move land more frequently.

This session lands both fixes. Its purpose is to close out post-reconciliation stabilization so that subsequent MVP sessions (battle UI work) start from a green test suite.

## Inputs (read first)

In recommended order:

1. **`CLAUDE.md`** — standing project conventions, ground rules, ADR practice.
2. **`docs/handoff.md`** — previous session's handoff. (Audit session's outputs.)
3. **`docs/roadmap-sessions-21-plus.md`** — the new roadmap. Session 21 entry covers this brief; subsequent entries are for context on the arc.
4. **`docs/mage-war-content-spec.md`** — post-reconciliation content spec. Anchored numbers; this brief doesn't touch content but the spec is the calibration target everything else respects.
5. **`docs/audits/post-20-engine-audit.md`** — the engine audit. Items E1 and E9 are detailed in Section E (Surprises and flags). The recommended fixes are defined there; this brief implements them.

## Goal

Green test suite (`npm test`: 559+ passing, 0 failing) with the two engine fixes landed and ADRs documenting both.

## Item 1: E1 crit_chance clamp

### Specification

Current behavior: `critRoll` reads `crit_chance` through `runModifyStatQuery`, short-circuits when `crit_chance <= 0`, then rolls `r >= crit_chance / 100`. With `crit_chance > 100` (e.g., 5 base + 6× Static Embrace stacks at +20 each = 125), `crit_chance / 100 = 1.25` and the roll always crits — but the read value is the raw unclamped magnitude.

Target behavior: clamp the queried `crit_chance` to `[0, 100]` at the read site so:
- Roll behavior stays correct (always crit when at-or-above 100; never crit when at-or-below 0)
- Audit, log, and forecast views read clean values (no 125% crit displayed anywhere)
- Stacking past 100 is a no-op (no further benefit; design intent: 5 stacks of Static Embrace caps the unit at 100% crit)

### Implementation

In `src/engine/damage/handlers.ts:376` (or wherever `critRoll` lives in current shape), wrap the `runModifyStatQuery` call:

```typescript
const cc = Math.max(0, Math.min(100, runModifyStatQuery(...)));
```

Apply the clamp to the value used for both the short-circuit check and the roll comparison.

### Test

New test (or extension of existing crit tests) asserting:

- A unit with 6 stacks of Crit_modifier (base 5 + magnitude 120 = 125) has effective `crit_chance = 100`, not 125.
- Crit roll with 6 stacks always crits (deterministic at clamp).
- Forecast / projection surface (if it reads `crit_chance` for display) shows 100, not 125.
- A unit with -50 crit_chance modifier on a 5-base unit clamps at 0, not -45.

### ADR

Brief — design rationale is "upper-bound discipline on stat queries that produce probabilities." Worth recording so future stat-query consumers (e.g., evasion display) inherit the same pattern.

## Item 2: E9 AI pre-filter via dry-run runOnActionAttempted

### Specification

Current behavior: the basic AI ([`src/ai/basic.ts:860`](src/ai/basic.ts:860), [`:1037`](src/ai/basic.ts:1037), [`:1054`](src/ai/basic.ts:1054), [`:1156`](src/ai/basic.ts:1156)) calls `validateAction` to filter candidate actions. `validateAction` is intentionally pure (per its file header: "side-effect-free; `onActionAttempted` hooks fire in `commitAction`, not in validation"). A unit afflicted with Don't Move passes `validateAction`'s structural checks (range, target, budget) but is blocked at `commitAction` by `runOnActionAttempted`. The orchestrator throws on commit failure.

Target behavior: AI's candidate-filter pass runs `runOnActionAttempted` in dry-run mode (no state mutation, just the chain evaluation) and excludes any action that would be blocked. Same pattern the AI already uses for `validateAction` — pure pre-flight check filtering candidates before scoring.

### Implementation

Extend the AI's candidate-filter pass to call `runOnActionAttempted` against the proposed action with `isReaction: false`. Treat any `'block'` (or equivalent) outcome as a filter-out signal. The hook chain runs against the actor's current hooks — Don't Move's blocking handler fires, returns block, AI excludes the action from its candidate pool, scores from the remaining candidates.

The dry-run requirement: this must not mutate state. Verify the existing `runOnActionAttempted` is pure (or has a pure-mode parameter); if not, factor a pure variant out of the existing implementation.

### Tests

The two failing tests in `ai-controller.integration.test.ts` should pass after this change with no further intervention:
- `every battle terminates within a sane step bound`
- `basic AI wins at least as many matchups as greedy across both team assignments`

Both currently fail with `DemoOrchestrator: commit failed for move by "blue_lightning_mage": can't move`.

Verify also: existing AI tests that rely on the AI moving freely (no blocking statuses present) still pass. The pre-filter should be a no-op on units without active blocking statuses.

### ADR

Medium-detail — this is a real behavioral fix with an architecture choice (AI-side filter vs. orchestrator fallback). The audit recommended the AI-side filter as the cleaner long-term fix; this ADR captures the rationale and notes that orchestrator-side fallback was considered and rejected as papering over the bug.

## Acceptance criteria

- `npm test`: 559+ passing, 0 failing.
- Both stabilization items implemented per spec.
- ADRs written for both items.
- `handoff.md` updated with: items completed, any surprises encountered, current project state, what the next session (Session 22 — Battle UI visualization layer) should know.

## Out of scope

- Any other audit items (Clusters 2-6 are scheduled; do not pull them forward).
- New abilities, items, or maps.
- Battle UI work (starts Session 22).
- Re-tuning of damage numbers, ability costs, or class baselines (the audit session's reconciliation pass is the source of truth).
- Refactoring beyond what the two items require.

## Files likely touched

- `src/engine/damage/handlers.ts` — `critRoll` clamp
- `src/ai/basic.ts` — candidate-filter extension
- `src/engine/hooks/runners.ts` — possible factor-out of pure-mode `runOnActionAttempted` if needed
- New test files for crit clamp behavior
- `docs/adr/ADR-XXXX-crit-chance-clamp.md` — new
- `docs/adr/ADR-XXXX-ai-pre-filter-on-action-attempted.md` — new
- `docs/handoff.md` — updated

## Workflow notes

- This session has low design uncertainty. Both items are scoped by the audit; the recommended fixes are well-defined.
- If a mid-session design question surfaces (unexpected interaction between the AI pre-filter and an existing AI scoring path, for example), pause and write the question to `handoff.md` for design check-in rather than making a unilateral call. Per the workflow agreement: design questions stop forward progress and route back to design discussion.
- Plaintext-first review is not strictly required for this session given the low design surface, but still a good idea before the AI changes — write down the plan for the candidate-filter extension before touching code, sanity-check it doesn't have unintended interactions with the existing AI scoring, then implement.

## Design decisions captured this conversation (for handoff.md)

These are decisions made in design discussion that subsequent sessions should know about. Capture in `handoff.md` (or `docs/design-decisions.md` if Chris prefers a dedicated file):

- **Purifier × Burn interaction (Session 28).** Purifier doubles tickdown rate of negative-tagged statuses. Burn ticks by stack count, not duration. Decision: Purifier doubling Burn's tick effectively doubles per-stack drain. The damage profile shifts from "spread out" to "front-loaded" — same total damage per stack, but stacks deplete twice as fast. Net positive for wearer (total Burn damage taken is reduced because stacks are consumed faster). Session 28 implements without a check-in.
- **Workflow pattern.** Default execution is documentation-driven (roadmap + handoff + ADRs + spec + audit). Triggered design check-ins at: end of Session 24 (MVP playable, first playtest); end of Session 31 (equipment-complete); end of Session 38 (full demo). Plus opportunistic if a session surfaces an unexpected design question. Mid-session design questions stop forward progress and route to design.

## Estimated size

Small. The crit clamp is a 2-line engine change plus a focused test. The AI pre-filter is more substantial — extending the candidate-filter pass and possibly factoring out a pure-mode hook runner — but follows an existing pattern. Together the implementation is half a session; the other half is tests and ADRs.
