## ADR-0083: Bow weapon substrate — two-handed, weapon-sourced range, height-delta variance, and the Hunter's reposition/accuracy/CT mechanisms

**Status:** Accepted
**Date:** 2026-05-22
**Session:** 45

## Context

S45 introduces the **Hunter** (the 8th class, balancing the roster at 4 physical / 4 magical) and the **bow** weapon class — the first *ranged* weapon in the game. Bows need substrate the melee-only roster never required:

- Weapons that occupy both hands (no off-hand, no shield).
- Attacks that fire at a distance with a minimum range (a dead zone up close).
- Variance that depends on the shot's *elevation*, not just the attacker.
- A doubled accuracy passive (Eagle Eye), a charged physical attack, a repositioning hop (Scramble), and a water-flavored on-hit CT-push proc (Riptide Bow).

A current-tree audit (per S40/S42/S43 precedent) found the engine cleaner than feared: most pieces were additive or one-function extensions, and two of them needed **no new substrate at all** — the existing surface already covered them. The brief had pre-specified a new `modifyAccuracy` hook and a new `scramble` ActionType; the audit showed both were avoidable, and Chris confirmed the leaner paths in plan-review.

## Decision

### 1. Two-handed weapons — `WeaponEquipment.twoHanded?`

A boolean flag on the weapon definition. Equipment slotting (`validateEquipmentPlacement` in `create-initial-state.ts`) rejects any item in the *other* hand when a hand holds a two-handed weapon. Because the off-hand is then necessarily empty, the Two Weapons multi-swing loop (`attackingWeaponSlots`, ADR-0080) collapses to a single swing with **no change** — it already requires weapons in both hands. The team-builder picker auto-clears the off-hand on a two-handed equip and grays it out; `computeTeamValidity` mirrors the engine rule for loaded-template safety.

### 2. Weapon-sourced range — `WeaponEquipment.range` + a fork in `computeAbilityRange`

The universal `attack` ability hardcodes `range.horizontal: 1`, and no prior weapon carried range (all melee). Rather than splitting `attack` per weapon, the weapon carries its reach — exactly the ADR-0067 reasoning for weapon-sourced variance. `computeAbilityRange` forks: for a **weapon-tagged physical** ability (`damage.tags` includes `'weapon'`), if the equipped weapon declares `range`, that range (`min` / `max` / optional `vertical`) overrides the ability's declared band; the hook chain still composes on top. Single chokepoint, so validation, AI targeting, and the UI overlay all inherit it for free.

The range floor (`minHorizontal`) and `inRange`'s floor check already existed (unused by melee content) — so min-range was *geometry-complete*; only the weapon-sourcing was new. Weapon-tagged Battle Skills (Lightning Stab) inherit the bow's range too: Knight + Longbow + Lightning Stab is a deliberate ranged-status-applier, enabled by this fork.

### 3. Height-delta variance — a `height_delta` arm on `WeaponPhysicalVariance`

The variance discriminated union (ADR-0078) gains `{ kind: 'height_delta'; falloffPerHeight }`. It is the **first arm that reads the target**, so `resolvePhysicalVarianceBand` gained a `target: Unit` parameter (threaded through its three call sites: the live `varianceRoll` handler, the AI projection, and the UI damage-range forecast — `ctx.target` / `args.target` were already in hand at each). The band collapses to a deterministic point: `Max(0, 1 − falloffPerHeight × (targetElev − attackerElev))`. The Longbow's `0.2` gives same-height ×1.0, 4-up ×0.2, 5+-up ×0 (clamped, no negative damage), 5-down ×2.0 — the high-ground reward.

### 4. Accuracy doubling — reuse `modifyOutgoingHitChance`, **no new hook**

The brief specified a new `modifyAccuracy` hook. But `computeOutgoingHitChance` already runs a caster-side multiplicative `modifyOutgoingHitChance` (ADR-0063), and it only fires for physical attacks (the function early-returns `1.0` for non-physical). Eagle Eye registers that existing hook returning `× 2.0`. Multiplication commutes through the evasion/elevation factors and lands before the `[0.05, 1.0]` clamp, so it is mathematically identical to multiplying the raw accuracy term. Per ground rule 8 (the hook surface is closed; don't grow it without need), a parallel hook was redundant.

### 5. Charge-time for physical attacks — **no change**

Charged Attack is a physical bow attack with `actionSpeed: 25`. The audit confirmed the charge gate (`ability.actionSpeed > 0 && !isRider`) is flavor-agnostic — nothing keyed on magic. So a physical charged attack works with zero substrate change; only the content was authored. (The brief's contingency ADR-0084 for "charge-time generalization" was therefore not needed.)

### 6. Scramble — a `selfMove` ability effect, **not a new ActionType**

The brief assumed a new `scramble` ActionType (5-site wiring per `action-types.md`). The audit found knockback (ADR-0026) already relocates a unit *inside* the `use_ability` reduce — position changes driven by abilities are recorded on the ability's outcome, not as separate logged actions. Scramble follows that pattern: `AbilityEffects.selfMove?: boolean` marks the ability; `resolveSelfMove` relocates the *caster* to the tile target, recording the hop on `UseAbilityOutcome.casterMove` for the renderer (which replays it as a `move` animation). Reach (1) and the relaxed leap (vertical 5) live entirely in `targeting.range`; validation adds a terrain-enterable + unoccupied check on the destination. Additive — no discriminant added to the closed ActionType surface.

### 7. PA-scaled CT-push — `CtEffectSpec.stat`

The Riptide Bow's 30% on-hit proc fires a hidden `undertow` ability whose `ctEffects` push the target's CT back. The Water Mage's CT math scales on MA (`floor(factor × MA)`); a low-MA physical archer would push a trivial amount. So `CtEffectSpec` gained `stat?: 'pa' | 'ma'` (default `ma`, backward-compatible); Undertow uses `{ factor: -3, stat: 'pa' }` → a Hunter (PA 6) pushes ~18 CT (≈2 ticks). The proc is gated by the flat weapon `attackProcs` chance (no Faith/Brave roll), per the equipment doc's weapon-rider convention. Mechanically symmetric to the Hydrologist's CT manipulation in *mechanism* (a `system_ct_push`), recalibrated in *source stat* for a physical wielder.

## Consequences

- **One new damage tag** (`'bow'`) joins the weapon-category tags (`sword`/`knife`/`axe`).
- The `height_delta` variance is deterministic (band min === max), so it produces no RNG draw — bow damage is fully predictable given positions, which the forecast panel and AI projection reflect exactly (they share `resolvePhysicalVarianceBand`).
- **Elevation safe zones**: a target ≥5 tiles above a bow is immune (variance clamps to 0). This is intended positional texture but a playtest watch-for (see `playtest-watch.md`).
- The `range` fork is gated on the `'weapon'` tag, so non-damage Hunter abilities (Pin Down) do **not** auto-source weapon range — Pin Down's 2-5 band is authored to match the bow. A future need for weapon-sourced range on non-damage abilities would extend the gate.
- Two-handed + Two Weapons compose without special-casing: the slotting rule guarantees an empty off-hand, which the swing loop already treats as single-swing.

## Alternatives considered

- **A new `modifyAccuracy` hook (as the brief specified).** Rejected — `modifyOutgoingHitChance` already does exactly this, only for physical attacks, before the clamp. Adding a parallel hook would duplicate capability and grow the closed surface.
- **A new `scramble` ActionType (as the brief specified).** Rejected — knockback set the precedent that ability-driven repositioning lives in the `use_ability` reduce + outcome, not a discriminant. The `selfMove` effect is additive and keeps the action log shape stable.
- **MA-scaled or fixed-flat Riptide CT-push.** MA-scaling gives a trivial push for a low-MA archer; a fixed flat value doesn't track the wielder. PA-scaling keeps it per-wielder and thematically apt (bows are PA weapons).
- **Min-range as a separate field / second range check.** Unnecessary — `RangeParams.horizontalMin` and `inRange`'s floor already existed; the work was sourcing it from the weapon.

## References

- `src/engine/catalog/definitions/item-definition.ts` — `twoHanded`, `range`, `WeaponPhysicalVariance` `height_delta` arm.
- `src/engine/abilities/range.ts` — `computeAbilityRange` weapon-range fork.
- `src/engine/damage/handlers.ts` — `resolvePhysicalVarianceBand` (target param + `height_delta` case).
- `src/engine/actions/reducers.ts` — `resolveSelfMove`; `CtEffectSpec.stat` resolution.
- `src/engine/setup/create-initial-state.ts` — two-handed slotting rule.
- `src/content/classes/hunter.ts`, `src/content/abilities/{pin-down,charged-attack,scramble,undertow,updraft,eagle-eye,high-jump}.ts`, `src/content/items/{longbow,riptide-bow}.ts`, `src/content/statuses/{slow,updraft}.ts`.
- ADR-0067 / ADR-0078 (weapon-sourced & dynamic variance), ADR-0063 (range / outgoing-hit-chance hooks), ADR-0080 (multi-swing), ADR-0026 (forced movement), ADR-0029 (water-mage CT substrate).
