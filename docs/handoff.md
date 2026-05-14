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

## From session 2026-05-13 (Session 33 — River Ridge content + terrain-tag abstraction + corner stack markers)

Session 33 shipped Phase D content: River Ridge (the first authored Mage War battlefield) end-to-end on the runtime, the terrain-tag abstraction substrate (ADR-0073) that lets Tidewalker / Float compose without enumerating water variants, the long-promised `defaultTerrainCosts` merge in `computeMovementProfile`, a load-time map validator, corner stack markers (in-session decision to ship), and the renderer's water-terrain texture wiring. **Tests: 960 passing across 80 files, 0 failing** (up from 887 across 73). One new ADR (0073).

### Scope completed

**Engine substrate (ADR-0073):**

1. **Terrain tag registry.** `src/engine/map/terrain-registry.ts` ships the `TerrainTag` / `TerrainRegistry` types + four helpers (`terrainHasTag`, `terrainsWithTag`, `mapTerrainCostsByTag`, `addTerrainsWithTag`). The registry is a top-level field on `RulesetDefinition` (`ruleset.terrain.tags`); the default ruleset registers `ground` → `['land']`, `water_shallow` → `['water', 'shallow']`, `water_deep` → `['water', 'deep']`. The hook surface (`modifyCanEnter`, `modifyTerrainCosts`) widened to pass `terrainRegistry` to handlers; the runners source it from `catalog.getRuleset(state.ruleset.id).terrain.tags` internally so existing callers stay unchanged.

2. **`defaultTerrainCosts` honored.** `computeMovementProfile` now merges ruleset's `defaultTerrainCosts` with the class baseline (class entries override ruleset for the same terrain) before the hook chain fires. Default ruleset populates `{ water_shallow: 2, water_deep: 3 }`. Tidewalker reduces both; Float adds both to canEnter via tag.

3. **Tidewalker + Float reworked.** Both keyed on literal `'water'` pre-S33; now register against the `'water'` tag via the helpers. One-liner handlers; forward-compatible with future water variants.

4. **Universal water-enter convention (mid-session correction).** Every production class baseline (Knight, Earth Mage, Fire Mage, Lightning Mage, Water Mage) now has `canEnter: { ground, water_shallow, water_deep }`. Water is universally enterable; **cost** is the tactical gate (water_shallow 2 mp, water_deep 3 mp baseline; Tidewalker -1 floor 1). Matches the design doc's "Knockback Into Water" framing ("they escape on subsequent turns at standard water-tile cost"): anyone can be in water, just at penalty cost. This was a course-correction after the initial S33 implementation locked water_deep out of canEnter for all but Float-equipped units — the math then refused to let the Water Mage reach the first deep-water square going west, which violated the design intent. **Side effect on Float:** under the new convention, Float's historical role (open water for ground-only classes) doesn't differentiate against the default catalog. Float remains as substrate (the tag-based modifyCanEnter chain still composes) and stays `availability: 'hidden'`. See "Limitations + watch-fors" for Float's redesign status.

5. **Map validator.** `src/engine/map/map-validator.ts` ships a load-time sanity check (terrain in registry, elevation ≥ 0, in-bounds, no duplicate positions, deployment zones present per team). Returns structured errors; `assertMapValid` throws with all errors bundled.

**Content:**

6. **River Ridge map.** `src/content/maps/river-ridge.ts` authors the 14×14 grid per the design doc. Elevations 0-9 with terrain derived (elev 0 → water_deep, elev 1 → water_shallow, elev ≥2 → ground). Deployment zones: Blue (team_a) rows 0-2 cols 5-8, Red (team_b) rows 11-13 cols 5-8, both at elev 2 flat ground.

7. **River Ridge battle config.** `src/content/battles/river-ridge-battle.ts` derives from `demoBattle` and restages the 6 demo units in their respective zones (Blue at the north zone's front; Red at the south zone's front). Same loadouts and equipment as the Training Field battle — only the map and starting positions change.

8. **BattleView default.** `BattleView.tsx` now points at `riverRidgeBattle` (replacing `trainingFieldBattle`). Training Field stays as content (the 14×14 flat ground map) plus `demoBattle` as the engine smoke-test fixture (orchestrator + AI integration tests).

**Renderer:**

9. **Terrain texture manifest.** `src/assets/terrain/index.ts` registers `water_shallow` and `water_deep` with their three-variant PNG pools (already on disk pre-S33; now wired). `TERRAIN_COLORS` gains palette entries for both so the colored-rect fallback reads sensibly before textures load.

10. **Corner stack markers (in-session decision).** New `CornerStackMarkerLayer` ships in `src/renderer/corner-stack-marker-layer.ts`. Draws a small light-gold pip stack in each tile's top-right corner: 0 pips for elev 0-2, 1 pip for elev 3-4, 2 pips for elev 5-6, 3 pips for elev 7-8, 4 pips for elev ≥9. Layer sits between cliff-edge and highlight. Engine-blind; static at mount. After visual verification in browser preview, the cliff-edge layer alone read insufficiently on River Ridge's smooth west climb (elev 2 → 7) and eastern perch (elev 9): the 1-3px cliff strips blended with tile outlines + grass texture variance. The stack markers close the gap — players can now read elevation tiers at a glance.

**Bedrock Stride first playtest surface:**

11. The S32 handoff flagged Bedrock Stride fall-immunity as "S33 surfaces alongside River Ridge." Integration test `session-33-integration.test.ts` locks the primitive composition: an Earth Mage with Bedrock Stride takes 0 damage from a falling system_damage of magnitude 50 (5-elev drop equivalent). Real knockback-rider exercise lands in the same test file via the synthetic 3×1 ridge maps at three tiers (4→2, 7→2, 9→2) — each tier confirms the `system_damage` action's `amount` matches 10 × dropDistance (per ADR-0026), pairing the Bedrock Stride scenario with the actual primitive that fires.

### Architecture records

- **ADR-0073** — Terrain-tag abstraction + ruleset-level default terrain costs + map validator. Documents the `TerrainRegistry` shape, the helpers, the hook-surface widening, the `computeMovementProfile` merge contract, Water Mage's canEnter extension, and the small map validator. Bundles three closely-related substrate adds since they share the same River-Ridge-driven motivation.

### Test reconciliation

- **+13** in new `terrain-registry.test.ts` — registry helpers (hasTag, withTag, mapCostsByTag, addWithTag).
- **+12** in new `map-validator.test.ts` — happy paths + 7 failure modes.
- **+14** in new `river-ridge.test.ts` — structural + per-elevation-tier + island spot-check + deployment-zone count + validator pass.
- **+8** in new `river-ridge-battle.test.ts` — config roster integrity, on-board placement, zone correctness.
- **+13** in new `session-33-integration.test.ts` — pathfinding (Water Mage reaches water_shallow, never water_deep; Knight stays on ground), Tidewalker / Bedrock Stride composition on River Ridge state, knockback fall-damage tiers at three ridge configurations, pre-battle queue smoke check.
- **+5** in new `corner-stack-marker-layer.test.ts` — categorical pip-count bins.
- **+1** in `content-end-to-end.test.ts` — Float now adds both water_shallow + water_deep.

Tests updated for the tag convention:
- `movement-abilities.test.ts` (Tidewalker tests) — reworked to assert against `water_shallow` / `water_deep` (the new convention) rather than literal `'water'`.
- `content-end-to-end.test.ts` (Float tests) — assert against both water terrain types; "cross water" test uses `water_shallow` legend.
- `test-fixtures.ts` (`makeTestRuleset`) — populates production water-tag registry + costs as defaults (empty registry was the placeholder; matches production now).
- `test-fixtures.ts` (`tileFrom` / `TileSpec`) — pass `deploymentZone` through (was previously dropped; the field has existed on `Tile` since Cluster 2 / ADR-0049).

**Final count: 960 passing across 80 files, 0 failing.**

Browser preview verified twice:
- After substrate + content + textures: River Ridge renders with the river column (water_shallow / water_deep visually distinct), the ridge band visible across cols 3-13 rows 6-8, units deployed in their zones, pre-battle init entries in the action log ("Tintinibar grants Regen to Blue Knight", "Blue Knight enters battle at CT 18", etc.). Cliff edges drew correctly (69 strips, max delta 7) but were visually subtle at the default 48px tile size — the smooth ridge climb's Δ=1 1px strips disappeared into the tile outlines.
- After corner stack markers: the ridge structure reads at a glance. The eastern perch (elev 9) shows 4 pips, the mid-ridge band (elev 7) shows 3 pips, the west climb (elev 3 / 4) shows 1 pip. River + flat zone at elev 0/1/2 stay markerless.

### Limitations + watch-fors

- **Float's v1 role is unclear under the new universal-water-enter convention.** Pre-S33 Float was the gate that opened water to ground-only classes. With the universal canEnter, Float's modifyCanEnter handler runs but adds terrains already in the baseline. The chain composition is still correct (tested in `content-end-to-end.test.ts`); the *content effect* is currently a no-op against the default catalog. Float remains `availability: 'hidden'` so it isn't player-equippable. Three reasonable redesigns to consider next time we touch movement-bucket content: (a) repurpose Float as a "Walk-on-Water" passive that drops water cost to 1 (the future passive the design doc references); (b) make Float a fall-mitigator (composing with `modifySystemDamage` like Bedrock Stride); (c) delete Float entirely until a clear v1 use case emerges. Worth a deliberate call before the deployment-phase UI starts surfacing passive choice to players.

- **Float's content-end-to-end tests reduced in scope.** Two tests deleted: "lets pathfinding cross water tiles it otherwise could not" (no longer holds — baseline now crosses water too) and the differentiation form of "adds water to canEnter when equipped" (the assertion happens to hold against the production baseline, so it's not actually testing Float's contribution). The remaining `Float composes through the modifyCanEnter chain` test exercises the registry-fed tag mechanism. The `Float + Move +1 stacked` test exercises hook-chain independence (structural + scalar). Mechanism coverage retained; behavioral differentiation pending the Float redesign.

- **Corner stack-marker layer replaced with numeric elevation labels + a cyan→gold color ramp (in-session revisions).** First-iteration design used 1-4 stacked pips in the top-right corner with categorical binning by elevation tier. Playtest read: pips parsed as a tier-meter rather than absolute elevation, and the categorical breaks (3-4 → 1 pip, 5-6 → 2 pips, etc.) obscured the exact tier. Replaced with a numeric digit in the same top-right slot. Second pass: labelling threshold dropped — **every tile is labelled**, including water (elev 0/1) and baseline ground (elev 2), so the readout is uniform. Third pass: the label fill now ramps **pale cyan (elev 0) → gold (elev ≥ saturation point, currently 10)** — a two-hue gradient giving a dual-channel cue (digit + warmth). Both endpoints are kept light deliberately so the constant dark outline stays legible across the whole ramp; a perceptual scale (viridis/inferno) was rejected because its dark end would force the outline color to co-vary. Layer renamed `corner-stack-marker-layer.ts` → `elevation-label-layer.ts`; old files deleted; `elevation-label-layer.test.ts` covers both the label string and the color ramp (anchors, clamping, monotonic warming). ADR-0073 / 0072 still capture the cliff-edge + elevation-overlay framing; no new ADR for the visual iteration. Chris may still want further elevation-readability polish — the cyan→gold numeric label is the current baseline, open to iteration.

- **Shallow water tint added** (`TERRAIN_TINTS` in renderer constants). Pre-revision the shallow water texture (`shallow-water-01/02/03.png`) read as a light cyan-pebble pattern visually too close to the grass texture. New `TERRAIN_TINTS['water_shallow'] = 0x90a8b8` darkens via Pixi's sprite-tint multiplicative blend; deep water stays untreated. Fallback `TERRAIN_COLORS['water_shallow']` also darkened (0x3a78a0 → 0x2a5878). Authoring darker source PNGs is the longer-term move; the tint is a fast post-import calibration. The infrastructure (`TERRAIN_TINTS` map, `TERRAIN_TINT_DEFAULT`) generalizes to any future terrain that wants a tint without re-authoring assets.

- **HMR-stale-catalog watch-for (Session 33 mid-session gotcha).** `BattleView.tsx` mounts the catalog once via `useMemo(() => loadDefaultCatalog(), [])`. When a class baseline (`canEnter`, `terrainCosts`, etc.) changes mid-session, Vite HMR reloads the source module but the React tree still holds the old catalog (the memo doesn't invalidate). Symptom during this session: after expanding all classes' `canEnter` to include water terrains, a regular Vite reload still produced UI move-highlights computed against the *old* canEnter — Knight could not reach water-side tiles even though the engine was correct. **Workaround: hard refresh (Cmd+Shift+R on Mac)** to force a fresh module + remount. Long-term: a future session could (a) add catalog as a dep on the useMemo + a HMR-hook that invalidates on content reloads, or (b) accept this as a development-loop quirk and note in the dev guide. Flag for the next renderer/UI session.

- **Cliff-edge categorical thicknesses (ADR-0072) read subtly on a 48px tile.** Corner stack markers close the gap, but the cliff-edge layer's "this transition is sharp" signal is still hard to distinguish from tile outlines at default zoom. A future polish session could either thicken the bins (2px / 3px / 4px), saturate the darken factor, or accept the markers as the primary elevation read and let cliff edges be a subtle complement. No immediate action.

- **`isWaterTile` in pathfinding still keys on `elevation ≤ 1`.** The leap-eligibility check (jump-over-water) uses elevation, not terrain string or tag. Consistent with the design doc's "elevation alone determines water-ness" framing for that specific predicate, even though terrain types now diverge. If a future content piece authors a non-water terrain at elev 0/1 (e.g., a chasm or a magma flow at low elevation), the leap-over-water mechanic would fire incorrectly. The author would need to either tag it `water` (making it pathologically Tidewalker-compatible) or the leap predicate would need to consult the registry. Flag for review when such content emerges.

- **`runModifyTerrainCosts` / `runModifyCanEnter` source the registry internally.** Handlers always see a valid registry — never `undefined`. Tests that call these runners directly with a custom catalog must ensure the catalog's ruleset has a `terrain.tags` field. `makeTestRuleset` provides a populated registry by default; any bespoke `RulesetDefinition` construction must include `terrain: { tags: new Map() }` (or a populated map) to satisfy the type.

- **The Water Mage's `canEnter` includes `water_shallow` but Tidewalker also reduces `water_deep` cost.** The cost reduction is meaningful only for unit/profile combinations whose canEnter includes the terrain. A bare Water Mage can't reach `water_deep` regardless of cost; with Float equipped, they can, and Tidewalker's 3→2 reduction kicks in. Composition is clean; no edge case.

- **Map validator is per-battle, not per-catalog.** River Ridge's tests call `validateMap` explicitly with team requirements; nothing in the engine auto-validates maps at catalog load (where team configurations are unknown). When team-builder ships in Phase E, it should validate against the chosen team config + map at battle-config-construction time. Flag for Phase E.

- **`TerrainType` is still `string`.** The registry is the discriminator now (a terrain is "real" if it's in the registry); the type itself stays an open union. Tests that construct synthetic tiles with arbitrary terrain strings will still type-check; the validator (or runtime composition) is the gate.

- **Existing demo art (`rock-01/02/03.png`) is on disk but not registered.** Could be wired into a future `rock` terrain type if the ridge wanted distinct visual identity from `ground`. Per the brief's decision 1, we declined to introduce `rock` as a terrain type in v1 (elevation alone differentiates the ridge from the flat plain visually via cliff edges + stack markers). Future content session may revisit.

### Considered and rejected this session

- **Direct enumeration in Tidewalker / Float (decision 2 option A).** Maintenance dependency grows with every water variant. The forward-compat win of the tag abstraction at the first sibling consumer (Float, which has the same widening problem) justifies the substrate. ADR-0073 Rationale.

- **Family/parent field per terrain type (option C).** Single-membership; can't tag `water_swamp` as both `'water'` and `'organic'`. The damage-tag pattern (set, not single) is the established precedent. ADR-0073 Alternatives.

- **Plumbing `terrainRegistry` through every runner caller's args.** Every existing test would need updating; cascading change for no win. Runners source the registry from the catalog internally. ADR-0073 Decision.

- **Authoring `rock` as a distinct terrain type for the ridge.** Decision 1 = A. v1 doesn't need rock as a distinct *movement* context; elevation + cliff edges + stack markers convey the ridge identity visually. Future rock-only abilities can introduce the terrain type when actual mechanics need it.

- **A catalog-load-time map validator.** Catalog doesn't know which battles will use which maps with which team counts. Validation is per-battle; called at battle load or in tests. ADR-0073 Alternatives.

- **Continuous (linear) pip count for stack markers.** Would mean elev 9 shows 9 pips — visually noisy and not particularly meaningful since per-elevation differences only matter at tier boundaries (knockback fall-damage tiers, ranged-perch elevation advantage). Categorical binning matches how players think about terrain. Inline rationale in `corner-stack-marker-layer.ts`.

- **One unified rendering layer for cliff edges + stack markers.** They have different invariants (cliff edges are relationships between adjacent tiles; markers are per-tile absolutes) and different repaint conditions. Two layers keep responsibilities clean. ADR-0073 Alternatives.

- **Tag abstraction extending to canEnter via tag-set checks in pathfinding.** Considered. `canEnter` is still a `Set<TerrainType>` (literal terrain strings). The tag abstraction operates at the *handler* level (Float adds tagged terrains to the set; Tidewalker rewrites the cost map by tagged-terrain iteration). Keeping the *pathfinding* check on terrain literals avoids a per-step registry lookup and matches the established hot-path. Future "I want any water-tag terrain to be enterable" passive could compose via Float-style addition.

- **Updating `river-ridge.md`'s elevation grid in place to match the implementation.** The grid is correct; only the "no separate water terrain type needed" assertion in the engine-requirements section is divergent. Surgical edit + reference to ADR-0073 preserves the design intent and rationale. ADR-0073 Rationale.

### Empirical-questions checklist for Chris's next playtest

**River Ridge tactical character (first playtest):**

- [ ] Does the central western passage (cols 3-5) dominate engagement as the design doc anticipated? If "yes — every battle converges there," consider raising col 3 elev or adding an obstacle.
- [ ] Does the eastern flank read as engageable, or does one team always take the perch unchallenged? The 7-elev drop from col 13 row 7 to col 13 row 8 (a 4-pip cliff) should be both intimidating (knockback risk) and tempting (LoS dominance). If one team always takes it and the other can't contest, the "valley cut at rows 7-8 cols 11-12" proposal in the design doc's open considerations is the fix.
- [ ] Water Mage with Tidewalker: does the col 2 patrol read as meaningful tempo? The 1-mp shallow-water cost should make col 2 a Water-Mage-only highway. If non-water-mages routinely cross via Float / land detour, the tempo signature is muted.
- [ ] Knockback off the eastern perch: does the 7-tier fall damage actually KO targets, or does HP scaling at this point in the demo balance dissipate it? (10 × dropDistance = 70 damage from elev 9 → 2; mid-game Mages have ~120-150 HP.)

**Bedrock Stride first read:**

- [ ] An Earth Mage with Bedrock Stride takes 0 fall damage when knocked off the ridge. The integration test locks the primitive; first real playtest confirms it feels appropriately defensive (vs. a Float-equipped mage who also avoids fall damage via water landing).

**Visualization:**

- [ ] Corner stack markers read at a glance? Specifically: does the player notice the perch's 4-pip cluster vs. the mid-ridge's 3-pip cluster vs. the gentle climb's 1-pip cluster without hovering for tile info?
- [ ] Water terrains visually distinct from land — water_shallow + water_deep + ground all three palettes + textures applied. Any "what's that tile?" confusion?
- [ ] Deployment-zone tinting (Phase E) not yet wired — units just start at their authored positions. Players reading the map can't see "Blue zone is here" without prior knowledge. Phase E adds the visual tinting.

### Longer-term carry-forward

- **River Ridge balance tuning** — open considerations from `river-ridge.md` (western passage dominance, eastern flank engagement, water-lane tempo). Playtest-informed.
- **Jump-over-water leap on River Ridge** — current grid doesn't surface this mechanic. Re-author or accept (see Limitations + watch-fors).
- **Walk-on-Water passive** — future content. The brief flagged it as deferred; the tag abstraction + Float / Tidewalker substrate composes naturally.
- **Future terrain types** (`swamp`, `ice`, `sand`, `lava`) — substrate is ready. Author the type, register a tag set (`['water','organic']` for swamp; `['water','frozen']` for ice; `['land','sand']` for sand; etc.), and the tag-aware passives compose.
- **Pre-battle UI surfaces (S34-37)** — title screen + battle setup + team builder + deployment phase + sample team templates. River Ridge is the deployment phase's first concrete consumer (zones are authored; UI surfaces them).
- **Map validator @ team-builder time** — Phase E's team-builder should validate the chosen team + map combination so insufficient-zone scenarios fail loud.
- **Cliff-edge thickness tuning** — corner stack markers carry the elevation read now; cliff edges are a subtle complement. If a future tile-size or zoom-level change makes the bin tuning less ideal, revisit.
- **`isWaterTile` predicate** — if non-water terrain ever ships at elev 0/1, the leap-over-water predicate needs to consult the registry rather than elevation. No v1 case.
- **Action-log "collapse setup" toggle** — S32 carry; pending playtest read.
- **`UnitVisualSnapshot.maxHp` field cleanup** — S31.5 carry.
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
- **Forecast accuracy row visibility** — S30 reject; revisit if confusion surfaces.
- **Hit-chance and cover modifiers from elevation differential** — `map-and-battlefield.md` open question. River Ridge is the first map that exercises elevation; ripe to settle in a follow-on.
- **`buildBattle` test-fixture extraction** — S32 carry; triggers at fourth duplication. S33 added `initialRiverRidgeState` as the third pattern (after `initial-ct-variance.test.ts` and `session-17c-integration.test.ts`); one more duplication justifies the shared helper.
- **`fillVitalsFromComputedMaxes` ordering invariant** — S32 carry. River Ridge doesn't author equipment-status-modifies-maxHp content; invariant holds.

### Suggested scope for Session 34

Per the roadmap: **Phase E begins** — title screen + battle setup screen. Per `roadmap-sessions-21-plus.md`'s Session 34 entry:

- Title screen scaffolding (route into battle setup or directly into a hand-authored battle for now).
- Battle setup screen — at minimum, "Start River Ridge" as the single selectable battle. Future sessions add team-builder + map selection.
- Wire the "next battle" / "back to title" buttons on the results screen (deferred from S24).
- Small. Sets the stage for S35-37 deployment-phase UI.

Phase D content milestone reached this session: River Ridge playable end-to-end via `BattleView.tsx`'s runtime config. The pre-battle phase, terrain abstraction, knockback substrate, cliff-edge + stack-marker rendering, and water-traversal composition all light up at once on the new map.
