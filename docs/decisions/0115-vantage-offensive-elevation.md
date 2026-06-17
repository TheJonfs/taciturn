## ADR-0115: Vantage — attacker-only offensive elevation offset

**Status:** Accepted
**Date:** 2026-06-17

## Context

The Hunter lacked a defining specialist Support and a stat pole (S68 gave it
PA 7 / Speed 10 / MA 5; ADR-less tuning). The design goal was a Support that
rewards committing to a two-handed ranged weapon (the bow) and the high-ground
play the Hunter's mobility kit (Updraft, High Jump) already enables — without
disproportionately buffing other classes (a *generic* two-hander damage bonus
was rejected because Knight Swords are unrestricted and the high-PA Knight
would benefit more than the Hunter).

The chosen mechanic — explored with Chris across several passes — is **Vantage:
the wielder's own offensive computations resolve as if it stood +X tiles
higher**, where X = 2. Two scoping decisions shaped it:

1. **Attacker-only.** The offset applies *only* when the wielder is the
   acting unit in its own offensive resolution. It never touches defensive
   reads (the unit as a target), Math Skill Height, pathfinding/jump,
   knockback, or AoE membership. This was a deliberate narrowing from a fuller
   "effective elevation everywhere" version: the full version had a large,
   bug-prone blast radius (a unit-property offset threaded through every
   tile/position elevation read, with raw-vs-effective consistency to police),
   whereas attacker-only is clean because **every offensive elevation read
   already has the acting unit in context** — no unit-identity threading, and
   raw tile elevation stays canonical for everything else.

2. **The four offensive reads it feeds**, all on the attacker/source side:
   height_delta damage variance, the ±5% high-ground accuracy modifier, bow
   reach-from-height, and the **source endpoint** of attack line-of-sight
   ("shoot over cover"). The "is the target in vertical range" check was
   *deliberately excluded* — geometrically, raising your own elevation makes
   it *harder* to reach targets below (abs vertical distance), which is
   counter-thematic for a downhill archer, and it's moot for bows (vertical 99).

## Decision

- New closed-surface hook **`modifyAttackerElevation { unit, baseValue } →
  number`** (additive; surface 16→17) + `runModifyAttackerElevation`. Callers
  pass the unit's raw source-tile elevation as `baseValue`; the chain returns
  the effective elevation the unit *aims from*.
- **`vantage`** — passive, Support bucket, `baseCost: 1`, free on the Hunter
  (its 2nd free Support, alongside Eagle Eye). One handler: `+2`. **X = 2 is
  the deliberately-spicy first cut** (per the S68 design pass) — re-analyse
  Hunter damage-over-time vs other classes and playtest; dial toward +1 if too
  strong. The flat +2 is, on the linear height curve, an always-on ~+20%/+40%
  on a Longbow's level shots (falloff 0.2), stacking on real terrain.
- **Threaded at every offensive site, including parity mirrors** so live
  resolution, legality validation, the AI projection, the UI/forecast, and the
  AI **threat model** all agree:
  - `resolvePhysicalVarianceBand` height_delta (live + projection + forecast share it),
  - `computeElevationModifier` (+ optional bonus param; live `evasionCheck`, the forecast `computeOutgoingHitChance`, and the projection's private copy),
  - `rangeFromHeightBonus` source elevation and `hasLineOfSight` source endpoint in `validate.ts`, `basic.ts` (AI offense), and `coverage-map.ts` (AI threat-awareness — a Vantage *enemy* menaces over cover),
  - `inRange` vertical checks stay on **raw** source elevation (vertical-range excluded).

## Consequences

- **Bow-shaped without naming bows.** Only bows carry height_delta variance and
  reach-from-height; the accuracy modifier is irrelevant to adjacent melee; and
  nothing here helps a melee bruiser (no defensive benefit to splash). So a
  1-point cost is justified and melee adoption isn't a slam-dunk.
- **One intended cross-class reach: LoS-gated spells.** "Shoot over cover" gates
  on LoS, not bows, so a straight-line caster (e.g. an Aethurge) with Vantage
  clears a Barrier it otherwise couldn't — the intended counter to a Barrier-
  walling Terraformer team (per Chris). The damage/range pieces remain bow-only.
- **No defensive/Math/pathfinding spillover** — the unit is physically at its
  real elevation; it only aims from higher. A Vantage *target* reads raw to
  everyone.
- Surface +1 hook (17), +1 ability (104 total).

## Alternatives considered

- **Full "effective elevation everywhere"** (offset applies as attacker *and*
  target, plus Math Skill Height, vertical range) — rejected: large blast
  radius, raw-vs-effective consistency hazard, and the magnitude tension (one X
  can't give a sane always-on damage curve *and* a meaningful threshold-based
  melee-evasion). Attacker-only is the clean subset that delivers the fantasy.
- **Amplify the height_delta variance only** (the original narrow Vantage) —
  rejected in favour of the elevation-offset, which generalizes (future
  height-delta content rides it) and adds the over-cover and accuracy pieces.
- **Generic two-hander damage bonus** — rejected: buffs the Absolom Knight Sword
  build more than the bow Hunter.
