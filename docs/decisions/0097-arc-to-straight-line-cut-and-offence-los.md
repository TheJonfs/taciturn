## ADR-0097: arc→straight_line content cut + offence-side LoS gate

**Status:** Accepted
**Date:** 2026-06-10

## Context

Every ranged *damage* attack in v1 was `rangeMode: 'arc'` — it lobs over walls,
so line-of-sight (and therefore cover: terrain, units, barriers) never mattered
to ranged combat. This made the deferred Barrier-denial AI consumer (ADR-0094,
Tier B) **inert**: a barrier's LoS-blocking lever blocks nothing damaging. The
S60 brief frames the fix as a shared design decision (a content pivot) followed
by the AI work that builds on it.

This session does the content pivot and the offence-side correctness fix it
surfaces. Barrier denial itself is split to S61 (see Consequences).

## Decisions

### 1. The cut (Chris's call, from the B1 catalog)

Seven single-target bolts and beams flip `arc → straight_line`, so they now
require line-of-sight and can be broken by intervening terrain, units, or
barriers:

- **Lightning Bolt** (`lightning_strike`), **Scorch** (`fire_strike`),
  **Water Lash** (`water_strike`), **Megavolt** (`storm_caller`) — single-target
  magic bolts.
- **Chain Lightning** (`chain_lightning`), **Fireball** (`fire_storm`) —
  target-anchored diamond-r1 AoE.
- **Flame Lance** (`flame_lance`) — caster-anchored line.

Everything else stays `arc`: the **bow** (basic Attack and Charged Attack — see
§3), the lobbed **Rock Toss** (`earth_strike`), the area detonators
(**Earthquake**, **Cataclysm**, **Tidal Wave**, **Maelstrom**), **Discharge
Strike**, and the test-origin **Bolt**. Melee attacks are unchanged.

The cleaving axis is **trajectory plausibility**: flat/fast bolts and beams gate
on sight; lobbed and area/detonating attacks keep arcing over cover. Bows
deliberately stay `arc` so an archer can still shoot over some blocking — fitting
the "snipe at range" identity and leaving the high-ground bow game (S52/S56)
untouched. This is a deliberately **conservative-to-medium** cut: enough that
cover becomes a real mechanic and Barrier denial has teeth, narrow enough that
the balance change is legible in playtest and easy to reverse.

The change is content-only: the coverage map (ADR-0094) and `validate.ts`
already honour the `straight_line` LoS gate; flipping the field is all that's
required engine-side.

### 2. AoE members gate only the cast-to-anchor sightline

For Chain Lightning, Fireball (target-anchored) and Flame Lance (caster-anchored
line), `rangeMode` gates **reaching the anchor**, not the per-tile AoE spread.
You must have line-of-sight to the anchor tile/primary target; the burst then
spreads from that anchor unobstructed (the AoE footprint was never per-tile
LoS-gated). Net feel: "you can't lob Fireball over a wall onto the cluster
behind it, but once you can see the anchor it still bursts normally." Confirmed
with Chris at plan-review.

### 3. Bows stay arc — and the basic-shot subtlety, recorded

`rangeMode` is read **only** from the ability's `targeting`, never from the
weapon (`validate.ts`). A bow's *basic* shot is the shared `attack` ability at
`rangeMode: 'melee'`; the Longbow extends only its *range* (2–5, vertical 99),
not its trajectory mode — so the basic bow shot carries no LoS check at all
today. Keeping bows `arc` sidesteps this: had we wanted the basic bow shot to
honour cover, it would have required either flipping the shared `attack` ability
(touching every melee weapon) or a new weapon-level `rangeMode` override (a real
mechanism). Out of scope; noted here so a future "bows respect cover" decision
starts from the right framing.

### 4. Offence-side LoS gate (B2) — the correctness fix the cut surfaces

The AI's offence reach check (`positionInAbilityRange`, `basic.ts`) used only
the distance gate (`inRange`) — no `rangeMode` LoS/arc check. Under universal
`arc` this never bit (arc almost always targetable). Once attacks are
`straight_line`, it's a live bug with a sharp failure mode: the joint planner
(`pickJointActOrMove`) ranks every (source, ability, target) plan by
`scoreSingleUnitOffensive` (which has no LoS), picks the single best, then
`canCommitAction`-validates **only that winner**. A blocked top pick fails
validation and the planner returns `null` — collapsing the *entire* offence plan
to a fallback move, instead of falling back to the best *reachable* shot.

Fix: `positionInAbilityRange` now applies the same `rangeMode` gate as
`validate.ts` and the coverage map's `canReachAndHit` — `straight_line` requires
`hasLineOfSight`, `arc` requires `arcTargetable`, melee/none gate on range only.
Blocked shots score `-Infinity`, so the planner naturally selects the best
reachable target (or a move that opens a lane). No parallel LoS logic — the
three-resolver discipline: validate.ts, the coverage map, and the offence
projection all read the same `hasLineOfSight` / `arcTargetable`.

This also tightens AoE-anchor enumeration (`tilesInAbilityRange` reuses the same
check), correctly dropping blocked anchors for the flipped `straight_line` AoEs.

## Consequences

- Ranged combat now interacts with cover for the seven flipped attacks: terrain,
  units, and barriers can break a bolt; the AI values and declines shots
  accordingly. Bows are unchanged (still lob).
- The Barrier-denial AI consumer (ADR-0094 Tier B) now has a meaningful LoS
  lever to score against — but it is **split to S61**: it needs a `withBarrier`
  hypothetical-state helper that does **not** yet exist (the brief/handoff
  overstated it — the coverage map is *queryable on* a barrier-mutated state,
  but no helper *constructs* one), plus bounded candidate enumeration and the
  net-benefit scorer (including self-obstruction). Shipping the cut + the LoS
  fix as a standalone, playtestable unit is the clean split.
- **Browser/playtest verification is human-only** (PixiJS harness can't drive AI
  battles). The ranged-combat-under-cover *feel* is the thing to watch — see
  `playtest-watch.md`.
- Tests: +7 in `session-60-offence-los.test.ts` (content-roster guard; open shot
  fires; blocked straight_line declined; blocked arc still fires; the
  no-collapse regression — a blocked high-value target is skipped for a
  reachable one; move-to-LoS repositioning). 1709 → 1716.

## Deferred / follow-ups

- **Barrier denial → S61** (net coverage-delta scorer; build `withBarrier`;
  bound candidates; subtract self-obstruction). Net-benefit scoring confirmed
  as the v1 target (Chris).
- A future "bows respect cover" decision (§3) — weapon-level `rangeMode`, if ever
  wanted.
- Widening or narrowing the cut after playtest reads the meta change.
