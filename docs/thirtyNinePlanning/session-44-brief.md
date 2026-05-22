# Session 44 Brief: TS Strict-Mode Pile Cleanup + Emergent Maintenance

## Context

S43 closed with the unified team architecture + KO'd-unit pathing fix + stretch AI deployment heuristic landing as a monolith (1285 tests / 115 files). The substrate is now ready for upcoming content sessions (equipment expansion, second map, 5v5).

Before more content work, **S44 takes a maintenance break** to close the long-running TS strict-mode pile (S34 carry). The pile has grown from ~200 errors at strict-mode-enable to ~279 by S43 (+79 net), and continues to accumulate as new content lands. Closing it now is cheaper than closing it later, and restores `npm run build`'s typecheck gate so future content sessions are protected from silent type regressions.

**Primary deliverable:** drive the strict-mode error count from ~279 to 0 and flip `vercel.json` back to `npm run build`.

**Secondary deliverable (conditional):** if the cleanup completes meaningfully under session budget, fold in small emergent maintenance items per the list below.

Scope: **medium.** Bounded but tedious. Most work is mechanical pattern-fix; some fraction (5-15%) may surface genuine latent bugs that need brief design input.

## Inputs (read first)

In recommended order:

1. `CLAUDE.md` — project conventions.
2. `docs/handoff.md` — S43 close. Notable: `Team.control` schema change is live; some new files added zero type errors; the ~279 pile is the pre-existing carry.
3. `tsconfig.json` (and any extended configs) — to understand which strict flags are active. Important reference for the audit's first pass.
4. `vercel.json` — currently runs `vite build` (bypasses typecheck); needs to flip back to `npm run build` post-cleanup.
5. `package.json` — `npm run build` script definition (probably `tsc -b && vite build` or similar).
6. S38 handoff (in git history if not extant) — original spec on error categories: `exactOptionalPropertyTypes` mismatches, `Action | undefined` narrowings, type-literal mismatches like `'water' as DamageTag`. Useful as a starting taxonomy.

### Initial commands for the audit

The audit's first move is to run `tsc -b` (or `npx tsc -b --noEmit`) and capture the full error output. The categorization happens off that.

## Goal

End state:

**Primary:**
- `tsc -b` runs clean: zero errors.
- `npm run build` succeeds end-to-end (typecheck + vite build both pass).
- `vercel.json` `buildCommand` flipped from `vite build` back to `npm run build`.
- Vercel deployment verified to still succeed under the restored gate (production build still produces the working bundle).
- Existing test suite (1285 tests) continues to pass without regression. No new tests strictly required by the cleanup, but new tests likely accompany any latent-bug fixes that surface.

**Secondary (conditional on time):**
- Any emergent maintenance items (listed below) folded in based on implementer's in-session triage.
- `docs/handoff.md` updated.
- New ADR not anticipated, but possible if a latent bug surfaces that requires a design call (then ADR captures the call).

## Pre-implementation plan

This session's plan is structurally different from content/substrate sessions — the work is mechanical, so the audit step is simpler and the architectural decisions are minimal.

### Required first step: enumeration + categorization audit

1. Run `tsc -b` and capture the error output.
2. Categorize errors by pattern type. Expected categories per the S38 spec:
   - **`exactOptionalPropertyTypes` mismatches** — `prop?: T` vs `prop?: T | undefined`; usually in component prop spreads.
   - **`T | undefined` narrowings** — TypeScript can't prove a value is defined at use site.
   - **Type-literal mismatches** — string literals needing explicit cast or type broadening.
   - **`noUncheckedIndexedAccess` cases** (if that flag is active) — `array[i]` returns `T | undefined` in strict.
   - **Other** — anything that doesn't fit the above.
3. Estimate per-category fix cost (rough count of errors + complexity estimate per pattern).
4. Surface to Chris via plan-review **only if** the audit reveals something unexpected — e.g., a category that requires non-mechanical fixes, a hot-spot where a single underlying issue causes many cascading errors, or an estimate that the cleanup would substantially exceed session budget.

If the audit confirms the expected mostly-mechanical character, implementer proceeds directly to systematic fix application without further plan-review.

### Architectural decisions (minimal)

1. **Fix-application order.** Recommend: easiest-category-first (largest batch with smallest per-fix cost) to build momentum and reduce total error count rapidly. Typically `exactOptionalPropertyTypes` and type-literal mismatches are the easiest categories; narrowing cases are more variable.

2. **Latent-bug handling.** When a strict-mode error reveals a genuine bug (not just a type annotation gap), pause and surface to Chris via planner. Don't apply a pragmatic patch that papers over the bug; the typecheck caught it for a reason. Apply real fixes with test coverage as appropriate.

3. **vercel.json flip timing.** Recommend: flip atomically with the cleanup commit (or its tail commit if split). Verifies via local `npm run build` that the gate passes; verifies Vercel build in browser after deploy.

### Decision points

(Most settled by audit findings; not all require plan-review.)

**D1 — Latent-bug handling protocol.** Per architectural decision 2. Recommend: pause + surface; don't paper over.

**D2 — `noUncheckedIndexedAccess` cases (if applicable).** If this flag is active and contributes a large category, two approaches:
- **Pragmatic non-null assertions (`!`)** where the index is provably valid by surrounding logic — minimizes change surface, faster.
- **Proper bounds checks** that handle the undefined case — slower but safer, especially if the bounds aren't trivially provable.

Recommend: use `!` only when correctness is locally obvious (e.g., immediately after a length check); add bounds checks otherwise. Audit may surface examples that need a call.

**D3 — `assignAiTeamNames` removal.** S43 noted this function is now unused (both teams are builder-named since the unified architecture landed) but the function + tests remain. Recommend: **remove if cleanup completes early** (small dead-code reduction); otherwise leave for a later sweep.

**D4 — Emergent maintenance items inclusion.** If the cleanup completes meaningfully under budget, implementer triages emergent items from the list below. Recommend implementer makes the in-session call based on remaining budget; Chris available for any item that needs design input.

## Implementation work

### Primary cleanup loop

For each category, working easiest-first:

1. Identify all errors in the category via `tsc -b` output.
2. Apply the pattern fix to each occurrence. For most categories this is mechanical:
   - `exactOptionalPropertyTypes`: add `| undefined` to receiving prop type, or narrow the spread.
   - `T | undefined` narrowings: add a guard, use optional chaining followed by a check, or use `!` where locally provable.
   - Type-literal mismatches: cast appropriately or broaden the receiving type.
3. After each batch, re-run `tsc -b` to confirm errors in that category are resolved without introducing errors elsewhere.
4. Update tests if a fix changes a function signature or interface contract that test fixtures depend on.

### Latent-bug surfacing

When a fix would require behavior change rather than annotation change:

1. Pause cleanup.
2. Surface to Chris with: error location, what the typecheck is catching, why it's a real bug (not just annotation gap), proposed fix.
3. Chris approves the fix (or proposes alternative).
4. Apply with test coverage.
5. Resume cleanup.

Expect 5-15% of errors to fall in this category. Most will be small (a missing null guard that mattered semantically); a few may surface deeper issues.

### vercel.json flip

Once `tsc -b` runs clean:

1. Update `vercel.json` `buildCommand` from `vite build` to `npm run build`.
2. Run `npm run build` locally to verify end-to-end success.
3. Document the change in the commit message.
4. Post-merge: verify Vercel deployment succeeds with the restored gate.

### Emergent maintenance candidates (conditional)

If primary cleanup completes meaningfully under budget, candidates for in-session triage:

- **`content-id-registry.md` reconciliation** — stale since pre-S39b per S42 handoff. The Alchemist's abilities/passives/statuses are missing from registry tables; the Knight's Lightning Stab swap (S42) and the Assassin's Shadow Arts (S42) need to be added; the Mage rename pass (S40) likely affected ability-id references. Small docs work; high value for future content authors.
- **Border/borderColor React dev warnings** — confirmed pre-existing per S43 watch (not S43's fault); a battle component mixes `border` shorthand with dynamic `borderColor`. Cosmetic but produces console noise during battles. Small UI fix once located.
- **Remove `assignAiTeamNames`** (per D3) — dead code post-S43.
- **ActionType-wiring smoke test** — flagged in `docs/conventions/action-types.md` as future CI item. Small test that drives every `ActionType` through the animator with mock state, catching the animator-gap bug class at CI time. Modest effort; high preventive value.

Implementer triages these in-session based on remaining budget. If none fit, no harm — they remain carry items.

### Tests

The cleanup itself adds minimal tests beyond what existing coverage requires. Expected additions:
- Tests accompanying any latent-bug fixes (small number, dependent on what surfaces).
- ActionType-wiring smoke test if folded in.
- No new tests for type-annotation-only fixes.

Total estimated test count: 1285 → 1290-1310 range, depending on emergent items folded.

## Acceptance criteria

**Primary:**
- `tsc -b` runs with 0 errors.
- `npm run build` succeeds.
- `vercel.json` uses `npm run build` as the build command.
- All 1285 pre-existing tests still pass.
- Vercel deployment verified post-commit.
- Browser-verify no runtime regression (load app, exercise core flows — team builder, deployment, a few battle turns).

**Secondary (if emergent items land):**
- `docs/handoff.md` updated.
- New ADR if any latent-bug fix warranted a documented design call.
- Tests added for any latent-bug fixes.

## Out of scope

- **Equipment expansion (Hi-Potion / Holy Water / Elixir + weapons/accessories)** — was S44 candidate; now displaced to S45.
- **Second map design** — S46 per shifted roadmap.
- **5v5 unlock** — later in roadmap.
- **Pyromancer R/S/M consolidation** (S41 carry) — design-flavored, not maintenance. Future R/S/M review session.
- **Knight base-PA recalibration** (S41 D2 carry) — playtest-driven, not maintenance.
- **Speed Save per-swing reaction cap** (S42 D5 deviation) — design-flavored.
- **Renderer-side multi-swing animation polish** (S42 carry) — design/polish, not type maintenance.
- **Permadeath badge first-playtest visual read** (S41 carry) — needs playtest signal.
- **Charm/Seduction substrate** — dedicated future session.
- **Pass-and-play polish beyond v1 baseline** — future polish session.
- **AI deployment heuristic refinement (role-aware sorting)** — playtest-driven future tuning.
- **Pass-and-play UX refinements based on first-human-playtest signal** — playtest-driven.

## Files likely touched

Audit determines specifics. Expected scope is broad-but-shallow: many files touched, few lines per file. Likely distribution:

- **Component files** (`.tsx`) — `exactOptionalPropertyTypes` mismatches in prop spreads.
- **Engine files** — `T | undefined` narrowings (action handlers, reducers, accessors).
- **Test fixtures** — schema change updates (e.g., `Team.control` already landed but other shape changes may surface).
- **Type definition files** — type-literal additions, optional property declarations.
- **`vercel.json`** — single-line change at session end.

Files NOT touched (within scope discipline):
- No new content files.
- No engine substrate refactors beyond what a latent-bug fix would necessitate.
- No new ability definitions or class additions.

If emergent maintenance items land, additional files per item:
- `docs/content-id-registry.md` — reconciliation pass.
- Battle component with border warning — UI fix.
- `src/content/teams/assign-ai-team-names.ts` (and tests) — removal if D3 approved.
- New test file for ActionType-wiring smoke test — addition.

## Workflow notes

- **Plaintext-first review required.**
- **Audit-first.** The audit's primary product is a categorized error inventory + cost estimate. Plan-review checkpoint only if the audit reveals something unexpected (large non-mechanical category, hot-spot single root cause, scope concern).
- **Latent-bug handling per D1.** Pause + surface; don't paper over.
- **Single ongoing commit branch.** Mechanical fixes can land in batches; commit messages note which category each batch addresses. Latent-bug fixes get their own commits with test coverage.
- **`vercel.json` flip is the session's final verifying step.** Before that, the build pathway is unchanged.
- **Mid-session design questions** route through Chris to the planner. Most likely surfaces: latent-bug fixes requiring design calls; unexpected error categories not in the S38 spec; cascade scenarios where one fix surfaces dozens of secondary errors.
- **Phase F session, but pure maintenance** — no playtest signal gathering; playtest from S43 continues to accumulate on the side and is not affected by this session.

## Watch-fors

**Addressed this session:**
- TS strict-mode pile (S34 carry, primary deliverable).
- `vercel.json` typecheck-bypass workaround (resolved post-cleanup).
- Possibly: `content-id-registry.md` staleness, border warnings, `assignAiTeamNames` dead code, ActionType-wiring smoke test (conditional on time).

**Not addressed this session, longer-term carry-forward:**
- Equipment expansion (S45 candidate).
- Second map design (S46 candidate).
- 5v5 unlock (later in roadmap).
- Pyromancer R/S/M consolidation (future R/S/M review).
- Knight base-PA recalibration (playtest-driven).
- AI deployment role-aware sorting (playtest-driven).
- Speed Save per-swing reaction cap (S42 D5 deviation).
- Renderer-side multi-swing animation polish (S42 carry).
- Permadeath badge first-playtest visual read (S41 carry).
- Pass-and-play UX refinements (playtest-driven).
- Charm/Seduction (substrate session).
- All other long-running carries from prior handoffs.

**Watch-fors specific to this session:**

- **Cascade fixes.** A type change in a deeply-shared utility may surface many secondary errors at call sites. Worth tracking which fixes have ripple effects; refactor the shared utility carefully rather than band-aiding each call site.
- **Test fixture updates.** Some test fixtures may need shape updates to match newly-strict type definitions. Mechanical but real.
- **`exactOptionalPropertyTypes` semantics.** Easy to introduce bugs by accidentally treating an absent property as present-but-undefined or vice versa. Especially watch component prop spreads where conditional defaults are involved.
- **Latent-bug accumulation in narrowing fixes.** The `T | undefined` category is where genuine bugs most often hide. Be deliberate about each narrowing — is it really safe to assert non-null here, or does the call site need a real guard?
- **Vercel deployment after flip.** The flip should produce a successful deploy with the restored gate; verify Vercel's build log shows tsc completing without errors. If something fails on Vercel that doesn't fail locally, environment differences need investigation.

## Estimated size

**Medium.** Bounded by error count (~279) and mostly mechanical character. Per-error cost varies: trivial pattern fixes are seconds each; latent-bug surface-and-discuss cycles are minutes. Estimated session budget should accommodate the full pile + a few latent-bug discussions + a couple of emergent maintenance items.

**No split contingency anticipated.** The cleanup is monotone in the sense that each fix is independent of others; it can stop at any point without leaving an inconsistent state. If session budget is exhausted partway through, the remaining errors stay as carry, and the codebase remains in the working "vite build bypasses typecheck" state.

**Stretch indicator:** if the implementer enumerates the audit and the count is closer to ~200 than ~279 (some errors having been resolved incidentally in S42/S43), or if the categorization shows very few latent-bug-shaped fixes, the cleanup fits with plenty of room for emergent maintenance.
