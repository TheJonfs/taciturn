# Session 26 Brief: Movement Abilities + Terrain Texture Infrastructure + Content Tweaks

## Context

Phase B continues. Session 25 closed out Cluster 2 substrate (availability tag, deploymentZone field, uniform_int initial CT) with the post-MVP UI fold-ins. The substrate is in place; this session adds the content that consumes it (four new movement abilities authored against the `availability` field) plus the terrain texture infrastructure that will eventually replace the current colored-tile rendering with painted variants. A small AoE shape consistency pass settles a design intuition Chris flagged in the post-25 playtest. And `docs/content-snapshot.md` gets its long-deferred refresh now that there's a stable content state to capture.

This is a content-heavy session with a renderer-side infrastructure component. Smaller than the architecturally-heavy MVP sessions, larger than pure-content sessions because of the terrain texture work.

## Inputs (read first)

In recommended order:

1. **`CLAUDE.md`** — project conventions.
2. **`docs/handoff.md`** — Session 25 handoff. Note especially the bulk-tagged content inventory (which abilities are `'available'` vs `'hidden'`); new movement abilities go into the available set.
3. **`docs/twentyOnePlanning/roadmap-sessions-21-plus.md`** — Session 26 entry; Session 27 entry for context on what's downstream.
4. **`docs/twentyOnePlanning/mage-war-content-spec.md`** — Section "Movement" within the R/S/M ability costs table contains the spec for the four new movement abilities. Section "Active abilities" contains the AoE shape entries to be tweaked.
5. **`docs/adr/ADR-0048-portrait-integration.md`** — primary pattern reference for terrain texture infrastructure. Same async load + sprite-attach + fallback approach.
6. **`docs/content-snapshot.md`** — currently drifted from source-of-truth (last accurately reflecting post-Session-20b state); to be refreshed this session.

### Paths to survey before planning

Current-tree audit required. At minimum survey:

- `src/content/abilities/` — for ability authoring patterns (look at existing movement abilities like `move_plus_1`, `bulwark_stance`, `float`, `fly` for structure reference)
- `src/content/classes/` — for `freeAbilities` lists per class
- `src/engine/catalog/definitions/ability.ts` (or wherever movement-ability shape is defined) — for the supported effect shapes
- `src/engine/abilities/` — for shape definitions and any aoe-shape resolver code
- `src/content/abilities/earth-quake.ts`, `earth-cataclysm.ts`, `fire-storm.ts` — for the AoE shape tweaks
- `src/content/abilities/aether-bloom.ts` (or wherever it lives) — verify the `modifyAoeShape` rule is shape-agnostic radius-increment
- `src/assets/portraits/index.ts` and consumers — primary pattern reference for terrain texture loader
- `src/renderer/tile-layer.ts` — for current tile rendering approach and where texture support slots in
- `src/renderer/battle-renderer.ts` — for the asset-load orchestration pattern from portraits
- `docs/content-snapshot.md` — for the format and structure of the snapshot doc

The plan articulates what exists, what's being refit, what's being added.

## Goal

End state:

- Four new movement abilities authored: `bedrock_stride` (Earth), `hotfoot` (Fire), `tidewalker` (Water), `quickstep` (Lightning). Each declared with `availability: 'available'`, costed per spec, and added to the corresponding class's `freeAbilities` list.
- AoE shape consistency: `earth_quake`, `earth_cataclysm`, and `fire_storm` shift from cross-r1 to diamond-r1. Aether Bloom's `modifyAoeShape` rule verified to handle diamond shapes correctly (the change manifests when Aether Bloom expands fire_storm to diamond r2 = 13 tiles vs the previous cross r2 = 9 tiles).
- Terrain texture loading infrastructure: mirrors the portrait pattern. `src/assets/terrain/` directory + manifest, async load, deterministic per-tile variant selection, graceful fallback to current colored tile rendering when textures absent. Infrastructure ships before assets — Chris's grass textures slot in when ready.
- `docs/content-snapshot.md` refreshed: reflects current content state post-Sessions 21-25.

Tests at 679+, 0 failing. New ability behaviors covered, AoE shape tests updated, terrain texture loader has variant-selection determinism test.

## Pre-implementation plan (required)

Same discipline as Sessions 22-25.

### Required first step: current-tree audit

For each surface this session touches: what exists, what state it's in, what this session does to it.

### Architectural decisions

After the audit:

1. **Movement ability effect shapes.** Each of the four abilities has a specified effect signature:
   - `bedrock_stride` — `modifyStatQuery` +1 to moveRange; `modifyDamageReceived` immune to fall damage. Verify both effect types are already in the catalog's effect vocabulary.
   - `hotfoot` — `modifyStatQuery` +1 to moveRange, +1 to speed. Both effects already in vocabulary.
   - `tidewalker` — water tile cost -1 (minimum 1). New effect type or extends existing pattern? Audit confirms.
   - `quickstep` — `onTurnEnd`: if a Move action was committed this turn, refund `MA` CT. Mirrors `flow_state`'s structure but Move-axis. Verify the action-classification hook exposes whether the turn included a Move.
   
   State each ability's implementation approach, including whether any new effect-type plumbing is required.

2. **`tidewalker`'s "minimum 1" clamp.** Tidewalker reduces water tile cost by 1, but never below 1. State where the clamp lives — at the cost-modifier hook (clamp result), at pathfinder consumption, or in the ability's own effect.

3. **`quickstep`'s "if a Move action was committed" trigger.** Audit reveals how `flow_state` does its equivalent for magical actions. Quickstep follows the same pattern. State the action-classification check.

4. **AoE shape tweaks.** Three content files change shape declarations from cross-r1 to diamond-r1. Verify Aether Bloom's enlargement rule is shape-agnostic (increments radius regardless of shape kind). If hard-coded to cross-shape, fix that too — Aether Bloom should produce diamond r2 from a diamond r1 base, cross r2 from a cross r1 base (which no v1 content currently uses, but the rule should be general).

5. **Terrain texture loading infrastructure.** Mirrors ADR-0048's portrait pattern:
   - `src/assets/terrain/` directory + manifest module
   - Vite URL imports for each variant
   - Async load kicked off in `BattleRenderer.mount` for terrain types present on the loaded map
   - Deterministic per-tile variant selection (hash `(masterSeed, tile.x, tile.y)` into variant index)
   - Tile sprite gains an optional texture; rendering falls back to current colored fill if texture absent
   - Manifest declares which terrain types have textures available
   
   State the manifest shape, naming convention enforcement, and the texture-pick determinism function.

6. **Manifest shape.** Naming convention: `<terrain-type>-<NN>.png` (e.g., `grass-01.png`, `grass-02.png`). State whether manifest is a static module export (one per terrain type with array of variants) or scan-based. Default to static export — explicit and inspectable.

7. **Fallback behavior.** When no texture is available for a tile's terrain type, TileLayer falls back to its current colored-fill rendering. This is the in-progress state for v1 — grass might have 4 variants while stone-ridge has none yet; the renderer handles both cleanly.

8. **Content snapshot refresh approach.** Read current state of `src/content/` and produce an updated `docs/content-snapshot.md` reflecting post-reconciliation stat baselines, Brave/Faith 70/70, spell power coefficients, R/S/M costs, free abilities per class, availability tags, and all content additions from Sessions 21-26. State whether the refresh is hand-written or could plausibly be tool-assisted.

9. **Test strategy.** Movement abilities each get a unit test verifying their effect resolves correctly. AoE shape tweaks covered by existing aoe-shape regression tests (extend if needed). Terrain texture loader gets a determinism test. State coverage plan.

The plaintext plan is reviewed before code lands.

## Implementation work

Following plan approval, items land roughly in this order: content first, then infrastructure, then documentation.

### Item 1: Movement ability authoring

Four new ability files in `src/content/abilities/`:

- `bedrock_stride`: Move +1, fall-damage immunity. Cost 2. `availability: 'available'`. Earth Mage's class-free passive.
- `hotfoot`: Move +1, Speed +1. Cost 2. `availability: 'available'`. Fire Mage's class-free passive.
- `tidewalker`: Water tile cost -1 (min 1). Cost 1. `availability: 'available'`. Water Mage's class-free passive.
- `quickstep`: onTurnEnd refund MA CT if Move committed. Cost 1. `availability: 'available'`. Lightning Mage's class-free passive.

Class file `freeAbilities` lists updated.

### Item 2: AoE shape tweaks

Three content edits:
- `earth_quake`: cross r1 → diamond r1
- `earth_cataclysm`: cross r1 → diamond r1
- `fire_storm`: cross r1 → diamond r1

Aether Bloom rule verified to handle diamond shapes correctly. If a shape-specific bug surfaces, fix it.

AoE shape regression tests updated. At r1 the tile sets are identical to before (5 tiles in a plus); the test should still pass for tile-set equivalence. New test cases recommended for Aether-Bloom-enlarged shapes to verify the diamond r2 outcome (13 tiles) for fire_storm.

### Item 3: Terrain texture loading infrastructure

Mirrors ADR-0048's portrait pattern. Concrete deliverables:

- `src/assets/terrain/` directory with `index.ts` exporting a `TERRAIN_MANIFEST` keyed by terrain type
- Vite URL imports prepared for manifest entries
- `BattleRenderer.mount` extended to kick off async load for each terrain type present on the loaded map's tiles
- `TileLayer` rendering refit: each tile checks for an available texture (via manifest + deterministic variant pick) and renders accordingly; falls back to current colored fill when no texture available
- Texture-pick determinism: hash function over `(masterSeed, tile.x, tile.y)` produces a variant index modulo variant count

Fallback ensures the renderer works identically to current behavior until Chris's terrain assets land.

### Item 4: Content snapshot refresh

`docs/content-snapshot.md` updated to reflect current state post-Sessions 21-25. Sections to cover:
- Stat baselines (L25 targets from spec)
- Brave/Faith defaults (70/70)
- Class identities + class-free passives (including the new movement abilities)
- Active abilities per class with current power coefficients
- R/S/M abilities with current costs and availability tags
- Equipment items (visible + hidden)
- Status effects in v1 use
- Resistances per class (baseline elemental wheel)

## Acceptance criteria

- Four new movement abilities authored, costed correctly, tagged available, in their classes' `freeAbilities`.
- AoE shape tweaks landed: earth_quake, earth_cataclysm, fire_storm now diamond r1. fire_storm + Aether Bloom verified to produce diamond r2 (13 tiles).
- Terrain texture infrastructure landed: manifest module, renderer-side loading orchestration, deterministic variant pick, fallback to current rendering when textures absent.
- `docs/content-snapshot.md` refreshed and accurate against current code state.
- Tests at 679+, 0 failing.
- ADRs written for: terrain texture infrastructure (mirroring ADR-0048's structure); any non-obvious choices in movement ability effect plumbing.
- `docs/handoff.md` updated.

## Out of scope

These items are tracked for the upcoming dedicated polish pass (likely Session 26.5 between this session and Session 27 Cluster 3 work):

- Tile-info corner overlay
- Portrait restructure: black-bg + outside ring
- Charged-action timing projector accuracy improvement
- QueueTower slot-in for charged-action resolves
- Charged-action animation pacing
- WAIT-CONFIRM keyboard support
- Mini-timeline for forecast Timing subsection

Other items explicitly deferred:

- Actual terrain texture assets (Chris is producing in parallel; infrastructure must not block on asset arrival)
- Cluster 3 engine hook surfaces (Session 27)
- River Ridge terrain types (stone-ridge, shallow-water, deep-water) — manifest supports them in principle, variants come when art does

## Files likely touched

- New `src/content/abilities/bedrock-stride.ts`, `hotfoot.ts`, `tidewalker.ts`, `quickstep.ts`
- `src/content/classes/earth-mage.ts`, `fire-mage.ts`, `water-mage.ts`, `lightning-mage.ts` — `freeAbilities` extension
- `src/content/abilities/earth-quake.ts`, `earth-cataclysm.ts`, `fire-storm.ts` — shape declarations
- `src/content/abilities/aether-bloom.ts` (or wherever) — verify rule, possible fix
- AoE shape regression test file — test updates
- New `src/assets/terrain/` directory + `index.ts`
- `src/renderer/battle-renderer.ts` — async load orchestration
- `src/renderer/tile-layer.ts` — texture rendering + fallback
- Possible new effect-type plumbing (`modifyTerrainCost`, fall-damage immunity) if not already in vocabulary
- `docs/content-snapshot.md` — refresh
- New ADRs in `docs/adr/`
- `docs/handoff.md` — updated

## Workflow notes

- Plaintext-first review required. Same discipline as previous sessions.
- Audit-first within the plan. Particularly important for confirming effect-type vocabulary.
- Terrain infrastructure follows portrait pattern. ADR-0048 is the reference. Implementer should explicitly note any deviation from the portrait pattern in the new ADR.
- Aether Bloom rule verification is small but load-bearing. Audit and confirm.
- Mid-session design questions route through Chris to the planner. Most likely surfaces: effect-type plumbing for `tidewalker` (terrain cost modifier), `bedrock_stride`'s fall immunity hook shape if new.
- Content snapshot refresh discipline: the doc should reflect what's actually true, not what's planned. If the refresh surfaces discrepancies between code state and spec, flag via handoff.

## Watch-fors

**Addressed this session:**
- Movement abilities authoring
- AoE shape tweaks (post-Session-25 playtest finding)
- Terrain texture infrastructure
- Content snapshot refresh (Session 21 carry-forward)
- Aether Bloom shape-agnostic rule verification

**Tracked for upcoming polish pass (tentatively Session 26.5):**
- Tile-info corner overlay
- Portrait restructure: black-bg + ring-outside-portrait
- Charged-action timing projector accuracy
- QueueTower slot-in for charged-action resolves
- Charged-action animation pacing
- WAIT-CONFIRM keyboard support
- Mini-timeline for forecast Timing subsection

**Not addressed this session, longer-term carry-forward:**
- Top bar `Turn T####` is O(actionLog.length)
- Renderer's MP "max" captured at mount (Session 28 lifts)
- Status-badge polarity convention
- rAF vs setInterval for animation drain
- AoE preview correctness across all shapes (extended this session)
- MP / status snapshot ahead-of-tween fix
- Resistance composition cap at 100 (audit E2; Session 27)
- `pa_factor` NotYetImplementedError (audit E3)
- `equipmentContributionsFor` "branch per hook" (audit E4; Session 27)
- TS strict-mode test errors (audit E8)
- Surrender flow (Session 34)
- MVP-unit smarter algorithm
- Permadeath timer
- Settings expansion
- Reactions in projection column
- Bug 1 (Session 24.5 ADR-0046): mid-battle targeting failure; instrumentation in place, no recurrence in Session 25 playtest
- Portrait asset sizes (~4MB each) — pre-release pipeline candidate
- Vite HMR cache invalidation occasional issue
- Hardcoded team color palette across three sites (Session 25 carry)

## Estimated size

Medium. Movement ability authoring is mechanical (4 small content files + 4 class file extensions). AoE shape tweaks are trivial. Terrain texture infrastructure is the largest single item — small-to-medium on its own following the portrait template. Content snapshot refresh is documentation but voluminous if hand-written. No split should be needed; if it is, natural lines are content authoring + AoE tweaks as 26a, terrain infrastructure + snapshot refresh as 26b.
