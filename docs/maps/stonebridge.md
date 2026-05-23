# Map: Stonebridge

*v1 — Session 47. The second authored Mage War map; a fortified river crossing with a defender's keep dominating the southeast corner.*

## Purpose and Scope

Stonebridge is the second playable Mage War map, designed to:

- Add a **defensible high-elevation position** (the SE keep at elev 8, walled with `rampart` terrain) so the engine's elevation-rich tactical layer gets exercised at full vertical reach. Where River Ridge's high perch (elev 9 cliff) is a natural ridge, Stonebridge's keep is *architecture* — a structure units climb into rather than walk around.
- Stress the **magic vertical substrate** added in S47 (per ADR-0085): from flat ground (elev 2), a Mage targets the rampart (elev 8) at a 6-elevation delta — only possible after uniform magic vertical-infinite. Two Hunters on the rampart get magic as the equalizer.
- Provide a **central river crossing with a real bridge** instead of River Ridge's per-class water lane. The bridge's elev-6 peak rewards positioning; the deep channel either side gates non-water-walkers to the bridge or to a slow wade.
- Surface **race-to-seize dynamics** for symmetric deployment — both teams reach the river crossing at approximately the same turn count; the building is closer to Red's spawn, creating an inherent (but tunable) defender advantage that this session flags for playtest watch.

This is the *second* tactical theme after River Ridge's open-ridge baseline; future maps will lean harder into specific dimensions (heavy choke points, hazardous terrain, multi-layer features).

## Map Metadata

- **Name**: Stonebridge
- **Dimensions**: 16 × 16 tiles, single layer
- **Theme**: A fortified river crossing with a defender's keep dominating the southeast corner
- **Symmetry**: N-S symmetric for the river crossing and corner hills; E-W asymmetric (NE flat plain vs. SE walled keep)
- **Battle modes supported**: 4v4 Mage War (zones support 4 units per side, 8 tiles each)
- **Version**: v1.0

## Elevation Grid

Elevation convention (universal across all maps; ADR-0073):
- **0**: Deep water — high traversal cost, knockback target
- **1**: Shallow water — moderate traversal cost
- **2**: Land at base reference — flat ground, deployment zones
- **3-9**: Land at higher elevations — bridge piers, ridge tiers, hills, ramparts

```
        0   1   2   3   4   5   6   7   8   9  10  11  12  13  14  15
 0:     8   7   5   3   2   2  2B  2B  2B  2B   2   2   2   2   2   2
 1:     7   7   5   3   2   2  2B  2B  2B  2B   2   2   2   2   2   2
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
12:     2   2   2   2   2   2   2   2   2   2   8R  8R  8R  8R  8R  8R
13:     5   5   5   3   2   2   2   2   2   2   8R  2   2   2   2   6
14:     7   7   5   3   2  2R  2R  2R  2R   2   2   2   2   2   2   4
15:     8   7   5   3   2  2R  2R  2R  2R   2   8R  8R  2   2   2   2
```

`B` = Blue deployment zone (rows 0-1, cols 5-8, 8 tiles)
`R` (in deployment-zone rows 14-15) = Red deployment zone (rows 14-15, cols 5-8, 8 tiles)
`R` (at elev 8 in rows 12, 13, 15) = `rampart` terrain — the keep's walls (9 tiles total)

## Terrain Features

### The River (rows 4-11)

Runs east-west across the map's midsection. Water depth varies:

- **Cols 0**: All deep water (elev 0); the deepest, hardest-to-cross channel.
- **Cols 1-5, 8-15**: Mix of shallow (elev 1) and deep (elev 0); some single-tile islands at elev 2.
- **Cols 6-7**: The bridge (see below).

The deep channel through cols 0-5 (rows 6-9) is a real barrier — non-water-walkers route to the bridge or pay the wade cost (water_deep is 3 movement points per tile). Single-tile islands at (12, 6), (14, 6), (14, 5), (11, 7), (12, 7), (11, 9), (12, 9), (14, 9), (14, 10), (12, 10) provide stepping stones for movement-specialist units.

### The Bridge (cols 6-7, rows 4-11)

A two-tile-wide stone bridge spanning the river N-S. Elevation rises from the banks toward the mid-span:

| Row | Elevation | Character |
|---|---|---|
| 4 | 3 | North pier — single step up from the flat plain |
| 5 | 4 | Approach |
| 6 | 5 | Climbing the arch |
| 7-8 | 6 | Peak of the arch — mid-span |
| 9 | 5 | Descending |
| 10 | 4 | Approach |
| 11 | 3 | South pier |

The bridge is `ground` terrain (at elevation) — the convention from River Ridge's ridge sections. Knockback off the bridge into water at delta-3 to delta-6 generates substantial fall damage.

### The SE Keep (rows 12-15, cols 10-15)

A fortified building dominating the southeast corner. Walls are `rampart` terrain at elev 8:

- **North wall**: row 12, cols 10-15 (6 rampart tiles)
- **West wall**: (10, 13) and (10, 15) — 2 rampart tiles; the gate is at (10, 14), a single-tile opening at elev 2 ground
- **South wall**: row 15, cols 10-11 (2 rampart tiles)

Total: **9 rampart tiles**. The keep's interior (rows 13-15, cols 11-15) is ground at varying elevation — mostly elev 2 (interior floor), with the SE corner reading back to the ridge tier (rows 13-14 col 15 at elev 6, 4).

The keep is the map's defining tactical feature:
- A defender on the rampart has elev-8 line of sight over most of the map and significant fall-damage protection.
- The single-tile gate (10, 14) is a chokepoint — defenders bottle attackers at the entrance.
- Magic from beyond the wall is the canonical answer; per ADR-0085, all magic ignores vertical range, so a Mage on flat ground can target the rampart freely.

### Corner Hills (rows 0-2 cols 0-2, rows 13-15 cols 0-2)

Two corner hills at elev 8 (top-left, bottom-left) provide secondary high-ground positions. Same elevation as the rampart — flagged in S47 as a playtest watch-for (decision D9): if hills feel too tall and dominate early-game positioning, they get dropped to elev 6 in a future tuning round.

### Flat Plain

The main playing field where most engagement resolves. Rows 0-3 and 12 mostly flat ground (elev 2) outside the corner hills and the keep's walls. The plain is bisected by the river.

### Deployment Zones

- **Blue zone**: rows 0-1, cols 5-8 (2 wide × 4 deep = 8 tiles)
- **Red zone**: rows 14-15, cols 5-8 (2 wide × 4 deep = 8 tiles)

Both zones are entirely flat (elev 2) on `ground` terrain. 8 tiles per side supports 4 placement slots + 4 extras for the v1 4v4 mode.

The symmetric deployment with the building dominating the SE corner produces an inherent (but tunable) defender advantage for Red — Red's deployment is closer to the keep gate. This is intentional for the race-to-seize default scenario but flagged for playtest watch.

## Movement Rules

Inherited from River Ridge / the universal water-table convention (ADR-0073):

- **Land tile (elev ≥ 2, terrain = `ground` or `rampart`)**: 1 move point per tile (ruleset default)
- **Shallow water (elev 1)**: 2 move points per tile
- **Deep water (elev 0)**: 3 move points per tile

### Rampart Pathing

Rampart tiles behave as land at elev 8 for pathfinding:
- Walkable by every class (each class's `canEnter` set includes `'rampart'` per S47 substrate work).
- Cost defaults to 1 move point (no entry in `pathfinding.defaultTerrainCosts`).
- Carries the `'land'` terrain tag — composes with future land-aware passives without enumerating the literal.
- A unit on the rampart steps off through the gate (10, 14) or by jump (requires Jump ≥ 6, since the rampart is elev 8 and adjacent ground is elev 2 — out of reach without a strong jump or fall).

### Jump-Over-Water

Same as River Ridge: a unit with Jump ≥ 1 can leap one water tile in a cardinal direction, paying 2 movement points total. Stonebridge's water layout has fewer cross-water leap routes than River Ridge — the bridge is the natural crossing.

### Knockback Into Water

Same as River Ridge. Off the bridge's elev-6 peak into adjacent water (elev 0-1) is a 5-6 elevation drop — severe fall damage on top of the water-landing handling.

## Tactical Character

### Engagement Geometry

Blue (rows 0-1) to bridge piers (row 4) = 3 rows; Red (rows 14-15) to bridge piers (row 11) = 3 rows. Both sides reach the bridge in turn 2 at Move 3. The bridge's elev-6 peak is contested at turn 3-4.

The keep's gate (10, 14) is 5 rows + ~4-5 cols from Red's spawn (~6-7 tiles diagonally, accounting for Move + Movement-bucket); Blue must traverse the bridge AND the keep's exterior wall, ~12-13 tiles minimum — Blue arrives at the keep approximately 2-3 turns after Red can be inside it.

### Three Distinct Combat Zones

**The Bridge (cols 6-7)**: The central engagement. The mid-span at elev 6 is high enough to deny low-jump units a quick climb but low enough that the bridge isn't a fortress. Both teams converge here. Knockback off the bridge sides drops 5-6 elevation into water — a high-stakes lane.

**The Keep (rows 12-15, cols 10-15)**: Red's natural fortress. The single-tile gate is a chokepoint; the elev-8 rampart provides ranged perches. Magic from beyond the wall is the equalizer.

**The Plain (cols 0-5 and 8-9 in rows 0-3, 12)**: Open ground for melee engagements that bypass the bridge. The corner hills (cols 0-2 at top/bottom) offer minor high-ground perches.

### Knockback Damage Tiers

The map provides graduated fall-damage scenarios:

- Knockback from the bridge peak (elev 6) into water (elev 0-1): 5-6 elevation drop, significant damage + water-landing.
- Knockback from the rampart (elev 8) into adjacent ground (elev 2): 6 elevation drop, severe damage.
- Knockback from corner hills (elev 8) into the flat plain (elev 2): 6 elevation drop, parity with rampart.

### Magic Vertical Interactions (S47 / ADR-0085)

Per ADR-0085, every magic-tagged ability now reaches across any elevation delta. Stonebridge is the first map where this matters significantly:

- A Mage on flat ground (elev 2) targets the rampart (elev 8) with single-target spells freely.
- AoE casts on the rampart splash within ±3 elevation by default (tolerance bumped 1 → 3 in S47), covering the rampart itself (8), adjacent walls, and tiles down to elev 5. Aether-Bloom-equipped Mages widen this to ±4.
- Existing River Ridge battles see roughly identical magic behavior (most engagements were flat or near-flat) but vertical-targeting interactions on the ridge perch now work where they previously hit a vertical cap.

## Engine Requirements

All requirements are satisfied by the S47 substrate and prior sessions:

- **`rampart` terrain type** registered in `ruleset.terrain.tags` with the `'land'` tag (S47).
- **Magic vertical-infinite** authored per-ability via `vertical: 99` on all magical actives (S47, mirroring the bow precedent from ADR-0083).
- **AoE vertical-tolerance default 3** in `rangeDefaults.aoeVerticalTolerance` (S47).
- **`modifyAoeVerticalTolerance` hook** consumed by Aether Bloom for the +1 widen (S47 / ADR-0085).
- **8-tile deployment zone validation** — the map validator (ADR-0073) accepts the 4v4 4-unit minimum against 8 zone tiles per team.
- **Pathfinding / movement cost / knockback / cliff-edge rendering** all inherit from River Ridge's substrate (no new requirements).

## Open Considerations

- **Hill heights at the corners (D9 watch).** Elev 8 corner hills at (0, 0), (0, 15) are *the same height as the rampart*. If playtest reveals corner hills are auto-take perches that decide early-game positioning, drop them to elev 6 in a future tuning round.
- **Defender bottle-up at the gate.** The single-tile gate (10, 14) may favor defenders too strongly. If matches consistently show attackers can't dislodge defenders even with magic + Assassin tools, consider widening the gate to 2 tiles or adding a postern via map revision.
- **Race-to-seize balance.** Symmetric deployment + south-team-closer to the keep produces inherent Red advantage. Watch whether magic vertical (Blue can engage rampart from afar) balances this or whether the building is consistently Red's by turn 2-3.
- **Hill-vs-rampart visual distinction.** Hills at (0, 0) and (0, 15) read as `ground` terrain at elev 8; the rampart at (10, 12)-(15, 12), (10, 13), (10, 15)-(11, 15) reads as `rampart`. Once Chris's rampart art lands, the visual differentiation should be obvious; until then the placeholder fills (warm stone for rampart, ground palette for hills) at the same elevation 8 may read as the same material to first-time players. Playtest watch.
- **AI deployment quality.** The current heuristic places HP-descending into front-center. May place tanks toward the bridge but support classes might land middle-ish. Watch whether AI plays the building sensibly or wanders.
- **Asymmetric "siege" variant (D8 / future).** Future scenario: south team starts inside the building (positioned around the interior tiles), north team starts at the far edge (rows 0-1). Documented here for the design space, not implemented this session. A future content session adds this as an alternate scenario.
- **Versioning.** This is Stonebridge v1.0. Revisions during playtest get versioned (v1.1, v1.2, etc.) so saved replays stay tied to a specific map version and don't desync.
