## ADR-0101: On-heal hooks — Unified Calling + Emissary (Templar innates)

**Status:** Accepted
**Date:** 2026-06-10

## Context

Two Templar innate passives needed substrate the engine didn't have (Session 62
substrate audit, T8):

- **Unified Calling** (Reaction) — "on receiving healing, recover MP equal to
  self's PA." No on-heal reaction trigger existed; the closed hook surface (ground
  rule 8) had `onDamageReceived` / `onFinalDamageReceived` but nothing for healing.
- **Emissary of Murond** (Support) — "all healing applied boosted +25%." No
  healing-output modifier existed. It can't ride `modifyStatQuery` on MA: that
  would also boost the unit's magical *damage* (MA feeds both), and Emissary is
  healing-only.

So both required new entries on the closed hook surface — a deliberate decision,
ratified with Chris.

## Decision

### Two new hooks

1. **`onHealingReceived`** — `{ unit, amount } → ReadonlyArray<ProposedAction>`.
   Fired against the **recipient** after a one-time heal lands; emission-only
   (mirrors `onMoveCompleted`). Unified Calling emits a `system_mp_restore` of the
   recipient's PA (a new `heal_reaction` provenance kind on `SystemMpRestoreSource`).
2. **`modifyOutgoingHealing`** — `{ unit, baseValue } → number`. Queried against
   the **healer**; `baseValue` is the running multiplier (caller seeds 1.0); a
   handler returns `baseValue × factor` (Emissary × 1.25). Mirrors
   `modifyResistance`'s fold but multiplicative.

### Scope — one-time sources only (Chris, plan-review)

Both apply to **one-time-source** healing, **not recurring-status** healing:

- **Ability heals** (Cure / Raise): fired/applied in `resolveAbilityEffect`.
  Emissary pushes its factor onto `ctx.multipliers`, so it composes
  *multiplicatively* with faith / MA / variance at the finalize fold (the
  "multiplicative healing stack" the concept-notes intend). Unified Calling fires
  on the recipient when `finalDamage > 0` and the heal is **natively** healing
  (an absorption-flipped hit per ADR-0057 is not "received healing").
- **Consumables** (Potion / Phoenix Down): in `applyConsumableEffects`, Emissary
  scales `hpRestore` (floored to keep HP integer); Unified Calling fires on the
  recipient when HP was applied.
- **Regen (`system_heal`): excluded.** Neither hook fires there — enforced
  *structurally* (the `system_heal` reducer has no firing site), matching "not
  from a recurring status." Field Recovery (also `system_heal`) is incidentally
  excluded too; acceptable for v1.

### No loop

Unified Calling emits `system_mp_restore` (MP, not HP), which does not re-enter
the healing path — so the on-heal reaction can't trigger itself.

### Base PA, not effective PA

`onHealingReceived` handlers get the unit snapshot (not state/catalog), the
established emission-hook pattern (cf. Thoughtful Pacing). Unified Calling uses
`unit.baseStats.pa`. Matches the concept-notes example (PA 6 → 6 MP); effective-PA
scaling (gear / Martial Expertise) is a possible later refinement, not v1.

## Consequences

- The Templar self-sustain loop works as designed: stand in your own Cure cross
  (`excludeCaster: false`) → heal self → Unified Calling restores PA in MP → Cure
  nets ~2 MP. Both halves are now in place (Cure already excludes-caster-false).
- Emissary is a strong cross-class donor (1 Support pt → +25% on any healer
  secondary); on the Templar it always multiplies Cure / Raise / thrown Potions.
- **Playtest watch** (from the concept-notes): the healing stack is multiplicative
  — Emissary × Faithstrider (faith ↑) × Imp Halberd (MA +1) × high-faith targets
  compound (~1.5–1.7×). Eyeball the fully-invested ceiling once playable.
- Both passives are authored `available`; innate-free on the Templar is wired at
  class assembly (Step 5).

## Tests

- `src/engine/actions/session-62-heal-hooks.test.ts` — the two runners in
  isolation; Emissary's pipeline ×1.25 (multiplier present, finalDamage 20→25);
  end-to-end: an Emissary caster heals a Unified Calling target → +25 HP, +PA MP.
- `src/content/session-62-templar-foundation.test.ts` — cost-1 Support / Reaction
  budget shapes.
