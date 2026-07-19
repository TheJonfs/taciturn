# Map: Oskun Fields

*v1 — Session 96. The Chapter 1 node-1 battlefield: open farmland split by a winding stream, from Chris's elevation grid. The first map authored FOR the campaign rather than recycled from Mage War.*

## Purpose and Scope

Oskun Fields is the company's first fight on the road east out of Zarghidas — Wiegraf Folles and the Dead Men hold the fields and fight alongside the company as guests. As the campaign's opening battlefield it is deliberately readable:

- A **single soft divider** — the stream is shallow (wade cost 2) along its entire run, so the crossing is a tempo tax, not a wall. First contact happens over water in the middle of the field.
- **Flanking high ground on both sides.** The western ridge (elev 4–6) overlooks the player's bank; the eastern knolls (elev 4–5) sit inside the enemy staging area. Neither side owns a decisive perch by default — both are climbed, not granted.
- A **quiet south half** (the south-central hill, the stream's exit arm, the SW pond) that gives the AI's flankers and the player's mobile units somewhere to go besides the main ford.

## Map Metadata

- **Name**: Oskun Fields
- **Dimensions**: 16 × 16 tiles, single layer
- **Theme**: Open farmland; a winding stream from the north edge splitting hilly western fields from gentler eastern ones
- **Symmetry**: None (hand-authored terrain; the engagement axis is east-west)
- **Battle modes supported**: campaign 5v5 + Wiegraf's guest slot (both zones author 12 tiles)
- **Version**: v1.0

## Elevation Grid

Elevation convention (universal; ADR-0073): **0** deep water (3 MP), **1** shallow water (2 MP), **≥2** land.

```
        0   1   2   3   4   5   6   7   8   9  10  11  12  13  14  15
 0:     1   1   1   1   1   1   1   1   3   3   3   3   3   3   2   3
 1:     1   2   3   3   3   3   3   1   3   2   2   3   3   2   3   2
 2:     3   3   2   3   3   4   3   1   3   2   2   3   3   3   3   3
 3:     4   4   3   2  3G   3   3   1   3   3   3   3   2   2   2   3
 4:     2   2   3  3B  2B  3B   3   1   3  4R  5R  3R   2   4   2   3
 5:     3   3   4  3B  2B  2B   2   1   3  4R  4R  3R   2   2   2   3
 6:     5   6   4  4B  3B  3B   2   1   3  4R  4R  3R   3   3   3   3
 7:     4   5   5  4B  4B  3B   2   1   3  3R  3R  3R   3   3   3   3
 8:     4   5   5   4   4   3   2   1   1   1   1   1   3   2   3   3
 9:     5   6   4   3   3   3   2   2   2   2   2   1   3   2   3   2
10:     3   3   4   4   3   3   3   3   3   3   2   1   3   3   3   3
11:     3   2   3   4   3   2   3   4   5   3   2   1   3   2   2   3
12:     3   3   2   3   3   3   4   5   5   3   2   1   3   3   3   3
13:     3   2   1   2   3   3   5   5   4   3   2   1   1   1   1   1
14:     0   1   2   3   3   3   5   4   3   3   2   2   2   2   2   2
15:     0   0   2   3   3   3   3   3   3   3   3   3   3   3   3   3
```

`B` = Blue deployment zone (player; cols 3-5, rows 4-7; 12 tiles, elev 2-4)
`R` = Red staging zone (enemy; cols 9-11, rows 4-7; 12 tiles, elev 3-5)
`G` = Wiegraf's guest slot at (4, 3)

## Terrain Features

### The stream (the map's spine)

Shallow water enters along the whole NW top edge (row 0, x0–7), narrows into a stream down **col 7** (y0–8), turns east along **row 8** (x7–11), south down **col 11** (y8–13), and exits east along **row 13** (x11–15). Every tile of it is elev-1 shallow — wadeable at 2 MP, knockback-relevant, Tidewalker-flavored. It divides west from east on the north half and cuts the SE quadrant off on the south half.

### The western ridge (x0–2, y6–9; elev 4–6)

Twin elev-6 peaks at (1,6) and (1,9) over an elev-5 shoulder — the map's highest ground, directly behind the player's deployment. A bow perch with range-from-height reach over the west bank, bought with two or three turns of climbing away from the ford.

### The eastern knolls (x9–10, y4–6; elev 4–5)

The enemy's answer, *inside* their staging zone — generated lineups start with modest high ground. Front-loading the fight across the stream means fighting slightly uphill.

### The south-central hill (x6–8, y11–14; elev 4–5)

Commands the stream's southern arm and the southern flats — the natural flanking objective for whoever breaks south instead of forcing the ford.

### The SW pond (x0–1, y14–15; elev 0)

The only deep water on the map. A knockback hazard corner, nothing more.

## Deployment

Registered as `oskun_fields` → `default` (`src/content/deployment/registry.ts`): Blue rect(3,5 × 4,7), Red rect(9,11 × 4,7). **Proposed layout** — the east-west axis reads from the terrain, but re-placing either zone is a pure authoring edit. Wiegraf's guest slot sits at (4,3), on land just north of the Blue zone.

## Battle template

`src/content/battles/oskun-fields-battle.ts` (`oskun_fields_v1`) restages the River Ridge 5v5 onto this map; the Ch1 beat (`node-content.ts`) adds Wiegraf's guest slot and stamps `ch1_oskun_v1`.
