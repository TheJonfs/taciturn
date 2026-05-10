# Post-Session-20 Engine Audit

*Captured 2026-05-10. Pre-roadmap audit against the post-reconciliation Mage War content spec (`mage-war-content-spec.md`) and the twentyOneDesign reference docs (equipment, deployment, river-ridge, team-builder, battle-ui).*

---

## How to read this report

Each entry covers **Status** (`implemented` / `partial` / `not implemented`), **Gap**, **Implementation sketch** (where applicable), **Size estimate** (`trivial` < ½ session / `small` ~½ session / `medium` ~full session / `large` multi-session), and **Related ADRs / files**. Items 19–20 are lighter — the brief asks for flag-only treatment of UI prerequisites.

Sizes presume a focused, single-purpose session that includes tests. They do **not** include the content-update work that follows (re-equipping demo units, adding new authored items, etc.) unless explicitly noted.

---

## Section A — Equipment effect plumbing

### Item 1 — Bucket capacity modifiers from equipment

- **Status:** not implemented
- **Gap:** [`getCapacity`](src/engine/abilities/capacity.ts) returns `ruleset.bucketCapacities.get(bucketId)` and applies no per-unit modifier. The function's own comment ("equipment, status, and class traits with '+1 Active capacity' or '-2 Reaction capacity' effects compose at query time when their hook surfaces land") flags the gap explicitly. `modifyStatQuery` does **not** extend to bucket capacities — the StatName union has no entry for buckets, and `getCapacity` doesn't read through the hook chain.
- **Implementation sketch:** Cleanest path is a dedicated hook surface (e.g., `modifyBucketCapacity`) on the closed list, with item statMods extended to support bucket-capacity deltas and an equipment contributor that emits one handler per bucket-cap delta per item. Adding a new hook is a deliberate engine change per CLAUDE ground rule 8 — the composition shape (additive integer chain) is straightforward but the hook itself is new. Alternative: extend `modifyStatQuery` to cover bucket capacities by adding `bucket_capacity_reaction` etc. to StatName; this keeps the hook surface closed but pollutes the stat namespace with non-stats. **Recommend the dedicated hook.**
- **Size:** small (one new hook + runner + equipment contributor extension + tests; consumers — Steel Helm, Augmentor, Magus Crown — wait for the content-update session).
- **Related:** [`src/engine/abilities/capacity.ts`](src/engine/abilities/capacity.ts), [`src/engine/hooks/hooks.ts`](src/engine/hooks/hooks.ts), ADR-0007/0008 (capacity baseline), ADR-0028 (equipment integration shape).

### Item 2 — Negative evasion handling

- **Status:** implemented (with caveat)
- **Gap:** None on the path — the formula in [`evasionCheck`](src/engine/damage/handlers.ts:243) is `accuracy × (1 − evasionPct/100) × elevationModifier`, then runs through `runModifyHitChance` (multiplicative chain), then clamps the **final hit_chance** to `[0.05, 1.0]`. Negative `evasionPct` cleanly produces `(1 − negative/100) > 1`, raising the multiplier above 1.0. Per [`runModifyEvasion`'s comment](src/engine/hooks/runners.ts:84) negative evasion is anticipated. The caveat is: the `[0.05, 1.0]` clamp on hit_chance means a 95% accurate weapon vs. -20 side evade saturates at 100%, not 114%. That's still a meaningful improvement at lower-accuracy weapons (75% × 1.20 = 0.90, well under cap), and the equipment doc's framing ("harder to miss attacks against you from those angles") matches this behavior.
- **Implementation sketch:** N/A.
- **Size:** trivial (verification-only — confirm with a test that uses a Steel Helm-style fixture with negative evasion to lock the behavior).
- **Related:** [`src/engine/damage/handlers.ts:243`](src/engine/damage/handlers.ts:243), [`src/engine/hooks/runners.ts:85`](src/engine/hooks/runners.ts:85), ADR-0019 (evasion check), ADR-0028 (modifyEvasion).

### Item 3 — Element-tagged physical damage on weapons

- **Status:** implemented
- **Gap:** None. [`physicalPaWp`](src/engine/damage/handlers.ts:123) merges `weapon.tags` into `ctx.damageTags` when the ability declares the `'weapon'` tag. The merge happens at the base stage so subsequent stages (resistance check, on-damage hooks) see the unified tag set. A Flametongue with `tags: ['fire']` automatically gets fire resistance lookup via the existing signedMax composition; `composeResistance` walks every non-healing tag.
- **Implementation sketch:** N/A.
- **Size:** trivial (verification-only — content-update session can add a tag-bearing Long Sword variant to confirm with an integration test).
- **Related:** [`src/engine/damage/handlers.ts:140`](src/engine/damage/handlers.ts:140), ADR-0028.

### Item 4 — Spell-cast riders on weapons

- **Status:** not implemented
- **Gap:** No effect type for "weapon procs an ability on hit." The damage pipeline emits `onDamageDealt` / `onDamageReceived`, but neither has a content path that composes "fire ability X% of the time on this swing" — the existing reaction surface (`onActionTargeted`) is the right shape but is registered against the **target's** hooks, not the attacker's, and is gated by Brave (not by a flat percentage as the spec requires for weapon procs).
- **Implementation sketch:** Two options.
  (a) **New attacker-side proc hook on damage events** — a `onAttackerDamageDealt` (or fold into the existing `onDamageDealt` with proc-emitting handlers) that lets equipment-tier handlers emit a `use_ability` proposal at a configurable flat chance. The emitted use_ability re-enters the queue as a system action with the attacker's `actorId`; existing chain-depth + reaction caps keep it bounded. (b) **Generalize the reaction-compiler shape** — the existing reaction compiler already emits `use_ability` from a hook firing; a parallel "attack rider compiler" that fires on `onDamageDealt` against the attacker's hooks would reuse most of the substrate. Recommend (b) — less new hook surface, more code reuse.
  Either way the effect spec needs a new shape: `{ kind: 'attack_proc', chance: number, abilityId: AbilityId }` on the equipment item, consumed by the equipment contributor or the new compiler.
- **Size:** medium (new effect shape + compiler/contributor + per-action seed sub-stream for the proc roll + chain bookkeeping verification + tests).
- **Related:** [`src/engine/abilities/reaction-compiler.ts`](src/engine/abilities/reaction-compiler.ts), [`src/engine/damage/handlers.ts`](src/engine/damage/handlers.ts), ADR-0024 (action chain), ADR-0028.

### Item 5 — MP cost modifiers

- **Status:** not implemented
- **Gap:** [`reduceUseAbility`](src/engine/actions/reducers.ts:246) reads `ability.mpCost` directly with no hook intervention. Same site reuses the bare value at lines 304 and 381. Validation reads it directly too. There is no `modifyMpCost` (or `modifyAbilityMpCost`) hook on the closed list.
- **Implementation sketch:** Add `modifyMpCost` to `HookSignatures` with args `{ unit: Unit; ability: ActiveAbilityDefinition; baseCost: number }` and a multiplicative chain. Equipment contributor extension: items declare `mpCostMultipliers` (e.g., Staff of Power × 1.20) and emit one handler per declaration. Reducer + validator route MP-cost reads through a new helper `computeMpCost(state, catalog, unit, ability)` and use the result for both the affordability check and the deduction. This is small but touches several call sites; the helper is the discipline that keeps it centralized.
- **Size:** small.
- **Related:** [`src/engine/actions/reducers.ts:246`](src/engine/actions/reducers.ts:246), [`src/engine/actions/validate.ts`](src/engine/actions/validate.ts), [`src/engine/hooks/hooks.ts`](src/engine/hooks/hooks.ts).

### Item 6 — MaxMP modifier scaling

- **Status:** partial
- **Gap:** `modifyStatQuery` is a value-passing chain — handlers receive the running `baseValue` and return the next. Multiplicative composition works *naturally* when handlers do `args.baseValue * 1.50`; the hook signature doesn't enforce additive vs. multiplicative. The gap is twofold:
  1. **No `mp` / `maxMp` stat is registered for the equipment contributor.** [`STAT_MOD_KEYS` in `equipmentContributionsFor`](src/engine/items/contributions.ts:37) covers `spd / pa / ma / maxHpBase / brave / faith` but **not `mp` or any MP equivalent**. `fillVitalsFromComputedMaxes` likewise notes "MP isn't yet a `modifyStatQuery` consumer — equipment doesn't contribute MP today (no `maxMpBase` stat exists)." MP today is a flat number on `vitals.mp` set per-placement.
  2. **No multiplicative-mod authoring shape on `ItemDefinition.statMods`.** The current shape is `PartialBaseStats` which is additive-only: `+1 PA`, `+30 maxHpBase`. Wizard's Robe-style `+40 MP` would land cleanly. But Staff of Abundance's `+50% MaxMP` requires either a separate `statModsMultiplicative` field on the item or a registered handler that knows to apply a multiplier — neither exists.
- **Implementation sketch:** Three things land together:
  (a) Introduce a `maxMpBase` stat on `BaseStats` (and a derived `maxMp` for queries through `modifyStatQuery`). MP becomes computed-on-read like maxHp. Per-placement vitals continue to override via `placement.vitals?.mp`; absent that, `fillVitalsFromComputedMaxes` fills from the queried max.
  (b) Extend `STAT_MOD_KEYS` to register `mp → maxMp`. Wizard's Robe-style additive `+40 MP` becomes mechanical.
  (c) For multiplicative shifts, extend `ItemDefinition` with a `statModsMultiplicative?: Partial<Record<StatName, number>>` shape and emit a second contribution per multiplicative entry. Composition order across additive + multiplicative chains follows the Equipment tier's existing tieBreakIndex.
- **Size:** medium (new stat introduction has reach into placement, fill, and the AI's projection that reads MA / HP — verify the AI's projection surface still reads correctly when MP gets added).
- **Related:** [`src/engine/items/contributions.ts:37`](src/engine/items/contributions.ts:37), [`src/engine/types/stats.ts`](src/engine/types/stats.ts), [`src/engine/setup/create-initial-state.ts:206`](src/engine/setup/create-initial-state.ts:206).

### Item 7 — Spell speed (actionSpeed) modifiers

- **Status:** not implemented
- **Gap:** `actionSpeed` is read from `ability.actionSpeed` directly at the charged-action commit site ([`src/engine/actions/reducers.ts:263`](src/engine/actions/reducers.ts:263)). No `modifyActionSpeed` hook exists. Wand of Deepwood's "+5 actionSpeed for Earth-tagged spells" and Staff of Abundance's "−5 actionSpeed for all spells" cannot be expressed.
- **Implementation sketch:** Add `modifyActionSpeed` to `HookSignatures` with args `{ unit: Unit; ability: ActiveAbilityDefinition; baseActionSpeed: number }`, additive chain. Equipment contributor extension: items declare `actionSpeedModifiers: Array<{ baseValue: number; tagFilter?: ReadonlyArray<DamageTag> }>` and emit one handler per declaration that gates on tag and adds magnitude. Charged-action commit + the existing `computeActionSpeed` (used while a charge is pausing on Stop) route through the new helper. Note: `computeActionSpeed` already exists per the ruleset's `pausingStatusTypeIds` mention; verify it's the right chokepoint.
- **Size:** small.
- **Related:** [`src/engine/actions/reducers.ts:263`](src/engine/actions/reducers.ts:263), [`src/engine/types/charged-action.ts`](src/engine/types/charged-action.ts).

### Item 8 — Status tickdown rate modifiers

- **Status:** not implemented
- **Gap:** Status duration decrement is handled uniformly by the `status_tick` reducer (per ADR-0024). There's no per-status duration multiplier or "tick rate" hook — every tick is a single decrement. Burn's [`customStateOnDecrement`](src/content/statuses/burn.ts:85) is a custom-state mutator, not a duration scaler. Purifier's "doubles tickdown rate of negative-tagged statuses on the wearer" requires either:
  - a hook that fires on status_tick and can request additional decrements when a tag-filter matches, or
  - a hook that modifies the `decrementsPerTick` value the reducer applies.
- **Implementation sketch:** Add `modifyStatusTickAmount` to `HookSignatures` with args `{ unit: Unit; statusTypeId: StatusTypeId; statusTags: ReadonlySet<StatusTag>; baseAmount: number }` and additive chain (default baseAmount 1). The status_tick reducer reads the chain product and decrements duration / stack count by that amount per tick. Equipment contributor: Purifier emits a handler that returns `baseAmount + 1` when the status's tags include `'negative'`. Care: custom-trigger statuses (Burn, Vulnerable) need to decide whether they participate — Burn ticks by stack count, not duration, so Purifier doubling Burn's tick effectively doubles the per-stack drain. Spec-aligned, but worth confirming with Chris during the implementation session.
- **Size:** small (after the design decision on custom-trigger interaction; otherwise medium if that decision needs a discussion).
- **Related:** [`src/engine/actions/reducers.ts`](src/engine/actions/reducers.ts) (`reduceStatusTick`), [`src/content/statuses/burn.ts`](src/content/statuses/burn.ts), [`src/content/statuses/vulnerable.ts`](src/content/statuses/vulnerable.ts), ADR-0024, ADR-0030.

### Item 9 — Damage-to-MP-drain conversion

- **Status:** not implemented
- **Gap:** No end-of-damage-pipeline transform hook. The pipeline finalizes with `clampMinMax` then `finalize`; nothing post-finalize transforms the result. The closest existing hook is `onDamageDealt` (attacker-stage), but that fires *before* resistance / variance / crit and can't see the final damage.
- **Implementation sketch:** Two options.
  (a) Add `onFinalDamage` (or fold into `onDamageDealt` a "post-finalize" sub-stage) that fires on the attacker's hooks after `finalize`. Handlers see the final integer damage and may emit system actions (here: `system_mp_drain` taking 10% of the final damage from the target, granting it to the attacker). Bypasses the pipeline's "no further transforms after finalize" invariant by being an emission-only hook, not a transform hook.
  (b) Reuse the reaction surface — fire `onActionTargeted` against the *attacker's* hooks too (currently only target-side), letting equipment register a "after I deal damage, drain MP" handler. Adds a hook fan-out cost.
  Recommend (a). Also requires a new system action type `system_mp_drain` (analogous to `system_ct_push`) with payload `{ source, target, amount }` and a reducer branch that floors at 0 (target's current MP) and caps at 100 (attacker's max MP — needs the maxMp work from item 6). Gating on KO'd targets and the existing chain-depth cap covers safety.
- **Size:** small (assuming maxMp lands as part of item 6; otherwise add the MP cap logic here).
- **Related:** [`src/engine/damage/handlers.ts`](src/engine/damage/handlers.ts) (finalize), [`src/engine/types/action.ts`](src/engine/types/action.ts) (system_* action types).

### Item 10 — Resistance shifts on equip

- **Status:** not implemented
- **Gap:** `target.resistances` is a `ReadonlyMap<DamageTag, number>` set at unit-construction time and **never modified by hooks**. [`composeResistance`](src/engine/damage/handlers.ts:566) reads the map directly; [`lookupStatusResistance`](src/engine/status/chance.ts:182) does the same. `modifyStatQuery` covers the StatName union (spd, pa, ma, maxHp, brave, faith, crit_chance, crit_multiplier) — resistance values are not in that union and do not flow through the hook chain. Equipment cannot currently shift resistance.
- **Implementation sketch:** Add `modifyResistance` to `HookSignatures` with args `{ unit: Unit; tag: DamageTag; baseValue: number }`. Additive chain (resistance is per-tag integer; sign-mixed shifts compose naturally). Both consumer sites — `composeResistance` and `lookupStatusResistance` — route through the new chain. Equipment contributor extension: items declare `resistanceMods?: ReadonlyMap<DamageTag, number>` and emit one handler per entry. Wand of Depths's `{ lightning: +50, fire: -50 }` becomes mechanical. Same shape covers the wand-on-hit "apply +25 Fire / -25 Lightning to target" effect once a status that calls into `modifyResistance` ships (or — simpler — a stack-independent status whose magnitude varies by tag, applied as a system action; this is content work, not engine work).
- **Size:** small.
- **Related:** [`src/engine/damage/handlers.ts:566`](src/engine/damage/handlers.ts:566), [`src/engine/status/chance.ts:182`](src/engine/status/chance.ts:182), [`src/engine/types/unit.ts:51`](src/engine/types/unit.ts:51), ADR-0015 (signed-max resistance composition).

### Item 11 — Per-tag status resistance modifiers

- **Status:** partial / not implemented (depending on framing)
- **Gap:** [`modifyStatusApplicationChance`](src/engine/hooks/hooks.ts:125) fires against the **caster's** hooks per its signature comment and the runner ([`runners.ts:111`](src/engine/hooks/runners.ts:111)). Pointy Hat (+50 Silence resist on the wearer) and Focus Band (+25 to all negative-tag status resistance on the wearer) need a target-side hook that reads the in-flight `statusType` and modifies the application chance based on the wearer's gear. The current shape can't express this — it fires against the wrong unit.
- **Implementation sketch:** Two cleaner options.
  (a) **Add a target-side variant** `modifyIncomingStatusApplicationChance` that fires against the target's hooks, with the same args shape but `unit: Unit` is the target. Both caster-side (Earth Communion) and target-side (Pointy Hat, Focus Band) hooks compose multiplicatively; the apply chance is `formula × ∏casterHooks × ∏targetHooks`.
  (b) **Lean on Item 10's `modifyResistance`** — Pointy Hat is "resistance to silence specifically." The status's `resistanceTag` (currently single-tag at `lookupStatusResistance`) routes through `modifyResistance` for an additive composition. Focus Band's "+25 to all negative-tag status resistance" needs a hook that conditions on the status's *tag set*, not its `resistanceTag`. So (b) handles Pointy Hat cleanly but not Focus Band; Focus Band still needs (a) or a compound shape (a status's effective resistance composes a per-status-tag modifier from the target's gear).
  Recommend (a) — single hook surface, handles both items, target-side composition is the natural place for "resistance gear."
- **Size:** small (after design decision; the runner + signature change is straightforward, but the spec for Focus Band's "all negative-tag" pattern needs a tag-set test rather than a single-tag check).
- **Related:** [`src/engine/status/chance.ts`](src/engine/status/chance.ts), [`src/engine/hooks/hooks.ts:125`](src/engine/hooks/hooks.ts:125).

### Item 12 — Auto-statuses on equip

- **Status:** implemented
- **Gap:** None. [`applyEquipmentStatusGrants`](src/engine/setup/create-initial-state.ts:160) walks each equipped item, applies each `statusGrants` entry as a regular `applyStatus` call with `sourceKind: 'equipment'`. The status instance carries the equipment provenance and is immune to in-battle removal until the equipment changes. Boots of Haste already lights this up. The same mechanism cleanly supports Auto-Shell, Auto-Regen, etc. — content-side authoring only.
- **Implementation sketch:** N/A — the substrate is there. Content-update session adds the new statuses (Shell with `modifyHitChance × 0.5` on incoming magical, etc.) and wires `statusGrants: ['shell']` into Sorcerer's Robe.
- **Caveat:** The current path applies statuses **directly into state** via `applyStatus` rather than as `apply_status` actions in the action log. The spec (deployment-phase architecture, item 17 below) calls for log entries tagged `source: 'pre_battle_equipment'` so replay reconstructs from the log. Item 17 covers this divergence; the substrate is in place but the action-log integration is the open work.
- **Size:** trivial (verification — content session adds the new statuses).
- **Related:** [`src/engine/setup/create-initial-state.ts:160`](src/engine/setup/create-initial-state.ts:160), ADR-0028.

---

## Section B — Battle flow / engine state

### Item 13 — Initial CT randomization

- **Status:** partial (variant exists; not the right one for [0, 20] uniform)
- **Gap:** The default ruleset has `initialCT: { kind: 'fixed', value: 0 }` ([`default.ts:141`](src/content/rulesets/default.ts:141)). The variant `'speed_with_variance'` exists ([`ruleset.ts:161`](src/engine/types/ruleset.ts:161), [`create-initial-state.ts:226`](src/engine/setup/create-initial-state.ts:226)) but produces `clamp(speed × speedFactor + offset, 0, 99)` — centered on Speed × factor. The spec wants **uniform integer in [0, 20] per unit** independent of Speed.
  - You *could* hack `speed_with_variance` to approximate this with `speedFactor: 0, variancePct: 40`, but the resulting distribution is `(v - 0.5) × 40 + 0` clamped at 0 → effectively triangular-ish around 10, not a clean uniform [0, 20].
- **Implementation sketch:** Add a third variant `{ kind: 'uniform_int', min: number, max: number }` to `RulesetInitialCT`. The resolver hashes `(masterSeed, unitId)` into a unit float (existing `unitFloatFromKey` machinery), maps to the integer range, returns. Switch the default ruleset's `initialCT` to `{ kind: 'uniform_int', min: 0, max: 20 }`. Existing tests using `'fixed'` keep working (the variant is preserved). Tests for the new variant assert (a) determinism by `(masterSeed, unitId)` and (b) range [min, max] inclusive.
- **Size:** small (variant + resolver branch + ruleset switch + tests; ~25 lines + tests).
- **Related:** [`src/engine/types/ruleset.ts:161`](src/engine/types/ruleset.ts:161), [`src/engine/setup/create-initial-state.ts:226`](src/engine/setup/create-initial-state.ts:226), [`src/content/rulesets/default.ts:141`](src/content/rulesets/default.ts:141), [`src/engine/setup/initial-ct-variance.test.ts`](src/engine/setup/initial-ct-variance.test.ts).

### Item 14 — Tile property: deploymentZone

- **Status:** partial (free-form `properties` works; structured field doesn't exist)
- **Gap:** The Tile schema ([`tile.ts:13`](src/engine/types/tile.ts:13)) carries `properties: ReadonlyArray<TileProperty>` where `TileProperty = string` — a free-form string union. You could encode deployment zones as `properties: ['deployment:team_a']` today and have the deployment phase parse them, but that doesn't match the spec's structured `deploymentZone: 'team_a' | 'team_b' | null` shape. The deployment-phase architecture treats the field as a first-class data point read by zone validation and rendering.
- **Implementation sketch:** Two options.
  (a) **Structured field on Tile** — add `deploymentZone?: TeamId | null` to the Tile interface. Map authors set it explicitly. Read sites: deployment-phase validation (each placement's tile has the matching team), deployment-phase UI rendering (zone highlights), map validation at battle creation (each map carries ≥ N zone tiles per team).
  (b) **Convention on `properties`** — keep the schema as-is and document the `deployment:team_X` naming convention. Cheaper; but reads into the deployment phase need a parser, and the type system can't enforce "one zone per tile."
  Recommend (a). The schema change is minor; the type-system enforcement and authoring clarity are the wins. Net structural change is one optional field, not a refactor.
- **Size:** trivial (the field add); small (when the deployment-phase consumers — validation, zone iteration — get authored alongside the field).
- **Related:** [`src/engine/types/tile.ts:13`](src/engine/types/tile.ts:13), `docs/twentyOneDesign/deployment-phase-architecture.md`.

### Item 15 — Jump-over-water movement

- **Status:** not implemented
- **Gap:** [`getLegalMoves`](src/engine/map/pathfinding.ts:132) iterates `CARDINAL_DELTAS` (4 unit-distance moves) and runs Dijkstra over them. There's no special-case for "leap over one water tile to a land tile at 2 move points." The current canStep gate would reject a step *into* a water tile when `canEnter` doesn't include it; even with `canEnter: water` the step would cost 2-3 per the terrain costs and require the pathfinder to walk into the water. A leap primitive doesn't exist.
- **Implementation sketch:** During Dijkstra expansion, in addition to the four cardinal one-step moves, generate four cardinal *two-step leaps* whose intermediate tile is water (any depth) and whose destination is land. Each leap costs 2 move points (treats the leaped-over tile as land cost). Constraint: `unit.jump >= leap_height_delta` where the relevant elevation differential is destination − origin (the leaped-over tile's elevation is irrelevant; the unit doesn't land there). Cardinal direction only (no diagonal). Re-uses the existing `friendlyPassThrough`, occupant, and elevation logic at the destination. The leap is generated only when (a) the immediate-neighbor tile in that direction is water (elev 0 or 1), (b) the second tile in that direction exists, is in-bounds, and is land, (c) the destination's `canStep` condition would normally pass for a direct adjacency.
- **Caveat:** The spec says "single cardinal leap over 1 water tile in a turn." This implies a per-turn cap on leaps — the current pathfinder doesn't track per-turn counters because Dijkstra is path-cost based, not action-budget based. If "single leap per turn" is a hard rule, the pathfinder needs a state extension to track whether the path includes a leap (and reject paths with two leaps). Recommend confirming with Chris whether the cap is "one per turn" (requires path-state) or "one per move action" (path-state is what prevents two-leap paths from emerging from Dijkstra anyway). The current architecture handles the second interpretation cleanly; the first needs more thought.
- **Size:** small (the leap generation; the per-turn cap question may push it to medium if path-state is required).
- **Related:** [`src/engine/map/pathfinding.ts`](src/engine/map/pathfinding.ts), `docs/twentyOneDesign/river-ridge.md`, ADR-0006.

### Item 16 — Fall damage on knockback into water

- **Status:** implemented
- **Gap:** None. [`applyKnockback`](src/engine/map/knockback.ts:66) lands the unit on the **highest tile ≤ currentElevation** at the destination column ([`pickLandingTile`](src/engine/map/knockback.ts:143)). Water tiles (elev 0 or 1) qualify naturally: a unit knocked off the ridge at elev 7 onto a column whose highest tile is shallow water (elev 1) lands at elev 1 with `dropDistance = 6` and a `system_damage` action for `10 × 6 = 60` damage. Pathfinding from the water tile then uses the unit's `canEnter` set; the unit can't escape into water without Walk-on-Water or Float, which is correct per the spec ("escape on subsequent turns at standard water-tile cost"). The `canStep` check operates on destination terrain, not source — so a unit forcibly placed on water by knockback can still pathfind *off* it when surrounding tiles are land.
- **Implementation sketch:** N/A.
- **Size:** trivial (verification — add an integration test exercising the knockback-into-water + ridge-elev-7-into-shallow-water case).
- **Related:** [`src/engine/map/knockback.ts:143`](src/engine/map/knockback.ts:143), ADR-0026.

### Item 17 — Pre-battle equipment auto-status as action-log entries

- **Status:** not implemented (current path bypasses the action log)
- **Gap:** [`applyEquipmentStatusGrants`](src/engine/setup/create-initial-state.ts:160) calls [`applyStatus`](src/engine/status/apply.ts) directly during `createInitialState`. The result is mutated state at sequence number 0 — no `apply_status` action is committed; no entry lands in the action log. This contradicts the deployment-phase architecture's "auto-statuses apply at battle start as normal `apply_status` actions in the action log, marked with a `source: 'pre_battle_equipment'` tag for replay and attribution."
  - Replay determinism is preserved by the current path (the same equipment produces the same starting state), but the *attribution* — "this Haste came from Boots of Haste, applied at battle start" — isn't captured in the log.
  - The system_apply_status action exists ([`action.ts:214`](src/engine/types/action.ts:214)) and could be the carrier. The work is rerouting the `createInitialState` path to *enqueue* these actions and have them committed against the empty initial state, rather than directly mutating.
- **Implementation sketch:** Two options.
  (a) **Enqueue at setup time** — `createInitialState` returns the post-mutation state but **also** appends `system_apply_status` actions to `state.actionLog` (with synthetic envelopes carrying `tick: 0, ct: 0`, source: 'system', and a `source: 'pre_battle_equipment'` extension on the payload). Replay tooling reads the log and reconstructs the initial state by replaying these actions against a "pre-equipment" baseline.
  (b) **Run the actions through the reducer** — `createInitialState` returns the baseline state without the auto-statuses applied; the orchestrator then runs each `system_apply_status` action through `commitAction` to land them in both state and log. This is the more architecturally consistent path (per CLAUDE ground rule 3: "every change is an Action through the reducer") but requires the orchestrator to drive a "pre-battle setup" pass before the first turn fires.
  Recommend (b). It aligns with the ground rule, makes the action log the single source of truth from sequence 0 forward, and matches the deployment-phase doc's intent. Adds a `SystemApplyStatusPayload.source` extension for `'pre_battle_equipment'` (currently the payload doesn't carry source attribution; the source lives on the StatusInstance after application).
- **Caveat:** Initial CT randomization (item 13) and the new `uniform_int` rolls also need log treatment — the initial CT for each unit is currently set on the Unit struct directly. If pre-battle setup runs through the reducer, initial CT could be a `system_set_ct` action too. This snowballs into "battle start is a sequence of system actions, not a state mutation." The roadmap should consider this as one batched session.
- **Size:** small (the rerouting); medium (if it batches with the initial-CT log treatment + orchestrator change).
- **Related:** [`src/engine/setup/create-initial-state.ts:160`](src/engine/setup/create-initial-state.ts:160), [`src/engine/types/action.ts:214`](src/engine/types/action.ts:214), `docs/twentyOneDesign/deployment-phase-architecture.md`, ADR-0028.

---

## Section C — Catalog / content infrastructure

### Item 18 — Availability filter on abilities and items

- **Status:** not implemented
- **Gap:** No `availability` field on `AbilityDefinition` or `ItemDefinition`. The catalog has no validation requiring it. Team builder integration (when it lands) has nothing to read. Search confirms the only `availability` token in the source tree is an unrelated comment in `src/ui/action-menu.tsx`.
- **Implementation sketch:** Three things land together:
  (a) Add `availability: 'available' | 'hidden'` (no optional — required) to `AbilityCommon` (in `ability-definition.ts`) and `EquipmentBase` (in `item-definition.ts`). Engine semantics unchanged; the field is metadata.
  (b) Add a catalog-load validation that fails loud if any registered ability or item omits the field. The catalog currently validates structural completeness ([`catalog/registry.ts`](src/engine/catalog/registry.ts)); add an `availability` check there.
  (c) Update every existing content file (~36 abilities + 5 items) to declare `availability`. Per the spec: `float`, `fly`, `discharge_strike` get `'hidden'`; `iron_helm`, `iron_mail`, `strength_ring` get `'hidden'`; everything else gets `'available'`. Test fixtures that author abilities inline need to set the field too — `abilities/test-fixtures.ts` is the chokepoint.
  (d) The team builder consumes the field downstream — that's UI work, not engine work. No engine consumer is needed in this session.
- **Size:** small.
- **Related:** [`src/engine/catalog/definitions/ability-definition.ts`](src/engine/catalog/definitions/ability-definition.ts), [`src/engine/catalog/definitions/item-definition.ts`](src/engine/catalog/definitions/item-definition.ts), [`src/engine/catalog/registry.ts`](src/engine/catalog/registry.ts), all of `src/content/abilities/` and `src/content/items/`.

---

## Section D — Battle UI prerequisites (lighter-touch)

### Item 19 — Forecast/projection contract

- **Notes (not sized):** The engine's projection substrate is in good shape for what the UI's forecast pipeline needs.
  - **(a) Damage range with min/expected/max:** The AI's `projectExpectedDamage` ([`src/ai/projection.ts`](src/ai/projection.ts)) gives expected. Min/max can be computed by running the same projection with `variance.min` / `variance.max` substituted directly (the projection variant currently uses midpoint). For axe variance [0.9, 1.3], the UI wants both bounds — a clean small extension to the projection API: `projectDamageRange(...)` returning `{ min, expected, max }`. The existing handlers are already factored to make this easy.
  - **(b) Status application probabilities including per-target resistances:** [`rollStatusChance`](src/engine/status/chance.ts) computes the post-modifier chance and returns it as part of `StatusChanceResult`. Calling the formula in projection mode (no roll, just the chance) requires a new entry point — the existing function is roll-driven and returns `applied: boolean`. The chance computation is pure; extracting it into a `computeStatusChance` (returns just the chance fraction) is mechanical. Per-target resistances flow through naturally.
  - **(c) AoE per-target preview:** Per-target resolution exists in `resolveAbilityTargets`; the UI needs the *list* of affected positions and per-target outcomes without committing. Pure validation is in place. No new substrate; the API surface needs a "preview" entry point that runs projection across each target and returns the per-target damage / status preview.
  - **(d) Reaction-trigger preview where determinable:** Reactions fire from `runOnActionTargeted` — the trigger's gating is Brave-rolled per reaction. The UI can know *which* reactions a target has equipped (read `target.loadout.reaction`), and *which* would gate-pass a given incoming action (consult the reaction's `reactionFields.triggerCondition` — already used by AI tier-2 scoring). What's not determinable without rolling is whether Brave triggers; the UI showing "Counter (~70% trigger)" is the right level of disclosure.
  - **No engine gaps that block the UI session.** The work is mostly **API surface** — pulling forecast-friendly entry points out of existing pure functions. Implementation strategy: each forecast view (target hover, AoE preview, reaction risk) gets a dedicated query function in a new `src/engine/forecast/` module that composes existing primitives. Implementer can start there.

### Item 20 — Action log persistence and shape

- **Notes (not sized):** The action log is structurally rich and should support the UI's panel + future replay needs.
  - **Envelope captures everything load-bearing:** sequence number, source, actor id (where relevant), `tick / ct` timestamp, seed, parent action seq, chain depth, isReaction flag. ([`action.ts:317-332`](src/engine/types/action.ts:317))
  - **Per-action outcomes capture per-target results:** UseAbility records `perTargetResults: ReadonlyArray<AbilityTargetResult>` with hit, damage, healing, statusesApplied. The log entry preserves the resolved outcome — replay tools can re-render from the log without re-running the pipeline.
  - **System actions carry provenance:** `system_damage` has `SystemDamageSource` discriminating `status_tick / falling / ability_self_cost`. `system_heal` has `SystemHealSource`. `system_ct_push` has `SystemCtPushSource`. `system_apply_status` does **not** currently carry an analogous source field — Item 17 above flags this gap; landing it as part of the pre-battle-equipment-via-reducer work covers it.
  - **Status application outcomes are recorded:** `StatusApplicationOutcome` carries the result (applied, refreshed, stack-incremented, etc.). The log preserves this even when the status itself ticks down later.
  - **Charged action lifecycle:** `use_ability` records `chargedActionId?` when a charge is spawned; `charged_action_resolve` records its own per-target results. Together they reconstruct the full lifecycle in the log.
  - **Identifiable gaps for the UI session:**
    - The log carries the StatusInstance source on apply, but a UI panel rendering "Sparky took 5 damage from Burn (applied by Brunhilde, turn 3)" needs a backreference from the system_damage's status_tick source to the apply action's seq number. The current shape carries `statusTypeId` on the source but not the originating apply action's seq. Could be added as `appliedAtSeq?: number` on `SystemDamageSource.status_tick` (and analogous on `system_heal`).
    - Move actions record `pathTaken: ReadonlyArray<Position>`. UI replay-by-step-animation reads this. No gap.
    - There's no top-level `chargedActions` snapshot per action — the UI's projection column wants "what charges are in flight at this moment"; that requires reading state.chargedActions, which isn't preserved per-tick on the log. For replay-from-log, you'd reconstruct chargedActions by walking the log. That's expensive for a long-running battle but tractable. **Recommend the UI session decide whether to materialize a per-action snapshot or accept O(N) reconstruction cost.**
    - No `globalEffects` snapshots either; same comment.
  - **No engine gaps that block the UI session.** The shape is sufficient for the panel and for reasonable replay; the open question is whether the UI wants per-action snapshots of `chargedActions / globalEffects` to avoid reconstruction. That's a UI-session decision, not an engine prerequisite.

---

## Section E — Surprises and flags

These are observations beyond the audit list that the next session-planner should know about.

### E1. crit_chance is **not** clamped to [0, 100] in the engine

The spec calls for "engine-clamped to [0, 100]" so multi-stack Crit_modifier doesn't roll into undefined territory. Current behavior: [`critRoll`](src/engine/damage/handlers.ts:376) reads `crit_chance` through `runModifyStatQuery`, short-circuits when `crit_chance <= 0`, then rolls `r >= crit_chance / 100`. If `crit_chance > 100` (e.g., 5 base + 6×Static Embrace stacks at +20 each = 125), `crit_chance / 100 = 1.25` and the roll **always** crits. There is no upper clamp.

**Recommendation:** Land the clamp inside `critRoll` (`const cc = Math.max(0, Math.min(100, runModifyStatQuery(...)))`). Trivial — about 2 lines + a test that verifies stacking 6× Crit_modifier still produces 100% crit, not undefined behavior. Per the brief, this is engine work that the audit flags rather than fixes.

### E2. `composeResistance` has a 100 cap that pre-empts ADR-0020 absorption

[`resistanceCheck`](src/engine/damage/handlers.ts:308) caps the composed resistance at 100 (immune, factor 0×) per the in-line comment "Absorption deferred (per ADR-0020)." The full BMG scale extends to resistance 200 (full absorption — damage flips to healing). v1 has no content with resistance > 100, but Wand of Depths (+50 Lightning, item 10) plus a Lightning-resistant baseline could push past 100. The cap stays correct as long as no equipment or status pushes a unit's effective resistance past 100; once that's possible, the cap should be lifted and the absorption path lit up. **Worth re-checking when item 10's resistance shifts ship.**

### E3. `pa_factor` for status formulas is `NotYetImplementedError`

[`rollStatusChance`](src/engine/status/chance.ts:147) and [`rollAbilityChance`](src/engine/status/chance.ts:256) both throw `NotYetImplementedError` when `factors.pa` is set. No content currently asks for it; the spec doesn't require it. But this is a "first PA-using consumer ships the formula" thunk. **Watch for this if any Knight Battle Skill content gets re-tuned to use `pa_factor` instead of `brave_factor`.**

### E4. `equipmentContributionsFor` only handles `modifyStatQuery`

[`equipmentContributionsFor`](src/engine/items/contributions.ts:46) early-returns when `hookName !== 'modifyStatQuery'`. Items 1, 5, 7, 8, 10, 11 all need to extend this with new contributions. The contributor is small and easy to extend, but the pattern is "every new equipment-driven hook adds a branch in this generator." Consider whether an extension pattern (per-hook contributors registered against the contributor module) is worth it before the count hits 5+ branches.

### E5. The Rasp Pendant needs maxMp

Item 9's MP-drain needs a target-side MP cap (max 100, target's max MP) — currently MP is a flat `vitals.mp` integer with no `maxMpBase`. Item 6 surfaces this gap too. Recommend bundling Rasp Pendant under the maxMp introduction.

### E6. Default Brave 100 vs. Brave 70 reaction trigger feel

The spec changes default Brave to 70, which makes every reaction probabilistic. The reaction roll path ([`runOnActionTargeted`](src/engine/hooks/runners.ts:267)) is implemented and uses the per-action seed sub-stream. Tests written assuming Brave 100 deterministic triggering will now fire ~70% of the time. The brief calls out this test-reconciliation work explicitly — strategy choices are documented in the test summary section below. **No engine gap here; just calibration awareness.**

### E7. Long Sword equip across all classes

The equipment doc says Long Sword has no class restriction, so a Mage can equip Long Sword + Wizard's Robe. Per [`createInitialState`'s `validateEquipmentPlacement`](src/engine/setup/create-initial-state.ts:129), the validation is per-class via `cls.equipmentSlots[slot]`, not per-item-class-restriction. Class-locked equipment is currently enforced **only by class.equipmentSlots** ("can a Mage equip into rightHand?" — yes, all classes equip all slots in v1). Per-item `classRestriction` field doesn't exist on `ItemDefinition`. **Spec is permissive (any class can equip Long Sword), so this is fine; but when Knight-only items (Soldier's Leathers, Steel Helm, etc.) ship, item-side class restrictions become net-new authoring + validation work.** Sized small: add `classRestriction?: ReadonlyArray<ClassId>` to `EquipmentBase` and a check in `validateEquipmentPlacement`.

### E8. Pre-existing TS strict-mode test errors (carry-forward from session 20b handoff)

`tsc -b --noEmit` surfaces test-only errors that pass through Vitest's loose mode. Prior handoff flagged these as deferred. Not blocking but worth scheduling.

---

## Section F — Test reconciliation summary

### Pre-baseline test state

`npm test` against the pre-reconciliation tree: **557 passing across 46 files**. Captured before any edits; matches the session-20b handoff number.

### Files modified

**Content** (16 files):

- [`src/content/battles/demo.ts`](src/content/battles/demo.ts) — all five class baseStats updated to L25 spec values; Brave/Faith 100/80 → 70/70; vitals filled to maxHpBase / mp; comments refreshed.
- [`src/content/items/long-sword.ts`](src/content/items/long-sword.ts) — WP 4 → 8.
- [`src/content/abilities/earth-strike.ts`](src/content/abilities/earth-strike.ts) — `power_coefficient` 6 → 8.
- [`src/content/abilities/earth-quake.ts`](src/content/abilities/earth-quake.ts) — 6 → 7.
- [`src/content/abilities/earth-cataclysm.ts`](src/content/abilities/earth-cataclysm.ts) — 10 → 12.
- [`src/content/abilities/water-strike.ts`](src/content/abilities/water-strike.ts) — 5 → 8.
- [`src/content/abilities/tidal-wave.ts`](src/content/abilities/tidal-wave.ts) — 5 → 7.
- [`src/content/abilities/maelstrom.ts`](src/content/abilities/maelstrom.ts) — 7 → 12.
- [`src/content/abilities/fire-strike.ts`](src/content/abilities/fire-strike.ts) — 5 → 8.
- [`src/content/abilities/fire-storm.ts`](src/content/abilities/fire-storm.ts) — 4 → 6.
- [`src/content/abilities/flame-lance.ts`](src/content/abilities/flame-lance.ts) — 6 → 10.
- [`src/content/abilities/chain-lightning.ts`](src/content/abilities/chain-lightning.ts) — 8 → 9.
- [`src/content/abilities/earth-resilience.ts`](src/content/abilities/earth-resilience.ts) — `baseCost` 2 → 1.
- [`src/content/abilities/float.ts`](src/content/abilities/float.ts) — `baseCost` 2 → 1.
- [`src/content/abilities/fly.ts`](src/content/abilities/fly.ts) — `baseCost` 3 → 2.
- [`src/content/classes/knight.ts`](src/content/classes/knight.ts) — `freeAbilities` extended with `counter`, `damage_reduction`.
- [`src/content/classes/earth-mage.ts`](src/content/classes/earth-mage.ts) — `freeAbilities` set to `earth_resilience`, `earth_communion`.
- [`src/content/classes/water-mage.ts`](src/content/classes/water-mage.ts) — `freeAbilities` set to `tidal_pull`, `flow_state`.
- [`src/content/classes/fire-mage.ts`](src/content/classes/fire-mage.ts) — `freeAbilities` extended with `smolder`.
- (`src/content/classes/lightning-mage.ts` unchanged per spec.)

**Tests** (2 files; 4 stale-assertion updates):

- [`src/engine/actions/session-17c-integration.test.ts`](src/engine/actions/session-17c-integration.test.ts) — two assertions for Long Sword WP (4 → 8) recomputed: `baseDamage` 20 → 40 and 30 → 60; variance band 18-22 → 36-44; test name updated.
- [`src/engine/actions/session-20-integration.test.ts`](src/engine/actions/session-20-integration.test.ts) — two assertions for Chain Lightning's `power_coefficient` (8 → 9) recomputed: targetCount-1 expected 64 → 72; targetCount-3 expected 80 → 88; test names + comments updated.

### Updates not applied (carrying flags forward)

- **Crit_chance clamp test** (brief item 9): the spec says `crit_chance` is engine-clamped to [0, 100]. Verified with the audit (E1 above): the engine has **no clamp**. Per the brief instructions, the audit flags this rather than fixing the engine; no test added in this session because asserting a clamp that doesn't exist would be a known-failing test. Recommend adding both the engine clamp (~2 lines) and the test together as part of Cluster 1's stabilization work.
- **Brave-100 → Brave-70 reaction tests**: not needed in this session. Engine test fixtures (`src/engine/ct/test-fixtures.ts`) default to `brave: 100`, which preserves every existing reaction-trigger test as deterministic. The Brave 70 change lives only on `demo.ts` unit baseStats — it shifts the AI-vs-greedy integration test (see below) but no per-feature reaction test was touched. **Strategy:** if a future test needs to assert reaction-trigger probability under Brave 70, the existing `unitFloatFromSeed` infrastructure makes a seeded-RNG assertion straightforward; the test fixtures' Brave-100 default preserves the deterministic-trigger path. No tests required edits.

### Final test state

`npm test`: **555 passing, 2 failing across 46 files.**

- **Both failures are in [`src/app/controllers/ai-controller.integration.test.ts`](src/app/controllers/ai-controller.integration.test.ts):**
  - `every battle terminates within a sane step bound` (failing on at least one seed/team-assignment combo)
  - `basic AI wins at least as many matchups as greedy across both team assignments`
- **Both fail with the same root error:** `DemoOrchestrator: commit failed for move by "blue_lightning_mage": can't move`
- **Per brief instruction**, this is left red rather than fixed because it surfaces a real engine-vs-AI integration gap (see E9 below). Tests are unmodified.

### Surprises encountered during reconciliation

#### E9 (new) — `validateAction` is pure but `onActionAttempted` runs only at commit; AI doesn't pre-filter

**Discovered by the AI controller test failure above.** The integration is:

- [`validateAction`](src/engine/actions/validate.ts) is intentionally pure and side-effect-free; its file header explicitly says `onActionAttempted` hooks fire in `commitAction`, not in validation.
- The basic AI ([`src/ai/basic.ts:860`](src/ai/basic.ts:860), [:1037](src/ai/basic.ts:1037), [:1054](src/ai/basic.ts:1054), [:1156](src/ai/basic.ts:1156)) calls `validateAction` to filter proposed actions, but doesn't simulate the `onActionAttempted` chain.
- A unit afflicted with Don't Move (or Don't Act, Stop, etc.) passes `validateAction`'s budget / range / target checks but gets blocked at `commitAction` time.
- The `DemoOrchestrator` ([`src/app/demo/orchestrator.ts:134`](src/app/demo/orchestrator.ts:134)) treats commit failure as a fatal error and throws.

**Why now:** Earth Cataclysm is now power 12 (was 10) with the same 40% Don't Move rider. With MA 12 (was 8) and Faith 0.49 (was 0.64), the application formula `0.40 × Faith × MA_factor × resistance` lands the status more often (~41% vs ~27%). The AI was clearing this pre-tuning by surviving turns; with the new tuning, Don't Move lands often enough to expose the AI's missing pre-filter on its next move proposal.

**Recommendation:** Two paths.
  (a) **AI side**: have the AI call `runOnActionAttempted` in dry-run mode (with `isReaction: false`) before proposing an action. Filter blocked actions out of the candidate list. This is the cleaner long-term fix — same pattern the AI already uses for `validateAction`.
  (b) **Orchestrator side**: when `commitAction` fails for a unit afflicted with a known-blocking status, fall back to a default action (Wait) rather than throwing. This is a brittle workaround and changes the AI's apparent behavior; not recommended.

Recommend (a). Sized small (extend the AI's candidate-filter pass with one additional pure check). Could land as part of Cluster 1 (stabilization & calibration baseline) alongside the crit_chance clamp.

**Test-side action:** the integration test stays red until (a) is implemented. The other 555 tests are green and the engine substrate is healthy; this is a pre-existing issue surfaced by tuning, not regression.

#### E10 (new) — Test-fixture Brave-100 default insulates reaction tests from the calibration shift

[`src/engine/ct/test-fixtures.ts`'s `brave: overrides.brave ?? 100`](src/engine/ct/test-fixtures.ts:70) means engine-level reaction tests stay on the deterministic-trigger path even after demo.ts moves to Brave 70. **Pro:** no per-test reconciliation work. **Con:** none of the existing tests exercise the probabilistic-trigger path. When the Brave 70 reaction-trigger feel becomes a tuning question (open item in the spec), this is the place to start adding probabilistic-trigger coverage with seeded RNG. Not work for this session; flag for later.

---

---

## Section G — Recommended session sequencing

Sized clusters, ordered by dependency and value-density. Each cluster is one session unless noted. Numbers below reference items in this report.

### Cluster 1 — Stabilization & calibration baseline (this session)

- Test reconciliation per the brief (in flight in this session).
- Crit_chance clamp (E1) — trivial; bundle here so the test for it lands with the rest.

### Cluster 2 — Equipment substrate, wave A (high-leverage, additive)

- Item 18: availability tag (small) — unblocks team-builder UI work.
- Item 14: deploymentZone tile field (trivial / small) — unblocks deployment phase work.
- Item 13: initial CT randomization variant (small) — unblocks deployment phase work.

These three travel naturally together: each is small and additive, all support the deployment / team-builder layer. Together, a single session.

### Cluster 3 — Equipment substrate, wave B (hook surface expansion)

- Item 5: modifyMpCost hook (small).
- Item 7: modifyActionSpeed hook (small).
- Item 10: modifyResistance hook (small).
- Item 11: target-side modifyIncomingStatusApplicationChance hook (small).

Four new hook surfaces, all small individually; together one full session. Land them as a batch so the equipment contributor's "branch per hook" expansion happens in one focused pass. This unlocks roughly half the equipment doc's items: Staff of Power / Staff of Abundance (5, 7), Wand of Depths / Wand of Deepwood (7, 10, on-hit shifts), Pointy Hat / Focus Band (11), Capacitor Ring / War Plate / Guard Cap (10).

### Cluster 4 — Equipment substrate, wave C (structural / spanning hooks)

- Item 1: bucket capacity hook (small).
- Item 6: maxMp introduction (medium) — adds a stat, touches placement / fill / projection.
- Item 8: status tickdown rate modifier (small after design call on custom-trigger interaction).

Roughly one session. Item 6 is the time-dominating piece; the others are small but tightly related to its pattern. Item 6 unblocks Wizard's Robe, Sorcerer's Robe, Silvered Vest, Pointy Hat MP boost, Magus Crown's potential alternate -25% MP cost variant. Item 1 unblocks Steel Helm / Augmentor / Magus Crown. Item 8 unblocks Purifier.

### Cluster 5 — Equipment substrate, wave D (proc / drain mechanisms)

- Item 4: spell-cast riders on weapons (medium).
- Item 9: damage-to-MP-drain conversion (small, depends on item 6's maxMp).

Roughly one session. Both are end-of-pipeline / proc-style mechanisms with shared substrate; 9 depends on 6's maxMp landing. Unlocks Bolt Hammer (4), Flametongue Burn proc (4 with content), Rasp Pendant (9).

### Cluster 6 — Map mechanics & deployment-phase logged actions

- Item 15: jump-over-water pathfinding (small/medium, depending on per-turn-cap design).
- Item 17: pre-battle equipment auto-status as logged actions (small, possibly medium if batched with initial CT log treatment).
- Item 16: knockback into water verification test (trivial, bundle here).

Roughly one session. River Ridge map authoring is downstream content work that lands once these are in place. Item 17 is a clean architecture cleanup that aligns the engine with the deployment-phase doc's intent.

### Independent / sequencing-flexible

- E7 (per-item classRestriction): small. Lands when the first class-locked item ships in content; could be a 30-minute add to a content session rather than its own session.

### Notes on parallelization

Clusters 2 and 3 are independent. Cluster 4 is mostly independent of 2/3, but item 6's maxMp work touches `BaseStats` which any new content might want to reference; landing 4 before more equipment content is authored avoids retrofitting. Cluster 5 depends on 4 (item 6); Cluster 6 is independent.

---
