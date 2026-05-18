## ADR-0078: Dynamic variance source — discriminated union on `WeaponEquipment.physicalVariance`

**Status:** Accepted
**Date:** 2026-05-17
**Session:** 40

## Context

Session 31 (ADR-0067) introduced `WeaponEquipment.physicalVariance` as an optional `{ min: number; max: number }` band that overrides the ability's variance for physical hits. War Axe and Bolt Hammer used the field to express the axe family's asymmetric `[0.9, 1.3]` band (mean 1.1) — variance as a fixed weapon-side property.

Session 40 introduces the **knife** weapon class with a different variance model: the band is **computed from the wielder's Speed at action resolution time**. A Knight (Speed 9) wielding a knife rolls in `[0.85, 0.95]`; a Lightning Mage (Speed 11) wielding the same knife rolls in `[1.05, 1.15]`; a Sai-equipped Knight (Speed 10 post-equipment) rolls in `[0.95, 1.05]`. The same weapon produces different damage depending on who holds it.

Two questions:

1. **How to express "variance source varies" on `WeaponEquipment`** — discriminated union, schema-level dispatch on weapon tags, or a parallel field?
2. **How does the Speed value flow into the band** — direct read, or through the `modifyStatQuery` hook chain so equipment composes (Sai's +1 Speed)?

## Decision

### (1) `WeaponPhysicalVariance` as a discriminated union with `kind: 'static' | 'attacker_speed'`

```typescript
export type WeaponPhysicalVariance =
  | { readonly kind: 'static'; readonly min: number; readonly max: number }
  | { readonly kind: 'attacker_speed'; readonly spread: number };
```

Existing weapons migrate to `kind: 'static'`:

```typescript
// War Axe
physicalVariance: { kind: 'static', min: 0.9, max: 1.3 };
// Bolt Hammer
physicalVariance: { kind: 'static', min: 0.9, max: 1.3 };
```

Knives author the new arm:

```typescript
// Chef's Knife / Magebane / Sai
physicalVariance: { kind: 'attacker_speed', spread: 0.05 };
```

Resolution lives at one site — `resolveVarianceBand` in `engine/damage/handlers.ts`:

```typescript
function resolveVarianceBand(ctx, env): { min, max } {
  if (!ctx.damageTags.has('physical')) return ctx.variance;
  const weapon = getEquippedWeapon(ctx.attacker, env.catalog);
  const source = weapon?.physicalVariance;
  if (source === undefined) return ctx.variance;
  if (source.kind === 'static') {
    return { min: source.min, max: source.max };
  }
  // source.kind === 'attacker_speed'
  const speed = runModifyStatQuery(env.state, env.catalog, {
    unit: ctx.attacker, statName: 'spd', baseValue: ctx.attacker.baseStats.spd,
  });
  const center = speed / 10;
  return { min: Math.max(0, center - source.spread), max: Math.max(0, center + source.spread) };
}
```

### (2) Speed reads through `modifyStatQuery`

Sai's +1 Speed contributes through `statQueryContributor` (the existing equipment additive chain), so the variance computation sees `attacker.baseStats.spd + Sai's +1` automatically. No separate "post-equipment Speed" path; the same chain that any other Speed-reading subsystem uses applies here.

## Considered alternatives

**Schema-level dispatch on weapon tags** — *gate the dynamic path on the `'knife'` tag, no schema change.* Considered and rejected: couples taxonomy to mechanics. Future weapons that want Speed-based variance but aren't knife-tagged (a fast estoc, a thrown dart) would either need to inherit the 'knife' tag (tag pollution) or pay for a second dispatch path.

**Parallel field `dynamicVariance?: 'attacker_speed'`** — keep the existing `physicalVariance` untouched, add a new field with a string-enum source name. Considered and rejected: two fields for one concept invites mismatch (what if both are set?), and the variance source is naturally a single thing.

**Speed read off `attacker.baseStats.spd` directly, no `modifyStatQuery`** — simpler one-liner. Rejected: Sai's +1 Speed (and any future Speed-modifying contributor) wouldn't compose. The variance computation must read post-equipment Speed; routing through the hook chain is how every other stat-driven pipeline read works (PA in `physicalPaWp`, MA in `magicalMaPower`, etc.).

**Computed-by-formula closure on the weapon definition** — `physicalVariance: (speed) => ({ min, max })`. Closures don't serialize, are harder to validate at catalog construction, and don't compose with the future ADR/log-replay surface as cleanly as a data shape. Rejected.

## Consequences

- The discriminated union extends naturally for future variance formulas. The next arm might be `{ kind: 'remaining_hp_fraction', ... }` for a "stronger when wounded" weapon, or `{ kind: 'stack_count', statusTypeId, ... }` for a stack-scaling proc. Adding an arm is one switch branch in `resolveVarianceBand` plus the type entry.
- All existing weapons migrated to `kind: 'static'`. No behavior change at the value level — same band, same rolls, same per-seed determinism.
- The Speed-source path threads through `modifyStatQuery` so the equipment additive chain composes. Future Speed-modifying content (Speed boots, Slow status with negative Speed modifier, etc.) automatically affects knife variance without per-content wiring.
- Magical damage from a knife wielder unchanged: the physical-tag gate in `resolveVarianceBand` ensures the knife's band only applies to physical hits. A Knight-class Lightning-Strike rider procced off Bolt Hammer still reads `ctx.variance` for its variance, not the wielder's weapon variance.

## Tests

`src/engine/actions/session-40-integration.test.ts` covers:
- Speed 10 wielder → `[0.95, 1.05]` band; Speed 5 wielder → `[0.45, 0.55]` band.
- Sai's +1 Speed flows through (Speed 9 Knight + Sai → Speed 10 band).
- Magical damage from a knife wielder ignores the knife band (physical-gate).
- Deterministic per (state, action, seed).
- Static arms unchanged — War Axe and Bolt Hammer continue to declare `[0.9, 1.3]` via `kind: 'static'`.

`src/engine/actions/session-31-integration.test.ts` migrated to the new shape — all existing variance assertions read `{ kind: 'static', min, max }`.
