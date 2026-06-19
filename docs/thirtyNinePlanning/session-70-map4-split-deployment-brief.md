# Session 70 — Map 4 (mountain pass) + split deployment + zone-registry extraction

*Adds the fourth map and the split-deployment concept, and — as the enabling substrate —
extracts deployment zones out of map data into a per-map deployment-zone registry consumed
through a combiner. That extraction deliberately draws the terrain↔deployment-setup seam:
one terrain can carry many deployment configs without map surgery. It's the leading edge of
the campaign's encounter-definition data, built now while we're already in the deployment
code. **Mage War only.** The machinery that *selects* a config by context (story vs random)
is explicitly NOT built here — just the seam, plus one split config to exercise it.*

## Context

Today the three maps bake their deployment zones into the map data itself. To reuse a
terrain with different layouts later (a story ambush vs a random-battle layout on the same
pass), zones must live *beside* the terrain, not inside it. This session cuts that seam for
all four maps and introduces split zones as the first non-trivial config. The new map is a
narrow NW→SE pass: a broad NW valley basin, a low central spine (the run of 2s), and a
narrow SE defile walled by the bottom-center massif (SW) and the rising right edge (NE) —
"ripe for an ambush." The split config puts one side in the SE heights on both flanks of the
defile; the other starts in the NW valley, far enough off that the trap only springs if the
advancing AI mishandles the terrain.

## Inputs

- The 16×16 heightmap (elevations 2–11) — the map-4 terrain (full grid in the Appendix).
- The three existing maps' current data (zones baked in — to be extracted).
- `deployment-phase-architecture.md` (where unit placement + limits are enforced).
- The role-aware deployment AI (S66 — distance-to-opposing-centroid; the banked weaponType
  hook was retired into it).
- Map-data types (`core-types.md`, `map-and-battlefield.md`); the battle-setup path; the
  deployment-phase UI/validation.

## Goal

1. **Extraction + registry + combiner:** deployment zones live in a per-map registry; a
   combiner assembles a battle from `(terrain) + (a chosen zone-config)`. The three existing
   maps migrate to this with **no behavior change**.
2. **Split-zone model:** a side's deployment is a *list of sub-zones*, each a tile-set with an
   optional per-sub-zone unit cap. Single contiguous zone = the one-element degenerate case.
3. **Map 4 + its split config:** ambusher in two SE-heights sub-zones (caps 3 and 2), victim
   in one NW-valley sub-zone.
4. **Cap enforcement** in the deployment phase (human + AI).
5. **AI deployment into split zones:** role-aware *per sub-zone*, caps respected, sane with
   disjoint zones.

## Pre-implementation plan (audit-heavy)

- Size the extraction: how deeply the three maps couple zones to map data, and every site
  that reads zones (battle-setup, deployment phase, AI deployment). This is the "is it really
  minor surgery" question — report the actual cost at the chunk-1 checkpoint.
- Where the deployment phase enforces placement limits today (for adding per-sub-zone caps).
- How the role-aware deployment logic (centroid/role-sort) behaves given a disjoint, capped,
  multi-sub-zone side — find what breaks before extending it.
- Confirm the map schema for adding the map-4 terrain.

## Implementation work (chunked)

### Chunk 1 — extraction + registry + combiner  *(critical-path prerequisite; main risk; checkpoint after)*
Define the deployment-zone-config type (per-side sub-zone lists + optional caps); build the
per-map registry; build the combiner (terrain + config → battle setup); migrate the three
maps' zones into registry configs (single sub-zone per side, no caps); rewire setup through
the combiner. **Pure refactor — suite stays green, the three maps play identically.**

### Chunk 2 — split-zone model + map 4  *(checkpoint after)*
Finalize the sub-zone + cap fields (likely already shaped by chunk 1's type); add the map-4
terrain (heightmap); author map 4's split config — ambusher two SE sub-zones (caps per D2),
victim one NW sub-zone. Candidate tiles under D1.

### Chunk 3 — cap enforcement + AI deployment  *(first to throttle)*
Enforce per-sub-zone caps in the deployment phase (placement validation + a UI affordance
showing each sub-zone's remaining capacity). Extend role-aware AI deployment to fill disjoint
capped sub-zones: respect caps, sort roles *within* each sub-zone, don't let the centroid
logic pile everyone into one wing or sort roles nonsensically across the gap.

## Acceptance criteria

- The three existing maps set up and play identically (the refactor is behavior-preserving;
  guard with existing map/battle tests).
- A battle assembles from terrain + a registry config via the combiner; a *second* config for
  an existing map would need only authoring, no map/code change — true by construction.
- Map 4 loads; the split config deploys the ambusher across the two SE sub-zones honoring
  caps (no >3 in one, no >2 in the other), victim in the NW zone.
- Deployment rejects over-cap placement for *both* human and AI.
- AI deploys coherently into the split ambush (roles per zone, caps respected, no incoherent
  placement).
- Suite green; `tsc -b` + `vite build` clean; ADR for the deployment-zone-registry seam +
  the split-zone model.
- *(Observation, not acceptance):* play the map; watch whether the victim AI advances into the
  SE crossfire or plays the terrain. Record the read in `playtest-watch.md` — it's a free
  intelligence probe and a motivator for the deferred threat-model.

## Out of scope

- **Config selection machinery** (which config for story vs random) — the registry just holds
  configs; selection is campaign work.
- Deploy-K-from-a-larger-roster (campaign; Mage War deploys the built team).
- Generative zones; scenario/objective/reward objects. The combiner is the *seed* of the
  encounter definition — it does not grow campaign concerns here.
- New in-battle AI for ambush navigation — we *observe* the current AI; the threat-model stays
  deferred.

## Files (hedged — audit confirms)

Map-data types + the three map assets + the map-4 asset; a new deployment-zone-config type +
per-map registry + combiner; the battle-setup path; the deployment-phase UI/validation; the
role-aware AI deployment; ADR; Vitest specs throughout.

## Decision points (for plan-review)

- **D1 — exact zone tiles.** Starting candidates, yours to confirm or replace:
  - *Victim, NW valley (one sub-zone, no cap):* the low basin, e.g. (1,1)(1,2)(1,3)(2,1)(2,2)(2,3)(3,2)(3,3) — elev 3–5, 8 tiles for 5 units.
  - *Ambusher, SW massif (proposed cap 3 — the dominant height):* e.g. (12,8)(12,9)(13,8)(13,9)(14,8)(14,9) — elev 7–10, overlooking the defile.
  - *Ambusher, NE edge (proposed cap 2 — the lower, weaker wing):* e.g. (11,14)(11,15)(12,15)(13,15) — elev 5–8.
  - (The NE flank is genuinely lower than the SW massif; if you want symmetric ambush wings, the NE zone may need to reach up toward the (8–11) corner at rows 8–11, col 15.)
- **D2 — cap-to-side assignment.** Proposed: 3 on the SW massif, 2 on the NE edge. Your call.
- **D3 — split if the extraction isn't minor.** If chunk 1's audit finds the zone/map coupling
  is deep, ship chunk 1 (the refactor) alone and move map 4 + split to a follow-up, rather
  than cram. Default: push through if it's genuinely minor.

## Workflow notes

Chunk 1 is both the prerequisite for everything else and the main risk — flag its real size at
the checkpoint (D3). Throttle order: chunk 3's AI-deployment sophistication is the first cut
(a basic "fill sub-zones respecting caps" is the floor; per-zone role-sorting is the
nice-to-have). The combiner must stay a plain terrain+zones assembler — do not let selection,
parties, or rewards accrete onto it.

## Watch-fors

- The refactor regressing the three maps — the easiest place to break something; lean on the
  existing map/battle tests as the guard.
- Cap enforcement must cover both human *and* AI placement — a cap honored in one path but not
  the other is a bug.
- The centroid/role-sort deployment misbehaving on disjoint zones (the known S66 seam) — piling
  into one wing, or role-sorting across the gap.
- Scope creep on the combiner (the dormant encounter-definition seed must stay dormant).

## Estimated size

Large-ish for one session: a behavior-preserving refactor (chunk 1) + a map + a new mechanic
with UI and AI touches. Bigger than the equipment pass; comparable in spread to a class
introduction, with less novel-mechanic depth but a real refactor. The chunk-1 risk (D3) could
legitimately split it.

## Appendix — Map 4 terrain data

16×16 elevation heightmap (values 2–11). Indexing matches the D1 tile notation: first
index = row (0–15, top to bottom), second = column (0–15, left to right). So (5,14) = 11 is
the NE peak, (8,6) = 2 sits on the central low spine, and the SE defile runs along the 4s
from roughly (11,10) to (15,15).

```
        c0   c1   c2   c3   c4   c5   c6   c7   c8   c9  c10  c11  c12  c13  c14  c15
 r0      6    5    4    5    6    7    6    7    6    7    8    9   10    9    8    7
 r1      7    3    4    4    5    6    5    7    6    8    9   10    9    8    9    7
 r2      5    4    3    4    4    5    6    5    7    6    8    9   10    9    8    9
 r3      7    5    3    3    4    4    5    6    5    7    6    8    9   10    9    8
 r4      6    5    4    3    4    4    3    4    6    5    7    6    8    9   10    9
 r5      7    6    3    4    4    4    4    3    4    5    6    5    6   10   11   10
 r6      6    6    4    3    4    4    4    4    3    4    5    6    5    9   10    8
 r7      7    8    5    4    4    4    3    4    4    3    4    5    6    7    8    9
 r8      8    9    6    3    4    3    2    3    4    4    3    4    6    8    8    9
 r9      9    9    5    4    3    4    3    4    3    4    4    3    5    7    9    8
 r10     8    8    6    5    4    3    4    3    2    3    4    4    5    7    8    9
 r11     9    9    7    6    5    4    3    4    2    6    4    4    4    5    7    8
 r12     8    8    7    7    6    5    4    5    7    8    7    4    4    4    5    7
 r13     7    7    5    7    8    7    6    8    9   10    8    7    4    4    4    5
 r14     5    6    6    6    7    8    7    9    8    9    8    7    7    4    4    4
 r15     4    5    7    5    6    7    8    8    9   10    9    8    6    7    4    4
```

Terrain landmarks for orientation: broad NW valley basin (the 3–5 cluster, rows 1–7,
cols 1–8); central low spine (the 2s at (8,6), (10,8), (11,8)); narrow SE defile (the 4s,
rows 11–15, cols 10–15); NE ridge wall (cols 10–14, peak (5,14)=11); bottom-center massif
(cols 7–10, rows 12–15, elev 7–10) — the SW wall of the defile.
