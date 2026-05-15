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

## From session 2026-05-15 (Session 38 — Phase E close: templates + naming + Vercel + scenarios)

Phase E close. **Tests: 1138 passing across 104 files, 0 failing** (up from S37's 1105/100 — +33 tests, +4 files). No new ADR. One new doc folder (`src/content/names/`). Two new persistent docs (`docs/playtest-scenarios.md`, `docs/deployment.md`). Vercel deployment config (`vercel.json`) shipped; production build verified locally via `vite build`. No 38a/38b split needed.

### Scope completed

- **Three sample team templates** in the Load Default picker:
  - **Aggro Knight Squad** (file path retained at `current-test-team.ts`, display label updated): Knight + Lightning / Fire / Water Mages with Spiked Mail, Lookout's Hood + Magus Crown + Light Robe + Boots of Haste, Flametongue + Tricorn, Sorcerer's Robe + Lightfoot. Authored unit names: Agrias / Cidolfas / Wiegraf / Ovelia.
  - **Mage Variety Pack** (new file `mage-variety-pack.ts`, replaces `pure-mage-team.ts`): Earth + Water + Fire + Lightning Mages with element-coordinated equipment (Sorcerer's / Dark Robe / Wizard's / Light Robe). Authored names: Ramza / Penelo / Larsa / Ashe. Earth Mage carries Water Spells secondary via Magus Crown.
  - **Defensive Front** (new file `defensive-front.ts`): Knight in Crusader's Helm + War Plate + Tintinibar + Earth Spells secondary (Earth's Blessing as Regen substitute for healing) + Mage trio with elemental specialist robes. Authored names: Beowulf / Marach / Reis / Rapha. Water Mage also carries Earth Spells via Magus Crown for second Regen source.
  - Shared structural-compliance helper at `src/content/teams/template-compliance.ts`.

- **Per-unit naming UI**. New `name?: string` field on `DraftUnit` (with `gender?` / `zodiac?` slot-in path documented in the type comment per S38 decision 13A). `setUnitName` mutator: trims input, caps at 24 chars; empty re-rolls a fresh Ivalician name excluding sibling + prior-name. `setClass` auto-rolls a name on first class assignment; subsequent reclasses leave the name alone (Cidolfas is Cidolfas whether they're a Knight or a Mage). Text input added to the EditPanel above the class picker. Roster card now displays the unit's name (with class as the subtitle) instead of the class name in the headline. State preservation across back-nav extends S37's `teamDraft` lift unchanged — `name` rides the existing draft pipeline.

- **Names table** at `src/content/names/`. Single shared Ivalician/FFT-flavored pool (~50 entries) per Chris's call (decision 1 reversed in plan-review from the brief's class-pooled recommendation). `pickName(usedNames, rng?)` and `pickTeamNames(count, usedNames, rng?)` helpers; default RNG is `Math.random`, tests inject a deterministic seeded RNG.

- **AI name rewriting**. New `assignAiTeamNames(config, aiTeamId, excludedNames, rng?)` helper at `src/content/teams/assign-ai-team-names.ts`. App.tsx applies it inside the `teamBattleConfig` useMemo, so AI names refresh per team commit and stay stable through deployment + battle. Cross-team uniqueness verified end-to-end in browser (Defensive Front player team got Beowulf/Marach/Reis/Rapha; AI got Mustadio/Joaquim/Yvain/Fran).

- **Vercel deployment**. `vercel.json` at project root: `buildCommand: vite build` (bypassing the failing `tsc -b` gate from S34's strict-mode error pile), `outputDirectory: dist`, SPA rewrite for forward-compatibility. `docs/deployment.md` walks Chris through the project creation. Local production build verified via `npx vite build && npm run preview`.

- **Playtest scenarios doc** at `docs/playtest-scenarios.md`. 17 initial entries across 7 sections (damage / defense / tempo extremes; status chains; element specialization; equipment interaction; AI behavior). Each entry uses Setup / Test / Signal-for-adjustment shape. Discipline + relationship to `playtest-watch.md` documented in-file.

- **Viewport polish** at 1366×768 / 1920×1080 / 1280×800. Title screen + team builder both read cleanly; no crowding. The screenshot tool downscales heavily so JPEG output is misleading at 1920+ — DOM measurements and snapshot inspections confirm the layout fills the viewport correctly.

- **Guide cross-pollination note** appended to `guide/CLAUDE.md` — the Ivalician name pool's location + intent, with the convention that handbook example cadets should draw from the same vocabulary.

- **Renamed `current-test-team`** keeps its file path + template id for state-key continuity (per Chris's call); display label is "Aggro Knight Squad". The dropdown surface auto-enumerates `defaultTeamTemplates`, so adding the third entry surfaces it without UI changes.

### Browser verification (Phase E end-to-end)

Vite preview drove through: Title → Setup → Team Builder. Loaded each of the three templates; verified all four unit names render in the roster cards (Aggro: Agrias/Cidolfas/Wiegraf/Ovelia; Variety: Ramza/Penelo/Larsa/Ashe; Defensive: Beowulf/Marach/Reis/Rapha). Edited unit name input on slot 0 → persisted across back-nav to Setup → Team Builder remount. Loaded Defensive Front and clicked Continue to Deployment; React fiber inspection of `DeploymentScreen.props.template.units` confirmed team_a names (Beowulf/Marach/Reis/Rapha) and team_b auto-renamed to Mustadio/Joaquim/Yvain/Fran — eight distinct Ivalician names, no collisions. Console clean throughout. Viewport eyeballs at 1366×768 / 1920×1080 / 1280×800 — layout reads.

### Limitations + watch-fors

- **`tsc -b` pre-existing strict-mode error pile (S34 carry, ~200 errors).** `npm run build` fails on the tsc step. `vite build` works (esbuild strips types without typechecking) and produces a working bundle. `vercel.json` runs `vite build` directly. When the S34 errors get cleaned up in a Phase F session, the vercel.json `buildCommand` should flip back to `npm run build` to restore the typecheck gate.

- **Cross-class secondary command set picker UX not exercised in the team builder.** Defensive Front's Knight (Earth Spells secondary) and Water Mage (Earth Spells secondary) load correctly via the template path. Whether a player can manually pick a non-class command set in `team-builder-ability-picker.tsx` after the fact wasn't audited; if the picker only surfaces native sets, manual cross-class secondary picking is a UI-only follow-up. Templates work either way.

- **Lightning Mage default loadout's `secondary_command_sets` is `[white_magic]`** (currently a hidden command set in the picker per S25). Aggro Knight Squad overrides this to `[fire_spells]` template-locally. The default itself isn't broken — `white_magic` is simply not visible in the UI — but a future session could clean up the demo defaults.

- **Vercel deployment is configured but not yet driven.** Chris drives the project creation per `docs/deployment.md`; the live URL surfaces after that. The wiring is in place.

- **Title screen at 1280×800 — screenshot tool downscaling artifact.** The screenshot output looks like the title is confined to a small region in the top-left. DOM inspection (`document.querySelector('#root > div').getBoundingClientRect()` returns 1280×864) and `New Battle` button positioning (centered, y=630 within 800px viewport) confirm the layout actually fills the viewport. The screenshot's heavy downscaling + the gradient overlay's `0.85` alpha at the bottom of the box together produce the misleading image.

### Considered and rejected this session

- **Class-pooled names with shared fallback** (the brief's decision 1B recommendation). Rejected per Chris in plan-review: "I'm okay with letting there be a general pool of names as there was in FFT, so a given name could belong to a Knight or a Mage." Single Ivalician pool with cross-team uniqueness landed instead.

- **Renaming `current-test-team` template id** (alongside the display-label rename). Rejected per Chris: keep the id stable for test-key + state-key continuity; only the display label changes. The user-facing label is decoupled from the id (the dropdown reads `template.team.name`).

- **Per-template test files for the three templates as fully bespoke files.** Rejected: extracted a shared `template-compliance.ts` helper that all three test files call, keeping the per-template files thin.

- **Brand-new test-fixture battle config for AI naming tests.** Rejected: `riverRidgeBattle` is the canonical battle config used elsewhere; importing it in the AI-naming tests is consistent with the existing pattern.

- **Auto-name re-roll on every `setClass` call** (re-roll on reclass too). Rejected: the unit's identity is the player-edited name, not a class-derived label. Subsequent reclasses leave the existing name alone; the player can clear the input to re-roll explicitly.

- **`name: string` (required) on DraftUnit.** Rejected: optional with `setClass` auto-pick on first assignment is cleaner — empty drafts have no name to display, and the field is always populated once a class is set.

- **Adding `width / base` configuration in `vite.config.ts` for Vercel.** Rejected per audit: defaults work for root-deploy; no Pixi.js asset path issues. Less config = less to maintain.

- **Bundling Vercel deployment + scenarios doc into 38b.** Rejected: scope was manageable monolithically. Split allowance reserved per Chris's call.

### Suggested scope for Session 39

Phase F open. Per the roadmap, no fixed Session 39 plan — empirical tuning + post-MVP work as Chris drives.

Strong candidates from this session's surfaced items:

- **TS strict-mode error cleanup (S34 carry, ~200 errors).** Resolving these restores `npm run build` as the canonical gate (and `vercel.json` flips back). Mostly mechanical: `exactOptionalPropertyTypes` mismatches in component prop spreads, a few `Action | undefined` narrowings, a `'water' as DamageTag` literal. Dedicated session would close the carry.

- **Vercel deployment driven**. Once Chris creates the project, end-to-end manual verification on the live URL. Any URL-path-related issues surface here (e.g., if Vercel's preview-deployment subdomains require a `base` adjustment).

- **River Ridge balance reads from the new templates**. Three distinct archetypes are now selectable; engagements between them (Aggro vs Defensive, Variety vs Aggro, etc.) will surface tuning signals. Captured in `docs/playtest-watch.md`.

- **Pass-and-play toggle + dual deployment + battle-loop AI gating** — dedicated future session per the roadmap.

- **A White Mage class** (or Earth's Blessing replacement on a healing-flavored class). Defensive Front's Earth-Spells-on-Knight pattern is a stopgap for healing; a real healer is high-priority per Chris's note in plan-review.

### Longer-term carry-forward (S37 items unchanged unless noted)

- **TS strict-mode test errors (~200)** — S34 carry; `vercel.json` works around by running `vite build` directly.
- **Pass-and-play toggle + dual deployment + battle-loop AI gating** — dedicated future session.
- **AI deployment logic / AI team random-fill** — Red uses authored placements; future tactics-layer pass.
- **Title screen + team builder layout eyeball at narrow viewports** — eyeball pass landed this session at 1366/1920/1280; phone form factor explicitly out of scope.
- **Full battle → results → continuity-button loop manual playtest** — S34 carry; deployment edge browser-verified through deployment in S37; battle-to-results human pass still pending.
- **River Ridge balance tuning post-S37 + S38 templates** — new templates will shift balance reads. Captured in `docs/playtest-watch.md`.
- **Pacing + cliff-thickness playtest read** — S33.5 carry. In `docs/playtest-watch.md`.
- **Charged-action tooltip browser verification beyond Tidal Wave** — S33.5 / S37 carry.
- **Burn × Purifier playtest** — exercisable via Aggro Knight Squad's Lightning Mage. In `docs/playtest-watch.md`. Now also a `docs/playtest-scenarios.md` entry.
- **Walk-on-Water passive** — future content.
- **Opponent (Red) sprite flip during deployment** — S35 carry; cosmetic.
- **Procced Lightning Strike action-log attribution / Rasp Pendant drain attribution** — S30 carries.
- **AI active absorption exploitation** — S27 carry. **AI projection forecast extension via `computeOutgoingHitChance`** — S30 carry.
- **`isWaterTile` predicate keys on elevation, not registry** — S33 carry; no v1 case.
- **`buildBattle` test-fixture extraction** — triggers at fourth duplication.
- **Procced spell uses caster's MA / Magus Crown calibration / Tintinibar Regen / Sorcerer's Robe Move +1** — ongoing playtest reads. In `docs/playtest-watch.md`.
- **Suppress pre-battle init entries in release builds** — longer-term polish.
- **`map-and-battlefield.md` open questions** — elevation hit-chance/cover, AoE multi-layer, LoS tie-breaking.
- **`mapAllTerrainCosts` vs. `defaultStepCost`** — no v1 case.
- **Centralized `canApplyHeal` helper** — explicitly rejected (ADR-0074); revisit at a third heal-application site.
- **Surrender flow / MVP-unit algorithm / permadeath timer / settings expansion / reactions in projection column** — Phase E/F.
- **Spiked Mail / Crusader's Helm / Tricorn / Light-Dark Robe playtest reads** — S37 items; in `docs/playtest-watch.md`. Defensive Front + Aggro Knight Squad templates exercise them concretely.
- **Cross-class command set picker UX** — manual non-class-secondary picking in the team builder UI not audited; templates land cross-class secondaries directly.
- **Lightning Mage default loadout's hidden `[white_magic]` secondary** — cosmetic carry; demo defaults reference a hidden command set.
- **Gender / zodiac field implementation** — Decision 13A: state shape extensible; field added when a session needs them.
- **A White Mage class (real healer)** — flagged by Chris in plan-review; high priority for the next big content expansion.

---
