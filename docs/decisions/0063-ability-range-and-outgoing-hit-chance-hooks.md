## ADR-0063: `modifyAbilityRange` and `modifyOutgoingHitChance` hooks; classRestrictions, evasionMods, movementMods fields

**Status:** Accepted
**Date:** 2026-05-12

## Context

Session 29's content batch surfaced four equipment effects that don't fit ADR-0056's four-hook surface or Session 28's three-hook structural pass:

1. **Wand of Depths "+1 horizontal/+1 vertical range on Water-tagged spells"** — needs a per-axis ability-range modifier hook. No existing surface modifies ability range; the read site (`ability.targeting.range.horizontal/vertical`) is bare-field across `validateAction`, AI targeting helpers, and the UI's target-picker.

2. **Arcane Lens "weapon accuracy × 1.10"** — caster-side hit-chance multiplier. `modifyHitChance` exists but is target-side (Blind). Caster-side accuracy modulators need a separate hook (mirror of `modifyIncomingStatusApplicationChance`'s caster/target mirroring from ADR-0056).

3. **Steel Helm "-20 Side/Back Evade"** — per-facing evasion contributors. `modifyEvasion` hook exists with `{ unit, attacker, baseEvasion, facing }` args; equipment hadn't contributed to it. The audit also confirmed no clamp prevents negative evasion (the existing damage-pipeline final `[0.05, 1.0]` hit-chance clamp prevents overflow above 100%).

4. **Lightfoot "+1 Move, +1 Jump, +1 Speed"** — moveRange/jump live on `ClassMovementBaseline`, not BaseStats. The existing `statMods: PartialBaseStats` shape can't carry them.

Plus **`classRestrictions`** on EquipmentBase to gate Knight-only and Mage-only items.

## Decision

**Two new hooks land:**

- **`modifyAbilityRange`** — caster-side, per-axis additive chain. Args `{ unit, ability, baseHorizontal, baseVertical }`, return `{ horizontal, vertical }`. Equipment contributors read a new optional `abilityRangeModifiers?: ReadonlyArray<AbilityRangeModifier>` field on `EquipmentBase` where each entry is `{ deltaHorizontal?, deltaVertical?, tagFilter? }`. New helper `computeAbilityRange(state, catalog, unitId, ability)` is the chokepoint; `validateProposedAction`, the AI's `positionInAbilityRange` / `tilesInAbilityRange`, and the UI's tile-picker overlay all route through it.

- **`modifyOutgoingHitChance`** — caster-side mirror of existing target-side `modifyHitChance`. Args `{ attacker, target, ability, baseHitChance }`, multiplicative value-passing chain. Equipment contributors read a new `outgoingHitChanceMultipliers?: ReadonlyArray<number>` field. Composes after the target-side chain inside `evasionCheck`:
  ```
  final = base × ∏targetHooks × ∏casterHooks
  ```
  The combined product clamps to `[0.05, 1.0]` at the existing exit clamp.

**Three new equipment fields without new hook surfaces:**

- **`classRestrictions?: ReadonlyArray<ClassId>`** — validated at `createInitialState` alongside the existing `ClassEquipmentSlots` check. Throws `BattleConfigError` with a clear message naming the violation. Empty / omitted = no restriction.

- **`evasionMods?: { front?, side?, back? }`** — equipment contributor registers one handler against `modifyEvasion` (existing hook) that reads `args.facing` and adds the matching delta. Negative deltas are valid (Steel Helm's "invite attacks" identity); the final hit-chance clamp at `[0.05, 1.0]` prevents overflow above 100%.

- **`movementMods?: Partial<Record<'moveRange' | 'jump', number>>`** — composes through existing `modifyStatQuery` for the moveRange / jump query stats. The equipment contributor's pass-1b (additive) yield walks `movementMods` alongside the BaseStats-keyed `statMods`, emitting one handler per (statName, delta) entry. Lightfoot's `{ moveRange: 1, jump: 1 }` is the v1 consumer.

**Hook surface grows by two** (ADR-0058 + ADR-0059 + ADR-0060 + this ADR's two = six new hooks across Sessions 27-29). Per CLAUDE.md ground rule 8, the additions are deliberate engine changes documented here.

## Rationale

**Per-axis range hook over scalar.** Wand of Depths declares +1 to both axes — a two-axis return shape is the natural fit. A single-axis hook would force authors to register two handlers per item with cross-axis duplication; the per-axis return shape keeps the equipment field tight (`{ deltaHorizontal: 1, deltaVertical: 1, tagFilter: ['water'] }`).

**`computeAbilityRange` chokepoint over scattered reads.** Pre-Session-29, `ability.targeting.range.horizontal` was read at five sites (validator twice; AI helpers twice; UI picker once). Threading each through the chain individually means an author adding a new range-modifying piece of content has to remember which sites to update. One helper, one update site (per future read) — matches `computeMpCost` / `computeBaseActionSpeed` / `getCapacity`.

**Caster-side `modifyOutgoingHitChance` over extending target-side `modifyHitChance`.** ADR-0056's precedent: target-side `modifyHitChance` (Blind) paired with caster-side `modifyOutgoingHitChance` (Arcane Lens) follows the same pattern as ADR-0056's `modifyStatusApplicationChance` / `modifyIncomingStatusApplicationChance` pair. The hook owns its team; cross-team handlers compose multiplicatively. Final clamp lives where it already did (in `evasionCheck`'s exit).

**`evasionMods` on existing `modifyEvasion`.** No new hook surface; just a new equipment field. The contributor reads `args.facing` and gates per-direction. This is the smallest-possible engine touch — the hook signatures didn't need to grow.

**`movementMods` rides existing `modifyStatQuery`.** moveRange and jump are queryable stats (StatName entries used by movement profile / pathfinding). The equipment contributor emits `modifyStatQuery` handlers gated on `args.statName`; no new hook needed. The shape mirrors `statMods` but is keyed by query StatName directly (not BaseStats storage key) because moveRange/jump don't live on BaseStats. The asymmetry between `statMods` (BaseStats-keyed) and `movementMods` (query-StatName-keyed) is contained to the two fields' authoring sites.

**`classRestrictions` as a validator-only check.** The field doesn't compose through hooks — it's a binary "may this class equip this item" gate. Validated at `createInitialState` for v1; the future team-builder UI will pre-filter the equipment picker by `classRestrictions` so a Mage doesn't see Knight-only gear in the first place.

**Round-half-up not needed for outgoing hit chance.** Multiplication and clamping handle the math; the final-chance clamp at `[0.05, 1.0]` rounds the result down implicitly via the `Math.min(1.0, ...)` cap.

## Consequences

- **`HookSignatures` gains two entries.** `modifyAbilityRange` (caster-side, additive per axis) and `modifyOutgoingHitChance` (caster-side, multiplicative). The hook list grows from N to N+2 per CLAUDE.md ground rule 8.

- **`runners.ts` adds two runners.** `runModifyAbilityRange` and `runModifyOutgoingHitChance`. Both follow the canonical "collect handlers → thread value(s) through" shape.

- **`EQUIPMENT_CONTRIBUTORS` gains three entries.** `abilityRangeContributor`, `outgoingHitChanceContributor`, `evasionContributor` (new contributor for the existing `modifyEvasion` hook — equipment now contributes to it).

- **`EquipmentBase` gains five optional fields.** `classRestrictions`, `abilityRangeModifiers`, `outgoingHitChanceMultipliers`, `evasionMods`, `movementMods`. No v1 pre-Session-29 item declared any of them; Session 29 batch A populates each on real content.

- **New helper `computeAbilityRange`** centralizes the five read sites. Future ability-range reads add one call to the helper.

- **`evasionCheck` evolves from one chain to two.** Reads the target-side `modifyHitChance` chain (existing) AND the caster-side `modifyOutgoingHitChance` chain. The exit clamp is unchanged.

- **`STAT_MOD_KEYS` extends with `crit_chance`.** Arcane Lens's `+10 crit_chance` rides additive `statMods`; the contributor needs the storage→query mapping (identical for this stat). One-line addition.

- **`ShieldEquipment` new kind.** Shields now have a typed kind separate from weapons; the hand-slot validator accepts both. Three v1 shield items (Escutcheon, Warrior's Aegis, Managuard) all declare `kind: 'shield'` and `classRestrictions: [knight]`.

- **Sample item integrations pinned in `session-29-integration.test.ts`.** Staff of Power × 1.2 MP via `computeMpCost`, Wand of Deepwood +5 actionSpeed (Earth only), Capacitor Ring stacking with Lightning Mage's native +50 to land in absorption regime (per ADR-0057), Wand of Depths +1/+1 range on water spells, Steel Helm -20 side evasion, Lightfoot +1 moveRange / +1 jump.

## Alternatives considered

**Range hook returning a single scalar with author registering twice.** Rejected — per-axis return is cleaner.

**Extend target-side `modifyHitChance` to also collect caster handlers** (similar to how ADR-0056 mentioned but rejected for the four new hooks). Rejected — the two sides have distinct semantics; mixing them in one collector loses the per-side ownership signal.

**Class-restriction as a hook (`modifyEquipPermission`).** Rejected — class-restriction is a binary gate, not a composing value. A hook surface would over-engineer the check.

**Lift moveRange/jump onto BaseStats.** Rejected — they're class-derived (per `ClassMovementBaseline`), not per-unit base values. Lifting them would conflate two layers (class-derived vs. per-unit-overridable).

**Single field `statQueryMods?: Partial<Record<StatName, number>>` replacing both `statMods` and `movementMods`.** Considered for unification. Rejected — `statMods` is BaseStats-keyed for historical reasons (and author muscle memory); changing it would touch every existing item declaration. Keeping the two fields specific (one BaseStats-keyed, one StatName-keyed) is the smaller surface.

**Variance band on weapons** (axes' [0.9, 1.3] identity). Considered as part of this ADR. Rejected for Session 29 — variance currently sources from `ability.variance`, not weapon. Wiring weapon-sourced variance requires threading through the damage pipeline's variance stage; defer to a future session and flag in handoff.

## References

- `src/engine/hooks/hooks.ts` — `modifyAbilityRange` and `modifyOutgoingHitChance` signatures.
- `src/engine/hooks/runners.ts` — `runModifyAbilityRange`, `runModifyOutgoingHitChance`.
- `src/engine/items/contributions.ts` — three new contributors + `EQUIPMENT_CONTRIBUTORS` entries + STAT_MOD_KEYS `crit_chance` row + `movementMods` pass.
- `src/engine/catalog/definitions/item-definition.ts` — five new optional fields + `ShieldEquipment` kind + `AbilityRangeModifier` / `EvasionMods` interfaces.
- `src/engine/abilities/range.ts` — `computeAbilityRange` helper.
- `src/engine/actions/validate.ts` — range reads through `computeAbilityRange`.
- `src/ai/basic.ts` — range helpers thread the actor unit for `computeAbilityRange`.
- `src/ui/use-turn-flow.ts` — tile-picker reads `computeAbilityRange`; AbilityListPicker precomputes effective MP / action speed.
- `src/ui/action-menu.tsx` — `AbilityButton` displays precomputed effective values.
- `src/engine/damage/handlers.ts` — `evasionCheck` runs target-then-caster hit-chance chains.
- `src/engine/setup/create-initial-state.ts` — `classRestrictions` validation.
- `src/engine/items/equipment.ts` — hand-slot validator accepts shields.
- `src/engine/actions/session-29-integration.test.ts` — coverage.
- ADR-0056 — equipment contributor registration + four new hooks pattern.
- ADR-0057 — absorption activation (Capacitor Ring hits this).
- ADR-0058 / ADR-0059 / ADR-0060 — Session 28's structural fold-ins (sibling hooks).
- ADR-0061 — loadout shape change (Session 29 sibling).
- ADR-0062 — same-team reaction skip (Session 29 sibling).
