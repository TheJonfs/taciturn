# Map: River Ridge

*v1 — first playable map for Mage War, designed for testing and baseline play.*

## Purpose and Scope

River Ridge is the first true map for Mage War, intended to serve as the baseline for early playtesting and engine validation. It's deliberately built with:

- A central elevation feature (the ridge) that exercises all major engine mechanics: vertical line of sight, knockback fall damage at multiple severity tiers, elevation-based combat modifiers, and movement cost based on terrain.
- A water region (the river) with islands that exercises water movement mechanics, depth-based traversal cost, and the Water Mage M-ability and future Walk-on-Water passive interactions.
- Symmetric N-S layout for fair testing of class and equipment balance.
- Asymmetric E-W features that create distinctive tactical zones (water lane to the west, soft ridge passage at center-west, ranged perches on the east).

The map is deliberately the "neutral" testing ground; future maps will lean harder into specific tactical themes (heavy choke points, hazardous terrain, multi-layer features).

## Map Metadata

- **Name**: River Ridge
- **Dimensions**: 14 × 14 tiles, single layer
- **Theme**: A ridge-line with a river running along its western flank, dotted with small islands
- **Symmetry**: N-S symmetric; E-W asymmetric
- **Battle modes supported**: 4v4 Mage War (zones support 4 units per side with placement flexibility)
- **Version**: v1.0

## Elevation Grid

Elevation convention (universal across all maps):
- **0**: Deep water — high traversal cost, knockback target
- **1**: Shallow water — moderate traversal cost
- **2**: Land at base reference — flat ground, islands, deployment zones
- **3-9**: Land at higher elevations — ridge tiers

```
        0   1   2   3   4   5   6   7   8   9  10  11  12  13
 13:    0   0   1   2   2  2R  2R  2R  2R   2   2   2   2   2
 12:    0   0   1   2   2  2R  2R  2R  2R   2   2   2   2   2
 11:    0   0   1   2   2  2R  2R  2R  2R   2   2   2   2   2
 10:    0   0   1   2   2   2   2   2   2   2   2   2   2   2
  9:    0   2   1   2   2   2   2   2   2   2   2   2   2   2
  8:    0   2   1   2   3   4   7   7   7   7   9   9   9   9
  7:    0   0   2   2   3   4   7   7   7   7   9   9   9   9
  6:    0   0   1   2   3   4   7   7   7   7   9   9   9   9
  5:    0   2   1   2   2   2   2   2   2   2   2   2   2   2
  4:    0   2   1   2   2   2   2   2   2   2   2   2   2   2
  3:    0   0   1   2   2   2   2   2   2   2   2   2   2   2
  2:    0   0   1   2   2  2B  2B  2B  2B   2   2   2   2   2
  1:    0   0   1   2   2  2B  2B  2B  2B   2   2   2   2   2
  0:    0   0   1   2   2  2B  2B  2B  2B   2   2   2   2   2
```

R = Red deployment zone (12 tiles total)
B = Blue deployment zone (12 tiles total)

## Terrain Features

### The Ridge (rows 6-8, columns 3-13)

A west-to-east rising ridge that forms the central tactical landmark.

| Column | Elevation | Character |
|---|---|---|
| 3 | 2 | Level with surrounding flat — the western foot, easy passage |
| 4 | 3 | Gentle 1-elevation rise |
| 5 | 4 | Continuing gentle climb |
| 6-9 | 7 | Sharp 3-elevation jump — significant climb cost, real tactical commitment |
| 10-13 | 9 | Another 2-elevation jump — high perch, primarily for ranged units |

The ridge creates a layered engagement structure. Melee units gravitate toward the western passage (cols 3-5) where elevation cost is minimal; ranged units occupy the eastern perches (cols 10-13) for line-of-sight advantage; the central ridge sections (cols 6-9) require real climb cost or knockback risk to cross.

### The River (columns 0-2)

A western water region running the full N-S length of the map.

- **Column 0**: All deep water (elev 0)
- **Column 1**: Mostly deep; islands at rows 4-5 and 8-9 (elev 2)
- **Column 2**: Mostly shallow water (elev 1); island at row 7 (elev 2)

The river creates a class-tied tactical zone. The deep channel between the two col-1 islands at rows 6-7 is a real barrier — 6 move points for a stock unit to cross, prohibitive in a single turn.

### Islands

Three island patches (5 tiles total):
- 2-tile island at (col 1, rows 4-5) — Blue half
- 2-tile island at (col 1, rows 8-9) — Red half
- Single-tile island at (col 2, row 7) — center, adjacent to the ridge's western foot

Islands serve as stepping stones for movement-specialist units, ambush positions, and targets for knockback effects.

### Flat Plain

The main playing field where most engagement occurs. All elevation 2. Spans rows 0-5 and 9-13 in cols 3-13 (excluding deployment zones, which are also flat).

### Deployment Zones

- Red zone: rows 11-13, cols 5-8 (4 wide × 3 deep = 12 tiles)
- Blue zone: rows 0-2, cols 5-8 (4 wide × 3 deep = 12 tiles)

Both zones are entirely flat (elev 2), inset from corners to leave room for repositioning and to constrain players' paths through the central engagement zone.

## Movement Rules

Movement costs depend on the terrain of the tile being entered:

- **Land tile (elevation ≥ 2)**: 1 move point per tile
- **Shallow water (elevation 1)**: 2 move points per tile
- **Deep water (elevation 0)**: 3 move points per tile

### Jump-Over-Water Rule

A unit with `Jump ≥ 1` may leap over exactly one water tile (any depth) in a cardinal direction, provided the destination is a land tile (elev ≥ 2). The leap pays 2 move points total (1 for the leaped-over tile, treated as land cost; 1 for the destination).

Constraints:
- Only one water tile per leap (consecutive water tiles still require walking)
- Destination must be land
- Cardinal direction only (no diagonal leaps)
- Pathfinder considers Jump-over-water as a valid move option when computing reachable tiles

### Water Mage M Ability

The Water Mage's class movement ability reduces water-tile move cost by 1 (minimum 1):
- Shallow water becomes 1 move point (effectively land speed)
- Deep water becomes 2 move points

Applies to walking through water; does not modify Jump-over leap costs (which already pay land-equivalent cost).

### Knockback Into Water

Knockback resolves position deterministically. If the resolved position is a water tile, the unit ends up there regardless of their Walk-on-Water status. They escape on subsequent turns at standard water-tile cost. Falls into water from height also generate fall damage based on the elevation difference (e.g., knocked off the ridge at elev 7 into shallow water at elev 1 = 6-elevation drop, significant fall damage).

## Tactical Character

### Engagement Geometry

Distance from blue zone front (row 2) to red zone front (row 11) is 9 rows. The ridge sits at the midpoint (rows 6-8). At Move 3, ground-bound units reach the ridge by turn 2 and contest the western passage by turn 3-4. Mages with range 4+ can engage from turn 2-3, especially after taking ridge elevation for height advantage.

### Three Distinct Combat Zones

**Western Passage (cols 3-5)**: The "soft" passage. Melee units gravitate here because elevation cost is low. This is where most early-battle pressure resolves.

**Eastern Perch (cols 10-13)**: High ridge serves as a ranged unit's vantage point. A unit at elev 9 has clear LoS over most of the map. The 7-elevation drop to surrounding flat is severe — knockback off this section deals catastrophic fall damage.

**Western Water Lane (cols 0-2)**: Class-tied territory. A Water Mage with their M ability patrols col 2 at near-land speed. Without the ability, water is a meaningful detour. The deep channel at col 1 rows 6-7 keeps the two col-1 islands tactically separated for non-water-walkers.

### Knockback Damage Tiers

The map provides graduated fall-damage scenarios for testing:

- Knockback from cols 4-5 (elev 3-4) onto adjacent flat: 1-2 elevation drop, minor damage
- Knockback from cols 6-9 (elev 7) onto adjacent flat: 5 elevation drop, significant damage
- Knockback from cols 10-13 (elev 9) onto adjacent flat: 7 elevation drop, severe damage
- Knockback from any ridge section into shallow water (elev 1): drop magnitude scaled, plus the unit lands in water and may struggle to escape
- Knockback into deep water (elev 0): even larger drop, plus harder escape

## Engine Requirements

Items requiring engine implementation to support this map. Bundle with the equipment-doc engine requirements when passing to implementation.

- **Elevation/water-table convention.** Tiles at elevation 0 are deep water (move cost 3, rendered as deep water visually); elevation 1 is shallow water (move cost 2, rendered as shallow water); elevation 2+ is land (move cost 1). Convention is universal across all maps; future terrain-manipulation effects modify elevation, with water effects emerging automatically from the elevation alone — no separate "water" terrain type needed.
- **Movement cost by elevation tier.** Land = 1, shallow water = 2, deep water = 3. Defaults overridable per-terrain-type for future terrain types (swamp, ice, sand, etc.).
- **Jump-over-water pathfinding.** A unit's reachable-tile computation must consider Jump-over-water leaps in addition to standard adjacent moves: any cardinal leap over exactly one water tile to a land tile, paying 2 move points. Requires `Jump ≥ 1`.
- **Water Mage M-ability move-cost reduction.** Hook into the per-tile move-cost resolution chain; when a water tile would cost N move points and the moving unit has the Water Mage M ability, reduce by 1 (minimum 1).
- **Knockback resolves into water.** Deterministic position resolution; water-tile destinations allowed regardless of Walk-on-Water status. Unit escapes on subsequent turns at standard water cost.
- **Tile property: deploymentZone.** Tiles tagged 'team_a', 'team_b', or null (default). Map validation: each map must contain at least N zone tiles per team, where N is the largest team size the battle config supports.

## Open Considerations

- **Map balance after first playtest.** The western passage may prove dominant if movement-heavy team comps converge there reliably. If so, consider adding a minor obstacle at col 4 row 7 or raising col 3's elevation slightly to spread engagement laterally.
- **Eastern flank engagement.** No easy passage on the east currently — units who climb the high ridge must contend with the ridge itself rather than crossing it. If a battle pattern emerges where one team always takes the east and the other can't contest, consider adding a "valley" cut at rows 7-8 cols 11-12 dropping to elev 4. Defer until playtest reveals whether this is a real problem.
- **Visual rendering.** The 2D placeholder renderer needs to visually distinguish: water at depth 0 vs. 1 (different blue tones?), the ridge sections at their distinct elevations (gradient or distinct color tiers), deployment zone overlay (subtle red/blue tints). Renderer-side detail to settle when implementation begins.
- **Versioning.** This is River Ridge v1.0. Revisions during playtest get versioned (v1.1, v1.2, etc.) so saved replays stay tied to a specific map version and don't desync.
