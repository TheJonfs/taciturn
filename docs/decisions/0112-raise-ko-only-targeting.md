## ADR-0112: Raise targets KO'd units only (amends ADR-0099)

**Status:** Accepted
**Date:** 2026-06-15

## Context

[ADR-0099](0099-ability-side-revive-raise.md) introduced the Templar's **Raise**
as an ability-side revive (`effects.removeKO` + a healing `damage` effect). It
deliberately mirrored Phoenix Down's living-target behavior: on a **non-KO'd**
target the revive no-ops and the heal still lands, so Raise doubled as a
single-target heal.

In playtest (Chris, S-thief follow-up) that dual purpose backfired on the AI.
Raise carries a `'healing'`-tagged damage spec, so `enumerateHealingAbilities`
(ai/basic.ts) lumped it into the generic heal pool and `bestHealCandidate`
scored it against **living, wounded** allies — the AI cast its expensive 24-MP…
(12-MP) revive spell as an ordinary heal on healthy-ish units. Beyond the AI, a
revive reading as a heal blurs the ability's identity.

## Decision

**Raise is KO-only.** `validateAction` rejects a `removeKO` UseAbility whose
target is alive (`vitals.hp > 0`) or `removed`. The healing component still
lands — but only on the just-revived unit, as the post-revive heal it was always
meant to be.

Two changes implement it:

1. **Engine gate** (`validate.ts`): a `removeKO` block parallel to the Steal
   Heart gate — rejects a living or removed target. Generic over
   `effects.removeKO`, so any future ability-side revive inherits the rule. The
   **consumable** Phoenix Down path is untouched (it keeps its own removeKO
   handling and its FFT-canonical living-target no-op).
2. **AI** (`ai/basic.ts`): `isHealingSingleUnit` now excludes `removeKO`
   abilities, so the AI never proposes Raise as a heal (which validation would
   reject anyway). The AI does not currently revive *with* Raise — dedicated
   revive valuation is a separate, deferred AI beat; this change only removes
   the misuse.

## Consequences

- Raise is now unambiguously "bring back the downed." A player can no longer
  pour it into a living ally as a heal, and the AI won't either.
- This **amends ADR-0099**: the "non-KO'd target reads as a single-target heal"
  paragraph no longer holds for Raise. ADR-0099's core (the `removeKO` ability
  substrate, revive-before-heal ordering) stands.
- Phoenix Down still heals a living target (consumable path unchanged) — the two
  revives now differ on living targets. Acceptable: Phoenix Down is a cheap
  thrown item where the no-op heal is a minor convenience; Raise is a costed
  spell whose identity benefits from being revive-only.
- The S62 test that asserted Raise-heals-living now asserts the rejection.
- AI revive valuation (casting Raise on the KO'd) remains unimplemented — noted
  for a future Templar/AI beat.
