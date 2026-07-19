# Map: Alvera Village

*v1 — Session 96. The Chapter 1 node-2 battlefield: a riverside village with real architecture — walled buildings with door gaps — from Chris's elevation grid.*

## Purpose and Scope

Alvera Village is the battle at the caster town's doorstep (Clio joins after it; the caster market opens). It introduces two things no earlier map has:

- **Architecture.** Elevation-8 tiles are building walls — ordinary ground tiles so tall (5–6 above the streets) that no jump crosses them. Buildings read as solid; their elev-3 **interiors** are reached only through **door gaps** in the walls. Line-of-sight abilities break against walls exactly like terrain (they ARE terrain), so the village lanes are genuine cover corridors.
- **A two-front river.** A diagonal deep channel runs from the NE corner southwest into a deep east-west channel at row 8. Crossing it is a wade over the shallow-deep-shallow band (rows 7–9) — or the dry walk around the east bank (row 8, x11+). Attackers choose between a costly direct ford and a longer flanking march.

This map is also the intended home of the coming **special-features pass** (Chris) — the building architecture (interiors, doors, roof-height walls) is the substrate those features will build on.

## Map Metadata

- **Name**: Alvera Village
- **Dimensions**: 16 × 16 tiles, single layer
- **Theme**: A riverside village — four walled buildings, a road grid, a diagonal river with fords
- **Symmetry**: None (hand-authored)
- **Battle modes supported**: campaign 5v5 (both zones author 12 tiles)
- **Version**: v1.0

## Elevation Grid

Elevation convention (universal; ADR-0073): **0** deep water (3 MP), **1** shallow water (2 MP), **≥2** land. **8 = building wall** — the `rampart` terrain (Stonebridge's dressed-stone keep art, S47), jump-impassable by height.

```
        0   1   2   3   4   5   6   7   8   9  10  11  12  13  14  15
 0:     8   8   8   8   8   8   3   3   3   3   3   2   2   1   1   0
 1:     8   3   3   3   3   8   3   3   3   3   2   2   1   1   0   0
 2:     8   3   3   3   3   8   3   3   3   2   2   1   1   0   0   1
 3:     8   8  3D   8   8   8   3   3   2   2   1   1   0   0   1   1
 4:     3  2R  2R  2R  3R   3   3   2   2   1   1   0   0   1   1   2
 5:     3  2R  2R  2R  3R   3   2   2   1   1   0   0   1   1   2   2
 6:     2  2R  2R  2R  2R   2   2   1   1   0   0   1   1   2   2   3
 7:     1   1   1   1   1   1   1   1   0   0   1   1   2   2   3   3
 8:     0   0   0   0   0   0   0   0   0   1   1   2   2   2   2   3
 9:     1   1   1   1   1   1   1   1   1   1   2   2   2   3   3   3
10:     2   2   2   2   2   2  2B  2B  2B  2B  2B  2B   2   2   2   2
11:     8   8   8   8   8   2  2B  2B  2B  2B  2B  2B   8   8   8   8
12:     8   3   3   3   8   2   8   8  3D   8   8   2   8   3   3   8
13:     8   3   3   3  3D   2   8   3   3   3   8   2  3D   3   3   8
14:     8   3   3   3   8   2   8   3   3   3   8   2   8   3   3   8
15:     8   8   8   8   8   2   8   8   8   8   8   2   8   8   8   8
```

`B` = Blue deployment zone (player; cols 6-11, rows 10-11; 12 tiles, all elev 2)
`R` = Red staging zone (enemy; cols 1-4, rows 4-6; 12 tiles, elev 2-3)
`D` = door gaps (see below)

## Terrain Features

### The buildings (elev-8 walls, elev-3 interiors)

| Building | Footprint | Door |
|---|---|---|
| NW manor | x0-5, y0-3 | south door at (2,3) |
| SW house | x0-4, y11-15 | east door at (4,13) |
| South-central house | x6-10, y12-15 | north door at (8,12) |
| SE house | x12-15, y11-15 | west door at (12,13) |

Interiors are one step (elev 3) above the streets (elev 2) — freely enterable through the door, defensible as a single-tile chokepoint. Walls block movement (no jump reaches +5/+6), block straight-line spells, and are effectively out of terraform reach (Pillar +4 from a street tile tops out at 6).

### The river

The **diagonal channel** (deep, with shallow fringes) runs (15,0) → (8,7), joining the **east-west channel** at row 8 (deep across x0–8). Crossings:
- **The fords**: row 7 (shallow) → row 8 (deep) → row 9 (shallow) anywhere west of x8 — a 3-tile wade costing 2+3+2.
- **The dry east bank**: row 8 from x11 east is ground — the long way around, no water cost.
- The NE triangle beyond the diagonal rises to a SE shelf (elev 2–3) that walks down the east edge to the bank.

### The streets

The east-west **road** at row 10 (elev 2, full width) and two north-south **lanes** at cols 5 and 11 running to the south map edge between the houses. The lanes are wall-flanked corridors — cover from straight-line spells, ambush geometry for melee.

## Deployment

Registered as `alvera_village` → `default`: Blue rect(6,11 × 10,11) on the road, Red rect(1,4 × 4,6) in the NW fields. **Proposed layout** — the fight reads as a ford assault on the village (enemies wade the fords or march the east bank; the player holds the road with the houses at their back). Re-placing either zone is a pure authoring edit.

## Battle template

`src/content/battles/alvera-village-battle.ts` (`alvera_village_v1`) restages the River Ridge 5v5 onto this map; the Ch1 beat (`node-content.ts`) supplies the generated lineup and Clio's post-battle join.
