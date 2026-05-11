## ADR-0056: Equipment contributor registration pattern + four new modifier hooks

**Status:** Accepted
**Date:** 2026-05-11

## Context

Session 27 (Phase C opener) lands the engine prep for the equipment-doc effects that ship in Sessions 29+. Two coupled changes:

1. **Four new hook surfaces** — `modifyMpCost`, `modifyActionSpeed`, `modifyResistance`, `modifyIncomingStatusApplicationChance` — needed to express Staff of Power × 1.20 MP, Wand of Deepwood +5 actionSpeed for Earth, Capacitor Ring +50 Lightning resist, Pointy Hat +50 Silence resist, Focus Band +25 negative-tag resist, and the dozen-odd other equipment effects from `docs/twentyOnePlanning/mage-war-equipment.md`.

2. **Equipment contributor refactor** (audit E4). Pre-Session-27 `equipmentContributionsFor` early-returned for every hook except `modifyStatQuery`. Adding equipment integration for a new hook meant adding a branch to the dispatch; with four new hooks landing simultaneously, the branch chain wanted refactor first.

Two implementation questions had to settle:

1. **Registration pattern shape.** The current dispatch is a hardcoded guard at line 53 of `src/engine/items/contributions.ts`. Two reasonable refactor shapes:
   - **Eager module-load registration** — each contributor module calls `registerEquipmentContributor(hookType, fn)` at import. Simple, but introduces import-order side effects.
   - **Lazy map literal** — a central `EQUIPMENT_CONTRIBUTORS: { [K in HookName]?: ContributorBuilder<K> }` map keyed by hook name. Inspectable in one place; no side-effects-at-import.

2. **Hook composition shapes.** Each new hook chose between:
   - **Value-passing chain** (mirrors `modifyStatQuery`): handler returns the modified value; runner threads.
   - **Factor accumulator** (an alternate shape no current runner uses): handler returns a factor; runner collects the product/sum.

   Value-passing is what every existing runner uses; consistency wins.

## Decision

**Lazy map literal for the contributor registry. Four new hooks land as value-passing chains, each following the canonical shape of its closest existing sibling (`modifyHitChance` for multiplicative, `modifyStatQuery` for additive).** New per-hook contributor functions live alongside `statQueryContributor` in `src/engine/items/contributions.ts` and are wired into the same `EQUIPMENT_CONTRIBUTORS` map.

Per-hook details:

- **`modifyMpCost`** — multiplicative value-passing chain. Caster-side (handlers fire on the unit casting). Handler shape: `(args) => args.baseCost * factor`. Read through new helper `computeMpCost(state, catalog, unitId, abilityId)`; reducer, validator, AI's `canAfford`, UI's `computeAbilityDisableReason`, and forecast's `casterMpAfter` all route through it. Final value is rounded half-up at the helper exit and floored at 0. Free abilities (class-granted) short-circuit before the chain.

- **`modifyActionSpeed`** — additive value-passing chain. Caster-side. Handler shape: `(args) => args.baseActionSpeed + delta`. Applied at commit time via `computeBaseActionSpeed(state, catalog, unit, ability)`; the result is stored on `ChargedAction.speed` (matching the existing pattern: ChargedAction.speed is the canonical commit-time value, `computeActionSpeed` reads it back at projection time and applies the Stop pause). Tag-conditional contributors inspect `args.ability.effects.damage?.tags` to gate (Wand of Deepwood). The line-264 `ability.actionSpeed > 0` charged-vs-instant gate stays on the **unmodified** base value — equipment cannot flip a charged ability into an instant one or vice versa. The result is clamped to `>= 1` when the base is positive to preserve the invariant.

- **`modifyResistance`** — additive value-passing chain. Target-side (handlers fire on the resistance owner). Handler shape: `(args) => args.baseValue + delta` (typically gated on `args.tag`). Read by `composeResistance` (damage pipeline) per damage tag, and by `lookupStatusResistance` (status apply formula) for the status type's `resistanceTag`. **The previous cap-at-100 has been lifted** (see ADR-0057). `composeResistance` includes a tag in the signedMax list iff the unit natively carries it OR a contributor produces a non-zero value — preserves ADR-0015's "skip absent" rule while allowing equipment to introduce resistance to tags the unit doesn't natively have.

- **`modifyIncomingStatusApplicationChance`** — multiplicative value-passing chain. **Target-side** (mirror of existing caster-side `modifyStatusApplicationChance`). Handler shape: `(args) => args.baseChance * factor`. Composes after the caster-side chain in `computeStatusChance`: `final = base × ∏casterHooks × ∏targetHooks`. Final probability is clamped to `[0, 1]` at the existing exit clamp.

## Rationale

**Lazy map over eager registration.** The map is inspectable in one place — every hook the equipment system contributes to is visible from a single literal. No import-order subtleties (a contributor module hidden behind a different entry's import can't accidentally suppress its registration). The cast at lookup (`as EquipmentContributor<K> | undefined`) is the type-system tax for a uniform-shape map keyed by a string union; it's contained to one site.

**Value-passing chains over factor accumulators.** Every existing runner uses value-passing. New runners follow the convention so handler authors don't have to remember which shape applies to which hook. The composition style (additive vs. multiplicative) lives inside the handler body, not the runner's plumbing — `(args) => args.baseChance * factor` is multiplicative; `(args) => args.baseValue + delta` is additive. The runner just threads.

**Side selection follows the natural owner.** `modifyMpCost` and `modifyActionSpeed` fire on the caster because cost / cast-speed belong to the actor (the actor's gear pays; the actor's class makes the ability free). `modifyResistance` and `modifyIncomingStatusApplicationChance` fire on the target/recipient because resistance and status immunity belong to the defender. The naming mirrors ADR-0028's tier ordering of caster vs. target hook surfaces.

**Round half-up for MP.** Matches the project's convention elsewhere for damage / heal rounding. Banker's rounding would be a defensible alternative but produces less predictable balance discussions ("Staff of Power on a 7-MP ability costs 8 or 9?"). Half-up is the BMG-style answer; content authors can tune base values to land cleanly.

**Floor MP at 0 (no refund).** Equipment authors can only multiply; the floor protects against authoring mistakes (a negative multiplier shouldn't refund MP) and matches the damage pipeline's clamp-at-0 for over-applied multipliers.

**Clamp action speed at 1 when base > 0.** Without this clamp, a `−10 actionSpeed` item on a `5 actionSpeed` ability would produce a stored `−5` speed — the projection scheduler would treat it as either zero or negative-progress, and the charged-vs-instant nature would be ambiguous. The clamp preserves the contract: a charged ability stays charged; an instant ability stays instant; only the magnitude shifts.

**ChargedAction.speed stores the modified value, not the base.** The existing comment on `computeActionSpeed` says "the field is the canonical value" — modifications by abilities (Hasten Charge, Slow Action) mutate it in place. Equipment contributors fold in at commit, the way Hasten Charge folds in at apply time. This matches the existing semantic: in-flight charges remember their committed speed; mid-charge re-equipping has no effect on already-spawned ChargedActions.

**`computeMpCost` is the chokepoint.** The reducer-side reads (MP deduction, outcome recording in instant and charged paths), the validator's affordability check, the UI's disable-reason hover, the forecast's `casterMpAfter`, and the AI's `canAfford` all route through one helper. Adding a new read site adds one call to that helper, not five. The discipline is the same as `getCost` for bucket capacity and `computeSpeed` for unit speed.

## Consequences

- **Contributor refactor lands behavior-preserving.** All 725 pre-Session-27 tests continue to pass after the map dispatch replaces the line-53 guard — refactor preservation is implicitly verified by the existing suite.

- **`ItemDefinition` gains four optional fields:** `mpCostMultipliers`, `actionSpeedModifiers`, `resistanceMods`, `incomingStatusModifiers`. v1 items don't declare them (no behavior change); Session 29 populates them on real content (Staff of Power, Wand of Deepwood, Capacitor Ring, Pointy Hat, Focus Band, etc.).

- **New types** `ActionSpeedModifier` and `IncomingStatusModifier` capture the shape for tag-conditional and per-type/per-tag dispatch. Both are content-driven and may evolve as Session 29 reveals real-content needs.

- **`computeStatusChance` shape changes.** The function now calls two modifier hooks instead of one (the existing caster-side and the new target-side). The exit clamp at `[0, 1]` is unchanged; existing behavior for v1 statuses (Earth Communion's × 1.25) is preserved because the target-side chain is empty.

- **`computeMpCost`, `computeBaseActionSpeed`, the helper exports** add one entry each to the `engine/abilities/` and `engine/ct/` public barrels. Consumers (reducer, validator, forecast, AI, UI) import via those barrels.

- **Action-menu UI display polish deferred.** `AbilityButton` (`src/ui/action-menu.tsx:361-362`) still reads `ability.mpCost` and `ability.actionSpeed` directly for display. With no v1 item declaring `mpCostMultipliers` / `actionSpeedModifiers`, the displayed value matches the committed cost. When Session 29 ships items, threading `state` + `catalog` to `AbilityButton` becomes that session's UI polish.

- **Tag-conditional contributor signature inspects ability content directly.** `actionSpeedContributor` reads `args.ability.effects.damage?.tags` to gate. This couples the contributor to ability-effect shape; if a future ability declares damage tags somewhere other than `effects.damage.tags`, the gating logic needs to widen. Acceptable today — every v1 damage-tagged ability stores tags in this canonical location.

- **Free-ability MP short-circuit kept.** `computeMpCost` returns 0 for class-granted free abilities without firing the chain. A `× 5.0` MP-cost contributor on a free ability still costs 0 — the multiplication of 0 is mathematically the same as the short-circuit, but the short-circuit keeps the contributor surface honest about which calls fire.

## Alternatives considered

**Eager registration via `registerEquipmentContributor(hookName, fn)` side-effect at import.** Rejected — introduces import-order coupling. The registry isn't inspectable in one place; finding "what does equipment contribute to `modifyMpCost`?" means grep across all contributor modules. The map literal is the simpler answer for v1's contributor count.

**Single combined `equipmentEffects` field on `ItemDefinition` (replacing all four optional fields with one tagged-union array).** Rejected for v1 — the four fields each have a distinct shape (multipliers are numbers, action-speed mods are tagged objects, resistance is a Map, incoming-status is a tagged-union array). A combined field would force a discriminator-laden union onto every authoring site. Better to keep the field shapes specific until a refactor pressure surfaces.

**Per-hook contributors in separate modules under `src/engine/items/contributors/`.** Rejected — premature. The four contributors fit in ~100 LOC alongside `statQueryContributor`. Splitting to one-per-file would multiply imports without improving discoverability. Revisit if the contributor count grows past ~8.

**Apply `modifyActionSpeed` at projection/read time (per-tick) instead of commit time.** Rejected — would conflict with the existing "ChargedAction.speed is canonical" comment and require mid-charge equipment events to re-emit (no v1 scenario calls for this). Commit-time application matches Hasten Charge / Slow Action's pattern: actions that modify in-flight charges mutate the stored value directly.

**Use `runModifyResistance` inside `composeResistance` (one chain call per tag).** Rejected — `composeResistance` collects the handler list once and threads each tag through, avoiding the cost of re-collecting per tag. The runner is used for `lookupStatusResistance` (single-tag call), where one collection is fine.

## References

- `src/engine/items/contributions.ts` — `EQUIPMENT_CONTRIBUTORS` map + per-hook contributors.
- `src/engine/hooks/hooks.ts` — `HookSignatures` (the four new entries).
- `src/engine/hooks/runners.ts` — `runModifyMpCost`, `runModifyActionSpeed`, `runModifyResistance`, `runModifyIncomingStatusApplicationChance`.
- `src/engine/abilities/cost.ts` — `computeMpCost` helper.
- `src/engine/ct/speed.ts` — `computeBaseActionSpeed` helper.
- `src/engine/damage/handlers.ts` — `composeResistance` (per-tag chain integration); `resistanceCheck` (cap lifted); `clampMinMax` (absorption tag-flip).
- `src/engine/status/chance.ts` — `lookupStatusResistance` (chain integration); `computeStatusChance` (target-side composition).
- `src/engine/catalog/definitions/item-definition.ts` — four new optional fields.
- `src/engine/actions/session-27-integration.test.ts` — integration tests.
- ADR-0015 — multi-tag damage composition via signedMax (preserved by the "include only if native or contributor-modified" rule).
- ADR-0028 — equipment integration; the established pattern this ADR extends.
- ADR-0053 — `onTurnEnd` emission widening (the recent precedent for adding a hook surface).
- ADR-0057 — resistance absorption activation (the coupled-but-distinct decision; supersedes ADR-0022).
