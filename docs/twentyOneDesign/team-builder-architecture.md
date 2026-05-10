# Mage War Team Builder — Architecture Notes

*Living reference document for the pre-battle team builder. Updated incrementally as design firms up.*

## Purpose and Scope

The team builder is the pre-battle UI surface where each side composes a 4-unit team for a Mage War match. It runs after the post-Session 20 milestone and feeds validated team data into the deployment phase, which in turn feeds the battle proper. This document captures the data model, validation rules, UI concept, and architecture decisions that affect later expansion (notably remote multiplayer).

Mage War rules anchored at this layer:
- 4v4 team format
- Each team draws from at most one of each of the 5 classes (Knight, Earth Mage, Water Mage, Fire Mage, Lightning Mage), so each team is missing one class
- Each team uses at most one of each item (with possible relaxation for universal-tier body and head armor in playtest if too restrictive)
- Battle level fixed across both teams (configurable 1-50)
- Default Brave/Faith of 70/70 per unit, settable in 40-90 range
- Pass-and-play local for v1; remote multiplayer is a future expansion that this layer should remain compatible with

## Team and Unit Data Model

### Team-Level State

```
Team {
  teamId: 'red' | 'blue'                          // or named per battle config
  playerName: string                              // optional, for display
  controlMode: 'human' | 'ai'                     // who controls this team in battle
  units: Unit[4]                                  // exactly 4 unit slots
}
```

Battle-level state (above team scope, applies to both teams equally):

```
BattleConfig {
  level: int                                      // 1-50, applies to all units in both teams
  catalogVersion: string                          // for remote-play compatibility checking
  map: MapId                                      // map selection (deployment phase concern but committed at this level)
  ruleSet: 'mage_war_v1'                          // rule package identifier
}
```

### Per-Unit State

```
Unit {
  // Identity
  slot: 1 | 2 | 3 | 4
  name: string                                    // player-set; default to "Earth Mage 1" etc. if blank
  classId: ClassId                                // one of the 5 classes
  
  // Personality stats
  brave: int                                      // 40-90, default 70
  faith: int                                      // 40-90, default 70
  
  // Action loadout
  primaryAction: CommandSetId                     // auto from class; not user-editable
  secondaryActions: CommandSetId[]                // 1 by default; up to 2 with Magus Crown
  
  // Passive buckets — each tracks total cost vs. capacity
  reactionAbilities: AbilityId[]                  // total cost <= R-capacity
  supportAbilities: AbilityId[]                   // total cost <= S-capacity
  movementAbilities: AbilityId[]                  // total cost <= M-capacity
  
  // Equipment slots
  equipment: {
    rightHand: ItemId | null                      // weapon
    leftHand: ItemId | null                       // shield (Knight-only currently); null for mages
    head: ItemId | null
    body: ItemId | null
    accessory: ItemId | null
  }
}
```

### Computed / Derived State (Display-Only)

These are computed from the unit's stored state plus the active catalogs. Not stored on the unit; recomputed on every change to provide live feedback.

```
ComputedStats {
  hp, mp, pa, ma, speed: int                      // class baseline at level + equipment + status modifiers
  move, jump: int
  evade: { front: int, side: int, back: int }     // can be negative (Steel Helm)
  resistances: { [tag]: int }                     // additive composition; clamped to [-100, 200]
  
  bucketCapacity: {
    reaction: { used: int, available: int }       // base 3 + Steel Helm +1 if equipped
    support:  { used: int, available: int }       // base 3 + Augmentor +1 if equipped
    movement: { used: int, available: int }       // base 3 + (future M-capacity items)
  }
  actionCapacity: {
    secondary: { used: int, available: int }      // base 1 + Magus Crown +1 if equipped
  }
  
  expectedDamageVsReference: {                    // optional preview, against a baseline target
    perSwing: number
    perCast: number
  }
}
```

The reference-target damage preview is a nice-to-have; not load-bearing for v1.

## Constraints and Validation

### Per-Unit Validations

- **Bucket capacity**: total cost of abilities in each of R/S/M buckets ≤ that bucket's effective capacity (base + equipment modifiers).
- **Action capacity**: number of secondary command sets ≤ effective Action capacity (1 by default, 2 with Magus Crown).
- **Class restriction respect**: each equipped item's `classRestriction` field permits the unit's class (null restriction = anyone, mage-only/knight-only enforced).
- **Brave / Faith range**: both within the legal range (40-90).
- **Required slots**: class is set; secondary action(s) are filled to the available capacity (or zero, if the player wants empty secondary slots — TBD whether empty secondary is allowed).
- **Ability legality**: each selected ability is in the catalog and matches the bucket type it's placed in.

### Per-Team Validations

- **Class uniqueness**: each class appears at most once across the team's 4 units.
- **Item uniqueness**: each item appears at most once across the team's 4 units (possible exception for universal-tier body and head armor — relaxed if playtest reveals over-restriction).
- **Slot fill**: all 4 unit slots have a class assigned (a partially-filled team is invalid for battle commit).

### Capacity Revalidation Flow

Equipment changes can affect capacity (Steel Helm +1 R, Augmentor +1 S, Magus Crown +1 Action). When a capacity-affecting equipment slot changes:

1. Recompute effective capacities for the affected buckets and action slot.
2. If current loadout exceeds new capacity, mark the bucket invalid (over-capacity) but do **not** auto-modify the loadout.
3. Show a clear validation error on the affected bucket (red highlight, message like "R bucket over capacity (4/3)").
4. Disable the team-level "Confirm Team" button while any unit has unresolved validation errors.
5. Provide a one-click "Trim to capacity (removes highest-cost ability)" button for convenience, but never auto-trim without user action.

This non-blocking approach lets users explore freely (try removing Steel Helm to see what happens; see the resulting issue; decide whether to roll back or fix the loadout). No surprise edits, no blocked actions outside of the final commit.

## UI Concept

### Layout: Team Summary + Unit Detail

The recommended pattern is **master-detail with a team summary header**, supporting at-a-glance comparison across the team while editing one unit at a time.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  [RED ▾ ] TEAM BUILDER                     Battle Level: [ 25 ▼ ]       │
│  Validation: ⚠ Unit 3 R-bucket over capacity (4/3)                      │
├─────────────────────────────────────────────────────────────────────────┤
│  TEAM SUMMARY (click to edit)                                           │
│  ┌────────────┬────────────┬────────────┬────────────┐                  │
│  │ ▶ 1. Brun..│   2. Sparky│   3. Tank* │   4. Wave  │                  │
│  │ Earth Mage │ Lightning M│ Knight     │ Water Mage │                  │
│  │ HP 152     │ HP 127     │ HP 314     │ HP 142     │                  │
│  │ MA 15      │ MA 17      │ PA 11      │ MA 12      │                  │
│  │ Sp 8       │ Sp 9       │ Sp 8       │ Sp 11      │                  │
│  │ ✓          │ ✓          │ ⚠          │ ✓          │                  │
│  └────────────┴────────────┴────────────┴────────────┘                  │
├─────────────────────────────────────────────────────────────────────────┤
│  EDITING: Unit 1 — Brunhilde (Earth Mage)                               │
│                                                                          │
│  Name: [ Brunhilde the Brave        ]   Class: [ Earth Mage ▼ ]         │
│  Brave: [────●────] 70    Faith: [────●────] 70                         │
│                                                                          │
│  ─── Computed Stats ───────────────────────────────                     │
│   HP 152   MP 100   PA 4   MA 15   Speed 8   Move 3   Jump 3            │
│   Evade: Front 25 / Side 10 / Back 5                                    │
│   Resistance: Earth +50  Fire -75  Water -25  Lightning -25             │
│     (-25 all from Wizard's Robe)                                        │
│                                                                          │
│  ─── Loadout ──────────────────────────────────────                     │
│   Primary:    Earth Magic [auto]                                        │
│   Secondary:  [ Lightning Magic ▼ ]                                     │
│                                                                          │
│   Reaction  (3 / 3 used)                                                │
│     • Counter (cost 3)                          [×]                     │
│     [ + Add ability ]                                                   │
│   Support   (3 / 3 used)                                                │
│     • Earth Mastery (cost 3)                    [×]                     │
│     [ + Add ability ]                                                   │
│   Movement  (3 / 3 used)                                                │
│     • Move +1 (cost 3)                          [×]                     │
│                                                                          │
│  ─── Equipment ────────────────────────────────────                     │
│   Right:     [ Staff of Power           ▼ ]    (+3 MA, +20% MP cost)    │
│   Left:      ── (Mage class, no shield)                                 │
│   Head:      [ Pointy Hat               ▼ ]    (+1 MA, Silence resist)  │
│   Body:      [ Wizard's Robe            ▼ ]    (+3 MA, -25 all res)     │
│   Accessory: [ Lightfoot                ▼ ]    (+1 Move/Jump/Sp)        │
│                                                                          │
│  [ Reset Unit ]                              [ Save Unit Changes ]      │
├─────────────────────────────────────────────────────────────────────────┤
│  [ Save Team Draft ]    [ Load Team... ]              [ Confirm Team ]  │
└─────────────────────────────────────────────────────────────────────────┘
```

The `[RED ▾]` switcher in the top-left toggles which team is being edited (Red ↔ Blue) for one-person testing scenarios. In remote-play mode, this switcher is hidden — each client only sees their own team.

### Validation Feedback Pattern

- Per-unit issues: shown on that unit's summary tile (warning icon) and inline in the detail view (red highlights on affected fields).
- Team-level issues (duplicate class, duplicate item): shown in the validation banner at the top.
- The "Confirm Team" button is disabled when any validation issues exist, with a hover tooltip listing the blockers.
- All validations run on every state change (debounced lightly to avoid thrashing); no save-time-only validation.

### Equipment Dropdown Behavior

- Auto-filter to legal options for the slot/class.
- Items already used elsewhere on this team show as greyed-out with annotation "(in use by Unit 2)" — visible but not selectable.
- Each option shows a brief effect summary inline (e.g., "Staff of Power — +3 MA, +20% MP cost") so users don't have to remember every item's effect.
- Selecting "—" (empty slot) is always legal except where required by validation.

## Mode Considerations

### Build Concurrency

Both teams build **simultaneously** — Red and Blue are independent edit sessions in the same UI surface. The `[RED ▾]` switcher in the header toggles which team's state is bound to the editor. Each team's state lives in its own object; switching is just a view change, no data is lost.

For remote multiplayer (future), each client edits only their own team; the switcher is hidden.

### Information Visibility (Blind Picks)

Default rule: **players don't see their opponent's loadout until the battle starts.**

- Local pass-and-play with a single device: relies on social trust (other player isn't looking). The team switcher does expose both sides for the convenience of one-person testing, but in actual two-player local play, the player not currently building should look away.
- Remote play: each client only loads their own team's state; opponent's team is not transmitted until both sides commit. Implementation: `committedTeam` blob held by the host/server until both arrive, then revealed simultaneously to both.

The class/item uniqueness rules are **per-team only**, not cross-team. Both teams can independently pick the same items — including duplicate items across teams. This means there's no cross-team coordination needed during build, which simplifies blind picks substantially.

### Remote Multiplayer Readiness

Architectural constraints to maintain so that remote play is a manageable extension rather than a rewrite:

1. **Team and battle state are pure serializable data.** No object references, no UI handles, no class instances with non-data state. JSON-able.
2. **Validation logic is a pure function** over team data + catalog data. Same function runs client-side (for instant UI feedback) and server-side or peer-side (for trust).
3. **Catalog versioning**: `catalogVersion` field on team data and content data. Both clients must match for battle to be valid.
4. **Commit semantics**: a "team commit" is a snapshot of team data + a timestamp. Server/peer holds commits and reveals simultaneously when both sides have committed.
5. **No UI-driven state machine for build flow.** The build flow's state should be modelable purely from the team data — "is the team valid yet?" is a function call, not a UI variable. This keeps remote-play possible without UI changes leaking into game logic.

Local pass-and-play won't exercise points 4 and 5 directly, but designing toward them now means remote play later doesn't require restructuring.

## Auxiliary Features

### Saved Team Templates

A "Save Team Draft" / "Load Team..." button pair lets users stash and recall team builds. Stored as serialized team JSON, either local-storage in browser (for v1) or downloadable file (for sharing). Useful for playtesting iterations, where the same teams need to be built repeatedly.

Templates store: team-level state + all per-unit state. Battle level is also stored. On load, the current team is replaced; an unsaved-changes warning if the current team is dirty.

### Random Team Generator

A "Random Fill" button that produces a legal team according to current constraints. Useful for quick playtesting against varied inputs without hand-building each opposition team. Could also seed a future "draft mode" or AI-team-generation feature.

Algorithm sketch:
1. Pick 4 distinct classes (random subset of the 5).
2. For each unit, randomly assign a name, default Brave/Faith, level (use battle level).
3. Randomly select equipment respecting class restrictions and team-uniqueness — easiest to do greedily slot-by-slot.
4. Fill secondary action(s) randomly from available command sets.
5. Fill R/S/M buckets up to capacity with random legal abilities.
6. Validate; if any constraint fails (rare with greedy assignment), retry from step 3.

Output is dropped into the current team slot; the user can edit further before committing.

### Stat Preview vs. Reference Target (Lower Priority)

A small panel in the unit-detail view showing expected damage vs. a baseline reference target (e.g., "Stock Earth Mage at L25"):

- Per-swing physical damage expected
- Per-cast spell damage expected (if unit has spells)
- Variance / standard deviation if useful

Useful for letting players see whether a build's offensive output is meaningful before committing to a battle, but not necessary for the core builder.

## Open Items

- **Empty secondary action allowed?** Can a unit have zero secondary action command sets, or is at least one required? FFT required one; for Mage War, optional might be cleaner — lets players free up team-uniqueness if a class's commands are needed elsewhere. Default: optional, no minimum.
- **Random team generator: weighted vs. uniform?** Pure-random often produces silly builds (low-MA Mage with offensive Wizard's Robe, etc.). Weighted-by-class-fit would produce playable randoms but adds heuristic complexity. Start uniform, see how it feels.
- **Saved templates: per-user storage backend.** Local-storage in browser is simplest; downloadable JSON is more portable. Start with local-storage and add download/upload later.
- **Validation error messages: tone and detail.** Are messages terse and technical ("Unit 3: R bucket over capacity") or friendly and explanatory ("Counter (cost 3) and Quickdraw (cost 1) total 4, but Reaction capacity is 3. Remove an ability or equip Steel Helm.")? Probably both — terse summary in the banner, detailed message on hover or click.
- **Read-only modes.** Will there be a "view team" mode (e.g., post-battle, see what the opponent ran) that uses the same UI in read-only? Likely useful for retrospection. Would just be the same component with editing disabled.
- **Battle-level slider: granularity.** Every integer 1-50? Or coarser steps (5/10/15/20/25/30/40/50)? Per-integer is friendliest; might be overkill if playtesting reveals only a few interesting test points. Start per-integer.
- **Loading sample teams for testing.** Should ship with a few pre-built sample teams ("Aggro Knight Squad", "Mage Variety Pack", "Tank Wall") so testers can immediately load interesting builds rather than building from scratch.
