# Mage War Deployment Phase — Architecture Notes

*Living reference document for the deployment phase that runs between team commit and battle start.*

## Purpose and Scope

The deployment phase is the brief but distinct UI surface where each side, having committed a valid team, places their units on the map and chooses initial facing before the battle proper begins. It receives validated team data from the team builder and produces fully-positioned units ready for action-log-driven simulation.

The phase ends with simultaneous reveal of both teams' placements, application of equipment-driven auto-statuses, and randomization of initial CT — at which point the first turn fires.

## Data Model

### Deployment State

```
DeploymentState {
  battleConfig: BattleConfig            // map, level, ruleset
  redTeam: CommittedTeam                // from team builder
  blueTeam: CommittedTeam
  redPlacements: UnitPlacement[0..N]    // accumulated as player places, N = team size
  bluePlacements: UnitPlacement[0..N]
  redCommitted: boolean
  blueCommitted: boolean
  visibility: VisibilityState
}

UnitPlacement {
  unitSlot: 1..N                        // references unit in the team
  position: { x: int, y: int, layer: int }
  facing: 'north' | 'south' | 'east' | 'west'
  // Initial CT is rolled at battle start (after commit), not stored here
}

VisibilityState {
  redCanSeeBlueTeam: boolean            // false until battle starts
  redCanSeeBluePlacements: boolean      // false until both committed
  blueCanSeeRedTeam: boolean
  blueCanSeeRedPlacements: boolean
}
```

### Zone State

> **Updated S70 (ADR-0118).** Zones used to be a per-tile `deploymentZone:
> 'team_a' | 'team_b' | null` field baked into the map. They now live *beside*
> the terrain in a per-map registry (`src/content/deployment/registry.ts`),
> paired with the terrain by the `assembleBattlefield` combiner. `Tile` no longer
> carries a deployment field. This lets one terrain carry several layouts (a story
> ambush vs a random-battle layout) without map surgery.

A side's zone is a **list of sub-zones**, each a tile-set with an optional
per-sub-zone unit cap:

```
DeploymentZoneConfig { teams: TeamDeploymentZone[] }
TeamDeploymentZone   { team: TeamId; subZones: DeploymentSubZone[] }
DeploymentSubZone    { tiles: Position[]; cap?: number }   // cap undefined = uncapped
```

A single contiguous zone is the one-sub-zone, no-cap degenerate case. This
naturally supports asymmetric, non-contiguous, or specially-shaped zones — e.g.,
Mountain Pass's ambush, where the ambusher's zone is split between two SE-heights
sub-zones (caps 3 and 2) flanking the defile.

## Validation

### Per-Placement

- Position is within the unit's team zone tiles.
- The sub-zone the position belongs to is below its cap (S70). Enforced for both
  human placement (`canPlaceInZone` — over-cap tiles are non-selectable and re-tint
  faint) and AI placement (`planAiDeployment` distributes across sub-zones honoring
  caps).
- Position is not occupied by another unit on the same team.
- Position is reachable / standable terrain (not a void, not blocked, layer/terrain-type compatible with ground unit).
- Facing is one of the four cardinal directions.

### Per-Team

- All N units placed exactly once, where N is the team size for the battle.
- Each unit slot has exactly one placement.

### Map-Level (validated at map design time, not runtime)

Each map must contain at least N zone tiles per team, where N is the **largest team size the battle config supports**. For Mage War 4v4, N = 4. Future battle modes with larger teams require maps that support those sizes; battle configs that exceed a map's zone capacity should fail at battle creation, not at deployment. This couples team-size selection in pre-battle setup to map selection — most maps will carry plenty of zone tiles for typical team sizes, but procedural map generation must respect the rule.

## UI Concept

The deployment view shows the full map with both zones highlighted. The player's own zone is marked more prominently; the opponent's zone is visible (so the player knows where the threat will arrive from) but no opponent units are shown.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  RED TEAM — DEPLOYMENT                          Map: Crossroads (14x14) │
│  Place your 4 units within the highlighted zone, choose facing,         │
│  then commit. Opponent placements revealed when both teams commit.      │
├──────────────────────────┬──────────────────────────────────────────────┤
│  YOUR TEAM               │  ┌────────────────────────────────────┐     │
│                          │  │                                    │     │
│  ▶ 1. Brunhilde          │  │       [MAP RENDER HERE]            │     │
│     Earth Mage           │  │                                    │     │
│     Auto-Regen           │  │  Your zone: blue-tinted tiles      │     │
│                          │  │  Opponent zone: red-tinted tiles   │     │
│    2. Sparky             │  │                                    │     │
│     Lightning Mage       │  │  Click a unit (left), then a tile  │     │
│     Auto-Haste           │  │  in your zone to place. Click an   │     │
│                          │  │  arrow indicator to set facing.    │     │
│    3. Tank               │  │  Drag placed units to reposition.  │     │
│     Knight               │  │                                    │     │
│     (no auto-statuses)   │  │  Default facing: toward enemy zone │     │
│                          │  │  centroid; player can adjust.      │     │
│    4. Wave               │  │                                    │     │
│     Water Mage           │  │                                    │     │
│     Auto-Haste           │  │                                    │     │
│                          │  └────────────────────────────────────┘     │
│  Placed: 1 / 4           │                                              │
│                          │  Selected: Brunhilde                         │
│  [ Auto-place all ]      │  Status preview: Auto-Regen (5%/turn)        │
│  [ Reset placements ]    │                                              │
├──────────────────────────┴──────────────────────────────────────────────┤
│  [RED ▾] (switcher)                  [ Cancel ]   [ Commit Placement ]  │
└─────────────────────────────────────────────────────────────────────────┘
```

### UI Affordances

- **Unit roster (left)**: each unit shows class, placement status, and auto-status preview (Auto-Haste, Auto-Regen, etc. that will activate at battle start).
- **Map view (right)**: full battle map with zone highlighting. Hover-highlight on tiles within the player's zone. Placed units appear at their tile with a directional arrow indicating facing.
- **Selection model**: click a unit in the roster (▶ marker) to make it the "currently placing" unit; click a zone tile to place. Click placed unit, then a cardinal direction, to change facing.
- **Movement**: drag-and-drop placed units to reposition; drop on a roster slot to un-place.
- **Default facing**: on placement, default is toward the enemy zone's centroid. Player can adjust freely.
- **Auto-place button**: places all unplaced units in default zone positions ordered by slot, default facing. Useful for playtesting iteration when positioning isn't the focus.
- **Reset button**: clears all placements, returns units to unplaced state.
- **Switcher**: same `[RED ▾]` pattern as team builder for one-person testing scenarios. Hidden in remote-play mode.

## Concurrency Flow

1. Deployment phase begins. Both players see the same map; both zones highlighted; each player has their own team's unit roster visible; opponent's team identity and units are hidden.
2. Each player places their N units independently, choosing position and facing.
3. Each player presses "Commit Placement" when ready. Their UI transitions to "Waiting for opponent..." state.
4. Once both committed:
   - Visibility flags flip: each view now shows opponent's team and placements.
   - Battle initialization: auto-statuses apply (Auto-Haste, Auto-Regen, Auto-Shell, etc.) as the first entries in the action log.
   - Initial CT roll: each unit gets a random `[0, 20]` starting CT, also recorded as action log entries.
   - First turn determined by current CT + Speed; play proceeds.
5. No ready-check pause between commit-reveal and battle start — straight transition.

## Pre-Battle Status Application

Equipment with auto-status effects applies at battle start, after both placements commit. Mechanically, these are normal `apply_status` actions in the action log, marked with a `source: 'pre_battle_equipment'` tag for replay and attribution.

This keeps the action log fully replay-deterministic from the first entry forward — no special "battle setup" branch.

## Initial CT Randomization

Each unit's starting CT is a uniform integer roll in `[0, 20]`. Effects:

- 1-point Speed gaps can flip turn order with the right roll (Speed 8 with C=20 acts before Speed 9 with C=0).
- 2-point Speed gaps occasionally flip.
- 3+ point Speed gaps are stable — fast units act first reliably.

Speed remains the dominant turn-order factor; the randomization adds enough variability to prevent fully-deterministic openings without dethroning Speed.

## Open Items

- **Zone visibility on opponent.** Default rule: opponent's zone *shape* is visible (so the player knows where the threat will arrive from), but not which opponent units occupy which tiles until commit. Alternate "fully blind" mode (zone shape hidden too) may be interesting for asymmetric/ambush maps but adds visibility-management complexity. Out of scope for v1.
- **Deployment timer.** Out of scope for Mage War demo and casual play. Tournament play would want it; the affordance can be added later without architectural change.
- **Saved deployment templates.** Parallel to saved team templates. A "deploy as last time" recall would speed playtesting iteration. Lower priority.
- **Layer-aware placement.** For maps with multi-layer terrain (bridges, upper floors), the placement UI needs a layer-toggle. Not needed for the first flat map; will need attention when multi-layer maps come online.
- **Visualization of facing on placed units.** The placement UI shows facing via a directional arrow on the placed unit token. Final renderer (top-down 2D for now, isometric later) needs to render facing legibly — important since facing affects Evade values. Confirm rendering decision when placement UI implementation begins.
