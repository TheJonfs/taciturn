# Session 33 Brief: River Ridge Map Authoring + Terrain-Family Abstraction + Corner Stack Markers Decision

## Context

Phase D content session. Session 32 closed the Cluster 6 substrate (jump-over-water pathfinding, knockback-into-water verification, pre-battle equipment auto-status as logged actions, orchestrator pre-battle setup pass) plus the cliff-edge rendering layer. Tests at 887/0 across 73 files. Now: ship the content that exercises all of it.

This session authors **River Ridge** per the design doc, widens **Tidewalker** to handle the new water-terrain split (or introduces a terrain-family abstraction), wires the **BattleConfig** so the demo can load River Ridge, and decides whether **corner stack markers** ship now based on how cliff edges alone read against real elevation variance. The Bedrock Stride fall-immunity carry-forward finally has its test bed.

End of session: River Ridge playable end-to-end via `demo.ts`. Phase D content milestone reached. Session 34 begins Phase E (pre-battle UI surfaces).

## Inputs (read first)

In recommended order:

1. **`CLAUDE.md`** — project conventions.
2. **`docs/handoff.md`** — Session 32 handoff. Particularly the "Limitations + watch-fors" section (Tidewalker widening, corner stack markers deferred, `fillVitalsFromComputedMaxes` ordering invariant) and the "Suggested scope for Session 33" tail.
3. **`docs/twentyOnePlanning/roadmap-sessions-21-plus.md`** — Session 33 entry; Session 34 entry for context on what follows.
4. **`docs/twentyOnePlanning/river-ridge.md`** — the authoritative content spec. The full map grid, elevation values, deployment zones, tactical character, engine requirements, and open considerations all live here.
5. **`docs/design/map-and-battlefield.md`** — for `TerrainType`, `MovementProfile`, tile properties, deployment zone semantics, range geometry. Substrate document.
6. **`docs/decisions/0071-...`** (pre-battle action-source + orchestrator phase), **`0072-...`** (cliff-edge rendering convention). Recent ADRs covering substrate this session composes against.
7. **`src/content/abilities/tidewalker.ts`** — the existing implementation that needs widening (or terrain-family adaptation).
8. **`src/content/maps/training-field.ts`** (or equivalent) — the existing map authoring as the reference shape for River Ridge's structure.

### Paths to survey before planning

Current-tree audit required. Particularly:

- **Map authoring shape.** Where existing maps live, what `BattleMap` / `Tile` types require, how the catalog loads maps. Confirm River Ridge slots cleanly.
- **`TerrainType` definitions.** Where the type lives, what variants are currently authored (`'water'`, `'land'`, others?), and what `MovementProfile.terrainCosts` and `canEnter` expect. Settles decision 1 below.
- **`deploymentZone` tile property.** Per `river-ridge.md`'s Engine Requirements: "Tiles tagged 'team_a', 'team_b', or null (default). Map validation: each map must contain at least N zone tiles per team." Audit whether Cluster 2 shipped this property or whether River Ridge is the first consumer that needs it.
- **Water Mage M-ability hook.** Was flagged in the S32 brief as audit-time gap-check; the S32 handoff doesn't explicitly confirm closure. Audit again: is the per-tile move-cost reduction hook present and wired, or does S33 need to address it?
- **Tidewalker handler.** `src/content/abilities/tidewalker.ts` keys on `'water'` in `modifyTerrainCosts`. Confirm shape; informs decision 2.
- **`BattleConfig` loading.** How `demo.ts` produces a config; how to add River Ridge as a selectable option or replacement.
- **Map validation.** Does a validator exist for "map has enough deployment zone tiles for the team config" etc.? If not, S33 may add a small validator alongside the content.

The plan articulates what exists, what's being refit, what's being added.

## Goal

End state:

**Content authoring:**

- **River Ridge map** authored in `src/content/maps/river-ridge.ts` (or equivalent path) per `river-ridge.md`. 14×14 grid, single layer, elevations 0-9, three islands, central ridge, deployment zones. All tile properties set explicitly.

**Engine work (small, audit-confirmed):**

- **Terrain-type expansion or abstraction (decision 1):** `water_deep` (elev 0) and `water_shallow` (elev 1) as distinct terrain types, with default movement costs `{water_deep: 3, water_shallow: 2, land: 1}`. Tidewalker either widens to handle both directly (decision 2A) or keys on a terrain-family/tag abstraction (decision 2B).
- **`deploymentZone` tile property** wired through if not already shipped (audit decision 5).
- **Water Mage M-ability hook** wired through if audit reveals the gap (decision 4).

**Demo wiring:**

- `BattleConfig` for River Ridge in `demo.ts` — either alongside Training Field as a selectable option or as the new default.
- Existing demo loadouts (Blue Knight, Blue Water Mage, Blue Lightning Mage; red team) ship onto River Ridge at appropriate deployment-zone positions.

**Rendering decision (in-session, post-content-authoring):**

- **Corner stack markers** ship in S33 iff cliff edges alone read insufficient against River Ridge's actual elevation variance. The decision happens after the map renders for the first time; if cliff edges convey both the smooth ridge climb and the sharp perch drop adequately, markers defer to a future polish session.

**Integration tests:**

- Map loads cleanly (no validation errors).
- Pathfinding produces sensible results across the map (no isolated regions; reachability fits expected tactical character).
- Jump-over-water leaps work at expected leap points (col 0 ↔ col 2 across col 1's water).
- Water-tile movement costs correct (shallow water = 2 mp, deep water = 3 mp).
- Knockback-into-water scenarios produce correct fall damage at graduated tiers (1-2 elev drop, 5 elev, 7 elev).
- Deployment zones present at correct positions for each team.
- Battle launches with River Ridge as the map; demo loadouts deploy correctly; pump runs through CT spool-up without errors.

**Bedrock Stride fall-immunity verification (S33 carry-forward):**

- First playtest of the fall-immunity passive on a unit knocked from the ridge. Confirms the passive composes correctly with the knockback fall-damage pipeline.

**Quality:**

- Tests at 887+, 0 failing. New tests proportional to map authoring + Tidewalker change.
- ADR for terrain-family abstraction iff decision 2 lands on B (the abstraction shape) — direct widening doesn't warrant one.
- `docs/handoff.md` updated.

## Pre-implementation plan (required)

Same discipline as previous sessions. Current-tree audit first; architectural decisions surfaced before code.

### Required first step: current-tree audit

For each surface this session touches:

- **`TerrainType` current shape.** What variants exist; how `MovementProfile.terrainCosts` and `canEnter` consume them; whether the type is extensible by content authoring or requires engine changes for new variants. Audit reveals whether adding `water_deep` / `water_shallow` is a content-only change or a small engine change.
- **Tidewalker authoring.** Read the existing handler; confirm where `'water'` is hardcoded. Inform decision 2.
- **`deploymentZone` tile property.** Confirm presence in `Tile` type; confirm map-loader honors it; confirm any validation existing. If absent, S33 ships it.
- **Water Mage M-ability hook.** Confirm whether `modifyTerrainCosts` hook exists and is wired through the move-engine; whether the M-ability registers a handler against it.
- **Map authoring conventions.** Read Training Field's authoring to confirm shape; identify any helpers or factory patterns that River Ridge should reuse.

### Architectural decisions

After the audit:

1. **Terrain type shape for River Ridge.** Three variants needed at minimum: `water_deep`, `water_shallow`, `land`. Question is whether the ridge's high-elevation tiles (elev 7-9) need their own terrain type (e.g., `rock`, `ridge`) or share `land`.
   - **A — Three terrain types** (`water_deep`, `water_shallow`, `land`). Ridge tiles are `land`; elevation drives the rocky-art rendering at the renderer level. Movement cost from `land` is 1 regardless of elevation.
   - **B — Four+ terrain types** (`water_deep`, `water_shallow`, `land`, `rock`). Ridge tiles authored as `rock` for semantic distinction; movement cost still 1 in v1 but the type opens future variation (e.g., rock-walking, sure-footedness).
   
   **Recommendation: A.** v1 doesn't need rock as a distinct movement context; elevation already drives visual differentiation via the cliff-edge layer and (future) tile sprites. Future "rock-only" abilities can introduce the terrain type when actual mechanics need it. Keep the content surface minimal now.

2. **Tidewalker widening shape (the key architectural call).** Two reasonable shapes:
   - **A — Direct enumeration.** `tidewalker.ts`'s `modifyTerrainCosts` handler enumerates both `water_deep` and `water_shallow` and applies the -1 cost reduction to each. Simple; no substrate change. Future water-variants require Tidewalker (and any sibling consumers) to widen explicitly.
   - **B — Terrain-family abstraction via tags.** Each `TerrainType` declares a `tags: ReadonlyArray<TerrainTag>` field. `water_deep` has tags `['water', 'deep']`; `water_shallow` has tags `['water', 'shallow']`. `modifyTerrainCosts` handlers can register against a tag (`'water'`) and the dispatch chain applies the handler to any terrain with that tag. Mirrors the `damageTags` pattern that's already familiar.
   - **C — Family/parent field.** `TerrainType` declares a `family?: TerrainFamily` field; `water_deep` and `water_shallow` both belong to family `'water'`. Handlers can register against the family. Less flexible than tags (single-membership) but simpler.
   
   **Recommendation: B.** The tag-set pattern mirrors `damageTags` and composes cleanly with future content (e.g., `water_frozen` with tags `['water', 'frozen']` works for both Tidewalker AND a hypothetical Frost-Stride; `water_swamp` with `['water', 'organic']` works for both Tidewalker AND a hypothetical Decompose ability). Future Walk-on-Water passive keys on the `'water'` tag the same way Tidewalker does. The abstraction is small (one new field on `TerrainType`, dispatch sweep through `modifyTerrainCosts` consumers); the forward compatibility is meaningful. Worth an ADR.
   
   **If B is rejected at plan-review, A is the no-substrate-change path.** Document Tidewalker's widening as a maintenance dependency that needs updating each time a new water-variant ships.

3. **`canEnter` semantics for water terrain types.** Default classes have `canEnter: {land}` (Knight, Mages without Water-Mage class). Water Mage class adds `water_shallow` to `canEnter`. Deep water — does it require special movement (Fly / Float)?
   
   Per River Ridge's design: "Knockback Into Water" allows units to end up in deep water even without Walk-on-Water; they escape on subsequent turns at standard water cost. So entering deep water voluntarily (without Float/Fly) is presumably blocked, but being knocked there isn't. This matches FFT precedent.
   
   **Recommendation:** Default `canEnter: {land}` for all classes; Water Mage class adds `{water_shallow}` (not deep — even Water Mage walks shallow). Knockback resolution bypasses `canEnter` (already does per Cluster 6 substrate). Future Walk-on-Water passive adds `water_deep` to canEnter.

4. **Water Mage M-ability hook closure (audit-conditional).** If audit reveals the hook is present and wired: no action; tests confirm composition with the new terrain types. If audit reveals the hook is missing or unwired: small engine seam to add. The S32 brief flagged this; the S32 handoff didn't explicitly confirm. Verify in audit.

5. **`deploymentZone` tile property (audit-conditional).** If audit reveals it's shipped: no action; River Ridge authors zones via the existing field. If not shipped: add the property to `Tile` shape + map validation logic ("each map must contain at least N zone tiles per team") this session. River Ridge is the first map to use it.

6. **Map validation.** Should the catalog loader validate maps on load (deployment zone presence, valid terrain types, elevation within bounds, no isolated regions)?
   - **A — Ship a minimal validator now** (deployment zones present, terrain types resolve). Low cost; catches the next authoring typo.
   - **B — Defer validation to future content session.** Trust the test suite to catch issues per-map.
   
   **Recommendation: A.** River Ridge's deployment-zone semantics are load-bearing for Phase E (deployment phase UI). A small validator now prevents Phase E from authoring around silent map bugs. Validator returns errors at load time, not at battle start.

7. **Corner stack markers ship-now-or-defer decision** — **in-session, after map renders for the first time.** No pre-implementation decision. Audit the cliff-edge layer's read against River Ridge's actual variance. If the smooth ridge climb (elev 2 → 3 → 4 → 7) and the sharp perch drop (elev 9 → 2) both convey clearly via cliff edges alone, markers defer to a future polish session. If either reads ambiguously, ship markers per the categorical bins from S32's brief (decision 7 in the S32 brief).

8. **`fillVitalsFromComputedMaxes` ordering invariant** (S32 carry). Documented in S32 handoff as a "watch in audit, no action now" item. River Ridge doesn't introduce any equipment-status-that-modifies-maxHp/maxMp content, so the invariant continues to hold. Audit verifies no River Ridge tile property or status pattern accidentally violates it.

9. **Test strategy.** Integration tests cover:
    - Map load + validation
    - Pathfinding sanity (reachability, isolation, water costs)
    - Jump-over-water leap points across col 1's water
    - Knockback-into-water graduated tiers
    - Deployment zone correctness
    - Battle launch with demo loadouts on River Ridge
    - Bedrock Stride fall-immunity (a knockback scenario for a unit carrying the passive)
    
    Tidewalker composition test extends to cover the new terrain types (if decision 2 = A) or the family/tag abstraction (if decision 2 = B).

10. **Order of work.** Engine first (terrain types + abstraction if 2 = B; deploymentZone if needed; Water Mage M-ability hook if needed) → content (River Ridge map authoring) → Tidewalker update → demo wiring → integration tests → cliff-edge visual verification → corner stack markers decision → ship markers if needed.

11. **33a/33b split allowance.** Surface area is moderate but bounded. If decision 2 = B's terrain-tag abstraction blows up during audit (e.g., dispatch sweep is larger than expected) OR if corner stack markers ship as a meaningful addition, natural split:
    - **33a:** Engine substrate (terrain types + family abstraction + deploymentZone + Water Mage hook if needed) + River Ridge content + Tidewalker update + demo wiring.
    - **33b:** Corner stack markers + any remaining polish.
    
    Likely no split needed. Most of the work is content authoring (small) plus a focused engine change (small-to-medium).

The plaintext plan is reviewed before code lands.

## Implementation work

Following plan approval, items land roughly in this order: engine first, then content, then wire-up, then verification.

### Item 1: Terrain-family abstraction (if decision 2 = B)

- New `tags: ReadonlyArray<TerrainTag>` field on `TerrainType` (or equivalent shape)
- Dispatch sweep through `modifyTerrainCosts` consumers to support tag-based registration
- Existing terrain types tagged appropriately (`water_deep: ['water', 'deep']`, `water_shallow: ['water', 'shallow']`, `land: ['land']`)
- Tests: handlers registered against tags fire for any terrain with that tag; multi-tag terrain types apply correctly

### Item 2: Terrain type expansion

- Add `water_deep` and `water_shallow` to `TerrainType`
- Default movement costs: `water_deep: 3`, `water_shallow: 2`, `land: 1`
- Class-default `canEnter` updated per decision 3: Water Mage adds `water_shallow`; others retain `{land}` only
- Tests: each terrain type's default cost / canEnter applies correctly

### Item 3: `deploymentZone` tile property (if needed per audit)

- Add `deploymentZone?: 'team_a' | 'team_b' | null` to `Tile` shape
- Map loader honors the field
- Map validator checks each map has ≥ N zone tiles per team (where N is the largest team size the BattleConfig supports)
- Tests: zone tiles correctly identified per team; validation rejects insufficient zones

### Item 4: Water Mage M-ability hook (if needed per audit)

- Add `modifyTerrainCosts` hook to per-tile move-cost resolution chain
- Wire Water Mage M-ability handler through it (decrement water-tagged costs by 1, minimum 1)
- Tests: Water Mage on water_shallow pays 1 mp; on water_deep pays 2 mp; non-Water-Mage pays the default

### Item 5: Tidewalker update

- If decision 2 = A: enumerate `water_deep` and `water_shallow` directly in the handler
- If decision 2 = B: register against the `'water'` tag
- Tests: Tidewalker composes correctly with both water types

### Item 6: River Ridge map authoring

- 14×14 grid in `src/content/maps/river-ridge.ts`
- All tile elevations, terrain types, deployment zones per `river-ridge.md`
- Tile properties: deploymentZone set on rows 0-2 and 11-13 cols 5-8 per the spec
- No `blocks_los`, `hazard`, etc. in v1 — all flagged as future
- Tests: map loads, validates, produces expected tile data at sampled positions

### Item 7: BattleConfig wire-up

- River Ridge added to `demo.ts` either alongside Training Field (selectable) or replacing it
- Demo loadouts deploy at appropriate positions in each team's zone
- Tests: demo battle launches with River Ridge; expected starting positions confirmed

### Item 8: Cliff-edge visual verification + corner stack markers decision

- After map authors, run browser preview
- Evaluate cliff-edge read against the smooth ridge (elev 2 → 7) and the sharp drop (elev 9 → 2)
- Decision: ship markers if read insufficient; defer if cliff edges alone convey
- If ship: implement per categorical bins from S32's brief (no marker for elev 0-2; 1/2/3/4 markers for higher tiers)

### Item 9: Integration tests

- Per the test strategy in decision 9
- Knockback-into-water scenarios at multiple cliff configurations (gentle slope at col 4; sharp drop at col 6; perch drop at col 10)
- Bedrock Stride fall-immunity scenario (unit with passive knocked off ridge; takes no fall damage)

## Acceptance criteria

**Engine substrate:**

- `water_deep` and `water_shallow` terrain types defined with default costs `{3, 2}` and class-appropriate `canEnter`.
- Tidewalker composes correctly with both water types (per decision 2's path).
- (If audit-conditional) `deploymentZone` tile property wired through; map validator checks zone presence per team.
- (If audit-conditional) Water Mage M-ability hook reduces water-tagged tile costs by 1 (minimum 1).

**Content:**

- River Ridge authored per `river-ridge.md`: 14×14 grid, elevations 0-9, three islands (cols 1-2 rows 4-5, 7, 8-9), central ridge (cols 3-13 rows 6-8), deployment zones (rows 0-2 and 11-13, cols 5-8).
- Map loads cleanly; validator passes; sampled tile data matches the spec grid.

**Demo:**

- River Ridge available as a BattleConfig in `demo.ts`.
- Demo loadouts (Blue Knight, Blue Water Mage, Blue Lightning Mage, plus red team) deploy at appropriate positions in their zones.
- Battle launches; CT spool-up runs without errors; pre-battle action log shows `[init]` entries (equipment grants + initial CT per Session 32).

**Pathfinding + tactics:**

- Jump-over-water leaps available at col 0 ↔ col 2 across col 1's water (where col 1 is water, col 2 has land at relevant rows).
- Water Mage with M-ability traverses water at reduced cost.
- Knockback-into-water at multiple cliff scenarios produces correct fall damage (1-2 elev minor; 5 elev significant; 7 elev severe).
- Bedrock Stride passive on a unit knocked off the ridge negates fall damage.

**Rendering:**

- Cliff-edge layer renders the ridge cleanly. Smooth climb on the west (elev 2 → 3 → 4) shows thin edges; sharp east face (elev 9 → 2) shows the thickest categorical tier.
- (If corner stack markers ship) Markers in top-right corners show categorical elevation tiers per decision 7's bins.

**Quality:**

- Tests at 887+, 0 failing. New tests proportional to additions.
- ADR for terrain-family abstraction iff decision 2 = B.
- `docs/handoff.md` updated.

**Phase D content milestone reached.** River Ridge playable end-to-end. Session 34 begins Phase E (title screen + battle setup screen).

## Out of scope

- **Pre-battle UI surfaces** — title screen, battle setup, team builder, deployment phase. Phase E (Sessions 34-37).
- **Future map content** — additional maps beyond River Ridge. River Ridge is the v1 first playable map; future maps lean into specific tactical themes per `river-ridge.md`.
- **Walk-on-Water passive** — future content per `river-ridge.md`. Substrate composes naturally when authored.
- **River Ridge balance tuning** — `river-ridge.md` lists open considerations (western passage dominance, eastern flank engagement). First playtest informs whether tuning is needed; not S33 scope.
- **Future terrain types** (swamp, ice, sand) — design-doc extensible; v1 only ships water + land.
- **AoE multi-layer behavior, friendly pass-through, straight-line LoS tie-breaking, unit-blocking-LoS, forced movement collision, trigger tile semantics, hit-chance/cover from elevation** — `map-and-battlefield.md` open questions.
- **Layered maps (bridges, multi-layer features)** — River Ridge is single-layer.
- **Magus Crown +5 MA / +25% MP cost tighteners** — calibration carry.
- **Tooltip Option B authored-description pass** — post-current-roadmap.
- **AI active absorption exploitation** — S27 carry.
- **Polish #5 statuses portion** — S31.5 carry.
- **`UnitVisualSnapshot.maxHp` field cleanup** — S31.5 carry.
- **Action-log "collapse setup" toggle** — S32 carry; pending playtest read on whether the pre-battle entries feel cluttered.
- **Surrender flow, MVP-unit algorithm, permadeath timer, settings expansion, reactions in projection column** — Phase E/F.

## Files likely touched

Non-exhaustive. Audit confirms / corrects.

**Engine:**

- `src/engine/map/terrain.ts` (or wherever `TerrainType` lives) — new variants; tag field if decision 2 = B
- `src/engine/map/tile.ts` (or equivalent) — `deploymentZone` field if needed
- `src/engine/map/map-validator.ts` (new) — minimal validation per decision 6
- `src/engine/hooks/runners.ts` — `modifyTerrainCosts` tag-dispatch if decision 2 = B; Water Mage hook wiring if audit reveals gap
- `src/content/abilities/tidewalker.ts` — widen or re-key per decision 2
- `src/content/abilities/water_mage_m.ts` (or wherever) — wire-up if audit reveals gap

**Content:**

- `src/content/maps/river-ridge.ts` (new) — the 14×14 map authoring
- `src/content/maps/index.ts` (or catalog loader) — register River Ridge

**Demo:**

- `src/demo.ts` (or `src/app/demo/...`) — River Ridge BattleConfig

**Rendering (if corner stack markers ship):**

- `src/renderer/corner-stack-marker-layer.ts` (new) — overlay component per decision 7's bins

**Tests:**

- `src/engine/map/pathfinding.test.ts` — leap points on River Ridge
- `src/engine/map/terrain.test.ts` — terrain type costs, canEnter rules
- `src/engine/map/map-validator.test.ts` (new) — validation rules
- `src/content/maps/river-ridge.test.ts` (new) — map sanity tests
- `src/engine/actions/session-33-integration.test.ts` (new) — knockback-into-water at graduated tiers; Bedrock Stride fall-immunity; demo battle launch
- `src/content/abilities/tidewalker.test.ts` — composition with new terrain types

**ADRs:**

- `docs/decisions/0073-terrain-tag-abstraction.md` (or next available) — iff decision 2 = B

**Documentation:**

- `docs/handoff.md` — session handoff

## Workflow notes

- **Plaintext-first review required.**
- **Audit-first within the plan.** Particularly important for: `TerrainType` extensibility (decision 1); existing `modifyTerrainCosts` dispatch shape (decision 2); `deploymentZone` property status (decision 5); Water Mage M-ability hook status (decision 4).
- **ADR path is `docs/decisions/`** (per S31.5 path correction).
- **Substrate before content.** Terrain types and tag abstraction (if decision 2 = B) ship first; map authoring depends on them. Tidewalker update lands after terrain types are stable.
- **Mid-session design questions** route through Chris to the planner. Most likely surfaces: terrain-tag abstraction sweep size (decision 2 audit outcome); deploymentZone property authoring decision (decision 5); cliff-edge visual read against real elevation variance (decision 7 — in-session decision after first render).
- **Cliff-edge visual verification** is part of the workflow, not an afterthought. After the map authors, browser-preview and evaluate before committing to corner stack markers.
- **No new content milestones beyond Phase D content.** Phase D substrate (S32) plus content (S33) = Phase D complete. Session 34 starts Phase E.

## Watch-fors

**Addressed this session:**

- River Ridge map authoring (roadmap-flagged S33 scope)
- Tidewalker terrain-family widening (S32 carry-forward)
- Corner stack markers ship-or-defer decision (S32 carry-forward; in-session resolution)
- Bedrock Stride fall-immunity first playtest (long-standing carry; surfaces with River Ridge)
- `deploymentZone` tile property if audit reveals gap
- Water Mage M-ability hook if audit reveals gap
- Map validation (small new infrastructure)

**Not addressed this session, longer-term carry-forward:**

- **Pre-battle UI surfaces** — Sessions 34-37
- **Walk-on-Water passive** — future content; substrate composes naturally
- **River Ridge balance tuning** — open considerations from `river-ridge.md`; playtest-informed
- **Future maps with distinct tactical themes** — beyond v1
- **Future terrain types** (swamp, ice, sand, etc.) — design-doc extensible
- **Layered maps** (bridges, multi-layer features) — beyond v1
- **`map-and-battlefield.md` open questions** — AoE multi-layer behavior, friendly pass-through, LoS tie-breaking, unit-blocking-LoS, forced movement collision, trigger tile semantics, hit-chance/cover from elevation differential
- **Action-log "collapse setup" toggle** — S32 carry; pending playtest read
- **Polish #5 statuses portion** — S31.5 carry
- **`UnitVisualSnapshot.maxHp` field cleanup** — S31.5 carry
- **`fillVitalsFromComputedMaxes` ordering invariant** — S32 carry; verified holds for River Ridge content
- **Wand swing ally-targetability** — S31 carry
- **AI active absorption exploitation** — S27 carry
- **AI projection forecast extension via `computeOutgoingHitChance`** — S30 carry
- **Procced spell uses caster's MA** — S30/S31 carry; ongoing playtest read
- **Magus Crown +5 MA / +25% MP cost tighteners** — calibration carry
- **Burn × Purifier playtest** — one-off battle setup needed
- **Tintinibar Regen tuning** — initial read reasonable; ongoing
- **Sorcerer's Robe Move +1 playtest read** — initial read reasonable; ongoing
- **Status-badge polarity convention extension** — chip pre-icons if status lists grow
- **Team color palette → engine `Team` shape** — long-term
- **Tooltip Option B authored-description pass** — post-current-roadmap
- **`onTurnStart` symmetric widening** — S26 carry
- **Multiplicative tick-amount stacking** — S28 carry; no v1 case
- **`onFinalDamage` fires on absorbed hits but handlers gate** — design pattern
- **Forecast facing uses actual attacker→target geometry** — S30 carry
- **Unit detail panel's per-facing evasion uses `unit` as attacker stand-in** — S30 carry
- **Item #5 pacing constants** — S26.5 carry
- **Constant-map labels don't carry icons today** — S28 polish
- **`pa_factor` NotYetImplementedError** — audit E3
- **TS strict-mode test errors** — audit E8
- **Surrender flow** — S34 / ADR-0041
- **MVP-unit smarter algorithm** — S24 Wave 1
- **Permadeath timer** — S24 Wave 1
- **Settings expansion** — S24 Wave 1
- **Reactions in projection column** — S24 Wave 1
- **Forecast accuracy row visibility** — S30 reject; revisit if confusion surfaces
- **Hit-chance and cover modifiers from elevation differential** — `map-and-battlefield.md` open question
- **`buildBattle` test-fixture extraction** — S32 carry; triggers at fourth duplication

## Estimated size

**Small-to-medium** per roadmap framing. Content authoring (map data) is mechanical and bounded. Engine work is small: terrain type additions, optional tag abstraction (decision 2), optional `deploymentZone` add (decision 5), optional Water Mage hook (decision 4). Tidewalker update is one file. Cliff-edge visual verification is in-session work without code; corner stack markers ship-or-defer adds 0 or 1 small rendering item.

**Upper bound scenarios:**

- Decision 2 = B (terrain-tag abstraction) AND the dispatch sweep is larger than expected
- Decision 5 = audit reveals `deploymentZone` isn't shipped (small substrate add)
- Decision 4 = audit reveals Water Mage hook isn't wired (small substrate add)
- Decision 7 = corner stack markers ship (small rendering add)

If all four upper-bound scenarios hit: medium overall, but each individual item is small. Unlikely to require splitting.

**33a/33b split allowance** reserved for the unlikely case that decision 2 = B's tag abstraction balloons. Natural seam: 33a (engine + content + Tidewalker + demo wiring); 33b (corner stack markers + any remaining polish).

**End of session: Phase D content complete.** River Ridge playable end-to-end. Session 34 begins Phase E (title screen + battle setup screen).
