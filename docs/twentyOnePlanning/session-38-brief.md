# Session 38 Brief: Phase E Close — Sample Templates + Unit Naming + Names Table + Vercel Deployment + Playtest Scenarios

## Context

Phase E close. The pre-battle flow is functional end-to-end (Title → Setup → Team Builder → Deployment → Battle, browser-verified through S37). Session 38 ships the remaining pieces to make the demo shippable for cross-machine playtesting: three sample team templates that showcase distinct build archetypes, a unit-naming UI in the team builder (with auto-populated defaults drawn from a new Ivalician-flavored names table), Vercel deployment configuration, a deliberate playtest scenarios doc (`docs/playtest-scenarios.md`), and viewport eyeball polish on the title and team-builder screens.

Per Chris's calls:
- **Three sample templates** post-S38: renamed `current-test-team`, replacement for `pure-mage-team`, plus one new design. Chris sketches compositions in-session with the implementer (who has direct read access to ruleset/abilities/items). My archetype philosophies (Aggro Knight Squad / Mage Variety Pack / Defensive Front) serve as starting points; final loadouts emerge from plan-review.
- **Unit naming** auto-populates from the new names table on unit creation; player can edit; UI lives in the per-unit edit panel alongside class/equipment/Brave-Faith controls. State shape leaves room for future gender/zodiac fields without restructure.
- **AI name picking** draws from the same names table for opposing teams; avoids collision with the player's chosen names.
- **Vercel deployment** for cross-machine testing — Vite + React + Pixi.js SPA, no backend, no fundamental blocker per the project's architecture.
- **Playtest scenarios doc** separate from `playtest-watch.md` — *what to try* (deliberate edge cases) vs *what to watch for* (ongoing observations). Initial content covers damage/defense/tempo extremes, status chains, element specialization, equipment interactions, AI behavior.
- **Cross-pollination with guide work:** the names table's Ivalician/FFT-flavored naming convention coordinates with the guide's Gariland Academy framing. Worth a brief note in both projects so conventions don't fork.

Session is wider than typical but each item is small individually. Monolithic per Chris's call, with split points reserved at Vercel deployment + playtest scenarios doc (the "Phase E close prep" pair) if other items balloon.

End of session: three archetypes visible in the team picker; team-builder units have names from authoring; Vercel deployment live for cross-machine playtest; scenarios doc ready for Phase E close playtest.

## Inputs (read first)

In recommended order:

1. **`CLAUDE.md`** — project conventions.
2. **`docs/handoff.md`** — Session 37 handoff. Particularly the test count milestone (1105/100), ADR-0075's `onFinalDamageReceived` hook, and the team-draft preservation pattern (cross-component state via `useEffect` mirroring upward) — relevant if unit naming requires similar lifting.
3. **`docs/twentyOnePlanning/roadmap-sessions-21-plus.md`** — Session 38 entry; Sessions 39+ for Phase F context.
4. **`docs/playtest-watch.md`** — current playtest observations; informs scenarios doc structure.
5. **`docs/twentyOneDesign/content-authoring.md`** — HP-on-armor + tradeoffs-not-tiers conventions; the three new templates respect these.
6. **`src/content/teams/`** — existing templates (`current-test-team.ts`, `pure-mage-team.ts`); the renamed and replaced files land here.
7. **`src/content/items/`** — item catalog including S37's new equipment (Spiked Mail, Light/Dark Robe, Tricorn, Crusader's Helm, Lookout's Hood, Travel Garb).
8. **`src/ui/team-builder-*.tsx`** — current team builder UI; unit naming input lands in the edit panel.
9. **`src/engine/`** — survey for the unit `name` field (likely already exists per action log references to named units) and AI roster construction (where AI name picking integrates).
10. **`vite.config.ts`** and `package.json` — current build config; Vercel deployment may need `base` path or build command tweaks.
11. **`guide/CLAUDE.md`** (the parallel project's operational doc) — coordinates the Ivalician naming convention with the guide's Gariland framing.

### Paths to survey before planning

Current-tree audit. Particularly:

- **Unit `name` field on engine entities.** Confirm unit shape: does the `Unit` type already carry a `name` (likely yes — action logs reference named units like "Blue Knight" or specific names). If yes, the team builder exposes editing; if no, a small substrate add.

- **AI roster construction.** Where the AI's team is instantiated (currently authored placements in `river-ridge-battle.ts` for Red); identify the seam where AI names would be assigned. Probably during initial state construction or just before; small new code.

- **Existing default-name behavior.** Currently units probably default to class names or to specific authored names ("Blue Knight," "Red Earth Mage"). Confirm what the action log shows and what the unit-detail panel reads.

- **Team-builder edit panel UI shape.** Identify where the name input lands. Per Chris: "in the equipment/abilities/brave and faith controls" — the per-unit edit panel. The input is a compact text field; future gender/zodiac fields fit alongside.

- **Vite build config and asset paths.** Confirm production build works locally before Vercel deployment. Check `base` setting in `vite.config.ts`; verify static assets resolve correctly in production output. Pixi.js Asset paths sometimes need explicit handling.

- **Vercel deployment requirements.** SPA routing (catch-all to `index.html`); build command (`npm run build` likely); output directory (`dist/`); environment variable handling if any.

- **Existing templates' file structure.** `current-test-team.ts` and `pure-mage-team.ts` — the rename/replace mechanics. User-facing label decoupled from file path; the renamed template can keep its file name or be renamed depending on convention.

### Architectural decisions

After the audit:

1. **Names table structure.** Two reasonable shapes:
   - **A — Single Ivalician pool.** One array of ~50 names; the picker draws randomly. Simple; no class-themed flavor.
   - **B — Class-pooled with shared fallback.** Per-class arrays (Knights with martial/noble names; Mages with arcane/academic names) plus a shared general pool. Richer flavor; more authoring.
   
   **Recommendation: B.** Names with class-thematic flavor reinforce the Gariland Academy setting (martial cadets vs. arcane specialists feel right). Authoring ~10-12 names per class plus a small shared pool isn't burdensome.

2. **Default name picking — deterministic or random.** When a unit is created with a default name, two reasonable shapes:
   - **A — Random pick per session.** Each team builder session sees fresh names; same template loaded twice produces different names.
   - **B — Deterministic from a seed.** Same template loaded twice produces same names; useful for test fixtures, less varied for the player.
   
   **Recommendation: A for player flow; B for test fixtures.** The team builder picks randomly when the player creates units or loads templates. Test fixtures use a stable seed so test output doesn't drift. Plan-review confirms seed mechanism (probably a `pickName(rng?)` helper where the test injects a deterministic rng).

3. **Player vs AI name collision avoidance.** When the AI team is constructed, names are picked from the same pool but with the player's chosen names excluded. Small substrate: a `pickName(usedNames: Set<string>)` helper.

4. **Unit naming UI placement.** Per Chris: text input within the per-unit edit panel, near class/equipment/Brave-Faith controls. Compact; placeholder text shows the current default name; clearing reverts to auto-pick (or the user can re-edit). Future gender/zodiac fields slot in alongside without UI restructure.

5. **Name field semantics.** Two options for empty names:
   - **A — Empty falls back to default.** If the player clears the field, the unit reverts to its auto-picked name.
   - **B — Empty is invalid; team builder won't allow continue.** Forces a name.
   
   **Recommendation: A.** Friendlier; default is always a valid fallback.

6. **Unit name validation.** Reasonable rules:
   - Trim leading/trailing whitespace
   - Maximum length (probably 24 characters; FFT-style names are typically short)
   - Allow Unicode letters + spaces + apostrophes/hyphens (FFT precedent: "Cidolfas," "T.G. Cid," "Ramza Beoulve")
   - No HTML/markdown injection (basic sanitization)
   - Plan-review settles specifics.

7. **AI team naming integration.** Audit-confirmed shape. Likely seam: AI roster construction (probably during `createInitialState` or `buildDeployedBattleConfig` or wherever Red's team gets instantiated). The picker reads the names table, excludes player team names, assigns to Red units.

8. **Three template archetypes — design philosophies as starting points.** Plan-review with implementer settles compositions:

   - **Aggro Knight Squad (replaces or supplements current-test-team rename):** Front-pressure tempo. 2 Knights with Spiked Mail (turn engagement into a tax), Travel Garb on at least one for mobility. 2 attack-oriented Mages on the flanks (Lightning Mage as glass cannon with Magus Crown / Staff of Power; Fire Mage with Flametongue Burn application). Goal: overwhelm before opponent sets up.
   
   - **Mage Variety Pack (replaces pure-mage-team):** Element wheel showcase. One Mage each of Earth/Water/Fire/Lightning (no Knight if team size allows — Mage War's 4v4 default fits this exactly). Each Mage's equipment reinforces their element role: Earth Mage with defensive bias (Sorcerer's Robe for mobility, Capacitor Ring), Water Mage with Tidewalker tempo, Fire Mage glass-cannon (Wizard's Robe + Magus Crown), Lightning Mage tempo (Auto-Haste Boots + Pointy Hat). Goal: educational tool demonstrating element interactions.
   
   - **Defensive Front (the new third template):** Attrition. Knight wall in front (Spiked Mail + Crusader's Helm, the hybrid-caster Knight who can pick up a healing or support active at cost), Light or Dark Robe Mages behind (elemental specialization). Goal: outlast opponent resources. **Caveat per S37 discussion:** if the Knight slot can't surface a useful healing/support active via cross-class ability picker, the archetype needs reshaping. Plan-review verifies.

9. **Renamed `current-test-team` — new user-facing label.** Chris's call. Suggestions to surface at plan-review: "Standard Skirmish," "Mixed Squad," "Balanced Vanguard." User-facing label decoupled from file path (the file can keep its name; the picker reads the template's exported display name).

10. **Vercel deployment configuration.** Minimal `vercel.json`:
    - Build command: probably `npm run build` (confirm)
    - Output directory: `dist/` (Vite default)
    - SPA rewrites: catch-all to `index.html` for client-side routing (the App's state-based routing per S34 doesn't use URL paths today, but having the rewrite in place is forward-compatible)
    - Asset path config in `vite.config.ts` if Vercel's domain requires non-root base
    - Verify production build runs locally first (`npm run build && npm run preview`)

11. **Playtest scenarios doc structure.** `docs/playtest-scenarios.md` with sections per category:
    - Damage extremes (high-MA Lightning Mage one-shot threshold; sustained physical pressure)
    - Defense extremes (max-tank Knight; Spiked Mail's deterrent value)
    - Tempo extremes (all-Speed builds; CT race dynamics)
    - Status chains (Burn × Purifier readability; multi-status stacking)
    - Element specialization vs generalization (Light/Dark Robe trade vs Sorcerer's Robe)
    - Equipment interaction stacking (Spiked Mail + AOE attackers; Crusader's Helm cross-class active interaction)
    - AI behavior under extreme builds (focus targeting; reflect awareness; absorption exploit)
    
    Each scenario shape: **Setup** (team composition + relevant equipment) / **Test** (what to try in-battle) / **Signal for adjustment** (what observation would flag the design as needing tuning). 12-18 entries initial; you add more as Phase E close playtest reveals gaps.

12. **Viewport eyeball polish — scope and depth.** Light pass:
    - Title screen at common window sizes (1366×768 / 1920×1080 / smaller); confirm splash + menu layout reads
    - Team builder at common window sizes; confirm edit panel doesn't crowd
    - Visual fix-ups for obvious issues; deeper responsive design defers to future polish
    - Not a full responsive redesign; just an eyeball + small fixes

13. **State shape extensibility for gender/zodiac.** Per Chris's flag: future fields should slot into the team builder state without restructure. Two approaches:
    - **A — Add `name` field now; gender/zodiac as future optional fields.** Today's state has `name?: string`; future state has `name?: string; gender?: Gender; zodiac?: Zodiac`. Adding fields is backward-compatible.
    - **B — Generic `metadata: Record<string, unknown>` field.** Too loose; loses type safety; not worth it for two known future fields.
    
    **Recommendation: A.** Forward-compatible without over-architecting.

14. **Test strategy.**
    - **Unit naming state + UI:** state mutations (set/clear); default picking on creation; persistence through team-builder ↔ setup back-nav (matches S37's lifted-draft pattern)
    - **Names table:** structural test that pools are non-empty; class-pool keys match actual class IDs
    - **AI name picking:** picks from pool; excludes player team names; doesn't return same name twice for same team
    - **Template content:** unique-per-team compliance; ability budget validity; class diversity; structural tests on each new template
    - **Template picker integration:** "Load Default" lists three templates; selecting populates state correctly
    - **Vercel deployment:** manual verification only; no automated test gate (the build command running cleanly is the test)
    - **Playtest scenarios doc:** structural existence check; content review is human

15. **Order of work.**
    - Audit (unit name field; AI roster construction; existing template mechanics; build config)
    - Names table authoring (content)
    - Unit naming UI + state plumbing (depends on names table for defaults)
    - AI name picking integration (depends on names table)
    - Three sample teams designed and authored (in-session with Chris)
    - Template picker integration (renaming current-test-team; replacing pure-mage-team)
    - Vercel deployment setup (mostly independent; can land anywhere)
    - Playtest scenarios doc (mostly independent; can land anywhere)
    - Viewport eyeball polish (light pass)
    - End-to-end verification

16. **38a/38b split allowance.** Wider session than typical. Natural split point: Vercel deployment + playtest scenarios doc (the "Phase E close prep" pair) carve off cleanly if other items balloon.
    - **38a:** Templates + unit naming + names table + viewport eyeballs
    - **38b:** Vercel deployment + playtest scenarios doc
    
    Per Chris's call: monolithic plan, split allowance reserved.

The plaintext plan is reviewed before code lands.

## Implementation work

Following plan approval, items land roughly in audit-then-build order.

### Item 1: Audit findings + design recap

- Plan-review captures audit findings: unit name field shape, AI roster seam, existing template mechanics, build config state
- Architectural decisions per plan-review settle the implementation shape

### Item 2: Default names table

- New `src/content/names/` folder
- Per decision 1B: class-pooled names + general fallback pool
- ~10-12 names per class (Knight: noble/martial-flavored; Earth/Water/Fire/Lightning Mage each with element-flavored or generally arcane names)
- ~10-15 general fallback names (Ivalician/FFT-style)
- Helper: `pickName(classId, usedNames: Set<string>, rng?: Random)`
- Tests: pool structure; picker excludes used names; deterministic with seeded rng

### Item 3: Unit naming state + UI

- Per decision 13A: `name?: string` added to `TeamBuilderState`'s per-unit shape; gender/zodiac as future optional fields
- Per decision 4: text input in per-unit edit panel; placeholder shows current default name; empty falls back to default per decision 5A
- Per decision 6: validation rules (trim, max length, basic sanitization)
- State plumbing follows S37's lifted-draft pattern (changes propagate to App via `onDraftChange`)
- Tests: state mutations, default picking on unit creation, validation rules

### Item 4: AI name picking

- Per decision 7: integration in AI roster construction (audit-confirmed seam)
- Per decision 3: excludes player team names; uses class-pool with general fallback
- Tests: AI picks from correct pool; doesn't collide with player names; assigns unique names per AI unit

### Item 5: Three sample team templates

- Plan-review with Chris settles compositions per decision 8 philosophies
- `current-test-team.ts` keeps file path; user-facing label updated per decision 9
- `pure-mage-team.ts` replaced with "Mage Variety Pack" template (file path may be renamed for clarity, e.g., `mage-variety-pack.ts`)
- New "Defensive Front" template authored
- "Aggro Knight Squad" — either the renamed current-test-team (if compositions align) or a new template; plan-review decides
- All templates: unique-per-team compliant, ability budgets valid, class diversity per single-class-per-team rule, names auto-populated from table
- Tests: structural compliance per template; load-default integration

### Item 6: Template picker integration

- Team builder's "Load Default" dropdown lists the three templates
- Selecting populates state from the template (including names; player can rename)
- Tests: picker lists three options; selecting each loads correctly

### Item 7: Vercel deployment setup

- Per decision 10: `vercel.json` configuration
- Verify `vite build` produces correct output
- Verify `vite preview` runs production build locally
- Document deployment workflow in a brief `docs/deployment.md` or section in CLAUDE.md
- Manual verification: deploy to Vercel; confirm live demo runs end-to-end

### Item 8: Playtest scenarios doc

- Per decision 11: `docs/playtest-scenarios.md` created
- Initial 12-18 entries across the six category sections
- Discipline documented inside the file (Setup / Test / Signal for adjustment shape; how to add entries; relationship to playtest-watch.md)

### Item 9: Viewport eyeball polish

- Per decision 12: light pass at 1366×768 / 1920×1080 / smaller windows
- Title screen + team builder
- Visual fix-ups for obvious issues; not a full responsive redesign

### Item 10: End-to-end verification

- Full pre-battle flow with new templates loaded; unit names visible throughout
- AI team displays distinct names (no collisions with player team)
- Production build runs locally; Vercel deployment live
- Playtest scenarios doc readable + populated

## Acceptance criteria

**Templates:**
- Three templates visible in the team builder's "Load Default" picker (renamed current-test-team, Mage Variety Pack, Defensive Front, OR with Aggro Knight Squad replacing the renamed test team if compositions diverge — plan-review picks the final three)
- Each template: unique-per-team compliant, valid ability budgets, single-class-per-team compliant
- Loading any template populates the team builder with that team's units, names included

**Unit naming:**
- Each team-builder unit has a name field, auto-populated from the names table on creation
- Players can edit the name; empty falls back to default
- Validation enforces length + sanitization rules
- Names persist through team-builder ↔ setup back-nav (matches draft preservation pattern)
- Names appear in battle (action log, unit detail panel, anywhere units are referenced)
- AI team displays distinct names (no collision with player team)

**Names table:**
- Class-pooled with general fallback; ~10-12 per class plus shared
- Ivalician/FFT-style naming convention coordinates with guide work

**Vercel deployment:**
- `vercel.json` configured; production build verified locally
- Cross-machine demo accessible at a Vercel URL
- End-to-end flow works on the deployed version (Title → Setup → Team Builder → Deployment → Battle)

**Playtest scenarios doc:**
- `docs/playtest-scenarios.md` exists with 12-18 initial entries across six category sections
- Each entry uses Setup / Test / Signal-for-adjustment shape
- Discipline documented in-file

**Viewport polish:**
- Title screen + team builder read cleanly at 1366×768, 1920×1080, and one smaller common size
- Obvious layout issues addressed; deeper responsive design defers

**Quality:**
- Tests at 1105+, 0 failing
- No new ADR expected unless audit reveals substrate work
- `docs/handoff.md` updated

## Out of scope

- **Pass-and-play toggle + dual deployment + battle-loop AI gating** — dedicated future session
- **Surrender flow** — ADR-0041; Phase F
- **Settings expansion** — Phase F; natural home for pass-and-play toggle
- **Gender / zodiac tracking** — flagged for future; state shape extensible per decision 13A
- **Additional class content** — future content sessions
- **AI deployment logic** — future tactics-layer pass
- **Other maps / map selection** — future session
- **Team persistence across browser sessions** — Phase F campaign features
- **Deeper responsive design** — viewport pass is eyeball + small fixes; full responsive defers
- **MVP-unit smarter algorithm** — S24 Wave 1
- **Permadeath timer** — S24 Wave 1
- **Reactions in projection column** — S24 Wave 1
- **Full battle → results loop manual playtest** — organic ongoing per Chris
- **Vercel custom domain / production hardening** — initial deploy is the demo URL; production hardening defers
- **AI active absorption exploitation** — S27 carry
- **AI projection forecast extension** — S30 carry
- **Procced Lightning Strike / Rasp Pendant action-log attribution** — S30 carries
- **TS strict-mode test errors** — S34 carry; pre-existing on main
- **`map-and-battlefield.md` open questions** — Phase E doesn't surface these

## Files likely touched

Non-exhaustive. Audit confirms / corrects.

**New content:**
- `src/content/names/index.ts` (or per-class files: `knight-names.ts`, `mage-names.ts`, `general-names.ts`)
- `src/content/teams/mage-variety-pack.ts` (or similar; replaces `pure-mage-team.ts`)
- `src/content/teams/defensive-front.ts` (new)
- Possibly `src/content/teams/aggro-knight-squad.ts` (if renamed current-test-team isn't this)

**Renamed / replaced:**
- `src/content/teams/current-test-team.ts` — file path retained; user-facing label updated
- `src/content/teams/pure-mage-team.ts` — removed or replaced

**State + UI:**
- `src/ui/team-builder-state.ts` — `name?: string` field added per unit
- `src/ui/team-builder-edit-panel.tsx` (or per-unit config component) — name input
- `src/ui/use-team-builder.ts` — hook integration for name field

**Engine surface (audit-confirmed):**
- `src/engine/.../unit.ts` (or wherever Unit type lives) — confirms `name` field already exists; small substrate adjustment if not
- AI roster construction — name-picking integration

**Helpers:**
- `src/content/names/pick-name.ts` (or similar) — `pickName(classId, usedNames, rng?)` helper

**Build / Deployment:**
- `vercel.json` (new, at project root)
- `vite.config.ts` (possible `base` adjustment for Vercel)
- `package.json` (verify build command)
- `docs/deployment.md` (new — deployment workflow notes)

**Documentation:**
- `docs/playtest-scenarios.md` (new)
- `docs/handoff.md` — session handoff
- `docs/twentyOneDesign/team-builder.md` (possibly — if naming UI conventions warrant a note)
- `guide/CLAUDE.md` — note on shared Ivalician naming convention coordinated with this session

**Tests:**
- `src/content/names/names.test.ts` — pool structure
- `src/content/names/pick-name.test.ts` — picker semantics
- `src/ui/team-builder-naming.test.tsx` — unit naming state + UI
- `src/content/teams/templates.test.ts` (or per-template tests) — compliance
- `src/app/team-naming-integration.test.tsx` — back-nav preservation; AI name collision avoidance

**ADRs:**
- Likely none unless audit reveals substrate work. Plan-review determines.

## Workflow notes

- **Plaintext-first review required.**
- **Audit-first.** Unit name field substrate, AI roster construction seam, template mechanics, and build config all surface in the audit and gate downstream design.
- **In-session design with Chris** on the three templates — implementer's direct read access to ruleset/items/abilities is the relevant authority. Chris's archetype philosophies + this brief's sketches are starting points; final compositions emerge from plan-review.
- **Cross-pollination with the guide project.** The names table's Ivalician convention coordinates with the guide's Gariland Academy framing. Brief note in `guide/CLAUDE.md` ensures conventions don't fork; the guide may want to reference the names table when authoring example cadet names in chapter content.
- **ADR path is `docs/decisions/`.**
- **HMR / Fast Refresh conventions from S34 apply.** No class exports in Fast-Refreshable component modules; `useRef` not `useMemo` for load-once singletons; cleanup functions capture references before destroy.
- **S37's lifted-draft pattern** is the model for unit naming's state flow. `useTeamBuilder`'s `onDraftChange` already covers per-mutation propagation; naming integrates into the existing draft state.
- **Mid-session design questions** route through Chris to the planner. Most likely surfaces: template composition specifics; user-facing label for renamed current-test-team; names table cardinality (10-12 per class vs more); Vercel domain choice; playtest scenarios doc category coverage.
- **Phase E close milestone.** End of session: demo end-to-end shippable + deployed; Phase F (settings, surrender, campaign features) becomes the next horizon.

## Watch-fors

**Addressed this session:**
- Three sample team templates (Phase E close)
- Unit naming UI + auto-populated defaults
- Default names table (Ivalician-flavored, coordinates with guide)
- AI name picking
- Vercel deployment for cross-machine playtest
- Playtest scenarios doc (deliberate edge-case test plans)
- Viewport eyeball polish on title + team builder
- Renamed/replaced existing templates (current-test-team renamed; pure-mage-team replaced)
- State shape extensible for future gender/zodiac

**Not addressed this session, longer-term carry-forward:**

- **Pass-and-play toggle + dual deployment + battle-loop AI gating** — dedicated future session
- **Surrender flow / settings expansion / reactions in projection column / MVP-unit algorithm / permadeath timer** — Phase F
- **Gender / zodiac field implementation** — flagged; state shape extensible
- **AI deployment logic** — future tactics-layer pass
- **Other maps / map selection** — future session
- **Additional class content** — future content sessions
- **Team persistence across browser sessions** — Phase F campaign features
- **Deeper responsive design** — beyond eyeball polish
- **Vercel production hardening / custom domain** — beyond initial deploy
- **Title screen + team builder narrow-viewport layout** — eyeball pass this session; deeper work defers
- **Full battle → results loop manual playtest** — organic ongoing
- **River Ridge balance tuning** — playtest-informed; in `playtest-watch.md`
- **S37 equipment playtest reads (Spiked Mail / Crusader's Helm / Tricorn / Light-Dark Robe)** — in `playtest-watch.md`
- **AI active absorption exploitation** — S27 carry
- **AI projection forecast extension via `computeOutgoingHitChance`** — S30 carry
- **Procced Lightning Strike action-log attribution / Rasp Pendant drain attribution** — S30 carries
- **Procced spell uses caster's MA / Magus Crown calibration / Tintinibar Regen / Sorcerer's Robe Move +1** — in `playtest-watch.md`
- **Suppress pre-battle init entries in release builds** — longer-term polish
- **`map-and-battlefield.md` open questions** — elevation hit-chance/cover, AoE multi-layer, LoS tie-breaking
- **`mapAllTerrainCosts` vs `defaultStepCost`** — no v1 case
- **Centralized `canApplyHeal` helper** — explicitly rejected (ADR-0074); revisit at third heal-site
- **`isWaterTile` predicate keys on elevation, not registry** — S33 carry
- **`buildBattle` test-fixture extraction** — triggers at fourth duplication
- **Wand swing ally-targetability** — S31 carry
- **Status-badge polarity convention extension** — chip pre-icons if status lists grow
- **Team color palette → engine `Team` shape** — long-term
- **Tooltip Option B authored-description pass** — post-current-roadmap
- **`onTurnStart` symmetric widening** — S26 carry
- **Multiplicative tick-amount stacking** — S28 carry
- **`onFinalDamage` fires on absorbed hits but handlers gate** — design pattern; Spiked Mail exercises the target-side mirror
- **Forecast facing uses actual attacker→target geometry** — S30 carry
- **Unit detail panel's per-facing evasion uses `unit` as attacker stand-in** — S30 carry
- **Constant-map labels don't carry icons today** — S28 polish
- **`pa_factor` NotYetImplementedError** — audit E3
- **TS strict-mode test errors** — S34 carry (~202 pre-existing on main)
- **Hit-chance and cover modifiers from elevation differential** — `map-and-battlefield.md` open question
- **`fillVitalsFromComputedMaxes` ordering invariant** — S32 carry
- **Bedrock Stride ongoing playtest read** — in `playtest-watch.md`
- **HMR / Fast Refresh class-export rule** — S34 convention

## Estimated size

**Medium-large to large.** Wider scope than typical:
- 3 templates (in-session design with implementer + authoring)
- Unit naming state + UI + integration
- Names table content + picker
- AI name picking
- Template picker integration (replace + rename)
- Vercel deployment configuration + verification
- Playtest scenarios doc (12-18 entries)
- Viewport eyeball polish

Each item is small individually; aggregate is meaningful. Per Chris's call: monolithic plan, split allowance reserved at Vercel + playtest scenarios doc (which carve off cleanly as "Phase E close prep" if other items balloon).

**38a/38b split allowance** if scope exceeds:
- **38a:** Templates + unit naming + names table + viewport eyeballs
- **38b:** Vercel deployment + playtest scenarios doc + (possibly) any deferred polish from 38a

**End of session:** Phase E close. The demo is end-to-end shippable, deployed to Vercel for cross-machine playtest, with three archetypes available, named units throughout, and a playtest scenarios doc ready for Chris's broader playtest pass. Phase F (settings expansion, surrender flow, campaign features) becomes the next horizon.
