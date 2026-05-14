# Session 32 Plan — Cluster 6 substrate + pre-battle orchestrator pass + cliff-edge overlay

*Plaintext plan for review before code lands. Per brief workflow note.*

## 1. Audit findings (current-tree state)

### Move engine
- Pathfinder lives in [src/engine/map/pathfinding.ts](src/engine/map/pathfinding.ts) — Dijkstra, cardinal-only adjacency (`CARDINAL_DELTAS`), per-tile cost via `stepCost(profile, toTile)`. `canStep` enforces `canEnter`, occupancy + friendly pass-through, and the `|Δelev| ≤ jump` rule.
- `MovementProfile` composition: [src/engine/map/movement-profile.ts](src/engine/map/movement-profile.ts) routes `moveRange`, `jump`, `canEnter`, `terrainCosts`, `specialMovement` each through a hook chain. **Water Mage M-ability hook is wired** — `modifyTerrainCosts` exists (`src/engine/hooks/runners.ts`), Tidewalker registers against it ([src/content/abilities/tidewalker.ts](src/content/abilities/tidewalker.ts)) and Water Mage's `freeAbilities` set includes it ([src/content/classes/water-mage.ts:53](src/content/classes/water-mage.ts:53)). **No gap to close this session.**
- Tidewalker reads `args.baseValue.get('water')` — keyed on terrain string. River Ridge's authoring convention (per Chris): tile.terrain ties to tile.elevation (`water_deep` at elev 0, `water_shallow` at elev 1, `ground` at elev ≥ 2). Tidewalker as authored today decrements `'water'` only and won't compose against the deep/shallow split. **Watch-for for S33, not S32.**

### Knockback
- Knockback primitive: [src/engine/map/knockback.ts](src/engine/map/knockback.ts). `KnockbackResult.fallingDamageAction` populated when `dropDistance > 1` (emits `system_damage` with `amount = 10 × dropDistance`). Position resolution is deterministic; no water-specific check — water tiles are valid destinations as long as `canEnter` and elevation tolerance allow. Substrate supports the River Ridge engine requirement out of the box.
- The reducer's knockback path is [src/engine/actions/reducers.ts](src/engine/actions/reducers.ts) around line 640 (post-S31.5 ADR-0070 wiring records `displacedTo` for animator).

### Pre-battle equipment auto-status
- `applyEquipmentStatusGrants` is a private function in [src/engine/setup/create-initial-state.ts:180](src/engine/setup/create-initial-state.ts:180). Called once at line 79 of `createInitialState`. Mutates state via `applyStatus` directly (not through the reducer / action log). `ApplyStatusArgs` carries `sourceKind: 'equipment'` + `sourceEquipmentId` already, so status-instance provenance is fine; the *action* log just doesn't see the apply.
- One call site — reroute is contained.

### Initial CT randomization
- Lives in `placementToUnit` ([create-initial-state.ts:96](src/engine/setup/create-initial-state.ts:96)): `placement.initialCT ?? resolveInitialCT(ruleset, placement, masterSeed)`. The randomization is per-unit-deterministic (`unitFloatFromKey(masterSeed, placement.id)`); same masterSeed + same unit id → same CT.
- Stored directly on `Unit.ct` at construction time. No action log entry.

### Orchestrator
- [src/app/demo/orchestrator.ts](src/app/demo/orchestrator.ts). Drives one root action per `step()`. Between turns (`turnState === null`) it advances the CT scheduler (`advanceToNextEvent`) and commits the resulting `turn_start`. No pre-battle phase today — battle "starts" when the first scheduler advance happens against the constructed initial state.

### Renderer
- Tile layer: [src/renderer/tile-layer.ts](src/renderer/tile-layer.ts) (131 lines). Single `Container` with a colored-rect fallback `Graphics` + a texture-overlay child `Container` (per ADR-0054). No cardinal-neighbor overlay pass exists today — cliff edges are a net-new layer.
- Battle renderer: [src/renderer/battle-renderer.ts](src/renderer/battle-renderer.ts) wires `tile-layer`, `highlight-layer`, `unit-layer`, `animator`. The cliff-edge overlay slots between `tile-layer` and `highlight-layer`.

### Damage pipelines
- [src/content/rulesets/default.ts:58](src/content/rulesets/default.ts:58) — `DEFAULT_DAMAGE_PIPELINE` has 8 stages including `postFinalize: ['fire_on_final_damage']`.
- [src/engine/catalog/test-fixtures.ts:59](src/engine/catalog/test-fixtures.ts:59) — `DEFAULT_TEST_DAMAGE_PIPELINE` has **7 stages, missing `postFinalize` entirely**. This is the S31.5-handoff-flagged drift. `EMPTY_DAMAGE_PIPELINE` (same file, line 39) also missing `postFinalize`.

---

## 2. Architectural decisions (resolved)

Per Chris's plan-review answers (2026-05-13):

| # | Decision | Resolution |
|---|---|---|
| D1 | Jump-over-water generation shape | A — expand-time generation (per brief recommendation) |
| D2 | Pre-battle action-source variant | B — sub-discriminant on existing `'system'` source via a new payload field (per brief) |
| D3 | Orchestrator pre-battle pass shape | B — separate orchestrator phase between init and turn 0 (per brief) |
| D4 | Initial CT randomization fold-in | A — fold in as logged actions through reducer |
| D4 sub | Initial CT action shape | New `system_set_ct` action type (semantically honest) |
| D5 | Water Mage M-ability gap | No gap — Tidewalker wired through `modifyTerrainCosts`. Watch-for for S33 (terrain-family widening) |
| D6 | Cliff-edge thickness | B — categorical tiers (1px Δ=1, 2px Δ=2-3, 3px Δ=4+) |
| D7 | Corner stack marker scaling | **Deferred to S33** (cliff edges only this session) |
| D8 | Cliff-edge color derivation | A — darker shade of higher tile's palette color |
| D9 | Cliff-edge rendering location | New overlay pass between `tile-layer` and `highlight-layer` |
| D10 | Rendering scope | Cliff edges ship this session; stack markers defer to S33 |
| D11 | Test strategy | Unit + integration coverage per item; rendering snapshot test against synthetic elevation-variant fixture |
| D12 | Order of work | Substrate → defensive → rendering. Each step gates on prior tests passing |
| D13 | 32a/32b split | No split — cliff edges only, substrate scope manageable |

### On the water-tile cost model (audit clarification)

Per Chris's call: terrain string is the cost key, but authors tie terrain to elevation by convention. River Ridge authoring (S33) will use `water_deep` (elev 0) / `water_shallow` (elev 1) / `ground` (elev 2+). The jump-over-water predicate uses **elevation** directly (per the brief) — robust to authoring convention changes, doesn't depend on terrain-string lookup.

Tidewalker remains as authored (keys on `'water'`); becomes a no-op against River Ridge until S33 widens it. Flagged in handoff.

---

## 3. Item-by-item implementation

### Item 1 — Jump-over-water pathfinding (brief Item 15)

**Files**: [src/engine/map/pathfinding.ts](src/engine/map/pathfinding.ts), `src/engine/map/pathfinding.test.ts`.

In Dijkstra's per-node expansion loop, after the standard cardinal-step candidates:
1. For each cardinal direction, compute `mid = (x+dx, y+dy)` and `dest = (x+2·dx, y+2·dy)`.
2. Both must be in-bounds.
3. The intermediate `mid` tile must be water (elevation 0 or 1).
4. The destination `dest` tile must be land (elevation ≥ 2).
5. The moving unit must have `profile.jump ≥ 1`.
6. The destination must satisfy `canStep` (occupancy, `canEnter`). The intermediate is *not* required to satisfy `canEnter` — the leap goes over it.
7. The destination must satisfy `Math.abs(destTile.elevation - currentTile.elevation) ≤ profile.jump` — same elevation tolerance as a standard step. (Open question: do we measure elevation delta relative to the *source* or the *intermediate*? Brief says "Jump ≥ 1 on the moving unit" without specifying the delta check. I'll go source-to-dest for consistency with stepping over a multi-elev gap; flag in plan-review.)
8. Leap cost: **fixed 2 move points** (per brief). Independent of `terrainCosts`.
9. Push as a frontier candidate the same way a standard step does.

**Layer handling**: River Ridge is single-layer. The cardinal-two-step leap uses `tilesAt(state.map, dest.x, dest.y)` and iterates layers, same as standard adjacency.

**Determinism**: pathfinder is pure; leap candidates are deterministic from `(state, unitId, catalog)`.

**Tests** (in `pathfinding.test.ts`):
- Leap candidate generated when intermediate is shallow water (elev 1) + destination is land (elev 2), Jump=1, cost 2 ✓
- Leap candidate generated when intermediate is deep water (elev 0) + destination is land ✓
- Leap **not** generated when intermediate is land (elev ≥ 2) — standard step covers it ✓
- Leap **not** generated when destination is water — destination must be land ✓
- Leap **not** generated when Jump=0 ✓
- Leap **not** generated for diagonal direction — cardinals only (already guaranteed by `CARDINAL_DELTAS`) ✓
- Leap **not** generated when destination is occupied by an enemy (canStep filters) ✓
- Leap respects elevation-delta-≤-jump (e.g., jumping from elev 2 over water to elev 5 with Jump=2 is allowed; to elev 6 isn't) ✓
- Regression: existing land-only fixtures produce same reachable set (no spurious leaps) ✓

### Item 2 — Knockback-into-water verification (brief Item 16)

**Files**: new `src/engine/actions/session-32-integration.test.ts` (or append to existing knockback test surface).

Integration test: construct a fixture with a ridge tile at elev 7 and an adjacent shallow-water tile at elev 1. Unit on ridge takes knockback W; assert:
- `knockResult.finalPosition` is the shallow-water tile.
- `knockResult.dropDistance === 6`.
- `knockResult.fallingDamageAction` exists with `amount === 60` (10 × 6) and `system_damage` type.
- Through `commitAction` (use Water Mage's `maelstrom` or a synthetic ability with `damage.knockback` rider): the unit's `unit.position` updates to the water tile post-commit, and the falling-damage `system_damage` lands in the action log.

No substrate change expected — purely regression coverage.

### Item 3 — Pre-battle equipment auto-status as logged actions (brief Item 17)

**Files**: [src/engine/types/action.ts](src/engine/types/action.ts), [src/engine/actions/reducers.ts](src/engine/actions/reducers.ts), [src/engine/setup/create-initial-state.ts](src/engine/setup/create-initial-state.ts), [src/app/demo/orchestrator.ts](src/app/demo/orchestrator.ts).

**Step 3a — extend `SystemApplyStatusPayload`** (D2 resolution):
Add an optional `context` discriminator field:
```ts
export type SystemApplyStatusContext =
  | { readonly kind: 'reaction'; readonly abilityId: AbilityId; readonly attackerId: UnitId }
  | { readonly kind: 'pre_battle_equipment'; readonly itemId: ItemId };
```
Field is optional (backward compatible — existing emitters omit it). When `kind === 'pre_battle_equipment'`, the action-log formatter renders attribution like "Tintinibar grants Regen".

The status-instance `sourceKind: 'equipment'` + `sourceEquipmentId` are already in `ApplyStatusArgs` and flow through `applyStatus`. The new `context` field is purely action-envelope provenance.

**Step 3b — rework `applyEquipmentStatusGrants`**:
Replace the direct `applyStatus` call with a generator that returns a list of `ProposedAction` of type `system_apply_status`, each with:
- `targetId: unit.id`
- `statusTypeId: typeId`
- `sourceUnitId: null`
- `context: { kind: 'pre_battle_equipment', itemId: item.id }`

Generator signature: `enumerateEquipmentStatusGrants(state, catalog) → ReadonlyArray<ProposedAction>`. Pure function; `createInitialState` no longer calls `applyStatus` for these.

**Step 3c — `createInitialState` returns a raw state without grants applied.** The orchestrator pre-battle pass (Item 4) commits the grants as logged actions.

**Step 3d — `vitals` fill timing.** Currently `fillVitalsFromComputedMaxes` runs *after* `applyEquipmentStatusGrants` so equipment max-HP/MP contributions land before vitals fill. After the reroute, grants are applied by the orchestrator pre-battle pass — so vitals must either:
  - (i) fill after the orchestrator pre-battle pass completes, or
  - (ii) fill in `createInitialState` (no equipment statuses to compose against yet — but equipment's `modifyStatQuery` contributors for maxHp/maxMp don't depend on statuses; they read from item presence).

I'll verify (ii) holds via test: a unit with Wizard's Robe (+40 maxHp) gets vitals.hp = baseMaxHp + 40 at `createInitialState`, before any pre-battle action. The Robe's status grants (e.g., +MA contributor) don't affect maxHp directly; they affect damage calc.

**If (ii) holds, no orchestration ordering bug.** I'll add a regression test asserting the post-pre-battle-pass vitals equal the pre-31.5 end-state for Tintinibar/Sorcerer's Robe loadouts.

**Step 3e — reducer branch unchanged.** `reduceSystemApplyStatus` already handles the action; it'll see the `context` field through; we ignore it for state-transition purposes (it's display/log-side metadata). Action-log formatter consumes the context for attribution.

**Tests**:
- Pre-existing Tintinibar/Sorcerer's Robe loadouts produce identical end-state HP/MP/statuses post-orchestrator-pass vs. pre-31.5 direct-mutation behavior.
- Action log carries `system_apply_status` entries at sequence 0+ with `context.kind === 'pre_battle_equipment'`.
- Replay determinism: same `(masterSeed, BattleConfig, catalog)` produces same initial action log.

### Item 4 — Orchestrator pre-battle setup pass (brief decision 3)

**Files**: [src/app/demo/orchestrator.ts](src/app/demo/orchestrator.ts), `src/app/demo/orchestrator.test.ts`.

Add a private `preBattlePhase: 'pending' | 'complete'` flag, initialized to `'pending'`. `step()` checks this **before** the existing `turnState === null` scheduler-advance branch:

```ts
if (this.preBattlePhase === 'pending') {
  const queue = this.buildPreBattleActions();  // calls enumerateEquipmentStatusGrants + initialCT actions
  if (queue.length === 0) {
    this.preBattlePhase = 'complete';
    return this.step();  // tail-call to scheduler advance
  }
  const proposed = queue.shift();
  const result = commitAction(this.state, proposed, this.catalog);
  if (!result.ok) throw new Error(`pre-battle commit failed: ${result.reason}`);
  this.state = result.newState;
  if (queue.length === 0) this.preBattlePhase = 'complete';
  return { newState: this.state, committed: result.committed, done: false };
}
```

Pre-battle actions don't go through controllers — they're system-emitted at battle setup time. Failures throw (parallel to scheduler-emitted commits: a rejection here indicates a programmer error in pre-battle action emission, not a runtime refusal).

**Pre-battle action order** (deterministic):
1. `system_apply_status` actions (equipment grants), in iteration order of `state.units.values()` × `iterateEquippedItems(unit, catalog)` × `item.statusGrants`.
2. `system_set_ct` actions (Item 5), one per unit in `state.units.values()` order.

**Action envelope**: each pre-battle action gets `source: 'system'`, `sequenceNumber` starting from 0 (incremented per commit), `actorId: undefined`, `chainDepth: 0`, `isReaction: false`. The first scheduler-advanced `turn_start` lands at sequence ≥ N where N is the count of pre-battle actions.

**`OrchestratorStep` shape**: unchanged. Pre-battle steps return `committed: [action]` and `done: false` — the pump handles each like any other step.

**Tests**:
- Orchestrator's first N `step()` calls return pre-battle actions; first scheduler advance happens at step N+1.
- Action log contains pre-battle grants at sequence < first `turn_start`.
- Existing battle behavior unchanged downstream (turn 0 still fires the right unit; demo battle still launches).
- Empty equipment + no `initialCT` randomization → pre-battle phase completes in zero steps, tail-calls to scheduler advance.

### Item 5 — Initial CT randomization as `system_set_ct` action (D4)

**Files**: [src/engine/types/action.ts](src/engine/types/action.ts), [src/engine/actions/reducers.ts](src/engine/actions/reducers.ts), [src/engine/actions/validate.ts](src/engine/actions/validate.ts), [src/engine/setup/create-initial-state.ts](src/engine/setup/create-initial-state.ts), [src/app/demo/orchestrator.ts](src/app/demo/orchestrator.ts).

**New action type** `system_set_ct`:
```ts
export interface SystemSetCtPayload {
  readonly targetId: UnitId;
  readonly ct: number;       // absolute value; clamped to [0, TRIGGER_THRESHOLD - 1] by reducer
  readonly source: SystemSetCtSource;
}
export interface SystemSetCtOutcome {
  readonly kind: 'system_set_ct';
  readonly targetId: UnitId;
  readonly ct: number;       // post-clamp value actually applied
  readonly previousCt: number;
}
export type SystemSetCtSource = { readonly kind: 'initial_ct' };
```

Sub-discriminant `kind: 'initial_ct'` mirrors the `system_ct_push` source pattern; future variants can extend (e.g. a debug "reset CT" action).

**Reducer** `reduceSystemSetCt`: reads target, clamps the requested value to `[0, TRIGGER_THRESHOLD - 1]`, writes it onto `unit.ct`. Same shape as `reduceSystemCtPush` modulo absolute-vs-delta. No validation gate (system-only action — controller never proposes it).

**`createInitialState` change**: `placementToUnit` no longer computes `initialCT` via `resolveInitialCT`. Instead:
- If `placement.initialCT` is set, use it (placement-explicit value preserved). The pre-battle orchestrator phase will *not* emit a `system_set_ct` for this unit — explicit value is final.
- Otherwise, `ct = 0` at placement time. Orchestrator pre-battle phase emits one `system_set_ct` per such unit, computed by `resolveInitialCT(ruleset, placement-shaped-record, masterSeed)`.

To avoid a circular re-import of the resolver, I'll either:
- Export `resolveInitialCT` from `setup/create-initial-state.ts` and import in the orchestrator, or
- Move it to its own `setup/initial-ct.ts` and import from both.

Latter is cleaner; I'll go with that. (Existing test `src/engine/setup/initial-ct-variance.test.ts` will need its import updated, no logic change.)

**Determinism**: `resolveInitialCT` is already pure on `(masterSeed, placementId)`. The orchestrator caches the resolved value at battle setup so it doesn't re-roll per replay.

**Tests**:
- Pre-31.5 initial-CT distribution preserved for Training Field demo battle (same seed → same CT per unit).
- Action log shows `system_set_ct` for each non-explicit-CT unit before turn 0.
- Replay determinism: same `(masterSeed, BattleConfig)` produces same action log.
- Placement with explicit `initialCT` skips the orchestrator emission (CT preset; no log entry).

### Item 6 — `DEFAULT_TEST_DAMAGE_PIPELINE` structural equivalence

**Files**: `src/content/rulesets/default.test.ts` (or new `src/engine/catalog/test-fixtures.test.ts`).

Two assertions:
1. `Object.keys(DEFAULT_TEST_DAMAGE_PIPELINE).sort()` equals `Object.keys(DEFAULT_DAMAGE_PIPELINE).sort()` (same stage set).
2. For each stage, the handler ref arrays are identical (same order, same handlers).

**Fix the actual divergence first**: add `postFinalize: ['fire_on_final_damage']` to `DEFAULT_TEST_DAMAGE_PIPELINE`. Also add `postFinalize: []` to `EMPTY_DAMAGE_PIPELINE` so the type-system shape is satisfied uniformly.

(Check: does `DamageStage` enum include `postFinalize`? It must, since `DEFAULT_DAMAGE_PIPELINE` uses it. If `EMPTY_DAMAGE_PIPELINE` typechecks today without it, the `Record<DamageStage, ...>` is incomplete — TypeScript strict mode should be catching that. Will verify in implementation.)

### Item 7 — Cliff-edge overlay layer (D9/D10)

**Files**: new `src/renderer/cliff-edge-layer.ts`, [src/renderer/battle-renderer.ts](src/renderer/battle-renderer.ts), [src/renderer/constants.ts](src/renderer/constants.ts), new `src/renderer/cliff-edge-layer.test.ts`.

**`CliffEdgeLayer` class**:
- `container: Container` with label `'cliff-edges'`.
- `draw(map: BattleMap)`: clears and redraws. For each tile `t`:
  - For each cardinal neighbor `n` in `[N, S, E, W]`:
    - If `n` is in-bounds and `n.elevation < t.elevation`, draw a strip on `t`'s edge facing `n`.
    - Strip thickness (D6): `Δelev = t.elevation - n.elevation`; thickness = 1 (Δ=1), 2 (Δ ∈ 2-3), 3 (Δ ≥ 4).
    - Strip color (D8): darker shade of `TERRAIN_COLORS[t.terrain]`. Helper `darken(color: number, factor: number = 0.7): number` that multiplies each RGB channel.
    - Lighting: upper-left lit. Per the design call, this means N + W edges get a slightly lighter (highlight) treatment? Or just S + E edges are shadowed? Simpler: draw cliff strips on **all four** edges where the neighbor is lower, with consistent darkening. The "lit-from-upper-left" convention applies to *which* edges receive the heaviest shadow vs lightest — practically: S and E edges get full darken (0.65×), N and W edges get a lighter darken (0.85×) suggesting the cliff catches light. I'll prototype both and let plan-review pick.

**Wiring**:
- `BattleRenderer.constructor` instantiates `CliffEdgeLayer`, calls `cliffEdgeLayer.draw(map)` once at mount.
- Layer order: `tileLayer.container` → `cliffEdgeLayer.container` → `highlightLayer.container` → `unitLayer.container`.
- Constants in [renderer/constants.ts](src/renderer/constants.ts): `CLIFF_EDGE_THICKNESS_TIERS = [1, 2, 3]`, `CLIFF_EDGE_DARKEN_SHADOW = 0.65`, `CLIFF_EDGE_DARKEN_HIGHLIGHT = 0.85`.

**No state mutation, no engine dependency.** Cliff-edge layer reads `BattleMap` only — passes the engine-vs-renderer separation rule.

**Tests** (`cliff-edge-layer.test.ts`):
- Synthetic 3×3 fixture with elev grid `[2,2,2; 2,7,2; 2,2,2]`: center tile at elev 7, draws cliffs on all four edges with thickness per the categorical tier (Δ=5 → 3px).
- Δ=1 fixture: thickness 1.
- Δ=2 fixture: thickness 2.
- Δ=4 fixture: thickness 3.
- Edge case: tile at map edge (no out-of-bounds neighbor) — draws zero cliffs for that side.
- Color check: cliff strip color is `darken(TERRAIN_COLORS[tile.terrain], …)`.
- Regression: Training Field (uniform elev) renders zero cliff strips.

(Pixi rendering tests run via JSDOM headlessly — same pattern as existing renderer tests if they exist. Will verify the renderer's test infrastructure in implementation; if no Pixi-rendering tests exist, I'll write a thinner test that asserts the `Graphics` instructions produced rather than visual snapshot.)

---

## 4. Test strategy

- **New tests**: ~12-15 across `pathfinding.test.ts`, `session-32-integration.test.ts`, `orchestrator.test.ts`, `cliff-edge-layer.test.ts`, `default.test.ts` (or equivalent).
- **Modified tests**: `initial-ct-variance.test.ts` (import path if `resolveInitialCT` moves), `create-initial-state.test.ts` (vitals fill timing if it ends up after pre-battle pass), `orchestrator.test.ts` (pre-battle phase precedes scheduler advance).
- **Target count**: 859 → ~875 passing across ~73 files, 0 failing.

---

## 5. ADR plan

- **ADR-0071** — Pre-battle action-source pattern + orchestrator pre-battle phase. Documents the `SystemApplyStatusContext` extension, the `system_set_ct` action type, the orchestrator's pre-battle phase boundary, and the CLAUDE-rule-3 alignment.
- **ADR-0072** — Cliff-edge rendering convention. Documents the categorical thickness tiers, darken-from-tile-palette color derivation, layer ordering between tiles and units, and the upper-left lighting convention.

---

## 6. Order of work + checkpoint gates

1. **Item 6** — `postFinalize` fix + structural-equivalence test. Smallest; lands as a defensive starter. Gate: 859 + 1 tests passing.
2. **Item 1** — Jump-over-water pathfinding. Pure engine; no orchestrator dependency. Gate: pathfinding tests pass.
3. **Item 2** — Knockback-into-water integration test. No substrate change; verifies existing primitives. Gate: integration test passes.
4. **Items 3 + 5 + 4** — Pre-battle action types, `system_set_ct` action, orchestrator pre-battle phase. Land together: payload changes + reducer + setup + orchestrator are coupled. Gate: all existing tests still pass + new pre-battle pass tests pass.
5. **Item 7** — Cliff-edge overlay. Renderer-only; no engine coupling. Gate: cliff-edge unit tests pass + demo battle still launches cleanly with no visual artifacts on Training Field (uniform elevation = zero strips).
6. **Handoff + ADRs** — write both ADRs; update `docs/handoff.md`.

Between each step: run full test suite, confirm 0 failures, confirm demo battle launches in browser (visual check at minimum for step 5; for steps 1-4 a `npm test` pass is sufficient).

---

## 7. Open questions for plan review

- **Jump-over-water elevation tolerance** (Item 1, step 7): measure Δelev against source tile or intermediate tile? Source-to-dest matches "leap is an atomic move"; intermediate-to-dest would allow leaping up steeper from a lower intermediate. I'm going source-to-dest. Confirm or correct.
- **Vitals-fill timing** (Item 3, step 3d): assertion that equipment maxHp/maxMp contributors don't depend on statuses, so vitals fill stays in `createInitialState` before the pre-battle pass. Will verify by test; if a contributor *does* depend on a status, I'll surface and we re-route.
- **Cliff-edge lighting variants** (Item 7): full-darken-all-four vs N/W-lighter / S/E-darker. I'll prototype both visually and bring screenshots back. If you have a preference, say now.
- **Action-log formatter pass** (Items 3 + 5): the new `context` field and `system_set_ct` action type need formatter entries so the action log reads sensibly ("Tintinibar grants Regen" / "Blue Knight enters battle at CT 14"). I'll fold this in alongside Items 3 + 5 unless you'd rather defer the formatter polish to a later session.

---

## 8. Watch-fors deferred to handoff

- **Tidewalker terrain-family widening** (S33): with River Ridge introducing `water_deep` / `water_shallow`, Tidewalker's `'water'`-keyed lookup goes stale. Either widen Tidewalker to decrement both keys, or introduce a "terrain family" abstraction (`{water_deep, water_shallow} → 'water' family`) and key Tidewalker on the family. S33 audit.
- **Corner stack markers**: deferred per D7. S33 picks up alongside cliff edges in the same renderer layer or a sibling layer.
- **Status `customState` carry-through for equipment grants**: existing `applyStatus` passes `customState` from the apply args; the new pre-battle action path emits `system_apply_status` payloads that omit `customState` (same as the current behavior). If a future equipment item authors a status grant requiring `customState`, the pre-battle path needs to thread it through. No v1 case.

