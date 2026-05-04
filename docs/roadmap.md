# Roadmap

*Current as of 2026-05-03. This is an evolving plan. See git history for prior states.*

## How to read this

Each entry below is a session-sized scope of work. Sessions complete one entry at a time; each entry produces a working, tested, committed slice. Order reflects dependencies: each entry assumes the entries above it are in place.

This is *intended to evolve.* Sessions can:

- Mark items completed and add a one-line summary of what landed.
- Reorder remaining items if implementation reveals a different dependency order.
- Insert new items if a subsystem turns out to need a precursor.
- Drop items that turn out to be unnecessary, with a reason in the commit message.

Significant changes (reordering, dropping, inserting) should be obvious in the commit diff and explained in the commit message. The roadmap is reference, not contract — when it diverges from reality, fix the roadmap.

## Methodology

**Horizontal progression with MVP-first passes.** Each subsystem is built fully before the next starts (horizontal), but the first pass on a subsystem is an MVP — just enough to verify the mechanism works end-to-end with one or two concrete examples. Real breadth (a full status catalog, a full set of classes, a full ability list) comes in later content-expansion passes scheduled separately.

This means the roadmap below is the *mechanism* track. Content expansion is interleaved as separate passes once the relevant mechanisms exist.

**Engine-first.** The first playable battle is a milestone, not the goal of any single early session. Sessions 1–9 build the engine; sessions 10–13 build the rendering, UI, AI, and integration layers needed to drive it.

## Sessions

### 1. Core types + CT system ✅

*Completed 2026-05-03.* Branded IDs, spatial primitives, `Unit`, `ChargedAction`, `Action` skeleton, and `GameState` landed in `src/engine/types/`. CT system in `src/engine/ct/`: `computeSpeed` / `computeActionSpeed` (single floor at 0; hook chain pending session 3), `ticksUntilTrigger`, `nextEvent`, `projectUpcoming` with the actual-CT > Speed > stable-ID tiebreaker. Two ADRs: 0002 (accessor return-type pattern: throw on programmer error, `T | undefined` on meaningful absence) and 0003 (ChargedAction shape + the "assumed full Move + Act turn" projection-after-trigger constant pending session 6's Ruleset).

References: `docs/design/core-types.md`, `docs/design/ct-system.md`.

### 2. Catalog infrastructure + minimal type definitions ✅

*Completed 2026-05-03.* Generic `Registry<TId, TDef>` and a `Catalog` class with per-kind getters / `has*` / listing methods (`StatusEffectType`, `AbilityDefinition`, `ClassDefinition`, `ItemDefinition`) — minimal `{ id, name }` shapes that grow in their owning sessions. `createCatalog` validates duplicate-id at construction; `getX` throws `UnknownDefinitionError` on miss. One stub per kind in `src/content/{statuses,abilities,classes,items}/`, combined by `loadDefaultCatalog()`. ADR-0004 fixes the catalog-injection pattern (alongside `state`, never on `GameState`, never a singleton).

References: `docs/design/core-types.md` ("Catalogs vs. instances"), `docs/architecture/architecture-overview.md` ("What goes in `catalog/`").

### 3. Hook system + minimal status apply/remove ✅

*Completed 2026-05-03.* Hook system in `src/engine/status/`: typed `HookSignatures` map enumerating every design-doc hook, discriminated `StatusHookRegistration` per hook name, `statusHook(name, handler, priority?)` author helper, lazy `collectActiveHandlers` ordered by source tier (Equipment → Class → Passive → Statuses) and per-handler priority, runners for `modifyStatQuery` / `fireOnApply` / `fireOnRemove`. Status application pipeline: resistance (no-op until `Unit.resistances` lands) → all six stacking rules (REFRESH / REPLACE / REPLACE_IF_STRONGER / STACK_INDEPENDENT / STACK_ADDITIVE / REJECT, each with explicit lifecycle decisions) → instantiate → onApply. `removeStatus` symmetric. `computeSpeed(state, unitId, catalog)` now dispatches `modifyStatQuery`; `nextEvent` / `projectUpcoming` thread the catalog through. Haste content rewritten with the canonical `modifyStatQuery` handler — end-to-end demo: apply → Speed scales 1.5× → remove → Speed returns to base. ADR-0005 fixes the typing pattern.

References: `docs/design/status-effects.md`.

### 4. Map and movement ✅

*Completed 2026-05-03.* Spatial accessors (`tilesAt`, `tileAt`, `unitAt`) + `OutOfBoundsError` per ADR-0002. `MovementProfile` (with `SpecialMovementType` and a required `ClassMovementBaseline` on `ClassDefinition`); `computeMovementProfile` reads the class baseline and threads `moveRange` / `jump` through `modifyStatQuery` per ADR-0006. Dijkstra `getLegalMoves` over 4-cardinal-across-all-layers adjacency, honoring `canEnter` / `terrainCosts` / `jump` / unit occupancy. Range geometry (`horizontalDistance`, `verticalDistance`, `inRange` with min/max). Bresenham-based `hasLineOfSight` over the (x, y) line with elevation interpolation; strict-inequality "doesn't block on grazing." `arcTargetable` checks source/target are uncovered. AoE shapes (single, diamond, square, cross, custom) + `aoeFootprint` honoring vertical tolerance and the multi-layer-affected default. Special movement (fly/teleport/phase) data shape in place; pathfinding throws `SpecialMovementNotImplementedError` until a session-5 consumer needs it. Knight stub gains its movement baseline (`moveRange 3, jump 2, canEnter ground`). `Unit` gains a minimal `classState: { currentClass }` shim that session 6 expands. ADR-0006 captures the composition rule.

References: `docs/design/map-and-battlefield.md`.

### 5. Ability slots ✅

*Completed 2026-05-03.* Bucket-and-cost system in `engine/abilities/`: five v1 buckets (First/Second Action active; Reaction/Support/Movement passive) with baseline capacities (1/1/3/3/3) in `constants.ts`. `Loadout` on `Unit` (active buckets → CommandSetId; passive buckets → AbilityId list). `getCost` (class `freeAbilities` zeroes); `getCapacity` (baseline). `validateLoadout` enumerates structured violations; `equipPassive` / `unequipPassive` / `setActiveBucket` return `{ ok; state | validation }` (per ADR-0007). New catalog kind `CommandSetDefinition`; `AbilityDefinition` discriminated by `kind: 'active' | 'passive'`; `ClassDefinition` gains `firstActionCommandSet` and `freeAbilities`. Hook system refactored: source-agnostic core (`HookSignatures`, collector, chain runners) moved to `engine/hooks/`; `CollectedHandler` is now ctx-erased so runners dispatch uniformly across source kinds. Passive hook surface (`PassiveHookRegistration`, `passiveHook`) parallels the status one; new chain hooks `modifyCanEnter` / `modifyTerrainCosts` / `modifySpecialMovement` for movement-profile structural modifiers. Pathfinding's Fly branch (drops jump check); Teleport / Phase still throw. Content: `attack` ability + `battle_skill` command set + Knight extensions; passives `move_plus_1` (modifyStatQuery moveRange+1), `float` (modifyCanEnter +water), `fly` (modifySpecialMovement = 'fly'). End-to-end tests light up the full registration → collection → runner → consumer pipeline. ADR-0007 captures the validation surface.

References: `docs/design/ability-slots.md`.

### 6. Ruleset + BattleConfig + initial state construction ✅

*Completed 2026-05-03.* `RulesetDefinition` (in `engine/types/ruleset.ts`) bundles every parameterizable engine value as data: CT costs, speed bounds, default TurnBudget, range defaults, pathfinding defaults, behavior toggles (friendly fire, friendly pass-through, units-block-LoS), chain termination caps, hook ordering tiers, damage pipeline stage refs (empty arrays for v1; session 8 fills), initial-CT formula (one `'fixed'` variant), and bucket capacities. `BattleConfig` carries battleId, rulesetId, map (inline for v1; catalog-references when map content lands), teams, unit placements (with optional per-placement initialCT override), victory conditions, and masterSeed. `createInitialState(battleConfig, catalog) → GameState` validates the config (duplicate ids, undeclared teams, unknown classes, invalid loadouts via the canonical `validateLoadout`) and returns the immutable starting state. Ruleset added as a catalog kind (`getRuleset` / `hasRuleset` / `rulesets`). `BASELINE_BUCKET_CAPACITIES` moved to `ruleset.bucketCapacities`; `ASSUMED_TURN_CT_COST` to `ruleset.ctCosts.moveAndAct`; `SPEED_FLOOR` to `ruleset.speedBounds.floor`. `friendlyPassThrough` plumbed through `canStep`: allies are routable past but not settle-able on; enemies always block. Source-tier ordering moved from a private collector map to `ruleset.hookOrdering.sourceTiers` (read per `collectActiveHandlers` call); `HookSourceTier` and `DEFAULT_HOOK_SOURCE_TIER_ORDER` relocated to `engine/types/` so the ruleset can name them without a layering violation. Default ruleset shipped at `src/content/rulesets/default.ts`. ADR-0008 captures the decisions.

References: `docs/architecture/architecture-overview.md` ("Rulesets and content"), ADR-0008.

### 7. Action types and reducer ✅

*Completed 2026-05-03.* `Action` is a discriminated union over per-kind payload + outcome shapes (Move, UseAbility, Wait, SetFacing, plus system actions turn_start, turn_end, status_tick, charged_action_resolve). `ProposedAction` is the controller-facing shape (no envelope); the engine fills in seq, seed, timestamp, and chain bookkeeping at commit time via `deriveActionSeed(masterSeed, sequenceNumber)`. `validateAction(state, action, catalog) → ValidationResult` is pure and exposed separately so UI can preview legality. Per-kind reducers (`engine/actions/reducers.ts`) are individually testable; `reduce.ts` holds the dispatcher. `TurnState` is now a real shape (`CurrentTurn | null`) carrying the active unit's TurnBudget, consumption counters, and per-reactor reaction tally. `commitAction` is the lifecycle wrapper: validate → fire `onActionAttempted` (block/replace short-circuit) → seed + envelope → reduce → append to log → process generated actions FIFO, with reaction caps and chain-depth caps from the ruleset. UseAbility ships the instant + non-damage status-application path; chargeTicks > 0 throws until session 8's first content consumer. AbilityDefinition gained `targeting`, `chargeTicks`, `mpCost`, `effects` (statusEffects + damage placeholder). First Action class-pinning lives in `validateLoadout` (single rule covers `equipPassive`, `setActiveBucket`, and `createInitialState`). `onActionAttempted` and `onActionTargeted` hook signatures refined from `unknown` to typed `ProposedAction`/`ActionAttemptResult` shapes; runners ship for both. ADR-0009 captures the decisions.

References: `docs/design/action-resolution.md`, ADR-0009.

### 8. Damage pipeline ✅

*Completed 2026-05-03.* `DamageContext` lives in `engine/types/` (alongside the existing types tier so `HookSignatures.onDamageDealt` / `onDamageReceived` can name it without a layering violation). `engine/damage/` ships the seven-stage orchestrator (`runDamagePipeline`), the default handler registry (`physical_pa_wp`, `healing_base`, `fire_on_damage_dealt`, `fire_on_damage_received`, `variance_roll`, `clamp_min_max`, `finalize`), and the per-stage handler implementations. v1 covers physical + healing only — magical, elemental, evasion, environmental, holy/dark amplifications are content-expansion-pass adds that grow the handler list without touching the orchestrator. `BaseStats` gained `pa` / `ma` / `maxHpBase`; `StatName` gained `'pa'` / `'ma'` / `'maxHp'`. `DamageSpec` gained `power` and an optional `variance` band. `reduceUseAbility` runs the pipeline before status application, applies finalDamage to vitals (floor 0; ceil at maxHp for healing), and fires `onActionTargeted` post-application with enriched `damageDealt` + `damageTags` args. Reactions ride a new optional `generatedReactions` field on `ReduceResult`; `commitAction` enqueues them with `isReaction: true` and the per-unit-per-turn cap applies. Counter passive content lights up the chain end-to-end (physical hit → counter-attack → reaction-cap-respected on follow-ups). `validateAction` accepts an `isReaction` opt; reaction-validated UseAbility skips active-turn / actsAvailable checks but still runs structural / range / MP checks. Default ruleset's `damagePipeline.stages.*` filled with the v1 ref list. ADR-0010 captures the decisions.

References: `docs/design/action-resolution.md` ("Damage pipeline"), ADR-0010.

### 9. Turn flow ✅

*Completed 2026-05-03.* Battle-outcome evaluation lives in `engine/turn/evaluate-battle-outcome.ts`; `reduceTurnEnd` calls it and emits a `battle_end` system action when a victory condition fires. `BattleOutcome` concretized (was a placeholder); the Decided shape lives on `state.outcome`, with `undefined` meaning ongoing. New `battle_end` action type + `reduceBattleEnd` set the outcome and clear residual turn state. `commitAction` gained a `battle_decided` failure stage and silently drains the chain past battle-end. `victoryConditions` are copied from `BattleConfig` to `GameState` at `createInitialState` so the reducer reads them directly.

Turn-skip is a new `queryTurnSkipped` hook fired at turn_start. Returns `{ reason }` to skip or `null` to proceed; the runner short-circuits on the first non-null. Stop status content demonstrates: Stopped unit's `reduceTurnStart` sets `outcome.skipped: true`, zeroes the budget, and emits a `turn_end` as a generated action. No `status_tick` fan-out on skipped turns. `engine/turn/scheduler.ts` ships `advanceToNextEvent(state, catalog)` — the orchestrator-facing CT advancement that returns the next system action (`turn_start` or `charged_action_resolve`) with state.tick + unit ct mutated to the trigger boundary. KO'd units filter out of the snapshot.

Reaction fizzle: `commitAction` silently drops a reaction whose validation fails mid-chain (the design's "Counter target moves out of range" pattern), keeping the throw path for genuine programmer errors (chain-depth-cap, non-reaction generated actions). Initial-CT `speed_with_variance` variant added: `clamp(spd × speedFactor, 0, 99) + variance(seed, unitId) × variancePct% × threshold`. Stable per-(seed, unitId) for replay.

ADR-0011 captures the decisions.

References: `docs/design/turn-structure.md`, ADR-0011.

### 10. Renderer skeleton ✅

*Completed 2026-05-03.* PixiJS-based renderer in `src/renderer/`: `BattleRenderer` owns a layered stage (world container with camera-driven translation; tile + unit sublayers). `TileLayer` draws one flat-color square per tile per terrain type with a subtle outline grid. `UnitSprite` renders team-colored circles with facing tick, HP bar (low-HP recolor), KO grayscale, and active-unit ring. `Animator` consumes committed `Action`s one at a time — `move` interpolates linearly along `outcome.pathTaken`, `use_ability` flashes the target and applies the HP delta, `turn_start`/`turn_end` toggle the active highlight, `battle_end` holds for a beat. Camera lerps toward the active unit each frame; recenters between turns.

Demo orchestration in `src/app/demo/`: `DemoOrchestrator` drives the `advanceToNextEvent` → `commitAction` loop, dispatching to a per-team `Controller`. `greedyMeleeController` is a placeholder dumb controller (closest-enemy, attack-if-in-range, otherwise step-toward) that drives both teams in the demo until session 11/12 land real input/AI. Demo battle (`src/content/battles/demo.ts`) is two Knights on a 6×6 ground map with symmetric `defeat_all` victory conditions.

App glue in `src/app/BattleView.tsx`: mounts a Pixi `Application`, builds the renderer + orchestrator, and pumps `orchestrator.step()` whenever the renderer's animator reports idle. React StrictMode-safe (cleanup destroys the Pixi app + canvas; `disposed` flag short-circuits late init). Win banner overlay renders when `state.outcome` lands.

Carried fix from session 9: `projectUpcoming` now filters KO'd units, aligning with the scheduler. Regression test added.

References: `docs/architecture/architecture-overview.md` ("Renderer").

### 11. UI skeleton ✅

*Completed 2026-05-03.* React HUD in `src/ui/`: `BattleHud` composes `CurrentUnitPanel` (HP / MP / Speed / status strip), `ActionMenu` (Move / Attack / Wait + Cancel during sub-modes, gated on budget + isOurTurn + waiting), and `TurnQueuePanel` (top 5 from `projectUpcoming` with team-colored dots). The `useBattleUi` hook runs the input state machine (idle → picking-move → picking-attack), pre-computes legal move destinations and attack targets, paints renderer highlights via a new `BattleRenderer.setHighlights(positions, kind)` API, and dispatches tile-click events from the renderer's stage.

UI controller in `src/app/controllers/ui-controller.ts`: a single-slot adapter from imperative React calls (`submit` / `endTurn` / `cancel`) to the orchestrator's `Controller` interface. Returns `'pending'` while empty so the orchestrator commits nothing and re-asks each pump tick. Throws on double-submit (programmer-error guard).

Orchestrator's `Controller` interface refactored from `ProposedAction | null` to a discriminated `ControllerDecision = commit | end-turn | pending`. Greedy controller updated to return `{ kind: 'end-turn' }` explicitly; orchestrator switches on `decision.kind`. ADR-0012 captures the decisions.

Renderer gained a `HighlightLayer` between tiles and units (translucent fills, blue/red/gold for move/attack/aoe), and a `setOnTileClick(handler)` API that hit-tests stage `pointertap` events against the world transform and resolves to (Position, Unit | null). `BattleView` now syncs `latestState` and `waiting` into React state from inside the pump and wires `team_a` to the UiController; `team_b` stays on the greedy controller until session 12 lands the AI.

References: ADR-0012, `src/ui/`, `src/app/controllers/`.

### 12. AI ✅

*Completed 2026-05-03.* Pure decision function `decideBasicAi(state, catalog) → BasicAiDecision` in `src/ai/basic.ts` — engine-only dependency tier per the architecture overview. Heuristic upgrades the placeholder greedy controller along two axes: target selection prefers the lowest-HP enemy (lex-id tiebreak) over the closest, and move selection scores every legal destination by "what's the lowest-HP enemy I'd threaten from here" instead of stepping naively toward the closest enemy. Falls back to "minimize distance to lowest-HP enemy globally" when no destination puts anyone in attack range. Offensive ability enumeration walks the loadout's command sets and filters to single_unit damage abilities (excludes healing); the `attack` ability is the only v1 consumer.

Adapter `createBasicAiController()` in `src/app/controllers/ai-controller.ts` wraps the pure decision function in the orchestrator's `Controller` interface — mirrors `ui-controller.ts`'s shape so both decision sources plug into the same orchestrator wiring. BattleView's `team_b` now uses the basic AI; the greedy placeholder remains in `src/app/demo/` as the integration-test baseline.

Coverage: 11 unit tests for `decideBasicAi` (target selection, ability enumeration, move scoring, budget gating, determinism); 3 integration tests in `src/app/controllers/ai-controller.integration.test.ts` that pit greedy vs basic AI in the demo battle across 5 seeds × both team assignments — assert termination, no-strict-regression-vs-greedy, and per-(seed, assignment) determinism. Visual end-to-end verified in the browser preview: AI moves into melee range and attacks, repeatedly.

References: `src/ai/`, `src/app/controllers/ai-controller.ts`.

### 13. First playable end-to-end battle ✅

*Completed 2026-05-03.* Demo battle expanded from symmetric 1v1 to 2v2: each side has two Knights with Battle Skill on First Action, **White Magic (Cure) on Second Action**, **Counter** in the Reaction bucket, and Move +1 in Movement. A new `white_magic` command set (currently containing just Cure) lives in `src/content/command-sets/`. Knights start at 60 HP / 10 MP — enough for two Cures with slack.

UI: ActionMenu gained a `Cure` button (gated on `hasCure`, which checks whether Cure is in any of the active unit's equipped command sets); `useBattleUi` gained a `picking-cure` mode that paints green ('heal') highlights on legal ally targets and routes clicks to a `use_ability` submission with `cure`. Renderer's `HighlightLayer` got a `'heal'` highlight kind (green, matches the HP bar). The Attack and Cure paths each remain hardcoded against their ability id; the FFT-style ability-picker (read each equipped command set, render one button per active member) is deferred to a later session as its own scoped concern.

AI: `decideBasicAi` gained a heal phase that runs before the existing attack/move phases. When any living ally (including the actor) is at or below `HEAL_THRESHOLD = 0.5` of `maxHpBase` and is in cure range from the actor's current position, the AI casts the highest-power healing ability on the most-wounded ally (lex-id tiebreak). Move-to-heal (closing distance to a wounded ally out of range) is deferred. Eight new unit tests in `src/ai/basic.test.ts` cover the heal/attack precedence, target selection, threshold, MP gating, enemy-unit filtering, and the no-move-to-heal property.

Bug surfaced and fixed: Counter creates mid-turn KOs of the active unit (turn-holder gets countered, dies, `turnState` still points at them, controller proposes an action for the corpse, `validateAction` rejects). Fixed in the demo orchestrator with a defensive guard: KO'd active unit → force `turn_end` before consulting the controller. The engine-side auto-emit (parallel to Stop's skipped-turn pattern) is the architecturally cleaner long-term fix and is deferred. **ADR-0013** captures the orchestrator-vs-engine choice and the deferred engine work.

Dev-only browser preview hook: `import.meta.env.DEV`-gated `window.__taciturnDebug` with `tick(ms?)`, `pump(n, msPerTick?)`, `getState()`, `isIdle()`, `uiEndTurn()`, `uiSubmit(action)`. Replaces the temporary debug hook session 12 used and the manual add/remove cycle. Synthetic clock since wall-clock time barely advances in a tight JS loop.

345 tests pass (was 337; added 8 AI healing tests). End-to-end browser verified: 2v2 demo loads, Cure button appears in HUD on player's turn, AI casts Cure mid-battle (red_knight_n's MP went 10 → 6), Counter chains fire visibly through the damage-and-reaction pipeline, battle decides cleanly with the win banner.

References: `src/content/command-sets/white-magic.ts`, `src/content/battles/demo.ts`, `src/ui/`, `src/ai/basic.ts`, `src/app/demo/orchestrator.ts`, ADR-0013.

## Content-expansion passes (interleaved)

These are not numbered in the main sequence because their timing depends on what mechanisms exist. The general pattern: once a mechanism's MVP is in place, an expansion pass adds the breadth of content that uses it.

- **Status catalog expansion** — after session 3 (hook system + minimal status). Adds the breadth of v1 statuses defined in `docs/design/status-effects.md`.
- **Class/ability/equipment catalog expansion** — after session 5 (ability slots) and partly after session 8 (damage pipeline). Adds enough classes and abilities to populate session 13's first playable battle.
- **Map content expansion** — after session 4 (map and movement). Adds maps beyond the test fixtures.
- **Ruleset variants** — after session 6, only if needed; the default ruleset suffices for most early work.

## Out of scope for v1

These are noted to make their absence intentional rather than accidental:

- Online play (the action-log model supports it; no implementation in v1).
- Isometric rendering (orthographic top-down for v1).
- Campaign / between-battle progression (single battles only in v1).
- Save/load (single-session play only).

The architecture has been built to allow these later without rework.
