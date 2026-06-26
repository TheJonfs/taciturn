## ADR-0128: Generalized outgoing-status-magnitude (Pendant of Lumara)

**Status:** Accepted
**Date:** 2026-06-26

## Context

S74 wanted Pendant of Lumara: MA +2, and the Burn the wearer applies hits twice
as hard per stack.

The S72 `modifyOutgoingStatusMagnitude` hook (ADR-0122, Aura Mastery) looked like
the home for this, but the audit found two blockers: (1) it is **buff-only** —
the apply pipeline only invokes it for statuses flagged `amplifiable`, and gates
out equipment-sourced applications; (2) **Burn doesn't route through it at all**
— Burn's per-stack damage is computed in its `composeApplyState`
(`floor(MA × BURN_COEFFICIENT)`, snapshotted per stack), which never consults the
magnitude hook. So the Pendant could not reuse the hook as-is.

Chris's call (over a narrow Burn-specific channel): **generalize the magnitude
hook to cover debuffs**, routing Burn through it.

## Decision

Make Burn's `composeApplyState` route its per-stack value through the caster-side
`modifyOutgoingStatusMagnitude` chain, and let equipment contribute handlers to
that chain.

- **`ComposeApplyStateArgs` gains `target: Unit` and `statusType:
  StatusEffectType`** (threaded from `applyStatus`'s call site) so a composer can
  name itself to the hook without a self-referential `const`.
- **Burn's composer calls `runModifyOutgoingStatusMagnitude({ caster, target,
  statusType, baseMagnitude: perStackDamage })`** after computing the base
  per-stack value, re-flooring at ≥1. Skipped for source-less (system) applies
  (no caster gear to consult). The amplified value is baked into the stack
  (survives, FIFO-drops) exactly as the base value was — consistent with Burn's
  snapshot model.
- **Independence from Aura Mastery is automatic.** Aura Mastery's handler returns
  `baseMagnitude` unless `statusType.amplifiable === true`; Burn does not declare
  `amplifiable`, so Aura Mastery ignores it. Buff-amplification and
  Burn-amplification compose on the same hook but never collide.
- **Equipment substrate:** `EquipmentBase.outgoingStatusMagnitudeMods`
  (`{ factor; statusTypeId?; statusTag? }[]`) + `outgoingStatusMagnitudeContributor`,
  registered on `modifyOutgoingStatusMagnitude`. Per-type / per-tag multiplicative
  factors on the wearer's outgoing statuses. `runModifyOutgoingStatusMagnitude` is
  re-exported from the hooks barrel so content (`burn.ts`) can call it.

Pendant of Lumara: `{ statMods: { ma: 2 }, outgoingStatusMagnitudeMods:
[{ statusTypeId: 'burn', factor: 2 }] }`.

## Consequences

- Every Burn the wearer applies — Spark, Flame Lance, Smolder, Precision Fire /
  Ignition — is doubled per stack, for the stack's whole lifetime.
- The hook is now genuinely outgoing-magnitude-general: any status whose
  magnitude is meaningful (buff via `magnitude`, or Burn via `composeApplyState`)
  can be amplified by a consumer that opts in. Other custom-magnitude statuses
  (future DoTs) follow Burn's pattern: route their composed magnitude through the
  hook.
- Lowest-risk of the batch — fire resistance brakes the doubled ticks (Burn is
  fire-tagged). Multi-Burn-amp stacking vs. healing is a playtest-watch item.

## Alternatives considered

- **A narrow "outgoing Burn multiplier" channel read only inside Burn's
  composer.** Less surface area but bespoke and non-reusable; Chris chose the
  general hook so future DoT amplifiers reuse it.
- **Flag Burn `amplifiable` and let Aura Mastery amplify it.** Would make the
  Enchanter's buff support double Burn — scope creep on Aura Mastery's identity.
  Keeping Burn non-`amplifiable` and using a Burn-keyed equipment handler keeps
  the two amplifiers cleanly separate.
- **Scale `instance.magnitude` at the apply site (the existing path).** Burn
  carries no `magnitude` (its damage lives in `customState.stackDamages`), so the
  apply-site call is a no-op for it; the composer is where Burn's magnitude is
  born and therefore where the hook must fire.
