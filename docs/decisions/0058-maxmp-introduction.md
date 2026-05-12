## ADR-0058: `maxMp` introduction + additive-then-multiplicative stat composition

**Status:** Accepted
**Date:** 2026-05-12

## Context

Session 28 (Phase C Cluster 4) introduces MP as a first-class composable stat so equipment can shift MP capacity the same way it shifts HP. The Mage War equipment doc calls for:

- **Wizard's Robe** — additive `+40 MP` (Mages only)
- **Pointy Hat** — additive `+20 MP` (Mages only)
- **Sorcerer's Robe / Silvered Vest** — additive `+30 MP`
- **Focus Band** — additive `+10 MP`
- **Staff of Abundance** — **multiplicative** `MaxMP +50%` (×1.5)

Two coupled problems:

1. **No MP stat exists in the query layer.** Pre-Session-28, `vitals.mp` was a flat per-placement integer, set at battle start and not modified by equipment. The renderer captured `unit.vitals.mp` at mount and used it as the MP bar's max for the whole battle. AI's `canAfford` read current MP correctly but had no MP-cap surface for future cap-aware features. The four Mage classes ship with `mp: 60` in `demo.ts`; Knight ships with `mp: 20`.

2. **`ItemDefinition.statMods` is additive-only.** `Partial<BaseStats>` deltas compose additively through `modifyStatQuery` per the existing equipment contributor (`statQueryContributor`). Staff of Abundance's `MaxMP × 1.5` cannot be expressed in the current shape.

Three implementation questions had to settle:

1. **Per-class baseline placement.** Move MP baselines from per-placement `vitals.mp` to per-class `maxMpBase` on `BaseStats`, mirroring `maxHpBase`'s pattern. Lets `fillVitalsFromComputedMaxes` derive `vitals.mp` from the queried max at battle start (post-equipment), so Wizard's Robe / Staff of Abundance bumps land before the first turn.

2. **Multiplicative authoring shape.** Two reasonable shapes:
   - **`statModsMultiplicative?: Partial<Record<StatName, number>>`** — a sibling field on `EquipmentBase`, keyed by query StatName (so authors write `{ maxMp: 1.5 }`).
   - **Discriminated-union effects array.** A `statModEffects?: ReadonlyArray<{ kind: 'add' | 'mul'; stat: StatName; value: number }>` shape.

3. **Composition order within the Equipment tier.** When both Wizard's Robe (+40 additive) and Staff of Abundance (×1.5 multiplicative) are equipped, two reasonable orderings produce different results: `(60 + 40) × 1.5 = 150` vs `(60 × 1.5) + 40 = 130`. ADR-0056's existing "per-handler tieBreakIndex orders within the tier" rule doesn't pick between them — it depends on slot iteration order and which field is read first.

## Decision

**Add `maxMpBase: number` to `BaseStats`, add `'maxMp'` to the `StatName` union, extend `STAT_MOD_KEYS` with `{ statKey: 'maxMpBase', statName: 'maxMp' }`. Add an optional `statModsMultiplicative?: Partial<Record<StatName, number>>` field on `EquipmentBase` keyed by query StatName. The equipment contributor (`statQueryContributor`) yields ADDITIVE handlers in pass 1 and MULTIPLICATIVE handlers in pass 2 — within the Equipment tier, every additive handler runs before any multiplicative one.**

Per-class baselines populated:
- **Knight**: `maxMpBase: 20` (5× Cure)
- **Earth / Water / Fire / Lightning Mages**: `maxMpBase: 60` (consistent with the spec's L25 targets)

The `demoBattle` placements drop explicit `vitals` overrides; `fillVitalsFromComputedMaxes` derives both `hp` and `mp` from computed maxes at battle start (post-equipment, post-status, post-passive).

**Renderer's MP bar max** reads through `runModifyStatQuery(state, catalog, { unit, statName: 'maxMp', baseValue: unit.baseStats.maxMpBase })` per frame — no mount-captured cache.

## Rationale

**Mirror `maxHpBase` exactly.** `maxHp` already follows the "stored baseline + queried effective" pattern, with the storage key (`maxHpBase`) distinct from the query name (`maxHp`). MP follows the same convention: `maxMpBase` stored on `BaseStats`, `'maxMp'` in the StatName union, `STAT_MOD_KEYS` mapping the two together. The pattern is established; following it keeps the surface uniform.

**`statModsMultiplicative` over a discriminated-union array.** ADR-0056's reasoning for rejecting a combined `equipmentEffects` field carries through: the new field has a distinct shape (multiplicative factors keyed by StatName) and a small authoring surface (one new optional field). A union-typed array would force every author to write `{ kind: 'mul', stat: 'maxMp', value: 1.5 }` for one line of intent. The field's name is its discriminant.

**Key by query StatName, not storage key.** `statMods` keys by `keyof PartialBaseStats` (`maxHpBase`, `maxMpBase`) because the additive contributor reads through the `STAT_MOD_KEYS` mapping. `statModsMultiplicative` skips the mapping — authors write `{ maxMp: 1.5 }` directly. Cleaner authoring; the multiplicative contributor reads the StatName key and applies if `args.statName` matches. The asymmetry between the two fields' keying is mildly awkward but the Staff-of-Abundance-style readability win (`{ maxMp: 1.5 }` vs `{ maxMpBase: 1.5 }`) is worth it.

**Two-pass yield: additives before multiplicatives.** The contributor's single generator yields all additive handlers in pass 1 (outer loop: item; inner loop: STAT_MOD_KEYS), then all multiplicative handlers in pass 2 (outer loop: item; inner loop: statModsMultiplicative entries). A shared `tieBreakIndex` counter increments across both passes — pass-1 indices come strictly before pass-2 indices. The collector's per-tier ordering applies `tieBreakIndex` after `priority` and `tier`, so equipment-tier additives run before equipment-tier multiplicatives regardless of slot iteration order or which item declares which field.

This produces the **intuitive balance answer**: `Mage at base 60 + Wizard's Robe +40 + Staff of Abundance ×1.5 → (60 + 40) × 1.5 = 150` instead of `(60 × 1.5) + 40 = 130`. The convention matches how tactical-RPG balance is typically described ("+40 then ×1.5" reads naturally as "add the flat bonus, then apply the percentage"). The Staff-of-Abundance ×1.5 magnifies the Mage's base + equipped MP rather than the bare base.

**Factor 1.0 short-circuits.** A multiplicative entry of `{ maxMp: 1 }` yields no handler — multiplying by 1 is a no-op, and the contributor's "skip when delta === 0 / factor === 1" guard keeps the surface clean for authors who declare a placeholder factor for symmetry.

**Renderer reads per frame.** Each tick of `applyVisualState` runs `runModifyStatQuery` for each unit's `maxMp`. With ~6 units on the demo battlefield and the chain at v1 length, the cost is trivial (sub-millisecond at 60fps). The alternative of state-change-subscription would couple the renderer to engine event listeners; per-frame keeps the renderer's read-only state-as-snapshot architecture intact. HP-max stays mount-captured for now (no v1 equipment modifies it mid-battle; lift can follow if needed).

**`fillVitalsFromComputedMaxes` reworked.** Pre-Session-28 the function fills `hp` from computed maxHp and `mp: 0` when placement omits vitals; it early-returned when *all* placements supplied explicit vitals. Post-Session-28 it fills both `hp` and `mp` from computed maxes when placement omits vitals, and the early-return triggers only when no placement needs filling. Existing tests that set explicit `placement.vitals` keep working unchanged.

## Consequences

- **`BaseStats` gains one required field.** Every test fixture and inline literal constructing `baseStats` needs `maxMpBase`. Updated this session: `src/engine/ct/test-fixtures.ts` (fixture default 50), `src/engine/actions/session-17c-integration.test.ts`, `src/engine/actions/session-18-integration.test.ts`, `src/engine/setup/create-initial-state.test.ts`, `src/engine/setup/initial-ct-variance.test.ts`, `src/ai/basic.test.ts`. Future inline `baseStats: { ... }` literals must include the field.

- **`StatName` union gains `'maxMp'`**. New `STAT_MOD_KEYS` entry maps storage→query. `runModifyStatQuery('maxMp', ...)` returns the composed value; `runModifyStatQuery('maxMp', baseValue: 0)` on a unit with no maxMpBase returns 0 (handlers compose on top of whatever baseValue the caller passes).

- **`EquipmentBase.statModsMultiplicative` is optional.** No v1 item declares it; Session 29 populates it on Staff of Abundance. The Pointy Hat / Sorcerer's Robe / Wizard's Robe / Silvered Vest / Focus Band MP boosts ride on the existing additive `statMods` field.

- **`demoBattle` placements drop `vitals: ...`**. Every existing test that calls `loadDemoBattle()` or `createInitialState(demoBattle)` now sees mp=20 (Knight) / mp=60 (Mages) derived from `maxMpBase` rather than directly from `vitals.mp`. Behavior is identical because the previous explicit values exactly matched the new baselines.

- **Renderer no longer caches `maxMp`.** `BattleRenderer.maxMp` Map removed; the per-frame query replaces it. The "v1 has no maxMp stat" comment is gone. Future MP-restoration sources (potions, MP-gain procs) automatically compose because the renderer queries fresh each frame.

- **AI projection documents the maxMp read.** `projection.ts` header comment documents that future MP-cap-aware features (drains, opportunistic over-pour) must use `runModifyStatQuery('maxMp', ...)`, not `vitals.mp`. v1 AI's MP awareness is limited to `canAfford`'s current-MP check, which doesn't need maxMp.

- **Composition-order tests live in `session-28-integration.test.ts`.** Five tests pin the additive-then-multiplicative rule including the `(60 + 40) × 1.5 = 150` flagship scenario plus a slot-flip variant (multiplicative on armor, additive on accessory — same answer because the pass ordering is field-driven, not slot-driven).

- **`vitals.mp` semantics narrow.** `vitals.mp` is current MP only. Code reading it as a max-cap is a bug; the audit confirmed no current callers do this. The AI projection note is the formal documentation.

## Alternatives considered

**Move per-class baselines to `ClassDefinition.baseStats`.** Rejected for v1 — `ClassDefinition` doesn't carry `BaseStats` today; placement-side stat blocks are the v1 pattern. Moving baselines to the class would touch every class definition and break the placement-overrides pattern that lets a unit ship with non-class-default stats (e.g., a Knight at PA 7 instead of 11). Revisit when team-builder lands (Session 36) and class-derived stat curves arrive.

**Multiplicative-only authoring (drop `statMods` additive, replace with multiplicative-only).** Rejected — the equipment doc has a mix of additive (`+40 MP`, `+90 HP`, `+1 PA`) and multiplicative (`×1.5 maxMp`) effects. Forcing every author to express additive boosts as small multipliers (`+40 MP on a 60-base unit = ×1.667`) is the opposite of readable; coupling additive magnitudes to base values is exactly the kind of brittle authoring CLAUDE.md warns about.

**Per-handler ordering tag (`order: 'additive' | 'multiplicative'`) on each contribution.** Rejected — every additive contributor would need to declare `order: 'additive'` to maintain the invariant, and a forgotten declaration would silently produce the wrong answer. The two-pass yield in the contributor body is mechanically enforced; authors can't get the ordering wrong.

**Composition order based on tieBreakIndex alone (no two-pass yield).** Rejected — slot iteration order is `leftHand → rightHand → headgear → armor → accessory`, so whether the Mage's Robe (armor slot) runs before or after the Staff (accessory slot) depends on which slot they sit in. A Mage equipping the Staff in the right hand instead of as an accessory would flip the order. Two-pass yield is invariant to slot placement.

**Round-half-up on the multiplicative result.** Rejected — the existing query-chain pattern returns the raw value; rounding decisions live at the consumer site (`Math.floor(maxHp)` in `fillVitalsFromComputedMaxes`, `Math.floor` in the renderer). Per-stat rounding policy would diverge from how `maxHp`, `pa`, `ma` already work.

**Lift HP-max to per-frame query too.** Rejected for this session per the brief's narrow scope. `unit.baseStats.maxHpBase` is the current snapshot read in the renderer; no v1 equipment modifies maxHp mid-battle in a way that would surface a divergence. Lift can follow when content surfaces the need.

## References

- `src/engine/types/stats.ts` — `BaseStats.maxMpBase`.
- `src/engine/types/stat-name.ts` — `'maxMp'` added to the StatName union.
- `src/engine/items/contributions.ts` — `STAT_MOD_KEYS` extension; two-pass `statQueryContributor`.
- `src/engine/catalog/definitions/item-definition.ts` — `statModsMultiplicative` field.
- `src/engine/setup/create-initial-state.ts` — `fillVitalsFromComputedMaxes` rework.
- `src/content/battles/demo.ts` — per-class `maxMpBase` baselines (Knight 20, Mages 60); explicit `vitals` overrides removed.
- `src/renderer/battle-renderer.ts` — `maxMp` Map removed; `applyVisualState` per-frame query.
- `src/ai/projection.ts` — forward-looking maxMp read documentation.
- `src/engine/actions/session-28-integration.test.ts` — composition tests.
- ADR-0028 — equipment integration (the established pattern this ADR extends).
- ADR-0056 — equipment contributor registration pattern (the precedent for adding hook-driven equipment fields).
- ADR-0059 — `modifyBucketCapacity` (Session 28 sibling).
- ADR-0060 — `modifyStatusTickAmount` (Session 28 sibling).
