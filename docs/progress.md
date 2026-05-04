# Progress + deferred work

*Snapshot as of 2026-05-03, end of session 13. Intended as input to a planning conversation about scoping the next round of engine vs content work.*

This document is a snapshot. It complements but does not replace:

- `docs/roadmap.md` — sequenced session plan with completion notes.
- `docs/handoff.md` — transient note from the *most recent* session to the *next* (overwritten each session).
- `docs/decisions/*` — ADRs for each architectural choice.

What this doc does is collect, in one place, **what's been deferred so far and why**, so the planning session can reason about scope without spelunking through 12 commits and 13 ADRs.

---

## Where we are

Sessions 1–13 are complete. The engine + renderer + UI + AI mechanism stack is in place and the v1 demo battle plays through end-to-end as a 2v2 with Counter chains and AI healing. 345 tests pass; TypeScript strict-mode clean; browser-preview verified.

Subsystems that are *fully* end-to-end (mechanism MVP done, ready for content expansion):

- **Core types + identity model** — branded IDs, immutable state, action log.
- **CT system** — Speed, charged actions on the projection model, scheduler advances tick-by-tick.
- **Catalog infrastructure** — `Registry` per kind, `loadDefaultCatalog()`, validated at construction.
- **Hook system** — typed `HookSignatures`, ordered by source-tier (Equipment/Class/Passive/Statuses), shared between status / passive / future equipment registrations.
- **Map and movement** — Dijkstra pathfinding over multi-layer 4-cardinal adjacency, line-of-sight, arc, AoE shapes, terrain costs, movement-profile composition via `modifyStatQuery` hooks.
- **Ability slots** — buckets and costs (5 v1 buckets, baseline capacities), validated loadouts, `equipPassive` / `setActiveBucket` with structured violations.
- **Ruleset + BattleConfig + initial-state construction** — every parameterizable engine value lives on the ruleset; `createInitialState` takes config + catalog, returns a validated initial `GameState`.
- **Action lifecycle and reducer** — `validateAction` is pure, `commitAction` is the lifecycle wrapper (validate → onActionAttempted → reduce → log → process generated actions FIFO with reaction caps and chain-depth caps).
- **Damage pipeline (orchestration only)** — seven-stage pipeline with handler registry; physical and healing handlers shipped. Reaction generation rides on `ReduceResult.generatedReactions` and respects per-reactor caps.
- **Turn flow** — battle-outcome evaluation, `battle_end` system action, turn-skip via `queryTurnSkipped` hook (Stop demo), reaction fizzle, `advanceToNextEvent` scheduler entry point.
- **Renderer skeleton** — Pixi-based, layered stage, animator consumes committed actions one at a time, camera lerp.
- **UI skeleton** — React HUD with current-unit panel, action menu, turn queue; `useBattleUi` input state machine; `setHighlights` API on the renderer.
- **Basic AI** — pure decision function, heuristic for attack target selection (lowest-HP first) and move scoring (best-future-threat); session 13 added a heal phase.

---

## Originally-scoped engine work that was deferred

These are the items that *were* in the scope of an earlier session but punted to a later session. They're called out separately because they aren't "we never planned this" — they're "we explicitly stopped short."

### 1. ChargedAction lifecycle (`chargeTicks > 0`)

- **Originally scoped to:** session 7 (Action types + reducer).
- **What landed:** the data shape of `ChargedAction`, the `chargeTicks` field on `AbilityDefinition`, the projection-after-trigger constant, the scheduler's awareness of charged-action triggers in projection.
- **What was deferred:** actually spawning a `ChargedAction` when an ability with `chargeTicks > 0` is used. `reduceUseAbility` currently throws: *"chargeTicks > 0 not implemented yet."* The full lifecycle wants:
  - Spawn on use: create the `ChargedAction`, apply the canonical `Charging` status to the actor.
  - Sit in the schedule: the scheduler already projects trigger ticks; needs to commit a `charged_action_resolve` system action when the trigger fires.
  - Resolve: run the deferred ability's effect at trigger time. Re-validate at trigger; the design says targets that have moved out of range cause the ability to fizzle.
  - Interruption: damage / Move / Stop / KO during charge needs to cancel cleanly (and remove the `Charging` status).
  - Reaction interplay: a reaction that triggers between use and resolve should not duplicate the resolve.
- **Why deferred:** the surface is non-trivial and has zero v1 content consumers (no charged ability ships in the demo). Session 13 considered "second Knight ability = a charged attack" and rejected it on cost grounds. Adoption is content-driven: the first charged-ability content session is the right time to land it.
- **Estimated shape:** one full session, dedicated. Touches `commitAction`, `reduceUseAbility`, `engine/ct/scheduler.ts`, `engine/ct/projection.ts`, the Charging status content, and a new family of tests for spawn/resolve/interrupt.

### 2. Special movement: Teleport, Phase

- **Originally scoped to:** session 4 (Map and movement).
- **What landed:** the `MovementProfile.specialMovement` data shape, the `modifySpecialMovement` hook (session 5), the `Fly` consumer (drops the jump check during pathfinding).
- **What was deferred:** Teleport (free placement to any reachable tile, ignoring intermediate blockers) and Phase (pass through any tile, including walls). The pathfinder throws `SpecialMovementNotImplementedError` for both kinds.
- **Why deferred:** no content consumers in v1. Fly was enough to prove the hook chain end-to-end.
- **Estimated shape:** small. Both flavors are pathfinder branches that already have a hook signal. Probably half a session including content (a Teleport-flavored ability or item).

### 3. Damage pipeline stage handlers (magical, elemental, evasion, environmental, holy/dark amplification)

- **Originally scoped to:** session 8 (Damage pipeline).
- **What landed:** the seven-stage orchestrator (`runDamagePipeline`), the handler registry, the canonical handlers for **physical** and **healing**, the variance-roll / clamp / finalize stages.
- **What was deferred:** every other handler. Magical (`MA × power`), elemental (resist / weak / absorb / null), evasion (physical/magical/blade-grab/equipment side, faith/zodiac modifiers), environmental (terrain / weather), and the holy/dark amplification stage. The orchestrator runs these stages with no registered handlers — the pipeline silently passes through.
- **Why deferred:** none of these are observable without content. The handler registry is open and additive: each new content session that introduces a relevant ability adds the handler and its tests.
- **Estimated shape:** spread across multiple content sessions. Each handler (or small handler family) is ~50 lines + tests. Magical handler will land with the first MA-scaling ability content; elemental will land with the first ability that has elemental tags; etc.

### 4. Equipment composition with damage formulas

- **Originally scoped to:** session 8 — comments on the `attack` ability note "when equipment lands, the equipped weapon's WP composes here instead of the ability's own coefficient."
- **What landed:** `Item` catalog kind exists; `Long Sword` stub exists.
- **What was deferred:** equipment slots on `Unit`, the `Equipped` source tier in the hook chain, weapon power feeding into the physical handler instead of the ability's hardcoded `power`.
- **Why deferred:** the engine doesn't have equipped-item state on units yet. Items are catalog-only. Equipping is a content-data session that lands when classes/abilities/items co-evolve.

### 5. AoE damage application

- **Originally scoped to:** session 4 (AoE shapes), session 8 (damage pipeline that the AoE feeds into).
- **What landed:** `aoeFootprint`, all AoE shapes (single, diamond, square, cross, custom), vertical tolerance, multi-layer-affected default. The damage pipeline runs per-target; iterating it across an AoE footprint is straightforward.
- **What was deferred:** an actual AoE-targeted ability and its reducer path. v1 abilities are all `single_unit`. The reducer's per-target loop is implied but not exercised; AI's offensive-ability filter explicitly skips non-`single_unit` for the same reason.
- **Why deferred:** no AoE content consumer. Lands with the first AoE ability content (likely Black Magic's Fire / Bolt / Ice family).

---

## Engine policy / cleanup gaps (open)

These are not "deferred from a specific session" — they're things spotted along the way that warrant a deliberate decision in their own right. Most have an open question shape, not a clear "fix this" shape.

- **Engine-side auto-emit `turn_end` when active unit becomes KO'd.** Currently orchestrator-side per ADR-0013. The architecturally cleaner long-term fix lives in `commitAction`, parallel to the Stop status's skipped-turn pattern. Real policy decision — when *exactly* should the auto-emit fire? After the root action's chain settles? After every action? What about KO during charged-action resolve? Worth its own session + ADR.
- **`reaction_fizzled` system event.** When `commitAction` silently drops a reaction whose validation fails mid-chain, no log entry records the fizzle. A `reaction_fizzled` system action would let the renderer surface "Counter target moved out of range" and the replay model stay self-describing.
- **Battle-end checkpoint on damage-application.** Right now `battle_end` is emitted at `turn_end`. A unit can be KO'd mid-chain and the battle is morally decided, but the chain unwinds further before `battle_end` fires. Open question whether this matters for any hook-driven mechanic.
- **Status_tick fan-out on skipped turns.** A unit whose turn is skipped by Stop currently emits no `status_tick` actions for its turn-based statuses. The right behavior probably depends on the status: most should still tick (Stop *itself* shouldn't tick down on its target's skipped turn — that's how Stop locks); poisons probably should. Want a per-status flag.
- **Per-status flag for "tick on skipped turn."** The flag above. Belongs on `StatusEffectType`.
- **Charged-action triggers in `advanceToNextEvent`.** The scheduler currently picks turn_start as the only trigger kind. When charged actions are fully wired (item 1 above), the scheduler needs to recognize and emit `charged_action_resolve` at the right tick.
- **Out-of-range counter / "Counter Magic at non-magical attack" gating semantics.** Open content/design question — what exactly are the gating rules around reaction abilities firing on non-matching incoming actions? Carried forward from session 8.

---

## Engine refactors / DX (low priority, no rush)

- **Refactor `engine/ct/projection.ts` and `engine/turn/scheduler.ts` to share a snapshot helper.** Both walk units to filter KO'd and project actual-CT > Speed > stable-ID. The duplication is small but real.
- **Move the `Controller` type out of `src/app/demo/orchestrator.ts`.** Three import sites currently. Lands when the demo orchestrator generalizes (e.g., a non-demo orchestrator ships).
- **Action-log compaction on long battles.** Performance concern that hasn't materialized; defer until profiling identifies it.
- **Catalog hot-reload during development.** DX nicety.
- **Initial-CT formula tuning.** Both variants exist (`fixed`, `speed_with_variance`). Default values are placeholders; tuning is a calibration pass after richer content lights up the variance.

---

## Content-expansion passes (always intended as separate from mechanism work)

These are not deferrals — they're the explicit "horizontal MVP, then content breadth" methodology from `docs/roadmap.md`. Listing them here so the planning conversation sees the full content surface in one place.

- **Status catalog expansion.** v1 ships Haste (timing demo) and Stop (turn-skip demo). Full v1 status catalog (Poison, Sleep, Berserk, Reflect, Faith, Protect, etc.) per `docs/design/status-effects.md`. Each addition exercises hook-chain registration; some will surface engine policy gaps (the per-status "tick on skipped turn" flag is one).
- **Class catalog expansion.** Only Knight ships. Real roster (Priest, Wizard, Chemist, Monk, Thief, etc.) — each class brings its command sets, base stats, R/S/M abilities. This pass is also when class-pinned First Action gets exercised across a real variety.
- **Ability / command-set expansion.** Cure is the second active ability ever (after Attack). Full v1 ability surface lands across multiple content sessions, gated on the engine support for each ability shape (charge, AoE, multi-target, status-applying-only, etc.).
- **Item catalog expansion.** Long Sword is a stub. Real weapon / armor / accessory catalog lands with equipment integration (item 4 above).
- **Map content expansion.** Only the 6×6 flat-ground demo map exists. Real maps with elevation, terrain variety, multi-layer (bridge over water) all want content.
- **Ruleset variants.** The default ruleset suffices today. Session 6 left this open ("only if needed").

---

## AI heuristic refinements (interleaved with content)

Each of these is small individually but adds up. Not session-shaped on their own; they accrete as content makes them observable.

- **Move-to-heal.** Currently the AI only heals allies *already* in cure range from its current position. A wounded ally out of range falls through to attack/move, with the move computed against enemies, not against the heal opportunity.
- **Status-aware decisions.** AI ignores statuses on both itself and targets. Don't attack a Reflect-buffed mage with a magic spell; prefer a target who's about to be skipped by Stop; etc.
- **Reaction-aware play.** Doesn't model that an enemy with Counter equipped will hit back. Today every Knight has Counter; the AI just walks into the chain.
- **Stat-aware damage projection.** `abilityScore` returns ability `power` directly. Real expected-damage projection wants `PA × power × variance midpoint × target-resistance estimate`.
- **Two-action turn planning.** One decision per call; orchestrator re-asks. No planner that reasons about "Move to A, then Attack B from A as one unit of decision."
- **Wait as a tactic.** The AI never explicitly Waits; it ends the turn without consuming. CT-cost outcome is the same today (`reduceTurnEnd`'s "nothing consumed → wait cost"), but distinguishes when a future status hooks `wait` differently.
- **AoE / multi-target ability handling.** `enumerateOffensiveAbilities` filters to `single_unit` only.
- **Stat-hooks-aware maxHp in heal threshold.** AI uses `baseStats.maxHpBase` directly; no v1 content modifies maxHp at runtime, so this is identical today, but a modifyStatQuery pass on `'maxHp'` is the architecturally correct version.

---

## UI / renderer surfaces

- **General ability-picker.** ActionMenu currently hardcodes one button each for Attack and Cure. The FFT-style "open Battle Skill submenu, see Hero Sword / Stasis Sword / etc." design wants ActionMenu to read each equipped command set and render one button per active member, with the targeting / range / cost driven from the ability definition. Replaces the hardcoded buttons cleanly. Probably its own UI session.
- **Battle log surface / damage popups.** Right now the player sees HP bars change. As content gets richer (statuses applied, reactions fizzling, charged actions resolving), narration becomes load-bearing.
- **Charged-action UI.** No v1 consumer. Lands with item 1.
- **Pause / step-by-step debug mode.** Manual "advance one action at a time" for debugging. The session-13 dev-only `__taciturnDebug` hook is a programmatic version; a UI version would be more ergonomic.
- **Layout polish.** Right-side HUD is the v1 placeholder. A proper layout (left-side roster, bottom log, etc.) lands during a deliberate UX pass.

---

## Things to think about in planning

A few framing questions that the planning conversation might want to pre-decide:

1. **Engine session vs content session boundaries.** Several deferred items (charged actions, AoE, magical damage, equipment) are *engine work that's gated on a content consumer*. Two reasonable framings:
   - "Content-led" — pick the next content session, identify the engine work it requires, land both together.
   - "Engine-led" — pick the next engine subsystem and ship its minimum content alongside.
   The roadmap's MVP-first methodology has been content-led so far (each engine session ships one demo content piece). Worth deciding whether that continues for the second pass.

2. **Bundling vs splitting "small" deferred items.** Items like `reaction_fizzled` and the per-status skipped-turn flag are each ~3 hours of work. They could be bundled into a "post-MVP cleanup" session, or interleaved with content sessions that surface them. The cleanup framing risks turning into a junk drawer; interleaving risks each of these never quite being important enough to land.

3. **AI tier strategy.** The session-13 basic AI is one tier. The integration test asserts AI ≥ greedy. A meaningfully-stronger AI tier ("intermediate"? "advanced"?) is well-known as a roadmap item but unscheduled. Worth deciding when the bar moves and what content-readiness gates the next tier.

4. **What does "v1" actually mean as a deliverable?** The roadmap's "first playable battle" was session 13's goal and is met. There's no defined point at which "v1 feature-complete" happens. Planning could helpfully define that — e.g., "v1 ships when class roster ≥ 6, status catalog ≥ 12, and a 4v4 battle can run on a 12×12 map with elevation."
