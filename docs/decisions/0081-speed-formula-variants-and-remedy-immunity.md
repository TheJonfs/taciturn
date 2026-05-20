## ADR-0081: Brave/Faith-and-Speed status formulas + Remedy-immune stat debuffs

**Status:** Accepted
**Date:** 2026-05-20
**Session:** 42

## Context

Two smaller substrate changes accompanied the S42 Assassin:

1. The Assassin's instant, ranged, no-damage Command Set (Shadow Stitch, Blowdart, Undermine, Sow Doubt) applies statuses on a Speed-defined chance — a *new factor mix* the status-application formula didn't support.
2. The Command Set's permadebuffs (Undermine's Brave −20, Sow Doubt's Faith −20) are meant to stick for the rest of the battle. An audit of Remedy revealed it would clear them — contrary to Chris's stated convention.

## Decision

### Speed factor (`speed`)

`StatusFormulaFactors` gains `speed?: boolean`. When set, the chance formula multiplies in a **caster-only** Speed term:

```
Speed_factor = 0.9 + caster_speed / 20
```

Unlike Brave/Faith (symmetric caster × target), Speed reads only the caster — a fast Assassin lands debuffs more reliably regardless of the target's Speed. The `/20` slope (vs MA's `/10`) keeps the factor in a sane band given Speed values run higher than MA. Read through `modifyStatQuery` (`computeSpeedFactor` in `engine/damage/handlers.ts`) so Haste / Speed Save / Speed Down compose.

This yields the two new variants (full-override factor selection, so undeclared factors are off):
- **Brave-and-Speed** `{ brave: true, speed: true }` — Shadow Stitch, Blowdart, Undermine.
- **Faith-and-Speed** `{ faith: true, speed: true }` — Sow Doubt.

Wired into both `computeStatusChance` (runtime + forecast share it) and `rollAbilityChance`. Backward-compatible: existing `{ faith, ma }` / `{ brave, ma }` mixes are unchanged.

### Remedy-immune stat debuffs

`StatusEffectType` gains `remedyImmune?: boolean` (default `false`). The Remedy clear predicate (`applyConsumableEffects` in `reducers.ts`) skips any status with `remedyImmune === true`, in addition to the existing buff-polarity and equipment-source skips.

Set `true` on the flat stat-reduction debuffs: `pa_down`, `ma_down`, `speed_down`, and the new `brave_down`, `faith_down`. Remedy still cures the classic ailments (Poison, Blind, Silence, Sleep, Stop).

**This changes existing behavior.** Before S42, `pa_down` / `ma_down` / `speed_down` declared no polarity, so they defaulted to `'debuff'` and *were* Remedy-cleared — the Fire Strike / Earth Strike / Brine / Earth Quake debuffs were curable. Per Chris's S42 D2 call, stat-reduction debuffs are committed weakenings, not curable ailments; they are now Remedy-immune. Combined with their `permanent` (null) duration, they persist for the rest of the battle (and through KO, per ADR-0079) once landed.

`movement-debuff` (a finite, ability-tied move-range reduction) is left clearable — it self-expires and reads as a transient effect, not a committed stat loss. Revisit if it reads inconsistently in playtest.

## Consequences

- **Why a flag, not a duration-derived predicate (cf. ADR-0079).** Duration doesn't distinguish "Remedy clears" from "Remedy doesn't": Poison is infinite-duration yet *should* be cured, while stat debuffs are also infinite yet should *not* be. The signal is semantic, not temporal — an explicit opt-out is the honest encoding. (ADR-0079 could use a duration-derived predicate because KO-persistence genuinely keys on duration; cleanse-ability does not.)
- **Permadebuff identity.** Undermine / Sow Doubt now deliver on "permadebuff pressure" — once applied, the target wears it all battle, with no cleanse. Self-cancellation tension (lowering Brave drops the Brave-and-Speed re-apply chance) and Sow Doubt's double-edged Faith reduction are intentional design textures (watch-fors).
- **`pa` factor still deferred.** The `NotYetImplementedError` throw on `factors.pa` is untouched — no PA-using status applier shipped this session.

## Alternatives considered

- **Leave stat debuffs Remedy-clearable; make only the new Brave/Faith Down immune.** Internally inconsistent (some stat debuffs cure, some don't). Rejected for the consistent rule.
- **A third polarity value** (`'penalty'`) gating Remedy. More invasive than a boolean opt-out and conflates AI polarity with cleanse-ability. Rejected.
