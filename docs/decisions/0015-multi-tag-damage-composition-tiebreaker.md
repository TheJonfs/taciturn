## ADR-0015: Multi-tag damage composition — signed maximum (resistance wins ties)

**Status:** Accepted
**Date:** 2026-05-06

## Context

The Battle Mechanics Guide's resistance system stores per-tag resistance values in the `[-100, 200]` range (negative = weakness, positive = resistance, 200 = full absorption). When an ability's damage carries multiple tags (e.g., a holy fire spell tagged both `fire` and `holy`), the engine has to pick a single resistance value to apply.

The original guide text said "highest absolute resistance wins" — which is unambiguous in most cases (a target with `fire: 50, holy: 0` against a holy-fire spell uses `fire: 50`) but produces a tie when one tag is `+50` (resistance) and another is `-50` (weakness). Both have absolute value 50; the rule doesn't pick.

Reconciliation report item 1.4 flagged this and asked: on absolute-value ties, does weakness win (more dramatic) or resistance win (more conservative)?

## Decision

**Multi-tag composition takes the signed maximum across all applicable tags.** The function `signedMax(resistance_a, resistance_b, …)` returns the largest signed value — most resistant if any tag is resistant, least weak if all tags are weaknesses.

Concretely:
- Target has `fire: 50, holy: 0`. Holy fire spell hits. Composition: `signedMax(50, 0) = 50` (half damage).
- Target has `fire: -50, holy: -25`. Holy fire spell hits. Composition: `signedMax(-50, -25) = -25` (1.25× damage — the *least* weakness wins).
- Target has `holy: +50, fire: -50`. Holy fire spell hits. Composition: `signedMax(50, -50) = +50` (half damage — resistance wins the tie).
- Target has `holy: 0, fire: 0`. Composition: `signedMax(0, 0) = 0` (normal damage).

## Rationale

Two principles drive this:

1. **Conservative tag interactions.** A unit that's been designed as "resistant to holy" shouldn't suddenly be made vulnerable by an interaction with a tag they're weak to. Resistance-wins-ties matches the intuition that a unit's deliberate resistance build holds up against tag-compounding edge cases.

2. **Compounding-tag damage spikes feel chaotic.** "Highest absolute weakness wins" creates surprising damage spikes — a unit that's `holy: +50, fire: -75` takes 1.75× from a holy-fire spell rather than 0.5×. That's the design intent for *single-tag* fire damage on a fire-weak unit, but for *multi-tag* damage it creates an unpredictable feel where designers can't reason locally about a target's expected reaction. Conservative composition keeps reactions readable.

`signedMax` is a clean, single rule with no ties — once the function is defined, every multi-tag case has a unique answer.

## Consequences

- **The damage pipeline implements `signedMax(resistance_a, resistance_b, …)` at the resistance stage.** When the resistance stage handler ships in session 14, it iterates the action's `damageTags`, looks up the target's resistance per tag, and applies `signedMax` to the resulting list. Single-tag damage (the common case) is `signedMax(x) = x`.

- **The `'healing'` tag is excluded from the signed-max set.** Per ADR-0016 ("Healing opts out of resistance modulation"), healing-tagged effects skip resistance entirely. So the `signedMax` set only contains the non-healing tags on the effect.

- **Battle Mechanics Guide updated.** The "highest absolute resistance wins" wording is replaced with "signed maximum (most resistant tag wins; ties broken by resistance)". Worked example added.

- **Designers can predict multi-tag interactions locally.** Tagging an ability `[fire, holy]` against a `fire: 50, holy: 0` target is "the half-damage outcome holds because the target is resistant to fire". No surprise weakness-spikes from compounding.

- **Future tags compose without changes.** When `earth` ships with the Earth Mage in session 16, an "earth-and-holy" hybrid spell's resistance composition is the same `signedMax` over both tags. The rule is tag-count-agnostic.

## Alternatives considered

**Highest absolute value, weakness wins ties.** Rejected per the "compounding-tag damage spikes feel chaotic" argument. A target who's a 50-fire-weakness, 50-holy-resistance unit shouldn't take 1.5× from holy-fire just because the spell happens to be both.

**Highest absolute value, resistance wins ties.** Functionally equivalent to `signedMax` in the symmetric case (`+50` vs `-50`) but produces different results on `+50` vs `-25` (absolute-max says 50; signedMax also says 50 — agree) and on `-50` vs `-25` (absolute-max says -50; signedMax says -25 — disagree). The signed-max rule is more conservative across all cases. Picking the consistent rule (`signedMax`) feels cleaner than two competing rules whose outcomes diverge in some cases.

**Average across tags.** Rejected — averaging makes the resistance system feel "soft" and breaks the mental model that resistance values are unit-defining choices. A 100-resistant unit should *be* immune to that tag, not "halfway immune when paired with a weakness".

**Apply each tag's resistance multiplicatively.** Rejected — the Battle Mechanics Guide's resistance scale is a percentage shift (`resistance 50 → 0.5× damage`), not a multiplier. Composing two `0.5×` shifts as `0.25×` would mean a `fire: 50, holy: 50` target takes quarter damage from holy-fire, which has no design basis. The whole point of multi-tag is "the spell hits with a single elemental signature"; averaging or compounding them loses that.

## References

- `docs/battle-mechanics-guide.md` — resistance section (updated to reflect this decision).
- Reconciliation report item 1.4.
- ADR-0016 — healing opts out of resistance modulation; defines the exclusion that keeps `'healing'` out of this composition.
