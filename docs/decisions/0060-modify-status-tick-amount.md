## ADR-0060: `modifyStatusTickAmount` hook + Burn × Purifier integration

**Status:** Accepted
**Date:** 2026-05-12

## Context

Session 28 lands the engine prep for **Purifier** (universal accessory from the Mage War equipment doc): "doubles tick-down rate of incoming negative-tag statuses." A counter-pick to status-spread strategies — debuffs the wearer takes (Burn, Stop, Sleep, Move/Jump debuff, etc.) tick down at 2× rate, halving their effective duration. Status applications still land at full chance; they just don't stick.

The audit (item 8) sketched a `modifyStatusTickAmount` hook with args `{ unit, statusTypeId, statusTags, baseAmount }` and an additive chain (default `baseAmount = 1`). Two implementation questions surfaced:

1. **Additive vs multiplicative chain semantics.** Either shape can express "Purifier × 2":
   - Additive: Purifier returns `baseAmount + 1`. Stack of two Purifier-likes would compose to `baseAmount + 2`.
   - Multiplicative: Purifier returns `baseAmount * 2`. Stack of two compose to `baseAmount * 4`.

2. **Burn × Purifier behavior** (custom-mode status). Standard duration-mode statuses (Don't Move, Stop, Vulnerable) tick `remainingDuration` by integer amounts; doubling the tick rate is straightforward (decrement by 2 instead of 1). Burn is custom — its onTick handler emits one `system_damage` (sum of all current stack values) plus one `status_decrement_stack`, with `customStateOnDecrement` FIFO-dropping the oldest stack value. "Doubling the tick rate" for Burn could mean (a) twice the per-tick damage, (b) twice the per-tick stack consumption, or (c) both. The pre-settled design from the Session 21 brief: "same total damage per stack but stacks deplete twice as fast" — i.e., faster stack consumption, same per-tick damage formula.

## Decision

**Add `modifyStatusTickAmount` to the closed hook list with args `{ unit, statusTypeId, statusTags, baseAmount }`, MULTIPLICATIVE value-passing chain (default `baseAmount = 1`). Equipment contributors read a new optional `statusTickAmountMultipliers?: ReadonlyArray<StatusTickAmountMultiplier>` field on `EquipmentBase`, where each entry has `{ factor: number; statusTypeId?: StatusTypeId; statusTag?: StatusTag }` and applies multiplicatively when both gates match (or pass if undefined).**

Handler shape: `(args) => factor when gates match, else args.baseAmount`. Composition: multiplicative. Two Purifier-likes stack to `× 4`.

**`reduceStatusTick` consumes the chain for standard duration modes.** The reducer reads the chain product `K = runModifyStatusTickAmount(..., baseAmount: 1)` and decrements `remainingDuration` by `max(1, floor(K))` per tick — floored at 1 so a pathological zero/negative product doesn't freeze a status forever; floor-not-round to keep the integer semantics predictable.

**Burn (custom mode) reads the chain in its own onTick.** The handler computes `K`, emits the existing `system_damage` (sum of stack values, unchanged), and emits `min(stackCount, max(1, floor(K)))` `status_decrement_stack` actions. The per-tick damage formula stays identical to pre-Session-28 behavior; only the stack-consumption rate scales.

## Rationale

**Multiplicative over additive.** Chris's session-start call (and the cleaner fit with the equipment doc's "doubles tickdown rate" wording). Multiplicative semantics scale cleanly across base values — `× 2` is "twice as fast" for any default rate, including hypothetical future rules with non-1 baseAmounts. Additive would require authoring against an implicit "the default is 1" baseline (Purifier would author `+1`, never `+0.5`); multiplicative makes the author intent ("doubles") readable.

The downside of multiplicative — stacking — is a feature here, not a bug. Two Purifiers ×2 each → ×4 tick rate. Three ×2's → ×8. A hypothetical "× 0.5" rate-slowing item composes with `× 2` to produce `× 1` (net no change). The math works.

**`baseAmount = 1` default.** The chain takes a baseline and modifies; v1 callers always pass 1 (one tick of duration per cycle). A future ruleset that wanted "two ticks per cycle" would pass `baseAmount: 2` and the chain composes from there.

**Args include `statusTypeId` AND `statusTags`.** Both gates exist on the contributor side (`statusTickAmountMultipliers[].statusTypeId` for per-type filtering like "Purifier only on Burn"; `statusTickAmountMultipliers[].statusTag` for per-tag filtering like "Purifier on any negative-tagged status"). The args carry both so the contributor's gating logic stays in the handler body. Caller (the reducer / Burn's onTick) reads them from the catalog's `statusType.tags` and forwards.

**`floor(K)` for the discrete decrement.** Status decrement is integer-valued (you can't tick by 1.5 stacks). Floor matches the conservative interpretation: a `× 1.5` factor on a baseAmount-1 chain produces `K = 1.5 → floor 1` (no acceleration). To get acceleration, the author needs `× 2`. Authors don't get half-tick acceleration accidentally; the rule is mechanical.

**`max(1, floor(K))` safety guard.** A pathological chain product of 0 (or negative — multiplicative chains can't produce negatives v1, but factors of 0 are authorable) would otherwise freeze the status forever (decrement by 0 means duration never expires). The guard ensures at least 1 tick of progress per fire. v1 doesn't have any 0-factor authoring, but the guard catches future content errors.

**Burn emits `min(stackCount, K)` decrement actions, not `K` flat.** Two reasons: (1) emitting more decrement actions than there are stacks pollutes the action log with no-op decrements (each fires against zero stacks, the reducer no-ops); (2) the cap at `stackCount` is the natural boundary. If a Burn has 1 stack and Purifier × 2 fires, emit 1 decrement, not 2 — the 1-stack instance ends in one tick either way.

**Damage formula unchanged.** Burn's per-tick damage is "sum of all current stack values" — the established formula. Purifier consumes 2 stacks per tick instead of 1, so the **next** tick has 2 fewer stacks contributing → smaller next-tick damage. The diminishing-damage profile (4 stacks of 7: 28, 21, 14, 7 → 70 total) collapses to (28, 14 → 42 total) under Purifier × 2. Net less Burn damage to the wearer.

This is what the pre-settled design intended: "Net positive for the wearer because total Burn damage is reduced." The "same total damage per stack" phrasing in the brief is ambiguous; the implementer's reading was "each individual stack value (7) isn't modified — only the rate at which stacks are consumed." The math works out to less total damage because the diminishing-damage profile means the later, smaller ticks get skipped when consumption accelerates.

**`reduceStatusTick` floors at 1 for the decrement.** Same safety guard as Burn — a zero/negative chain product shouldn't freeze a duration-mode status. `max(1, floor(K))` ensures progress every tick.

**`statusTickAmountMultipliers` field shape.** Array of `{ factor, statusTypeId?, statusTag? }` objects instead of a tagged union — both gates are independent, an entry may declare both for AND semantics (`Burn-only AND negative-tagged` = only burn-tagged-negative statuses). Both undefined means "applies to every status." Per-type and per-tag aren't mutually exclusive; an interface is cleaner than a tagged union here.

## Consequences

- **`HookSignatures` gains one entry.** `modifyStatusTickAmount` with `{ unit, statusTypeId, statusTags, baseAmount }` args, `number` return.

- **`runners.ts` adds `runModifyStatusTickAmount`.** Standard multiplicative chain shape, mirroring `runModifyMpCost` and `runModifyIncomingStatusApplicationChance`.

- **`EQUIPMENT_CONTRIBUTORS` gains `modifyStatusTickAmount`.** Contributor function `statusTickAmountContributor` walks equipment, yields per-multiplier-entry handlers.

- **`reduceStatusTick` reads the chain for standard duration modes.** Non-custom statuses tick by `max(1, floor(K))` per tick. Custom-mode statuses (Burn) bypass the engine's decrement entirely — their own onTick reads the chain.

- **Burn's onTick reads the chain.** New per-tick emission count `min(stackCount, max(1, floor(K)))` for `status_decrement_stack`. Damage formula unchanged. The handler imports `runModifyStatusTickAmount` from the engine barrel.

- **No regression risk for v1 content.** With no `statusTickAmountMultipliers` author in v1, `K = 1` for every tick, every status. Burn behaves identically to pre-Session-28; standard duration modes decrement by 1 as before. Verified by 745+ pre-Session-28 tests continuing to pass.

- **Synthetic Burn × Purifier test coverage.** `session-28-integration.test.ts` constructs a Purifier-like accessory (since the real Purifier ships in Session 29) and verifies:
  - Without Purifier: 4-stack Burn emits 1 decrement, damage 28.
  - With Purifier × 2: 4-stack Burn emits 2 decrements, damage 28.
  - Stack-count cap holds: × 10 on 2 stacks emits 2 decrements (not 10).
  - Synthetic duration-mode "Stun" with Purifier × 2: 4-duration → 2 after one tick.
  - Without Purifier, same Stun: 4 → 3.

- **`statusTickAmountMultipliers` content authoring.** Session 29 (Purifier) authors `[{ factor: 2, statusTag: 'negative' }]`. Future "Burner Pendant" (hypothetical, doubles Burn-tick specifically) authors `[{ factor: 2, statusTypeId: 'burn' }]`. Both shapes coexist.

- **Status-tag composition is checked via `.includes`.** Burn's `tags = ['negative', 'fire', 'dot']`. Purifier's `statusTag: 'negative'` matches. A future Cleanse-style item with `statusTag: 'dot'` would also fire on Burn (Burn carries both tags).

## Alternatives considered

**Additive chain ("`+1` to tick rate").** Rejected per Chris's call — multiplicative reads cleaner with the equipment-doc wording ("doubles") and composes more flexibly across hypothetical future ruleset baselines.

**Modify Burn's per-tick damage by × K instead of stack-consumption.** Considered — would deal `K × stackSum` damage per tick, drop 1 stack as before. Rejected because it changes Burn's fundamental damage *formula* per-tick (the wearer takes more damage per tick under Purifier, not less). The "net less total damage" design intent comes from accelerated consumption, not per-tick scaling.

**Hybrid: × K damage AND × K stack consumption.** Considered — Burn under Purifier × 2 would deal `2 × stackSum` damage AND drop 2 stacks per tick. The math: 4 stacks at 7 each → tick 1: 56 dmg, drop 2 → 2 stacks left; tick 2: 28 dmg, drop 2 → 0. Total: 84 over 2 ticks vs baseline 70 over 4 ticks. More damage in less time. Rejected — produces *more* total damage, contradicting "net positive for the wearer."

**`statusTickAmountMultipliers` as `ReadonlyMap<StatusTypeId, number>`** (per-type only, no per-tag). Rejected — Purifier's design is per-tag (`negative`), not per-type (would have to enumerate every negative status). The current shape (per-type OR per-tag, optionally both) covers both authoring styles.

**Status-type registration hook (let the status type declare its own tickdown-modifier registration).** Rejected — would require statuses to expose a registration surface, doubling the contributor surface. The status-tickdown chain composes the same way every other modifier chain does; statuses don't need a special path.

**Burn emits N `system_damage` actions (one per stack consumed) plus N decrement actions.** Rejected — the per-stack damage emission would multiply log entries by N, and the action log already has the consolidated "sum-of-stacks" emission as the cleaner reading. The decrement actions are individually small; multiplying them doesn't pollute the log meaningfully.

## References

- `src/engine/hooks/hooks.ts` — `HookSignatures.modifyStatusTickAmount`.
- `src/engine/hooks/runners.ts` — `runModifyStatusTickAmount`.
- `src/engine/items/contributions.ts` — `statusTickAmountContributor` + `EQUIPMENT_CONTRIBUTORS` entry.
- `src/engine/catalog/definitions/item-definition.ts` — `statusTickAmountMultipliers` field on `EquipmentBase`; `StatusTickAmountMultiplier` interface.
- `src/engine/actions/reducers.ts` — `reduceStatusTick` chain integration for duration modes.
- `src/content/statuses/burn.ts` — Burn's onTick reads the chain; emits `K` decrement actions.
- `src/engine/actions/session-28-integration.test.ts` — composition tests + Burn × Purifier scenarios.
- ADR-0024 — action chain + `status_decrement_stack` semantics.
- ADR-0030 — Burn's custom-trigger durationMode.
- ADR-0028 — equipment integration shape.
- ADR-0056 — equipment contributor registration pattern.
- ADR-0058 — `maxMp` introduction (Session 28 sibling).
- ADR-0059 — `modifyBucketCapacity` (Session 28 sibling).
- `docs/twentyOneDesign/mage-war-equipment.md` — Purifier spec.
