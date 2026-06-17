## ADR-0114: Per-swing weapon consistency (dual-wield accuracy/variance fix)

**Status:** Accepted
**Date:** 2026-06-17

## Context

Session 42 (ADR-0080) made a dual-wield basic Attack swing each equipped
weapon once, with each swing reading **its own slot's WP** via
`ctx.attackingWeaponSlot` (`physicalPaWp` in `engine/damage/handlers.ts`).
But two other per-swing-relevant reads were never updated to be slot-aware:

- **Accuracy** (`evasionCheck`) read `getEquippedWeapon` — the dominant
  (right-hand) weapon — for every swing.
- **Variance band** (`resolvePhysicalVarianceBand`) likewise read
  `getEquippedWeapon` for every swing.

For *matched* dual-wield pairs (two axes, two knives, two swords) the
dominant and off-hand weapons share accuracy and variance, so the two
reads agree and the inconsistency is invisible — which is why it survived
testing and playtest. It breaks open with a **mixed** pair: the off-hand
swing used its own WP but the *right-hand* weapon's accuracy and variance.

This let a dual-wielder launder the best of both weapons. Worst case
(found during the S68 weapon trade study): an Assassin with **right-hand
Sai** (accuracy 95, `attacker_speed` variance ≈ 2.1× under Boots of
Haste at Speed 21) and **left-hand War Axe** (WP 12). The off-hand axe
swing dealt `PA × 12` at the Sai's 95% accuracy and 2.1× variance — a
12-WP weapon swinging with a knife's speed-variance and accuracy. The
low-WP counterweight that makes knife speed-variance fair was bypassed,
producing roughly double the throughput of the next-best build.

## Decision

Route **every** per-swing weapon read through one shared resolver,
`getSwingWeapon(unit, attackingWeaponSlot, catalog)` in
`engine/items/equipment.ts`:

```
attackingWeaponSlot !== undefined
  ? getWeaponInSlot(unit, attackingWeaponSlot, catalog)  // the swinging hand
  : getEquippedWeapon(unit, catalog)                     // dominant (single-swing / forecast)
```

- `physicalPaWp` (WP) refactored onto it (bit-identical).
- `evasionCheck` (accuracy) now reads the swing weapon.
- `resolvePhysicalVarianceBand` gained an optional trailing
  `attackingWeaponSlot?` parameter and reads the swing weapon; the live
  variance handler passes `ctx.attackingWeaponSlot`, and the AI
  projection's variance handler passes its `ctx.attackingWeaponSlot` to
  stay in lockstep with the live pipeline.

Each swing is now internally consistent: a mixed pair resolves the
right-hand swing entirely from the right weapon and the off-hand swing
entirely from the off-hand weapon.

## Consequences

- **The launder is gone.** A mixed dual-wield now does exactly what the
  weapons say per hand — no cross-hand stat borrowing.
- **Matched pairs are unchanged** (the dominant read already equalled the
  per-slot read), so existing dual-wield content/tests are unaffected.
- **Single-swing callers and the UI/AI forecast are bit-identical.** They
  pass no slot, so `getSwingWeapon` falls back to the dominant weapon
  exactly as before. The forecast/AI still model only the dominant swing
  for dual-wield — a *pre-existing* representation gap, untouched here and
  noted as separate follow-up.
- **`lanceBonus` intentionally left on `getEquippedWeapon`** — it gates
  Dragoon Jump (a single-weapon ability), never a multi-swing context.

## Alternatives considered

- **Make accuracy/variance read the dominant weapon by design** (i.e.
  declare the current behavior intended) — rejected: it contradicts the
  per-slot WP read shipped in S42 and produces the launder above. The
  swing is the natural unit of consistency.
