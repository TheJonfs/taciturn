## ADR-0107: Pierce and dual-wield compose per swing

**Status:** Accepted
**Date:** 2026-06-12

## Context

Two basic-Attack features shipped independently and didn't compose:

- **Multi-swing** (ADR-0080, S42): a dual-wielder (Two Weapons + a weapon in
  each hand) swings each weapon once per basic Attack. The loop lives in
  `resolveSingleTargetDispatch`, keyed on `attackingWeaponSlots`.
- **Pierce** (ADR-0102, S62): a basic Attack with a *piercing* weapon (Lance,
  Imp Halberd) expands into a 2-tile caster-anchored line, dispatched through
  `resolveAoeDispatch`.

The dispatcher chose **one** path: `aoe === undefined ? singleTarget : aoe`.
Pierce computed its footprint from the **dominant** weapon only
(`getEquippedWeapon`). So when a dual-wielder's dominant weapon pierced, the
whole attack routed to `resolveAoeDispatch` — which has no multi-swing — and the
**off-hand swing was silently dropped**. A playtest surfaced it: an Assassin with
Lance + Defender + Two Weapons + Monkeygrip landed only one hit, while the same
unit with two non-piercing weapons landed two. (The `defender.ts` comment blamed
two-handedness; that was a misdiagnosis — a non-piercing two-hander multi-swings
fine. The trigger is a *piercing dominant weapon*.)

## Decision

Resolve pierce **per swing**, not once for the whole attack. The basic-Attack /
single-target dispatch now flows through `resolveAttackWithSwings`:

1. **Single default swing** (every single-weapon attack, every non-dual-wielder):
   pierce via the dominant weapon, else single-target — unchanged, bit-identical
   for replay.
2. **Dual-wield, no piercing swing** (two knives, sword + sword): routed to the
   existing `resolveSingleTargetDispatch`, which still owns the bit-identical
   multi-swing loop.
3. **Dual-wield with a piercing swing**: a new per-swing loop (`resolveMixedSwings`)
   resolves each swing's own footprint — a piercing weapon expands to its line,
   a non-piercing weapon hits the primary target — threading the swinging
   weapon's slot so each swing reads its own WP, with a per-swing branched seed
   (`perTargetSeed(seed, i)`, matching the existing multi-swing loop). Stops early
   if the primary target dies.

`pierceAoeFor` was generalized to `pierceAoeForWeapon` (+ a `pierceAoeForSlot`
helper) so a swing's pierce reads *its* weapon, not always the dominant one.
`resolveAoeDispatch` gained an optional `weaponSlot` it threads to its per-tile
`resolveAbilityEffect` calls; omitted by every existing caller (dominant-weapon
behavior preserved).

Worked example (Lance right, Defender left, Two Weapons + Monkeygrip; enemy in
front with a second enemy behind): the Lance swing pierces both, the Defender
swing hits the front enemy — front takes two hits, the one behind takes one.

## Consequences

- Only the previously-broken combination (dual-wield + a piercing swing) changes
  behavior; it never worked before, so there is no replay to preserve. Every
  other path is bit-identical.
- Each swing reads its own weapon's WP and pierce; a non-piercing off-hand swing
  no longer inherits the dominant weapon's line.
- Known minor edge: barrier damage inside a per-swing pierce still reads the
  dominant weapon's WP (the unit-damage path threads the slot; barrier damage
  does not). Negligible — a dual-wield pierce clipping a barrier is rare and the
  WP delta is small. Revisit if a content case cares.
- Player-facing (a dropped swing is now landed); logged to the guide changelog.
