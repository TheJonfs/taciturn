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

## From session 2026-05-14 (Session 36 — Phase E: team builder UI)

Team builder landed. **Tests: 1077 passing across 97 files, 0 failing** (up from 1048/93 — +29 tests, +4 files). No new ADR — the audit confirmed Chris's read: the ability cost/capacity/validation substrate was already complete (`getCost` / `getCapacity` / `validateLoadout` / `modifyBucketCapacity` all shipped in earlier sessions), so the team builder is a pure UI wrap. No 36a/36b split.

### Scope completed

- **River Ridge loadouts made unique-per-team compliant (B2 approach).** Equipment is now re-authored locally in `river-ridge-battle.ts` via a `RIVER_RIDGE_EQUIPMENT` map; `demoBattle` is byte-for-byte untouched (it's the 3v3 engine smoke-test fixture and stays non-compliant — the unique-per-team rule is a playable-content rule, not an engine invariant). A new structural test in `river-ridge-battle.test.ts` asserts compliance and would fail on regression. Loadout adjustments: Blue Lightning Mage Pointy Hat→Magus Crown; Blue Fire Mage Pointy Hat→Guard Cap / Wizard's Robe→Battle Gear / Flametongue→none; Red Lightning Mage Pointy Hat→Guard Cap / Wizard's Robe→Silvered Vest; Red Fire Mage Wizard's Robe→Battle Gear; Red Water Mage Pointy Hat→Focus Band.
- **`BuiltTeam` type + two default templates** in new `src/content/teams/`. `built-team.ts` (type + `buildBaseStats` + Brave/Faith bounds), `current-test-team.ts` (the adjusted Blue team — a test pins it to `riverRidgeBattle`'s team_a), `pure-mage-team.ts` (one mage of each element), `build-team-battle-config.ts` (`buildTeamBattleConfig` — folds a `BuiltTeam` into a map config; lives in content/, not app/, to avoid a content→app layering inversion).
- **Team builder state** — `src/ui/team-builder-state.ts`, pure flat editable record (plan decision 2A) + validity predicate + `use-team-builder.ts` hook. Capacity/cost are computed by thin local helpers (`draftBucketCapacity` / `draftAbilityCost`) rather than the engine's `getCapacity`/`getCost` — those need a built `GameState` and `createInitialState` throws on an invalid loadout, so they can't double as a live validity probe. `team-builder-state.test.ts` has engine-agreement tests pinning the local helpers against the real engine functions; drift fails loud.
- **`computeDraftUnitStats`** — live equipment/ability-modified stats by building a throwaway one-unit config off the map template and running the real `createInitialState` + `runModifyStatQuery`. No reimplemented composition.
- **TeamBuilderScreen + UI** — `src/app/TeamBuilderScreen.tsx` (new `'teamBuilder'` App-shell screen) + five `src/ui/team-builder-*` components (roster, class-picker, equipment-slots, ability-picker, default-loader). Card-pick class selection, per-slot equipment dropdowns with class-restriction + unique-per-team filtering, ability picker with class-default-free / cross-class-at-cost passives **and secondary command sets** (Chris's call — Magus Crown's capacity bump matters here), Brave/Faith sliders (40–90), live budget indicators.
- **One unit per class per team** — enforced post-plan-review (this rule wasn't in the brief's decision-12 validity list; Chris flagged it after seeing three Fire Mages get picked). The class picker disables classes already taken by another unit (mirrors the unique-per-team equipment filtering); `computeTeamValidity` reports `duplicateClassIds` as the backstop and factors it into `valid`.
- **Output contract** — team builder produces a `BuiltTeam`; `App` folds it via `buildTeamBattleConfig` into a `BattleConfig`, threaded to both `DeploymentScreen` (new `template` prop, dropped its `riverRidgeBattle` hardcode) and `BattleView` (new `template` prop). Flow: Title → Battle Setup → Team Builder → Deployment → Battle, browser-verified through the deployment screen.
- **Deployment roster stats aligned to live computed values** (decision 14, Chris's call) — `deployment-roster-panel.tsx` now runs `runModifyStatQuery` for PA/MA/Speed (HP/MP were already effective maxes). New `battleState: GameState` prop.

### Limitations + watch-fors

- **Mage equipment pool is exactly catalog-sized.** After excluding hidden items there are exactly 4 mage-eligible headgear and 4 mage-eligible armor items — a pure-mage team consumes every one, so head/armor slots are *forced*, not chosen. Chris's call: flag for a future content session to widen the mage equipment pool. Noted in `pure-mage-team.ts`'s header comment too.
- **Team builder state is lost on back-navigation.** Leaving `'teamBuilder'` unmounts the screen (and its `useState` draft). Going Deployment → Back → Team Builder lands on a fresh empty builder. Team-build state preservation is explicitly Session 37 scope ("save/restore of in-progress team builds" in the roadmap) — deferred, not a bug.
- **`computeDraftUnitStats` returns `null` for an over-capacity loadout** (createInitialState throws on invalid loadout; caught). The roster card then shows "— loadout invalid —" instead of stats; the footer validation panel explains the actual violation. Acceptable — the common edit path keeps the loadout valid.
- **Battle Gear shows a large HP swing in the team builder** (Fire Mage HP ~227 vs ~97 baseline). That's the catalog's `statMods` flowing through `runModifyStatQuery` faithfully — a content-balance observation, not a team-builder bug. Worth a glance during the post-S36 River Ridge balance read.
- **Full deployment→battle loop still has the S35 synthetic-event limitation.** The team builder is DOM-only and fully browser-verified (load-default → roster with live stats → Continue → deployment screen consumes the built team). Tile placement → Start Battle → battle still needs the `__taciturnDeployDebug` path or a human; `team-builder-integration.test.tsx` covers the data pipeline (BuiltTeam → buildTeamBattleConfig → buildDeployedBattleConfig → createInitialState → runPreBattlePhase).
- **`tsc -b --noEmit` reports 202 errors** — all pre-existing `.test.ts` strict-mode errors (the long-standing S34 carry; the +1 vs the "201" figure is `orchestrator.test.ts`'s pre-existing `Controller` import error, untouched). Session 36's source + test files add **zero** tsc errors. `vitest` is fully green; `vite build` succeeds.

### Considered and rejected this session

- **B1 — editing `demo.ts`'s shared equipment constants** to fix the unique-per-team violations. Rejected: it would change `demoBattle` (the engine smoke-test fixture) and risk perturbing `orchestrator.test.ts` / `ai-controller.integration.test.ts`. B2 (local override in `river-ridge-battle.ts`) keeps `demoBattle` untouched. Chris approved B2 at plan-review.
- **Maintaining a live full-team `GameState` in the team builder** for capacity/cost. Rejected: `createInitialState` throws on a classless or over-capacity unit, so it can't back a live validity probe. Local helpers + engine-agreement tests + the `createInitialState` gate at "Continue" is the chosen shape.

### Suggested scope for Session 37

Per the roadmap: **pre-battle UI integration polish.** Smooth the Title → Setup → Team Builder → Deployment → Battle flow; the obvious first item is team-build state preservation on back-navigation (see limitations above). Also a candidate: the narrow-viewport layout of the team builder edit panel (the 5-card class grid + 2-column edit panel want a reasonably wide window — eyeball at real sizes, same S34 carry as the title screen).

### Longer-term carry-forward (unchanged from S35 unless noted)

- **Pass-and-play toggle + dual deployment + battle-loop AI gating** — dedicated future session. Deployment surfaces are team-parameterized; the team builder builds only team_a (Blue), Red stays authored.
- **Mage equipment pool expansion** — new this session; see limitations.
- **AI deployment logic / AI team random-fill** — Red uses authored placements; future tactics-layer pass.
- **Title screen + team builder layout eyeball at real window sizes** — S34 carry, now extended to the team builder.
- **Full battle → results → continuity-button loop manual playtest** — S34 carry; the deployment → battle stretch is browser-verified through deployment, but a human-driven battle to the results screen still hasn't been run.
- **River Ridge balance tuning** — the post-S36 loadouts shifted (Wizard's Robe / Pointy Hat counts down on both teams); a fresh balance read is needed. Watch the Battle Gear HP swing.
- **Pacing + cliff-thickness playtest read** — S33.5 carry, still unplaytested.
- **Charged-action tooltip browser verification** — S33.5 carry.
- **Burn × Purifier playtest** — exercisable via the Red Lightning Mage loadout (Purifier retained).
- **Walk-on-Water passive** — future content.
- **Opponent (Red) sprite flip during deployment** — S35 carry; cosmetic.
- **Procced Lightning Strike action-log attribution / Rasp Pendant drain attribution** — S30 carries.
- **AI active absorption exploitation** — S27 carry. **AI projection forecast extension via `computeOutgoingHitChance`** — S30 carry.
- **`isWaterTile` predicate keys on elevation, not registry** — S33 carry; no v1 case.
- **`buildBattle` test-fixture extraction** — triggers at fourth duplication.
- **Procced spell uses caster's MA / Magus Crown calibration / Tintinibar Regen / Sorcerer's Robe Move +1** — ongoing playtest reads.
- **Suppress pre-battle init entries in release builds** — longer-term polish.
- **`map-and-battlefield.md` open questions** — elevation hit-chance/cover, AoE multi-layer, LoS tie-breaking.
- **`mapAllTerrainCosts` vs. `defaultStepCost`** — no v1 case.
- **Centralized `canApplyHeal` helper** — explicitly rejected (ADR-0074); revisit at a third heal-application site.
- **TS strict-mode test errors (~202)** — S34 carry; pre-existing on `main`.
- **Surrender flow / MVP-unit algorithm / permadeath timer / settings expansion / reactions in projection column** — Phase E/F.

---
