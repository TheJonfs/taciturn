# Map: Marshmoor

*v1 — Session 52. The third authored battlefield; a wetlands archipelago of scattered islands, two central flats, and two corner peaks, fought across opposite-corner deployment zones.*

## Purpose and Scope

Marshmoor is the third playable map, designed to:

- Make **water-mobility the defining axis**. Where River Ridge had a per-class water lane and Stonebridge a single bridged crossing, Marshmoor is *mostly water* — land is scattered islands and a pair of central flats. Crossing is an island-hop or a wade. Deep water is universally enterable (ADR-0073) but costs 3 move points (2 with Tidewalker), so the map taxes heavy melee (a Knight crossing the marsh pays dearly) and sharply raises the value of Tidewalker / Hydrologist water builds.
- Provide the **longest pre-engagement window** of any v1 map. The two 3×3 deployment zones sit in *opposite* corners, 26 Manhattan tiles apart. Even a hasted Assassin needs a couple of turns to reach the enemy, leaving room for buffing, setup positioning, and (in the eventual Terraformer arc) terrain manipulation before the lines meet.
- Exercise the **bow range-from-height mechanic** (S52). The two corner peaks (NW elev 5, SE elev 6) are premium archer perches: a Hunter shooting downhill gains both the existing height-delta *damage* bonus (ADR-0083) and the new horizontal *range* bonus. But the peaks are off-axis — they sit in the corners *not* used for deployment, so claiming high ground pulls a unit toward a corner and away from the central flats. High ground is earned with tempo, not free.

This is the third tactical theme after River Ridge's open ridge and Stonebridge's fortified crossing; Marshmoor leans into mobility and terrain-as-obstacle.

## Map Metadata

- **Name**: Marshmoor
- **Dimensions**: 16 × 16 tiles, single layer
- **Theme**: A wetlands archipelago — island-hopping terrain with two corner peaks and a pair of central flats
- **Symmetry**: Rotationally symmetric in intent (deployment corners and their near-peaks are point-symmetric about the center); the elevation detail is hand-varied, not mirror-exact
- **Battle modes supported**: 5v5 (each deployment zone is 9 tiles, supporting 5 placements plus spares)
- **Version**: v1.0

## Elevation Grid

Elevation convention (universal across all maps; ADR-0073):
- **0**: Deep water — high traversal cost (3 MP), knockback target
- **1**: Shallow water — moderate traversal cost (2 MP)
- **2**: Land at base reference — flat ground, deployment zones
- **3-6**: Land at higher elevations — island rises, corner peaks

```
        0   1   2   3   4   5   6   7   8   9  10  11  12  13  14  15
 0:     0   5   5   1   1   2   2   0   0   0   1   1   1  2B  2B  3B
 1:     0   4   4   1   1   2   2   0   2   2   1   2   1  2B  4B  2B
 2:     0   3   3   1   1   1   1   0   0   0   1   1   1  2B  2B  2B
 3:     0   2   2   1   0   2   0   2   1   0   1   1   1   1   1   1
 4:     0   2   2   1   1   0   1   0   1   2   1   1   1   1   2   1
 5:     1   1   1   1   1   1   1   1   1   0   0   1   1   1   1   1
 6:     2   2   2   2   1   2   2   2   1   0   0   1   0   1   2   1
 7:     1   1   1   1   1   2   2   2   1   1   1   1   1   1   2   1
 8:     1   2   1   1   1   1   1   1   2   2   2   1   1   1   1   1
 9:     1   2   1   1   2   0   0   1   2   2   2   1   2   2   2   2
10:     1   1   1   1   1   0   0   1   1   1   1   1   1   1   1   1
11:     1   2   1   1   1   1   1   1   0   1   0   1   1   2   2   0
12:     1   1   1   1   1   1   2   1   2   0   2   0   1   2   2   0
13:    2R  2R  2R   1   1   1   0   0   0   1   1   1   1   3   2   0
14:    2R  3R  2R   1   2   1   2   2   0   2   2   1   1   4   4   0
15:    4R  2R  2R   1   1   1   0   0   0   2   2   1   1   6   6   0
```

`B` = Blue deployment zone (team_a; cols 13-15, rows 0-2; 9 tiles)
`R` = Red deployment zone (team_b; cols 0-2, rows 13-15; 9 tiles)

(The corner peaks — NW elev 5 at cols 1-2/rows 0-1 and SE elev 6 at cols 13-14/row 15 — sit *outside* the deployment zones, in the opposite corners. The elev-3 tile at (15, 0) and the elev-4 tiles at (14, 1) / (0, 15) are *inside* the zones — the intentional in-zone asymmetry noted below.)

## Terrain Features

### The Marsh (most of the map)

Water dominates. The interior — especially the broad bands at cols 7-12 / rows 0-5 and the deep pockets at (5-6, 9-10), (8, 11), (10-11, 11-12), (6-8, 13-15) — is a patchwork of deep (elev 0) and shallow (elev 1) water threaded with single-tile and small-cluster islands at elev 2. There is no single "crossing"; routes are emergent and depend on each unit's Move, Jump, and water cost. This is the map's signature: positioning is a navigation problem, not just a range problem.

### Central Flats (the battleground)

Two elev-2 land patches near the center are the natural meeting ground:
- **West-central**: cols 5-7, rows 6-7 (a 3×2 shelf), extending into the cols 0-3 / row 6 shelf to its west.
- **East-central**: cols 8-10, rows 8-9 (a 3×2 shelf).

They are diagonally offset and separated by water, so the "center" is really a pair of stepping-stone platforms rather than one open field. Whoever holds both controls the shortest dry-ish line between the corners.

### Corner Peaks (off-axis high ground)

- **NW peak**: (1-2, 0) at elev 5, stepping down through (1-2, 1) elev 4 and (1-2, 2) elev 3 to the western shelf. Reached along a mostly-walkable column-1 spine up the west edge.
- **SE peak**: (13-14, 15) at elev 6 — the map high point — stepping down through (13-14, 14) elev 4/4 and (13, 13) elev 3. Reached along a column-13/14 spine down the east edge.

Each deployment zone has a "home" peak along its own edge (SW zone → NW peak via the west edge; NE zone → SE peak via the east edge), but both peaks sit in the corner *opposite* the central flats relative to their owning zone. An archer who climbs to a peak gives up tempo and central presence for a powerful, long-reaching downhill shot. See **Tactical Character**.

### Deployment Zones

- **NE (Blue / team_a)**: cols 13-15, rows 0-2 — 9 tiles, all land (elev 2-4).
- **SW (Red / team_b)**: cols 0-2, rows 13-15 — 9 tiles, all land (elev 2-4).

**Intentional asymmetry.** Each zone holds a single elev-4 tile — NE at (14, 1), SW at (0, 15) — amid otherwise elev-2/3 ground. This is *visual variety only*; it is not a balancing feature and does not meaningfully affect deployment (no class gains a material edge from one raised tile inside its own spawn). Documented here so the asymmetry reads as deliberate rather than a transcription slip. No deployment tile is water, so every unit deploys on solid ground regardless of placement.

## Movement Rules

Standard v1 rules; no map-specific terrain types (no ramparts). The only thing Marshmoor leans on hard is the universal water cost:

- **Water cost** (default ruleset, ADR-0073): water_shallow = 2 MP, water_deep = 3 MP. Tidewalker reduces each by 1 (floor 1). Water is universally enterable; cost is the gate, not access.
- **Jump-over-water**: a unit with sufficient Jump can leap a one-tile water gap onto a higher island at no swim cost, per existing pathfinding. On Marshmoor this is the difference between a high-Jump Assassin (Jump 4) island-hopping freely and a Knight (Jump 2) wading.
- **Knockback into water**: knocking a unit off a peak or island into deep water applies the standard fall-damage / displacement rules. Marshmoor offers more water-adjacent high tiles than prior maps, so knockback-into-water plays surface more often.

## Tactical Character

### Engagement Geometry

26 Manhattan tiles between zone centers — the longest setup window in v1. Expect 4-6 turns of maneuvering before contact. The fight gravitates toward the central flats, but the route there crosses water, so initiative depends on mobility profile more than raw Speed.

### Three Strategic Pulls

1. **The center** — hold the two flats for the shortest dry line and the cleanest engagement.
2. **The peaks** — claim the NW (5) or SE (6) high ground for a dominant archer perch, at the cost of tempo and central presence.
3. **The water itself** — water-mobile units (Tidewalker, high Jump) can flank through the marsh on lines slower units can't contest.

### Bow Range-From-Height (S52)

The SE elev-6 peak is the strongest archer position on the map. A Hunter there shooting a target at elev 0 gains `floor((6 − 0) / 2) = +3` horizontal range (base 5 → 8) **and** roughly ×2 downhill damage from the existing height-delta variance. The NW elev-5 peak gives `+2` range at the same target elevation. This is a deliberately powerful threat (the brief's "bow to the high ground is a real menace" intent); the off-axis peak placement is the counterweight, and archer-led comps on Marshmoor are a flagged playtest watch-for.

### Water-Mobility Burden

A Knight crossing the marsh without Tidewalker can spend the better part of its move budget wading. This is intended to shift class viability on this map — Hydrologist / Tidewalker demand should spike, and heavy melee should feel the drag. Whether the shift is *too* sharp is a playtest watch-for.

## Engine Requirements

None new. Marshmoor is pure content on the existing substrate:

- Universal water-table terrain derivation (elev 0/1 → water_deep/water_shallow; else ground), ADR-0073.
- Deployment zones via the existing `deploymentZone` tile field.
- Registration via the `MapId` union + `MAP_OPTIONS` in `src/app/App.tsx` and a `BattleConfig` derived from `riverRidgeBattle` (`src/content/battles/marshmoor-battle.ts`), identical to how Stonebridge slotted in (S47).
- Validates under the standard `validateMap` with `requiredZonesPerTeam` of 5 per side.

## Open Considerations

- **Tidewalker valuation in AI deployment.** AI role-aware deployment sorting (a standing carry) becomes more pointed here: Tidewalker is materially more valuable on Marshmoor than on prior maps. Not addressed this session; tracked in playtest-watch.
- **Peak-race vs. center meta.** If archer-on-peak proves dominant despite the tempo cost, candidate tunings include capping the range-from-height bonus, lengthening the peak spines, or lowering the SE peak from 6. Hold for playtest data.
- **Setup-phase length feel.** The 26-tile gap is the longest yet. Watch whether the 4-6 turn pre-engagement window feels like meaningful setup time or like a drag.
- **Map preview rendering.** Marshmoor has far more water than prior maps; confirm the elevation/water rendering reads cleanly in the team-builder and battle-setup previews.
