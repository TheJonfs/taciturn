# Session 53 Brief: Terraformer Substrate (Mutable Terrain + Effect Queue + Barrier + Damage Split)

## Context

S52 closed with Marshmoor (third map), bow horizontal range from height (FFT-canon mechanic, genericized as data field), and the Terraformer substrate audit deliverable. 1465 → 1510 tests.

The audit overturned the blueprint's "2-3 substrate sessions" framing with eight audit-overturns-spec findings — the engine is materially cleaner for the Terraformer than the blueprint assumed. Chris has confirmed three settle-before-implementation calls:

1. **Barrier damage routes through `system_damage`** (avoids widening the `Unit`-typed pipeline; Spiked Mail's `'revenge'` precedent applies).
2. **Effect-queue cap is `modifyStatQuery`-style computed read** (consistent with CLAUDE rule on computed-not-stored).
3. **Terrain-change action is per-cast granularity** (one action emits whole tile-set with originals for atomic revert).

With these calls settled, **S53 is the Terraformer substrate session — a single focused session** per the audit's revised estimate. The Terraformer arc collapses to 3 sessions total: substrate (S53) → class (S54) → AI+UI (S55).

This session covers substrate **pieces 1, 4, 5, 7, 8, 9** from the audit (with **pieces 2, 3 verified-free** via regression tests). **Piece 6 (AI awareness)** is its own session (S55). Terraformer class content (Worldcraft abilities, ClassDefinition, equipment integration) lands in S54.

Scope: **Medium-Large.** Substantial but bounded; comparable to S49's substrate-plus-class scope, though here we're substrate-only.

## Inputs (read first)

In recommended order:

1. **`CLAUDE.md`** — project conventions.
2. **`docs/handoff.md`** — S52 close, including the stale `guide/` dev server on 5173 (work on 5174).
3. **`docs/decisions/draft-terraformer-substrate-audit.md`** — **the primary reference for this session.** File:line citations verified at audit time; treat as authoritative for current-tree structure.
4. **`docs/thirtyNinePlanning/terraformer-blueprint.md`** — design context. Note: open question #7 (system-tagged damage substrate) is **closed** per audit — `system_damage` already exists; Damage Split uses an additional `SystemDamageSource` variant. Update the blueprint at session close to reflect.
5. **`docs/decisions/0027-system-damage.md`** (or wherever ADR-0027 lives) — the bypass semantics for `system_damage`.
6. **`src/engine/map/knockback.ts:64, 123-130`** — `FALLING_DAMAGE_PER_LEVEL = 10` formula + `'falling'` `SystemDamageSource` usage. Reference for fall-damage helper extraction.
7. **`src/engine/types/action.ts:354-362`** — `SystemDamageSource` union including `'revenge'` (Spiked Mail) variant. Reflect-bypass precedent for Damage Split.
8. **`src/engine/abilities/counter.ts`** (or equivalent) — `compileReactionAbility` Reaction-compilation pattern; Damage Split follows this path.
9. **`src/engine/types/game-state.ts:41`** — `map` is part of mutable `GameState`. Foundation for mutable terrain state.
10. **`src/engine/map/pathfinding.ts:4-5`** — pathfinding is pure/fresh; module comments anticipate terrain mutation.
11. **`src/renderer/battle-renderer.ts:60-62, 176-178`** — renderer anticipates terrain mutation; `redrawStaticLayers()` is the redraw path.

### Paths to survey before planning

The audit has already done the primary survey. Plan-review confirms:

- **Terrain-change action shape.** Audit-recommended: `system_terrain_change` action type with `tile_set: ReadonlyArray<{ x, y, originalElevation, newElevation, originalTerrain, newTerrain }>` payload. Reducer produces new state with structurally-shared updated `map.tiles`. Per-cast granularity (one action for Hill's 9 tiles).
- **Effect queue per-unit shape.** Audit-recommended: parallel to `Unit.statuses`. New field like `Unit.worldcraftEffects: ReadonlyArray<WorldcraftEffectEntry>` (name TBD). Entry shape: `{ ability_id, tile_set, original_elevations, cast_turn, ttl? }` (TTL only for Barrier). TTL decrement piggybacks on existing turn-loop status decrement.
- **Effect cap computation.** Audit-recommended: `modifyStatQuery`-style computed read with default `2`; `Expert Former` Support adds `+2` via the same hook. Composability test: equipping/unequipping Expert Former changes the cap dynamically.
- **Barrier object shape.** Audit-recommended: terrain object via tile-side property (impassable flag + HP + TTL on the tile) rather than separate collection. Pathfinding's existing `canEnter`/occupancy gates handle impassability. Damage routes through `system_damage` (no variance/Faith/resistance/reactions; bypasses the `Unit`-typed pipeline entirely).
- **Damage Split `SystemDamageSource` variant.** Audit suggests `{ kind: 'reflect'; reactorId; attackerId }` (new variant) or generalize `'revenge'`. Recommend new `'reflect'` variant — keeps the precedents distinct (`'revenge'` = passive equipment reflect; `'reflect'` = Reaction-triggered).
- **`system_heal` for Damage Split self-heal.** Audit notes "the heal-half-the-damage half is a paired `system_heal` to the reactor." Confirm `system_heal` exists as a parallel to `system_damage`. If not, may need a small addition.

## Goal

End state:

**Substrate:**

- **New action type** `system_terrain_change` with reducer producing structurally-shared new state.
- **Per-unit effect queue** field (`worldcraftEffects` or similar) on `Unit`, parallel to `statuses`.
- **Bounded LIFO eviction** logic: queue cap reached → oldest entry reverted (terrain reverse + fall damage if applicable) before new entry added.
- **TTL decrement** on Barrier entries piggybacks on existing turn-loop status decrement.
- **Effect cap via `modifyStatQuery`-style computed read**, default 2; Expert Former adds +2.
- **Fall damage helper** extracted from `knockback.ts` for reuse across terrain-change/revert paths.
- **`SystemDamageSource` variant** added for Damage Split reflect (`'reflect'` recommended).
- **`system_heal` action** confirmed available (or added) for Damage Split's self-heal.
- **Damage Split Reaction** compiled and registered in the ability catalog — ships as standalone substrate-validating content. Not yet equipped on any class (S54 wires to Terraformer's native R/S/M).
- **Terrain object** (Barrier) on tile data: impassable flag, HP, TTL. Damage routes through `system_damage`. Tile-side target identity so `validateAction` can name a barrier as a damage target.
- **Renderer redraw** triggered on `system_terrain_change` action via `redrawStaticLayers()` or equivalent path. Instant update only; animation deferred.

**Substrate verified-free:**

- **Pathfinding** correctly responds to terrain mutation (regression tests: mutate elevation, verify legal-moves recomputed).
- **AoE shape** correctly responds to terrain mutation (regression tests: mutate elevation, verify `aoeFootprint` filters tiles per new elevation).

**Quality:**

- Tests +60-90 (estimated).
- ADR 0088 (or next number) for the Terraformer substrate (the substantial new piece; covers mutable terrain action, effect queue, terrain objects via system_damage, and the Damage Split pattern).
- Blueprint updated at session close: close OQ#7, add audit-confirmed implementation patterns, update phasing estimate.
- `docs/handoff.md` updated.
- `docs/content-id-registry.md` updated for Damage Split (and any other catalog additions).
- `docs/playtest-watch.md` — substrate doesn't directly produce playtest signal (no consuming content yet), but watch-fors documented for S54 onward.
- Vercel pre-flight discipline.
- Browser verification limited (no Worldcraft abilities to exercise yet); renderer redraw smoke-tested via a synthetic terrain-change in dev tools or test scaffold.

## Pre-implementation plan

The audit has already produced the bulk of the pre-implementation work. **Plan-review checkpoint** confirms:

1. Settle-before-implementation calls (confirmed by Chris in prior conversation; restated in this brief).
2. Per-piece scope estimates align with audit findings.
3. Test plan per piece.
4. ADR scope (recommended: single ADR covering the substrate as a whole, since the pieces are tightly coupled).

### Architectural decisions

After audit (most confirmed by Chris):

1. **Barrier damage routes through `system_damage`** — confirmed. No variance, no Faith, no resistance, no reactions. Spiked Mail's `'revenge'` source is the precedent.
2. **Effect-queue cap via `modifyStatQuery`-style computed read** — confirmed. Default 2; Expert Former adds +2.
3. **Terrain-change action per-cast granularity** — confirmed. One action carries the whole tile-set.
4. **Effect queue per-unit field name** — proposing `worldcraftEffects`. Open to alternatives (`terrainEffects`, `activeWorldcraft`) per Chris's call.
5. **Damage Split `SystemDamageSource` variant naming** — proposing `'reflect'` (new variant, kept distinct from `'revenge'`).
6. **Renderer animation deferred to polish** — instant redraw only in S53. Animation in S55 if desired.
7. **Damage Split lands as substrate-validating content** — Reaction in catalog, not yet equipped. S54 wires to Terraformer freeAbilities.

### Decision points

(Settled in plan-review.)

**D1 — Action type naming.** `system_terrain_change` proposed (audit-suggested). Other candidates: `terrain_mutate`, `terraform`. Recommend `system_terrain_change` for consistency with other `system_*` actions.

**D2 — Effect queue field naming.** `worldcraftEffects` proposed. Per-unit array parallel to `statuses`.

**D3 — `SystemDamageSource` variant for Damage Split.** `'reflect'` (new variant) recommended over generalizing `'revenge'`.

**D4 — Barrier tile-side data shape.** Audit-recommended: `Tile.barrier?: { hp, ttl }` (optional field). Impassable while present; pathfinding gates on the field.

**D5 — `system_heal` availability.** Audit notes paired `system_heal` for Damage Split self-heal. Plan-review confirms whether this exists or needs adding.

**D6 — Effect cap computation hook.** `modifyStatQuery('worldcraft_effect_cap')` or similar. Default value 2; Expert Former adds 2. Hook implementation pattern parallel to other `modifyStatQuery` consumers.

**D7 — Revert ordering when multiple effects evicted in succession.** If cap is exceeded by N: revert oldest N entries one at a time, each emitting its own terrain-change + fall damage. Recommend serial revert (not batched) for clean tile-by-tile fall damage computation.

**D8 — Renderer redraw scope.** Audit-recommended: `redrawStaticLayers()` re-call on terrain-change. Covers the cheap-and-safe path. Implementer determines whether changed tiles can be redrawn incrementally (optimization) or full-redraw is acceptable.

## Implementation work

Ordered per the audit's dependency graph: `8 → 1 → {2,3,4,7} → 9 → 5`.

### Piece 8: Damage Split substrate (Reaction + `'reflect'` SystemDamageSource)

- New `SystemDamageSource` variant: `{ kind: 'reflect'; reactorId; attackerId }`. Parallel to `'revenge'`.
- Verify `system_heal` action availability; add if absent (small if needed).
- Implement Damage Split Reaction:
  - Trigger: unit takes damaging attack, survives (HP > 0 after damage), Brave-gates.
  - Effect: emit `system_damage` with `'reflect'` source for original damage amount → attacker; emit `system_heal` for half-damage → reactor.
  - Pattern: existing `compileReactionAbility` (cf. `counter.ts`).
- Register Damage Split in ability catalog (`src/content/abilities/damage_split.ts` or equivalent).
- Tests: trigger gate, system_damage bypasses defenses, self-heal applies, attacker reactions don't cascade (the bypass property), survival gate. ~8-12 tests.

### Piece 1: Mutable terrain state

- New `system_terrain_change` action type with payload `{ tile_changes: ReadonlyArray<{ x, y, originalElevation, newElevation, originalTerrain, newTerrain }> }`.
- Reducer produces new state with structurally-shared `map.tiles` update (Immer one-liner).
- Per-cast granularity: one action carries the full tile-set for any cast (1 tile for Pillar/Pit; 9 for Hill/Valley; 3-5 for Barrier).
- Tests: single-tile change, multi-tile change, water-toggle behavior (elev 0 ↔ 1 ↔ 2+ shifts terrain type correctly), reducer immutability. ~10-15 tests.

### Piece 2: Pathfinding (verify free)

- Regression tests: mutate terrain via `system_terrain_change`, verify `getLegalMoves` recomputes correctly with new elevation values.
- Specifically: unit can no longer reach a tile after Pillar raises it beyond jump range; unit can now reach a tile after Pit lowers it below original.
- No engine code changes expected. ~3-5 tests.

### Piece 3: AoE (verify free)

- Regression tests: mutate terrain, verify `aoeFootprint` filters tiles per new vertical-tolerance against new elevations.
- Specifically: AoE that previously included a tile (per old elevation) now excludes it after Pillar raises that tile beyond tolerance; reverse case for Pit.
- No engine code changes expected. ~3-5 tests.

### Piece 4: Fall damage helper

- Extract `FALLING_DAMAGE_PER_LEVEL = 10` and the `'falling'` `system_damage` emission into a shared helper function: `emitFallDamage(unitId, dropDistance, ctx)`.
- Existing `applyKnockback` callsite updated to use the helper.
- New consumers (terrain-change reducer for Pit/Valley direct drops + effect-queue revert for Pillar/Hill revert drops) use the same helper.
- Tests: helper emits correct damage amount, correct source, correct tag; existing knockback regression. ~5-8 tests.

### Piece 7: Renderer redraw

- On `system_terrain_change` action, renderer re-calls the relevant draw layers (tile/cliff-edge/elevation-label per `battle-renderer.ts:176-178`).
- Use `redrawStaticLayers()` path or equivalent. Instant update only; no animation.
- Renderer remains engine-agnostic — reads `newState.map`.
- Tests: limited unit-test coverage (renderer tests are tricky); smoke test via test scaffold that triggers a terrain-change action and verifies the renderer's draw method was called. ~3-5 tests.

### Piece 9: Effect queue

- New per-unit field `Unit.worldcraftEffects: ReadonlyArray<WorldcraftEffectEntry>`.
- Entry shape: `{ ability_id, tile_set, original_elevations, cast_turn, ttl? }` (TTL only for Barrier).
- New helper `enqueueWorldcraftEffect(unit, entry, ctx)`:
  - Reads current cap via `modifyStatQuery('worldcraft_effect_cap')` (default 2; Expert Former adds +2).
  - If queue length ≥ cap: revert oldest entry first (emit terrain-change action reversing the deltas; emit fall damage via the helper for raised-tile reverts).
  - Add new entry.
- TTL decrement piggybacks on existing turn-loop status decrement (audit-confirmed).
- On Barrier entry TTL expiry: revert tile (clear `Tile.barrier` field).
- KO behavior: effects persist past Terraformer KO (per blueprint and Chris's earlier confirmation); Barrier TTL keeps ticking; raised tiles stay raised until cap eviction.
- Tests: enqueue under cap, enqueue at cap with eviction, eviction emits revert correctly, fall damage on revert, TTL decrement, Barrier TTL expiry, computed cap with/without Expert Former. ~15-20 tests.

### Piece 5: Terrain objects (Barrier) via `system_damage`

- New `Tile.barrier?: { hp: number; ttl: number; ownerId: UnitId }` optional field.
- Pathfinding's `canEnter` gate: barrier present → impassable.
- LoS: barrier blocks line-of-sight (recommendation: yes, but settle in plan-review).
- Targeting: tile-side target resolution extended — `validateAction` recognizes "tile with barrier" as a damageable target. `target.kind = 'tile'` with `barrier_present = true` → returns barrier as the target (rather than null for empty-tile case).
- Damage application: barrier takes damage via `system_damage` action (bypasses pipeline). HP decreases; HP ≤ 0 destroys (clears `Tile.barrier`).
- AoE damage that includes barrier tiles also damages the barrier (each barrier tile takes the AoE damage).
- Barrier destruction (HP-0) and TTL expiry both clear the tile field cleanly.
- Tests: barrier impassability, targetability, damage routing via `system_damage`, destruction at HP-0, multi-tile Barrier (5-tile line) each takes damage independently, AoE damage to barriers. ~15-20 tests.

### Tests (total)

Estimated +60-90 tests across all pieces. Final count depends on regression coverage and edge cases surfaced during implementation.

### UI surfaces

S53 is substrate-only; no consumer content yet. UI surfaces are:
- Renderer redraws on terrain change (verified via synthetic terrain-change in dev tools or test).
- No new player-facing UI (Worldcraft target-select, queue display are S54/S55).

## Acceptance criteria

**Substrate:**

- `system_terrain_change` action works: single-tile, multi-tile, water-toggle.
- Pathfinding recomputes correctly after terrain mutation (verified by regression).
- AoE filters correctly after terrain mutation (verified by regression).
- Fall damage helper extracted and used at all relevant sites.
- `'reflect'` `SystemDamageSource` variant added; Damage Split Reaction compiles and triggers correctly (system_damage to attacker bypasses defenses; system_heal to reactor applies).
- Effect queue: enqueue, cap-based eviction with revert, TTL decrement, computed cap.
- Barrier: impassable, targetable, damageable via system_damage, destroyed at HP-0, TTL expiry clears tile.
- Renderer redraws on terrain mutation.

**Damage Split:**

- Registered in ability catalog.
- Triggers on damaging attack with survival.
- Brave-gated.
- Heals self for half damage; deals original damage to attacker as `'reflect'` `system_damage`.
- Doesn't cascade (attacker's reactions don't fire on the `system_damage` reflect).

**Quality:**

- Tests at 1570-1600, 0 failing.
- ADR 0088 written and committed.
- Blueprint updated (close OQ#7, add audit-confirmed patterns, update phasing).
- Docs updated.
- Vercel pre-flight clean.
- Browser smoke: app loads, no console errors; synthetic terrain-change via dev tools (if possible) triggers renderer redraw correctly.

## Out of scope

- **Terraformer class content** — ClassDefinition, stats, Worldcraft abilities (Pillar/Pit/Hill/Valley/Barrier), equipment integration, free-abilities wiring. **All S54.**
- **Native R/S/M wired to Terraformer** — Damage Split lands in catalog this session; equipping on Terraformer is S54.
- **Worldcraft target-select UI** — S54 or S55.
- **Worldcraft area preview** — S54/S55.
- **Effect queue display UI** — S55.
- **AI Worldcraft scoring** — Piece 6 in audit, dedicated session (S55).
- **Renderer terrain transition animation** — instant redraw only; animation as polish in S55 or later.
- **Marshmoor playtest tuning** — separate concern.
- **Calculator team template revision** — long-running carry; not S53.
- **AI deployment role-aware sorting** — long-running carry; not S53.
- All other standing carries.

## Files likely touched

A non-exhaustive list. Audit confirms / corrects.

**Engine types:**
- `src/engine/types/action.ts` — `system_terrain_change` action; `SystemDamageSource` `'reflect'` variant.
- `src/engine/types/unit.ts` — `worldcraftEffects` per-unit field.
- `src/engine/types/tile.ts` — `barrier?: { hp, ttl, ownerId }` optional field.

**Engine reducers:**
- `src/engine/reducers/system-actions.ts` (or equivalent) — `system_terrain_change` reducer.
- `src/engine/reducers/index.ts` — action wiring.

**Engine effects:**
- `src/engine/effects/queue.ts` (new) — `enqueueWorldcraftEffect` helper + cap eviction + revert logic.
- `src/engine/effects/index.ts` — exports.

**Engine map / damage:**
- `src/engine/map/knockback.ts` — fall damage helper extraction.
- `src/engine/map/fall-damage.ts` (new) — shared helper if extracted to new file.
- `src/engine/map/pathfinding.ts` — `canEnter` gate adds barrier check.
- `src/engine/map/line-of-sight.ts` (or equivalent) — barrier LoS check if applicable.

**Engine abilities:**
- `src/content/abilities/damage_split.ts` (new) — Reaction definition.
- `src/engine/abilities/index.ts` — registration.

**Engine validation / targeting:**
- `src/engine/abilities/validate.ts` — tile-target extension for barrier targets.

**Engine hooks:**
- `src/engine/hooks/stat-query.ts` (or wherever `modifyStatQuery` lives) — `'worldcraft_effect_cap'` query support.

**Engine turn loop:**
- `src/engine/turn/index.ts` (or wherever status decrement happens) — TTL decrement for `worldcraftEffects` entries with TTL.

**Renderer:**
- `src/renderer/battle-renderer.ts` — terrain-change redraw trigger.

**Tests:**
- `src/test/session-53-substrate.test.ts` (or split per piece) — substrate test coverage.
- Regression tests in `pathfinding.test.ts`, `aoe.test.ts` for terrain-mutation verification.

**Docs:**
- `docs/decisions/0088-terraformer-substrate.md` (new ADR).
- `docs/thirtyNinePlanning/terraformer-blueprint.md` — update.
- `docs/decisions/draft-terraformer-substrate-audit.md` — promote / archive as appropriate.
- `docs/handoff.md` — session close.
- `docs/content-id-registry.md` — Damage Split addition.
- `docs/playtest-watch.md` — substrate-impact watch-fors for S54 onward.

## Workflow notes

- **Plaintext-first review required.**
- **Audit is primary reference.** Implementer should treat the audit doc as the authoritative survey of current-tree structure; file:line references are spot-verified.
- **Settle-before-implementation calls confirmed by Chris** — Barrier through `system_damage`, computed cap, per-cast granularity. Implementer doesn't need to re-surface these.
- **Vercel pre-flight discipline.** `rm node_modules/.tmp/tsconfig.app.tsbuildinfo && rm node_modules/.tmp/tsconfig.node.tsbuildinfo` before final `tsc -b`. Per S48–S52 carry.
- **Damage Split lands standalone for substrate validation.** Equipping on a class happens in S54; tests in S53 use synthetic unit setups.
- **Browser verification limited.** No consumer content yet for terrain mutation; renderer redraw smoke-tested via test scaffold or dev tools.
- **Mid-session design questions** route through Chris to the planner. Most likely surfaces:
  - `system_heal` availability (audit notes this; plan-review confirms).
  - Barrier LoS blocking (audit notes "recommendation: yes"; plan-review settles).
  - Effect queue field naming finalization.
  - ADR scope (single substrate ADR vs. multiple).
- **Stale `guide/` dev server on 5173** — S52 carry. Implementer should kill the stale process or default preview to 5174 from the start. Worth resolving early in the session to avoid confusion.

## Watch-fors

**Addressed this session:**
- Terraformer substrate (pieces 1, 4, 5, 7, 8, 9; pieces 2, 3 verified-free).
- Damage Split Reaction (substrate-validation, lands in catalog).

**Not addressed this session, longer-term carry-forward:**
- All standing carries (none addressed).
- **Terraformer class content (S54)** — ClassDefinition, Worldcraft abilities, native R/S/M wiring.
- **AI Worldcraft scoring (S55)** — Piece 6 in audit.
- **Worldcraft UI** — S54 or S55.
- **Renderer animation polish** — deferred.

**Watch-fors specific to this session:**

- **Substrate-substrate interaction.** Effect queue + Barrier + terrain mutation + fall damage on revert all compose. Watch for any subtle ordering issues (e.g., does the revert action's terrain-change emit fall damage before or after the queue updates? Does Barrier destruction cleanly evict the queue entry?).
- **Damage Split bypass correctness.** The `system_damage` bypass property is the core defense — attacker's reactions shouldn't cascade off the reflect. Spiked Mail's precedent should hold; verify the pattern composes for Reaction-emitted system_damage as well as passive-emitted.
- **Effect cap computability.** Expert Former adds +2 via `modifyStatQuery`; verify the hook composes cleanly with other potential equipment that might modify the cap. (None currently; future-proofing.)
- **Renderer redraw correctness on the changed tiles.** Audit confirms `redrawStaticLayers()` is the right path; verify the redraw picks up the new elevation values and re-paints terrain textures correctly.
- **Pathfinding free-substrate verification.** The audit's "zero substrate" claim depends on pathfinding being fully pure and fresh-read. Regression tests with terrain mutation confirm this; any unexpected pathfinding cache (per-unit, per-turn) would surface here.
- **Fall damage helper extraction.** Verify the existing `applyKnockback` callsite still works correctly post-extraction; the helper should be a no-op refactor for existing fall damage.
- **Barrier vs. AoE.** Audit notes barrier blocks pathing; AoE damage to a tile with barrier hits the barrier instead of (or in addition to?) any unit. Plan-review settles the exact semantics.

## Estimated size

**Medium-Large.** Single focused session per audit's revised estimate. Substantial work (~60-90 tests, multiple commits) but bounded by the audit's tight scope.

**No split contingency anticipated** — the audit's per-piece scope estimates suggest all of S53 fits in one session. If budget tightens:
- Damage Split (Piece 8) can ship first (standalone, no terrain dependency).
- Pieces 2, 3 verification can defer (regression-only).
- Renderer redraw can defer with a placeholder log if needed.

**Stretch indicators** (opportunistic):
- Terraformer blueprint updates (close OQ#7; add audit-confirmed patterns).
- Marshmoor template-compliance tests (S52 stretch carry).
- Tidewalker AI weighting on water-heavy maps (S52 stretch carry; affects Marshmoor playtest).

These are pure housekeeping; not core scope.
