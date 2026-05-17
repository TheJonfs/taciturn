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

## From sessions 2026-05-15 to 2026-05-17 (post-S38 playtest debrief + chain of fixes)

Two in-between-sessions days of playtest-driven fixes against the deployed v1. No new session number assigned — this is empirical tuning + crash-class bug response, not roadmap work. **8 commits** today (`0be3d0d` → `289d7a9`). **1152 tests passing across 105 files** (up from 1138/104 at the start; +14 net).

### Engine operational changes the next session should know about

These shift how the engine behaves in ways that future content / mechanics work needs to be aware of:

- **Reactions cannot trigger reactions** (`0be3d0d`). The design-doc intent ([`docs/design/action-resolution.md:157`](docs/design/action-resolution.md) — "Type-based suppression") is now enforced at the engine layer. `isReaction` is threaded `reduceUseAbility` → `resolveAbilityTargets` → `resolveAbilityEffect`; when the cast itself is a reaction, the post-application `runOnActionTargeted` call is skipped. New reaction content authoring doesn't need to think about it — the guard is automatic. The prior `0021` Brave-gated trigger still runs.

- **Charged actions clear on caster KO** (`0be3d0d`). `state.chargedActions` is filtered at the two KO-detection sites (ability-damage pipeline + `reduceSystemDamage`) via a new `clearChargedActionsForCaster(state, koUnitId)` helper. The existing `reduceChargedActionResolve` caster-KO short-circuit becomes unreachable in normal flow; kept as a defensive backstop. Future "spell completes from the grave" content (none in v1) would opt out per-ability.

- **`Charging` status has `removeOnSourceKO: true`** (`0be3d0d`). The existing `collectSourceKoSweep` cleans up the leftover `Charging` instance when the caster KOs, so a hypothetical future revival path doesn't see a stale `Charging` without a matching `ChargedAction`.

- **`unit_or_tile` is a new `TargetingSpec.kind`** (`0be3d0d` + `99e8184`). FFT-canonical "pin a unit (spell follows them) OR pin a tile (spell lands on the tile regardless of occupant)" pattern. `validateAction` accepts either `{ kind: 'unit' }` or `{ kind: 'tile' }` payload. Engine's `resolveAoeAnchor` was already polymorphic on target kind, so AoE charged spells inherited the behavior automatically (`unit` payload → AoE re-anchors at unit's current position at resolve; `tile` → AoE blooms from the tile). UI exposes a `T` keyboard toggle in the action menu's target-select panel for the unit_or_tile abilities. **20 charged abilities** now use this kind (13 single-target + 7 AoE).
  - AI treats `unit_or_tile` like `single_unit` for v1 (always pins the unit). Helper `targetsUnit(kind)` introduced in `src/ai/basic.ts` for the boolean check.
  - When adding a new charged single-target or AoE ability, **default to `unit_or_tile`** rather than `single_unit` / `tile` unless there's a specific reason to lock the mode.

- **`computeSpeed` floors the modifier-chain result** (`237aafc`). Haste's ×1.5 multiplier against odd base Speed used to produce fractional CT accumulation (e.g., Speed 11 + Auto-Haste → 16.5). Now floored to integer before the ruleset-floor clamp. Future content that introduces non-integer Speed modifiers should be aware that the result will be floored.

- **`UiController.endTurn()` defers when a commit is queued** (`39ac3ab`). The single-slot semantics still hold for `submit`, but `endTurn()` can be called immediately after `submit()` — the controller sets an `endTurnPending` flag and surfaces `end-turn` on the controller pump *after* the queued commit drains. The legitimate caller is `submitWait`'s `set_facing` → `endTurn` sequence; the prior assertion threw on every facing-changed Wait commit. `hasPending()` now reports either queue slot or the deferred end-turn.

- **`runModifyAoeShape` now threads through forecast / UI overlay / AI scoring** (`237aafc`). Aether Bloom worked at the live cast site since session 19, but three other surfaces walked the base shape: `projectAoePreview`, `resolveAoeTiles`, `aoeTilesAffected`. All three now call `runModifyAoeShape` against the caster's hooks. The hook is now exported from `engine/hooks/index.ts` for UI consumption. **When adding a new modifyAoeShape consumer** (or any other hook that mutates ability-resolution shape), check that the forecast / UI overlay / AI use the same modifier chain — there are 4 sites total today (the engine's `resolveAoeDispatch`, the forecast preview, the UI overlay, the AI scoring).

### Content changes the next session should know about

- **Status duration rebalance** (`0be3d0d`). 9 abilities cut their `per_unit_ct` duration numbers from the original 24/36/12 (which meant 24-36 of the holder's *turn cycles* — way too long) to FFT-shape: hard-disables 3, soft-disables 4, buffs 6-10. See [`docs/playtest-watch.md`](docs/playtest-watch.md) entry for the full table + tuning signals to watch. **When applying new `per_unit_ct` statuses, calibrate against this rebalance** — duration is in *holder turn cycles*, not game ticks.

### Observability infrastructure

- **Global error surface** (`0be3d0d` + `9f971b6` + `57dab7d`). `src/app/error-surface.tsx` installs `window.error` / `unhandledrejection` / `vite:preloadError` listeners at module load (`main.tsx`). Captured errors persist to `sessionStorage` and surface via a floating banner with expandable stack + component stack. Has saved hours of debugging in this debrief — production stack traces went from "the screen flashed white" to copy-paste-able stacks. **When investigating playtest bug reports, ask the player to expand the banner first** (`Details` button) — it gives the same info devtools would.

- **WebGL context-loss listeners** (`39ac3ab`). `BattleView` mount installs `webglcontextlost` / `webglcontextrestored` on the Pixi canvas, calls `preventDefault()` on lost (so the browser preserves state for restore), and forwards both to the error surface. Banner recommends reload; partial in-place recovery is unreliable. Future polish can sessionStorage the battle state and reinit the renderer in place.

- **Vite preload-error auto-reload** (`9f971b6` + `57dab7d`). After a redeploy, the user's open tab holds stale HTML pointing at chunk URLs the new build no longer ships. `vite:preloadError` fires → handler one-shots `location.reload()` (with 10s cooldown to avoid loops on genuinely-missing chunks) → also clears the captured-errors trail so the banner doesn't persist after the successful self-heal. Should make the redeploy-while-tab-open flow self-healing.

### Build configuration the next session should know about

- **Pixi co-located into a single chunk** (`289d7a9`). `vite.config.ts` has a `manualChunks` rule that puts all `node_modules/pixi.js/**` and `node_modules/@pixi/**` into a single `pixi-*.js` chunk (553 KB gzip 161 KB). Required because Pixi v8's `autoDetectRenderer` does `await import('./gl/WebGLRenderer.mjs')` internally and Vite's default code-split would produce a `WebGLRenderer-*.js` chunk that observed `undefined` on the destructured export in production (Vercel CDN). `main.tsx` also has a static `import { WebGLRenderer } from 'pixi.js'` + `void WebGLRenderer` to anchor the symbol against tree-shaking. **If you split Pixi differently in the future** (e.g., to optimize initial-load for a Pixi-free title screen), retest the deployment-screen mount on the live URL — it's the canary for this class of bug.

### UI polish landed

- **`TransitionOverlay`** (`a326d6e`) — full-screen "Returning to Main Menu…" overlay covers the ~5s battle→title unmount lag. `flushSync` forces it to paint on its own render tick before the slow `setScreen('title')` triggers BattleView's unmount. The lag's root cause hasn't been profiled — overlay just masks it. If the lag becomes a problem on a slower machine or with more action-log entries, this becomes a real perf-investigation task.

### Things noticed but not acted on (next-session candidates, low priority)

- **Main Menu transition lag root cause** — masked by the overlay (`a326d6e`) but not diagnosed. Suspects: Pixi destroy with many sprites, React reconciliation of a long action log, or browser GC pause. Profile when convenient by wrapping the cleanup steps with `performance.mark()` / `performance.measure()` and inspecting in DevTools.

- **Fire Embrace target-rejection mystery** (Chris's S38 playtest report). Engine confirmed correct (STACK_ADDITIVE same-caster + different-caster both merge to magnitude 2 / stacks 2 per `playtest-39-fixes.test.ts`). The user-observed "can't select previously-affected unit as target" is most likely a range check or arc-targetable failure. Dev-mode `[targeting] reject` console.debug in `src/ui/use-turn-flow.ts:691-707` will log the reason next time it fires. Chris will grep the console.

- **TS strict-mode error pile (~200 errors, S34 carry)**. `vercel.json` still bypasses with `vite build` instead of `npm run build`. Cleanup unblocks the typecheck gate. Mostly mechanical (`exactOptionalPropertyTypes` mismatches, a few `Action | undefined` narrowings, the `'water' as DamageTag` literal).

- **Per-target "resolves before / after" forecast for AoE** — `99e8184` fixed the picker to use the hover anchor's occupant, but the forecast only shows ONE per-cast resolves-before line, not one per affected target. Worth considering if AoE timing strategy becomes important.

- **Forecast for AoE in `await-confirm` doesn't follow hover** — by design (the anchor is pinned to the picked target). If you want live-hover-preview while await-confirm is up, that's a different feature.

### Considered and rejected this session

- **Extending `UiController` to a multi-slot FIFO queue** — would have let `submit(set_facing) + endTurn()` work without the deferred-flag trick. Rejected because the single-slot was intentional backpressure against UI clicks piling up; a FIFO would silently accept double-clicks the player didn't mean. The flag pattern preserves the assertion for `submit` while letting the legitimate `set_facing + endTurn` flow through.

- **Adding `facing?: Direction` to `turn_end` payload** — would have collapsed the `submitWait` two-action sequence into one. Rejected because `set_facing` exists as a standalone action for forward-compat (mid-action facing changes, post-cast turns) and folding it into `turn_end` would tangle two separate concerns.

- **`extensions.add(WebGLRenderer)`** — first attempt at fixing the Pixi destructure crash. Threw "Extension class must have an extension object" because WebGLRenderer is the renderer class, NOT an extension definition. The actual fix is the static reference + `manualChunks` co-location.

- **AI special-casing `unit_or_tile` cone/line abilities to pick tile-mode** — would have preserved the pre-S38 AI behavior of picking a direction tile. Rejected because picking a unit-mode payload for cone/line means the AoE re-derives direction from the unit's position at resolve time (FFT-canonical "lead the target") — arguably better AI tactically, definitely not worse. Test updated to accept either payload shape.

### Suggested scope for the next session

No fixed roadmap entry — like the S38 close, this is empirical tuning. Strong candidates:

- **Drive the live deployment** (now that `289d7a9` is committed, push + redeploy → verify the deployment-screen mount, terrain bar resurfacing, and Aether Bloom AoE preview against production).
- **Status duration rebalance signals** — watch how the new 3/4/6/10 numbers play. Captured in `docs/playtest-watch.md`.
- **Continue empirical playtest cycle** — surface more bugs through the now-much-better error surface; respond.
- **TS strict-mode cleanup** — when there's appetite for mechanical work.

### Longer-term carry-forward (mostly unchanged from prior handoff)

- TS strict-mode errors (~200) — S34 carry; `vercel.json` works around.
- Pass-and-play toggle + dual deployment + battle-loop AI gating — dedicated future session.
- AI deployment logic / random-fill — Red still uses authored placements.
- Full battle → results → continuity-button loop manual playtest — S34 carry; now also stress-tested by today's playtest debrief but bears repeating.
- Spiked Mail / Tricorn / Crusader's Helm / Light-Dark Robe playtest reads — S37 items; in `docs/playtest-watch.md`.
- Bedrock Stride real-knockback playtest, Tidewalker tempo, Purifier×Burn readability, Magus Crown calibration, Tintinibar Regen calibration, Sorcerer's Robe Move +1 — all still in `docs/playtest-watch.md`.
- A real healer class (White Mage or similar) — Defensive Front's Earth-Spells-on-Knight is still the stopgap.
- Gender / zodiac field implementation — Decision 13A: state shape extensible; lands when needed.

---
