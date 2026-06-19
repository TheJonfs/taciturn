## ADR-0118: Deployment-zone registry + split-zone model

**Status:** Accepted
**Date:** 2026-06-19

## Context

Deployment zones — which tiles each team may place units on during the pre-battle
deployment phase — were a per-tile field, `Tile.deploymentZone?: TeamId | null`,
baked into each map's tile data (ADR-0049). That coupled one terrain to exactly
one deployment layout: reusing a terrain for a different scenario (a story ambush
vs a random-battle layout on the same pass) would have meant duplicating or
mutating the map.

Session 70 needed (a) a fourth map and (b) a *split* deployment — one side spread
across two disjoint, independently-capped sub-zones (an ambush: two SE-heights
firing positions flanking a defile, the victim out in the NW valley). The tile
field couldn't express a per-region cap (it carried only a TeamId), and the
"reuse a terrain with a different layout" need made baking-into-tiles the wrong
home regardless.

## Decision

**1. Zones live beside the terrain, in a per-map registry, assembled by a
combiner.** A new pure data type (`engine/types/deployment-zone.ts`):

```
DeploymentZoneConfig { teams: TeamDeploymentZone[] }
TeamDeploymentZone   { team: TeamId; subZones: DeploymentSubZone[] }
DeploymentSubZone    { tiles: Position[]; cap?: number }
```

A side's zone is a **list of sub-zones**, each a tile-set with an optional
per-sub-zone unit cap. A single contiguous zone is the one-element, no-cap
degenerate case. The `content/deployment/` registry maps `mapKey → { configName →
config }` (so one terrain can carry many layouts — `deploymentZonesFor(mapKey,
name)`), and a combiner `assembleBattlefield(terrain, zones)` pairs a chosen
config with the terrain. The combiner is a **plain assembler** — no party,
reward, objective, or config-*selection* logic accretes onto it (that is campaign
work, explicitly out of scope here).

**2. The tile field is removed entirely; every reader consumes the config**
(Chris's S70 plan-review call — the single-source end-state over a derived-field
half-measure). `Tile.deploymentZone` is gone. Pure accessors + validation live in
`engine/map/deployment-zone.ts` (`tilesForTeam`, `teamForTile`, `isTileInTeamZone`,
`subZoneIndexForTile`, `validateDeploymentZones`). `validateMap` is terrain-only
now; zone-coverage validation moved to `validateDeploymentZones(config, terrain,
requiredPerTeam)`. The four readers — AI deployment, the deployment-phase UI
eligibility check, the renderer tint, and load-time validation — all read the
config. The three existing maps migrated 1:1 to single-sub-zone, no-cap configs;
they deploy identically (behavior-preserving refactor).

**3. Caps are enforced in both placement paths, identically.**
- *AI* (`planAiDeployment`): distributes the role-sorted roster across sub-zones —
  melee round-robin (front wing, nearest the enemy centroid, gets the top tank
  first), then ranged into remaining capacity — and lays each sub-zone out by its
  *own* local forwardness (melee front / ranged rear). Each wing is an independent
  front/back line, so roles are never sorted across the gap between disjoint
  sub-zones (the known S66 single-centroid seam). Overflow → `unplaced`.
- *Human*: `canPlaceInZone` rejects a click whose sub-zone is at cap, and full
  sub-zones re-tint faint so exhausted capacity reads as non-interactive.

## Consequences

- A *second* layout for any existing terrain is now pure authoring (add a registry
  key) — true by construction, demonstrated by the type/registry shape even though
  only Mountain Pass ships more than a `default`.
- `Tile` no longer carries deployment data; the engine reducer remains zone-blind
  (deployment is upstream of `createInitialState`, per the S35 audit). The config
  type lives in `engine/types` as shared vocabulary, exactly as the tile field did
  — no layer consumes it in the reducer.
- The combiner is the dormant seed of an encounter definition. It must stay a
  plain terrain+zones pairing; selection-by-context (story vs random) is a
  deliberate non-goal of this ADR.
- The split-zone AI is a heuristic, not a threat-model: it fills wings sensibly
  but does not reason about crossfire or the victim's likely approach. Whether the
  *victim* AI plays the terrain or walks into the SE crossfire is an open
  in-battle observation (playtest-watch), feeding the still-deferred predictive
  positional threat-model.

## Alternatives considered

- **Stamp a derived `deploymentZone` onto tiles in the combiner** (keep the field
  as a projection, migrate no readers). Less chunk-1 surgery, but two
  representations of one fact and the field still couldn't carry caps. Rejected in
  plan-review for the single-source end-state.
- **Keep zone-coverage in `validateMap`** by passing the config in. Rejected:
  terrain validation and zone validation are now cleanly separable concerns.
