# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When starting a session, read this file and process every item — act on it, promote it elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a reason. Items do not accumulate. If there are no notes to leave, replace the contents with `_No handoff this session._` so the next session knows the file has been processed.

---

## From Session 46 close (2026-05-22) — Playtest tuning + bug fixes (6 items)

S46 was a tuning/bug-fix session, not substrate or content. Audited six playtest-surfaced items, then implemented fixes for five gameplay/UI items + one part of the sixth (terrain bar padding); the second part of the sixth (mid-battle vanishing root cause) couldn't be reproduced in the dev-server pass and is deferred. **1352 tests pass** (1342 → 1352, +10 new), `tsc -b` and `npm run build` clean.

### What shipped

- **Item 1 — Bow damage projection.** Two compounding bugs in the UI forecast:
  - The projection's variance handler (`src/ai/projection.ts` `projectionVarianceRoll`) early-returned on a pinned-1 variance band, quietly skipping the weapon-band resolver for the *expected midpoint* path. A Hunter shooting downhill projected ×1.0 instead of the height_delta-resolved ×2.0. Fix: removed the pinned-1 early return; pinned-non-1 still honors the caller's specific value (so `damage-range`'s endpoint reads still work for knife / static bands).
  - The same projection appended `hit_chance` as a damage multiplier — correct for AI EV scoring, but the UI forecast panel ALSO displays hit chance in its own row, double-counting visually. Fix: added `noEvasion?: boolean` to `ProjectExpectedDamageArgs` and a `projectionRegistryNoEvasion` that swaps `projectionEvasionCheck` for a no-op; `damage-range.ts` passes `noEvasion: true`. AI scoring unchanged (still EV-weighted); UI shows raw variance-only damage.
  - Coverage: 4 new tests in `damage-range.test.ts` (height-delta downhill, level, uphill clamp at 0, hit-chance not folded in).

- **Item 2 — Charging hit guarantee.** Was never implemented. Per FFT canon (a charging unit is defenseless against incoming physical strikes), physical attacks on Charging-statused targets now auto-hit. Single-point pre-roll guard in `evasionCheck` (`src/engine/damage/handlers.ts`); mirrored in `projectionEvasionCheck` (`src/ai/projection.ts`) and `computeOutgoingHitChance` (`src/engine/damage/hit-chance.ts`) so AI EV and UI hit-chance display agree with the engine. Extension scar: the guard reads `ruleset.chargedActions.chargingStatusTypeId` against `target.statuses`; future opt-out content (status, ability tag, equipment) edits the predicate in one location. 2 new tests in `pipeline.test.ts` (auto-hit across 50 seeds; magical attacks unchanged).

- **Item 3 — Stop duration ticking + CT drain.** Two sub-bugs:
  - Pre-S46, `suppressStatusTicks: true` on Stop's `queryTurnSkipped` return swallowed *all* status_tick emissions, including Stop's own — so Stop's duration never decremented on its fake turn (the unit stayed Stopped forever in theory; in practice they came back fast via CT). Fix: `TurnSkipResult` gained an optional `statusTypeId`, stamped by `runQueryTurnSkipped` from the winning handler's `sourceTypeId`. `reduceTurnStart` emits a self-tick for that statusTypeId on the skipped turn — even when `suppressStatusTicks: true`. Other statuses (Poison, Regen on a Stopped unit) remain governed by the flag's original intent (frozen in time). 4 new tests in `turn-flow.test.ts`; the existing S16 integration test updated to expect the new self-tick emission.
  - Pre-S46, a Stopped unit's fake turn drained CT only by `ctCosts.wait` (20) via the standard turn_end path. FFT canon: the fake turn fully drains CT. Fix: in the `reduceTurnStart` skip branch, set `unit.ct = 0` before returning. Subsequent `turn_end` is a no-op on CT (already 0).

- **Item 4a — Terrain bar padding.** `TileInfoPanel` was positioned `top: 0` and felt flush with the viewport top. Bumped to `top: 12`. ActiveTeamBanner's `top: 28` was previously flush with the bar's bottom edge (y=28); bumped its `top: 40` so the banner stays flush under the padded bar instead of overlapping the bottom 12px of it.

- **Item 4b — Terrain bar mid-battle vanishing (DEFERRED).** Audit couldn't reproduce the mid-battle disappearance in the dev-server pass — the bar is rendered unconditionally and no overlay was observed covering it. Chris will repro on next playtest. The `cursorTile` useState persistence theory remains the leading guess for the post-Main-Menu return-to-battle variant but doesn't explain mid-battle vanishing. Carried to `playtest-watch.md`.

- **Item 5 — Permadeath sprite removal.** Pre-S46, `removed: true` units rendered at `KO_ALPHA = 0.4` (visually identical to KO'd units except for the S41 permadeath badge). Fix: in `BattleRenderer.applyVisualState`, hide the sprite container when `unit.removed`. KO'd units retain their sprite (regression-safe). The S41 badge becomes redundant once the parent container is hidden; left in place since it auto-hides via the same parent-visibility gate.

- **Item 6 — Zoom max.** Default `maxZoom` raised from 3 to 4 (33% bump) in `CameraController`. Verified at the new cap in the dev server: art holds up, tiles still crisp. Camera bounds are zoom-independent so no other tuning needed.

### Item 7 (deferred — Move/map size tuning)

Logged in `playtest-watch.md` for the second-map design session (S47+). Two levers: (a) reduce baseline Move by 1 across all classes, (b) make future maps larger. Decision waits for the second map's elevation/footprint to shape up; not acting on River Ridge alone.

### Browser verification

Dev-server pass confirmed: app boots clean (no new console errors), team builder works (Highland Hunters template loads, Hunter selectable with Longbow), deployment screen works, battle starts cleanly, **terrain bar visible at the new top:12 padding** (DOM-confirmed `top: 12px`, rect at y=20), **zoom past 3× works smoothly with no pixelation** (mouse wheel scrolling pulls the camera into close-up view). The 1352-test suite covers all the engine fixes (Items 1, 2, 3); Items 5 (permadeath sprite) and the in-battle dynamics of 1/2/3 were not feel-verified in actual play during this session — they're test-validated but Chris's next pass over the battle layer will surface any rendering or pacing issues.

### Carry-forward (longer-term, unchanged)

- **Terrain bar mid-battle vanishing root cause** (S46 Item 4b, this session's deferral). See playtest-watch entry.
- **`content-id-registry.md` broader reconciliation** — S45 added its own rows but the pre-S45 staleness persists.
- Calculator class (9th, magical-knowledge specialist).
- Second map design — now an S47+ candidate after S46 displaced it for tuning.
- 5v5 unlock — later in roadmap.
- Equipment expansion (Hi-Potion / Holy Water / Elixir + accessories).
- Charm/Seduction (team-override substrate, dedicated session).
- Pyromancer R/S/M consolidation (future R/S/M review).
- Knight base-PA recalibration (playtest-driven).
- AI deployment role-aware sorting (playtest-driven; Hunter sharpens the case).
- Speed Save / Updraft per-swing reaction cap (S42 D5 deviation).
- Renderer-side multi-swing animation polish (S42 carry).
- Border/borderColor React dev warnings (cosmetic console noise).
- `assignAiTeamNames` removal (confirmed dead post-S43; still exported + tested).
- ActionType-wiring smoke test (future CI item; S46 added no ActionTypes, gap unchanged).
- Move/map size tuning — Item 7, logged for S47+.
