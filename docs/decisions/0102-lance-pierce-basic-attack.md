## ADR-0102: Lance pierce — basic Attack as a caster-anchored 2-tile line

**Status:** Accepted
**Date:** 2026-06-10

## Context

The Templar arc introduces the **Lance** weapon class (Lance, Imp Halberd), whose
identity is *pierce*: a basic Attack strikes the targeted unit and the one behind
it, friendly-firing an intervening ally — the "lines and clusters" half of the
Templar's spatial identity (concept-notes). The substrate audit (T5) classified
this as mixed: the line shape, multi-target dispatch, and friendly-fire all exist
(Flame Lance), but the **basic Attack is single-target** — making a *weapon's*
basic attack pierce was the net-new bit.

## Decision

### Pierce = a caster-anchored 2-tile line, injected when the weapon pierces

A piercing basic Attack reuses the existing line-AoE machinery rather than a new
mechanism. `WeaponEquipment` gains `pierces?: boolean`. In `resolveAbilityTargets`,
before the single-vs-AoE branch, `pierceAoeFor` returns a line AoE
(`{ shape: { kind: 'line', length: 2 }, anchorMode: 'caster', excludeCaster: true }`)
when **(a)** the ability is the basic Attack (`basicAttack === true`) and **(b)**
the attacker's equipped weapon (`getEquippedWeapon`) pierces. The dispatcher then
routes through `resolveAoeDispatch` exactly as a line spell would:

- **Direction** is the cardinal toward the picked target (`cardinalFromTo`, the
  ADR-0031 snap — a diagonal target snaps to an axis, tie-break horizontal), like
  Flame Lance. A caster-anchored line starts one tile ahead, so length 2 = the two
  tiles in front: the target and the unit behind/in-front-of it.
- **Friendly fire** emerges from `ruleset.behaviors.friendlyFire` (v1 default
  true): the line hits allies in it, so it clips an intervening ally — the
  intended downside.
- **Weapon damage** is correct: the AoE path passes no `attackingWeaponSlot`, so
  `physicalPaWp` reads `getEquippedWeapon` (the Lance), giving each line unit
  `PA × WP`. Per-target seeds, evasion, and variance branch as usual.

A non-piercing weapon returns `undefined` → the single-target path is
bit-identical (no behavior change for any existing attack).

### `'lance'` damage tag

`'lance'` joins the `DamageTag` union (the weapon-category-tag pattern, like
`'sword'`/`'knife'`). Lance/Imp Halberd carry it; Jump's `× (1 + isLance)` reward
(T4, later) will read it.

### The weapons

- **Lance** — WP 10, two-handed, Acc 95, reach H2/V4, pierces, static variance
  [0.9, 1.1]. Universal (no `classRestrictions`), like every weapon.
- **Imp Halberd** — WP 8, two-handed, Acc 95, H2/V4, pierces, [0.9, 1.1], **MA +1**
  (the −2 WP / +1 MA variant favouring the healer/Jump-light build).

## Consequences / v1 limitations (flagged)

- **Pierce takes precedence over multi-weapon dual-swing.** Routing to
  `resolveAoeDispatch` bypasses the single-target swing loop, so a dual-wielding
  piercing attacker resolves ONE line rather than two swings. This only matters in
  the gated dual-two-hander case (Monkeygrip + Two Weapons); acceptable for v1.
  If we later want pierce × dual-swing, the swing loop would need to expand each
  swing into its own line.
- **Cardinal-only direction** (inherited from the line shape / ADR-0031): a
  diagonal target snaps to an axis. Consistent with every other line ability.
- **Vertical tolerance defaults to 1** for the pierce line (not set explicitly).
  A unit-behind on a very different layer may fall outside the line; tunable later
  if playtest wants the V4 reach reflected in the pierce depth too.

## Tests

- `src/engine/actions/session-62-lance-pierce.test.ts` — pierce strikes target +
  the unit behind; friendly-fires an intervening ally; a non-piercing weapon stays
  single-target.
- `src/content/session-62-templar-foundation.test.ts` — the two weapons' stat
  lines (WP, two-handed, reach, pierces, variance, Imp Halberd's MA +1).
