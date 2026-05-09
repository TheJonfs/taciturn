# Progress + deferred work

*Snapshot as of 2026-05-09, end of session 20a. Refreshed at the close of the second-wave (sessions 14–20a) arc, ahead of wave-3 planning. Replaces the session-13 snapshot.*

This document is a snapshot. It complements but does not replace:

- `docs/roadmap.md` — sequenced session plan with completion notes.
- `docs/handoff.md` — transient note from the *most recent* session to the *next* (overwritten each session).
- `docs/decisions/*` — ADRs for each architectural choice.

What this doc does is collect, in one place, **what the engine + content surfaces look like, what's been deferred so far and why**, so a planning session can reason about scope without spelunking through 20+ commits and 32 ADRs.

---

## Where we are

Sessions 1 through 20a are complete. The engine + renderer + UI + AI mechanism stack is in place; the v1 demo battle plays through end-to-end as a 6-unit asymmetric class-mixed match (Knight, Earth Mage, Water Mage, Fire Mage, Lightning Mage all on the field). 540 tests pass; TypeScript strict-mode clean (modulo pre-existing test-file errors flagged below); browser-preview verified each session.

Major subsystems that are *fully* end-to-end (mechanism MVP done, ready for content expansion):

- **Core types + identity model** — branded IDs, immutable state, action log.
- **CT system** — Speed, charged actions on the projection model, scheduler advances tick-by-tick.
- **Catalog infrastructure** — `Registry` per kind, `loadDefaultCatalog()`, validated at construction.
- **Hook system** — typed `HookSignatures` (12 hooks today), ordered by source-tier (Equipment / Class / Passive / Statuses), shared between status / passive / equipment registrations.
- **Map and movement** — Dijkstra pathfinding over multi-layer 4-cardinal adjacency, line-of-sight, arc, AoE shapes (single, diamond, square, cross, line, cone, custom), terrain costs, movement-profile composition via `modifyStatQuery` hooks.
- **Ability slots** — buckets and costs (5 v1 buckets, baseline capacities), validated loadouts, `equipPassive` / `setActiveBucket` with structured violations, class-pinned First Action.
- **Ruleset + BattleConfig + initial-state construction** — every parameterizable engine value lives on the ruleset; `createInitialState` takes config + catalog, returns a validated initial `GameState` with equipment applied.
- **Action lifecycle and reducer** — `validateAction` is pure, `commitAction` is the lifecycle wrapper (validate → onActionAttempted → reduce → log → process generated actions FIFO with reaction caps and chain-depth caps), engine-side `turn_end` auto-emit on active-unit KO.
- **Damage pipeline** — seven-stage orchestrator with handler registry. Shipping handlers: `physical_pa_wp`, `magical_ma_power`, `healing_base`, `evasion_check`, `resistance_check`, `variance_roll`, `crit_roll`, `clamp_min_max`, `finalize`. Faith × Faith composition, Vulnerable amplification, chainBonus cluster scaling, signed-max resistance, hit-roll with elevation modifier, Brave-gated reactions per ADR-0021. ADR-0032 wired the crit and chainBonus slots.
- **Reaction substrate** — spec-driven `compileReaction` produces `PassiveHookRegistration[]` from `ReactionAbilityFields` (effect kinds: `use_ability`, `apply_status`, `ct_push`; trigger conditions: `damage_received` with tag filters / `always`). Counter, Discharge, Smolder, Tidal Pull, Earth Resilience all flow through it.
- **Status side-effect infra** — system actions (`system_damage`, `system_heal`, `system_apply_status`, `system_ct_push`, `status_remove`, `status_decrement_stack`) for status hooks to emit follow-ups. Custom-trigger duration mode + `customTrigger.kind` for event-driven statuses (Burn's `on_unit_ct_100`, Vulnerable's `on_damage_received`). Source-KO sweep removes anchored statuses when the source unit dies.
- **Charged-action lifecycle** — full spawn / sit / resolve / interrupt pipeline. `actionSpeed` controls CT accumulation rate; the `Charging` status holds the caster between commit and resolve; Stop pauses (`pausingStatusTypeIds`); KO during charge fizzles on resolve.
- **Equipment integration** — `EquipmentDefinition` discriminated by slot kind; per-slot validated; weapon WP / accuracy feed the physical damage pipeline; `statusGrants` apply at battle start (Boots of Haste); `modifyStatQuery` hooks from the equipment source tier (Strength Ring, Iron Helm).
- **AoE substrate** — per-target dispatch with branched seeds (`perTargetSeed`), shape resolution (caster-anchored cone / line via `cardinalFromTo`; tile/unit-anchored diamond/square/cross/custom), `modifyAoeShape` hook (Aether Bloom enlarges magical shapes by one step), friendly-fire toggle, caster-exclusion default. Reaction cap accounting respects emitting reactor.
- **Forced-movement primitive** — `applyKnockback` with kinematic stop, falling-damage emission, cancellation reasons. v1 consumer is Water Mage's Tidal Wave + Maelstrom.
- **Renderer skeleton** — Pixi-based, layered stage, animator consumes committed actions one at a time, camera lerp, exhaustiveness-checked anim resolution.
- **UI skeleton** — React HUD with current-unit panel, action menu (Attack / Cure / Wait + targeting modes), turn queue, highlight layer (move/attack/heal/aoe).
- **Basic AI (tier 1 + 1.5)** — pure decision function; tier-1.5 (session 20a) added status-aware target selection (Vulnerable bonus), reaction-aware planning (Brave-gated coarse penalty), AoE handling (cluster value with friendly-fire deduction), Lightning-specific awareness (self-damage refusal, Magnetic Mark setup→exploit, Static Embrace ally selection). Phases: heal → unified action pool (damage/debuff/AoE/buff) → move.

### Content surface

- **Classes (5):** Knight, Earth Mage, Water Mage, Fire Mage, Lightning Mage. Each has its full kit (5 actives + reaction + support, plus class-inherent freeAbilities). Knight extended in session 17c (Power Attack, Stasis Sword, Taunt, Damage Reduction, Bulwark Stance).
- **Active abilities (~36):** attack, cure, bolt, earth_strike, earth_blessing, earth_curse, earth_quake, earth_cataclysm, earth_resilience, earth_communion, water_strike, tide_surge, tidal_wave, brine, maelstrom, tidal_pull, flow_state, fire_strike, fire_embrace, fire_storm, spark, flame_lance, smolder, ignition, aether_bloom, lightning_strike, static_embrace, chain_lightning, magnetic_mark, storm_caller, discharge, discharge_strike, conductor, plus Knight extensions and counter (hidden retaliation).
- **Statuses (~22):** Haste, Stop, Charging, Regen, Movement Debuff, Movement Self Buff, Blind, Silence, Poison, Don't Act, Don't Move, Speed Down, Taunted, PA Up, PA Down, MA Up, MA Down, Burn, Crit_modifier, Vulnerable.
- **Equipment (~5):** Long Sword, Strength Ring, Boots of Haste, Iron Helm, Iron Mail (only Long Sword wired into demo).
- **Maps:** one — the 6×6 flat-ground demo. Real maps with elevation / multi-layer / terrain variety still pending.

### What's resolved since session 13's snapshot

The session-13 progress doc listed 5 deferred engine items + a stack of "AI heuristic refinements" + UI/renderer gaps. Status now:

- **Charged action lifecycle** — done (session 15, ADR-0023). Full spawn / sit / resolve / interrupt + tile targeting + Stop-pause derivation.
- **Magical damage handler + Faith pipeline + resistance + evasion** — done (session 14, ADRs 0019–0022). Plus crit added in session 20.
- **Equipment composition with damage formulas** — done (session 17c, ADR-0028). Weapon WP / accuracy feeds the physical handler.
- **AoE damage application** — done (session 17a, ADR-0025) + session 17b's content + session 19's line shape.
- **Special movement (Teleport, Phase)** — still deferred. No content consumer yet; Fly works.
- **Engine-side `turn_end` on active-unit KO** — done (session 15, supersedes ADR-0013).
- **Status_tick fan-out on skipped turns** — resolved (ADR-0024 added per-skip-source `suppressStatusTicks` flag).
- **Reaction compiler** — done (session 16, ADR-0024). `compileReaction` ships; Counter / Discharge / Smolder / Tidal Pull / Earth Resilience all flow through it.
- **Counter Magic gating semantics** — resolved (Brave-gated trigger per ADR-0021; per-content tag filtering).
- **Move-to-heal** — still deferred (handoff items 14–20 explicitly punted; not a content blocker).
- **Status-aware AI decisions** — partial (tier 1.5 in session 20a covers Vulnerable; full status agnosticism waits for stat-aware projection in 20b).
- **Reaction-aware AI play** — partial (tier 1.5 coarse penalty; tag-aware refinement in 20b).
- **Stat-aware damage projection** — deferred to 20b.
- **Two-action turn planning** — deferred to 20b.
- **AoE / multi-target AI handling** — partial (tier 1.5 covers tile and unit-targeted AoEs; cone / line caster-anchored shapes deferred to 20b).
- **General ability-picker UI** — still deferred (session 17c carried the deferral forward; ActionMenu still hardcodes a few buttons).
- **Charged-action UI** — still deferred (no UI surface for "this caster is mid-charge"; no progress bar).

### What's new since session 13 (engine surfaces that didn't exist then)

- **Faith / Brave** as first-class stats with `(Faith_user / 100) × (Faith_target / 100)` composition for magical damage and healing, and Brave-gated reaction triggers.
- **Resistance system** with the `[-100, 100]` scale (per ADR-0022, absorption deferred), `signedMax` composition across multiple tags per ADR-0015, healing skip per ADR-0016.
- **Evasion** (per-class front/side/back baselines, per-ability accuracy, elevation modifier, [0.05, 1.0] clamp) — ADR-0019.
- **Status application formula** with applyAlways override, per-effect factor selection (Faith, Brave, MA, PA), and `linkRoll` for paired effects sharing one Faith roll. Custom-trigger pattern per ADR-0030. STACK_COUNT_ADDITIVE per ADR-0018.
- **Spec-driven reaction compiler** per ADR-0024. Brave-gated triggering per ADR-0021.
- **System actions** per ADR-0017 / ADR-0027 — `system_damage`, `system_heal`, `system_apply_status`, `system_ct_push`, `status_remove`, `status_decrement_stack`, `battle_end`. Pipeline emissions threaded through `ctx.emittedActions`.
- **Equipment substrate** per ADR-0028 — slot validation, weapon-tag composition, source-KO status sweep.
- **AoE substrate** per ADR-0025 — per-target dispatch, seed branching, modifyAoeShape hook, reaction cap respecting emitting reactor.
- **Forced-movement primitive** per ADR-0026 — knockback with kinematic stop, falling damage.
- **CT-push primitives** per ADR-0029 — five flavors (damage rider, damage knockback, free-standing chance-gated, reaction-emitted, support-emitted); cone shape; line shape per ADR-0031.
- **Crit infrastructure** per ADR-0032 — crit_chance / crit_multiplier on BaseStats; crit_roll handler at variance stage; chainBonus cluster scaling; selfDamage cost + `ability_self_cost` source.

---

## Originally-scoped engine work that's still deferred

### 1. Special movement: Teleport, Phase

- **Status:** unchanged from session 13. Pathfinder throws `SpecialMovementNotImplementedError` for both kinds.
- **Why deferred:** still no content consumer. Fly remains the only proven user.

### 2. Damage pipeline stage handlers (elemental, environmental, holy/dark amplification)

- **Status:** physical, magical, healing, evasion, resistance, variance, crit, finalize all ship. Elemental handler is folded into `resistance_check` (per-tag with signedMax). Environmental (terrain / weather) and holy/dark amplification stages are still empty.
- **Why deferred:** no content consumer.

### 3. AoE on healing / Caster-target self-damage chained with effects

- **Status:** chainBonus on healing not implemented (no AoE healing exists). Self-damage doesn't compose with effects (no consumer).
- **Why deferred:** no content consumer; surfaces to the dispatcher when one ships.

---

## New engine policy / cleanup gaps surfaced during sessions 14–20

- **Pre-existing TS strict-mode errors in test files.** Carried since session 17c; npm test passes via Vitest's loose mode but `tsc -b --noEmit` surfaces them. Not blocking; defer to a focused cleanup session.
- **Crit_chance / crit_multiplier upper bounds.** No explicit cap; runtime comparison handles >100 sensibly. Soft cap at `modifyStatQuery` if a future build pushes pathological territory.
- **Crit + Vulnerable burst potential** per ADR-0032. v1 numbers can produce ~108-damage one-shots with Static Embrace + Magnetic Mark + Lightning Strike + crit. Flagged for the post-session-20 calibration pass — possibly cap the multiplicative composition or the Vulnerable amount.
- **Storm Caller's 25% maxHpBase self-cost.** Uncapped at HP=0; a Lightning Mage at 11 HP self-KOs by casting. Design intent (real risk-taking lever); flagged for tuning if playtesting shows it's too punishing.
- **Vulnerable double-fire in chain ordering.** Documented ADR-0032 edge case. v1 reaction patterns don't create the case. Surface if a content consumer creates it.
- **Reactor MP semantics in `reduceUseAbility` for reactions.** v1 reactions are MP-free; the path is unexercised. Verify when an MP-costing reaction first ships.
- **Self-cost scaling with caster's max-HP buffs.** Storm Caller reads `caster.baseStats.maxHpBase` (stored), not `runModifyStatQuery('maxHp')`. v1 has no max-HP-modifying status; decide when one ships.
- **Polarity metadata on StatusEffectType.** Tier-1.5 AI hardcodes a known-buff status list to gate the buff phase (so Magnetic Mark doesn't try to apply Vulnerable to self). A clean fix is `aiHints?: { polarity?: 'buff' | 'debuff' }` on StatusEffectType. Lands when a meaningful number of new statuses make the hardcoded list painful.
- **`reaction_fizzled` system event.** Carried from session 13. Still no log entry when a reaction's mid-chain validation fails. Surface when the renderer / replay model wants to narrate it.
- **Battle-end checkpoint on damage-application.** Still emitted at `turn_end`. Open question whether mid-chain decision matters for any hook-driven mechanic.
- **`StatusEffectType.removeOnSourceKO` — already shipped (session 17c).** Notable: the source-KO sweep is engine-side (in `resolveAbilityEffect` / `reduceSystemDamage`); v1 consumer is Taunted.

---

## AI heuristic refinements outstanding

Tier-1.5 (20a) closed: status-aware targeting (Vulnerable), coarse reaction penalty, AoE cluster scoring, Lightning-specific (self-damage / mark setup / Static Embrace selection).

Tier-2 (20b — agreed split):

- **Stat-aware damage projection.** AI should compute `expected_damage ≈ runDamagePipeline-derived estimate` per (actor, ability, target) — folding in PA/MA, weapon WP, Faith × Faith, resistance, Vulnerable, crit expectation, evasion. Replaces the `power_coefficient` proxy.
- **Two-action turn planning.** Consider Move + Act jointly. Today's one-decision-per-call cadence misses "step here so I can hit the wounded enemy from the new tile" patterns that current move scoring approximates but doesn't optimize.
- **Reaction tag-filter inspection.** Decompose `ReactionAbilityFields` per equipped reaction so the AI can recognize that Counter (physical-only) doesn't fire against a magical attack. Likely needs `reactionFields?: ReactionAbilityFields` decorative field on `PassiveAbilityDefinition` so the AI can read it without running closures.

Still-deferred AI items (no scheduled session):

- **Move-to-heal / move-to-buff.** AI doesn't close distance to a wounded ally or a pre-cast buff target.
- **Cone / line caster-anchored AoE direction planning.** AI skips Maelstrom and Flame Lance.
- **Wait as a tactic.** AI never explicitly Waits (it ends without consuming, which has the same CT-cost outcome today; matters when a future status differentiates).
- **Charged-action awareness.** AI casts charged abilities but doesn't model "I'll be skipped next turn while this resolves." For Lightning specifically, this means the AI doesn't always coordinate Mark resolution with a follow-up Strike cast on the next active turn.

---

## UI / renderer surfaces

- **General ability-picker.** Still deferred. ActionMenu still hardcodes Attack / Cure / Wait. Each of the four mage classes ships ~5–7 abilities; the FFT-style submenu pattern is the cleanest path.
- **Battle log surface / damage popups.** No surface narrates damage / status applications / reactions / charged-action resolutions to the player. Becomes load-bearing as kits get richer.
- **Charged-action UI.** No "X is casting Y, resolves in Z ticks" indicator. Important for planning around Magnetic Mark / Storm Caller cadences.
- **Status icons on the unit sprite / HUD.** Currently the status strip on the CurrentUnitPanel lists names; per-unit-on-map icons would make Vulnerable visible across the field.
- **Pause / step-by-step debug mode.** Programmatic via `__taciturnDebug`; no UI affordance.
- **Layout polish.** Right-side HUD is the v1 placeholder. Proper layout (left-side roster, bottom log, etc.) lands during a UX pass.
- **Tile-targeted AoE preview.** When the player is choosing a tile for Chain Lightning / Earth Quake / Fire Storm, the cluster footprint should highlight as the cursor moves. Probably ships alongside the general ability-picker.

---

## Engine refactors / DX (low priority, no rush)

- **Refactor `engine/ct/projection.ts` and `engine/turn/scheduler.ts` to share a snapshot helper.** Carried from session 13. Both walk units to filter KO'd and project actual-CT > Speed > stable-ID.
- **Move the `Controller` type out of `src/app/demo/orchestrator.ts`.** Carried from session 13.
- **Action-log compaction on long battles.** Performance concern that hasn't materialized.
- **Catalog hot-reload during development.** DX nicety.
- **Initial-CT formula tuning.** Still placeholder values; surfaces during the calibration pass.
- **Faith / Brave / crit calibration.** Demo numbers (Faith 80, Brave 100, crit_chance 5, crit_multiplier 1.5) are placeholders. Realistic spreads land alongside the broader tuning pass post-session-20.

---

## Content-expansion passes (intended as separate from mechanism work)

- **Status catalog expansion.** v1 ships ~22 statuses across the Mage kits + Knight extensions. Future: Reflect, Protect, Shell, Float, Berserk, Sleep, Confuse, Charm, Disable, Innocent, Slow, etc. Each addition exercises hook-chain registration; some will surface engine policy gaps.
- **Class catalog expansion.** Five classes ship. Future roster (Priest, Wizard, Chemist, Monk, Thief, Time Mage, etc.) — each brings its command sets, base stats, R/S/M abilities.
- **Ability / command-set expansion.** ~36 abilities ship across First Action / passive buckets. Real coverage requires multiple content sessions per future class.
- **Equipment catalog expansion.** Five items in catalog; only Long Sword equipped. Real weapon / armor / accessory catalog.
- **Map content expansion.** Only 6×6 flat-ground demo. Real maps with elevation, terrain variety, multi-layer.
- **Ruleset variants.** Default ruleset suffices; "only if needed."

---

## Things to think about in wave-3 planning

1. **Wave-2 was content-led (each Mage class drove its engine extension).** That worked well — engine extensions earned their keep through a real consumer. Wave-3 candidates can follow the same shape: pick the next class (Priest / Time Mage / Thief?), identify the engine extensions it needs, ship together. Or shift to a content-density pass (class roster expansion across existing engine surfaces) followed by the v1 calibration pass.

2. **Calibration pass.** Demo stats are placeholders across Faith, Brave, evasion, resistance, crit, equipment WP/accuracy, action speeds, MP costs, mp pools, HP pools, and so on. A focused tuning pass once content density justifies it — likely between wave-3 content sessions and v1 declaration.

3. **AI tier 2 (20b) timing.** Scheduled as the next AI session. Three sub-items (stat projection, two-action planning, reaction tag inspection) compose to ~one solid session. Could ship before or after wave-3 content sessions.

4. **Pre-existing TS strict-mode test errors.** Worth a focused cleanup pass at some point. Not urgent; doesn't gate anything.

5. **v1 deliverable definition.** Still undefined per session-13's framing. Suggested gates: class roster ≥ 6 (current 5), status catalog coverage of the v1 design doc, real maps shipped, calibration pass done, ability-picker UI shipped, battle log surface shipped. Probably a planning conversation in its own right.

6. **What "second playable" looks like.** First playable = session 13's 2v2 Knight battle. We're past that. The next milestone might be "playable battle with mixed classes including a new map" — gates the ability-picker UI + map content + status icons.
