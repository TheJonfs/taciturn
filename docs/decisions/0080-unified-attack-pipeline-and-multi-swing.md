## ADR-0080: Unified attack execution + multi-swing (Two Weapons)

**Status:** Accepted
**Date:** 2026-05-20
**Session:** 42

## Context

S42 introduces the **Assassin**, a physical class with native **Two Weapons** — equip a second weapon and swing both in a single attack. This is the first content that makes a single attack action resolve more than one weapon strike.

The pre-S42 attack model already routed *every* attack flavor (player Attack, Counter reaction, Power Attack, Stasis Sword, equipment procs) through one path: `reduceUseAbility → resolveAbilityTargets → resolveAbilityEffect → runDamagePipeline → applyDamageToTarget → runOnActionTargeted`. The damage pipeline was the single chokepoint; there was no bespoke per-ability damage code (audit finding, S42 plan-review). The base handler `physicalPaWp` resolved the wielder's weapon via `getEquippedWeapon` — a *right-hand-dominant, single weapon* read. Only one weapon ever swung.

The substrate question: how does a second weapon swing without rewriting the pipeline, and without breaking the bit-identical RNG of every existing single-weapon caller? And how does this compose with the planned-for-S43 "attack twice with each weapon" accessory (a *different* axis: swings *per* weapon)?

## Decision

**Pattern B — generic, additive multi-swing around the existing pipeline.** Two Weapons does not modify the damage pipeline; it unlocks a second weapon slot, and a per-swing dispatch loop iterates the eligible weapons, running the existing single-swing resolution once per weapon.

Four pieces:

### 1. `modifyDualWield` capability hook

A new boolean OR-chain query hook (`engine/hooks/hooks.ts`, runner `runModifyDualWield`). Base `false`; the Two Weapons Support returns `true`. The engine asks "may this unit attack with its off-hand weapon?" without knowing *which* content grants it — no hard-coded ability id. Closed hook surface, deliberate addition (ground rule 8), parallel in spirit to `modifySpecialMovement` / `modifyCanEnter`.

### 2. `multiWeapon` ability flag

An optional `multiWeapon?: boolean` on `ActiveAbilityDefinition`. `true` on basic `attack` (and therefore Counter, which re-emits `attack`) and `power_attack`. Absent (single-swing) on status-rider attacks — `lightning_stab`, `stasis_sword` — and all magic. Per the S42 D1b defaults: damage attacks multi-swing; status-rider attacks opt out so their rider rolls once at an interpretable rate.

### 3. `attackingWeaponSlot` threaded through the pipeline

`DamageContext` and `RunDamagePipelineArgs` gain an optional `attackingWeaponSlot?: EquipmentSlotId`. When set:
- `physicalPaWp` reads that slot's weapon (`getWeaponInSlot`) for WP / tags instead of `getEquippedWeapon`.
- `attackProcContributor` fires only that slot's procs (a Magebane in the off-hand procs Silence on the off-hand swing only).

When **undefined** — every pre-S42 caller and every single-weapon attack — behavior is unchanged: dominant-weapon resolution, all-equipped-item procs. This is what keeps the 1224 pre-S42 tests bit-identical.

### 4. The swing loop (`attackingWeaponSlots` + `resolveSingleTargetDispatch`)

`attackingWeaponSlots(state, catalog, attacker, ability)` returns the per-swing slot list:
- `[undefined]` (one default swing) unless **all** of: `ability.multiWeapon`, `runModifyDualWield` true, and weapons in **both** hands.
- `['rightHand', 'leftHand']` (dominant first) when those hold.

`resolveSingleTargetDispatch` keeps its fast path (`[undefined]` → one `resolveAbilityEffect` call with `perTargetSeed(seed, 0)`, identical to before). For >1 swing it loops `resolveAbilityEffect` per slot, each with `perTargetSeed(seed, swingIndex)` (independent variance / evasion / proc / reaction rolls per swing) and the slot override. Each swing fully resolves — damage → procs → reactions — before the next; results, reactions, and emissions concatenate. Swings stop early if a prior swing KO'd the target. Caster-target effects fire only on swing 0 (defensive against a future multiWeapon ability with a caster rider).

### PA × 0.75

Two Weapons also registers `modifyStatQuery` for `pa` → `floor(pa × 0.75)`, parallel to Martial Expertise's × 1.25 (opposite direction). Applied unconditionally while equipped (composition tier: passive). Two swings at × 0.75 PA out-damage one swing at full PA — the dual-wield trade.

## Consequences

- **AoE attacks are single-swing.** The swing loop lives in `resolveSingleTargetDispatch` only; no v1 weapon attack is AoE. If a future AoE weapon attack wants multi-swing, the loop generalizes to the AoE path.
- **Reactions per swing, bounded by the cap.** A Two-Weapons attacker eats the target's Counter per swing-that-lands, but the ruleset's flat `perUnitPerTurnReactions: 1` caps the target to one counter per turn regardless. Same cap throttles the *attacker's* own reactions (e.g. an Assassin's Speed Save) to once per enemy turn even under a 2-swing hit — see ADR-0081 note and the handoff.
- **"Attack twice per weapon" accessory — shipped in S42 as "The Offering."** It's the *swings-per-weapon* count axis: a `modifySwingsPerWeapon` hook (multiplicative, base 1; The Offering returns ×2) multiplied against the eligible-slot list. Total swings = eligible weapons × swings-per-weapon, so dual-wield × The Offering = four swings. No pipeline change was needed — `attackingWeaponSlots` just expands the slot list. **Gated to the basic Attack command only** (`ability.basicAttack === true && !isReaction`): Counter (a reaction re-emitting `attack`) and the Battle Skills (Power Attack / Lightning Stab — not `basicAttack`) are excluded by design. The hook is a pure capability; the ability/reaction policy lives at the `attackingWeaponSlots` call site. The Offering carries a `−2 PA` `statMod` as the balancing tax.
- **Per-ability defaults are data, not engine.** A new attack-flavored ability sets `multiWeapon` (or omits it) to opt in/out; content authors don't touch the dispatch.

## Alternatives considered

- **Pattern D — narrow Two Weapons modifier on basic Attack only.** Smallest scope, but forecloses clean composition with the S43 accessory and would need a substrate refactor when it lands. Rejected per the audit showing Pattern B's consolidation cost was small (the pipeline was already unified).
- **A new `multi_swing` ActionType.** Multi-swing is a within-`use_ability` modification (the swing loop sits inside the existing reducer branch); procs already emit `use_ability`. No new discriminant needed — avoids the five-sites wiring (`docs/conventions/action-types.md`).
- **Hard-coding the `two_weapons` ability id in the engine.** Rejected — breaks the engine/content layering. The `modifyDualWield` hook keeps the engine content-agnostic.
