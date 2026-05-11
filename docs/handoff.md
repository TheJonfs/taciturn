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

## From session 2026-05-11 (Session 25 — Cluster 2 substrate + UI fold-ins)

Session 25 opened Phase B by landing the engine substrate that subsequent
team-builder and deployment-phase work needs (availability tag,
`deploymentZone` tile field, `uniform_int` initial-CT variant), plus the
five UI fold-ins from Chris's post-MVP playtest review (Attack-in-Act,
charged-target in log, segment-based team coloring, enemy-portrait flip,
`consumed.waited` cleanup). Tests: **679 passing across 58 files, 0
failing** (up from 671). +8 new tests: 4 catalog-validator cases, 5
uniform_int variance cases, 3 LogRow-segment cases, minus 4 unrelated
changes.

### Scope completed

**Substrate (Items 1-3, 5):**

1. **Availability tag substrate.** `availability: 'available' |
   'hidden'` field on `AbilityCommon`, `EquipmentBase`, and
   `CommandSetDefinition` (the latter expanded the brief's default
   per Chris's call to hide the `white_magic` set as a unit). New
   `Availability` type lives in `src/engine/catalog/definitions/
   availability.ts`. New `MissingAvailabilityError`; validator runs
   inside `createCatalog`. Test-only inline builders
   (`engine/abilities/test-fixtures.ts`) default to `'hidden'`. All
   41 ability files + 5 item files + 7 command-set files tagged
   per spec. ADR-0049.

2. **`deploymentZone` tile field.** Optional `deploymentZone?: TeamId
   | null` on `Tile`. No content consumes it yet; substrate-only.

3. **`uniform_int` initial-CT variant.** New variant on
   `RulesetInitialCT` + resolver clause in `resolveInitialCT`. Default
   ruleset switches to `{ kind: 'uniform_int', min: 0, max: 20 }`.
   AI-vs-greedy integration test
   (`src/app/controllers/ai-controller.integration.test.ts`)
   preserved via inline ruleset overlay (`calibrationCatalog`).
   `src/content/index.ts` gained per-kind re-exports
   (`abilities`, `classes`, …) to support the overlay. ADR-0050.

4. **Demo Knight loadout cleanup.** Knight Second Action dropped from
   `white_magic` to `null`. Mages keep `white_magic` (engine-side
   they can still cast Cure; hiding is presentation-only). No
   `commandSets` field on `ClassDefinition` to clean up — the brief's
   "remove white_magic from Knight's secondary command sets" mapped
   to hiding the set + this loadout edit.

**UI fold-ins (Items 6-9):**

5. **Attack-in-Act repositioning.** Top-level action menu now Move /
   Act / End turn / Status (4 items, no top-level Attack). Per Chris's
   "flat list, peers" call (Q3 of planning): clicking Act opens a
   picker that shows free abilities (Attack) and equipped command sets
   as siblings — a Knight sees "Attack, Battle Skill"; a Water Mage
   sees "Attack, Water Spells, White Magic". Selecting Attack jumps
   straight to target-select; selecting a command set drills into its
   member ability list (which does NOT contain Attack).

   Implementation: new `ActEntry` discriminated union in `turn-flow.ts`
   (`free_ability` or `command_set`). `pickAct` event takes
   `entries: ReadonlyArray<ActEntry>` instead of `commandSets:
   ReadonlyArray<CommandSetId>`. Hook exposes `actEntries` on the
   `TurnFlow` interface. Picker (`CommandSetPicker`) renders both kinds
   uniformly. Cancel from a free-ability target-select returns to the
   picker when entered from it (encoded via `commandSetCount: 2`).

   **Initial implementation got this wrong** — I spliced Attack into
   each command set's ability list rather than at the picker level.
   Chris caught it in a quick playtest; the fix landed mid-session and
   added 5 new turn-flow reducer tests covering the `ActEntry`
   variants and the cancel routing.

6. **Action-log charged-target rendering.** `formatAction`'s
   `charged_action_resolve` branch extended. Format:
   `T#### <Caster>'s <Spell> resolves on <Target>: <outcomes>`. Target
   is unit name for unit-targeted, `(x, y)` for tile-targeted, or
   collapses to "resolves" for self-target. Co-landed with the
   segment refactor since both touch the same branch.

7. **Action-log team coloring (Path A — segments).** `LogRow` gained
   `segments: ReadonlyArray<LogSegment>` as primary content; `text:
   string` retained as the joined-derived form for backward
   compatibility with existing `.toContain(...)` test assertions.
   Formatter helpers: `unitSeg(state, id)` returns name with team
   tag, `plain(text)` returns untagged segment. Renderer side
   (`action-log-panel.tsx`) iterates segments and applies team color
   to those carrying `team`. Palette: `team_a` `#7eb6ec` blue,
   `team_b` `#e07866` red. ADR-0051.

8. **Enemy-portrait flip.** `MiniPortrait` and the `ActiveUnitAnchor`
   in `queue-tower.tsx` apply `transform: scaleX(-1)` to `<img>`
   elements when the rendered unit is on `team_b`. Matches the
   canvas-sprite flip idiom from session 24.5.

**Cleanup (Item 10):**

9. **`consumed.waited` cleanup.** `TurnConsumption.waited` removed
   from the type. `reduceWait` no longer writes it; `reduceTurnEnd`
   comment updated (the read was already commented as "no longer
   overrides" in session 24.5). All test fixtures updated; one test
   assertion ("zeroes the budget and marks waited") simplified to
   "zeroes the budget so no further actions commit this turn."

### Architecture records

- **ADR-0049** — Availability tag + catalog-load validator.
- **ADR-0050** — `uniform_int` initial-CT variant + test-ruleset
  preservation (inline-overlay pattern).
- **ADR-0051** — `LogRow` segment-based shape (Path A).

### Limitations + watch-fors

- **Catalog test-fixture's longSword had a pre-existing type bug.**
  `engine/catalog/catalog.test.ts:75` had `longSword: ItemDefinition
  = { id, name }` — missing `kind`/`wp`/`accuracy`. Pre-session-25
  this was one of the carry-forward TS strict-mode errors; session 25
  fixed it alongside the availability field add (the field was
  unreachable in the broken literal). The fix is correct but worth
  flagging as a touched-while-here change.

- **The Blue Knight in the demo has no Second Action equipped.**
  Per session 25 intent — until White Magic comes back, the Knight
  has Battle Skill only. The mages still have `white_magic` on
  Second Action so they functionally retain Cure. AI heal logic
  in `decideBasicAi` finds Cure on mages and uses it normally.

- **Per-segment color palette is hard-coded in `action-log-panel.tsx`.**
  Mirrors the `TEAM_BORDER_COLORS` in `queue-tower.tsx` (and the
  renderer's canvas team colors). Two places to update if the
  palette shifts; a future polish pass could thread these through a
  single source — flagged but deferred (small surface, three sites).

- **The `chargedContext.target` field on `formatActionLog`'s internal
  map.** I introduced a small "type alias via dummy function" helper
  (`chargedContextTarget()`) to extract the target union without
  importing the full `AbilityTarget` type. Slightly clunky; if a
  later session wants to clean this up, exporting `AbilityTarget`
  from `@engine` and importing it directly here would be ~3 lines
  cleaner.

- **`SegmentSpan` uses `<>{text}</> as unknown as ReactElement`** for
  the no-team-color path. Avoids wrapping plain text in a needless
  `<span>` but the cast is awkward; functionally correct in React's
  fragment-as-element story. Could be cleaned to
  `<span>{text}</span>` if a future code-style pass prefers
  consistency over the tiny DOM savings.

- **Browser-preview screenshot tooling timed out during verification.**
  All UI behavior was verified via `preview_snapshot` (DOM tree) and
  `preview_eval` (state inspection). The HTML structure of the
  action menu, ability list with Attack at top, and the action log
  with team-tagged segments is confirmed. Visual confirmation of
  team-color CSS at the pixel level is left for Chris's next
  playtest.

- **Catalog test fixtures with inline ability/item/command-set
  literals are now tagged `'hidden'`.** Roughly a dozen files across
  the engine test surface. Future content tests that build ad-hoc
  catalogs need to remember to include the field — the validator
  will fail loud on miss with the kind + id named.

### Bulk-tagged content (for reference)

**Hidden:** abilities `float`, `fly`, `discharge_strike`, `cure`;
items `iron_helm`, `iron_mail`, `strength_ring`; command sets
`white_magic`, `arcane_skill`.

**Available:** all other 37 abilities + 2 items (`long_sword`,
`boots_of_haste`) + 5 command sets (`battle_skill`, `earth_spells`,
`water_spells`, `fire_spells`, `lightning_spells`).

### Considered and rejected this session

- **Optional `availability` field with `'available'` default.** Loses
  the "no half-tagged catalog" guarantee. Required-explicit is the
  intent.
- **Replacing `LogRow.text` entirely with `segments`.** Broke ~10
  existing `.text.toContain(...)` test assertions. Additive `segments`
  + derived flat `text` keeps the test suite intact.
- **`loadDefaultCatalog(opts)` API expansion for ruleset overrides.**
  One call site (AI integration test) needs it; inline overlay is
  cleaner than a public-surface expansion. The per-kind re-exports
  from `content/index.ts` are already meaningful additions.
- **`SegmentSpan` always wrapping in `<span>`.** Tested first; works
  but inflates the DOM. The fragment-for-plain-text path uses a tiny
  cast but produces cleaner output.
- **Per-placement `initialCT: 0` to preserve test calibration.**
  Verbose (six placements × two battles); the inline ruleset overlay
  isolates the test from the ruleset's intent at a single point.
- **Marking `bolt` as hidden** (since its only command set
  `arcane_skill` is now hidden, making `bolt` unreachable in the
  team builder). Left `available` — the team-builder surfaces
  command sets, not raw abilities; `bolt`'s status doesn't matter
  until/unless someone surfaces individual abilities.

### Empirical-questions checklist for Chris's next playtest

**Substrate (mostly invisible in-game, verify-by-not-breaking):**
- [ ] Battle starts and units have distinct CT values in [0, 20]
      (visible in QueueTower as the +N values on the upcoming-event
      cards on the first turn).
- [ ] No catalog-load errors at startup.

**UI fold-ins:**
- [ ] Top-level action menu shows Move / Act / End turn / Status
      (4 items, no top-level Attack on Knight's turn).
- [ ] Act → picker shows Attack and the unit's command sets as peers:
      Knight sees "Attack, Battle Skill"; Mages see "Attack,
      `<Element>` Spells, White Magic".
- [ ] Selecting Attack from the picker → target-select immediately.
- [ ] Selecting Battle Skill (or `<Element>` Spells) → ability list
      shows ONLY that set's members (Attack does not appear inside).
- [ ] Cancel from Battle Skill's ability list → Act picker (not
      action-menu).
- [ ] Cancel from Attack's target-select → Act picker (not
      action-menu).
- [ ] Charged action resolve in the log includes "resolves on
      <Target>" — unit name for unit-targeted, `(x, y)` for tile-
      targeted.
- [ ] Unit names in the action log render in their team's color
      (blue for team_a, red for team_b). Verify across actor
      references, target references, and charged-spell caster
      references.
- [ ] Enemy-team (red) portraits in the QueueTower mini-cards and
      active anchor render horizontally flipped, matching the on-
      canvas sprite convention.

**Regression watch:**
- [ ] Demo Knight has no Second Action (no Cure on Knight). Mages
      can still cast Cure mid-battle (their Second Action still
      contains `white_magic`).
- [ ] AI-vs-greedy integration test's win-rate parity assertion
      stays passing — verified locally, should also hold in CI.

### Polish-pass tracking (deferred to a future dedicated session)

Same list as the session-25 brief's "Out of scope" section:

- Tile-info corner overlay (Session 24.5 review item 2)
- Portrait restructure: black-bg + ring-outside-portrait (Session 24.5
  review item 3 — larger part)
- Charged-action timing projector accuracy (Session 24.5 carry-forward)
- QueueTower slot-in for charged-action resolves (Session 24.5 carry)
- Charged-action animation pacing (Session 24.5 carry)
- WAIT-CONFIRM keyboard support (Session 24 Wave 2 carry)
- Mini-timeline for forecast Timing subsection (Session 24 Wave 1 carry)

### Longer-term carry-forward

- Top bar `Turn T####` is O(actionLog.length) (Session 22 carry)
- Renderer's MP "max" captured at mount (Session 22 carry; Session 28
  lifts)
- Status-badge polarity convention (Session 22 carry)
- rAF vs setInterval for animation drain (Session 23 carry)
- AoE preview correctness across all shapes (Session 23 carry,
  partially addressed by Session 24.5)
- MP / status snapshot ahead-of-tween fix (Session 22 carry)
- `docs/content-snapshot.md` drift (Session 21 carry; Session 26)
- Resistance composition cap at 100 (audit E2; Session 27)
- `pa_factor` NotYetImplementedError (audit E3)
- `equipmentContributionsFor` "branch per hook" (audit E4; Session 27)
- TS strict-mode test errors (audit E8) — Session 25 fixed one
  (`longSword` literal) incidentally; rest carry forward
- Surrender flow (Session 34 / ADR-0041)
- MVP-unit smarter algorithm (Session 24 Wave 1)
- Permadeath timer (Session 24 Wave 1)
- Settings expansion (Session 24 Wave 1)
- Reactions in projection column (Session 24 Wave 1)
- Lightning Mage's `quickstep` refund visibility (Session 26)
- Bug 1 (Session 24.5 ADR-0046): mid-battle targeting failure;
  instrumentation in place, awaiting next occurrence
- Portrait asset sizes (~4MB each → ~20MB initial load) — pre-release
  pipeline candidate
- Vite HMR cache invalidation occasional issue

### Suggested scope for Session 26

Per `docs/twentyOnePlanning/roadmap-sessions-21-plus.md`, Session 26
is "Movement abilities authoring" — four new movement-bucket
passives (Earth's Bedrock Stride, Water's Tidewalker, Fire's Hotfoot,
Lightning's Quickstep) declared with `availability: 'available'`
per their content spec. All four go into the class-free passive
list. Substrate from Session 25 (availability tag) is the consumed
prerequisite.
