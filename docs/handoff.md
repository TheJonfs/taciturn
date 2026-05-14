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

## From session 2026-05-13 (Session 32 — Cluster 6 substrate + cliff-edge rendering)

Session 32 shipped Phase D substrate: Cluster 6 map mechanics (jump-over-water pathfinding, knockback-into-water verification, pre-battle equipment auto-status as logged actions), the orchestrator pre-battle phase (rerouting initial state through the reducer per CLAUDE ground rule 3), the cliff-edge rendering substrate (R-D / shaping for River Ridge in S33), and the S31.5-flagged defensive structural-equivalence test on the damage pipeline. Tests: **887 passing across 73 files, 0 failing** (up from 859 across 71). Two new ADRs (0071, 0072).

### Scope completed

**Cluster 6 — Map mechanics (4 items):**

1. **Item 15 — Jump-over-water pathfinding.** Dijkstra expansion in `src/engine/map/pathfinding.ts` adds four cardinal two-step leap candidates per visited node when the intermediate tile is water (elevation 0 or 1) and the destination is land (elevation ≥ 2). Cost: fixed 2 move points per leap. Requires `Jump ≥ 1`. Elevation tolerance measured source-to-destination (Δelev ≤ jump). Intermediate tile's `canEnter` does NOT gate the leap (the unit hops over it); destination still does. 10 new unit tests covering candidate generation, Jump requirement, water-then-land constraint, cardinal-only constraint, elevation tolerance, occupant blocking, fixed-cost behavior under `terrainCosts` overrides, and no-spurious-leaps regression on flat maps.

2. **Item 16 — Knockback-into-water verification.** Two test additions (no substrate change — the primitive already supports water destinations):
   - Primitive test in `src/engine/map/knockback.test.ts`: ridge elev 7 → shallow water elev 1 lands the unit on the water tile with `dropDistance = 6` and `fallingDamageAction.payload.amount === 60` (10 × dropDistance).
   - End-to-end integration test in new `src/engine/actions/session-32-integration.test.ts`: `reduceUseAbility` with a `damage.knockback` rider produces an `AbilityTargetResult.displacedTo` matching the water tile + emits a `system_damage` action with `source.kind: 'falling'`, `dropDistance: 6`, `amount: 60`.

3. **Item 17 — Pre-battle equipment auto-status as logged actions.** `applyEquipmentStatusGrants` (direct-mutation private helper in `createInitialState`) replaced with `enumeratePreBattleActions` (pure helper returning a queue of `ProposedAction`s). New optional `context` field on `SystemApplyStatusPayload`:
   ```ts
   context?: { kind: 'pre_battle_equipment'; itemId: ItemId }
   ```
   The reducer threads `sourceKind: 'equipment'` + `sourceEquipmentId` from `context` to `applyStatus` so the resulting status instance carries `source.kind === 'equipment'` — preserves the ADR-0028 in-battle-remove invariant.

4. **Orchestrator pre-battle setup pass.** `DemoOrchestrator` constructor takes an optional fourth argument `preBattleActions: ReadonlyArray<ProposedAction>`. On each `step()`, the orchestrator drains one pre-battle action through `commitAction` before falling through to the existing scheduler-advance branch. Empty queue = behavior identical to pre-S32. Failures throw (engine-emitted actions are programmer errors if they fail validation). `BattleView.tsx` computes the queue via `enumeratePreBattleActions(state, trainingFieldBattle, catalog)` and passes it in.

**Cluster 2 Item 13 fold-in (D4 = A):**

5. **Initial CT randomization as `system_set_ct` action.** New action type — absolute CT setting, distinct from delta-based `system_ct_push`. Sub-discriminant `source: { kind: 'initial_ct' }` open for future extension (debug-reset, content-driven absolute CT). Reducer clamps to `[0, TRIGGER_THRESHOLD - 1]`. `placementToUnit` leaves `ct = 0` when no explicit `placement.initialCT`; the orchestrator's pre-battle phase emits one `system_set_ct` per such unit via `resolveInitialCT(ruleset, placement, masterSeed)`. Explicit `placement.initialCT` short-circuits the queue (no redundant log entry). `resolveInitialCT` lifted to its own file `src/engine/setup/initial-ct.ts`.

**Defensive add (S31.5 carry-forward):**

6. **`DEFAULT_TEST_DAMAGE_PIPELINE` ↔ production structural equivalence.** Pre-S32 the test fixture was missing the `postFinalize` stage entirely (not just stale handler order). Fixed by adding `postFinalize: ['fire_on_final_damage']` to the test fixture + `postFinalize: []` to `EMPTY_DAMAGE_PIPELINE`. New test in `src/content/rulesets/default.test.ts` asserts same-stage-set + same-handler-arrays between `defaultRuleset.damagePipeline.stages` and `DEFAULT_TEST_DAMAGE_PIPELINE`. Existing pipeline assertion extended to cover `postFinalize`.

**Cliff-edge rendering substrate (cliff edges only; stack markers deferred to S33):**

7. **`CliffEdgeLayer`** in new `src/renderer/cliff-edge-layer.ts`. Reads `BattleMap` (engine-blind — no `GameState` or `Catalog` dependency). For each tile, checks four cardinal neighbors; for any neighbor with strictly lower elevation, draws a darkened strip on the higher tile's edge facing the lower neighbor.
   - **Thickness:** categorical tiers per ADR-0072: Δ=1 → 1px; Δ=2-3 → 2px; Δ≥4 → 3px.
   - **Color:** higher tile's terrain palette color × multiplicative darken. Two darken tiers: `CLIFF_EDGE_DARKEN_HIGHLIGHT = 0.78` (N + W edges, lit) vs `CLIFF_EDGE_DARKEN_SHADOW = 0.55` (S + E edges, shadowed). Upper-left-lit convention.
   - **Layer placement:** between `TileLayer` and `HighlightLayer` in the world container, so cliff strips appear "on" the tile but under highlights. Units still draw over both.
   - **Draw timing:** once at `BattleRenderer.mount()`. Static for the map's lifetime in v1 (no elevation-mutation content). Future calls to `draw(map)` repaint cheaply if elevation changes.
   - 12 new unit tests in `src/renderer/cliff-edge-layer.test.ts` covering thickness scaling (5 cases), darken-factor edge categorization (3 cases), and the multiplicative `darkenColor` helper (5 cases with channel clamping).
   - Verified visually in browser preview: Training Field renders cleanly with zero strips (uniform elevation = no cliffs drawn).

**Action-log formatter polish (folded in this session per Chris's plan-review pick):**

8. **`[init]` tag** for `system_apply_status` (when `context.kind === 'pre_battle_equipment'`) and `system_set_ct`. Renders as "Tintinibar grants Regen to Blue Knight" and "Blue Knight enters battle at CT 18". New `safeItemName(catalog, id)` helper alongside the existing `safeAbilityName` / `safeStatusName`. Verified in browser preview — action log shows the new entries at battle start with proper attribution.

### Architecture records

- **ADR-0071** — Pre-battle action-source pattern + orchestrator pre-battle phase. Documents the `SystemApplyStatusContext` extension, the new `system_set_ct` action type, the orchestrator's pre-battle phase boundary, `enumeratePreBattleActions` + `runPreBattlePhase` helpers, equipment-source threading in `reduceSystemApplyStatus`, and the CLAUDE-rule-3 alignment.
- **ADR-0072** — Cliff-edge rendering convention. Documents the categorical thickness tiers (Δ=1/1px, Δ=2-3/2px, Δ≥4/3px), palette-derived darken color, upper-left-lit directional shading, and the layer placement between tiles and highlights. Stack markers deferred to S33 noted in "Alternatives considered."

### Test reconciliation

- **+10** in `pathfinding.test.ts` — jump-over-water leap candidates.
- **+1** in `knockback.test.ts` — ridge-into-water primitive.
- **+1** in new `session-32-integration.test.ts` — end-to-end knockback into water via `reduceUseAbility`.
- **+2** in `default.test.ts` — `postFinalize` stage assertion + `DEFAULT_TEST_DAMAGE_PIPELINE` structural equivalence.
- **+3** in `orchestrator.test.ts` — pre-battle queue drain; replay-determinism via the queue; empty-queue falls through to scheduler-advance.
- **+12** in new `cliff-edge-layer.test.ts` — thickness/darken/edge helpers.

Tests updated for new pre-battle phase routing:
- `src/engine/setup/initial-ct-variance.test.ts` — `createInitialState` wrapper now calls `runPreBattlePhase`; reads CT post-pre-battle-phase. Same value (`resolveInitialCT` unchanged).
- `src/engine/setup/create-initial-state.test.ts` — "ruleset CT fixed:50" test split: assert ct = 0 at construction, ct = 50 after `runPreBattlePhase`.
- `src/engine/actions/session-17c-integration.test.ts` — `buildBattle` helper threads `runPreBattlePhase` so equipment statusGrants land before assertions.
- `src/app/controllers/ai-controller.integration.test.ts` — passes `preBattleActions` to the orchestrator constructor.
- `src/app/BattleView.tsx` — same.

**Final count: 887 passing across 73 files, 0 failing.**

Browser preview verified twice:
- After items 3+4+5: action log shows `[init]` entries with proper attribution ("Tintinibar grants Regen to Blue Knight", "Sorcerer's Robe grants Shell to Blue Water Mage", "Blue Knight enters battle at CT 18"). Demo battle launches and pumps through CT spool-up without errors.
- After item 7 (cliff-edge layer): Training Field renders unchanged (uniform elevation = zero cliff strips). No new visual artifacts. No console errors.

### Limitations + watch-fors

- **Tidewalker terrain-family widening for River Ridge (S33).** River Ridge will author distinct terrain types `water_deep` (elev 0) / `water_shallow` (elev 1) per Chris's call (terrain tied to elevation, settable as a future-proof for elevation-mutation abilities). Tidewalker today keys on `'water'` only in its `modifyTerrainCosts` handler ([src/content/abilities/tidewalker.ts](src/content/abilities/tidewalker.ts)). When River Ridge ships, Tidewalker must widen to decrement both `water_deep` and `water_shallow` costs, OR a terrain-family abstraction (`{ water_deep, water_shallow } → 'water' family`) lets Tidewalker key on the family. S33 audit.

- **Jump-over-water elevation tolerance: source-to-destination.** Implementation measures Δelev from the source tile to the leap destination (not from the intermediate water tile). Matches "the leap is one atomic move." If a future scenario surfaces "leap from low to leap across to a steep cliff requires intermediate-relative measurement," revisit. No v1 case.

- **Cliff-edge strips draw inward from each tile's footprint.** A south-edge cliff occupies the bottom `thickness` pixels of *that tile's* footprint, not the top of the neighbor's. Tile-ownership clean; the alternative (outward draws) would have produced overlap with the neighbor's own cliffs. Renderer assumption: per-tile cliff visuals are self-contained.

- **Cliff-edge layer is static at mount.** No re-paint hook beyond a future `cliffEdgeLayer.draw(state.map)` call. If a future ability mutates elevation mid-battle, the renderer must add a hook to repaint. v1 has no such content.

- **Corner stack markers deferred.** Per ADR-0072 / plan-review pick. The hint markers (precise per-tile elevation level) ship in S33 alongside River Ridge content if the cliff-edge layer alone reads insufficient against real elevation variance.

- **`createInitialState` no longer applies equipment grants at construction.** A test or downstream consumer that bypasses the orchestrator and reads `unit.statuses` immediately after `createInitialState` will see an empty `statuses` array even for units with Tintinibar / Sorcerer's Robe equipped. Call `runPreBattlePhase` (one-shot) or `enumeratePreBattleActions` + orchestrator pump to get the post-grant state. Documented inline + ADR-0071.

- **Action log emits N + M pre-battle entries before the first `turn_start`.** N = equipment grants across all units; M = units with formula-derived initial CT. For the demo battle this is ~6 entries (Tintinibar Regen, Sorcerer's Robe Shell, plus 4 initial-CT entries for non-explicit-CT units). The action-log UI scrolls naturally; if a future battle has many more units / more equipment grants and the log opens cluttered, a "collapse setup" toggle is the natural polish add.

- **`buildBattle` helper duplication.** Three test files (`initial-ct-variance.test.ts`, `session-17c-integration.test.ts`, plus the orchestrator-side tests via `enumeratePreBattleActions` directly) now wrap `createInitialState` + `runPreBattlePhase` to get the post-pre-battle state. If a fourth test surfaces, a shared test-fixture helper is justified.

- **`fillVitalsFromComputedMaxes` runs in `createInitialState` before equipment statuses apply.** Equipment contributors that adjust `maxHp` / `maxMp` (Wizard's Robe +40 maxMp, Staff of Abundance × 1.5 maxMp, etc.) are registered by equipment slot, not by status — so they fire correctly against the post-construction state. No equipment item in v1 grants a status that itself contributes to maxHp/maxMp via `modifyStatQuery`. If a future item authored such a status, vitals fill would lag the status's maxHp contribution by one phase. Flag this if it surfaces.

- **`SystemApplyStatusContext` is a union with one variant today.** A future emission site (debug, scripted scenario, content) that wants its own context attribution extends the union. The action-log formatter's exhaustiveness `never` cast catches the next unhandled case.

- **`system_set_ct.source.kind` is similarly single-variant (`'initial_ct'`).** Future absolute-CT consumers extend the union.

### Considered and rejected this session

- **Inline pre-battle phase in `createInitialState`** — violates CLAUDE rule 3; bundles orchestrator's animation pacing into a synchronous step. ADR-0071 Rationale.

- **Reuse `system_ct_push` with delta-from-zero for initial CT** — semantically wrong framing; "set initial CT to N" reads as a different operation than the runtime push by Water Strike etc. ADR-0071 Rationale.

- **New top-level `ActionSource` variant `'pre_battle_equipment'`** — would widen the source surface for attribution that only the formatter consumes. Payload-level `context` field is narrower. ADR-0071 Rationale.

- **Stash pre-battle queue on `GameState`** — state describes "what is true now," not "what's queued." Per-orchestrator pending state belongs on the orchestrator.

- **Make `applyEquipmentStatusGrants` synchronous + emit a marker action** — half-measure; doesn't actually route through the reducer per-grant.

- **Continuous cliff-edge thickness (1px per delta, no cap)** — 7-9px cliffs at the eastern perch would dominate the tile. ADR-0072 Rationale.

- **Linear-with-cap thickness (1px / 2px / 3px for Δ=1 / 2 / ≥3)** — loses discrimination between Δ=2 and Δ=4. Categorical binning preserves three distinct tiers.

- **Generic neutral dark gray cliff color** — visually flat across terrains. Palette-derived darken preserves material identity.

- **Full-darken-all-four (no directional shading)** — flatter cliff read. Upper-left-lit gives volume.

- **Numerical glyph in tile corner showing elevation level** — reads as text; less spatial; covered by tile-info panel.

- **Stack markers shipped alongside cliff edges in S32** — per plan-review pick. S33 picks them up alongside River Ridge content if cliff edges alone read insufficient.

- **Per-frame repaint of cliff strips** — wasted work; cliff strips are static in v1.

- **Action-log "collapse setup" toggle** — future polish; the current 6-entry pre-battle segment is fine to scroll past.

- **Tidewalker widening to handle `water_deep` + `water_shallow` in S32** — premature. River Ridge content authoring is S33; widen the ability when the content lands so the change pairs with the test surface it needs.

### Empirical-questions checklist for Chris's next playtest

The S32 changes are substrate + rendering; no equipment / ability tuning. The visible playtest reads:

**Action log:**
- [ ] At battle start, the action log shows `[init]` entries for equipment grants ("Tintinibar grants Regen to Blue Knight", "Sorcerer's Robe grants Shell to Blue Water Mage") and initial CT ("Blue Knight enters battle at CT 18", etc.). The entries appear before the first `turn_start`.
- [ ] The status badges on units (Regen on Blue Knight, Shell on Blue Water Mage) appear at the same point in the pump — they're driven by the pre-battle `system_apply_status` actions now, not a synchronous construction step. No visual regression — the badges should "pop" in sequence with the action-log entries.

**Cliff-edge rendering:**
- [ ] Training Field still renders cleanly. Uniform elevation = no cliff strips. No visual artifacts on grass tiles.
- [ ] (S33 content authoring is when this really exercises.) A synthetic elevation-variant test map (e.g. one constructed in a dev console) would show cliff strips on tiles facing lower neighbors.

**Replay determinism:**
- [ ] Restarting the demo battle (or running it with the same masterSeed twice) produces the same initial-CT values per unit. The randomization is `(masterSeed, unitId)` deterministic; the action log captures it from sequence 0.

### Longer-term carry-forward

- **River Ridge map content authoring (S33)** — the primary consumer of S32's substrate. Authors the 14×14 grid per `docs/twentyOneDesign/river-ridge.md`. Will exercise jump-over-water, knockback-into-water, the orchestrator pre-battle phase, and the cliff-edge layer all together.
- **Tidewalker terrain-family widening** — paired with River Ridge in S33.
- **Corner stack markers** — paired with River Ridge in S33 if cliff edges alone read insufficient.
- **Pre-battle UI surfaces (S35-37)** — title screen + battle setup + team builder + deployment phase + sample team templates. The pre-battle phase + initial-CT randomization are now wired through the reducer, so the pre-battle UI surfaces (specifically deployment-phase preview of auto-statuses) compose against the same substrate.
- **Walk-on-Water passive** — future content. The brief flagged it as deferred; the jump-over-water substrate is independent.
- **Polish #5 statuses portion** — S31.5 carry. Animator's `UnitVisualSnapshot.statuses` field for ahead-of-tween settle. Not yet a visible problem.
- **`UnitVisualSnapshot.maxHp` field cleanup** — S31.5 carry. Field retained but unread at the read site.
- **Wand swing ally-targetability** — S31 carry.
- **AI active absorption exploitation** — S27 carry. Tactics-layer pass.
- **AI projection forecast extension via `computeOutgoingHitChance`** — S30 carry.
- **Procced spell uses caster's MA** — S30 / S31 carry; ongoing playtest read.
- **Magus Crown +5 MA / +25% MP cost tighteners** — calibration carry.
- **Burn × Purifier playtest** — one-off battle setup needed.
- **Tintinibar Regen tuning** — initial read reasonable; ongoing.
- **Sorcerer's Robe Move +1 playtest read** — initial read reasonable; ongoing.
- **Status-badge polarity convention extension** — chip pre-icons if status lists grow.
- **Team color palette → engine `Team` shape** — long-term.
- **Tooltip Option B authored-description pass** — post-current-roadmap.
- **`onTurnStart` symmetric widening** — S26 carry.
- **Multiplicative tick-amount stacking** — S28 carry; no v1 case.
- **`onFinalDamage` fires on absorbed hits but handlers gate** — design pattern.
- **Forecast facing uses actual attacker→target geometry** — S30 carry.
- **Unit detail panel's per-facing evasion uses `unit` as attacker stand-in** — S30 carry.
- **Item #5 pacing constants** — S26.5 carry; tuning pending.
- **Constant-map labels don't carry icons today** — S28 polish.
- **`pa_factor` NotYetImplementedError** — audit E3.
- **TS strict-mode test errors** — audit E8.
- **Surrender flow** — S34 / ADR-0041.
- **MVP-unit smarter algorithm** — S24 Wave 1.
- **Permadeath timer** — S24 Wave 1.
- **Settings expansion** — S24 Wave 1.
- **Reactions in projection column** — S24 Wave 1.
- **Bedrock Stride fall-immunity** — S33 surfaces alongside River Ridge.
- **Forecast accuracy row visibility** — S30 reject; revisit if confusion surfaces.
- **Future terrain types (swamp, ice, sand)** — design-doc extensible.
- **Hit-chance and cover modifiers from elevation differential** — `map-and-battlefield.md` open question.

### Suggested scope for Session 33

Per the roadmap: River Ridge map content authoring. Phase D substrate (S32) is complete; S33 ships the content that exercises it. Concrete deliverables per `roadmap-sessions-21-plus.md`:

- Author the 14×14 grid in `src/content/maps/` per `docs/twentyOneDesign/river-ridge.md`.
- Wire `BattleConfig` for River Ridge so the demo can load it (alongside or replacing the Training Field config).
- Audit Tidewalker's `'water'` lookup and widen to `water_deep` + `water_shallow` (or introduce a terrain-family abstraction). Audit lands in the S33 plan.
- Verify the substrate end-to-end via playtest: a Water Mage's M ability + the jump-over-water leap traverse the river; a knockback off the eastern perch deals correct fall damage; the cliff-edge layer renders the ridge clearly.
- Decide whether to ship corner stack markers in S33 based on the cliff-edge read.
- Small-to-medium per the roadmap framing.
