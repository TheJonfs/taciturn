# Session 25 Brief: Cluster 2 Substrate + UI Fold-ins

## Context

Phase A is closed. The MVP is playable; Session 24 + 24.5 produced 667/0 across 58 files with rich UI surfaces (forecast, projection, queue tower, action log, results, pause overlay, portraits). Chris's second-pass playtest produced four small UI items that fit the substrate session's scope, plus the conversation-settled Attack-in-Act repositioning, plus the Session 24 Wave-2 carry-forward `consumed.waited` cleanup.

This session opens Phase B with **Cluster 2 substrate work**: the `availability` tag field on abilities and items, the `deploymentZone` tile field, and initial-CT randomization. The substrate is the prerequisite for Sessions 25+ team-builder UI, deployment-phase UI, equipment-content tagging, and starting-tempo variation. None of this surfaces visibly to the player yet — it's enabling work for future sessions.

Five small UI fold-ins ride alongside the substrate work to clear post-MVP-playtest accumulation without scheduling a separate session.

## Inputs (read first)

In recommended order:

1. **`CLAUDE.md`** — project conventions.
2. **`docs/handoff.md`** — Session 24.5 handoff. Note especially the carry-forward items deferred to a future polish pass (not in scope here).
3. **`docs/twentyOnePlanning/roadmap-sessions-21-plus.md`** — Session 25 entry; Session 26 entry for context on what's downstream.
4. **`docs/audits/post-20-engine-audit.md`** — Items 13, 14, 18 detail the substrate work this session implements. Section E for general context.
5. **`docs/twentyOnePlanning/mage-war-content-spec.md`** — references the availability tag's visible / hidden categorization.

### Paths to survey before planning

Current-tree audit required. At minimum survey:

- `src/engine/catalog/` — where the catalog-load validator lives (or should live)
- `src/engine/catalog/definitions/` — `AbilityCommon` / `EquipmentBase` / `Tile` / similar base types for the new fields
- `src/content/abilities/` — every ability file gets an `availability` field added
- `src/content/items/` — every item file gets the same
- `src/content/classes/` — particularly `knight.ts` for the `white_magic` removal and the universal-Attack `freeAbilities` already-landed verification
- `src/engine/state.ts` and the orchestrator initialization path — for initial-CT randomization
- `src/engine/rulesets/` (wherever rulesets live) — default ruleset modification, test ruleset implications
- `src/content/battles/demo.ts` and `training-field-battle.ts` — initial-CT touchpoints
- `src/ui/action-menu.tsx` — for the Attack-in-Act repositioning
- `src/ui/action-log-format.ts` — for the charged-action target addition and team coloring
- `src/ui/action-log-panel.tsx` — for team-coloring rendering
- `src/ui/queue-tower.tsx` and the active-anchor — for the enemy-portrait flip
- `src/engine/actions/reducers.ts` and `src/engine/forecast/ct-preview.ts` — for the `consumed.waited` decorative cleanup
- Integration tests in `src/engine/orchestrator.test.ts` and `src/ai/ai-controller.integration.test.ts` — for initial-CT impact on test calibration

The plan articulates what exists, what's being refit, what's being added, what's being removed.

## Goal

End state:

- **Substrate**: `availability` field on every ability and item with catalog-load validation; `deploymentZone` field on tile definitions; default ruleset uses uniform-int [0, 20] initial CT.
- **Content tagging**: every existing ability and item carries an explicit `availability` value. Hidden categorizations applied per the content spec (float, fly, discharge_strike, cure, white_magic-set's contents, iron_helm, iron_mail, strength_ring). Everything else marked `available`. Knight's secondary command set list drops `white_magic`.
- **Attack-in-Act**: top-level menu becomes Move / Act / End turn / Status (Attack-as-top-level removed; Attack lives at the top of Act's ability list).
- **Action log charged-target**: `charged_action_resolve` rows include the target (unit name or tile coords) in the resolve line.
- **Action log team coloring**: unit names and charged-action references in action-log entries render in team color (blue / red).
- **Tower portrait flip**: enemy-team portraits in QueueTower mini-cards and active anchor render horizontally flipped, matching the canvas convention.
- **`consumed.waited` cleanup**: flag removed from `TurnConsumption` and all reads (per Session 24 Wave 2's scan finding no consumers).

Tests at 667+, 0 failing. New pure-logic surfaces (catalog validator, initial-CT roll determinism, log segment-team mapping) covered.

## Pre-implementation plan (required)

Same discipline as Sessions 22-24.5: current-tree audit first; architectural decisions surfaced before code.

### Required first step: current-tree audit

For each surface this session touches: what exists, what state it's in, what this session does to it. Especially important for the catalog-load validator (does one exist? where? what's its current strictness?) and the ruleset surface (which rulesets exist? which are test-vs-content?).

### Architectural decisions

After the audit:

1. **Availability field location.** Default expectation: `availability: 'available' | 'hidden'` as a required field on `AbilityCommon` and `EquipmentBase`. Audit may reveal slightly different shape (e.g., `AbilityDefinition` as the super-type, or a separate `CatalogMetadata` mixin). State the choice.

2. **Catalog-load validator.** Does one exist already? If yes, extend to enforce `availability` presence. If no, add one — minimally, a function called at content-module load that fails loud if any ability/item is missing the field. State whether validation is at module-load time, at battle-start time, or both.

3. **`deploymentZone` tile field.** Optional `deploymentZone?: TeamId | null` on the `Tile` interface. No content uses it yet (training-field-battle.ts doesn't need it; River Ridge content lands in Session 33). Just substrate. Confirm the type is what the design doc expects.

4. **Initial-CT randomization.** New `{ kind: 'uniform_int', min: number, max: number }` variant on `RulesetInitialCT`. Default ruleset switches to `{ kind: 'uniform_int', min: 0, max: 20 }`. Resolver hashes `(masterSeed, unitId)` into the integer range for deterministic-given-seed behavior. **Important**: audit reveals which rulesets exist. Test rulesets that rely on deterministic CT=0 starts (the AI-vs-greedy integration test in particular) should explicitly opt back into the fixed-value variant rather than inheriting the new default. Identify all such test rulesets in the audit; preserve their deterministic behavior. The default ruleset change should only affect content that doesn't override.

5. **Action-log team coloring approach (Path A vs Path B).** Settled in conversation: Path A — segment-based `LogRow`. Each row's text becomes an array of segments where each segment has `{ text: string, team?: TeamId }`. Formatter does team lookup when emitting unit-naming segments and charged-action references. Renderer applies team-color CSS to segments with a team. State the segment type's exact shape and how existing single-string callers migrate.

6. **Bulk availability tagging scope.** From the audit, identify the exact count of files needing the field. Substantively, this is mechanical addition. The interesting decision: how to handle test fixtures that declare inline abilities (e.g., for unit-test purposes). Test-only abilities probably get `'hidden'` to keep them out of any future team builder, but state the call.

7. **Attack-in-Act refit.** Current top-level menu (post-Session 24/24.5): Move / Attack / Act / End turn / Status. New top-level: Move / Act / End turn / Status. Attack moves into Act's ability list as the first entry. State the action-menu state-machine impact: when the player picks Act, what does the resulting state look like? If the unit has only one command set, the flow is now Act → command-set's abilities (Attack at top, then class abilities) → target-select. If the unit has multiple command sets (currently none do; future feature), the flow is Act → command-set picker (or Attack visible at this level too?) → ability list. State the design call for the multiple-command-set case.

8. **`consumed.waited` cleanup.** Session 24 Wave 2's scan found no consumers beyond the cost-evaluation path that was already changed. Re-verify the scan in the audit (catalog has likely grown since); remove the field from `TurnConsumption` if still safe. State the changes to any consumers found.

9. **Polish-pass tracking.** Several items are tracked for a future dedicated polish pass — see the watch-fors section below. This session does *not* address them; if any seem to naturally fit into the audit's findings, flag rather than pull in.

10. **Test strategy.** Catalog validator gets a unit test. Initial-CT random resolver gets a determinism test (same seed yields same CT for same unit). Action-log segment formatter gets pattern coverage tests. Substrate changes verified by existing test suite still passing. State any specific tests being added.

The plaintext plan is reviewed before code lands.

## Implementation work

Following plan approval, items land roughly in priority order: engine substrate first, content tagging second, UI fold-ins third.

### Item 1: Availability field substrate

Add the `availability` field per the plan's decision. Implement / extend the catalog-load validator to enforce presence.

### Item 2: deploymentZone tile field

Add the optional field per the plan. No content consumes it yet.

### Item 3: Initial-CT randomization

New `uniform_int` variant + resolver. Default ruleset switches to the new variant. Test rulesets preserved per the audit's findings.

### Item 4: Bulk availability tagging

Every ability and item gets an explicit `availability` value:

- **Hidden abilities**: `float`, `fly`, `discharge_strike`, `cure`, and the `white_magic` command set's contents (if the set-level hide isn't supported by the schema, hide the ability instances within).
- **Hidden items**: `iron_helm`, `iron_mail`, `strength_ring`.
- **Test-fixture-only abilities**: per the plan's call.
- **Everything else**: `'available'`.

### Item 5: Knight class file cleanup

Remove `white_magic` from Knight's secondary command sets. Knight ships v1 with `battle_skill` only.

### Item 6: Attack-in-Act repositioning

Top-level action menu becomes Move / Act / End turn / Status. Attack moves into Act's ability list as the first entry, ahead of class abilities. Universal-Attack `freeAbilities` membership already established in Session 24 Wave 2 — no change there; the change is purely the action-menu display location.

### Item 7: Action-log charged-target

`formatAction`'s `charged_action_resolve` branch gains target rendering. Format becomes `T#### <Actor>'s <Spell> resolves on <Target>: <outcomes>`. Target is the unit name for unit-targeted abilities, or `(x, y)` for tile-targeted. AoE footprint not rendered in the log line (deferred per Chris's note — tower is the AoE inspection surface).

### Item 8: Action-log team coloring (Path A segment-based)

`LogRow` segments extended per the plan. Formatter emits team-tagged segments for unit names and charged-action references. Renderer applies team color via CSS class or inline style.

### Item 9: Tower enemy-portrait flip

CSS `transform: scaleX(-1)` (or React equivalent) on portrait `<img>` elements in QueueTower mini-cards and the active-anchor portrait when the rendered unit is on team_b. Matches the canvas-sprite flip idiom.

### Item 10: `consumed.waited` cleanup

Remove the `waited` field from `TurnConsumption` per the audit's re-confirmed scan. Cleanup the now-unused decorative flag.

## Acceptance criteria

- `availability` field present on every ability and item; catalog-load validator enforces it.
- `deploymentZone` field on `Tile` interface; type-checks correctly.
- Default ruleset uses uniform-int initial CT; test rulesets preserved per audit.
- All abilities and items tagged per the content spec; hidden items and hidden abilities verified to be flagged.
- Knight's `commandSets` list contains only `battle_skill`.
- Top-level action menu: Move / Act / End turn / Status (4 items, no top-level Attack).
- Attack appears at the top of Act's ability list.
- Action log charged-resolve rows include target name or tile coords.
- Unit names in action log entries render in team color (blue or red).
- Enemy-team portraits in QueueTower flip horizontally; ally-team portraits don't.
- `consumed.waited` field removed; no code reads it post-cleanup.
- Tests at 667+, 0 failing. Existing AI-vs-greedy integration test still calibrated correctly (or explicit ruleset override applied to preserve calibration).
- ADRs written for: catalog-load validator architecture (if substantial); the initial-CT ruleset variant + test-ruleset preservation strategy; possibly the LogRow segment shape change. Other ADRs at implementer's discretion.
- `handoff.md` updated.

## Out of scope

These items are **tracked for a future polish pass**, deliberately not addressed in this session:

- **Tile-info corner overlay** (Chris's playtest item 2 from Session 24.5 review) — X / Y / Elevation / Terrain hovered-tile display, forward-compatible for tile-effect icons. New UI component.
- **Portrait restructure** (Chris's playtest item 3 from Session 24.5 review larger part) — black background + colored ring outside the portrait square (vs. current colored body + portrait + ring at body edge). Renderer-side restructure.
- **Charged-action timing projector accuracy** (Session 24.5 carry-forward) — `estimateChargedTiming` should walk projected CT schedule including other charged resolves.
- **QueueTower slot-in for charged-action resolves** (Session 24.5 carry-forward) — charged resolves appear as their own events at projected resolution time.
- **Charged-action animation pacing on canvas** (Session 24.5 carry-forward) — pacing tweaks for visible spell resolves.
- **WAIT-CONFIRM keyboard support** (Session 24 Wave 2 carry-forward) — arrow keys → facing direction.
- **Mini-timeline for forecast Timing subsection** (Session 24 Wave 1 carry-forward) — full visual timeline of upcoming events around a charged action's resolve.

Plus the long-standing carry-forwards (see Watch-fors).

If an audit finding for this session's substrate work happens to make one of these polish items trivial to ship alongside, raise it via the conduit rather than pulling in unilaterally. Default: defer.

## Files likely touched

A non-exhaustive list. Audit confirms / corrects.

- `src/engine/catalog/definitions/ability-common.ts` (or similar) — availability field
- `src/engine/catalog/definitions/equipment-base.ts` — availability field
- `src/engine/catalog/definitions/tile.ts` — deploymentZone field
- `src/engine/catalog/validator.ts` (new or extended) — catalog-load validation
- `src/engine/rulesets/default.ts` (or wherever) — initial-CT variant + new default
- `src/engine/orchestrator.ts` or initial-state-creation — initial-CT resolver call
- `src/content/abilities/**/*.ts` — bulk availability field addition (~36 files per Cluster 2 brief sketch; audit confirms exact count)
- `src/content/items/**/*.ts` — same (~5 files)
- `src/content/classes/knight.ts` — commandSets cleanup
- `src/ui/action-menu.tsx` — Attack-in-Act
- `src/ui/action-log-format.ts` — charged-target + team segments
- `src/ui/action-log-panel.tsx` — team-color rendering
- `src/ui/queue-tower.tsx` — enemy-portrait flip
- `src/engine/actions/reducers.ts`, `src/engine/forecast/ct-preview.ts`, `src/engine/actions/types.ts` — `consumed.waited` cleanup
- Possibly `src/engine/orchestrator.test.ts` and `src/ai/ai-controller.integration.test.ts` — explicit ruleset override if needed to preserve calibration
- New tests for catalog validator, initial-CT determinism, LogRow segments.
- New ADRs in `docs/adr/` as needed.
- `docs/handoff.md` updated.

## Workflow notes

- **Plaintext-first review required.** Same discipline as 22-24.5.
- **Audit-first within the plan.** Particularly important for the test-ruleset implications — initial-CT randomization changes default behavior, and any test that relied on CT=0 starts needs explicit preservation. The audit should enumerate these.
- **Bulk tagging is mechanical but voluminous.** The time-cost is in volume, not difficulty. If the audit reveals significantly more files than expected (~50+ instead of ~40), no split needed — just allocate the time.
- **Polish-pass discipline.** Several items are in the "tracked for polish pass" bucket. They're listed in Out of Scope. If the audit shows any of them would slot trivially into this session's work, raise via conduit; otherwise defer.
- **Mid-session design questions** route through Chris to the planner. Most likely surface area: catalog-validator API shape, ruleset override mechanism for tests, LogRow segment type if Path A turns out to have an obstacle the audit reveals.
- **The integration test calibrated to `demoBattle`'s 6×6 board** stays calibrated to it. Any test-ruleset preservation work for initial-CT randomization must not perturb the AI-vs-greedy win-rate balance.

## Watch-fors

**Addressed this session:**
- All 10 items in the goal section.
- `consumed.waited` cleanup (Session 24 Wave 2 carry-forward).
- Initial-CT randomization (audit Item 13 carry-forward).
- Availability tag substrate (audit Item 18 carry-forward).
- `deploymentZone` tile field (audit Item 14 carry-forward).
- Knight `white_magic` removal (Session 24 design call carry-forward).

**Tracked for future polish pass** (likely Session 26.5, between movement abilities content and Cluster 3 substrate — subject to confirmation when Session 26 wraps):
- Tile-info corner overlay (Chris's playtest item 2)
- Portrait restructure: black-bg + outside ring (Chris's playtest item 3 larger part)
- Charged-action timing projector accuracy (Session 24.5 carry-forward 3a)
- QueueTower slot-in for charged-action resolves (Session 24.5 carry-forward 3b)
- Charged-action animation pacing (Session 24.5 carry-forward 18 final)
- WAIT-CONFIRM keyboard support (Session 24 Wave 2)
- Mini-timeline for forecast Timing subsection (Session 24 Wave 1)

**Not addressed this session, longer-term carry-forward:**
- Top bar `Turn T####` is O(actionLog.length) (Session 22 carry-forward)
- Renderer's MP "max" captured at mount (Session 22 carry-forward; Session 28 lifts)
- Status-badge polarity convention `tags` vs `polarity?` (Session 22 carry-forward)
- rAF vs setInterval for animation drain (Session 23 carry-forward)
- AoE preview correctness across all shapes (Session 23 carry-forward; partially addressed by Session 24.5's regression tests)
- MP / status snapshot ahead-of-tween fix (Session 22 carry-forward)
- `docs/content-snapshot.md` drift (Session 21 carry-forward; Session 26 refresh)
- Resistance composition cap at 100 (audit E2; Session 27 candidate)
- `pa_factor` NotYetImplementedError (audit E3)
- `equipmentContributionsFor` "branch per hook" (audit E4; Session 27 natural moment)
- TS strict-mode test errors (audit E8)
- Surrender flow (Session 34 / ADR-0041)
- MVP-unit smarter algorithm (Session 24 Wave 1)
- Permadeath timer (Session 24 Wave 1)
- Settings expansion (Session 24 Wave 1)
- Reactions in projection column (Session 24 Wave 1)
- Lightning Mage's `quickstep` refund visibility (Session 26 lands the ability)
- Bug 1 (Session 24.5 ADR-0046): targeting failure on enemy mid-battle; instrumentation in place, awaiting next playtest occurrence
- Portrait asset sizes (~4MB each → ~20MB initial load) — pre-release pipeline candidate
- Vite HMR cache invalidation occasional issue

## Estimated size

Medium. Substrate items individually are small per the audit, but the bulk availability tagging touches the most files of any session in this arc. The fold-ins are individually small (one CSS flip, one formatter target, one segment refactor, one menu repositioning, one cleanup). Total scope is comparable to Session 25's original Cluster 2 sketch from `roadmap-sessions-21-plus.md`, plus the fold-in set. No split should be needed; if it is, propose lines based on audit findings.
