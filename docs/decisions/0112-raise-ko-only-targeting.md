## ADR-0112: Revive targets KO'd units only — Raise + Phoenix Down (amends ADR-0099)

**Status:** Accepted
**Date:** 2026-06-15

> **Update (same day):** extended to **Phoenix Down**. The original ADR-0099
> living-target heal was a misread of canon — classically both Raise *and*
> Phoenix Down only function on KO'd units. Both are now revive-only; see the
> Phoenix Down note in Decision/Consequences below.

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

**Revive is KO-only — both Raise and Phoenix Down.** `validateAction` rejects a
`removeKO` action whose target is alive (`vitals.hp > 0`) or `removed`, on both
the UseAbility path (Raise) and the Throw Item path (Phoenix Down). The healing
component still lands — but only on the just-revived unit, as the post-revive
heal it was always meant to be.

Changes:

1. **Ability gate** (`validate.ts`, UseAbility path): a `removeKO` block
   parallel to the Steal Heart gate — rejects a living or removed target.
   Generic over `effects.removeKO`, so any future ability-side revive inherits
   the rule. (Raise.)
2. **Consumable gate** (`validate.ts`, `validateUseThrowItem`): the same rule
   for a `removeKO` consumable thrown at a living target. (Phoenix Down.) The
   reducer's revive/heal logic is unchanged — validation is the enforcement
   point, so the reducer only ever sees a KO'd target in normal play.
3. **AI** (`ai/basic.ts`): `isHealingSingleUnit` now excludes `removeKO`
   abilities, so the AI never proposes Raise as a heal (which validation would
   reject anyway). The AI does not currently revive *with* Raise — dedicated
   revive valuation is a separate, deferred AI beat; this change only removes
   the misuse.

## Consequences

- Both revives are now unambiguously "bring back the downed." A player can no
  longer pour Raise *or* Phoenix Down into a living ally as a heal, and the AI
  won't either (its Phoenix Down throw already targeted only KO'd allies, so no
  AI change was needed there).
- This **amends ADR-0099**: the "non-KO'd target reads as a single-target heal"
  paragraph no longer holds for either Raise or Phoenix Down. ADR-0099's core
  (the `removeKO` substrate, revive-before-heal ordering) stands.
- Living-target heals remain available through the dedicated heals (Cure,
  Potion, Regen) — removing the revive's incidental heal doesn't strand the
  role, it just stops a revive masquerading as one.
- The S62 Raise test and the S39a Phoenix Down test that asserted heal-on-living
  now assert the rejection.
- AI revive valuation (casting Raise on the KO'd) remains unimplemented — noted
  for a future Templar/AI beat.
