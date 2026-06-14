## ADR-0110: Thief class (chunk 1) — steal-effect substrate, additive contest chance, incoming-duration hook

**Status:** Accepted
**Date:** 2026-06-14

## Context

The Thief is the roster's twelfth class and fifth physical — the
resource-interaction axis nothing else touches (it denies what a unit *has*:
HP / MP / buffs, vs the Assassin denying what a unit can *do*). Design is
settled in `docs/thirtyNinePlanning/thief-concept-notes.md`; this session built
it content-ahead-of-AI, in chunks, per `session-thief-brief.md`.

**Chunk 1** ships a fully playable Thief: the class skeleton, the three
straightforward Thief Arts actives (Steal HP / Steal MP / Steal Buffs), and the
three native RSM (Slip Free / Momentum / Move +2). **Steal Heart + the
temporary control-override substrate are chunk 2** (deferred; see "Not done").

The audit overturned the brief's "mostly wiring" expectation in two places: the
engine had **no content-data path** for lifesteal or MP-drain-from-an-ability,
and Slip Free's "advance an applied debuff one tick, Brave-gated" did **not**
compose on existing hooks (the closed surface had no apply-time, target-side
duration modifier; `modifyStatusTickAmount` is an always-on tick multiplier and
can't be Brave-gated). Chris chose to **build it properly** — a new hook — over
reinterpreting Slip Free as a Purifier-style decay passive.

## Decisions

### New ability-effect specs (the steal kit is net-new substrate, not wiring)

- **`DamageSpec.lifesteal: { percent }`** (Steal HP). A damage rider: a
  successful damaging hit emits a `system_heal` to the caster for
  `floor(percent/100 × damageDealt)`. Keyed on damage *actually dealt*, NOT
  target survival — a killing blow still siphons; a fully-resisted 0-damage hit
  heals nothing. New `SystemHealSource` kind `'ability'` carries the
  provenance.
- **`AbilityEffects.mpDrain: { coefficient, restorePercent }`** (Steal MP).
  Drains `floor(coefficient × caster_PA)` MP and restores `restorePercent`% of
  what was *actually removed*. Resolves through one `system_mp_drain`; **the
  payload grew `restoreFraction`** (default 1.0 — Rasp Pendant unchanged) so the
  source's gain is `min(headroom, floor(restoreFraction × targetApplied))`. The
  restore keys off MP removed, never the nominal request: a near-empty target
  yields a proportionally smaller refuel, and the transfer-bounded reducer caps
  both ends. No HP component.
- **`AbilityEffects.stealBuffs: { baseChance }`** (Steal Buffs). On a successful
  contest, strips every `aiHints.polarity === 'buff'`, non-equipment status off
  the target and re-applies each onto the caster, preserving magnitude /
  remaining duration / stacks. "neither"/debuff statuses (Stop, Charging, DoTs)
  and equipment-granted buffs are excluded. The polarity filter mirrors the
  Remedy item's existing `polarity !== 'buff'` convention; the audit confirmed
  all 15 v1 buffs carry the declaration.

### Additive Thief contest chance — the new target-Brave-as-resistance form

`computeThiefContestChance` / `rollThiefContestChance` (in `status/chance.ts`),
used by Steal Buffs now (base 33) and Steal Heart in chunk 2 (base 10):

```
chance% = clamp(baseChance + 3·PA + 0.5·(caster_Brave − target_Brave), [1, 95])
```

This is a deliberately **new** form, distinct from the existing multiplicative
BMG status formula (ADR-0028/0108) where Brave enters as a symmetric *product*
(`Brave_caster/100 × Brave_target/100` — both raise the term). Here the target's
Brave is **resistance** via the differential. Percent-native (the formula is
authored in percentage points); the existing `rollAbilityChance` stays a [0,1]
fraction. The 95 cap means the game's biggest swing is never a guaranteed lock;
PA and both Braves read through `runModifyStatQuery` so gear composes.

### `modifyIncomingStatusDuration` — a new closed-surface hook (Slip Free)

A target-side, apply-time hook (closed surface 36 → 37). Fires inside
`applyStatus` when a finite-duration status is applied to a unit **by another
unit** (an action-driven application carrying a seed — not equipment grants,
self-applications, or composer-internal applies), letting the target's passives
shorten the incoming duration *before the instance is built*. A result of 0
negates the application outright (returns `{ kind: 'resisted' }`) — this is how
Slip Free turns a 1-tick debuff into nothing.

**Brave gate.** Apply-time hooks are otherwise pure (no RNG). To honor the
spec's "Brave-gated like any reaction," the runner performs one reaction-style
Brave roll (`Brave/100`, the existing reaction convention, on a dedicated seed
sub-stream) and forwards the outcome as `braveTriggered`, so a handler gates on
Brave without owning RNG. `applyStatus` grew an optional `seed`; the
ability-driven status-application path threads it. Slip Free's handler shaves
one tick only for `'negative'`-tagged statuses when `braveTriggered` — so buffs,
neutral Charging (also self-sourced, already excluded), and permanent stat-down
debuffs (no finite duration) all pass through.

This is reusable substrate, not a one-off: any future "duration resistance"
effect consumes the same hook.

### `computeOutgoingHitChance` generalized for hitRoll-without-damage

Steal MP is evadable but deals no HP. The hit-chance helper now rolls evasion
for **any** `hitRoll`-bearing ability (damage optional) — `hitRoll` present is
the signal that the ability can be dodged. Previously it short-circuited to 1.0
when `effects.damage` was absent. No existing ability has `hitRoll` without
damage, so the change is behavior-preserving for all prior content; it also
means the forecast UI shows Steal MP's evade chance for free.

### Momentum — the clean inverse of Flow State

Refunds +10 CT (matching Flow State) on `onActionResolved` when
`ability !== null && !tags.includes('magical')` — including the basic Attack
(non-null, untagged) and excluding Move / Wait (null ability), which avoids a
degenerate refund-on-Wait. Watch-for: it fires more often than Flow State, so
the basic-Attack refund could compound tempo (10 is the spec's "match Flow
State" start; droppable).

## Consequences

- The steal effects run in `resolveAbilityEffect` as discrete blocks; an ability
  with only `mpDrain`/`stealBuffs` (no damage/status) dispatches fine (no
  no-effect rejection on the single-target path).
- **AI under-plays the kit** (content-ahead-of-AI, flagged): it uses the legible
  parts (Steal HP damage, Steal MP gain) but doesn't value buff-gain-on-self or
  play around the steal. The self-state AI dimension is a future arc beat — the
  Thief adds weight to promoting it.
- The Thief is **not** in default team templates / playtest battles yet
  (follow-up).

## Not done (chunk 2 — throttle-cut, deferred to a focused follow-up)

- **Steal Heart** (24 MP charm, gender-gated) + the **control-override
  substrate** (temporary controller-decoupled-from-team). Audit confirmed this
  is genuinely net-new: `Unit.team` is immutable, there is no `controller`
  field, and both the orchestrator and `evaluate-battle-outcome` key off
  `team`. The additive contest chance (this ADR) is already in place for it.
- Edge cases to resolve there: Steal-Heart the last enemy (win condition?), KO
  while charmed (whose loss?), revert timing mid-charge, post-revert immunity.
