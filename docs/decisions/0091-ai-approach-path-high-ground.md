## ADR-0091: AI approach-path high-ground awareness (positional substrate)

**Status:** Accepted
**Date:** 2026-06-08

## Context

Session 56 opens the AI positional/Worldcraft arc (see
`docs/thirtyNinePlanning/ai-positional-worldcraft-blueprint.md`). The arc's
first session was specified as the *positional substrate*: teach the AI to
value standing on good terrain, starting with high ground for ranged units,
as the prerequisite that both fixes the known "AI Hunter won't take
Stonebridge high ground" behavior and gates all of Worldcraft Tier B.

The brief framed the core deliverable as a **new per-destination
action-value scoring loop**: make the move selector score each candidate
destination by the best projected action achievable *from* that tile, via
the existing AI-projection resolver, so a ranged unit prefers elevation
when it improves its best shot and declines it when it doesn't.

**The audit overturned that framing.** The per-destination action-value
loop already exists:

- The joint planner `pickJointActOrMove` (ADR-0033, S20b) already
  enumerates every reachable destination and scores each by the best
  projected action achievable from it, via `bestActFromSource` →
  `projectExpectedDamageFromActor`, which **repositions the actor** and
  runs the shared projection resolver.
- The projection already folds in bow height: `resolvePhysicalVarianceBand`
  applies the longbow's `height_delta` damage reward (S45/ADR-0083),
  `positionInAbilityRange` applies the range-from-height bonus (S52), and
  `computeElevationModifier` applies the hit modifier.

So for a ranged unit that can **move and shoot the same turn**, the AI
*already* prefers a perch that improves its best shot, *already* declines
an empty peak (no better projection → not preferred), and *already*
preserves move-and-shoot. Three characterization tests confirm this
against the live `decideBasicAi` path.

The genuine remaining gap is the **approach path**: when no shot is
available from any reachable tile this turn, the joint planner returns
null and the AI falls through to `pickBestMove`, which was pure
distance-closing to the highest-kill-value enemy (`compareMoves`:
best-offensive-score, then raw `horizontalDistance`) with **zero
positional awareness**. A bow unit out of range walks the shortest/flattest
path instead of climbing toward a perch it will shoot from next turn —
this is the blueprint's "height reachable by move alone" case and the most
plausible live home of the Stonebridge feel.

## Decisions

### 1. Add a height-seeker positional term to `pickBestMove`

`pickBestMove` gains an approach-path term that fires **only** for
height-seekers (see #2) and only when the unit has a projectable shot.
For each reachable destination it computes a `positionalValue` — the best
damage the unit could project against the priority target *from that tile*,
range gate relaxed, via the existing `strongestDamageFollowUp` (which
already drives the projection resolver and is height-sensitive for free).
Destinations then compete on a blended rank:

```
rank = positionalValue − distanceCost × distanceToPriority
distanceCost = APPROACH_DISTANCE_FRACTION × baseShot
baseShot = projected shot from the actor's current position
```

`baseShot` sets the scale, so the distance/positioning tradeoff is
**damage-scale-independent**: each tile of detour toward a perch must buy
at least `APPROACH_DISTANCE_FRACTION` of the unit's own shot in extra
(height-boosted) projected damage to be worth it. On flat ground
`positionalValue` is constant across tiles, so distance decides and the
unit closes exactly as before. When `baseShot` is 0 (no projectable shot),
the term is inert and pure distance-closing applies.

**An actually-reachable shot still dominates** (`compareMovesPositional`
keeps `bestOffensiveScore` as the top tier), so there is no passivity
regression: a destination that puts an enemy in offensive range beats any
amount of positioning.

**Reuse, not a parallel scorer.** The positional value routes through the
same projection resolver the act-side uses (`strongestDamageFollowUp` →
`projectExpectedDamageFromActor` → `projectExpectedDamage`). No parallel
height-scoring path — the three-resolver discipline is preserved, so
live / projection / forecast cannot drift on height handling.

### 2. Identify height-seekers by weapon data, not a `ranged` tag

The brief specified adding a `ranged` tag to weapons/command sets to gate
the offensive height term. The audit makes the tag **redundant**: the
offensive height benefit is already gated correctly by weapon data (only
weapons declaring `physicalVariance: height_delta` or
`rangeFromHeightBonus` benefit). Rather than introduce a second source of
truth, `isHeightSeeker(actor, catalog)` returns true iff an equipped
weapon declares either field — today, exactly bows. This is the same gate
`weaponRangeFromHeightSpec` already uses on the offensive side.

Since magic gets no offensive height benefit in v1 (only bows declare the
fields; casters get only the ±5% elevation hit modifier), deriving from
weapon data yields exactly the intended set this session. If a later
session gives offensive magic a height reward, it declares the weapon/
command-set field and is picked up automatically — no AI change.

### 3. `APPROACH_DISTANCE_FRACTION` is the temperament dial

The single tunable `APPROACH_DISTANCE_FRACTION` (default **0.25**) governs
how far a height-seeker will detour toward a perch. Raise it to climb less
(favour tempo), lower it to climb more. This is the local instance of the
blueprint's recurring future-vs-greedy temperament dial; it is set
conservatively against the over-climbing / tempo-loss watch-for and is
expected to be tuned against live play.

## Consequences

**Positive:**

- The Stonebridge-class behavior is addressed end to end: a ranged unit
  both takes payoff high ground when it can move-and-shoot (already true,
  now pinned by tests) and *advances toward* a payoff perch when it can't
  shoot yet (the new term).
- Melee and other non-height-seeking units are completely unaffected —
  they never enter the positional branch, so distance-closing approach is
  byte-for-byte unchanged (33 existing `basic.test.ts` tests still green).
- The brief's `ranged` tag is avoided; weapon data stays the single source
  of truth for who benefits from elevation.

**Negative / open:**

- **Over-climbing risk.** A first-class positional term can pull a unit
  off the line of advance. Guarded by the conservative
  `APPROACH_DISTANCE_FRACTION`, the dominant-`bestOffensiveScore` tier, and
  a behavioral test (a tall wrong-way peak is declined), but the real
  calibration is a playtest concern — logged in `docs/playtest-watch.md`.
- **`positionalValue` is range-relaxed.** It reflects a destination's
  height-boosted shot *potential* regardless of whether the target is
  reachable from there, so a strong perch can win even when it does not
  advance. This is intended (it is the "set up a perch" behavior) but is
  the lever most likely to over-fire; the distance term is what keeps it
  in check.
- **Defensive above-melee-reach term not built.** The blueprint's
  defensive channel (standing above an attacker's melee vertical reach,
  reach = 3 per the default ruleset) needs an incoming-threat model, which
  does not exist (audit A4). Deferred cleanly to a later session.
- **Projection cost.** `pickBestMove` now runs `strongestDamageFollowUp`
  per reachable destination for height-seekers — combinatorially heavier
  than the old distance-only scan. Bounded to the fallback path (no shot
  available) and to bow users; profile if high-Move bow units on open maps
  slow turn evaluation.

## References

- `src/ai/basic.ts` — `isHeightSeeker`, `pickBestMove` positional term,
  `compareMovesPositional`, `APPROACH_DISTANCE_FRACTION`.
- `src/ai/session-56-ai-high-ground.test.ts` — characterization suite
  (move-and-shoot CORE already works) + approach-path behavioral tests.
- ADR-0033 — the joint planner + projection resolver this extends.
- ADR-0083 / S45 — bow `height_delta` damage variance.
- S52 — bow range-from-height (`src/engine/abilities/range-height.ts`).
- `docs/thirtyNinePlanning/ai-positional-worldcraft-blueprint.md` §4 — the
  positional substrate design.
- `docs/thirtyNinePlanning/session-56-brief.md` — the session brief
  (whose CORE framing the audit overturned).
