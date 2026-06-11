## ADR-0099: Ability-side revive (`effects.removeKO`) — the Templar's Raise

**Status:** Accepted
**Date:** 2026-06-10

## Context

The Templar's **Raise** (Session 62, Templar arc) is a spell that revives a KO'd
ally and heals them in one cast — the MA/faith-scaled analogue of the Alchemist's
**Phoenix Down**. Revival already existed in the engine, but only on the
**consumable** path: `ConsumableDefinition.effects.removeKO` (Phoenix Down),
handled in `applyConsumableEffects` / the Throw Item reducer (`reducers.ts`).
`AbilityEffects` had **no** revive field — the substrate audit (S62) classified
Raise as "compose + small wire."

Three engine facts shaped the build (all confirmed during the audit):

1. **Targeting already permits KO'd units.** The UseAbility single-unit
   validation (`validate.ts`) checks existence / range / LoS / `removed`, but has
   no KO exclusion — an ability can target a downed ally; normal healing just
   no-ops there.
2. **The heal-gate is explicit and anticipated.** `applyDamageToTarget`
   (`reducers.ts`) blocks healing on `hp <= 0`, and its comment already names
   "explicit Raise / Phoenix Down" as the intended bypass (deferred in v1).
3. **Charged resolution silently fizzles KO'd unit targets.** Per the BMG
   interruption matrix, a unit-anchored charged action whose target is KO'd at
   resolution produces no per-target output (`reduceChargedActionResolve`). Raise
   is charged (actionSpeed 30) and *targets* a KO'd unit — so this guard would
   fizzle it before it could revive.

## Decisions

### 1. Revive is an `AbilityEffects` flag, mirroring the consumable

Add `readonly removeKO?: boolean` to `AbilityEffects`. Semantics match the
consumable exactly: when set, resolving the ability against a KO'd, non-`removed`
target revives it (**HP 0 → 1, turnsKOd → 0, CT → 0**) **before** the
damage/heal pipeline runs. A co-declared healing `damage` effect then lands on
the now-live unit, so it returns at **1 + (MA × power × faithFactor)**. Raise
uses power 10 (vs. Cure's 8) → ≈ 37 HP at MA 6 + Emissary, a flat premium over
Phoenix Down (4 × PA 8 = 32). On a non-KO'd target the revive no-ops and it reads
as a single-target heal — again matching Phoenix Down.

CT resets to 0 ("resume from 0", per the S39 permadeath brief): the revived unit
re-enters the queue at the bottom rather than instantly re-acting.

### 2. The revive lives in `resolveAbilityEffect`, before the damage pipeline

It reuses the existing application machinery rather than a parallel reducer path:
revive into `workingState` up front, and `applyDamageToTarget` — which re-reads
the live unit from state — then sees HP > 0 and its KO heal-gate (fact 2) no
longer blocks the heal. Because resolution is shared between instant and charged
casts, the revive works for both with one insertion. The heal *amount* is
computed by the unchanged healing pipeline (MA × power × faith, capped at
maxHp − hp); faith reads `baseStats`, unaffected by the revive.

### 3. `removeKO` bypasses the charged-resolve KO fizzle (only it)

In `reduceChargedActionResolve`, the unit-target KO skip (fact 3) is amended to
**not** fizzle when `ability.effects.removeKO === true` and the target is not
`removed`. A `removed` (permadeath) unit is never revivable, so it still fizzles.
This is the minimal, targeted relaxation — every other charged ability keeps the
FFT-faithful "target died while you charged → wasted cast" behavior.

## Consequences

- Raise composes on existing faith/healing substrate; the only net-new surface is
  the `removeKO` flag and its two gate-bypasses (heal-gate via revive-first; the
  charged-resolve fizzle exception). No new hook, action type, or pipeline stage.
- **No MP refund on a wasted Raise** (target `removed`, or a tile with no unit):
  consistent with the existing no-refund-on-fizzle rule.
- Raise is authored hidden and not yet in a surfaced command set (it will join the
  Templar's command set at class assembly). Wiring it into `white_magic` now would
  give the basic-AI healer both Cure and Raise and change S57's heal-choice
  assertion — deferred deliberately.
- Symmetry preserved with the consumable path: both revive-then-heal in the same
  order; a future Esuna/Arise-style content piece can reuse `removeKO`.

## Tests

- `src/content/session-62-templar-foundation.test.ts` — Raise spec fields; heal
  formula MA × 10 × faith = 38.4 via the damage pipeline.
- `src/engine/actions/session-62-raise.test.ts` — charged end-to-end: a KO'd ally
  is revived (alive, turnsKOd reset, charge cleaned up) and healed; on a non-KO'd
  ally the revive no-ops and it lands as a heal.
