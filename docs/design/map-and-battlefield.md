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

Ranged with line-of-sight requirement. The engine traces a line from source center to target center in 3D (x, y, elevation) and checks for blockers along the path. A blocker is:
- A tile with the `blocks_los` property whose elevation crosses the line.
- (Optionally, by ability) any other unit between source and target.

Ties at exact tile boundaries are resolved by a documented rule (lean toward "doesn't block" to keep play feeling generous, but specifics TBD). Used by bows, beams, gaze attacks, most direct-fire ranged.

### Arc

Ranged with no straight-line requirement, but with overhead-clearance rules. Arc validates simply:
- Source tile must not be covered: no tile at higher layer at source's (x, y).
- Target tile must not be covered: no tile at higher layer at target's (x, y).

That's it. No ray trace through intermediate tiles. The arc is conceptually high enough that walls and units between source and target are irrelevant. Used by crossbows (in the "lobs over cover" sense), grenades, mortars, rain-of-arrows. Bridges and ceilings provide cover from arcs but not from straight-line attacks (and vice versa, conveniently).

## Area of effect

AoE-bearing abilities specify a **shape**, an **anchor**, and a **vertical tolerance**.

- **Shape** is a 2D footprint relative to the anchor: single tile, line, cross, diamond (Manhattan radius), square (Chebyshev radius), cone, custom pattern. Engine treats shapes as a relative-coordinate set.
- **Anchor** is what the shape is positioned around: target tile, source tile, line from source to target, etc.
- **Vertical tolerance** is the maximum |elevation differential| from the anchor's elevation that an affected tile can have. A bomb with vertical tolerance 1 hits tiles at the anchor's elevation ± 1; tiles at greater height differentials are untouched. This is what enables the FFT-style positional play where clever placement avoids AoE.

For each candidate tile in the shape's footprint at the anchor:
- Check that a tile exists at that (x, y) within vertical tolerance.
- If multiple tiles at that (x, y) qualify (e.g., ground tile and bridge tile both within tolerance), all qualifying tiles are affected — units on each get hit independently.

This last rule is interesting: a fireball at ground level under a bridge could hit both a unit standing on the ground and a unit on the bridge above, if the bridge is within vertical tolerance. We may want to constrain this for some abilities ("vertical tolerance applies, but only to the highest qualifying layer") — flagged as an open question.

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
