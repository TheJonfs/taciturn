# Session 47 Brief: Second Map (Stonebridge / Bridgekeep / TBD) + Rampart Tile Type + Magic Vertical Substrate

## Context

S46 closed with the playtest tuning round: six bug-fix items (bow damage projection, charging hit guarantee, Stop ticking, terrain bar padding, permadeath sprite removal, zoom max) + a small balance pass (baseline Move -1 across all classes, per-class stat nudges, The Offering tax steepened, R/S/M hover text authored). 1352 tests / 119 files. The S46 fixes and tuning are test-validated; in-battle feel-verification will accumulate over S47+ playtest passes.

S47 introduces the **second Mage War map** — a 16×16 fortified river crossing with a defender-friendly building in the SE corner, and the supporting substrate to make assaults on elevated defensive positions tactically viable.

Three substantive pieces:

1. **Map content authoring** for the second map. Data-driven; 16×16 grid with terrain types, deployment zones, and metadata per River Ridge spec convention.

2. **Rampart tile type.** New terrain type for the building's walls/rampart. Engine treatment is mostly the same as land (elev 8, walkable, occupies tile), but with a distinct tile-type tag for renderer art (Chris will produce art separately via Gemini).

3. **Magic targeting vertical substrate.** Single-target spells get vertical-infinite range (matching bow precedent). AoE spells gain a new `verticalTolerance` field that bounds AoE splash from the target tile to within ±N elevation. Default tolerance ~3.

The session character is **medium-light** if the audit confirms what the brief assumes: the map system is already data-driven and accommodates arbitrary 16×16 layouts; the tile-type registry can absorb a new entry; magic targeting may already separate vertical concerns or the change is small. Audit-first per project conventions, with a plan-review checkpoint after audit completes.

## Inputs (read first)

In recommended order:

1. `CLAUDE.md` — project conventions.
2. `docs/handoff.md` — S46 close (the in-battle verification gap; AI Hunter deployment carry).
3. `docs/decisions/0073-terrain-types-and-water-tags.md` — ADR establishing the water-tag abstraction (relevant for the rampart tile type pattern).
4. `docs/decisions/0083-weapon-substrate.md` — bow vertical-infinite precedent (S45). Reference for the magic vertical change.
5. `docs/maps/river-ridge.md` — current map spec, convention reference for the second map's documentation.
6. `core-types.md`, `action-resolution.md`, `map-and-battlefield.md` — foundational; particularly the tile-and-elevation model.
7. `equipment-design.md` (or whatever the current AoE-spec docs are) — for the AoE vertical tolerance design point.

### Paths to survey before planning

Audit determines specifics. The audit's key deliverable is confirming or refining the "relatively light" framing of this session:

- **Map data definitions.** Survey `src/content/maps/` (or equivalent) for River Ridge's representation. Audit: is the map system fully data-driven? Does it accommodate arbitrary dimensions? Are tile types registered via a registry that can take new entries cleanly?
- **Tile-type registry.** Survey terrain-type definitions. Per ADR-0073, terrain types are independent from elevation (`water_shallow` and `water_deep` are distinct types even though elevation 0/1 corresponds). The rampart is a new tile type representing the structure (wall, parapet, etc.) at elevation 8 — same elevation logic, different visual + content identity. Audit confirms the registry pattern.
- **Magic targeting / vertical range.** Survey the targeting predicate path. Specifically: how is vertical range currently computed for magic? Is it a single field on the ability definition (e.g., `verticalRange: 5`)? Multiple fields? Implicit infinite? The audit determines what change is needed.
- **AoE spec model.** Survey current AoE specifications (Geosage Earthquake, Pyromancer Fireball, Hydrologist water spells, etc.). Audit: is there already a vertical-bound concept in AoE? Or does AoE currently apply to all tiles in the horizontal radius regardless of elevation? The change adds `verticalTolerance`.
- **Deployment zone validation.** Survey existing zone validation to confirm the proposed shape (2×4, 8 tiles per side) doesn't trip any "minimum N tiles per zone" constraint for the supported team sizes.

## Goal

End state:

**Map content:**
- Second map authored at 16×16 per Chris's grid layout (in handoff section below).
- Terrain types assigned correctly to each tile (land, water_shallow, water_deep, rampart).
- Deployment zones: north zone (rows 0-1 cols 5-8, 8 tiles); south zone (rows 14-15 cols 5-8, 8 tiles).
- Map metadata authored: name (per D1), dimensions, theme, symmetry, version.
- Map documented in `docs/maps/{name}.md` per River Ridge convention.

**Rampart tile type:**
- New terrain type registered (per D2: name, attributes).
- Engine treatment: behaves as land at elev 8 for pathfinding and combat; carries a distinct tile-type tag for renderer differentiation.
- Renderer placeholder rendering acceptable for v1; Chris will produce final art separately.

**Magic vertical substrate:**
- Single-target magic spells: vertical range effectively infinite (matching bow vertical-infinite precedent from S45).
- AoE spells: gain `verticalTolerance?: number` field; AoE splash from target tile bounded to within ±N elevation (default per D4).
- Existing battles regression-safe: River Ridge battles and Mage War content unchanged in behavior except where vertical targeting interactions surface (most spells in flat or near-flat terrain are unaffected).

**Quality:**
- Tests +20-40 (estimated; map data + targeting changes + AoE tolerance + regression).
- ADR (one is plenty): "Vertical-axis targeting rules" covering single-target magic infinite + AoE vertical tolerance.
- `docs/handoff.md` updated.
- `docs/playtest-watch.md` updated with second-map watch-fors.
- Browser verification: second map selectable, deployment zones work, battle starts and resolves cleanly, magic vertical change visible (test scenarios with mage on flat targeting rampart Hunter, AoE on multi-elevation surface).

## Pre-implementation plan

Audit-first per project conventions. **Plan-review checkpoint between audit completion and content/substrate code-writing** — the audit determines whether this session is the "light" one Chris anticipates or something larger.

### Required first step: current-tree audit

Per "Paths to survey" above. The audit's key deliverable: confirm or refine the "light if built well" framing. Likely outcomes:

- **All data-driven, registry pattern clean, vertical concept already separated** → light session. Map authoring + tile-type registration + small targeting change.
- **One or two pieces need refactor (e.g., AoE doesn't currently have a vertical bound at all, and adding one cascades through several spell definitions)** → medium session. Substrate work fills the gap.
- **Substantive refactor needed (e.g., map system isn't fully data-driven; vertical targeting is implicit across many call sites)** → larger session. Possible split.

Per S40/S42/S43/S45 precedent: engine audits have consistently found things cleaner than briefs assume. Plausibly this audit lands at "light" too.

### Architectural decisions

After audit:

1. **Rampart tile type pattern.** Recommend: new entry in the terrain-type registry, named per D2, with elevation 8 hardcoded in the map data and the tile-type tag carrying renderer identity. Engine pathing/combat treats it as land at elev 8. No special properties (no movement cost variation, no AoE interaction).

2. **Magic vertical range — single-target.** Recommend: vertical range effectively infinite for all single-target magic. Audit may surface that some spells already have this behavior; uniform infinite eliminates the ambiguity.

3. **AoE vertical tolerance.** Recommend: new `verticalTolerance?: number` field on AoE specs; default ~3 (or higher; see D4). AoE splash filtering: tile considered "hit" if it's both within the horizontal AoE radius AND within ±verticalTolerance elevation of the target tile. Audit may surface that some AoE specs already have a vertical concept — reconcile.

4. **Map data shape.** Author the second map as a data file matching River Ridge's pattern. Deployment zones declarative; map dimensions explicit; terrain grid explicit; metadata per River Ridge's `docs/maps/` documentation format.

5. **Documentation.** Author `docs/maps/{name}.md` per River Ridge's spec format: Purpose and Scope, Map Metadata, Elevation Grid, Terrain Features, Deployment Zones, Movement Rules (mostly inherited from River Ridge's rules with notes on any differences), Tactical Character, Engine Requirements (mostly resolved by this session's substrate work), Open Considerations.

### Decision points

(Settled in plan-review.)

**D1 — Map name.** Suggestions:
- *Stonebridge* — descriptive, evocative, easy to remember.
- *Bridgekeep* — emphasizes the fortified character.
- *Riverwatch* — emphasizes the surveillance/defensive position.
- *Channelguard* — guarding the channel.
- *Examiner's Tower* / *Examiner's Watch* — academy-themed if you want Gariland-flavor.
- *Old Bridgehouse* — historical-flavor.

I'd lean **Stonebridge** for clarity and the "stone bridge" being the map's most distinctive feature, with **Bridgekeep** as alternate if you want to emphasize the fortification. Settle in plan-review.

**D2 — Rampart tile type.**
- *Name*: `rampart`, `wall_top`, `parapet`, or similar. Recommend `rampart` for consistency with the architectural term.
- *Attributes*: elevation 8 (hardcoded in map data, not in tile type); walkable; same combat/movement as land; distinct renderer tag for art differentiation. No special properties.

**D3 — Single-target magic vertical range.** Recommend: vertical-infinite uniformly. Matches bow precedent; eliminates ambiguity. Settle in plan-review whether all single-target spells get this or only certain damage types (e.g., is *Lightning Bolt* uniformly vertical-infinite, or only physical-tagged single-targets?). Recommend uniform.

**D4 — AoE vertical tolerance default.** Suggested value: 3 (AoE splash bounded to within ±3 elevation of target tile). Rationale:
- Tolerance 2: very strict; an AoE on the rampart (elev 8) splashes only elev 6-10, which means tiles at the wall foot (elev 0-1 water) are isolated.
- Tolerance 3: similar but with a margin; elev 5-11 includes the wall (elev 8) and tiles up to 3 below (elev 5+ — ridge tops in River Ridge, bridge peaks).
- Tolerance 5+: AoE starts reaching down the cliff. Less elevation insulation.

Tolerance 3 feels right; preserves the elevation-as-insulation tactical concept without making AoE feel arbitrarily restricted. Per-AoE override possible if any specific spell warrants different (e.g., a giant Meteor with tolerance 10). Settle in plan-review.

**D5 — Per-AoE vertical tolerance overrides.** Recommend: each AoE definition can specify its own `verticalTolerance` (defaults to 3). Audit surfaces whether current AoE specs warrant non-default values (likely no — most are flat-ish blasts).

**D6 — Map metadata.** Mostly follows River Ridge convention. Per-field decisions:
- Dimensions: 16×16, confirmed.
- Theme: TBD; Chris settles based on map name. Working: "A fortified river crossing with a defender's keep dominating the southeast corner."
- Symmetry: N-S symmetric for hills + central river; E-W asymmetric (NE flat plain vs. SE walled keep).
- Battle modes supported: 4v4 confirmed (8-tile zones per side).
- Version: v1.0.

**D7 — Default scenario.** Symmetric deployment per Chris's specification: north zone (0,5)-(1,8) and south zone (14,5)-(15,8). 8 tiles each, 2 rows × 4 cols. Race-to-seize the building dynamic.

**D8 — Future scenarios** (documented in map's spec, not implemented this session): asymmetric siege variant (south team starts inside the building, north team starts at far edge) — for future content sessions; NOT in S47 scope.

**D9 — Hill heights (elev 8 at corners).** Flag for playtest watch. Same height as rampart; may or may not be too tall. If playtest reveals hills are auto-take perches that decide early game, drop corners to elev 6 in a future tuning round. Not changed this session.

## Implementation work

### Map content authoring

**Grid layout** (16×16, per Chris's spec):

```
        0   1   2   3   4   5   6   7   8   9  10  11  12  13  14  15
 0:     8   7   5   3   2   2   2   2   2   2   2   2   2   2   2   2
 1:     7   7   5   3   2   2   2   2   2   2   2   2   2   2   2   2
 2:     5   5   5   3   2   2   2   2   2   2   2   2   2   2   2   2
 3:     2   2   2   2   2   2   2   2   2   2   2   2   2   2   2   2
 4:     1   1   1   1   1   1   3   3   1   1   1   1   1   1   1   1
 5:     1   1   1   1   1   1   4   4   1   1   1   1   1   1   2   1
 6:     0   1   1   0   0   0   5   5   0   0   0   0   2   0   2   0
 7:     0   1   0   0   0   0   6   6   0   0   0   2   2   0   0   0
 8:     0   0   1   0   0   0   6   6   0   0   0   0   0   0   0   0
 9:     0   1   1   0   0   0   5   5   0   0   0   2   2   0   2   0
10:     1   1   1   1   1   1   4   4   1   1   1   1   2   1   2   1
11:     1   1   1   1   1   1   3   3   1   1   1   1   1   1   1   1
12:     2   2   2   2   2   2   2   2   2   2   8   8   8   8   8   8
13:     5   5   5   3   2   2   2   2   2   2   8   2   2   2   2   6
14:     7   7   5   3   2   2   2   2   2   2   2   2   2   2   2   4
15:     8   7   5   3   2   2   2   2   2   2   8   8   2   2   2   2
```

**Terrain type assignments:**
- Elevation 0: `water_deep`
- Elevation 1: `water_shallow`
- Elevation 2+: `land` for most tiles
- Elevation 8 in the SE building (rows 12 cols 10-15; row 13 col 10; row 15 cols 10-11): **`rampart`** (new tile type)
- Bridge tiles (rows 4-11 cols 6-7 at various elevations): `land` (the bridge is at elevation, but treated as land terrain — same pattern as ridge tops in River Ridge)

**Deployment zones:**
- North zone: rows 0-1, cols 5-8 (8 tiles)
- South zone: rows 14-15, cols 5-8 (8 tiles)

**Map metadata:**
Per D6, drafted in the map's documentation file.

### Rampart tile type

**Registration:**
- Add `rampart` entry to terrain-type registry.
- Attributes: walkable=true, base movement cost=1 (same as land), no special tags beyond the type itself (no `water` tag for example).
- Renderer: distinct tile-type identifier; placeholder visual until Chris's art lands.

**Tests:**
- Rampart tiles pathable normally (treats as land for movement).
- Rampart tiles support unit placement (occupancy).
- Rampart tile-type tag correctly registered.

### Magic vertical substrate

**Single-target spells (vertical-infinite):**
- Audit current vertical-range model for magic.
- Implement uniform vertical-infinite for single-target spells (or confirm already present).
- Tests: spell targets unit at high elevation across full elevation range; targeting works at delta 0, 5, 10, 20.

**AoE vertical tolerance:**
- Add `verticalTolerance?: number` to AoE specs (default 3).
- Implement filter in AoE resolution: tile considered "hit" only if both within horizontal radius AND within ±verticalTolerance elevation of target tile.
- Audit existing AoE specs (Earthquake, Fireball, etc.) — confirm default works; override per-AoE if specific spells warrant.
- Tests:
  - AoE targets tile at elev 8; tile at elev 5 within horizontal radius is hit (within tolerance 3).
  - AoE targets tile at elev 8; tile at elev 4 within horizontal radius NOT hit (tolerance 3 = max delta 3; elev 4 = delta 4).
  - AoE targets tile at elev 2; tile at elev 5 within horizontal radius is hit (delta 3 = within tolerance).
  - Existing AoE behavior unchanged when target and splash tiles are at same elevation.

### Tests

Estimated +20-40 tests:
- Second map load: ~3.
- Deployment zone validation: ~3.
- Rampart tile type: ~3.
- Magic vertical-infinite single-target: ~5.
- AoE vertical tolerance: ~8 (default value, override, edge cases).
- Existing AoE regression: ~5.
- Map-specific battle scenarios: ~5 (e.g., Hydrologist crossing the river, Hunter on rampart shooting bridge, magic spell up to rampart).

### UI surfaces

- Map selection (if a map-picker UI exists) shows second map.
- Terrain rendering displays rampart tile type (placeholder OK).
- AoE preview displays vertical tolerance bounds (if applicable to existing preview UI — confirm via audit).

### Documentation

- `docs/maps/{name}.md` authored per River Ridge spec convention.
- `docs/decisions/0085-vertical-axis-targeting-rules.md` ADR for the magic vertical + AoE tolerance.

## Acceptance criteria

**Map content:**
- Second map loads cleanly in the team-builder and battle-setup flow.
- Deployment zones validate correctly; 4v4 teams place onto 8-tile zones.
- Pathing on the new map works (river crossings, bridge, building access via gate).
- Hydrologist crosses water at reduced cost per existing M-ability (no regression).
- Knockback into water on bridge respects elevation drop (no regression).

**Rampart tile type:**
- Tile type registered; rampart tiles render with placeholder visual; gameplay treats as land at elev 8.
- Existing battles unaffected.

**Magic vertical substrate:**
- Mage on flat (elev 2) can target Hunter on rampart (elev 8) with a single-target spell — works.
- AoE on rampart (elev 8) splashes to elev 5-11 tiles, not elev 0-4.
- Existing AoE behavior in similar-elevation scenarios unchanged.

**Quality:**
- Tests at 1372-1392, 0 failing.
- ADR 0085 committed.
- `docs/maps/{name}.md` authored.
- `docs/handoff.md` updated.
- `docs/playtest-watch.md` updated with second-map watch-fors.
- Browser verification: load second map, deploy 4v4, play through several turns, magic vertical and AoE tolerance work as expected.

## Out of scope

- **Rampart art production** — Chris handles separately via Gemini.
- **Asymmetric siege deployment** for the second map — future scenario; documented but not implemented.
- **5v5 unlock** — later in roadmap.
- **Equipment expansion** (Hi-Potion / Holy Water / Elixir + accessories) — later.
- **Calculator class** — later.
- **Charm/Seduction substrate** — dedicated future session.
- **Pyromancer R/S/M consolidation** (S41 carry).
- **AI deployment role-aware sorting** (carry; Hunter still sharpens case; not addressed here).
- **Speed Save / Updraft per-swing reaction cap** (S42 D5 deviation).
- **Renderer-side multi-swing animation polish** (S42 carry).
- **Pass-and-play UX refinements** (S43, playtest-driven).
- **Permadeath badge first-playtest visual read** (S41 carry — note: S46 removed the sprite, so the badge is now visually moot; can retire entirely in a future cleanup).
- **content-id-registry.md broader reconciliation** (S44 carry).
- **Border/borderColor React dev warnings** (S43 + S44 carry — note: pre-existing console warnings; not addressed).
- **`assignAiTeamNames` removal** (S44 carry).
- **ActionType-wiring smoke test** (S44 carry).
- **Hill height adjustments** on the second map (recommend playtest-watch first per D9).
- **Interior building staircase** or other map geometry refinements (deferred to playtest signal).
- **Terrain bar mid-battle vanishing** (S46 carry — pending repro).

## Files likely touched

A non-exhaustive list. Audit confirms / corrects.

**Map content:**
- `src/content/maps/{name}.ts` (new) — map data.
- `src/content/maps/index.ts` — register the new map.
- `src/content/scenarios/{name}/` (new directory or extension) — scenario configurations for the new map.

**Engine (substrate):**
- `src/engine/terrain/types.ts` (or equivalent) — rampart tile type registration.
- `src/engine/targeting/range.ts` (or equivalent) — magic vertical-infinite.
- `src/engine/targeting/aoe.ts` (or equivalent) — `verticalTolerance` field + filter.

**Engine (regression check):**
- Existing AoE spell definitions — confirm default `verticalTolerance: 3` works or specify overrides.

**Tests:**
- `src/content/maps/__tests__/{name}.test.ts` (new).
- `src/engine/targeting/__tests__/range.test.ts` — vertical-infinite tests.
- `src/engine/targeting/__tests__/aoe.test.ts` — vertical-tolerance tests.

**Docs:**
- `docs/decisions/0085-vertical-axis-targeting-rules.md` (new ADR).
- `docs/maps/{name}.md` (new map spec).
- `docs/handoff.md` — updated.
- `docs/playtest-watch.md` — second-map watch-fors.

## Workflow notes

- **Plaintext-first review required.**
- **Audit-first with plan-review checkpoint.** Confirm "light" framing or escalate scope.
- **One ADR is sufficient.** Magic vertical-infinite + AoE vertical tolerance are conceptually one rule (vertical-axis targeting).
- **Map name + rampart tile name** are flavor decisions; surface for in-plan-review settlement.
- **Mid-session design questions** route through Chris to the planner. Most likely surfaces: AoE spec audit revealing that current behavior is implicit/scattered rather than centralized; specific AoE specs that need non-default tolerance.
- **Phase F session** — playtest signal continues to accumulate. New watch-fors for the second map (race-to-seize dynamics, building defensibility, hill height adequacy) get added to `docs/playtest-watch.md`.

## Watch-fors

**Addressed this session:**
- Second map authoring and integration.
- Rampart tile type.
- Magic vertical-infinite single-target.
- AoE vertical tolerance.

**Not addressed this session, longer-term carry-forward:**
- 5v5 unlock.
- Equipment expansion.
- Calculator class.
- All long-running carries from prior handoffs.
- Hill height adjustment on second map (playtest-driven).
- Asymmetric siege scenario for second map.

**Watch-fors specific to this session:**

- **Race-to-seize building dynamics.** Symmetric deployment + south-team-closer = some inherent south advantage. Watch whether this is balanced by the new magic vertical (north team can engage rampart from afar) or whether it tips one-sided.
- **Two-Hunter-rampart stress test** (per Chris's playtest plan). If two bows on the rampart is too dominant, the magic vertical rule should be the equalizer — verify in playtest. If it isn't enough, hill height adjustment is the next lever.
- **Defender bottle-up at the gate.** Single-entry chokepoint may favor defenders too strongly. Watch for matches where attackers can't dislodge defenders even with magic + Assassin tools. If consistent, consider: (a) widening the gate to 2 tiles, (b) adding a postern via a future map revision.
- **AI deployment on the new map.** Heuristic places HP-descending into front-center. May place tanks toward the bridge but support classes (Alchemist, Hydrologist) might land middle-ish. Watch whether AI plays the building sensibly or wanders.
- **AoE vertical tolerance edge cases.** Default 3 should work for most spells; surface any spell that feels wrong (e.g., a "Tornado" or "Cyclone" AoE that should reach further vertically). Override per-spell in future tuning.
- **Magic vertical change affecting existing battles.** River Ridge battles will see different magic behavior if any current spells had implicit vertical limits. Most likely impacts: spells targeting cliff-top Hunters or Mages on the ridge. Watch for regression-feel.
- **Existing AoE behavior under new tolerance.** Default 3 should preserve existing flat-terrain AoE. If any existing battle suddenly behaves differently (an Earthquake stops splashing where it used to), the tolerance default may need bumping or per-spell override.

## Estimated size

**Medium-light.** Comparable to S40 (knife weapon class + dynamic variance + Mage rename) — substantive but bounded. Slightly heavier than pure tuning sessions but lighter than substrate-heavy sessions like S42/S45.

**No split contingency anticipated.** The three pieces are independent; if budget runs out, items can stop where they are. Likely ordering: substrate first (vertical-infinite + AoE tolerance) → tile type → map content → documentation/ADR.

**Stretch indicator:** if cleanup completes early, candidates for opportunistic fold-in (all small, all carry):
- `assignAiTeamNames` removal (S44 carry; dead code).
- Border/borderColor React dev warnings (cosmetic).
- Permadeath badge component removal (S41 → S46 → now redundant since the parent sprite hides).
- `content-id-registry.md` second-map row additions (natural fold; the broader pre-S45 staleness is a bigger separate sweep).
