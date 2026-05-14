# Session 32 Brief: Cluster 6 Map Mechanics + Orchestrator Pre-Battle Pass + Elevation Rendering Substrate

## Context

Phase D kickoff. Session 31.5 closed the post-equipment-complete polish lap (859/0 across 71 files). Equipment-complete milestone holds. Session 32 ships the map-side engine substrate that River Ridge depends on — jump-over-water pathfinding, knockback-into-water verification, pre-battle equipment auto-status as logged actions, and the orchestrator pre-battle setup pass. Plus a new elevation rendering substrate (cliff edges + corner stack markers) so River Ridge's terrain reads correctly when the map authors in Session 33.

River Ridge content authoring is **Session 33**, not this session. Session 32 is engine substrate + rendering primitives + small defensive items.

## Inputs (read first)

In recommended order:

1. **`CLAUDE.md`** — project conventions.
2. **`docs/handoff.md`** — Session 31.5 handoff. The "Longer-term carry-forward" section's `DEFAULT_TEST_DAMAGE_PIPELINE` defensive add is folded in here.
3. **`docs/twentyOnePlanning/roadmap-sessions-21-plus.md`** — Session 32 entry plus Session 33 entry for context on what's deferred.
4. **`docs/design/map-and-battlefield.md`** — for movement profile composition, pathfinding, range geometry, targeting modes, tile properties. Substrate document for everything Cluster 6 touches.
5. **`docs/twentyOnePlanning/river-ridge.md`** — for the engine requirements that the map will exercise. Note: River Ridge **content authoring is S33**; this session just lands the substrate it needs.
6. **`docs/decisions/0057-...`** (absorption activation), **`0058-...`** (maxMp lift pattern), **`0069-...`** (stage re-ordering + UI display fix patterns), **`0070-...`** (knockback animator wiring + KO'd absorption gate). Recent ADRs covering substrate this session composes against.

*(Path note: per S31.5 handoff watch-for, design docs live in `docs/design/`; planning docs live in `docs/twentyOnePlanning/`. The S31 brief's stale paths are corrected here and going forward.)*

### Paths to survey before planning

Current-tree audit required. At minimum survey:

- **Pathfinding implementation.** `src/engine/move/pathfinding.ts` (or wherever Dijkstra lives) for the move-engine's expansion logic. Item 15 (jump-over-water) extends this.
- **Per-tile move-cost resolution.** Where the move engine consults terrain costs from `MovementProfile.terrainCosts`. The Water Mage M-ability would compose here — confirm whether the substrate exists and is wired (see decision 5 below).
- **Knockback resolution.** `src/engine/actions/reducers.ts` or `src/engine/abilities/knockback.ts` for the deterministic position-resolution path. Item 16 adds an integration test; confirm the substrate already supports water-tile destinations.
- **Pre-battle setup.** `src/engine/initialization.ts` (or wherever `createInitialState` lives) and `applyEquipmentStatusGrants`. Item 17 reroutes this through the reducer.
- **Orchestrator.** `src/app/demo/orchestrator.ts` for the existing turn pump. New pre-battle phase inserts before turn 0.
- **Renderer.** `src/renderer/` for the tile rendering layer. Cliff edges + corner stack markers add an overlay pass between tiles and units.
- **`DEFAULT_DAMAGE_PIPELINE` and `DEFAULT_TEST_DAMAGE_PIPELINE`.** `src/content/rulesets/default.ts` and the test fixture. The structural-equivalence test catches the next divergence class.

The plan articulates what exists, what's being refit, what's being added.

## Goal

End state:

**Engine substrate (Cluster 6 — 4 items):**

1. **Jump-over-water pathfinding (Item 15).** Dijkstra expansion generates four cardinal two-step leaps where the intermediate tile is water (elevation 0 or 1) and the destination is land (elevation ≥ 2). Each leap costs 2 move points. Requires `Jump ≥ 1` on the moving unit. Cost-structure soft cap per the design call — no path-state tracking required.

2. **Knockback-into-water verification (Item 16).** Integration test: a unit at ridge elevation 7 knocked off into shallow water at elevation 1 lands on water with `dropDistance = 6` and the correct `system_damage` entry for fall damage. Substrate already supports water-tile destinations (per River Ridge engine requirement); this is the regression test that proves it end-to-end.

3. **Pre-battle equipment auto-status as logged actions (Item 17).** Reroute `applyEquipmentStatusGrants` to enqueue `system_apply_status` actions through `commitAction` rather than direct state mutation. Each grant authors as a logged action (Tintinibar → `regen_auto`, Sorcerer's Robe → `shell`, etc.). New action-source variant: `source: 'pre_battle_equipment'`. Action log captures the initial state from sequence 0 forward; replay determinism preserved.

4. **Orchestrator pre-battle setup pass.** New phase between `createInitialState` and the first turn. Orchestrator runs the pre-battle action sequence (auto-statuses, possibly initial CT randomization per decision 4 below) before turn 0 fires. CLAUDE ground rule 3 alignment: state changes flow through reducers.

**Elevation rendering substrate (new, per design conversation):**

5. **Cliff-edge overlay layer.** New rendering layer between tile sprites and unit sprites. For each tile, the renderer reads neighbor elevations on the four cardinal sides; for any neighbor with lower elevation, draws a 1-3 pixel "cliff face" strip on the higher tile's edge facing the lower neighbor. Consistent light direction (upper-left lit; faces cast shadow toward lower-right). Thickness scales with elevation delta (per decision 6 below). Color derived from the higher tile's palette (darker shade) or a generic neutral — settle in audit.

6. **Corner stack markers.** Small pixel marker in each tile's top-right corner indicating absolute elevation level above the base water/land tier. Default convention: no marker for elevations 0-2 (water/water/flat baseline); 1-N stacked markers for elevations 3+. Cap at a documented value (decision 7 below) with tile info panel covering precise readout. 25-30% opacity; toggleable via settings (future).

**Small defensive add:**

7. **`DEFAULT_TEST_DAMAGE_PIPELINE` ↔ `DEFAULT_DAMAGE_PIPELINE` structural-equivalence test.** Per S31.5 handoff carry-forward — the divergence between these two (test fixture missing `postFinalize`) is what let bug 4 (proc on miss) slip through. New test asserts structural equivalence (or that the test fixture forwards from production). Tiny, prevents the next "test fixture lagged production" bug class.

**Optional fold-in (decision 4):**

8. **Initial CT randomization as `system_set_ct` action.** If the design call lands on yes-fold-in: initial CT randomization runs through the reducer as a logged action during the pre-battle pass. If no: document why it stays as direct state mutation.

**Quality:**

- Tests at 859+, 0 failing. New tests proportional to substrate and rendering additions.
- ADRs for: pre-battle action-source variant (Item 17 + orchestrator pass); cliff-edge rendering convention (if rendering ships here).
- `docs/handoff.md` updated.

## Pre-implementation plan (required)

Same discipline as previous sessions. Current-tree audit first; architectural decisions surfaced before code.

### Required first step: current-tree audit

For each surface this session touches:

- **Move engine expansion.** Confirm Dijkstra is the active pathfinder per `map-and-battlefield.md`. Identify where adjacency candidates are generated; the jump-over-water leaps slot in as additional candidate edges.
- **Water Mage M-ability substrate.** River Ridge engine requirements list this as needing a hook into per-tile move-cost resolution. Audit whether the hook + composition machinery exist (and the M-ability is wired), or whether this is a gap that S32 needs to address. See decision 5.
- **Equipment auto-status grant path.** Where `applyEquipmentStatusGrants` lives today, what it mutates directly, and what its consumer call sites are. Item 17 reroutes this without breaking those consumers.
- **Initial CT randomization.** Whether it lives in `createInitialState`, `setupBattle`, or elsewhere. Decision 4 surfaces from the audit.
- **Renderer tile-overlay layer.** Whether the renderer has an existing overlay/decoration pass between tiles and units, or whether we're adding one. Cliff edges + corner stack markers live here.
- **Pipeline structural equivalence.** Compare `DEFAULT_DAMAGE_PIPELINE` and `DEFAULT_TEST_DAMAGE_PIPELINE` field by field; the equivalence test enforces what audit observes.

### Architectural decisions

After the audit:

1. **Jump-over-water leap generation.** Two reasonable shapes:
   - **A — Expand-time generation.** During Dijkstra expansion of each visited node, generate the four cardinal leap candidates in addition to standard adjacency. Each leap edge is `(currentTile, leapDest, cost=2)` where `leapDest` is the cardinal-two-steps-away tile and the intermediate is water + leapDest is land. Adds ~4 candidates per node.
   - **B — Pre-computed leap edges.** Before Dijkstra, scan the map for all (water-tile, adjacent-land-pair) configurations and store as additional graph edges; pathfinder consumes the augmented graph.
   
   **Recommendation: A.** Smaller blast radius; no graph-state to maintain; matches the "compute at query time" pattern from `MovementProfile`.

2. **Pre-battle action-source variant.** `source: 'pre_battle_equipment'` per the roadmap entry, OR a broader `source: 'system'` with a `kind: 'pre_battle_equipment_grant'` sub-field. Two reasonable shapes:
   - **A — Distinct top-level source.** Adds a third variant to the existing source discrimination (`player`, `system`, `pre_battle_equipment`).
   - **B — Sub-discriminant on existing `system` source.** `system` remains the source, with a sub-field carrying the pre-battle-equipment context.
   
   **Recommendation: B.** Pre-battle equipment grants are conceptually `system`-issued; the sub-discriminant keeps the action-source surface narrow. Action-log readability uses the sub-field for "Tintinibar grants Regen" framing.

3. **Orchestrator pre-battle pass shape.** Two reasonable shapes:
   - **A — Inline in `createInitialState` returning a pre-completed state.** The pre-battle action sequence runs synchronously inside initialization.
   - **B — Separate orchestrator phase.** `createInitialState` produces a raw state; orchestrator runs the pre-battle action queue before turn 0 fires; state visible mid-sequence to consumers (action log captures every grant).
   
   **Recommendation: B.** Per CLAUDE ground rule 3 (state changes flow through reducers); per the roadmap's framing ("orchestrator runs the pre-battle action sequence... before turn 0 fires"). Action log carries the initial grants from sequence 0; replay determinism preserved.

4. **Initial CT randomization fold-in.** Per the roadmap note: "initial CT randomization (Cluster 2's Item 13) may want to also run through the reducer here as a `system_set_ct` action." Two paths:
   - **A — Fold in.** Initial CT runs through reducer as `system_set_ct` action. Symmetric with Item 17's grants-as-actions pattern. Replay-deterministic from sequence 0.
   - **B — Stay as direct state mutation.** Initial CT is a one-shot randomization at battle creation; the only "interesting" action-log entry would be redundant.
   
   **Recommendation: A.** Consistency with Item 17's framing; replay determinism uniform from start; future content that wants to read or hook the initial CT distribution can do so via the action log.

5. **Water Mage M-ability gap check.** Audit confirms whether the per-tile move-cost reduction hook is present and wired. If yes: no action this session. If no: scope addition — small substrate seam to add the hook + wire the Water Mage M-ability through it. Surfaces in plan-review.

6. **Cliff-edge thickness scaling.** Three reasonable shapes:
   - **A — 1 pixel per elevation-delta tier**, capped at 3px (delta 4+ stays at 3px).
   - **B — Categorical tiers**: 1px for delta 1; 2px for delta 2-3; 3px for delta 4+.
   - **C — Continuous scaling**: 1px per delta with no cap (delta 7 = 7px cliff face).
   
   **Recommendation: B.** Categorical reads cleanly without visual noise; River Ridge's two test scenarios (gentle 1-elev rise along the ridge mid-section, sharp 5-7 drop from ridge to flat) both surface clearly. A discriminates less between gentle and moderate slopes; C produces dramatic and possibly disruptive visuals at the cliff-perch edge.

7. **Corner stack marker scaling.** Elevation range 0-9 in River Ridge spans too much for 1-marker-per-level. Three reasonable shapes:
   - **A — Categorical tiers**: no marker for elevations 0-2; 1 marker for 3-4; 2 markers for 5-6; 3 markers for 7-8; 4 markers for 9+.
   - **B — Linear with cap**: 1 marker per level above 2, capped at 5 markers (elevations 7+ all show 5 markers).
   - **C — Numerical glyph**: tiny 3-5px number in the corner showing actual elevation. More information-dense but reads as text.
   
   **Recommendation: A.** Bins River Ridge's range cleanly (foot of ridge = 1 marker, mid-climb = 2, sharp jump = 3, perch = 4). Tile info panel covers precise values. Less visual clutter than B; less text-like than C.

8. **Cliff-edge color derivation.** Two shapes:
   - **A — Darker shade of higher tile's primary palette color.** Cliff face reads as part of the same material (grass cliff vs rock cliff vs sand cliff).
   - **B — Generic neutral dark gray** for all cliffs.
   
   **Recommendation: A.** Visual cohesion; cliff face material identity. Audit confirms whether tile-palette extraction is straightforward in the renderer.

9. **Cliff-edge rendering location.** Overlay pass between tile sprites and unit sprites. Renderer iterates tiles; for each, checks four cardinal neighbors via map data; draws cliff strips where elevation differs. **Note:** if no such overlay pass exists, this session adds one (small addition).

10. **Rendering scope: S32 or S33?** The roadmap separates substrate (S32) from content (S33). The elevation rendering is substrate (renderer changes) but only meaningfully tested against real elevation variance (River Ridge in S33). Two paths:
    - **A — Ship in S32 with synthetic test maps for verification.** Rendering substrate lands here; visual verification via test fixtures or a small elevation-variant Training Field variant.
    - **B — Defer rendering to S33** alongside River Ridge content authoring. Substrate decisions captured here, implementation lands there.
    
    **Recommendation: B for the implementer's plan-review consideration.** The rendering pairs naturally with the content that exercises it; S33 grows from small-to-medium to medium (more balanced); S32's substrate scope stays focused. **Per Chris's call**, the brief includes rendering in scope; implementer decides at plan-review whether to ship here or defer.

11. **Test strategy.**
    - **Substrate:** unit tests for jump-over-water leap generation (correct candidates produced, costs correct, `Jump ≥ 1` requirement enforced); integration test for knockback-into-water (Item 16 specific scenario); unit tests for pre-battle action source variant; orchestrator pre-battle pass integration tests.
    - **Rendering (if shipped here):** snapshot tests for cliff-edge overlay (synthetic test map with elevation variance); unit tests for corner-stack-marker scaling against decision 7's categorical tiers.
    - **Defensive:** structural-equivalence test for the two damage pipelines.

12. **Order of work.** Substrate first (Items 15-17 + orchestrator pre-battle pass) — these gate Session 33's content. Then defensive add (structural-equivalence test). Then rendering if shipped here. Each step gates on prior tests passing.

13. **32a/32b split allowance.** If rendering is folded in and surface area balloons:
    - **32a:** Engine substrate (Items 15-17 + orchestrator pre-battle pass) + defensive add. Strict roadmap-aligned scope.
    - **32b:** Rendering substrate (cliff edges + corner stack markers) + any S31.5 carry-forward folds (e.g., Water Mage M-ability gap if surfaces).
    
    **Likely no split needed if rendering defers to S33** per decision 10.

The plaintext plan is reviewed before code lands.

## Implementation work

Following plan approval, items land roughly in this order: substrate first, then defensive, then rendering (if shipped here).

### Item 1: Jump-over-water pathfinding (Item 15)

- Dijkstra expansion: at each visited node, generate four cardinal two-step leap candidates
- Leap eligibility: intermediate tile is water (elevation 0 or 1); destination is land (elevation ≥ 2); cardinal direction only; `Jump ≥ 1` on the moving unit
- Cost: 2 move points per leap
- Tests: correct leap candidates produced; respect Jump requirement; respect water-then-land constraint; cardinal-only constraint
- Regression: existing pathfinding produces same results on land-only maps

### Item 2: Knockback-into-water verification (Item 16)

- Integration test: ridge-elev-7-into-shallow-water-elev-1 case
- Asserts: unit's resolved position is the water tile; `dropDistance = 6`; correct `system_damage` entry for fall damage
- No substrate change expected (per River Ridge engine requirement — substrate exists); this is the proof-of-end-to-end

### Item 3: Pre-battle equipment auto-status as logged actions (Item 17)

- Reroute `applyEquipmentStatusGrants` to enqueue `system_apply_status` via `commitAction`
- New action-source sub-discriminant per decision 2: `source: 'system'` with sub-field for pre-battle context
- Action log captures sequence 0 forward
- Tests: pre-existing Tintinibar / Sorcerer's Robe loadouts produce identical end-state with logged grants; new tests verifying the grants appear in action log with correct attribution

### Item 4: Orchestrator pre-battle setup pass

- New phase between `createInitialState` and turn 0
- Runs pre-battle action queue (Item 17's grants; Item 8 if decision 4 lands on A)
- State visible mid-sequence to action-log consumers
- Tests: end-to-end orchestrator runs pre-battle pass before turn 0; action log reflects grants in sequence; existing battle behavior unchanged downstream

### Item 5: Initial CT randomization as `system_set_ct` action

- If decision 4 lands on A: route initial CT through reducer as logged action
- If decision 4 lands on B: document the call in the brief's "considered and rejected"

### Item 6: `DEFAULT_TEST_DAMAGE_PIPELINE` structural equivalence

- New test asserting structural equivalence (or forwarding) between `DEFAULT_DAMAGE_PIPELINE` and `DEFAULT_TEST_DAMAGE_PIPELINE`
- Tiny defensive add; prevents the next test-fixture-lagged-production class of bug

### Item 7: Water Mage M-ability gap closure (conditional on audit)

- If audit reveals the hook is missing: add hook in per-tile move-cost resolution chain; wire Water Mage M-ability through it
- If hook exists: regression test confirming M-ability composes correctly with water-tile costs

### Item 8: Cliff-edge overlay layer (if ships here)

- New rendering pass between tile sprites and unit sprites
- For each tile, read four cardinal neighbor elevations from map data
- For each lower neighbor, draw cliff strip on shared edge per decisions 6 and 8
- Lighting convention: upper-left lit
- Tests: snapshot tests against synthetic elevation-variant test map; rendering produces expected strip thicknesses at categorical tier boundaries

### Item 9: Corner stack markers (if ships here)

- Renderer overlay component drawn in tile top-right corner
- Marker count derived from elevation per decision 7's categorical bins
- Opacity 25-30%; consistent palette
- Tests: marker count correct per elevation; rendering doesn't conflict with other top-right tile decorations

## Acceptance criteria

**Engine substrate:**

- Pathfinder produces jump-over-water leap candidates correctly: intermediate water, destination land, cardinal only, `Jump ≥ 1` required, cost 2.
- Knockback-into-water integration test passes: dropDistance 6, system_damage entry correct.
- Equipment auto-statuses appear in action log with `source: 'system'` (sub-discriminated to pre-battle context); pre-existing end-state behavior unchanged.
- Orchestrator runs pre-battle pass between init and turn 0; action log shows grants in sequence 0+.
- (If decision 4 = A) Initial CT randomization appears in action log as `system_set_ct` entry.
- Water Mage M-ability composes correctly with water-tile move costs (regression or new wiring per audit).

**Rendering (if shipped here):**

- Cliff edges render correctly on synthetic elevation-variant test map; strip thicknesses follow decision 6's tiers; lighting consistent.
- Corner stack markers render per decision 7's categorical bins on the same test map.
- No regression in existing rendering (Training Field battle launches cleanly with no cliff/marker artifacts since elevations are uniform).

**Defensive:**

- `DEFAULT_DAMAGE_PIPELINE` ↔ `DEFAULT_TEST_DAMAGE_PIPELINE` structural-equivalence test passes.

**Quality:**

- Tests at 859+, 0 failing. New tests proportional to substrate and (if shipped) rendering.
- ADRs written for pre-battle action-source pattern; cliff-edge rendering convention if rendering ships.
- `docs/handoff.md` updated.

## Out of scope

- **River Ridge map authoring** — Session 33 per the roadmap.
- **Title screen, battle setup, team builder, deployment phase UI** — Phase E (Sessions 34-37).
- **Walk-on-Water passive** — flagged "future" in River Ridge doc; not v1.
- **Future terrain types** (swamp, ice, sand) — per the design doc's "extensible" framing; not v1.
- **Hit-chance and cover modifiers from elevation differential** — `map-and-battlefield.md` open question; future tuning.
- **Friendly pass-through during movement** — `map-and-battlefield.md` open question.
- **Forced movement collision** — `map-and-battlefield.md` open question; not v1.
- **Trigger tile semantics** — `map-and-battlefield.md` open question.
- **AoE multi-layer behavior** — `map-and-battlefield.md` open question.
- **Straight-line LoS tie-breaking, unit-blocking-LoS** — `map-and-battlefield.md` open questions.
- **Magus Crown +5 MA / +25% MP cost tighteners** — calibration carry-forward.
- **Tooltip Option B authored-description pass** — post-current-roadmap.
- **AI active absorption exploitation** — Session 27 carry; tactics-layer pass deferred.
- **Polish #5 statuses portion** — S31.5 carry; deferred.
- **`UnitVisualSnapshot.maxHp` field cleanup** — S31.5 carry; low priority.
- **Surrender flow, MVP-unit algorithm, permadeath timer, settings expansion, reactions in projection column** — Phase E/F.

## Files likely touched

Non-exhaustive. Audit confirms / corrects.

**Engine substrate:**

- `src/engine/move/pathfinding.ts` (or equivalent) — jump-over-water leap generation
- `src/engine/move/move-engine.ts` (or equivalent) — Water Mage M-ability gap closure if needed
- `src/engine/initialization.ts` (or wherever pre-battle setup lives) — Item 17 reroute
- `src/engine/actions/types.ts` — pre-battle action source sub-discriminant
- `src/engine/actions/reducers.ts` — `system_apply_status` accepts new source variant
- `src/app/demo/orchestrator.ts` — new pre-battle phase

**Rendering (if shipped here):**

- `src/renderer/` — new cliff-edge overlay pass, corner stack marker component
- `src/renderer/constants.ts` — lighting direction, thickness tiers, marker opacity defaults

**Tests:**

- `src/engine/move/pathfinding.test.ts` — leap generation tests
- `src/engine/actions/session-32-integration.test.ts` — knockback-into-water + pre-battle pass tests
- `src/engine/actions/initial-state.test.ts` — pre-battle pass end-to-end
- `src/content/rulesets/default.test.ts` — structural equivalence assertion
- `src/renderer/` snapshot tests (if rendering ships here)

**ADRs:**

- `docs/decisions/0071-pre-battle-action-source.md` (or next available)
- `docs/decisions/0072-cliff-edge-rendering.md` (if rendering ships here)

**Documentation:**

- `docs/handoff.md` — session handoff

## Workflow notes

- **Plaintext-first review required.**
- **Audit-first within the plan.** Particularly important for: the Water Mage M-ability gap check (decision 5); the renderer's existing overlay layer support (decision 9); the pre-battle setup's current call sites (Item 17's "snowball" risk per roadmap).
- **ADR path is `docs/decisions/`**.
- **Substrate before defensive before rendering.** Items 15-17 + orchestrator pass gate Session 33; defensive add comes after substrate is stable; rendering ships last (or defers to S33 per decision 10).
- **Mid-session design questions** route through Chris to the planner. Most likely surfaces: pre-battle source-variant shape (decision 2); orchestrator phase boundaries (decision 3); initial CT fold-in (decision 4); Water Mage M-ability audit outcome (decision 5); rendering scope-and-ship-here vs defer (decision 10).
- **Pre-flight verification:** confirm Session 31.5 polish carry-forwards still pass; demo battle still launches with existing equipment loadouts.
- **No new content milestones this session.** Phase D substrate is the milestone; Session 33 ships River Ridge content; Phase E ships pre-battle UI.

## Watch-fors

**Addressed this session:**

- Jump-over-water pathfinding (Cluster 6 Item 15 — roadmap-flagged)
- Knockback-into-water end-to-end verification (Cluster 6 Item 16)
- Pre-battle equipment auto-status as logged actions (Cluster 6 Item 17)
- Orchestrator pre-battle setup pass (roadmap-flagged)
- Initial CT randomization fold-in or rejection (decision 4)
- `DEFAULT_TEST_DAMAGE_PIPELINE` structural-equivalence (S31.5 carry-forward)
- Doc path convention applied (`docs/design/` for design docs; `docs/twentyOnePlanning/` for planning docs)
- Elevation rendering substrate (cliff edges + corner stack markers) — ships here or defers to S33 per decision 10
- Water Mage M-ability gap closure if audit surfaces the gap (decision 5)

**Not addressed this session, longer-term carry-forward:**

- **River Ridge map content authoring** — Session 33
- **Pre-battle UI surfaces** — Sessions 34-37
- **Walk-on-Water passive** — future content
- **`map-and-battlefield.md` open questions** — multiple deferred per `Out of scope`
- **Polish #5 statuses portion** — S31.5 carry; future polish
- **`UnitVisualSnapshot.maxHp` field cleanup** — S31.5 carry
- **Wand swing ally-targetability** — S31 deferral
- **AI active absorption exploitation** — S27 carry
- **AI projection forecast extension via `computeOutgoingHitChance`** — S30 carry
- **Procced spell uses caster's MA** — S30/S31 carry; ongoing playtest read
- **Magus Crown +5 MA / +25% MP cost tighteners** — calibration carry
- **Burn × Purifier playtest** — one-off battle setup needed
- **Tintinibar Regen tuning** — initial read reasonable; ongoing
- **Sorcerer's Robe Move +1 playtest read** — initial read reasonable; ongoing
- **Status-badge polarity convention extension** — chip pre-icons if status lists grow (S31.5 carry)
- **Team color palette → engine `Team` shape** — long-term
- **Tooltip Option B authored-description pass** — post-current-roadmap
- **`onTurnStart` symmetric widening** — S26 carry; defer until emitter
- **Multiplicative tick-amount stacking** — S28 carry; no v1 case
- **`onFinalDamage` fires on absorbed hits but handlers gate** — design pattern
- **Forecast facing uses actual attacker→target geometry** — S30 carry
- **Unit detail panel's per-facing evasion uses `unit` as attacker stand-in** — S30 carry
- **Item #5 pacing constants** — S26.5 carry; tuning pending
- **Constant-map labels don't carry icons today** — S28 polish
- **`pa_factor` NotYetImplementedError** — audit E3
- **TS strict-mode test errors** — audit E8
- **Surrender flow** — S34 / ADR-0041
- **MVP-unit smarter algorithm** — S24 Wave 1
- **Permadeath timer** — S24 Wave 1
- **Settings expansion** — S24 Wave 1
- **Reactions in projection column** — S24 Wave 1
- **Bedrock Stride fall-immunity** — Session 33 surfaces
- **Forecast accuracy row visibility** — S30 reject; revisit if confusion surfaces
- **Future terrain types** (swamp, ice, sand) — design-doc extensible
- **Hit-chance and cover modifiers from elevation differential** — `map-and-battlefield.md` open question

## Estimated size

**Medium-to-large.** Per roadmap framing (Items 15-17 + orchestrator pre-battle pass), with the snowball risk on Item 17 (the auto-status reroute's call-site spread). Adding rendering substrate (if shipped here per decision 10) pushes the upper bound. Defensive add is trivial.

**32a/32b split allowance:** if rendering is folded in AND Item 17's snowball materializes:

- **32a:** Engine substrate only (Items 15-17 + orchestrator pre-battle pass + defensive add). Roadmap-aligned strict scope.
- **32b:** Rendering substrate (cliff edges + corner stack markers) + Water Mage M-ability gap closure if surfaces.

**Recommendation (per decision 10):** defer rendering to S33 where it pairs with content; keep S32 focused on substrate. Per Chris's call, the brief includes rendering in scope; implementer makes the final call at plan-review.

**Equipment-complete milestone holds.** Phase D substrate milestone reached at session end. Session 33 ships River Ridge content per the roadmap.
