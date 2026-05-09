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

### 13.7. Reconciliation resolution ✅

*Completed 2026-05-06.* Infrastructure-and-documentation session that processed the reconciliation report and aligned the new reference docs (Battle Mechanics Guide, Ability Format Spec, sessions 14–20 roadmap) with the engine code. Six new ADRs (0014–0019) record the architectural decisions: equipment integration deferred to session 17 (0014), multi-tag damage composition uses signed maximum (0015), healing opts out of resistance modulation (0016), system actions for status side effects (0017, infrastructure lands session 16), STACK_COUNT_ADDITIVE stacking rule (0018, implementation lands session 19), physical hit roll fires at the target stage (0019, lands session 14).

Code refactors land additive shape changes for the upcoming sessions: `chargeTicks` → `actionSpeed` rename (CT-accumulation-rate, not initial CT charge time); `brave`/`faith` added to `BaseStats` and `StatName` (defaults brave 100, faith 70); `'earth'` added to `DamageTag` ahead of Earth Mage; `resistances: ReadonlyMap<DamageTag, number>` added to `Unit` and `UnitPlacement`; `evasion: { front, side, back }` added to `ClassDefinition` (Knight defaults to 0/0/0); `TargetingSpec` extended with `'tile'` kind (validateAction throws "not yet implemented" until consumers ship); `STACK_COUNT_ADDITIVE` added to `StackingRule` (apply throws on the branch); optional `tags?: ReadonlyArray<string>` added to `AbilityDefinition`. Behavior-changing infrastructure (system actions for status side effects, reaction compiler, Counter refactor) defers to session 16 per ADR-0017 timing.

Battle Mechanics Guide, Ability Format Spec, and sessions 14–20 roadmap all updated to reflect the ADR resolutions and the renames. 345 tests pass throughout. References: ADRs 0014–0019, `docs/session-13-7-plan.md`, `docs/reconciliation.md`.

### 14. Magical damage foundation ✅

*Completed 2026-05-06.* Engine-only session — magical damage handler, Faith pipeline, resistance system wiring, evasion check landed, Brave-gated reaction triggers, MP cost timing confirmed.

`magical_ma_power` ships in `src/engine/damage/handlers.ts` as the third base-stage handler alongside `physical_pa_wp` and `healing_base`; gates on the `'magical'` tag and computes `MA × power × Faith_factor`. `computeFaithFactor(state, catalog, attacker, target)` is the shared helper — symmetric `(Faith_user/100) × (Faith_target/100)`, faith reads through `modifyStatQuery` so future faith-modifying buffs compose. Healing now Faith-factors too (BMG-faithful: high-Faith targets receive more healing). v1 default Faith bumped 70 → 80 in `engine/types/stats.ts`, demo battle, and test fixtures (Faith_factor 0.64 for symmetric demo casts; placeholder discipline noted with realistic spreads landing in tuning passes).

`evasion_check` lands at the target stage per ADR-0019 — auto-hit short-circuit when the ability omits `hitRoll`; magical-only damage (no `'physical'` tag) skips the roll; otherwise computes `hit_chance = weapon_accuracy × (1 − target_evasion[facing] / 100) × elevation_modifier`, clamped to `[0.05, 1.0]`. Facing classification uses cardinal-direction dot product (front/side/back per BMG ±45°/45-135°/135-180°). Elevation modifier reads source/target tile elevation. `finalize` updated to zero `finalDamage` when `ctx.hit === false`. `HitRollSpec` shape lives on `ActiveAbilityDefinition`; v1 placeholder `accuracy` defaults to 100 (unarmed, per BMG); equipment-sourced accuracy lands in session 17 per ADR-0014. Knight `attack` declares `hitRoll: {}` (rolls happen; against today's zero-evasion classes the [0.05, 1.0] clamp lands at 1.0 — every attack hits).

`resistance_check` lands at the target stage between `evasion_check` and `fire_on_damage_received` — composes per-tag resistances via `signedMax` (per ADR-0015), short-circuits on the `'healing'` tag (per ADR-0016), and caps the effective resistance at 100 (per ADR-0022 — absorption deferred until first consumer; values > 100 read as immune, not as healing).

`runOnActionTargeted` gained Brave-gated reaction triggering (ADR-0021): Brave 100 → deterministic; lower Brave → probabilistic per-reaction roll using a sub-stream of the action seed (sub-stream constant 2; variance is 0, evasion is 1). Counter's `damageDealt > 0` gate removed — fires on physical UseAbility attempts, FFT-canonical. Healing-tagged effects skip Counter; reactor doesn't counter their own attack. ADR-0019's "reactions trigger on hit only" consequence superseded by ADR-0021.

MP cost timing confirmed: `reduceUseAbility` deducts on commit (no path refunds today). `validateAction` rejects insufficient-MP UseAbility before reduce runs.

ADRs: 0020 (magical damage formula + Faith pipeline), 0021 (Brave-gated reaction trigger; Counter flip; supersedes part of ADR-0019), 0022 (resistance absorption deferred). Battle Mechanics Guide updated with absorption note and ADR-0021 reference. Test count: 345 → 369 (24 new — 15 in pipeline.test.ts for magical/evasion/resistance, 4 in runners.test.ts for Brave roll, 5 in damage-integration.test.ts for Counter-on-miss / magical end-to-end / MP timing).

References: ADRs 0019–0022, `src/engine/damage/handlers.ts`, `src/engine/hooks/runners.ts`, `src/content/abilities/counter.ts`, `src/content/abilities/attack.ts`, `docs/battle-mechanics-guide.md`.

### 15. Charged action lifecycle ✅

*Completed 2026-05-06.* Engine session — ChargedAction lifecycle, Charging status, the `actionSpeed > 0` UseAbility path, full interruption matrix, engine-side `turn_end` on active-unit KO, `'tile'` TargetingSpec validation, and a throwaway tile-anchored charged spell to drive end-to-end coverage. ADR-0023 captures the decisions and supersedes ADR-0013.

`reduceUseAbility` factored into a shared `resolveAbilityEffect` helper (instant path's per-target body) plus `commitCharged` (the actionSpeed > 0 path: deduct MP, decrement actsAvailable, push ChargedAction, apply Charging via `ruleset.chargedActions.chargingStatusTypeId`). Charging carries `customState: { chargedActionId }` for future hook coupling and registers `queryTurnSkipped` so the caster sits idle while the spell is in flight.

`reduceChargedActionResolve` ships the full lifecycle: caster-KO short-circuits to fizzle; otherwise the caster's `onActionAttempted` chain fires (Silence / Don't Act will register here when those statuses ship in session 16). Per-target resolution: unit-target uses FFT pinning (canonical id, even if displaced); tile-target uses `unitAt` lookup at the position. KO'd unit-target → that target fizzles silently. Empty tile → resolution lands but applies no per-target effects. The reducer then removes the ChargedAction and the Charging status from the caster.

`computeActionSpeed` reads caster status to derive the pause: when the caster has any status listed in `RulesetChargedActions.pausingStatusTypeIds` (v1: Stop), effective speed is 0. The projection / scheduler treat speed=0 entities as non-advanceable, so paused charges sit at their current CT until the pause clears. Edge case (Quick-style CT push past 100 while paused) is documented as out-of-v1-scope — no v1 ability targets ChargedActions for CT push.

`commitAction` gained a post-chain checkpoint: when the chain drains and `state.turnState !== null && state.outcome === undefined && active unit hp <= 0`, the engine appends a `turn_end` and re-enters the loop. Supersedes ADR-0013's orchestrator-level guard, which was removed from `DemoOrchestrator.step`. Any caller of `commitAction` (replay, networked, headless) inherits the behavior.

`'tile'` TargetingSpec validation: tile exists, in range, rangeMode-specific (LoS / arc / melee). The `AbilityTarget` union grew a `'tile'` variant so payloads can carry `{ kind: 'tile', position }`.

Content: `bolt` ability (tile-anchored magical damage, power 5, mpCost 8, actionSpeed 25) lives in `src/content/abilities/bolt.ts`; `arcane_skill` placeholder command set lives in `src/content/command-sets/arcane-skill.ts`. The throwaway exists to exercise the engine — real Mage class content lands in 16+.

ADRs: 0023 (charged-action lifecycle, Charging, Stop-pause derivation, engine-side turn_end on KO; supersedes 0013). Test count: 369 → 381 (12 new — 11 lifecycle/interruption/tile-validation/KO-auto-end integration tests, 1 replaced commit-charged unit test).

References: ADR-0023, `src/engine/actions/reducers.ts`, `src/engine/actions/commit.ts`, `src/engine/actions/validate.ts`, `src/engine/ct/speed.ts`, `src/engine/types/ruleset.ts`, `src/content/statuses/charging.ts`, `src/content/abilities/bolt.ts`.

### 16. Earth Mage (part 1) ✅

*Completed 2026-05-06.* Engine + content session — status application formula wired into `resolveAbilityEffect`, two new modify hooks (`modifyHitChance`, `modifyStatusApplicationChance`), the `queryTurnSkipped` extension for `suppressStatusTicks`, the ADR-0017 emission infrastructure (four new system actions: `system_heal`, `system_apply_status`, `status_remove`, `status_decrement_stack`), the spec-driven reaction compiler with Counter as the worked example, and Earth Mage's first 5 abilities + 5 statuses + class + command set.

`onTick` runner ships with emission support; `reduceStatusTick` fires onTick handlers, queuing emitted actions onto the chain. Stop suppresses per-unit-CT status ticks (`suppressStatusTicks: true`); Charging does not (`false`) — DoTs/HoTs progress on a Charging caster's skipped turn. Per-effect seed branching in `rollStatusChance` makes Earth Curse's Blind + Silence rolls independent.

Reaction compiler (`compileReaction`) takes `ReactionAbilityFields` → `PassiveHookRegistration[]`. Two effect kinds (`use_ability`, `apply_status`) and two trigger conditions (`damage_received`, `always`). Counter refactored to use it; Earth Resilience flows through it with `apply_status` emitting `system_apply_status` (bypassing the BMG formula because the Brave gate already ran).

Earth Mage class: moveRange 3, jump 3, evasion 8/5/0, default First Action `earth_spells`. Five abilities ship: **earth_strike** (charged magical damage + Move/Jump debuff rider, 60% baseChance), **earth_blessing** (charged Regen on ally, 100% baseChance), **earth_curse** (charged Blind + Silence, 50%/50% independent rolls), **earth_resilience** (passive reaction, STACK_INDEPENDENT +1/+1 Move/Jump self-buff on damage), **earth_communion** (universal × 1.25 status application chance, baseCost 1). Five statuses ship: **regen** (Faith × MaxHP × 0.10 per tick on recipient's CT), **movement_debuff** (Move/Jump -1, REFRESH, earth-resistance-tagged), **movement_self_buff / Earthen Resolve** (Move/Jump +1, STACK_INDEPENDENT), **blind** (× 0.5 hit chance via modifyHitChance, REFRESH), **silence** (blocks magical/voice via onActionAttempted, REFRESH).

ADR-0024 captures the decisions. Test count: 381 → 395 (14 new in `session-16-integration.test.ts`). New documentation: `docs/content-id-registry.md` (name → id lookup table for ongoing creative passes). Loader test updated for the expanded baseline (8 statuses, 12 abilities, 4 command sets, 2 classes).

References: ADR-0024, `src/engine/hooks/hooks.ts`, `src/engine/hooks/runners.ts`, `src/engine/status/chance.ts`, `src/engine/abilities/reaction-compiler.ts`, `src/engine/actions/reducers.ts`, `src/content/classes/earth-mage.ts`, `src/content/abilities/earth-*.ts`, `src/content/statuses/{regen,movement-debuff,movement-self-buff,blind,silence}.ts`, `docs/content-id-registry.md`.

### 17a. AoE substrate ✅

*Completed 2026-05-06.* Engine-only sub-session — the AoE per-target dispatch substrate ahead of the Earth/Knight content sessions. Per the user's mid-session call, session 17 is split into 17a (engine substrate, this entry), 17b (Earth Mage AoE/Ultimate + new statuses), 17c (Knight expansion + equipment integration).

`AoeSpec` lands on `AbilityEffects`: `{ shape: AoeShape; verticalTolerance?: number; excludeCaster?: boolean }`. Targeting (`self` / `unit` / `tile`) and AoE expansion are orthogonal; abilities can pair any targeting kind with any shape. `AoeShape` / `AoeOffset` / `AoeAnchor` types relocated from `engine/map/aoe.ts` to `engine/types/aoe-shape.ts` so the catalog tier can name them without crossing layers. `engine/map/aoe.ts` re-exports for backward compatibility.

`perTargetSeed(actionSeed, targetIndex)` ships in `engine/actions/seed.ts`. Identity at index 0 (single-target callers see no RNG drift; pre-session-17 replays unchanged); splitmix32 mixer at index >= 1 (independent per-target streams across all sub-streams: variance 0, evasion 1, brave 2, status chance 3).

`resolveAbilityTargets` in `engine/actions/reducers.ts` is the new dispatcher — bridges `AbilityTarget` to the per-target `resolveAbilityEffect` body. Single-target mode: identity; AoE mode: anchor → `runModifyAoeShape` → `aoeFootprint` → caster + friendly-fire filter → stable lex-id ordering → per-target dispatch with branched seeds. `reduceUseAbility` and `reduceChargedActionResolve` both route through it. Caster excluded by default (`excludeCaster: true`), friendly fire from `ruleset.behaviors.friendlyFire` (v1: true).

`modifyAoeShape` joins the closed hook surface (now 11 hooks). Pure-compute, no emission slot. Fires against the caster's hooks; sequential chain (last handler wins ties). v1 chain is identity; Fire's "larger AoE" rider in session 19 is the planned consumer.

ADR-0024's noted reaction-cap accounting limitation is fixed: `GeneratedReaction { action, reactorId }` is the chain-control shape for emitted reactions. `runOnActionTargeted` stamps `reactorId: args.unit.id` on each emission; `commitAction`'s cap accounting reads `entry.reactorId` from the QueueEntry instead of the emitted action's `actorId`. `system_apply_status` reactions (Earth Resilience self-buff) account correctly without carrying actorId on the action.

Caster-target status effects in AoE throw at the dispatcher — v1 has no consumer; the constraint surfaces explicitly when a future ability needs the combination.

ADR-0025 captures the decisions. Test count: 395 → 407 (12 new — 4 in `seed.test.ts` for `perTargetSeed` properties, 8 in `aoe-substrate.test.ts` for per-target dispatch / seed branching / vertical tolerance / caster exclusion / friendly fire / `modifyAoeShape` / reaction-cap fix). All existing tests pass unchanged.

References: ADR-0025, `src/engine/actions/seed.ts`, `src/engine/actions/reducers.ts`, `src/engine/hooks/hooks.ts`, `src/engine/hooks/runners.ts`, `src/engine/actions/commit.ts`, `src/engine/types/aoe-shape.ts`, `src/engine/types/action.ts`, `src/engine/actions/aoe-substrate.test.ts`.

### 17c. Knight expansion + equipment integration ✅

*Completed 2026-05-08.* Engine + content session — equipment integration foundation, customizable status application formula, Brave_factor, applyAlways, modifyEvasion hook, source-KO status sweep, plus Knight Battle Skill expansion + R/S/M passives.

Engine: `EquipmentDefinition` lands as a discriminated union over slot kinds (weapon / armor / headgear / accessory) replacing the v1 `ItemDefinition` stub; `Unit.equipment` and `UnitPlacement.equipment` carry a five-slot map (left/right hand, headgear, armor, accessory). Equipment registers `modifyStatQuery` handlers from the equipment hook source tier (already first in `DEFAULT_HOOK_SOURCE_TIER_ORDER`); `statusGrants` apply at battle start with `StatusInstanceSource = { kind: 'equipment', equipmentId }` and are immune to in-battle removal until the equipment is removed (a `force` flag covers the deferred mid-battle path). `createInitialState` validates slot/kind mismatches and fills `vitals.hp` from computed maxHp when placement omits explicit vitals. `physicalPaWp` reads WP from the attacker's equipped weapon (`PA × WP × power_coefficient`); `evasionCheck` reads weapon accuracy with per-ability `hitRoll.accuracy` as override. Weapon tag composition: when an ability's damage tags include `'weapon'`, the weapon's tags merge into the running tag set before subsequent stages see it.

`DamageSpec.power` → `DamageSpec.power_coefficient` rename across all physical / magical / healing abilities (~8 callsites + test fixtures); `attack` migrates to `power_coefficient: 1.0` × WP=4 from the long_sword (damage numbers preserved). `StatusEffectSpec` gains `applyAlways?: boolean` and `factors?: { faith?, brave?, ma?, pa? }` for per-effect formula selection — full-override semantics (declared `factors` replaces default rather than merging). New `computeBraveFactor` helper alongside `computeFaithFactor`; PA_factor branch throws `NotYetImplementedError` until first consumer ships. `modifyEvasion` joins the closed hook surface (now 12) — fires inside `pickEvasion` against the defender's hooks; first consumer is Bulwark Stance.

Source-KO status sweep: `StatusEffectType.removeOnSourceKO?: boolean`. After damage that drops a unit to 0 HP, `resolveAbilityEffect` and `reduceSystemDamage` scan all units for statuses anchored to the KO'd unit and emit `status_remove` system actions. v1 consumer is Taunted.

Content: **Long Sword** (WP 4, accuracy 95, tags `['sword']`), **Strength Ring** (+1 PA), **Boots of Haste** (grants Haste with permanent_per_unit_ct duration), **Iron Helm** (+20 maxHpBase), **Iron Mail** (+30 maxHpBase). Knight Battle Skill expanded: **Power Attack** (1.5× coefficient, 4 MP), **Stasis Sword** (1.0× coefficient + 50% Stop with `factors: { brave, ma }`, 6 MP), **Taunt** (`applyAlways` Taunted on a single ranged enemy, 4 MP). Knight R/S/M: **Damage Reduction** (Support, 25% on incoming physical via onDamageReceived multiplier), **Bulwark Stance** (Movement, -1 Move/-1 Jump, +20% MaxHP, +10 Front Evade via modifyEvasion). New status: **Taunted** (REFRESH, removeOnSourceKO, onActionAttempted blocks 40% of attacks against non-source targets via stable hash). Haste's durationMode becomes `permanent_per_unit_ct` to fit equipment-grant lifecycle. Renderer's `buildAnim` gains an `assertNever` exhaustiveness guard (per session 17b's surfaced silent-fallthrough).

ADR-0028 captures the decisions; supersedes ADR-0014's no-rename clause. Demo battle updates: both Knights gain a Long Sword in `rightHand`; Iron Helm / Iron Mail / Strength Ring / Boots of Haste ship in catalog but aren't equipped on demo units (avoids tuning churn). Test count: 426 → 456 (30 new in `session-17c-integration.test.ts`). End-to-end browser verification: demo battle plays to a decided outcome (59 actions logged, clean win banner) with the Knight + Long Sword damage path live.

References: ADR-0028, `src/engine/types/equipment-slot.ts`, `src/engine/items/`, `src/engine/catalog/definitions/item-definition.ts` (rewrite), `src/engine/damage/handlers.ts` (WP / accuracy / tag composition), `src/engine/status/chance.ts` (factor selection), `src/engine/hooks/{hooks,runners}.ts` (modifyEvasion), `src/engine/actions/reducers.ts` (source-KO sweep), `src/engine/setup/create-initial-state.ts` (HP fill, equipment apply), `src/content/items/{long-sword,strength-ring,boots-of-haste,iron-helm,iron-mail}.ts`, `src/content/abilities/{power-attack,stasis-sword,taunt,damage-reduction,bulwark-stance}.ts`, `src/content/statuses/taunted.ts`, `src/renderer/animator.ts`, `docs/content-id-registry.md`.

### 17b. Earth Mage (part 2) + status side-effect infrastructure ✅

*Completed 2026-05-06.* Content + targeted engine extensions — Earth's AoE/Ultimate + four new statuses (non-expiring Poison, Don't Act, Don't Move, content-Stop on bolt) + ADR-0026 forced-movement primitive + ADR-0027 status side-effect infrastructure. Earth Mage now wired into the demo battle as the first non-Knight class on the playable surface.

Engine-side: `system_damage` system action lands as the symmetric counterpart to `system_heal` (Poison's tick + ADR-0026 falling-damage delivery). New `permanent_per_unit_ct` duration mode for non-expiring CT-cadence statuses (apply pipeline returns null duration; turn_start fans out status_tick; reduceStatusTick's null-duration branch already handled "tick fires, no decrement"). `onDamageReceived` hook return shape extended to accept `{ ctx, emittedActions? }`; runner normalizes legacy bare-ctx returns; pipeline threads emissions through `ctx.emittedActions` and `resolveAbilityEffect` forwards them to the reducer's `generatedActions`. `onActionAttempted` runner gains an `isReaction: boolean` arg threaded from `commitAction`'s queue entry; Don't Act blocks volitional UseAbility but allows reactions.

Knockback primitive in `src/engine/map/knockback.ts`: pure function `applyKnockback(state, unit, direction, distance)` that computes the kinematic path, cancellation reason (`map_edge` / `unit_blocker` / `height_tolerance`), drop distance, and a `system_damage` falling-damage emission when drop > 1. Cancel-on-step-up (≥ 1 elevation higher); descent permitted; falling damage = 10 × dropDistance. v1 has no content consumer; Water Mage in session 18 is the first.

Content: Earth Quake (cross-r1 AoE, power 6, mp 14, actionSpeed 25, 50% Movement Debuff per target), Earth Cataclysm (cross-r1 Ultimate, power 10, mp 30, actionSpeed 18, independent rolls of 60% Poison + 40% Don't Act + 40% Don't Move). Earth Strike's actionSpeed promoted 25 → 30 for FFT-faithful tier ordering (Strike 30 / Quake 25 / Cataclysm 18). Bolt formally applies Stop (25% baseChance, duration 12) so Stop has a content pull beyond the engine's pause-charged-action mechanism.

Statuses: **Poison** uses `permanent_per_unit_ct` mode and emits flat MaxHP × 0.10 damage via `system_damage` per CT-100 trigger; never expires. **Don't Act** (`onActionAttempted` blocks UseAbility, allows when `isReaction === true`). **Don't Move** (`onActionAttempted` blocks Move actions). **Earth Mage** wired into the demo battle alongside the existing Knight (1 Knight + 1 Earth Mage per side; mage stats spd 9 / pa 4 / ma 8 / hp 50 / mp 40 with Earth Resilience + Earth Communion + Move +1 + White Magic).

Renderer's `buildAnim` extended to recognize all session 17b system actions (`system_damage` plus the existing `system_heal` / `system_apply_status` / `status_remove` / `status_decrement_stack`) — they pull through to the next animatable action without their own visual, but the animator no longer crashes on the unmatched cases.

ADRs: 0026 (forced-movement collision policy + falling damage), 0027 (system_damage + permanent_per_unit_ct + onDamageReceived emission + isReaction). Test count: 407 → 426 (19 new — 8 in `knockback.test.ts` for the primitive, 11 in `session-17b-integration.test.ts` for system_damage / Poison / Don't Act / Don't Move / Sleep emission pattern / Earth Quake AoE / Earth Cataclysm three-status combo). End-to-end browser verification: 4-unit demo battle plays through with Earth Strike's Movement Debuff landing, Earth Resilience stacking on hits, MP consumption from charged casts, and a clean victory condition.

References: ADRs 0026–0027, `src/engine/types/action.ts` (system_damage), `src/engine/types/duration-mode.ts`, `src/engine/types/damage.ts` (DamageContext.emittedActions), `src/engine/hooks/hooks.ts` (onDamageReceived shape, isReaction), `src/engine/hooks/runners.ts`, `src/engine/actions/reducers.ts` (reduceSystemDamage + pipeline emission threading), `src/engine/actions/commit.ts`, `src/engine/map/knockback.ts`, `src/content/abilities/{earth-quake,earth-cataclysm,bolt,earth-strike}.ts`, `src/content/statuses/{poison,dont-act,dont-move}.ts`, `src/content/battles/demo.ts`, `src/renderer/animator.ts`, `docs/content-id-registry.md`.

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
