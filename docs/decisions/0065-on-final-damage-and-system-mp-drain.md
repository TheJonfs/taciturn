## ADR-0065: `onFinalDamage` post-finalize hook + `system_mp_drain` action

**Status:** Accepted
**Date:** 2026-05-12

## Context

Cluster 5 (Session 30) also lands the substrate for Rasp Pendant (Session 31's "10% of final damage drained from the target's MP into the wearer's"). Two coupled needs:

1. **A hook that fires after the damage is locked in.** Per the equipment doc spec, the drain amount is "10% of final damage dealt — after resistance modifiers apply." That value is only meaningful post-finalize: variance has rolled, the cap stage has clamped, the finalize stage has floored to integer. Adding a transform there isn't appropriate (finalize is the last word); an emission-only stage is.

2. **A new action type for MP transfer.** `system_damage` writes HP one-sidedly; `system_heal` writes HP one-sidedly. A drain is a *transfer*: target loses MP, source gains MP (transfer-bounded). The existing system actions don't model both sides of a single emission.

Per Chris's design call this session: the drain is purely additive (no damage reduction). Original equipment-doc spec had "damage output reduced by 10%, that 10% drained as MP" — the simpler "no reduction, bonus drain" reading was confirmed for v1. The pendant gets slightly more powerful in exchange for clean substrate.

Per Chris's design call: drain skips when the hit was absorbed (resistance > 100 per ADR-0057). No damage actually landed → no MP drain. The hook arg carries `absorbed: boolean` so handlers can gate.

## Decision

**Three additions:**

**(1) New pipeline stage `postFinalize` after `finalize`.** `DamageStage` (ruleset.ts) extends from seven stages to eight. `STAGE_ORDER` in pipeline.ts mirrors the extension. Default ruleset registers `fire_on_final_damage` as the sole `postFinalize` handler. The pipeline orchestrator's per-stage dispatcher (`runStage`) now reads `ruleset.damagePipeline.stages[stage] ?? []` — tolerant of stages a custom (test) ruleset omits, since not every test fixture declares the new stage.

**(2) New hook `onFinalDamage`.** Emission-only. Args: `{ unit: Unit (attacker); target: Unit; damageDealt: number; damageTags: ReadonlySet<DamageTag>; absorbed: boolean }`. Return: `OnFinalDamageResult | void` where `OnFinalDamageResult = { emittedActions?: ReadonlyArray<ProposedAction> }`. The runner (`runOnFinalDamage`) collects handlers, invokes each with the args, and flattens emissions for the stage handler to accumulate onto `ctx.emittedActions`.

The stage handler (`fireOnFinalDamage` in `engine/damage/handlers.ts`) reads `ctx.finalDamage`, derives `absorbed = ctx.damageTags.has('healing')` (the cap-stage absorption-flip sentinel from ADR-0057), runs the hook, and appends any emissions to `ctx.emittedActions`. No mutation of damage — `finalDamage` is the last word.

**(3) New action type `system_mp_drain`.** Payload `{ source: UnitId; target: UnitId; amount: number }`. Outcome `{ kind: 'system_mp_drain'; source; target; requested: number; targetApplied: number; sourceApplied: number }`. Reducer `reduceSystemMpDrain` applies the transfer-bounded math:
```
targetApplied = min(target.vitals.mp, requested)
sourceApplied = min(maxMp(source) − source.mp, targetApplied)
```
The source's MP rises by `sourceApplied`; the target's MP falls by `targetApplied`. The two CAN differ — if the source is near MP cap, the drained spillover is lost (no buffer). KO'd target or source short-circuits to all-zero applied fields, with the entry still logged.

**Equipment field for Rasp Pendant:** `damageMpDrainPercent?: number` on `EquipmentBase`. The contributor `finalDamageDrainContributor` (sibling to ADR-0064's `attackProcContributor`) registers against `onFinalDamage`. Each item with the field yields one handler that:
- Returns `{}` (no emission) when `args.absorbed`.
- Returns `{}` when `args.damageDealt <= 0` (miss / blocked / pre-finalize zero).
- Returns `{}` when `args.target.vitals.hp <= 0` (KO'd target).
- Returns `{}` when `floor(damageDealt × percent / 100) === 0` (rounded-down drain is zero).
- Otherwise emits `system_mp_drain { source: attacker.id, target: target.id, amount }`.

No v1 item declares `damageMpDrainPercent`; Session 31 ships Rasp Pendant with `damageMpDrainPercent: 10`.

## Rationale

**Post-finalize stage rather than extending the finalize handler.** Finalize's job is "compute the integer damageDealt"; emission belongs to a different stage. The clean separation lets future post-finalize handlers participate without renegotiating finalize's contract. Adding a stage is a small, additive change because the orchestrator's `runStage` already iterates a list of refs per stage — adding one more iteration is free.

**Tolerate missing stages in the orchestrator.** Many test fixtures construct rulesets without declaring `postFinalize` (the stage didn't exist when they were written). Rather than migrate every fixture, the orchestrator treats absent stages as empty handler lists. This is consistent with the rest of the engine's "absent = no contribution" philosophy and avoids a churn pass through ~50 test files.

**Emission-only, not transform.** The hook fires after damage is finalized; mutating `finalDamage` from a hook handler at this stage would defeat the cap stage's clamp and break the BMG-aligned invariant ("finalize is the integer"). Emission-only means handlers can react (drain MP, increment a counter via `system_ct_push`, etc.) but cannot rewrite history.

**`absorbed` flag in args, not derived by every handler.** Multiple future handlers may want to gate on absorbed-vs-direct damage (a thorn-style retaliation that fires only on actual damage; an absorbing-shield trigger that fires only on absorption). Deriving `damageTags.has('healing')` once at the runner and passing as a named flag is clearer than every handler re-deriving.

**Transfer semantics with two `applied` fields rather than one symmetric `amount`.** A drain that sees a 3-MP target asked for 10 MP transfers 3, not 10. A drain that sees a near-max source asked for 10 MP transfers what fits in source headroom, not 10. The two values can differ — a low-MP target near-cap source might see `targetApplied: 3, sourceApplied: 2` — and the log needs both for trace accuracy. Compressing to one `amount` loses information.

**Transfer-bounded by `targetApplied`, not `requested`.** The transfer can't create MP that didn't exist on the target. If the source can hold 5 and the target only had 3, the source gains 3 (transfer-bounded), not 5 (requested-bounded). Matches the equipment-doc reading: "wielder gains, target loses — wielder gains what target lost." `targetApplied` is what the target lost; `sourceApplied` is min of that and source headroom.

**KO'd target / source is a no-op, not a refusal.** Emit the action; the reducer records `applied: 0, applied: 0`. Reasons: (1) the action log can trace "Bolt Hammer procced but target was already KO'd" without consulting state; (2) the contributor pre-filter (skip when `target.vitals.hp <= 0`) keeps zero-amount drains rare in practice but the reducer's tolerance is the load-bearing guarantee.

**Integer percentage (0–100), not a [0, 1] fraction.** Easier authoring (`damageMpDrainPercent: 10` reads obviously); arithmetic stays integer-friendly with `floor(damage × pct / 100)`. The audit's "10% of damage" phrasing matches the field's units.

**Contributor handler gates on `target.vitals.hp <= 0` before emitting.** The reducer ALSO handles KO'd targets, but pre-filtering at the handler keeps the action log clean of trivial zero-amount drains. Belt-and-suspenders is fine here — the reducer's tolerance is the load-bearing rule; the handler's pre-filter is the readability courtesy.

## Consequences

- **Hook surface grows by one entry** (`onFinalDamage`). Per CLAUDE ground rule 8, the addition is deliberate; this ADR is the record.
- **`DamageStage` grows from seven to eight stages.** Custom rulesets that exhaustively declare stage lists need to add `postFinalize: []` (or use the new `?? []` tolerance); existing v1 rulesets gain the stage automatically through the default-ruleset update.
- **`EquipmentBase` gains `damageMpDrainPercent?: number`** (paired with ADR-0064's `attackProcs?` field for one substrate addition).
- **`ActionType` gains `'system_mp_drain'`.** The action union, outcome union, and ProposedAction union all extend by one entry. The reducer dispatcher (`reduce.ts`) routes to `reduceSystemMpDrain`. The validator's system-action pass-through list includes the new type.
- **`fireOnFinalDamage` reads `ctx.finalDamage ?? 0` defensively.** The cap-and-finalize sequence guarantees `finalDamage` is set in the default pipeline, but a custom ruleset that drops finalize would leave it undefined; the stage handler tolerates that case.
- **Procs and final-damage handlers run on different stages.** Procs fire from `onDamageDealt` at the *attacker stage* (before resistance / variance / cap); final-damage handlers fire after `finalize`. A Flametongue Knight wearing Rasp Pendant gets both: Burn proc emits during the attacker stage; MP-drain emits after finalize. Both emissions accumulate onto `ctx.emittedActions` and flow to `generatedActions` together.
- **No item currently declares `damageMpDrainPercent`.** Session 31 authors Rasp Pendant. Zero behavior change for current content.
- **Transfer-bounded math means a drain on a near-max source loses spillover.** A Bolt Hammer Knight at 98/100 MP attacking a 50-MP Mage with Rasp Pendant equipped, dealing 50 damage: drain math computes `floor(50 × 10 / 100) = 5` requested. `targetApplied = min(50, 5) = 5`. `sourceApplied = min(2, 5) = 2`. The Knight gains 2 MP; the Mage loses 5 MP. The 3-MP spillover is lost — no buffer. By design (the equipment doc implies transfer, not transfer-with-spillover).

## Alternatives considered

**Add `postFinalize` as a sub-step of `finalize` rather than a new stage.** Rejected — the stage list is the contract that ruleset authors read to understand the pipeline. Folding `postFinalize` into `finalize` would either (a) make the finalize handler do two unrelated jobs or (b) require finalize to call a second internal handler that's invisible to the ruleset, both of which obscure the data flow.

**`onFinalDamage` is a transform hook (modifies damage).** Rejected — finalize already ran; mutating its output would break the "integer post-finalize" invariant. If a future need surfaces for transform-style post-finalize logic (e.g., a counter-style retaliation that needs to mark the attacker), it should live as a new emission-side action (`system_mark_attacker`) rather than as a transform.

**Drain as a one-sided action (target loses; source unchanged).** Rejected per the equipment doc: "wielder gains the same." Rasp Pendant is a transfer.

**Drain amount derived inside the reducer rather than by the contributor.** Considered — the reducer could read the source's `damageMpDrainPercent` and compute. Rejected because the action carries `amount` as the contract; the source unit's equipment state at *reduction time* might differ from *firing time* (mid-chain reactions could re-equip in the future). The contributor closes over the firing-time percent; the reducer applies the literal number.

**Per-action seed sub-stream for the drain (analogous to procs).** Rejected — the drain is deterministic given damage dealt; no random component. The sub-stream lanes stay reserved for things that actually roll.

**Action log entry for absorbed / zero-drain events.** Considered — emit `system_mp_drain` with all-zero applied fields when absorbed, for trace transparency. Rejected for now — clean log preferred. If a future debug overlay wants the trace, the contributor can stop pre-filtering.

**`damageMpDrainPercent` as a `ReadonlyArray<{ percent, tagFilter? }>` (like `actionSpeedModifiers`).** Rejected for v1 — no v1 content needs tag-conditional drain. Reserve the shape complexity for when content demands it.

## References

- `src/engine/hooks/hooks.ts` — `OnFinalDamageResult` interface; `onFinalDamage` signature.
- `src/engine/hooks/runners.ts` — `runOnFinalDamage`.
- `src/engine/types/ruleset.ts` — `DamageStage` adds `'postFinalize'`.
- `src/engine/damage/pipeline.ts` — `STAGE_ORDER` includes `'postFinalize'`; `runStage` tolerates missing stage entries.
- `src/engine/damage/handlers.ts` — `fireOnFinalDamage`.
- `src/engine/damage/default-handlers.ts` — `fire_on_final_damage` registered.
- `src/content/rulesets/default.ts` — `DEFAULT_DAMAGE_PIPELINE.postFinalize: ['fire_on_final_damage']`.
- `src/engine/items/contributions.ts` — `finalDamageDrainContributor`; map entry.
- `src/engine/catalog/definitions/item-definition.ts` — `damageMpDrainPercent` field.
- `src/engine/types/action.ts` — `SystemMpDrainPayload` / `SystemMpDrainOutcome`; union extensions.
- `src/engine/actions/reducers.ts` — `reduceSystemMpDrain`.
- `src/engine/actions/reduce.ts` — dispatcher branch.
- `src/engine/actions/validate.ts` — `system_mp_drain` in the pass-through list.
- `src/engine/actions/session-30-integration.test.ts` — coverage (drain math, KO'd target, low-MP target, near-cap source, absorbed gate).
- ADR-0024 — emission shape precedent.
- ADR-0027 — `onDamageReceived` emission lane (sibling).
- ADR-0057 — absorption activation (the source of the `absorbed` semantic).
- ADR-0058 — `maxMp` introduction (the cap this reducer enforces).
- ADR-0064 — `attack_proc` and rider casts (sibling Session 30 substrate).
