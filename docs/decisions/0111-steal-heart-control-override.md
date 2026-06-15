## ADR-0111: Thief (chunk 2) — Steal Heart + the control-override substrate

**Status:** Accepted
**Date:** 2026-06-15

## Context

Completes the Thief's deferred chunk 2 (the throttle-cut from ADR-0110): the
24-MP capstone **Steal Heart** (a 3-turn charm) and the **control-override
substrate** it sits on. The audit confirmed this was genuinely net-new — a unit
had no notion of a controller distinct from its `team`, and both the
win-condition check and the orchestrator keyed off `team` directly.

Three design calls were settled with Chris before build (they set chunk 2's
size and feel):

1. **Charm fidelity → control-only (v1).** A charmed unit's *controller*
   flips to the charmer; its `team` does not. Friend/foe (targeting, AoE
   coloring, the enemy AI's threat assessment) and win/loss stay team-keyed;
   the charmer directs the puppet against its old allies via the ruleset's
   existing `friendlyFire` allowance. The full friend/foe flip (the puppet
   hostile to its old team for AI/targeting) was rejected as a large rewire
   that would blow the throttle.
2. **Last-enemy charm does NOT win.** Win keys off `team`; charming the last
   living enemy just buys 3 puppet-turns. No win-check change.
3. **Gender-absent target → invalid.** Steal Heart requires both caster and
   target to carry an explicit, opposite `Unit.gender`. The team builder (S55)
   assigns genders, so only bare fixtures are excluded.

## Decisions

### `effectiveController` — the control-override primitive (computed, not stored)

`effectiveController(unit, catalog): TeamId` (in `engine/turn/`) returns the
team that currently drives a unit's actions: its own `team`, unless a status
with the new `controlOverride` flag is active, in which case the team named in
that instance's `customState.charmerTeam`. **Computed, never stored** (ground
rule 5): when the charm expires or breaks, control reverts automatically with no
mutation to unwind. The orchestrator's `pickController` now resolves through it;
everything else (win, friend/foe) still reads `team`, per the control-only
scope.

Reusable substrate, as the concept-notes intended: future Confusion (controller
→ none / random) and Berserk (controller → forced attack) consume the same
`controlOverride` flag with different `customState` and a branch in the query.

### Steal Heart — the charm capstone

- **`AbilityEffects.stealHeart`** effect (new): rolls the additive Thief
  contest (ADR-0110's `rollThiefContestChance`, base 10); on success applies
  the charm status (with `customState.charmerTeam = caster.team`) plus the
  immunity marker. The status ids are content data on the effect, so the engine
  reducer stays decoupled from the specific content.
- **`enthralled`** status — the `controlOverride` charm. `per_unit_ct` duration
  3 (three of the puppet's own turns); does NOT skip turns (the puppet acts,
  for the wrong side). **50% break-on-any-attack-damage** via `onDamageReceived`
  (ADR-0027 emit path) rolling on `ctx.actionSeed`. Note: `system_damage` DoT
  ticks bypass the pipeline, so they do *not* roll the break — the charm is
  slightly less fragile than the concept-notes' "any damage incl. DoT" (flagged
  in playtest-watch). Tagged `negative`, so a target's Slip Free can shave it.
- **`heartwarded`** status — the post-charm immunity. Applied alongside the
  charm with a *longer* duration (5 vs 3), so it outlasts it by two turns →
  the chain-charm-lock window. Modeling the window from cast (not revert) means
  no `onRemove` emission is needed (that hook is `void`); an early break still
  leaves the full window running. A pure marker — no hooks.

### Gating via generic flags (engine/content decoupling)

Two new `StatusEffectType` flags keep `validateAction` from importing content
ids:
- **`controlOverride`** — identifies charm-family statuses for
  `effectiveController` and the "already charmed" rejection.
- **`controlOverrideImmune`** — set on `heartwarded`; `validateUseAbility`
  rejects a Steal Heart whose target carries any such status (the re-charm lock,
  which also covers re-charming an already-charmed unit, since the charm
  co-applies the ward).

Steal Heart validation (a `stealHeart` effect): target alive, opposite explicit
gender, and neither already control-overridden nor warded.

## Edge cases (resolved without crash; tested)

- **Last enemy charmed** → no win (team-keyed). The puppet reverts after 3
  turns and the fight continues.
- **KO while charmed** → counts against the unit's *original* `team` (team-keyed
  win); the charm/ward are finite-duration, so the KO-status-clear sweep
  (ADR-0079) removes them and `effectiveController` reverts (moot — the unit is
  out).
- **Revert mid-charge** → an in-flight charged action the puppet committed
  resolves as committed; charm expiry doesn't cancel it (charged actions aren't
  re-controlled at resolve time).
- **Chain-charm-lock** → blocked by the `heartwarded` window *and* the 24-MP
  cost against a 28-MP bar.

## Consequences

- **AI under-plays it** (content-ahead-of-AI, as flagged in ADR-0110): the AI
  doesn't value gaining a puppet or playing around being charmed. A charmed
  *player* unit (if an enemy ever fields Steal Heart) is driven by the AI; a
  charmed *enemy* is driven by the human — both correct under control-only.
- **Control-only scope quirk (watch):** the puppet's former allies' AI won't
  proactively attack it (same `team`), and the puppet is only useful offensively
  via friendly-fire. Promote to a full friend/foe flip later if the charm feels
  toothless.
- Catalog: abilities 101 → 102 (`steal_heart`), statusTypes 33 → 35
  (`enthralled`, `heartwarded`). 1872 → 1880 tests.

## Out of scope (unchanged from ADR-0110)

Steal Equipment / Equip Change; expansive (non-gender) Steal Heart targeting;
AI valuation of the self-state kit; the Thief in default team templates.
