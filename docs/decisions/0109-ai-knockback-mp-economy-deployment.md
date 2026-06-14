## ADR-0109: AI capability expansion — knockback value, MP economy, role-aware deployment

**Status:** Accepted
**Date:** 2026-06-14

## Context

Content has out-run the AI scorer again (the second capability-expansion arc;
see `docs/thirtyNinePlanning/ai-capability-expansion-blueprint.md`). Three gaps,
all evaluable from the single-move horizon, were closed this session as three
checkpointed chunks. All three obey the arc's inherited constraints: single-move
horizon, offence first-class / non-damage strictly subordinate, compose on
existing machinery (don't special-case). The three decision points (D1–D3) were
settled by Chris before build.

## Decisions

### Chunk 1 — Knockback usage (D1: consequence-only)

The scorer now folds the expected fall consequence of a `damage.knockback` rider
into an offensive action's score. It projects the post-knockback landing tile via
the engine's own `applyKnockback` primitive (single source of truth, no drift
from the reducer), values the resulting fall through the **same** per-occupant
fall scorer the Worldcraft arc uses (`fallValueForOccupant`, factored out of
`scoreWorldcraftFall`), and weights it by the expected knockback chance
(`computeAbilityChance`, the pure compute extracted from `rollAbilityChance` —
mirroring the existing `computeStatusChance`/`rollStatusChance` split).

- **D1 — consequence-only, not pure displacement.** v1 values only the
  hazard/perch fall (real damage → stays first-class). A clean shove onto open
  ground scores 0. Pure displacement is non-damage positional value — deferred to
  a later beat where the cower failure mode needs careful handling.
- Applied to both single-target (`scoreSingleUnitOffensive`, e.g. Bull Rush) and
  AoE (`scoreAoeOffensive`, e.g. the Hydrologist's Tidal Wave / Maelstrom). For
  AoE the knockback direction is uniform caster→anchor, matching the reducer; a
  caught ally shoved into a hazard is signed negative (a cost), deterring it.
- Gated on the target surviving the direct hit (`projected < hp`), mirroring the
  reducer's `hp > 0` post-damage knockback gate — no phantom fall value on an
  expected-lethal hit.
- Audit finding: the AI had **zero** knockback awareness before this — confirmed
  real evaluation work, not the thin wiring the brief hedged might already exist.

### Chunk 2 — MP economy (D2: soft scaled penalty only)

`mpSpendPenalty` subtracts an action's MP cost from its score, scaled by a convex
MP-scarcity curve `(1 − mp/maxMp)²`. Negligible when MP is plentiful (normal play
undistorted); rises as the pool runs low so the AI conserves its last MP for
*marginal* casts. The penalty is **bounded and subordinate** — `mpCost × weight ×
scarcity` — so a genuinely high-value cast (lethal, big AoE, even a 50%-better
Power Attack) wins through it; it only tips near-ties. Free / 0-MP abilities are
never penalized, so a basic Attack naturally beats a marginal cast at low MP.

- **D2 — soft penalty only, no hard floor.** Same soft-scaled shape the arc
  already uses. A hard floor risks the resource version of the cower problem (an
  AI that hoards MP and stops casting); a floor is a future lever only if playtest
  shows the soft term insufficient.
- **Applied inside the leaf scorers** (`scoreSingleUnitOffensive`,
  `scoreAoeOffensive`, `scoreAllyBuff`), not at pool assembly. This is load-
  bearing: the joint move-then-act planner compares offensive options internally
  and only the winner surfaces to the pool — a pool-level penalty could never flip
  a free-attack-vs-MP-cast choice that was already decided inside the planner.
- **Scoping (flagged, deliberate):** the penalty covers offence + ally-buff, the
  classes the motivating case (mages running dry) and the joint planner need. It
  is **not** applied to heal / Math / Worldcraft — penalizing heals risks the
  support-cower mode, and Math/Worldcraft score in derived currencies with their
  own tuned dials. Extending to them is a small, deliberate follow-up, not assumed.
- **Restore-valuation:** an Ether throw is valued higher as the recipient's MP
  runs low (`× (1 + scarcity)`), the mirror of the spend penalty. Audit finding:
  Ether (Alchemist throw) was already an AI candidate, so restore-valuation had a
  real consumer — the brief's open audit question resolved.
- `computeMaxMp` reads the computed max (statName `maxMp`, equipment/status
  composed) per ground rule 5, never a cached field.

Dials (in `src/ai/basic.ts`, documented as playtest dials): `MP_SPEND_PENALTY_WEIGHT
= 1.5`, the convex curve, `MP_RESTORE_SCARCITY_BONUS = 1.0`.

### Chunk 3 — Role-aware deployment sorting (D3: coarse melee/ranged via weaponType)

`planAiDeployment` now ranks own-zone tiles by forwardness (distance to the
opposing centroid, front→rear) and assigns units melee-first-then-ranged (each
maxHP-desc, classId tie-break): melee hold the forward tiles (tanks at the tip),
ranged/casters sit on the protected tiles immediately behind. Role beats HP for
the front/back split. `DeployableUnit.role` is optional and defaults to melee, so
pre-role callers keep the original tanks-forward behavior.

- **D3 — coarse melee/ranged split, classified off weaponType (ADR-0105).**
  `deployRoleFromWeaponType`: bow/wand/staff → ranged; every melee weapon and
  unarmed/unclassified → melee. **This retires the banked `weaponType` hook — its
  first engine/AI consumer.** A richer tank/skirmisher/artillery/support taxonomy
  is deferred (more design than this chunk wanted).
- The deployment-config bridge resolves each unit's equipped weapon type (right
  hand, then left) and classifies its role; `planAiDeployment` stays a pure,
  catalog-blind geometry function.
- **Audit-overturns-spec:** the brief said "using the coverage map", but the
  ADR-0094 coverage map projects threat from *placed* units for a given active
  actor — at deployment neither team is on the field, so there is no actor or
  enemy position to project from. Distance-to-opposing-centroid is the
  deployment-appropriate exposure proxy (and generalizes S43's "front center",
  which is just rank 0 of the forwardness ordering).

## Consequences

- Knockback and MP both ride the existing scored pool and projection machinery;
  no new hooks, action types, or special-cases. `computeAbilityChance` and
  `applyKnockback` are now exported from the engine barrels.
- The `weaponType` hook (ADR-0105) is no longer dangling.
- **Feel is unverified.** All validation is unit-test-only (the PixiJS harness
  can't drive battles). The MP-hoarding cower watch, the knockback feel, and the
  deployment formation all need Chris's in-battle pass — see
  `docs/playtest-watch.md`.

## Alternatives considered

- **Pure-displacement knockback value (D1 no):** valuing a shove-to-reposition
  even without a fall. Deferred — non-damage positional value is the cower-prone
  territory the arc is sequencing carefully.
- **Hard MP floor (D2 no):** "never spend below N MP unless lethal." Blunter
  guarantee against running dry, but risks MP-hoarding paralysis.
- **Pool-level MP penalty:** rejected — can't influence the joint planner's
  internal ability choice (see chunk 2).
- **Coverage map at deployment (D3):** doesn't fit — no placed units pre-battle.
