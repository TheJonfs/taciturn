## ADR-0066: `tagged_resistance_shift` parametric status type

**Status:** Accepted
**Date:** 2026-05-12

## Context

Session 31 (Cluster 5 content) ships Wand of the Depths and Wand of the Deepwood's on-hit effects. Per the equipment doc:

> Wand of the Depths on-hit: applies +25 Fire Resistance and -25 Lightning Resistance to the target. Persists for the duration of the battle. Stackable across multiple wand applications.

> Wand of the Deepwood on-hit: applies +25 Lightning Resistance and -25 Fire Resistance to the target. Stackable. Cancels additively with Wand of the Depths on a shared target.

Two coupled needs:

1. **A status type whose modifyResistance handler is parametric per-tag.** Shell and Protect each register a `modifyResistance` handler that adds magnitude to a single tag (`magical` / `physical`). The wands need per-tag signed deltas across multiple tags — Wand of the Depths' single hit shifts both Fire and Lightning, in opposite directions.

2. **Stackable composition with cross-source cancellation.** "Two Wand of the Depths hits = +50 Fire / -50 Lightning" and "Wand of the Depths + Wand of the Deepwood = zero net" need to fall out of the same composition mechanism naturally — not as special cases.

The third axis — battle-long persistence — has a fitting existing primitive. `'permanent'` duration mode (per ADR-0027 / `engine/types/duration-mode.ts`) stores `remainingDuration: null`, never decrements by time, no tick fan-out. No new duration primitive needed for this session.

## Decision

**Single parametric status type** — `tagged_resistance_shift` — replaces the alternative shapes (sibling types per source, sibling-with-shared-displayName).

**Per-instance customState carries the parameters.** The applying ability authors `tagDeltas: Record<DamageTag, number>` and `displayName: string` on its `StatusEffectSpec.customState` (per ADR-0030's apply pipeline). The status type defines no `composeApplyState`; the spec's customState flows through `applyStatus` directly onto the instance.

**The status registers one `modifyResistance` handler.** It reads `ctx.instance.customState.tagDeltas[args.tag]` and returns `args.baseValue + delta` when the tag is present in the deltas map; identity return otherwise.

**`STACK_INDEPENDENT` stacking rule.** Each application is a distinct instance on the unit. `runModifyResistance` collects active handlers from every instance and threads the value through, so two same-source applications register two handlers; the additive chain composes them naturally. Cross-source applications compose through the same chain; opposite-signed deltas cancel additively.

**`'permanent'` duration mode.** No expiry by time. No tick fan-out. Removable only by explicit dispel / `status_remove`. Matches the equipment doc's "persists for the duration of the battle."

**Status tags: `['negative', 'dispellable']`.** Per Session 31 plan-review framing: v1 ships the shift with enemy-only wand swings (ally-targeting deferred per Session 31 decision 8), so the `'negative'` tag matches the offensive-setup intent. `'dispellable'` enables future Dispel-class abilities to clear the shift. `aiHints.polarity: 'debuff'`.

**Display name lives in customState, not as a sibling type.** A future Wand of Embers / Wand of Storms (per the equipment doc's "Future wands" note) will reuse `tagged_resistance_shift` with different deltas and a different displayName. No status-type proliferation; no name-flow drift across reuses.

## Rationale

**Parametric over sibling types.** A separate status type per source would inflate the catalog (currently 4 wand resonances; doubles when Fire/Lightning wands ship) and demand new boilerplate per addition. The parametric shape closes over the differences in data rather than discriminating them in the type.

**customState over magnitude.** Magnitude is a single number; tagDeltas is a multi-tag map. A `composeApplyState` callback could compute the deltas from caster state, but the deltas depend on the *applying ability's identity* (Wand of the Depths vs. Wand of the Deepwood), not on caster stats. The spec-driven customState matches the actual data dependency.

**STACK_INDEPENDENT over STACK_ADDITIVE.** STACK_ADDITIVE sums magnitudes into one instance and refreshes duration. With multi-tag signed deltas, summing magnitudes loses information (`{ fire: 25, lightning: -25 }` + `{ fire: -25, lightning: 25 }` should sum to zero per-tag, not to a single-magnitude scalar). STACK_INDEPENDENT preserves each instance's deltas and lets the additive hook chain compose them.

**`'permanent'` over `'permanent_per_unit_ct'`.** Both never expire. `'permanent_per_unit_ct'` ticks at the unit's CT cadence — appropriate when the status has a tick effect (Shell does not in v1; future Auto-Shell triggers might). `tagged_resistance_shift` has no tick effect; using `'permanent'` makes the type contract self-documenting (the status doesn't participate in the tick fan-out).

**No `composeApplyState`.** The status doesn't need to derive customState from caster context. The spec's customState flows through directly via `applyStatus`'s `composedCustomState = args.customState` default path. Adding an unneeded composer would just be machinery.

**`applyAlways: true` on the applying abilities.** Per the equipment doc: "Weapon-applied status procs use flat percentages, not Faith-gated rolls. A Knight with a Flametongue procs Burn at the same rate as a Fire Mage with one." The flat-percentage gate is the weapon's `attackProcs[].chance`; the inner status application short-circuits the BMG formula via `applyAlways: true`.

## Consequences

- **One new status type** (`tagged_resistance_shift`); cumulative catalog count: 24.
- **Two new abilities** (`wand_of_depths_apply_shift`, `wand_of_deepwood_apply_shift`); both `availability: 'hidden'`. Fired only via the weapon's `attackProcs` path.
- **Cross-wand cancellation falls out of composition** — the additive `runModifyResistance` chain produces zero net when opposite-signed instances coexist. No special case in the engine.
- **The shift has no per-tick effect** — no DoT/HoT participation. Future tick-modifying equipment (Purifier doubles negative status tick consumption) doesn't interact with the shift; the shift's `'negative'` tag is for polarity reading, not tick gating.
- **`Burn × Purifier`-style "tick faster" doesn't apply.** The shift's `'permanent'` durationMode means time-decrement doesn't fire, so Purifier's tick-amount multiplier is inert here. Intentional — the shift is meant to persist battle-long.
- **The shift isn't currently dispel-able.** No v1 ability dispels `'dispellable'`-tagged statuses (per the v1 ability roster). The tag is forward-compatible for future content; v1 has no consumer.
- **Display name surfaces twice in the action log** — once for the apply event (when the resolver emits `system_apply_status`), once if the status is later removed. The customState's `displayName` is read by display-side code; ADR-0066 doesn't specify the rendering surface, just the storage.

## Alternatives considered

**Sibling types per source.** Rejected — see Rationale. Would inflate the catalog and require new boilerplate per future wand.

**Hybrid: parametric type, displayName from the applying ability's name.** Rejected — coupling the displayed name to the ability id means renaming the ability would silently rename the status. The explicit displayName in customState makes the displayed string a deliberate authoring choice.

**STACK_ADDITIVE with multi-tag magnitude.** Rejected — the magnitude field is a single number; encoding multi-tag deltas as magnitude would require a parallel customState anyway, defeating the stacking rule's design.

**Status with `magnitude` field carrying a Record<DamageTag, number>.** Rejected — `magnitude` is typed `number` per `StatusInstance`; widening it cascades through the engine. customState exists precisely for this kind of parametric per-instance data.

**`'conditional'` duration mode.** Rejected — `'conditional'` ticks via a predicate fire. The shift has no fire event; it just exists. `'permanent'` is the clearer choice.

## References

- `src/content/statuses/tagged-resistance-shift.ts` — the status type.
- `src/content/abilities/wand-of-depths-apply-shift.ts` — first applying ability (Wand of the Depths' on-hit).
- `src/content/abilities/wand-of-deepwood-apply-shift.ts` — second applying ability (Wand of the Deepwood's on-hit).
- `src/engine/types/duration-mode.ts` — `'permanent'` mode definition.
- `src/engine/status/apply.ts` — `applyStatus` flow; `customState` passthrough.
- `src/engine/status/stacking.ts` — `STACK_INDEPENDENT` rule.
- `src/engine/hooks/runners.ts` — `runModifyResistance` additive chain.
- `src/engine/actions/session-31-integration.test.ts` — composition / cancellation / battle-long tests.
- ADR-0015 — signedMax resistance composition (per-tag baseline).
- ADR-0027 — `'permanent_per_unit_ct'` precedent.
- ADR-0030 — `composeApplyState` / customState pipeline.
- ADR-0056 — `modifyResistance` hook surface; equipment contributor pattern.
- ADR-0057 — absorption activation (consumer of post-modifyResistance values).
