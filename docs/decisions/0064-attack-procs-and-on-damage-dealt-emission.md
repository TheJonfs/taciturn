## ADR-0064: `attack_proc` effect shape + `onDamageDealt` emission extension + rider-cast bypass

**Status:** Accepted
**Date:** 2026-05-12

## Context

Phase C / Cluster 5 (Session 30) needs the substrate that unblocks weapon spell-cast riders: Bolt Hammer firing Lightning on a physical hit, Flametongue applying Burn via proc, future wand on-hit resistance shifts (all authored in Session 31). The audit's design sketch (post-20 engine audit, Item 4) names the effect shape `{ kind: 'attack_proc', chance, abilityId }` on equipment and identifies three coupled decisions:

1. **Where to register the proc.** Equipment contributes to value-modifying hooks today (`modifyStatQuery`, `modifyMpCost`, etc.); no equipment field today fires an *action* in response to an event. The closest precedents are `statusGrants` (pre-battle materialization, not event-driven) and `onTick` / `onDamageReceived` (status side effects that emit follow-on actions).

2. **Where the proc fires.** The natural hook is `onDamageDealt`, fired against the attacker at the damage pipeline's attacker stage. Today's `onDamageDealt` is transform-only — handlers return a modified `DamageContext`, no emission lane. Adding an emission lane is the work.

3. **What happens to the procced spell.** Per Chris's design call this session: the proc is the weapon's power, not the wielder's. The procced spell pays no MP, bypasses Silence and other caster-status veto handlers, and the wielder's affordability gates do not apply. The wielder's MP can be 0 and a Mage with Flametongue still procs Burn through a swing. This requires explicit bypass machinery on the proposed-action path.

Plus a quieter substrate fact: hook handlers need access to the per-action seed to roll deterministically. Pipeline-stage handlers see it via `env.seed`; hook-source contributors see only `args` and don't currently have a way in. The audit (Item 4) called out a per-action seed sub-stream for the proc roll, which presupposes seed visibility from inside the handler.

## Decision

**Three coupled changes, in service of one feature surface:**

**(1) `onDamageDealt` return type widens to `DamageContext | OnDamageDealtResult`.** `OnDamageDealtResult` is `{ ctx: DamageContext; emittedActions?: ReadonlyArray<ProposedAction> }` — exact mirror of the existing `OnDamageReceivedResult`. `runOnDamageDealt` (the runner) normalizes: bare-ctx returns are treated as `{ ctx, emittedActions: undefined }`; wrapped returns have their emissions accumulated onto `ctx.emittedActions`. `fireOnDamageDealt` (the pipeline stage handler) returns the ctx as-is; the orchestrator threads it through subsequent stages; `resolveAbilityEffect` forwards `ctx.emittedActions` to `generatedActions` exactly as it already does for `onDamageReceived` emissions.

**(2) `attackProcs?: ReadonlyArray<AttackProcDef>` on `EquipmentBase`.** `AttackProcDef = { chance: number; abilityId: AbilityId }`. The equipment contributor `attackProcContributor` is registered against `onDamageDealt` in the `EQUIPMENT_CONTRIBUTORS` map. Each (item × proc entry) yields one synthetic `SourceContribution<'onDamageDealt'>` whose `invoke`:
- Gates on `ctx.hit === true` (no proc on a miss).
- Gates on `ctx.damageTags.has('physical')` (proc only on weapon hits, not when the wielder casts a magical spell).
- Gates on `ctx.actionSeed !== undefined` (deterministic only when the seed is plumbed).
- Rolls `unitFloatFromSeed(ctx.actionSeed ^ (PROC_ROLL_SUB_STREAM + procIndex))` against `chance`.
- On success, emits a `use_ability` proposed action against `ctx.target.id` with `riderSource: { kind: 'equipment_proc', itemId }`.

The runner accumulates emissions onto the ctx; the rest of the pipeline preserves the emission unchanged.

**(3) `riderSource?: UseAbilityRiderSource` on `UseAbilityPayload`.** Discriminated union: today's sole variant is `{ kind: 'equipment_proc'; itemId: ItemId }`. When set:
- `validateAction` skips the MP affordability check (caster need not afford the spell).
- `reduceUseAbility` skips MP deduction; the outcome's `mpSpent` is recorded as 0.
- `runPreHook` (in `commitAction`) skips `onActionAttempted` — Silence, Stop, and Don't Act handlers on the wielder do not fire on a rider cast. The proc is the weapon's power; the wielder's status gates are irrelevant.

**Seed substrate:** `DamageContext` gains optional `actionSeed?: number`. The pipeline orchestrator (`runDamagePipeline`) initializes it to `args.seed`. Custom test contexts that build a `DamageContext` directly may omit it (handlers gate on `ctx.actionSeed !== undefined` and no-op when absent). `unitFloatFromSeed` (the single-arg, `mulberry32`-style mixer in `engine/hooks/runners.ts`) is exported so the contributor can roll without re-implementing the mixer or pulling damage-package internals.

**Sub-stream constant:** `PROC_ROLL_SUB_STREAM = 8`. Past all existing lanes (variance=0, evasion=1, brave=2, status_chance=3..15, crit=4, ability_chance=16..). Each proc entry's effective sub-index is `8 + procIndex`. Two procs on one weapon roll on `8` and `9` — independent rolls; same seed produces the same answers across replays.

**Chain semantics:** procs share chain-depth with reactions (single global counter per resolution chain via `commitAction`'s queue). Procs do NOT count against the per-unit-per-turn reactor cap — that cap is reactor-keyed (target side); procs are attacker-side and have no symmetric per-attacker cap in v1.

## Rationale

**Mirror the `onDamageReceived` shape rather than introducing a parallel "attacker-side emitter" hook.** `onDamageReceived` already proves the engine can carry a wrapped-or-bare return shape — Sleep wake-on-damage and the future Vulnerable consume-on-damage both ride it. Adding the same option to `onDamageDealt` is a sub-30-LOC change: a new result type interface, a `is*Result` type guard, a normalizer block in the runner, and the pipeline stage handler already forwards `ctx.emittedActions`. The "parallel hook" alternative would mean a new hook surface (CLAUDE ground rule 8 — surface widening is deliberate) for negligible structural gain.

**Field on `EquipmentBase` rather than `WeaponEquipment`.** Procs realistically apply to weapons in v1, but the field shape is general enough that armor or accessories could carry it later (Thorns-style retaliation, for instance). Gating to weapon kind today would require migration if a non-weapon proc surfaces. The handler-side `damageTags.has('physical')` gate is the practical filter for "this fires off a swing"; if a future accessory wants to proc off magical damage, the field's already there.

**`riderSource` wrapper rather than a bare `mpFree: boolean` flag.** Three reasons:
- Action-log readability. The action log can read `riderSource.kind === 'equipment_proc'` and write "Bolt Hammer procced" rather than "free cast (??)". Same hook the future tooltip can lean on.
- Multiple riders later. If future content surfaces a non-equipment rider (an environmental hazard that fires an ability through the unit), `riderSource` extends with a new discriminator. `mpFree` would need parallel flags for parallel sources.
- One bypass, three semantics. The wrapper presence is one check that controls MP, Silence, and other caster-side veto gates. Adding flags for each (`mpFree`, `silenceFree`, etc.) would mean every consumer learns three concepts.

**`computeAttackerFacing` / `pickEvasion` / `computeElevationModifier` extracted to `hit-chance-internals.ts`.** Forecast wants to compute the effective hit chance without rolling the RNG (`computeOutgoingHitChance`); the math must match `evasionCheck` byte-for-byte to avoid display divergence. Extracting the helpers to a shared internal module keeps the math single-sourced rather than duplicating it across the pipeline handler and the forecast helper.

**Sub-stream at 8, not 4.** Crit lane already uses 4 (a pre-existing overlap with status-chance lane 4 = status_chance + effectIndex 1 — not great but not this session's problem). Status chance can extend up to 3+effectIndex (~3-7 in v1 content), and ability chance starts at 16. Lane 8 is clearly free with margin in both directions. `PROC_ROLL_SUB_STREAM + procIndex` then occupies 8, 9, 10, ... — still well clear of ability_chance.

**Skip `onActionAttempted` on the rider path even though `source === 'system'` already short-circuits it.** The implicit "system emissions skip pre-hooks" already covers the proc case (the emission's `source: 'system'`). But the explicit `riderSource` check at the gate is documentation-in-code: a future reader sees the bypass intent at the gate, not buried in the system-source short-circuit comment three lines up. If a future content path wants to fire a rider with `source: 'player'` for some reason (probably never), the explicit gate keeps it free without needing a new investigation.

## Consequences

- **Hook surface gains zero entries** — the change is to the return type of an existing hook (`onDamageDealt`), not a new hook surface. CLAUDE ground rule 8 stays clean.
- **`EquipmentBase` gains two optional fields:** `attackProcs` and `damageMpDrainPercent` (the latter for ADR-0065). No v1 item declares either; Session 31 ships Bolt Hammer / Flametongue / Rasp Pendant on them.
- **`EQUIPMENT_CONTRIBUTORS` gains two entries:** `onDamageDealt: attackProcContributor` and `onFinalDamage: finalDamageDrainContributor` (the latter wired here for symmetric ADR completeness; ADR-0065 documents its semantics).
- **`UseAbilityPayload` gains `riderSource?: UseAbilityRiderSource`.** Optional and discriminated; no v1 path produces it pre-Session-30. Session 31 content does once Bolt Hammer / Flametongue ship.
- **`runOnDamageDealt` runs the wrapped-shape normalization block on every call.** Negligible per-call overhead (one `typeof` + `in` check per handler return). The hot path (single-target damage dispatch in v1 content with zero equipment procs) returns `accumulatedEmissions.length === 0` and short-circuits to returning the bare ctx unchanged.
- **`DamageContext.actionSeed` is optional.** Custom test fixtures that build a context directly may omit it; handlers that read it gate on `undefined`. The pipeline orchestrator always sets it.
- **Procs share chain-depth with reactions.** A Flametongue Knight who attacks a Burn-vulnerable Earth Mage triggers: swing → onDamageDealt → Burn proc emits → Burn-application chain. Each step counts against the depth-8 cap (`chainTermination.chainDepthCap`).
- **Procs do NOT cap per-attacker-per-turn.** A Flametongue Knight who somehow gets two swings (multi-act class in the future) procs Burn independently per swing. If playtest finds this spammy, add `perUnitPerTurnProcs` to `chainTermination` and gate in `commitAction`.
- **Silence does not gate procs.** A Silenced wielder still procs spells. By design — the weapon casts, not the wielder.
- **Action-menu display still reads the ability fields as authored.** Procced spells fired with `mpSpent: 0` outcomes don't surface in the action menu (they fire from the engine, not from a menu choice).

## Alternatives considered

**Eager-registered emitter lane on `onDamageDealt`** (each contributor module calls a `registerEmitter` side-effect at import). Rejected — same reason ADR-0056 rejected eager registration. The lazy-map shape stays inspectable in one place.

**`attack_proc` as a new top-level hook (`onAttackHit`).** Rejected — the same fire-site information (attacker, target, damage tags, hit/miss, seed) is already available at `onDamageDealt`. A new hook would duplicate the surface without unique semantics.

**Procs fire against a re-selected target.** Rejected per Chris's design call (Q5 this session) — the procced spell hits whoever the swing hit, not whoever the proc handler picks. Matches FFT precedent and the equipment doc's framing ("fires a Lightning spell at the target").

**Procs cost MP / respect Silence.** Rejected per Chris's design call (Q1 / Q4 this session) — the weapon casts, not the wielder. Matches FFT weapon-effect mechanics and the equipment doc's "Spell-cast riders on weapons follow normal spell mechanics" (which is about Faith / resistance composition, not caster cost).

**Per-attacker-per-turn proc cap.** Rejected for v1 — no v1 unit gets multiple attacks per turn, so the cap would be inert. Reserved for when multi-act content surfaces.

**Bare `mpFree: boolean` flag on `UseAbilityPayload`.** Rejected — see rationale above; the wrapper is more durable.

**Carry the action seed via a new hook argument rather than `ctx.actionSeed`.** Rejected — would mean widening `onDamageDealt`'s args signature (cascading to every handler), versus a single optional field on the context the handler is already reading. The context is the natural carrier for "data about this pipeline run."

## Session 47 extension — rider bypass for range / LoS / arc gates

S47 surfaced a latent bug in playtest on Stonebridge. A Hunter on the rampart (elev 8) shot an Assassin on flat ground (elev 2) at horizontal distance 5 with a Riptide Bow. The bow attack validated and committed; the Riptide proc (`undertow`, declared `range: { horizontal: 1, vertical: 1 }`) rolled successfully and was emitted as a `use_ability` chain action against the same target — but `validateAction`'s `inRange` check rejected it because the target was outside *undertow's own* declared range. `commitAction` then threw, crashing the battle.

The proc's range field is vestigial schema noise. The parent attack already determined the target and validated reach; the rider is an additional effect on that target, not a fresh targeted action with its own geometry. `undertow.ts`'s own header captures the design intent verbatim: *"Range is irrelevant — the proc emits against the hit target directly."* The intent was always for riders to bypass range — the bypass simply wasn't implemented past MP / Act.

**Extension:** `isRider === true` now also skips the `inRange` and `rangeMode`-specific (`straight_line` LoS, `arc` cover) gates in `validateAction`, for both `single_unit` and `tile` targeting branches. Target-existence checks, target-kind checks, and the `selfMove` terrain/occupant check still run — the bypass is scoped to geometric reach, not all validation.

Parallel consequences:

- **Reactions** (Counter, Discharge, Earth Resilience, …) continue to fizzle silently on validation failure per ADR-0011's chain-fizzle rule. The Assassin's Counter from the same Stonebridge scenario — Counter range 1, Hunter 5 tiles away — still doesn't fire, which is the correct behavior (you genuinely can't counter a target you can't reach).
- **Knockback** collisions remain handled by `applyKnockback` per ADR-0026 — cancel-at-last-legal-tile with fall damage on drops. Independent of validation; this ADR's extension doesn't interact.

**Why not also bypass the target-existence and target-kind checks for riders:** because those are programmer-error guards (the emission should always carry a valid target the engine recognizes), not gameplay constraints the bow already validated. A rider emitted against a non-existent unit is a bug in the proc's emission logic, not a graceful-failure case.

**Tests** in `src/engine/actions/session-30-integration.test.ts`:

- Rider use_ability against a far target with a tight-range proc → validates (proc lands).
- Non-rider use_ability with the same setup → rejected (regression check; the bypass is rider-scoped).
- Rider use_ability with `rangeMode: 'straight_line'` and a `blocks_los`-tagged wall between caster and target → validates (the LoS bypass also covers the scenario where a fortress wall would otherwise block a proc against a target the parent attack already hit).

## References

- `src/engine/hooks/hooks.ts` — `OnDamageDealtResult` interface; `onDamageDealt` return widening.
- `src/engine/hooks/runners.ts` — `runOnDamageDealt` normalization; `PROC_ROLL_SUB_STREAM` constant; `unitFloatFromSeed` exported.
- `src/engine/items/contributions.ts` — `attackProcContributor`; `EQUIPMENT_CONTRIBUTORS` map entry.
- `src/engine/catalog/definitions/item-definition.ts` — `AttackProcDef` type; `attackProcs` field.
- `src/engine/types/action.ts` — `UseAbilityRiderSource` type; `riderSource` field on `UseAbilityPayload`.
- `src/engine/types/damage.ts` — `actionSeed?: number` field on `DamageContext`.
- `src/engine/damage/pipeline.ts` — orchestrator wires `actionSeed`.
- `src/engine/actions/validate.ts` — MP-affordability bypass for rider casts.
- `src/engine/actions/reducers.ts` — `reduceUseAbility` MP-deduction bypass.
- `src/engine/actions/commit.ts` — `runPreHook` rider bypass.
- `src/engine/actions/session-30-integration.test.ts` — coverage.
- ADR-0056 — equipment contributor pattern; ADR this builds on.
- ADR-0027 — emission-lane precedent on `onDamageReceived`.
- ADR-0024 — `onTick` / `onTurnEnd` emission shape precedent.
- ADR-0062 — same-team reaction skip; sibling reaction-path discipline.
- ADR-0065 — `onFinalDamage` + `system_mp_drain` (sibling Session 30 substrate).
