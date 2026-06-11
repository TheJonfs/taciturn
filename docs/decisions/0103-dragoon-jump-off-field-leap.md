## ADR-0103: Dragoon Jump — the off-field leap

**Status:** Accepted
**Date:** 2026-06-10

## Context

Jump is the Templar's offensive pillar (concept-notes) and the substrate audit's
headline unknown (T4): a charged action where the unit leaps **off the field**
(untargetable) and lands for a heavy strike. Charged-action infra was solid
(Cure/Raise run through it), but "leaves the field / lands later" had no
precedent, and `actionSpeed` was a fixed per-ability number — Jump wants
`3 × Speed`.

Two design calls were taken with Chris:

- **D3 (leap fidelity):** **full off-field leap** (not the simpler charged-strike).
- **Landing position:** the dragoon **returns to its takeoff tile** (not relocate
  to the target).

## Decision

### "Off-field" = untargetable, tile reserved — NOT full board removal

The literal "remove from the board" mirrors the permadeath `removed` flag across
~20 filter sites *and* creates a landing-conflict (a freed takeoff tile could be
taken). Instead, `airborne` delivers the identity that matters with far less
surface:

- **New `Unit.airborne: boolean`** (transient, alive throughout — unlike `removed`).
- **Untargetable while airborne:** excluded at the two "can be hit" sites — target
  validation (`validate.ts`, both UseAbility and Throw Item) and the AoE
  affected-set (`reducers.ts`). This is the survivability of being mid-air.
- **Tile reserved:** `airborne` does **not** touch `unitAt` / occupancy, so the
  unit keeps its takeoff position and lands back home with zero conflict logic.
- **Scheduling unchanged:** the Charging status already skips a charging unit's
  turns, so `airborne` does **not** touch the scheduler.

This is the full off-field leap on every property the concept-notes call for
(untargetable mid-air, H6/V6 anti-perch reach, dodge window) at ~⅕ the blast
radius of literal board-removal.

### Lifecycle

- **Commit** (`commitCharged`): if `ability.effects.jumpLeap`, set the caster
  `airborne: true`.
- **Resolve** (`finalizeResolution`): clear `airborne` — runs on both the normal
  resolve and the caster-KO fizzle path (both reach `finalizeResolution`), so a
  leap never strands a unit off-field. The unit's position is untouched → lands
  home.

### `actionSpeed = 3 × Speed`

New `ActiveAbilityDefinition.chargeSpeedFromUnitSpeed?: number`. When set,
`commitCharged` computes the ChargedAction's `speed` as
`round(multiplier × computeSpeed(caster))` (computed Speed, so Haste composes)
instead of the fixed `actionSpeed`. `actionSpeed` stays > 0 as the "is charged"
flag. Jump = multiplier 3 → the telegraph shrinks as Speed is invested (a third
build axis orthogonal to PA/MA, self-balancing since fast-Jump classes have low PA).

### Damage `PA × WP × (1 + isLance)`

New `DamageSpec.lanceBonus?: boolean` + a `lance_bonus` pipeline handler (added to
the `base` stage): when the ability declares `lanceBonus` and the attacker wields
a `'lance'`-tagged weapon, push a `× 2` multiplier (composes with WP / variance /
crit at the finalize fold). Jump uses `power_coefficient: 1`, so a Lance doubles it
and a sword/other weapon deals the base `PA × WP`.

### The ability

Jump targets a **tile** (not a unit) at **H6/V6**, `rangeMode: arc` (leaps over
obstacles, no LoS). Tile-targeting makes the **dodge window** real: if the unit
vacates the tile before the leap lands, the charged resolution finds no unit there
and whiffs. NOT `'weapon'`-tagged, so Jump keeps its own H6/V6 range rather than
forking to the Lance's H2 weapon range (`physical_pa_wp` reads the weapon WP off
the `'physical'` tag regardless). MP 6, authored hidden (joins the Templar command
set at assembly).

## Consequences / notes

- An airborne jumper **cannot be KO'd or interrupted** mid-leap (untargetable) —
  the deliberate commitment/payoff of the telegraph. The existing caster-KO fizzle
  guard remains as defensive code (e.g. a future indirect/self-damage path).
- **Rendering is unhandled** (deferred): the renderer draws the unit on its (still-
  occupied) tile during the charge — it won't visually "lift off." Mechanically
  correct (untargetable); a sprite-lift/shadow is future polish. Flagged.
- **No separate charge-cancel path** clears `airborne` today beyond
  `finalizeResolution`; if a future mechanic cancels a ChargedAction outside that
  function, it must clear `airborne` too. Noted.
- The `'lance'` tag (added with Lance pierce, ADR-0102) is what `lanceBonus` reads
  — the two Lance pieces compose.

## Tests

- `src/engine/actions/session-62-jump.test.ts` — charge rate `3 × Speed`; the
  airborne jumper is untargetable; resolve lands home + clears airborne + strikes
  the target tile (PA×WP×2 with a Lance, variance-banded); whiff on an empty target
  tile (dodge window); Lance doubles damage and a non-Lance does not (the `× 2`
  multiplier).
- `src/content/session-62-templar-foundation.test.ts` — the ability's spec fields.
