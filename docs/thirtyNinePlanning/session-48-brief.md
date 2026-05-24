# Session 48 Brief: 5v5 Unlock + Team Export Utility + Template Refresh + Stray Ability Cleanup + Ability Tooltips

## Context

S47 closed with Stonebridge (second map) + rampart tile type + vertical-axis targeting substrate (uniform magic vertical-infinite + AoE tolerance default + new `modifyAoeVerticalTolerance` hook) + all four stretch cleanups (`assignAiTeamNames` removal, border warnings fix, permadeath badge removal, content-id-registry maps/terrain additions). 1375 tests / 119 files. Playtest of the new map is in progress and going well.

S48 takes on a **multi-item content + UX session** focused on team-building maturity:

1. **5v5 team-size unlock** for both River Ridge and Stonebridge. Currently hardcoded at 4v4.
2. **Team export utility** in the team-builder UI — outputs the current team as JSON for paste-and-integrate into the default template set. Enables Chris to author new templates without round-tripping through code.
3. **Template refresh** — wholesale replacement of the current bundled templates (Aggro Knight Squad, Mage Variety Pack, Defensive Front, Shadow and Steel, Highland Hunters) with new 5-unit teams Chris authors via the new exporter. Old templates retained for tests/internal use; not surfaced in the default user picker.
4. **Stray ability cleanup** — `Move +1` and `Bulwark Stance` currently float in the builder without belonging to any class. Decisions per D4.
5. **Ability tooltips** — hover descriptions for Command Set abilities in the team-builder (existing R/S/M passives already have these per S47; this extends to ability sets).

**Session character:** medium, with an explicit iterative checkpoint mid-session. The exporter is most useful if Chris can use it to author new templates while the implementer continues with other items, then come back to integrate the new templates near the end.

Scope: **Medium.** Most items individually bounded. The iteration on template content depends on Chris's working pace.

## Inputs (read first)

In recommended order:

1. `CLAUDE.md` — project conventions.
2. `docs/handoff.md` — S47 close + S48 candidate preview.
3. `docs/decisions/0082-unified-team-architecture.md` — S43 unified team architecture, including `Team.control` flag and battle-config team representation.
4. `docs/decisions/0085-vertical-axis-targeting-rules.md` — S47 vertical substrate (reference; not modified).
5. `docs/maps/river-ridge.md`, `docs/maps/stonebridge.md` — current map specs (zone definitions; reference for 5v5 capacity).
6. `team-builder-architecture.md` — current team builder design; relevant for adding exporter + extending to 5v5.
7. `core-types.md` — `Team`, `Unit`, equipment, R/S/M slot model.

### Paths to survey before planning

Audit determines specifics. The audit's key deliverables:

- **5v5 unlock hard-coded values.** Per the S47 handoff: `team-builder-state.ts:60` and the deployment-zone validation gate. Survey for any other hardcoded "4" values throughout the team-builder UI (roster grid slots?), battle setup, deployment phase, AI deployment heuristic's slot loop, and any test fixtures that assume 4. Compile the full list before changing anything.
- **Current template definitions.** Survey `src/content/teams/` (or wherever defaultTeamTemplates lives) for the existing 5 templates. The team data shape is what the exporter must produce; the existing format is the integration target.
- **Existing R/S/M tooltip infrastructure.** Per S47, hover text was authored for 9 passives. Survey how that UI works (component, data model for descriptions, rendering). Ability tooltips should reuse the same pattern.
- **Ability description fields.** Survey current ability definitions for an existing `description` field, or determine if descriptions are stored elsewhere. The tooltip implementation depends on whether description text is already authored, partially authored, or absent for Command Set abilities.
- **Stray ability registrations.** `Move +1` and `Bulwark Stance` exist in the builder UI but not on any class's native R/S/M slots. Confirm via the catalog registry — these are probably registered as cross-class-available passives without a class home. Audit determines whether they have descriptions, where they're rendered, and what the cleanest cleanup looks like.
- **Test fixture impact.** Surveys of existing fixtures (`session-X-integration.test.ts`, class-kit tests, scenario tests) for hard-coded 4-unit assumptions.

## Goal

End state:

**5v5 unlock:**
- Team-builder accepts up to 5 units per team.
- Deployment validates 5-unit teams on both maps (zone capacity confirmed adequate: River Ridge 12 tiles, Stonebridge 8 tiles).
- AI deployment heuristic places 5 units correctly.
- Pass-and-play, mid-battle handoffs, and battle config carry team-size through.
- Existing 4v4 templates and battles continue to work (no regression).

**Team export utility:**
- "Export team" button in team-builder UI.
- Outputs team JSON to a copy-pasteable surface (modal? clipboard? both?).
- JSON format matches the existing template-definition shape (importable by hand into the template registry).
- Enables Chris to author new templates iteratively during or after the session.

**Template refresh:**
- 5+ new 5-unit teams authored by Chris and integrated as the new default template set.
- Default templates exposed in the team-builder picker UI.
- Old 4-unit templates retained in a separate "test templates" pool (used by integration tests but not surfaced in normal play).
- Battle config and scenarios continue to use whichever templates they reference (test scenarios may reference old templates; new scenarios use new).

**Stray ability cleanup:**
- `Move +1` and `Bulwark Stance` either attached to a class as a native R/S/M, suppressed from the catalog, or kept with explicit cross-class-only-availability. Decision per D4.

**Ability tooltips:**
- Hover descriptions for Command Set abilities in the team-builder UI, matching the existing R/S/M tooltip pattern.
- Descriptions authored or backfilled for any Command Set abilities lacking them.

**Quality:**
- Tests at 1395-1425 range (estimated +20-50; 5v5 fixtures + exporter + tooltips + cleanup).
- ADR if needed (likely no — these are content/UX items mostly within existing substrate; possible exception if 5v5 surfaces something architectural).
- `docs/handoff.md` updated.
- `docs/playtest-watch.md` updated with 5v5-specific items and new-template observations.
- Browser verification: 5v5 team built on both maps; export button used; new templates loadable; tooltips render correctly; stray abilities resolved.

## Pre-implementation plan

Audit-first per project conventions. **Plan-review checkpoint between audit completion and code-writing** — multiple discrete items, so the audit's most important product is a clear scope-per-item assessment.

### Required first step: current-tree audit

Per "Paths to survey" above. Audit deliverables:

1. **5v5 hardcoded value inventory.** Complete list of hardcoded "4"s in the team-builder, deployment, validation, and AI paths. Probably small (the handoff identified `team-builder-state.ts:60` + the zone validator; likely a few more in UI components and fixtures).
2. **Template format spec.** Document the existing template-definition shape — what fields, what types, what's required vs optional. This becomes the exporter's output target.
3. **Tooltip infrastructure compatibility.** Confirm whether the existing R/S/M tooltip pattern extends to ability tooltips cleanly, or whether ability descriptions need a separate UI component.
4. **Stray ability disposition options.** For `Move +1` and `Bulwark Stance`: surface their current state (registered? rendered? described?) and propose disposition options for plan-review.

If the audit reveals 5v5 unlock is larger than the handoff suggested (e.g., team-size is baked into more substrate than expected), surface for plan-review escalation before coding.

### Architectural decisions

After audit:

1. **5v5 unlock approach.** Recommend: parameterize team-size as a battle-config field (`teamSize: 4 | 5 | …`) rather than hardcoded "4". Threads through team-builder, deployment, validation. Map-level "max supported team size" is a separate consideration: River Ridge and Stonebridge both fit 5; future maps could specify smaller (or larger) limits via map metadata.

2. **Team export utility shape.** Recommend: button in the team-builder UI (visible when team is complete and valid); opens a modal with the JSON in a textbox, with a "Copy to Clipboard" button. JSON format matches the existing template-definition spec (per D2 audit). No back-import functionality this session — purely export-out for human hand-paste into source code.

3. **Template refresh integration pattern.** Recommend: split the template registry into `defaultTemplates` (user-picker, refreshed this session) and `legacyTemplates` (test fixtures, scenarios, retained). The UI picker shows `defaultTemplates`. Tests can reference either explicitly. Avoids "delete old templates and break a dozen tests" failure mode.

4. **Ability tooltips pattern.** Recommend: reuse the existing R/S/M tooltip component (or close variant); render on hover over the ability slot in the Command Set picker UI. Descriptions sourced from the ability's `description` field (or equivalent). Backfill any missing descriptions for Command Set abilities as part of this work.

5. **Stray ability cleanup options.** Two abilities to dispose of:
   - **`Move +1`**: per S41 D3, Bravestrider (Knight Movement) became the replacement for what was a generic Move +1 passive. The bare `Move +1` is likely obsolete content from pre-Bravestrider days. Recommend: **suppress** (remove from catalog), unless any current content references it.
   - **`Bulwark Stance`**: per S47 handoff (hover text authored alongside Knight's Martial Expertise and Bravestrider), Bulwark Stance was Knight-flavored. Status unclear: maybe a Knight passive that didn't get attached, or content drafted but never wired. Audit confirms current registration. Recommend: **attach to Knight** if Knight has an open R/S/M slot pattern fit (probably as a second Reaction or Support option), OR **suppress** if it doesn't make sense without further design work. Defer to Chris's call in plan-review.

### Decision points

(Settled in plan-review.)

**D1 — 5v5 zone capacity confirmation.** River Ridge has 12-tile zones; Stonebridge has 8-tile zones. Both > 5; no zone expansion needed. Per Chris's correction: "8 tiles for 5 units is fine; even 6 would fit." Confirmed.

**D2 — Team export format.** JSON matching the existing template-definition shape. Audit produces the exact spec. Plan-review confirms.

**D3 — Template retention policy.** Recommend: split registry into `defaultTemplates` (user-facing) and `legacyTemplates` (tests/internal). Audit determines whether existing tests reference templates by ID or by import — affects how clean the split is.

**D4 — Stray ability disposition.**
- *Move +1*: recommend suppress (obsolete content; Bravestrider replaced).
- *Bulwark Stance*: recommend attach to Knight if there's a clean R/S/M slot for it, else suppress. Audit surfaces current state; Chris settles in plan-review.

**D5 — Ability tooltip UI pattern.** Recommend reuse of R/S/M tooltip component (verbose pattern); ability descriptions sourced from ability definitions' `description` field. Backfill any missing descriptions (audit identifies which abilities lack them).

**D6 — New template authoring workflow.** Recommend: implementer ships the exporter as an early commit (within the session), Chris exports new teams during or after, implementer integrates as a later commit. Iterative within-session if Chris is available; carries to a follow-up if not. Either way, the session's exporter + tooltips + 5v5 work + cleanups land independently of when template authoring completes.

## Implementation work

### 5v5 unlock

- Identify all hardcoded "4" values in team-builder, deployment, validation, AI deployment, and tests (audit).
- Parameterize team-size as battle-config field (or equivalent).
- Update team-builder UI to accept up to 5 units (roster grid, validation feedback).
- Update deployment phase to handle 5 units.
- Update AI deployment heuristic to place 5 units (HP-descending sort + slot loop; structurally team-size-agnostic, just remove any hard-4 ceiling).
- Update pass-and-play handoff, mid-battle UI, etc., to display correctly with 5-unit teams.
- Test fixture updates for any 4-hardcoded test that should generalize.

**Tests:** ~10-15. 5v5 team builds; 5v5 deployment; 5v5 AI deployment; 5v5 mid-battle; 4v4 regression check.

### Team export utility

- Add "Export Team" button to team-builder UI (visible when team is valid/complete).
- Modal with JSON output + Copy-to-Clipboard.
- JSON format per D2; matches existing template-definition spec.
- Audit confirms whether existing template definitions include team name, control flag, unit class + name + equipment + R/S/M selections. Exporter mirrors.

**Tests:** ~5. Exporter produces correct JSON shape; round-trip (export → import as template definition → re-load) preserves team identity.

### Template refresh

**Implementer phase (early-session):**
- Ship exporter (above).
- Plan integration spot: `src/content/teams/defaultTemplates.ts` (or equivalent). Identify the spot where the user-picker reads its template list.

**Chris phase (mid-session, async or alongside):**
- Author 5+ new 5-unit teams using the team-builder + exporter.
- Provides JSON to implementer via the planner or directly.

**Implementer phase (late-session):**
- Receive Chris's JSON team definitions.
- Convert each to a `TeamTemplate` typescript constant.
- Add to `defaultTemplates`.
- Move old templates (or specific ones) to `legacyTemplates`.
- Update tests that referenced old templates explicitly (preserve if used as test fixtures).
- Update battle scenarios referencing templates (may need to map old→new or remain on old/legacy).

**Tests:** ~5-10. New templates load correctly; legacy templates accessible for tests; default picker shows new set only.

### Stray ability cleanup

Per D4 audit + plan-review:

- **`Move +1`**: if obsolete, remove from catalog registry + ability list + any references. Tests pass (regression: no current test expects `Move +1`).
- **`Bulwark Stance`**: per Chris's call, attach to Knight or suppress. If attached: add to Knight's native R/S/M slots (with cost) + tests cover the new native passive. If suppressed: same removal as above.

**Tests:** ~3. Removed abilities no longer in catalog; if Bulwark Stance attaches, the Knight class-kit test covers it.

### Ability tooltips

- Identify the Command Set picker UI in the team-builder.
- Add hover handling that displays the ability's description.
- Reuse existing tooltip component from R/S/M passives (or close variant).
- Backfill descriptions for Command Set abilities lacking them (audit produces the list).
- Verify all abilities have descriptions before session close.

**Tests:** ~5. Tooltip renders for known abilities; tooltip dismisses on hover-out; description text matches the ability's stored description.

### Tests (total)

Estimated +30-40 tests across all items.

### UI surfaces

- Team-builder roster grid: 5 slots instead of 4.
- Team-builder Export button + modal.
- Team-builder ability slot tooltips.
- Default template picker: new template set (5-unit teams).
- Deployment phase: 5-unit team support.
- Mid-battle UI: 5-unit team displays correctly.

## Acceptance criteria

**5v5:**
- Build a 5-unit team in builder; team valid.
- Deploy 5-unit team on River Ridge; deployment validates.
- Deploy 5-unit team on Stonebridge; deployment validates.
- Battle starts with 5 vs 5 teams; turns advance correctly.
- AI deployment places 5 units sensibly.
- Existing 4v4 templates still build, deploy, and battle correctly.

**Exporter:**
- Export button visible when team is valid.
- Export modal opens with JSON output.
- JSON shape matches template-definition spec.
- Copy-to-Clipboard works.

**Template refresh:**
- New 5-unit templates appear in default picker.
- Old templates accessible for tests via legacy registry.
- Loading a new template populates team builder correctly.

**Stray abilities:**
- `Move +1` and `Bulwark Stance` resolved per D4.

**Tooltips:**
- Hover over Command Set ability in team builder shows description.
- All abilities have descriptions (no "(description not yet authored)" placeholders).

**Quality:**
- Tests at 1395-1425, 0 failing.
- `docs/handoff.md` updated.
- `docs/playtest-watch.md` updated with 5v5 watch-fors.
- Browser verification per item.

## Out of scope

- **AI deployment role-aware sorting** (S43+ carry; sharpened by Hunter and Stonebridge) — playtest-driven; not addressed in S48.
- **Hill height adjustment on Stonebridge** (S47 D9 carry) — playtest-driven.
- **Asymmetric siege scenario for Stonebridge** (S47 D8) — future content session.
- **Terrain bar mid-battle vanishing** (S46 carry) — pending repro.
- **Equipment expansion** (Hi-Potion / Holy Water / Elixir + accessories) — later.
- **Calculator class** — later.
- **Charm/Seduction substrate** — dedicated future session.
- **Pyromancer R/S/M consolidation** (S41 carry) — future R/S/M review.
- **Speed Save / Updraft per-swing reaction cap** (S42 D5 deviation).
- **Renderer-side multi-swing animation polish** (S42 carry).
- **content-id-registry.md broader reconciliation** — S47 added maps/terrain rows; pre-S45 staleness in other sections remains; not addressed here.
- **ActionType-wiring smoke test** (S44 carry).
- **`docs/decisions/0072` + `0073` link updates** (S47 carry; ADRs are historical, not blocking).
- **Larger teams beyond 5v5** — out of scope; v1 ceiling.
- **Team import** functionality (read JSON back into builder) — not requested; future polish.
- **Rampart art originals preservation** (S47 carry; outside repo).

## Files likely touched

A non-exhaustive list. Audit confirms / corrects.

**Team-builder state + UI:**
- `src/ui/team-builder/team-builder-state.ts` — team-size parameterization.
- `src/ui/team-builder/*.tsx` — roster grid, Export button, tooltips.
- `src/ui/team-builder/__tests__/` — 5v5 fixtures, exporter tests, tooltip tests.

**Templates:**
- `src/content/teams/default-templates.ts` (or equivalent) — new template set.
- `src/content/teams/legacy-templates.ts` (or equivalent) — preserved old set.
- `src/content/teams/index.ts` — registry split.

**Deployment + battle:**
- `src/engine/deployment/` (or equivalent) — team-size threading.
- `src/ai/deployment.ts` — slot loop bound to team-size.

**Catalog:**
- `src/content/passives/` — possibly remove `Move +1` and/or `Bulwark Stance`, or attach to Knight class.
- `src/content/classes/knight.ts` — possibly add Bulwark Stance as native passive.
- `src/content/abilities/` — backfill any missing descriptions.

**Tooltips:**
- `src/ui/tooltips/` (or equivalent) — extend R/S/M tooltip pattern to ability slots.

**Tests:**
- 5v5 fixtures across multiple test files.
- Exporter tests.
- Tooltip tests.
- Cleanup verification tests.

**Docs:**
- `docs/handoff.md` — at session close.
- `docs/playtest-watch.md` — 5v5 observations, new-template playtest signals.
- No ADR anticipated.

## Workflow notes

- **Plaintext-first review required.**
- **Audit-first with plan-review checkpoint.** Multi-item session; audit produces a clear scope-per-item table.
- **Iterative template authoring.** Implementer ships exporter as early commit; Chris authors new templates during the session or async; implementer integrates as a later commit. If Chris's template work doesn't complete within the session, the integration carries to S49 and S48 ships the exporter + 5v5 + tooltips + cleanup independently.
- **Browser verification critical for the team-builder UX changes.** 5v5 build, exporter modal, tooltips, new template picker — all need feel-verification in actual UI, not just test pass.
- **Mid-session design questions** route through Chris to the planner. Most likely surfaces: stray-ability disposition (Bulwark Stance specifically), template format clarifications, tooltip styling decisions.
- **Phase F session** — playtest continues; new 5v5 observations join the playtest-watch list.

## Watch-fors

**Addressed this session:**
- 5v5 unlock.
- Team export utility.
- Template refresh.
- Stray Movement abilities (Move +1, Bulwark Stance).
- Ability tooltips.

**Not addressed this session, longer-term carry-forward:**
- All standing carries (Calculator, Equipment expansion, Charm/Seduction, R/S/M consolidation, etc.).
- AI deployment role-aware sorting.
- Hill height adjustment / asymmetric siege scenario on Stonebridge.
- Terrain bar mid-battle vanishing.
- 6v6+ team sizes.

**Watch-fors specific to this session:**

- **5v5 battle pacing.** Adding a 5th unit per side changes turn count, action density, and average battle duration. Watch whether 5v5 battles feel "right" or sluggish/chaotic. May reveal that current map sizes (14×14, 16×16) are tight for 5v5; future maps may want to be larger.
- **AI deployment with 5 units.** Heuristic places HP-descending; with 5 units the sort puts more units forward. May produce awkward arrangements (squishy support 4th-back, etc.). Sharpens the role-aware-sort carry case further.
- **New template playtest signal.** Chris's new 5-unit teams encode his current best-thinking about team comp. Playtest reveals whether the templates are balanced, fun, and represent the class roster well.
- **Tooltip information density.** Command Set abilities have richer mechanics than R/S/M (cost, range, accuracy, status effects, etc.). Watch whether tooltip is enough or whether players need more (full ability inspector?).
- **Bulwark Stance disposition.** If attached to Knight, watch how it shifts Knight build patterns. If suppressed, content gap; may want to design a deliberate Knight passive in its place at some future point.
- **Legacy template retention.** Watch whether any tests fail or scenarios break when old templates move to legacy registry. Likely small fixture updates needed.

## Estimated size

**Medium.** Multiple discrete items; the iteration on templates is the variable that could stretch the session. Most items individually small-to-bounded.

**Split contingency:** if Chris's template authoring is async and the integration can't complete within the session:
- **48a**: 5v5 unlock + exporter + tooltips + stray ability cleanup. All independent of template content.
- **48b**: Template integration (after Chris exports and provides JSON). Smaller follow-up session.

Otherwise, single session.

**Stretch indicator:** if all items complete early, candidates for opportunistic fold-in:
- `content-id-registry.md` broader reconciliation (pre-S45 staleness — Alchemist/Assassin kits, S42 statuses, Pyromancer R/S/M, full passive list).
- ActionType-wiring smoke test (future CI item).
- Other small docs hygiene.

These are pure-housekeeping items; not core scope.
