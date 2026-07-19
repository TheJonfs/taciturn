# Map and Battlefield Mechanics

*Design document — v0.2*

## Purpose

This document defines how the spatial elements of combat work: how units move across the map, how range is calculated, how line of sight is determined, how area effects are shaped, and what tile properties exist. It builds on the core types doc (Tile, Map, Unit position) and connects to the ability and CT systems through the targeting/resolution interfaces it defines.

## Movement profile

Each unit has a **movement profile** — a computed value derived from base stats, class, equipment, statuses, and equipped Movement-bucket abilities. The move engine consumes this profile; nothing else in the system needs to know about its inputs.

```typescript
interface MovementProfile {
  moveRange: number;             // how many "movement points" the unit has per turn
  jump: number;                  // max elevation differential per single tile step
  terrainCosts: Map<TerrainType, number>;  // overrides default of 1 per tile
  canEnter: Set<TerrainType>;    // which terrain types the unit can occupy
  specialMovement?: SpecialMovementType;   // teleport, fly, phase, etc.
}
```

Composition rules:

- Base values come from class.
- Equipment, level, and statuses contribute additive or multiplicative modifiers.
- Movement-bucket abilities can modify any field (Move+1 increases moveRange, Jump+2 increases jump, Float adds Water to canEnter, Fly sets specialMovement).
- The composed profile is the input to pathfinding.

This mirrors the CT pattern of computed Speed: base + sources of modification composed at query time. See ADR-0006 for how composition is wired in v1: scalars (`moveRange`, `jump`) flow through `modifyStatQuery`; the structural fields (`terrainCosts`, `canEnter`, `specialMovement`) come from the class baseline today, with their own modifier hook surface deferred until the first consumer ability lands.

## Move engine

```typescript
function getLegalMoves(state: GameState, unitId: UnitId): MovementResult;

interface MovementResult {
  reachable: Map<PositionKey, MovePath>;  // destination → path that gets there
}
```

Pure function. Reads state, computes movement profile, runs pathfinding, returns reachable destinations with paths.

**Pathfinding** uses Dijkstra (variable per-terrain costs require it; A* is overkill since we want all reachable tiles, not a single shortest path). Each reachable tile carries the path used to reach it, for animation and for any "interrupted movement" mechanics (e.g., a trap that fires partway through a move).

**Adjacency.** From any tile, candidate next-tiles are the 4 cardinal neighbors *across all layers at those (x,y)*. A tile at (3, 4, layer 0) considers stepping to (2, 4, layer 0), (2, 4, layer 1), (4, 4, layer 0), etc. — every tile that exists at an adjacent (x,y) position regardless of layer.

**Step legality** between two adjacent tiles requires:
1. Destination tile exists.
2. Destination terrain is in `canEnter`.
3. Destination is not occupied by another unit (allies pass-through is a separate rule, see open questions).
4. Elevation differential ≤ `jump`.
5. (For non-flying units) layer transition rules apply — see below.

**Layer transitions for non-flying units.** A walking unit can step to a tile at a different layer if the elevation differential is within Jump. This naturally handles bridge endpoints (the layer-0 ground tile and the layer-1 bridge surface differ by the bridge's height; if Jump permits, the unit climbs up). Hover/flight positions tend to have elevation = ground + N, so walking units with low Jump can't reach them, while flying units (which ignore jump constraints in favor of their own rules) can.

**Special movement** replaces standard pathfinding:
- *Fly* — moves over tiles ignoring elevation differentials within some flying-specific range; can land on any layer.
- *Teleport* — selects any reachable tile within range, ignoring intermediate path entirely.
- *Phase* — passes through other units (but not walls) during movement.

These are flagged on the profile and the move engine branches accordingly. The profile itself remains the single integration point.

## Range geometry

All non-self-targeting actions specify both a **horizontal range** and a **vertical range**. A target tile is in range iff:
- horizontal_distance(source, target) ≤ horizontal_range, AND
- |elevation(source) − elevation(target)| ≤ vertical_range

`horizontal_distance` is Manhattan distance over (x, y): `|dx| + |dy|`. Layer is not part of horizontal distance — two tiles at the same (x, y) but different layers have horizontal distance 0.

Either range may be 0 (e.g., melee with horizontal_range = 1, vertical_range = 0 means same-elevation only) or effectively infinite (most melee abilities have unlimited vertical range — if you can reach them, you can hit them; some spells have unlimited horizontal but bounded vertical, etc.).

Minimum range is also supported (e.g., an artillery ability that can't fire at tiles too close): `horizontal_range_min` defaulting to 0.

## Targeting modes

Three targeting modes cover the design space. Each ability declares which mode it uses; the engine validates targets against that mode in addition to range.

### Melee

Direct contact targeting. Range is typically small (1) with a configured vertical tolerance. No additional path checks — if it's in range, it's targetable. Used by physical attacks, touch heals, grapples.

### Straight-line (ray-trace)

Ranged with line-of-sight requirement. The engine traces a line from source center to target center in 3D (x, y, elevation) and checks for blockers along the path. The ray's elevation at each intermediate (x, y) is interpolated linearly along the source→target gradient. A blocker is:
- **Terrain mass:** any tile whose ground surface rises *above* the ray (`ray < tile.elevation`, strict) — the ray is buried inside a hill / mesa / raised ground between the endpoints. Strict inequality means a level shot across flat ground and a shot that rides a smooth slope both pass (ray == surface grazes through); only ground that pokes *above* the sightline occludes. (S69 follow-up — previously terrain mass was transparent and only `blocks_los`/barriers occluded.)
- A tile with the `blocks_los` property or a **barrier** whose 1-tall vertical extent crosses the line. `blocks_los` columns graze-pass on both ends (strict `>`…`<`); barriers use an inclusive floor (`>=`) so a wall between two same-elevation units blocks the eye-level ray.
- (Optionally, by ability) any other unit between source and target. *(Not yet implemented.)*

Ties at exact tile boundaries lean toward "doesn't block" to keep play feeling generous. Used by the straight-line spells (and any ability flagged `straight_line`); **not** bows, which arc. A Vantage wielder's *source* elevation reads +2 (ADR-0115), letting it see over cover it otherwise couldn't.

> **S96 (bridges, ADR-0155) — the multi-layer limit is closed.** A layer ≥ 1 tile is a DECK, not bedrock: it occludes only its thin body, the open band `(elevation − BRIDGE_DECK_THICKNESS, elevation)` (thickness 1, mirroring the Barrier's height-1 convention pointed downward). Rays pass over the deck top, graze the underside, and travel clean beneath. Bedrock occlusion (`ray < elevation` blocks) applies to layer-0 tiles only.

### Arc

Ranged with no straight-line requirement, but with overhead-clearance rules:
- Source tile must not be covered: no tile at higher layer at source's (x, y).
- Target tile must not be covered: no tile at higher layer at target's (x, y).
- **Bounded apex (S69 follow-up):** an intermediate tile blocks the lob only when its ground surface rises *more than `ARC_LOB_CLEARANCE` (5) above the higher of the two endpoints*. So walls, buildings, and low humps are lobbed over (the FFT "shoot over cover" feel) but a genuine mountain blocks. The clearance is a flat ceiling above the higher endpoint, not a true parabola — generous near the endpoints by design (you can lob over an adjacent wall). `5` mirrors the bow's height-delta damage falloff (a bow already deals 0 at a +5 delta), and Vantage is *not* folded into the apex.

Used by bows (the "lobs over cover" sense), grenades, mortars, rain-of-arrows. Bridges and ceilings provide cover from arcs but not from straight-line attacks (and vice versa, conveniently — though a deck's own thin band does block straight-line rays crossing it; see above).

> **S96 exemption (ADR-0155):** elevation Worldcraft (Pillar/Pit/Hill/Valley) bypasses the arc cover gate — it shapes the earth from below, not a projectile from above. Without the exemption nothing could ever target the ground beneath a span, and the bridge RAM rule would be unreachable. Barrier placement (tile_set) and every other arc ability keep the cover rule.

## Area of effect

AoE-bearing abilities specify a **shape**, an **anchor**, and a **vertical tolerance**.

- **Shape** is a 2D footprint relative to the anchor: single tile, line, cross, diamond (Manhattan radius), square (Chebyshev radius), cone, custom pattern. Engine treats shapes as a relative-coordinate set.
- **Anchor** is what the shape is positioned around: target tile, source tile, line from source to target, etc.
- **Vertical tolerance** is the maximum |elevation differential| from the anchor's elevation that an affected tile can have. A bomb with vertical tolerance 1 hits tiles at the anchor's elevation ± 1; tiles at greater height differentials are untouched. This is what enables the FFT-style positional play where clever placement avoids AoE.

For each candidate tile in the shape's footprint at the anchor:
- Check that a tile exists at that (x, y) within vertical tolerance.
- If multiple tiles at that (x, y) qualify (e.g., ground tile and bridge tile both within tolerance), all qualifying tiles are affected — units on each get hit independently.

This last rule is interesting: a fireball at ground level under a bridge could hit both a unit standing on the ground and a unit on the bridge above, if the bridge is within vertical tolerance. **S96 (ADR-0155): confirmed as the ruling** — vertical tolerance alone decides which layers a blast reaches (a tolerance-2 spell under a deck 4 above leaves the bridge-standers safe; a low span catches both). A per-ability `layerScope` override ('all' | 'highest' | 'lowest') remains the natural extension, deliberately unbuilt until an ability wants it.

## Tile properties

Tiles carry a list of `TileProperty` flags and parameters. The engine reads them and applies effects at appropriate points.

Initial property categories (extensible):

- **Movement-affecting:** blocks_movement (unwalkable), forced_movement (slippery; movement continues until off the tile), terrain_cost_override (per-tile cost, in addition to per-terrain costs).
- **Combat-affecting:** blocks_los (occludes straight-line targeting), grants_cover (modifies hit chance for units on tile, or for attackers targeting through tile), elevation_bonus (modifies attack stats for units on tile — e.g., archer high-ground bonus).
- **Effect tiles:** hazard (deals damage or applies status to units on tile, on a tick or turn cadence), heal_tile (inverse), trigger_tile (fires an action when entered), objective_tile (relevant to win conditions).

The engine processes these via hooks at well-defined moments: movement step (terrain costs, forced movement, triggers), turn start/end (hazards), targeting (blocks_los, cover), damage calc (elevation_bonus). Each hook is a single function that takes the tile context and the active operation; new properties are added by registering a new hook handler.

## Decisions captured

- Movement is governed by a computed MovementProfile; move engine is a pure function of state.
- Pathfinding uses Dijkstra to support variable terrain costs.
- Adjacency considers all layers at neighboring (x, y); step legality includes elevation differential vs. Jump.
- Layer transitions for walking units fall out of elevation/Jump checks; no separate "transition tile" concept needed.
- Special movement (fly, teleport, phase) replaces standard pathfinding; profile flags which is in use.
- Range has separate horizontal and vertical components; targets must pass both.
- Three targeting modes: melee, straight-line, arc. Variants are properties on top.
- Arc requires source and target tiles to be uncovered (no tile at higher layer at their x,y); ignores intermediate obstacles.
- AoE specifies shape, anchor, and vertical tolerance; multiple qualifying layers at same (x,y) all affected by default.
- Tile properties are a flexible flag system processed via well-defined hooks.

## v1 starting parameters

- Default per-terrain movement cost: 1 for all entered terrain (parameter, not hardcoded).
- Default melee horizontal range: 1; default melee vertical range: TBD per weapon (likely 2-3).
- Default minimum range: 0 (no minimum).
- Targeting mode is a required field on every ability definition.
- Vertical tolerance for AoE is a required field; default per-ability designer choice.

## Open questions / deferred

- **Hit-chance and cover modifiers from elevation differential.** FFT had "shooting downhill = bonus" — exact formula and which targeting modes it applies to is to-be-tuned.
- **Friendly pass-through.** Can a unit move through allies' tiles? FFT yes (allies are passable, enemies block). Confirm and parameterize.
- **AoE multi-layer behavior.** Default rule (all qualifying layers affected) is generous; some abilities may want "highest layer only" or "lowest layer only." Worth a per-ability flag.
- **Straight-line tie-breaking.** When the trace passes exactly along a tile edge or corner, does it block or pass? Pick a convention.
- **Whether other units block straight-line LoS by default.** FFT mostly didn't (you could shoot past your friends). Lean toward "no" for v1, with `pierces_units` and `blocked_by_units` as ability flags.
- **Forced movement collision.** What happens when a unit is pushed/pulled into an occupied tile or off the map? (Common answers: damage, cancel, swap.) Defer.
- **Trigger tiles and their ordering.** When does a "trigger on enter" fire vs. movement continuing? Likely between move steps; specifics later.
- **Performance bounds on pathfinding.** With moderate map sizes (say 20×20 with 1-2 layers) Dijkstra is trivial; if maps grow large, may need spatial indexing. Not a v1 concern.
