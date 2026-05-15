## ADR-0075: `onFinalDamageReceived` post-finalize hook + revenge `system_damage` source

**Status:** Accepted
**Date:** 2026-05-15

## Context

Session 37 ships Spiked Mail — a Knight-only body armor that emits 20% of post-mitigation physical damage back at the attacker. Existing hooks don't cleanly compose this behavior:

- **`onFinalDamage`** fires against the *attacker's* hooks (per ADR-0065). Rasp Pendant uses it. Wrong perspective for Spiked Mail — the wearer is the *target*, not the attacker.
- **`onDamageReceived`** fires against the target's hooks pre-finalize (during the seven-stage pipeline). It supports emitted actions, but `ctx.finalDamage` is undefined at this point; a reflect amount computed off pre-finalize values can drift from the displayed damage by variance / cap clamping.
- **`onActionTargeted`** fires against the target's hooks post-application and returns reaction actions. But the runner applies an automatic Brave gate to every emission (ADR-0024). Spiked Mail is equipment-driven, not Brave-gated; the reflect must be deterministic.
- **Reaction compiler effect kinds** are `use_ability` / `apply_status` / `ct_push` (per ADR-0024). No raw `system_damage` emission, and Brave-gates every reaction regardless.

The substrate gap is small and structural: there's no target-side, post-finalize, non-Brave-gated emission lane. ADR-0065's `onFinalDamage` is the right *shape*, but fires on the wrong side.

Per Chris's design call (S37 plan-review): adding a sibling hook is the right scope — same args shape, target perspective, automatic loop guard inherited from `system_damage`'s pipeline bypass.

## Decision

**Three additions:**

**(1) New hook `onFinalDamageReceived`.** Target-side mirror of `onFinalDamage`. Emission-only. Args: `{ unit: Unit (target/wearer); attacker: Unit; damageDealt: number; damageTags: ReadonlySet<DamageTag>; absorbed: boolean }`. Return: `OnFinalDamageResult | void` (reuses the existing result type). The runner `runOnFinalDamageReceived` collects handlers against the target's id, invokes each, and flattens emissions for the stage handler to accumulate onto `ctx.emittedActions`.

The stage handler `fireOnFinalDamageReceived` (in `engine/damage/handlers.ts`) mirrors `fireOnFinalDamage` exactly — same `ctx.finalDamage ?? 0` read, same `absorbed = ctx.damageTags.has('healing')` derivation — but fires the new hook against `target` rather than `attacker`.

**(2) New `postFinalize` stage handler `fire_on_final_damage_received`.** Registered in `default-handlers.ts` alongside `fire_on_final_damage`. Default ruleset's `postFinalize: ['fire_on_final_damage', 'fire_on_final_damage_received']` runs them in order — attacker emission first, target emission second. Either may emit; neither may mutate `finalDamage`. The test fixture `DEFAULT_TEST_DAMAGE_PIPELINE` extends in lockstep per ADR-0069's parity-with-production discipline.

**(3) New `SystemDamageSource` variant `{ kind: 'revenge'; wearerId: UnitId; itemId: ItemId }`.** Names the equipment wearer (original target) + reflective item. The action log renders revenge entries with a dedicated `[revenge]` tag rather than the generic `[tick]` tag — semantically distinct from Poison ticks / falling damage / ability self-cost, and the tag is a player-facing affordance that distinguishes the emission from the wearer's own actions.

**Equipment field for Spiked Mail:** `physicalReflectPercent?: number` on `EquipmentBase` (S30 sibling pattern). The contributor `physicalReflectContributor` (sibling to ADR-0065's `finalDamageDrainContributor`) registers against `onFinalDamageReceived`. Each item with the field yields one handler that:
- Returns `{}` when `!damageTags.has('physical')` (magical hits don't reflect).
- Returns `{}` when `args.absorbed` (no damage actually landed).
- Returns `{}` when `args.damageDealt <= 0`.
- Returns `{}` when wearer is KO (`args.unit.vitals.hp <= 0`).
- Returns `{}` when `args.attacker.id === wearerId` (self-damage path).
- Returns `{}` when `floor(damageDealt × percent / 100) === 0` (rounded amount is zero).
- Otherwise emits `system_damage { targetId: attacker.id, amount, tags: ['physical'], source: { kind: 'revenge', wearerId, itemId } }`.

No v1 item declares `physicalReflectPercent` outside this session. Session 37 ships Spiked Mail with `physicalReflectPercent: 20`.

## Rationale

**Sibling hook rather than widening `onFinalDamage` to fire on both sides.** `onFinalDamage`'s `unit` is the attacker; a hook can't change the semantics of an existing arg's identity without breaking every handler that reads it. Two hooks with disjoint perspectives are cleaner than one hook with conditional arg-meanings.

**Reuse `OnFinalDamageResult`.** The return shape (emission-only, optional `emittedActions`) is identical between the two hooks — same emission contract, same lack of mutation. Reusing the result type keeps the surface honest about its semantics.

**Run the new stage after the existing one.** Both fire post-finalize; ordering only matters if one needs to read the other's emissions, which neither does (the orchestrator accumulates emissions onto `ctx.emittedActions` after the whole pipeline returns, and consumers see the full list at the reducer's `generatedActions`). Attacker-then-target matches the seven-stage pipeline's existing attacker-then-target ordering convention; no behavioral consequence today.

**Loop guard is automatic — no explicit gate needed.** `system_damage` (including revenge) bypasses the seven-stage damage pipeline per reduceSystemDamage (per ADR-0027: "Bypasses the seven-stage damage pipeline … no Counter trigger"). So a revenge emission never reaches `fireOnFinalDamageReceived` — there's no path through which Spiked Mail's emission can trigger another Spiked Mail emission, regardless of whether the attacker also wears reflective gear. The decision is structural, not contributor-side: the bypass at the pipeline level is the load-bearing guarantee.

**`absorbed` gate inherited from `onFinalDamage`.** The argument is symmetric between the two hooks — handlers may gate independently. Spiked Mail skips reflect on absorbed magical hits (no damage actually landed); a future "absorption-shield-triggers-counter" handler could fire *only* on absorbed hits. Both patterns are first-class.

**KO'd wearer skip belongs in the contributor, not the runner.** The wearer is engagement-inactive once KO'd — they shouldn't continue emitting actions. This mirrors `onActionTargeted`'s same-team / KO'd-reactor gate, but lives in the contributor for two reasons: (a) future `onFinalDamageReceived` consumers might want different KO semantics (a "death-throes counter" that fires *because* the wearer was KO'd), so the runner stays neutral; (b) belt-and-suspenders — `reduceSystemDamage` already short-circuits on KO'd targets, so a KO'd-wearer-emits path is at worst a zero-applied log entry. Skipping at the contributor keeps the log clean.

**Attacker-equals-wearer gate.** Self-damage paths (Lightning Mage's Storm Caller, future self-targeting abilities) shouldn't trigger reflect on the caster. The simplest gate: if `attacker.id === wearerId`, skip. Mirrors the same defensive guard in `runOnActionTargeted` (a unit can't react to its own action).

**Integer percentage (0–100) inherited from `damageMpDrainPercent`.** Authoring is symmetric (`physicalReflectPercent: 20`); arithmetic stays integer-friendly with `floor(damage × pct / 100)`. The "20% of damage" reading from the equipment design doc maps directly to the literal field value.

**`revenge` naming rather than `reflect`.** Chris's call: "reflect" is reserved for a future magic-spell variant (a `system_damage` of *magical* type, fired on incoming spell-cast hits). The naming split future-proofs the action log against ambiguity — when reflect-class magical equipment ships, the `[revenge]` tag stays bound to physical-reflect and the new variant gets its own tag.

**Action log attribution names wearer + item rather than just the action.** "Attacker took N dmg from Wearer's Spiked Mail" is more legible than "Attacker took N dmg (revenge)" — names the agent and the item that caused the emission. Threading `wearerId` + `itemId` through the source variant keeps the attribution data-driven, not reconstructed at format time.

## Consequences

- **Hook surface grows by one entry** (`onFinalDamageReceived`). Per CLAUDE ground rule 8, the addition is deliberate; this ADR is the record.
- **`SystemDamageSource` union grows by one variant** (`revenge`).
- **`EquipmentBase` gains `physicalReflectPercent?: number`** alongside ADR-0065's `damageMpDrainPercent?: number`. Both are post-finalize emission triggers; their authoring patterns are now symmetric.
- **`DEFAULT_DAMAGE_PIPELINE.postFinalize` grows from `['fire_on_final_damage']` to `['fire_on_final_damage', 'fire_on_final_damage_received']`** in both production (`default.ts`) and the test fixture (`DEFAULT_TEST_DAMAGE_PIPELINE` in `test-fixtures.ts`). The structural-equivalence test in `default.test.ts` catches divergence.
- **Action-log rendering adds a new tag class.** `[revenge]` joins `[init]` / `[tick]` / `[hit]` / etc. The format module's `formatDamageSource` is extended with a `'revenge'` case, but the dedicated render path in the `system_damage` case bypasses it.
- **Procs and reflect run on different stages.** Procs (`onDamageDealt`) fire at the *attacker stage* (pre-cap). Reflect (`onFinalDamageReceived`) fires *post-finalize*. A Flametongue Knight wearing Spiked Mail attacking a Spiked Mail Knight: Flametongue's Burn proc emits during attacker stage; Spiked Mail's revenge emits after finalize; both emissions accumulate onto `ctx.emittedActions` and flow through `generatedActions` together.
- **No infinite-loop risk.** A revenge `system_damage` bypasses the pipeline, so `fireOnFinalDamageReceived` doesn't fire for it. Mutual reflect (both units wear Spiked Mail) emits exactly once per real damage event.
- **No interaction with Counter / Discharge / other reactions.** Reactions fire from `onActionTargeted` (a separate hook, run by the reducer after the damage pipeline completes). Spiked Mail's revenge and a target's Counter both fire on the same incoming hit; the attacker takes both the revenge damage (which doesn't roll Brave) AND the Counter swing (which does, gated on attacker Brave per ADR-0021). Stacked retaliation is intended behavior — equipment + reaction passive compose.

## Alternatives considered

**Extend `onFinalDamage` to fire on both attacker and target.** Rejected — the `unit` arg's identity is part of the contract; conditionally re-interpreting it would force every existing handler (Rasp Pendant's drain) to check "am I the attacker or the target?" before doing anything. Cleaner to have two hooks with clear perspectives.

**Emit from `onDamageReceived` (target-side, pre-finalize).** Rejected — `ctx.finalDamage` is undefined pre-finalize. A reflect amount based on pre-finalize values could mismatch the displayed integer (variance hasn't rolled, the cap hasn't clamped). Spiked Mail's "20% of post-mitigation damage" is post-finalize semantics by design.

**Extend the reaction compiler with a `system_damage` effect kind and `physicalReflect` trigger condition.** Rejected — the runner applies a Brave gate to every reaction emission. Spiked Mail's reflect is deterministic; Brave-gating it would mean a low-Brave wearer's reflect fires sporadically, which doesn't match equipment semantics. Bypassing the Brave gate at the reaction compiler is a larger substrate change than adding a sibling hook.

**Spiked Mail as a `statusGrants`-bestowed permanent status with hook handlers.** Rejected — works but adds two indirections (status type definition + status grant + hook registration on the status) for behavior that's intrinsic to the item. The status pattern is appropriate when the effect needs to be Dispelled / overwritten / interact with the status system; equipment-intrinsic effects don't need that layering.

**Tag-conditional reflect (`physicalReflect: ReadonlyArray<{ percent, tagFilter? }>`).** Considered — would let future items reflect on specific damage tags (Lightning-only thorns, etc.). Rejected for v1 — no current content needs the shape complexity. The single-percentage field can extend to the array shape when content demands it, mirroring ADR-0065's `damageMpDrainPercent` evolution path.

**Inline reflect-amount derivation in the reducer.** Considered — the reducer could read the wearer's `physicalReflectPercent` from current equipment state and compute. Rejected — same reasoning as ADR-0065's drain-amount derivation: the contributor closes over the firing-time percentage; the reducer applies the literal number. Decouples emission timing from reduction timing for the rare mid-chain equip-swap case.

**`onFinalDamageDealt` as a sibling name instead of keeping `onFinalDamage`.** Considered for symmetry. Rejected — would require renaming the existing ADR-0065 hook + handler, churning every existing reference. The current `onFinalDamage` is unambiguous in context (its perspective is the attacker, matching `onDamageDealt`'s convention); the new sibling adopts `Received` to mirror the existing `onDamageDealt` / `onDamageReceived` pair.

## References

- `src/engine/hooks/hooks.ts` — `onFinalDamageReceived` signature.
- `src/engine/hooks/runners.ts` — `runOnFinalDamageReceived`.
- `src/engine/damage/handlers.ts` — `fireOnFinalDamageReceived`.
- `src/engine/damage/default-handlers.ts` — `fire_on_final_damage_received` registered.
- `src/content/rulesets/default.ts` — `DEFAULT_DAMAGE_PIPELINE.postFinalize` extended.
- `src/engine/catalog/test-fixtures.ts` — `DEFAULT_TEST_DAMAGE_PIPELINE.postFinalize` extended.
- `src/engine/items/contributions.ts` — `physicalReflectContributor`; map entry.
- `src/engine/catalog/definitions/item-definition.ts` — `physicalReflectPercent` field.
- `src/engine/types/action.ts` — `SystemDamageSource` `revenge` variant.
- `src/ui/action-log-format.ts` — `[revenge]` tag in `system_damage` formatter.
- `src/content/items/spiked-mail.ts` — first consumer.
- `src/engine/actions/session-37-reflect-integration.test.ts` — coverage.
- ADR-0021 — Brave-gated reaction trigger chance (the convention this hook bypasses).
- ADR-0024 — reaction compiler / `onActionTargeted` substrate (the considered-and-rejected alternative).
- ADR-0027 — `system_damage` bypasses the damage pipeline (the load-bearing loop guard).
- ADR-0057 — absorption flip (the `absorbed` semantic this hook gates on).
- ADR-0064 — `attack_proc` (sibling attacker-side emission pattern).
- ADR-0065 — `onFinalDamage` (the attacker-side hook this one mirrors).
