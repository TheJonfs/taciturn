# Draft — Terraformer Substrate Audit

*Status: **research deliverable**, not an ADR. Produced in Session 52 to scope the eventual Terraformer implementation arc. No engine code changed this session. Supersedes the substrate guesses in `docs/thirtyNinePlanning/terraformer-blueprint.md` where they conflict (see "Audit-overturns-spec findings"). Promote relevant decisions to real ADRs when the substrate session(s) begin.*

## Purpose

The Terraformer (10th class; see the blueprint) mutates terrain elevation mid-battle, spawns destructible Barrier objects, deals fall damage on raise/revert, and ships native R/S/M (Damage Split, Ignore Height, Expert Former). The blueprint frames this as "the largest substrate addition since the Math Skill substrate (S49)… expect 2-3 implementation sessions." This audit surveys every terrain-handling touch point against the current tree to test that framing and order the work by dependency.

**Headline finding:** the engine is materially cleaner for this than the blueprint assumes. The two pieces framed as the scary substrate — mutable terrain state and "system-tagged" damage — are both substantially pre-built. The genuinely large, genuinely new work is concentrated in **terrain objects (Barrier)** and **AI terrain awareness**; the **effect queue** is medium. Several pieces are *zero* substrate. Session A (substrate) is plausibly **one focused session**, not 2-3, if Barrier damage routes through `system_damage` rather than widening the `Unit`-typed damage pipeline.

All file:line references verified against the working tree at audit time (S52).

---

## Per-piece survey

Each piece: **Current state** · **Changes required** · **Structured for it?** · **Dependencies** · **Scope**.

### 1. Mutable terrain / elevation state

**Current state.** `Tile = { x, y, layer, elevation, terrain, properties, deploymentZone? }`, all `readonly`; `terrain: TerrainType` an open string union (`src/engine/types/tile.ts`). `BattleMap = { width, height, tiles }`. Crucially, **the map is part of mutable `GameState`** — `readonly map: BattleMap` (`src/engine/types/game-state.ts:41`), seeded once from `battleConfig.map` at `create-initial-state.ts`. It is *not* held by id/reference into the catalog (unlike `ruleset: RulesetRef`). Accessors (`tileAt`, `tilesAt`) are pure scans over `map.tiles`, never cached. No reducer rebuilds `state.map` today; every non-setup `state.map` use is a read.

**Changes required.** A new action type (e.g. `system_terrain_change`) whose reducer returns a new state with a structurally-shared new `map.tiles` (an Immer one-liner: set the targeted tile's `elevation` + `terrain` in lockstep — `terrain` is elevation-derived under the water-table convention, so they must move together). `elevation` being `readonly` is a compile-time guard only; the reducer produces new tile objects.

**Structured for it?** Strongly. Map already lives in mutable state; immutable-update machinery (reducer + Immer) exists; accessors are fresh-read.

**Dependencies.** Foundation for pieces 2, 3, 4, 7, 9. Blocks nothing itself.

**Scope: Small–Medium.** One new action type + reducer + tests. The blueprint's "per-tile elevation as battle state (not just map definition)" requirement is **already satisfied**, and its "deltas composed over base map" model is **not needed** — store mutated absolute elevation on the tile, keep originals in the effect queue (piece 9) for revert.

### 2. Movement / pathfinding

**Current state.** `getLegalMoves` is a pure Dijkstra recomputed on every call — *"Pure function… No reducer dependency"* (`src/engine/map/pathfinding.ts:4-5`). It reads tile elevation live inside the frontier loop and computes step legality (elevation-vs-jump) against current state. No cache. `computeMovementProfile` is likewise pure/recomputed. The water convention is elevation-keyed (`elevation <= 1` water; `>= 2` land), and pathfinding's own comments already anticipate terrain-mutation abilities flipping cost in lockstep.

**Changes required.** None. Mutated elevation is picked up automatically on the next Move.

**Structured for it?** Confirmed — the blueprint's guess ("likely fresh-computed; should be safe") is correct.

**Dependencies.** Depends on piece 1 (the elevation must actually change).

**Scope: None (zero substrate).** *Audit-overturns-spec.* Note: a unit stranded on a now-isolated perch (jump exceeded after a Pit/Valley) is the intended trap *gameplay*, not a bug — pathfinding simply reports fewer reachable tiles.

### 3. AoE shape computation

**Current state.** `aoeFootprint({ map, anchor, shape, verticalTolerance, direction })` reads live tile elevation, filtering by `|tile.elevation − anchor.elevation| ≤ verticalTolerance` (`src/engine/map/aoe.ts`). AI's `aoeTilesAffected` flows through the same path. Membership shapes are uniform (tile/diamond/square/cross/cone/line/custom).

**Changes required.** None for footprinting. The Hill/Valley 3×3 kernels (`[1,2,1]/[2,3,2]/[1,2,1]`) carry *per-offset magnitudes*, which the current `AoeShape` vocabulary doesn't express — but that's a **class-content data structure** feeding the terrain-change action, not a change to `aoeFootprint`.

**Structured for it?** Yes — AoE reads `map` by argument, never caches; mutation reflected automatically.

**Dependencies.** Reflects piece 1 automatically.

**Scope: None for the engine; the kernel-delta table is Small and lives in class content (Session B).**

### 4. Fall damage on raise / revert

**Current state.** Exists and is reusable. `applyKnockback` (ADR-0026) computes `dropDistance = startElevation − finalElevation` and, when `> 1`, emits `system_damage` with `amount = 10 × dropDistance`, tag `['physical']`, source `{ kind: 'falling', unitId, dropDistance }` (`src/engine/map/knockback.ts:64,123-130`; `FALLING_DAMAGE_PER_LEVEL = 10`). The `SystemDamageSource` union already has the `'falling'` variant (`src/engine/types/action.ts:354`).

**Changes required.** Extract the falling-damage emission into a shared helper (or have the terrain-change reducer emit the same `system_damage` shape). For Pit/Valley/Pillar-revert the "drop" is the unit's own tile's elevation delta rather than a horizontal push — same formula, different trigger. The blueprint's asymmetry (raises punish on revert, lowers don't) is purely *when* you emit, not *how*.

**Structured for it?** Yes. Only a small extraction so two call sites share one constant + one shape.

**Dependencies.** Depends on piece 1 (the delta) and the `system_damage` action (exists).

**Scope: Small.**

### 5. Terrain objects (Barrier) — *the big one*

**Current state.** **No non-Unit, HP-bearing, targetable battlefield object exists.** The damage pipeline is hardwired to Units: `DamageContext.attacker/target: Unit` (required); `runDamagePipeline(attacker: Unit, target: Unit)`. Target resolution returns `Unit | null` — the `'tile'` target case looks up the *unit standing there*, null if empty (`reducers.ts`). Occupancy (`unitAt`) scans `state.units`. HP lives on `Unit.vitals`.

**Changes required.** Two routes:
- *Heaviest:* a parallel `terrainObjects` collection on `GameState` with its own HP/TTL/occupancy/target-resolution and a damage path. The `attacker: Unit`/`target: Unit` types ripple through every pipeline stage + hook signature (`onDamageDealt`, `onFinalDamageReceived`, …) — large.
- *Lighter (recommended to evaluate):* model a Barrier as an impassable tile property + a small HP record, and route damage to it via `system_damage` rather than the full pipeline. Barriers need no variance/Faith/resistance/reactions, so the full `DamageContext` is overkill. Pathfinding already gates on `canEnter`/occupancy; LoS would hook the existing `line-of-sight.ts`/`arc.ts` cover logic. Either route needs a new *target identity* so `validateAction`/targeting can name a barrier, plus HP tracking, destruction on HP-0, and TTL (piece 9).

**Structured for it?** Partially. The target-resolution layer's `'tile'` discriminant ("the unit on this tile") is a natural seam to extend to "the object on this tile." But the pipeline's `Unit`-typed core is the real cost; routing barrier damage through `system_damage` (which already bypasses the pipeline) sidesteps most of it.

**Dependencies.** Depends on piece 1 (impassability), piece 9 (TTL), and interacts heavily with piece 8 (damage routing). Blocks the Barrier ability (Session B).

**Scope: Large** (the single biggest item). The `system_damage` routing decision could move it toward **Medium** — settle it in the substrate ADR.

### 6. AI terrain awareness — *the other big one*

**Current state.** AI reads elevation in two narrow spots, both for hit-chance, not strategy: `computeElevationModifier` (1.05/0.95/1.0; `projection.ts`) and endpoint-building for arc/LoS (`basic.ts`). `tilesInAbilityRange` enumerates reachable tiles but does no elevation strategy. **No awareness of high-ground value, chokepoints, cluster geometry for AoE-positioning, or terrain-mutation consequences.** AoE scoring counts enemies-in-cluster but never reasons about *creating* clusters.

**Changes required.** A new Worldcraft scorer paralleling `math-skill-scoring.ts` (the established per-ability dedicated-scorer pattern, registered in `src/ai/index.ts`). This is greenfield within a known shape — the blueprint's "deepest AI work in the project so far" is confirmed.

**Structured for it?** Neutral — clean pattern to copy, but no reusable terrain heuristics to build on.

**Dependencies.** Depends on everything else being functional. Last.

**Scope: Large** — its own session (Session C), as the blueprint predicts. Not substrate per se.

### 7. Renderer terrain

**Current state.** Terrain drawn **once at mount** (`battle-renderer.ts:176-178` draws tile/cliff-edge/elevation-label layers) and explicitly assumed static — a comment already says *"a future elevation-mutation ability would re-call `draw`"* (`battle-renderer.ts:60-62`). `redrawStaticLayers()` (context-loss recovery) is a ready re-draw entry point. The Animator's anim union has no terrain-change animation.

**Changes required.** On the terrain-change action, re-call the three layers' `draw` with the new map (instant update — the cheap, safe path the redraw path proves), re-applying tile textures for changed tiles. Animated raise/lower is optional polish (no tween infra exists). Engine-agnostic-of-rendering holds; the renderer reads `newState.map`.

**Structured for it?** Surprisingly yes — the redraw path exists and the static assumption is flagged as "re-call draw," not baked in.

**Dependencies.** Depends on piece 1 + a terrain-change action to key on.

**Scope: Small–Medium** (instant redraw Small; animation Medium). Session C.

### 8. "System-tagged" damage (Damage Split)

**Current state.** The cleanest surprise. `system_damage` **already** does what "system-tagged" needs: it *"Bypasses the seven-stage damage pipeline (no variance, no Faith, no resistance, no Counter trigger). Per ADR-0027"* (`action.ts:321-322`). Reactions fire only via hooks *inside* the pipeline path, which `system_damage` skips. And `SystemDamageSource` already carries a working reflect-bypass precedent: Spiked Mail's `{ kind: 'revenge'; wearerId; itemId }` (`action.ts:356-362`, S37) — `system_damage` emitted back at an attacker from `onFinalDamageReceived`, bypassing the attacker's reactions.

**Changes required.** Add one `SystemDamageSource` variant (e.g. `{ kind: 'reflect'; reactorId; attackerId }`, or generalize `'revenge'`). The reaction compiles through the existing `compileReactionAbility` path (cf. `counter.ts`) with an effect that emits this `system_damage`; the heal-half-the-damage half is a paired `system_heal` to the reactor. **No new DamageTag, no pipeline change.** The blueprint's open question 7 resolves: *no reflect-bypass tag or damage-type substrate is needed.*

**Structured for it?** Decisively yes — Spiked Mail is a near-template.

**Dependencies.** Standalone — no terrain dependency. Could ship first/anytime.

**Scope: Small.** *Audit-overturns-spec.*

### 9. Effect queue (per-Terraformer, LIFO revert)

**Current state.** Two strong precedents. **Statuses**: per-unit `Unit.statuses: ReadonlyArray<StatusInstance>`, each with `remainingDuration` decremented by the turn loop and a `customState?: Record<string, unknown>` escape hatch already used to carry cross-references (Charging stores its `ChargedActionId`). **Charged actions**: a per-state collection of tracked, deferred effects with their own resolution path. Neither has bounded-LIFO-revert-on-overflow.

**Changes required.** A per-Terraformer queue — cleanest as a new per-unit field (parallel to `statuses`) holding `{ ability_id, tile_set, original_elevations, cast_turn }`. The reducer enforces the cap by emitting a revert (a terrain-change + possible fall damage) before adding a new entry. Barrier TTL decrement piggybacks on the existing status turn-loop decrement. The `Expert Former` +2 cap is a *computed* read (`modifyStatQuery`-style), per the computed-not-stored rule.

**Structured for it?** Yes — statuses are a close structural model (per-unit array, TTL decrement, custom payload). The genuinely new part is cap-based LIFO eviction: a small reducer rule with no existing analog.

**Dependencies.** Depends on piece 1 (revert = terrain-change), piece 4 (revert fall damage), piece 5 (Barrier revert destroys objects). Central coordination point.

**Scope: Medium.** New per-unit collection + cap/eviction rule + TTL (reusing the status pattern).

### Bonus — Ignore Height (not one of the 9, flagged because it's free)

`jump` already flows through `modifyStatQuery` (`movement-profile.ts:52-56`), and pathfinding's `'fly'` special-movement already demonstrates dropping the jump constraint. Ignore Height = a `modifyStatQuery('jump')` handler returning a large value (the blueprint's "Jump = 99"), composing through existing hooks with **zero substrate**. Free class content (Session B), not substrate.

---

## Dependency ordering

```
Piece 8 (system-tagged damage) ── standalone, no terrain dependency → ship anytime

Piece 1 (mutable terrain state)  ──┬──► Piece 2 (pathfinding)   [free — just reads]
   FOUNDATION                      ├──► Piece 3 (AoE)           [free — just reads]
                                   ├──► Piece 4 (fall damage)   [small reuse]
                                   ├──► Piece 7 (renderer)      [small redraw]
                                   └──► Piece 9 (effect queue) ──► revert path

Piece 5 (terrain objects/Barrier) ── depends on 1 (impassability) + 9 (TTL) + 8 (damage routing)

Piece 6 (AI awareness)           ── depends on 1,3,4,5,9 functional → last (own session)
```

**Build order:** `8 (or anytime) → 1 → {2,3,4,7 fall out nearly free} → 9 → 5 → 6.`

---

## Audit-overturns-spec findings

Where the codebase is already structured well, making the work smaller than the blueprint assumes:

1. **Mutable terrain state is half-built.** `map` is part of mutable `GameState` (`game-state.ts:41`), not a catalog-held static. No delta-composition layer needed. *Smaller than spec.*
2. **Pathfinding: zero substrate** — fresh-computed, pure, no cache; module comments already anticipate terrain mutation. The "if cached, invalidate" branch does not apply.
3. **AoE: zero substrate** — reads live elevation by argument.
4. **"System-tagged" damage already exists** — `system_damage` bypasses pipeline/resistance/Faith/reactions (ADR-0027), and Spiked Mail's `'revenge'` source is a working reflect-bypass precedent. Damage Split = one new `SystemDamageSource` variant; no new tag. *Smallest, not a new concept.*
5. **Fall damage reusable** — `10 × dropDistance` + `'falling'` `system_damage` exist; only a small helper extraction.
6. **Ignore Height is one line** — `modifyStatQuery('jump')`; not substrate.
7. **Renderer anticipates this** — static-terrain comment says "re-call draw"; `redrawStaticLayers()` is a ready path. Instant update cheap; only animation is new.
8. **Effect queue has a close model** — statuses (per-unit array + turn-loop TTL + `customState`). Only bounded-LIFO eviction is new.

**Net:** the scary-sounding substrate (pieces 1 and 8) is mostly pre-built. The real new work is **piece 5 (terrain objects)** and **piece 6 (AI)**, with **piece 9 (queue)** medium; 2/3 free, 4/7 small. Session A is lighter than "2-3 sessions" implies — plausibly one focused session if Barrier damage routes through `system_damage` rather than widening the `Unit`-typed pipeline.

---

## Open decisions for the substrate session(s)

These are settle-before-implementation calls the audit surfaces; none block this session.

1. **Barrier damage routing — `system_damage` vs. a full terrain-object target type in the pipeline.** This is *the* scope-determining decision. Routing through `system_damage` (Barriers don't need variance/Faith/resistance/reactions) avoids widening every `Unit`-typed pipeline stage + hook signature and likely collapses Session A to one session. Recommend `system_damage` routing unless a future terrain object genuinely needs pipeline mechanics. (Aligns with blueprint open question 5/7.)
2. **Barrier as a 5th Worldcraft ability vs. folded in** (blueprint open Q3) — substrate-neutral; affects content shape, not the substrate.
3. **Effect-queue cap as computed read.** Confirm `Expert Former` (+2) composes as a `modifyStatQuery`-style computed cap, not a stored field (CLAUDE rule 5).
4. **Terrain-change action granularity.** One action per cast (1 tile for Pillar/Pit, 9 for Hill/Valley, a line for Barrier) with the full tile-set + original elevations on the outcome for replay — vs. one action per tile. Recommend per-cast (matches the blueprint's "one queue entry per cast" and keeps revert atomic).
5. **KO behavior** (blueprint: effects persist past Terraformer KO) — a turn-loop/queue-lifecycle rule, settle when building piece 9.
6. **Renderer: instant vs. animated terrain transition** — ship instant first (Session C); animation is polish.

## Disagreements with the blueprint

The blueprint and this audit largely agree; the audit only *reduces* scope. The one framing the substrate session should consciously revise: the blueprint's **"2-3 implementation sessions, possibly more"** for substrate overstates it. With Barrier routed through `system_damage`, the substrate (pieces 1, 4, 5, 8, 9 + the free 2, 3, 7) is plausibly one focused session; class+abilities (Session B) and AI+UI+polish (Session C) remain as the blueprint sequences them. Net arc likely **3 sessions** (substrate / class / AI+UI), matching the blueprint's lower bound, with AI (piece 6) being the genuine large unknown.
