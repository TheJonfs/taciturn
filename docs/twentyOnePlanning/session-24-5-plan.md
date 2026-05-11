# Session 24.5 Plan: MVP Playtest Iteration — Bugs, UI Polish, Portraits

*Drafted 2026-05-11 by Claude. Plaintext-first review per Sessions 22-24 discipline. Items grouped: bugs first, then UI polish, then portraits.*

## Audit summary (current tree)

For each surface this session touches: what exists, what state it's in, what this session does to it.

### Bug surfaces

**Bug 1 — Targeting failure on AI Lightning Mage mid-battle.** Repro context: player Lightning Mage active, AI Lightning Mage was somewhere on the map; spell-pick → other nearby enemies highlighted as eligible but the AI Lightning Mage tile *did not* highlight, and clicking the AI Lightning Mage acted as Cancel. Persisted after the player's Lightning Mage moved (so not a positional-overlay artifact). Recovered on the next available unit turn.

The targeting/highlight pipeline:
- `useTurnFlow.legalTargetsState` → `computeLegalTargets(state, catalog, actor, ability)` → for `single_unit` ability, iterates `state.units.values()`, filters `vitals.hp <= 0`, then probes `validateAction(state, proposed, catalog).valid`. The result is a `Set<UnitId>` and a position list passed to `renderer.setHighlights(...)`.
- The tile-click handler in `target-select` builds a ProposedAction via `buildAction(actorId, ability, pos, occupant)` (returns `null` if `single_unit` but `occupant === null`), then calls `canCommitAction(state, catalog, activeUnit, action)` which is `validateAction + runOnActionAttempted`. Either failure → `dispatch({ kind: 'cancel' })`.
- `validateAction` for `use_ability` single_unit: actor active-turn check, MP cost, target unit exists, target tile exists, `inRange`, `rangeMode` ('arc' / 'straight_line' / 'melee'). Range gate is hard cap; arc is "source not covered" + "target not covered" (covered ⇔ a higher-layer tile at (x,y)).
- `runOnActionAttempted` fires the *actor's* hooks only — not the target's. Target-side statuses cannot block targeting via this hook.

What I ruled out from the audit:
- Status hooks on the AI Lightning Mage cannot reject the player's action (hook fires actor-side only).
- Charging status on the AI Lightning Mage doesn't filter targets — it's actor-side `queryTurnSkipped`.
- `Taunted` *can* probabilistic-block from the player's side, but it would block *all* non-Knight targets uniformly (deterministic per (taunt-source, actor, ability) tuple) — not specifically the AI Lightning Mage. Doesn't fit the symptom.
- Range / arc on Training Field (uniform single-layer at elevation 2) shouldn't fail for any unit.

What I haven't ruled out:
- A subtle bug in `validateAction` or `inRange` for a specific positional configuration.
- A stale React-memo or render-cycle issue in `legalTargetsState` (memoed on `[flowState, state, activeUnit, actsAvailable, catalog]`; should recompute on state change).
- A renderer-side hit-test issue: `BattleRenderer.hitTest` finds the topmost tile by `tile.layer`, then `unitAt(state, x, y, top.layer)`. If `unitAt` returns `null` for the AI Lightning Mage's tile (e.g., the unit's `position.layer` doesn't match the topmost tile's `layer`), `buildAction` for `single_unit` returns `null` → cancel. **But** this would not explain the missing highlight (highlight uses `validateAction`, not `unitAt`). Unless validateAction is also failing for an unrelated reason and the click-hit-test bug compounds.
- Some interaction I haven't enumerated.

The audit is exhaustive enough that I'm reasonably confident this is *not* a single obvious bug — it's something subtle that needs runtime data to pin down. **Recommended outcome for Bug 1: instrument-and-document.** See "Architectural decisions" section 1.

**Bug 2 — Tidal Wave / Chain Lightning AoE shape.** Both content files declare `effects.aoe.shape: { kind: 'diamond', radius: 1 }`. Engine `aoeFootprint` resolves diamond correctly (Manhattan radius). The bug is **not content-side** based on the file contents.

Where else the AoE preview shape is computed:
- `useTurnFlow.aoePreviewPositions` → `computeAoeFootprint` → `resolveAoeTiles(state, catalog, actor.position, hoverTarget, ability, aoe)`. For non-cone/non-line shapes (which includes diamond), it calls `aoeFootprint({ map, shape, anchor: { x, y, elevation }, verticalTolerance })` with the anchor being the *target* tile.

This path looks correct. The shape is read from `aoe.shape` and passed verbatim to `aoeFootprint`. Hypothesis: the bug is somewhere between the spec on paper and what's actually being rendered — possibly a stale playtest build (the post-Wave-2 fixes may not have been picked up due to the HMR-cache-invalidation issue noted in the Wave-2 watch-fors), or possibly there *is* a code-side dispatch difference I didn't find. **Recommended approach: write a deterministic test asserting the rendered AoE for tidal_wave and chain_lightning at a sample anchor matches the diamond-r1 footprint exactly. If the test passes, the bug is environmental (HMR / stale build); if it fails, the test pins down the bug for fix.** Either way, the test stays as a regression guard.

**Bug 3 — Burn application reported as failure.** **Root cause confirmed during audit.** In `src/ui/action-log-format.ts`:

```typescript
case 'system_apply_status': {
  const applied = action.outcome?.result.applied;
  const text = applied === true
    ? `${statusName} applied to ${targetName}`
    : `${statusName} attempted on ${targetName} (failed)`;
  ...
}
```

`StatusApplicationOutcome` (the type of `outcome.result`) has these kinds: `'applied' | 'refreshed' | 'replaced' | 'stacked' | 'resisted' | 'rejected' | 'missed'`. **There is no `applied` boolean field on the outcome.** So `result.applied` is always `undefined`, the condition fails, and every status apply renders as "(failed)" regardless of actual outcome.

The same shape exists in `formatTargetResult`:

```typescript
const applied = r.statusesApplied.filter((s) => s.applied).length;
```

`s` is a `StatusApplicationOutcome`; `s.applied` is also undefined. So per-target `use_ability` status counts are also wrong.

**Fix**: in both places, classify `outcome.result.kind` against the success set (`{'applied', 'refreshed', 'replaced', 'stacked'}`) vs. the failure set (`{'resisted', 'rejected', 'missed'}`). Render distinct messages per kind for richer feedback (e.g., "Burn refreshed on Sparky", "Burn ×3 on Sparky" for stacked). Keep "failed" / "resisted" / "missed" distinct in the log so the player can tell why an apply didn't land.

### UI polish surfaces

**Forecast panel target HP.** `Forecast` shape (forecast-compose.ts) has `targets: ReadonlyArray<ForecastTargetRow>` where each row carries `unit: Unit | null`. `ForecastPanel` renders affected rows. The Unit's `vitals.hp` and computed `maxHp` (via `runModifyStatQuery`) are accessible from the row. The change is purely to add a "HP" line to each affected row in the panel renderer. No engine work, no compose work.

**HP bar color coding.** Already 2-tier in `unit-layer.ts:drawHpBar`: `HP_BAR_FG` (green) above 0.33, `HP_BAR_FG_LOW` (red) below. Brief asks for 3-tier: **green >75%, yellow 33-75%, red <33%**. Constants needed: add `HP_BAR_FG_MID` (yellow) + `HP_BAR_HIGH_THRESHOLD = 0.75`. Update `drawHpBar` to dispatch on three buckets. Keep the existing `HP_BAR_LOW_THRESHOLD = 0.33` (rename considered but not necessary).

**QueueTower active-turn entry suppression.** `QueueTower` calls `projectUpcoming(state, 20, catalog)` and renders all 20. The first event mirrors the active anchor (per Chris's playtest call: "redundant active-turn entry"). Fix: `events.slice(1)` before rendering, and bump `VISIBLE_UPCOMING_EVENTS` or just accept 19 visible events. **Question for plan: do we want exactly 20 *future* events (request 21, slice 1)? Or is showing 19 acceptable?** My lean: request 21, render 20 future-events. Mechanical, no surprise.

**Charged-action T-number in action log.** `formatActionLog` increments `tNumber` only on `turn_start` actions. `charged_action_resolve` actions render with tag `[charged]` indented under whatever turn last started. Per Chris: each charged-action resolve gets its own T-number. Formatter-only fix: when iterating actions, if `action.type === 'charged_action_resolve'`, increment `tNumber` and emit a top-level T#### header row (similar to `turn_start`'s output) before the existing `[charged]` resolve row, OR just promote the `[charged]` row itself to `tag: T####` and `indent: false` and `tagKind: 'turn'`. Latter is cleaner: one row, top-level T-number, no extra indentation.

**Move-select pointer-hover highlight.** Currently `target-select` has a tile-hover handler that updates `flowState.hoverTarget` and drives the AoE preview (overlay channel). `move-select` has no hover handler. Add a parallel hover dispatch event for move-select, populate a hovered tile, and drive the highlight overlay layer with the hovered tile (using `kind: 'aoe'` color or a new `'move-hover'` kind). My lean: add a new `HighlightKind: 'move-hover'` distinct from `'aoe'` (different semantic; possibly different color in future — for now, can reuse the gold-ish overlay). Cleaner long-term.

**Move-select confirm-before-commit.** Per Chris's confirmation: hardcode always-confirm for Move in v1 (don't gate by `settings.confirmStep`). Add a new turn-flow state `move-await-confirm` that mirrors `await-confirm`'s shape. The action menu adds a Confirm/Cancel branch for that state. The hook's `submitMoveInternal` transitions to `move-await-confirm` first; on confirm, submits and transitions to animation.

**QueueTower charged-action click → charged-action detail panel.** Currently mini-card click on a charged-action opens the *caster's* unit detail panel. Per the brief: it should open detail for the *charged action itself* — target, AoE projection on canvas, timing info. New surface needed:

A **`ChargedActionDetailPanel`** component that takes a `chargedActionId`, looks up the in-flight charge from `state.chargedActions`, reads the spell from the catalog, and renders:
- Spell name + caster + target(s)
- Timing info (re-uses `estimateChargedTiming` data from forecast-compose, or computes locally — small enough to inline)
- AoE preview on canvas: while the panel is open, the highlight overlay channel renders the spell's AoE footprint at its target (re-uses `aoeFootprint` resolution)
- Close button to dismiss

State plumbing: `BattleView` adds a new piece of UI state (mirrors `unitDetailUnitId`) for `chargedActionDetailId`. The QueueTower's `onOpenUnitDetail` callback type widens, OR a new `onOpenChargedActionDetail` callback is added (cleaner — the click context disambiguates between charged and non-charged events). Lean: new callback. Existing `onOpenUnitDetail` route stays for unit mini-cards.

The canvas AoE preview while the panel is open: another renderer effect that calls `setHighlightOverlay` with the resolved tiles. Need to be careful about conflicts with `target-select`'s overlay — but charged-action detail can only be opened in `idle`/`action-menu` states (the mini-card click during target-select would be ambiguous; suppress click on mini-cards while in target-select for v1). Actually — the QueueTower mini-cards are always interactive. Need to think about precedence. Lean: while charged-action detail is open, suppress AoE overlay from other sources. Or simpler: **only allow opening charged-action detail when in idle / action-menu**. Match the canvas-unit-click rule.

**Portrait integration.** All 5 portrait PNGs delivered (`src/assets/portraits/{earth,fire,knight,lightning,water}{-mage,}.png`, all square, large).

Approach:
- **Asset loading**: at `BattleRenderer.mount` time, asynchronously load all class portraits for the classes present in the initial state. Use Pixi's `Assets.load(url)`. Once loaded, store `Map<ClassId, Texture>` on the renderer.
- **Map token rendering**: `UnitSprite` constructor takes an optional texture. If provided, replaces the colored circle body with a `Sprite` of the texture, scaled to fit `UNIT_RADIUS * 2` square. Team-color ring drawn behind the portrait (already exists as `activeRing`/`counterpartRing`-like overlays — add a `teamRing` Graphics drawn behind body).
- **Enemy team flip**: enemies (team_b, the AI side) render with `sprite.scale.x = -1` so the portrait flips horizontally, conveying "facing the other team."
- **Detail panel rendering**: `UnitDetailPanel` already has a stats section. Extend with a portrait `<img>` element. Source the same PNG path keyed off class id.
- **QueueTower mini-cards**: replace the colored placeholder block in `miniCardPortraitFillStyle` with the portrait `<img>` keyed off the unit's class. Same for `ActiveUnitAnchor`'s `anchorPortraitStyle`. (Detail panel + queue tower use HTML `<img>` since they're React; the canvas uses Pixi `Sprite` from the loaded `Texture`.)
- **Fallback**: if the texture fails to load (or class isn't in the loaded map), fall back to the existing colored circle. Wrap the texture lookup in a try/catch in UnitSprite construction or pass `null` if load failed.
- **Sizing**: source PNGs are large (~4MB each at 512×512+); Pixi handles downscaling at render time. The map token should fit `UNIT_RADIUS * 2 ≈ 32px` square. The detail panel can use the native PNG via `<img>` with CSS sizing (~120×120). The QueueTower mini-card uses ~30×30. All handled via CSS sizes / Pixi scale.

**Non-trivial subtleties:**
- Asset load is async; `mount` is currently sync. Two options: (a) make mount async and await asset loads before the first render; (b) start the loads in mount, render placeholder circles initially, and replace once loaded. **Lean: (b)** — keeps the renderer responsive, no "loading" state needed in BattleView. The visual swap is a one-frame transition.
- React `<img>` sources need to be stable. Use Vite's `import.meta.url` pattern or static imports of the PNGs as URL exports.

## Architectural decisions

### 1. Bug 1: hypothesis-and-instrument outcome

The audit didn't pin down a single obvious cause. Proposed approach:

**a. Add development-only diagnostic logging** at three points:

1. In `computeLegalTargets` (single_unit branch): when `validateAction` rejects a candidate, log `{ candidateId, candidatePosition, reason }` to console. Gate by `import.meta.env.DEV` so production doesn't spam.
2. In `useTurnFlow`'s tile-click handler `target-select` branch: when `buildAction` returns `null` or `canCommitAction` returns `false`, log `{ pos, occupantId, abilityId, reason }`. The `reason` requires augmenting `canCommitAction` to return a structured result instead of bool — alternative: re-call `validateAction` and `runOnActionAttempted` in the failure log path to extract the reason.
3. In `BattleRenderer.hitTest`: when the click resolves to a position whose `unitAt` returns `null` but the renderer has a sprite at that tile (visible mismatch), log it.

**b. Documented hypothesis tree** in `handoff.md` so the next playtest occurrence's diagnostic output can be analyzed against the pre-recorded hypotheses.

**c. No speculative fix.** If a bug fix would land without instrumentation, it's not making forward progress on understanding. Per the brief: "What's not acceptable: silently fixing something adjacent and hoping it covers the case."

This counts as "instrument and document" per the brief's Bug 1 acceptable outcomes. Future playtest produces structured data; we fix once.

### 2. Bug 2: write a regression test, then fix or confirm-environmental

Add a unit test that asserts the AoE footprint rendered by `computeAoeFootprint` (the UI-side function) for `tidal_wave` and `chain_lightning` at a chosen target matches the expected diamond-r1 set of tiles. If the test passes, the bug is in the playtest environment (HMR cache drift, stale build) and we document the workaround. If it fails, the test pins down the bug for fix. Either way, the test stays.

### 3. Bug 3: refactor the action-log status formatter

The bug is unambiguous: the formatter reads a non-existent field. Fix:
- Add a helper `classifyStatusOutcome(result: StatusApplicationOutcome): { applied: boolean; label: string }` that maps `kind` to a (success-bool, human label) pair.
- Use the helper in both `system_apply_status` and `formatTargetResult`.
- Per-kind labels: `'applied'` → "applied", `'refreshed'` → "refreshed", `'replaced'` → "replaced", `'stacked'` → "stacked ×N" (read `instance.stacks`), `'resisted'` → "resisted", `'rejected'` → "rejected", `'missed'` → "missed".
- Add tests for each kind in `action-log-format.test.ts`.

### 4. Forecast panel target HP — minimal extension

Add `targetHp?: { current: number; max: number }` field to `ForecastTargetRow` (or compute inline from `row.unit` when rendering). Lean: compute inline from `row.unit` + `runModifyStatQuery` for maxHp. Display as a small line under the target name: "HP 33/44". No change to compose, just to the panel renderer.

### 5. HP bar color coding — renderer constants

Per Chris's spec: green >75%, yellow 33-75%, red <33%. Add to `constants.ts`:
- `HP_BAR_FG_MID = 0xe6c757` (yellow)
- `HP_BAR_HIGH_THRESHOLD = 0.75`
Keep `HP_BAR_LOW_THRESHOLD = 0.33`.
Update `unit-layer.ts:drawHpBar` to dispatch via three branches (low / mid / high). Tunable later if Chris wants.

### 6. QueueTower active-turn entry suppression

Request 21 events from `projectUpcoming`, slice off the first, render 20 future events. One-line change.

### 7. Charged-action T-number in action log — formatter-only

In `formatActionLog`, increment `tNumber` on `charged_action_resolve` actions before formatting them, and have `formatAction`'s `charged_action_resolve` branch emit a top-level T#### row (`tag: T####`, `indent: false`, `tagKind: 'turn'`) instead of the indented `[charged]` row.

Specifically: change `tag: '[charged]'` to `tag: formatT(currentTNumber)`, change `indent: true` to `indent: false`, change `tagKind: 'system'` to `tagKind: 'turn'`. The charged context (caster + ability + per-target results) still renders in the same row text.

### 8. Move-select pointer-hover highlight

Add a `hoverTarget: Position | null` field to the `move-select` state in `turn-flow.ts` (mirrors `target-select.hoverTarget`), plus a `hoverTarget` event branch in `move-select`. In `useTurnFlow`, register the tile-hover handler on `move-select` (currently only on target-select). Render the hovered tile via `setHighlightOverlay([hoverTarget], 'move-hover')`. New highlight kind `'move-hover'` added to `HighlightKind` and `HIGHLIGHT_COLORS` (color: brighter blue or gold — lean: gold 0xf6e5a8 same as AoE for visual parity, since both are "preview" highlights).

### 9. Move-select confirm-before-commit

Add new turn-flow state `move-await-confirm` carrying the `destination: Position`. The hook's `submitMoveInternal` transitions to `move-await-confirm` first; the action menu adds a `MoveConfirmRow` with Confirm/Cancel buttons. On confirm, `uiController.submit(action)` then dispatch `confirmAccept` (or new event `commitMove`).

Hardcoded always-confirm; ignores `settings.confirmStep`. Future settings work can wire it up.

Existing target-select await-confirm pattern is the template.

### 10. QueueTower charged-action click → ChargedActionDetailPanel

New component `src/ui/charged-action-detail-panel.tsx`. Props: `chargedActionId | null`, `state`, `catalog`, `onClose`, `onSetAoeOverlay(positions, kind) → void` (for canvas AoE preview integration).

QueueTower's `MiniCard` click handler:
- If event is a charged-action and `onOpenChargedActionDetail` is provided, call it with the charged action's id.
- Otherwise (unit event), call `onOpenUnitDetail` with the primary unit id.

BattleView wires:
- `chargedActionDetailId` state, set/cleared by the new callback.
- `<ChargedActionDetailPanel chargedActionId={chargedActionDetailId} ... />` mounted as overlay.
- The panel calls back into BattleView's `setHighlightOverlay` (via renderer ref) when mounted/unmounted to render/clear the AoE preview on canvas.
- Suppress charged-action mini-card click while not in `idle`/`action-menu` (parallel to canvas-unit-click rule).

### 11. Portrait integration

**Asset loading pattern:**
- Add `src/assets/portraits/index.ts` with explicit URL imports per class:
  ```typescript
  import waterMageUrl from './water-mage.png';
  import lightningMageUrl from './lightning-mage.png';
  // ...
  export const PORTRAIT_URLS: Map<ClassId, string> = new Map([...]);
  ```
- BattleRenderer.mount loads all portrait textures via `Assets.load`; stores in `portraitTextures: Map<ClassId, Texture>`.
- UnitSprite gets a setter `setPortrait(texture: Texture | null)` called after async load resolves; UnitSprite re-draws using the texture if present (sprite child overlaid on hidden body), else keeps the circle body.
- Detail panel + QueueTower use `<img src={PORTRAIT_URLS.get(classId)}>` — CSS sizes naturally.

**Team flip on canvas**: enemy units get `portraitSprite.scale.x = -1` and `portraitSprite.x` adjusted to compensate. (Pixi flips around the anchor; with anchor 0.5, the flip is centered.)

**Team-color ring**: draw a ring (stroke-only circle) around the portrait using `TEAM_COLORS[unit.team]`. Replaces the existing solid circle's role of conveying allegiance. Existing `activeRing` (gold) sits outside this; counterpartRing also stays.

**Fallback**: if `portraitTextures.get(classId)` is undefined or load failed (caught in mount), UnitSprite falls back to the colored circle (existing path).

### 12. Test strategy

- **Bug 1**: no test (instrument-only outcome). The diagnostic logging is the artifact.
- **Bug 2**: regression tests for tidal_wave and chain_lightning AoE shape (via `computeAoeFootprint`).
- **Bug 3**: tests covering each `StatusApplicationOutcome.kind` rendering correctly in the action log formatter.
- **Forecast HP**: visual change; manual verification.
- **HP color**: visual change; manual verification.
- **QueueTower suppress**: small enough that a snapshot test in `queue-tower.test.tsx` (if not already present) is overkill; the change is one-line.
- **Charged-action T-number**: extend `action-log-format.test.ts` with a charged_action_resolve fixture asserting the row gets a T#### tag.
- **Move hover + confirm**: extend `turn-flow.test.ts` with the new states/transitions.
- **Charged-action detail panel**: focused on integration; acceptance is "click opens panel, AoE shows on canvas, close clears." Manual.
- **Portraits**: visual; manual + the fallback path is exercised by removing/renaming a PNG.

### 13. Single-session vs. 24.5a/24.5b split

Per the audit, Bug 1 lands as instrument-and-document (no protracted debugging cycle); the rest are mechanical. The portrait integration is the largest item but well-scoped. **Recommendation: keep as one session.** No split needed unless mid-implementation discovers a true blocker.

## Implementation order

Bugs first (sets up clean state for UI work to stabilize against), then UI completion items in roughly user-visible-impact order, then portraits (largest, most independent).

1. Bug 3 — burn log false-failure (smallest, most contained, highest test confidence)
2. Bug 2 — Tidal Wave / Chain Lightning AoE shape (regression test + fix or confirm environmental)
3. Bug 1 — diagnostic instrumentation + documented hypothesis tree
4. UI: forecast target HP
5. UI: HP bar color coding
6. UI: QueueTower active-turn suppress
7. UI: charged-action T-number
8. UI: move-hover highlight
9. UI: move-confirm-before-commit
10. UI: QueueTower charged-action click → detail panel
11. Portraits: asset loading + UnitSprite integration + detail panel + queue tower + fallback

## Acceptance checks (from brief)

- Bug 1 instrumented + hypothesis tree in handoff.
- Tidal Wave + Chain Lightning render diamond-r1 (regression test in place).
- Burn log reflects actual apply outcome.
- Forecast panel shows target HP.
- HP bars color-code 3-tier.
- QueueTower first-event suppressed.
- Charged-action log entries get T-numbers.
- Move-select shows hover highlight + requires confirm.
- QueueTower mini-card click on charged-action opens detail with target/AoE/timing.
- Portraits render on canvas + detail panel + queue tower (fallback for missing assets).
- Tests: 651+ passing (target adds ~10-15 new tests).
- ADRs: at minimum (a) Bug 1 hypothesis tree (or root cause if found late), (b) ChargedActionDetailPanel as new component, (c) portrait integration approach.
- `handoff.md` updated.

## Files to be touched

Confirmed via audit, in roughly the order above:

- `src/ui/action-log-format.ts` — Bug 3 status outcome classifier; charged-action T-number reformat
- `src/ui/action-log-format.test.ts` — new tests for both
- `src/ui/use-turn-flow.ts` — Bug 1 instrumentation; move-hover wiring; move-confirm transition; new move-select hover field
- `src/ui/turn-flow.ts` — new `move-select.hoverTarget` field; `hoverTarget` event branch for move-select; new `move-await-confirm` state + transitions
- `src/ui/turn-flow.test.ts` — new transitions
- AoE preview test (new file): `src/ui/aoe-preview.test.ts` covering tidal_wave + chain_lightning
- `src/ui/forecast-panel.tsx` — target HP row
- `src/renderer/constants.ts` — yellow color + 75% threshold; new `'move-hover'` highlight color
- `src/renderer/unit-layer.ts` — 3-tier HP bar; portrait Sprite integration; team-color ring
- `src/renderer/highlight-layer.ts` — new `'move-hover'` HighlightKind in `HIGHLIGHT_COLORS`
- `src/renderer/battle-renderer.ts` — portrait asset load; `setPortrait` plumbing
- `src/ui/queue-tower.tsx` — first-event suppress; portrait `<img>` for mini-cards + anchor; click-charged dispatch route
- `src/ui/charged-action-detail-panel.tsx` — new component
- `src/ui/unit-detail-panel.tsx` — portrait `<img>` in stats section
- `src/ui/action-menu.tsx` — new `move-await-confirm` branch (MoveConfirmRow)
- `src/app/BattleView.tsx` — `chargedActionDetailId` state + panel mount; charged-detail callback wiring
- `src/assets/portraits/index.ts` — new file: PORTRAIT_URLS map
- `src/ui/index.ts` — exports for new component
- `docs/decisions/0046-bug-1-targeting-hypothesis.md` — new ADR (Bug 1)
- `docs/decisions/0047-charged-action-detail-panel.md` — new ADR (charged-action detail panel design)
- `docs/decisions/0048-portrait-integration.md` — new ADR (asset loading pattern, fallback)
- `docs/handoff.md` — updated with Bug 1 hypothesis tree + outgoing notes

ADR numbers placeholder; check `docs/decisions/` for next available before writing.

## Out-of-scope (carried per brief)

- Timing projector accuracy improvement
- Tower slot-in for charged-action resolves
- Charged-action animation pacing
- Attack-in-Act repositioning (Session 25)
- All Phase B/C/D/E work
- Settings expansion (move-confirm-as-setting deferred)
- Carry-forward items from Session 24's deferral list

## Risks / open questions

1. **Bug 1 might not produce diagnostic output for many playtests** if the trigger is rare. Acceptable — once diagnosed, the fix lands quickly.
2. **Bug 2's regression test may pass**, in which case the AoE shape was already correct and the playtest observation was stale-build. Document the HMR-cache workaround more visibly in handoff.
3. **Portrait asset sizes (~4MB each)**: 5 portraits = ~20MB initial load. Acceptable for v1 dev environment; production should ship lower-res variants. Out of scope here; flag in handoff.
4. **The `move-hover` highlight color collides with AoE gold** by my recommended choice. If Chris wants visual distinction, easy to retune — flag for review.
5. **Suppressing charged-action mini-card click outside idle/action-menu**: keeps things simple but may surprise the player ("clicked the spell, nothing happened"). Lean: still allow the click, just don't render the AoE overlay (since target-select / move-select already own the overlay). The detail panel itself can open over the action menu.
