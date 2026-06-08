## ADR-0092: AI unified scoring currency (pre-empt cascade removal)

**Status:** Accepted
**Date:** 2026-06-08

## Context

Session 57 was specified (in `docs/thirtyNinePlanning/session-57-worldcraft-ai-brief.md`)
as the start of the Worldcraft AI scoring arc (Tiers A/B/C). That brief's
audit step S8 carried a foundational diagnostic, prompted by a playtest
finding: a Knight with an Alchemy secondary command set crafted/used items
(or otherwise busied itself) **instead of taking a lethal KO attack** —
sometimes finishing a fight without ever attacking. The brief asked whether
all action classes are scored in **one commensurable currency**, and forked:
if the cause is a contained scaling constant, fix it inline; if it is
*structural* (parallel non-normalized heuristics, a pre-emptive item
branch), spin it out to its own brief that **precedes** the Worldcraft build,
since building new action classes onto a non-commensurable scorer inherits
the bug.

**The audit found the structural case.** `decideBasicAi` ran three
**pre-empt phases** that committed immediately if they produced any result,
*before* the unified offensive/joint-plan scorer ever ran:

- **Phase 0a — Alchemist** (`pickAlchemistAction`): a pure priority cascade
  (Phoenix Down > Potion > Remedy > Ether) followed by a **Compound-banking
  fallback** that fired whenever the stockpile wasn't full (`have(REMEDY) ===
  0`, `have(POTION) < 2`, …) — with no comparison to the value of attacking.
- **Phase 0b — Math Skill** (`pickBestMathSkill`): committed any option
  scoring ≥ `MATH_SCORE_THRESHOLD = 8`, on a separate scale (raw HP-swing via
  `estimatePerTargetDamage`, buffs hardcoded to 5) — no `killValue` weighting,
  no projection.
- **Phase 0 — Heal**: most-wounded-first cascade gated by an HP-ratio cliff
  (`HEAL_THRESHOLD = 0.5`), committing without comparing to an attack.

Meanwhile the offensive/joint planner (ADR-0033) scored attacks as
`projectedDamage × killValue(target) × (1 − reactionPenalty)`. The pre-empt
phases were thus *strictly ordered by action type, not unified by value*: a
lethal swing scoring in the hundreds would never be evaluated if a
banking-Compound or a marginal Math option fired first.

This is the same risk the Worldcraft arc rests on. Worldcraft casts added as
yet another pre-empt — or scored on their own scale — would inherit the
mis-ranking. Per the S8 fork (ratified with Chris at plan-review), Session 57
**pivoted** to the commensurability fix; Worldcraft Tier A+B moves to S58,
Tier C + the threat model to S59.

## Decision

Every per-turn action class competes in **one commensurable currency** —
expected-damage-equivalent value × target value — inside a single scored
candidate pool. There is no pre-empt cascade.

`decideBasicAi` now builds a pool of `ScoredAction { score, action, key }`
candidates (each pre-validated via `canCommitAction` by its builder), picks
the global maximum, and commits it when `score > 0`. The builders:

- **Offensive + ally-buff:** unchanged joint two-action planner
  (`pickJointActOrMove`), refactored to *return its best plan's score* (and
  the Act-in-place or Move-leg action) so it competes in the pool.
- **Heal (Cure-style):** `effectiveHeal × killValue(ally) × HEAL_WEIGHT`,
  where `effectiveHeal = min(projectExpectedDamage(heal), missingHP)`. The
  `killValue` weighting mirrors the offensive scale — healing a near-dead
  ally scores high, just as finishing a near-dead enemy does — and the
  `missingHP` cap removes the old `HEAL_THRESHOLD` cliff (a full-HP ally
  scores 0 naturally). `HEAL_WEIGHT = 0.7` discounts a heal slightly below a
  symmetric kill (the heal leaves the threat alive).
- **Item throws (Alchemist):** Potion → heal mapping (PA × 12); **Phoenix
  Down (revive)** → `ally.maxHpBase × REVIVE_WEIGHT` (1.5) — deliberately the
  unit's restored battlefield presence, *not* the tiny on-revive heal ×
  killValue; Remedy (cleanse) → `debuffCount × CLEANSE_VALUE_PER_DEBUFF`
  (15); Ether → `effectiveMP × ETHER_VALUE_FACTOR` (0.1, intentionally tiny).
- **Math Skill:** the `MATH_SCORE_THRESHOLD` pre-empt is removed;
  `pickBestMathSkill` returns its best positive option, injected into the
  pool via `MATH_SCORE_SCALE` (1.0). Its score remains raw net-team-value
  (un-`killValue`-weighted), so a lethal attack reliably outranks a marginal
  Math cast. A full `killValue`-weighted Math re-base is **deferred** (the
  chosen "normalize & compete" scope, not "full re-base").

**Compound is demoted to a last-resort fallback.** Crafting is a
deferred-value prep action with no immediate battlefield effect and no
commensurable score, so it stays out of the pool. It runs only when no
scored action is positive **and** the actor can't advance toward an enemy
(the distance-closing Move fallback takes priority). Banking can no longer
block a kill or an advance.

### Decisions ratified at plan-review (Chris)

- **Pivot to unification first** (over "build Worldcraft commensurably anyway"
  or a "narrow guard"): cleanest foundation; the brief pre-authorized it.
- **Math: normalize & compete**, not a full projection/killValue re-base
  this session (bounds scope and test churn).
- **Revive: a scored candidate** that competes (and can lose to a strong
  finish), not a near-pre-empt that always fires first.

## Consequences

- The reported bug is fixed: an Alchemy-secondary unit finishes a killable
  enemy / advances rather than banking items; a marginal Math cast no longer
  pre-empts a lethal attack; a heal wins only when it does more good than
  attacking; a revive competes on the same scale.
- **Worldcraft (S58) inherits a commensurable scorer** — a Pit/Valley/perch
  cast can be priced in the same currency as attacks and items, the
  precondition the brief flagged.
- All value mappings (`HEAL_WEIGHT`, `REVIVE_WEIGHT`,
  `CLEANSE_VALUE_PER_DEBUFF`, `ETHER_VALUE_FACTOR`, `MATH_SCORE_SCALE`) are
  first-pass dials logged in `docs/playtest-watch.md`.
- **Supersedes** the phase-ordering parts of S39b (Alchemist Phase-0a
  pre-empt), S49 (Math `MATH_SCORE_THRESHOLD` pre-empt), and S13/S20a
  (heal-phase precedence + `HEAL_THRESHOLD`). The throw/compound/heal/Math
  *scoring inputs* are reused; only their commit-ordering is replaced.
- This was behavior-preserving on all 1664 prior tests — the change bites in
  edge cases none of them covered (the Alchemist/Math AI-decision paths had
  **no** prior `decideBasicAi`-level coverage). Five new tests in
  `src/ai/session-57-commensurability.test.ts` pin the fix.

### Known limitations / deferred

- **Math `killValue` re-base** — Math scores raw HP-swing; it under-competes
  vs attacks on wounded targets (correct direction) but isn't fully
  weighted. Deferred follow-on.
- **Move-to-heal / move-to-utility** — heals/items/Math are evaluated from
  the actor's current position only; the joint planner's move-awareness
  covers offense + buffs but not the utility classes. Unchanged from before.
- **Compound under-crafting** — now a true last resort, a support Alchemist
  may bank fewer items. Watch entry logged; lever is a "craft when idle and
  safe" heuristic if playtest shows starvation.

## Alternatives considered

- **Build Worldcraft now, commensurable-by-construction; defer the broader
  fix.** A pure Terraformer reaches the unified scorer, so Tier A could be
  built without first fixing the pre-empt. Rejected: cross-class Worldcraft
  (Terraformer-on-Alchemist/Calculator, explicitly in scope per the S54
  watch-fors) would still hit the pre-empt and never consider its casts, and
  Worldcraft scores would have no consistent sibling scale to calibrate
  against.
- **Narrow guard** ("utility yields to a high-value attack"). Rejected as the
  primary fix: kills the worst misbehavior but leaves parallel scales, which
  re-accumulate the same class of bug.
- **Full Math projection re-base this session.** Rejected for scope/risk;
  "normalize & compete" achieves commensurability with far less test churn.
