## ADR-0088: Terraformer substrate — mutable terrain, fall-damage helper, effect queue, Barrier objects, Damage Split reflect

**Status:** Accepted
**Date:** 2026-05-30
**Session:** 53

## Context

The Terraformer (10th class; `docs/thirtyNinePlanning/terraformer-blueprint.md`) mutates terrain elevation mid-battle, spawns destructible Barrier objects, deals fall damage on raise/revert, holds a bounded LIFO effect queue, and ships native R/S/M (Damage Split, Ignore Height, Expert Former). The S52 substrate audit (`docs/decisions/draft-terraformer-substrate-audit.md`) surveyed every terrain touch point and found the engine materially cleaner than the blueprint's "2-3 substrate sessions" framing — the scary pieces (mutable terrain state, "system-tagged" damage) were substantially pre-built. This session implements the substrate as a single focused session.

Three settle-before-implementation calls were confirmed by Chris (S53 brief): Barrier damage bypasses the `Unit`-typed pipeline; the effect-queue cap is a computed `modifyStatQuery` read; the terrain-change action is per-cast granularity. Two design calls were settled at session start: **Barrier blocks line-of-sight**, and **Worldcraft fall damage reuses the natural `dropDistance > 1` gate** (so Hill/Valley corner tiles, magnitude ±1, deal zero fall damage).

This ADR records the substrate as one coherent unit because the pieces are tightly coupled (the queue revert emits terrain-change actions, which emit fall damage; barrier eviction emits barrier-change actions). Class content (Worldcraft abilities, ClassDefinition, equipment, R/S/M wiring) and AI awareness are out of scope (S54 / S55).

## Decision

### 1. `system_terrain_change` action (mutable terrain)

A new system action carrying `tileChanges: ReadonlyArray<TerrainTileChange>`, each `{ x, y, layer, originalElevation, newElevation, originalTerrain, newTerrain }`. The reducer writes the new elevation+terrain to the addressed tiles, producing a structurally-shared new `map.tiles` (unchanged tile objects keep identity). Per-cast granularity: one action carries a whole cast's tile-set (1 for Pillar/Pit, 9 for Hill/Valley) or its inverse on a revert, keeping cast-and-revert atomic.

Map already lives in mutable `GameState` (not catalog-held), and the audit confirmed no delta-composition layer is needed — mutated absolute elevation is stored on the tile; originals live in the queue entry for revert. Pathfinding and AoE were verified to read live elevation with **zero substrate change** (regression tests mutate terrain through the reducer and confirm `getLegalMoves` / `aoeFootprint` recompute).

**Fall damage lives in this reducer, not the caller.** Any addressed tile whose elevation *drops* under a (non-removed) occupant emits a `'falling'` `system_damage` via the shared helper. A tile that *rises* is not a drop and emits nothing. This unifies cast-drops (Pit/Valley) and revert-drops (Pillar/Hill revert) through one path, and the blueprint's asymmetry ("raises punish on revert, lowers don't") falls out of the physics — a Pit revert *raises* the tile back, so no damage; a Pillar revert *drops* it, so damage. No per-ability flagging.

### 2. Fall-damage helper (`src/engine/map/fall-damage.ts`)

`FALLING_DAMAGE_PER_LEVEL = 10` and the `'falling'` `system_damage` emission were extracted from `knockback.ts` into `fallDamageAction(unitId, dropDistance): ProposedAction | null`, which returns `null` for a harmless drop (≤ 1). The `knockback.ts` call site uses it (no-op refactor; existing tests green), and the terrain-change reducer uses it for drop damage. The `> 1` gate is the single source of truth — settled in plan-review: Worldcraft reuses the natural fall gate, so corner tiles (±1) deal 0, edges (±2) 20, center (±3) 30.

### 3. Worldcraft effect queue (`Unit.worldcraftEffects` + `src/engine/effects/queue.ts`)

A new per-unit field parallel to `statuses`, holding a bounded, ordered LIFO queue of `WorldcraftEffectEntry` (a union of `terrain` and `barrier` effects; index 0 = oldest). `enqueueWorldcraftEffect(state, catalog, unit, entry)` is a pure helper returning `{ unit, revertActions }`:

- reads the cap via `computeWorldcraftEffectCap` → `runModifyStatQuery('worldcraft_effect_cap')`, base **2**; Expert Former Support adds +2 (computed-not-stored per CLAUDE rule 5 — re-read every enqueue, so equipping/unequipping changes the cap live);
- serial-evicts the oldest entries (per D7) until the new entry fits, each eviction producing a revert ProposedAction — a `terrain` entry reverts via a `system_terrain_change` swapping new↔original (drops fall-damage automatically); a `barrier` entry reverts via a `system_barrier_change` clearing its tiles.

The caller (a Worldcraft ability reducer, S54) does the `withUnit` and appends `revertActions` to `generatedActions`; the engine reduces them, which is when terrain physically reverts and fall damage fires.

**Barrier TTL** decrement piggybacks the turn-loop status cadence: `decrementBarrierTtls(unit)` is called from `reduceTurnStart` for the turn-taking unit. It decrements each `barrier` entry's TTL; entries reaching 0 are pruned and their tiles cleared via an emitted `system_barrier_change`. It returns the *same unit reference untouched* when the unit holds no barrier effects — a genuine no-op for every non-Terraformer. (Cadence relative to KO/Stop is a tunable refinement deferred to S54 — see "Deferred.")

### 4. Barrier objects as a tile-side field (`Tile.barrier?: BarrierState`)

A Barrier is modeled as an optional `{ hp, ttl, ownerId }` field on `Tile`, not a parallel unit-like collection. Impassability and sight-blocking reuse the existing gates:

- **Pathfinding:** `canStep` / `canLeapTo` return false when the destination tile has a barrier (impassable to all, including fliers — it's a solid object, not a height).
- **Line-of-sight:** `tileBlocksAt` treats a barrier as a sight blocker. Unlike a `blocks_los` terrain column (strict `>` floor, so a level shot grazes past a same-height wall), a barrier uses an **inclusive lower bound** — it sits solidly *on* its tile surface, so a wall between two same-elevation units blocks the eye-level ray.

Two new system actions manage barriers, both bypassing the `Unit`-typed pipeline:

- `system_barrier_change` — sets (spawn) or clears (`barrier: null`, for revert / TTL expiry) the field on tiles. Parallel to `system_terrain_change`; separate because it mutates a different tile field.
- `system_barrier_damage` — reduces a single barrier's HP, destroying it (clearing the field) at HP ≤ 0; a missing barrier is a silent no-op (matching `system_damage` missing-target semantics).

**Deviation from the brief, flagged:** the brief said "barrier takes damage via `system_damage`." `system_damage`'s payload is `targetId: UnitId` — literally routing barrier damage through it would mean overloading that to a `unit | tile` target union, rippling through its reducer and every consumer. A barrier is addressed by tile coordinate, not unit id, so a **parallel `system_barrier_damage`** achieves the same goal the audit actually wanted (pipeline bypass, no widening of the Unit-typed stages) without the ripple. The bypass property — no variance/Faith/resistance/reactions — is identical.

### 5. Damage Split reflect (Piece 8)

A new `reflect_damage` effect kind in the data-driven reaction compiler. When a damaging, non-healing attack lands and the reactor survives, it emits a `system_damage` to the attacker for the full damage taken (new `SystemDamageSource` variant `{ kind: 'reflect'; reactorId; attackerId }`) plus a `system_heal` to the reactor for floor(damage/2) (new `SystemHealSource` variant `{ kind: 'reaction'; abilityId; unitId }`). The reflect is system-tagged, so it bypasses the pipeline and **cannot cascade** into the attacker's own reactions — the same property Spiked Mail's `'revenge'` source relies on; `'reflect'` is kept distinct as the Reaction-triggered (Brave-gated) counterpart to the passive-equipment `'revenge'`.

The survival gate (`unit.vitals.hp > 0` on the post-application unit the runner hands the reaction) runs *before* the runner's Brave roll — matching "survives, then Brave-gates." `system_heal` already existed (no addition needed). Damage Split ships in the catalog this session as substrate-validating content; it is **not yet equipped** on any class (S54 wires it to the Terraformer's free slots).

## Consequences

- **Action surface grows by three system actions** (`system_terrain_change`, `system_barrier_change`, `system_barrier_damage`) and two `SystemDamageSource`/`SystemHealSource` source variants. All exhaustive switches (reduce dispatch, validate, commit envelope, animator, action-log formatter) were updated; the `never`-guarded ones fail the build if a future kind is added without a case.
- **`Unit` gains a required `worldcraftEffects` field** (empty for every unit until it casts Worldcraft). Two construction sites updated (`create-initial-state.ts`, the CT test fixture).
- **`StatName` gains `'worldcraft_effect_cap'`** (closed-union extension, one edit).
- **The renderer redraws static layers** on any committed `system_terrain_change` (instant; animation deferred). Barrier-change/damage are also no-tween (redraw path).
- **Fall damage is now centralized.** Knockback and terrain mutation share one helper and one `> 1` gate.
- Tests: 1510 → 1562 (+52). `tsc -b` clean; `vite build` clean.

## Deferred (to S54 / S55, documented)

- **Live attack/AoE → barrier damage routing.** The substrate *mechanism* (`system_barrier_damage`, targetability via the tile field, destruction) is complete and tested. Wiring the live ability pipeline so a basic attack or AoE that lands on a barrier tile emits `system_barrier_damage` — including `validateAction` naming a barrier as a target — is content-coupled (it needs the Barrier ability and barrier-aware attacks to be meaningful and testable) and lands in S54. No S53 content creates or targets a barrier.
- **Barrier-TTL cadence under KO/Stop.** The blueprint says barrier effects persist past Terraformer KO and the TTL "keeps ticking." S53 decrements on the owner's `turn_start`; a KO'd owner takes no turns, so its barriers' TTLs pause until revival. Whether barrier TTLs should tick on a round cadence independent of the owner's turns is a tunable design refinement settled in S54 playtest. The tile-side `BarrierState.ttl` is a spawn-time snapshot; the queue entry is authoritative for expiry.
- **Renderer terrain-transition animation** — instant redraw only this session.

## Alternatives considered

- **Overload `system_damage` to target a tile-or-unit union** for barrier damage — rejected (ripples through every pipeline-bypass consumer; a parallel action is cleaner and equally bypassing).
- **A parallel `terrainObjects` collection on `GameState`** with its own HP/occupancy/target-resolution — rejected per the audit (the `attacker/target: Unit` types would ripple through every pipeline stage + hook signature). The tile-side field reuses the existing `canEnter` / LoS gates.
- **Fall damage emitted by the Worldcraft ability rather than the terrain-change reducer** — rejected; centralizing in the reducer makes cast-drops and revert-drops a single code path and removes per-ability flagging.
