## ADR-0067: Weapon-sourced asymmetric variance — `physicalVariance` fork

**Status:** Accepted
**Date:** 2026-05-12

## Context

Session 31 (Cluster 5 content) ships War Axe at `[0.9, 1.3]` asymmetric variance (per the equipment doc) and Bolt Hammer at the same band. Axe-family identity per the doc: "low accuracy (75), high asymmetric variance for high-roll upside, swingy. The gambler's choice physical."

Variance lives on the *ability* today — `AbilityCommon.damageSpec.variance: { min, max }` — and the variance pipeline stage reads it as `ctx.variance`. The default-1 single-value `{ min: 1, max: 1 }` indicates no variance, and the `varianceRoll` handler short-circuits.

The basic Knight `attack` ability declares no variance — so every axe wielder swings deterministic damage today. Authoring weapon-specific variance on the *ability* would split the universal `attack` into per-weapon variants, defeating the universal-attack pattern (per ADR-0028, the swing reads WP from the equipped weapon; the ability itself is class/equipment-agnostic).

Variance is "the swing's character," not "the attack ability's character." The weapon should carry it.

## Decision

**Optional `physicalVariance?: { min: number; max: number }` on `WeaponEquipment`.** Declared by axe-family weapons (War Axe, Bolt Hammer); absent on swords, wands, staffs. No effect on shields, armor, headgear, accessories (the field lives on `WeaponEquipment`, not `EquipmentBase`, to constrain authoring).

**Pipeline variance stage forks.** The `varianceRoll` handler at `engine/damage/handlers.ts:varianceRoll` resolves the band before rolling, via a small helper `resolveVarianceBand(ctx, env)`:

```ts
function resolveVarianceBand(ctx, env): { min, max } {
  if (!ctx.damageTags.has('physical')) return ctx.variance;
  const weapon = getEquippedWeapon(ctx.attacker, env.catalog);
  if (weapon?.physicalVariance !== undefined) return weapon.physicalVariance;
  return ctx.variance;
}
```

**Fork is physical-gated.** A Wand-of-Depths-wielding Water Mage casting Water Strike (magical) reads `ctx.variance` (ability-side; default `{1, 1}` → identity). The wand could carry `physicalVariance` for its own swings without leaking into magical casts.

**Sub-stream unchanged.** Sub-stream 0 (the existing variance lane) consumes the per-action seed identically; the fork picks the band, not the lane. Deterministic per `(state, action, seed)` regardless of which band wins.

**War Axe and Bolt Hammer ship with `physicalVariance: { min: 0.9, max: 1.3 }`.** Other v1 weapons (Long Sword, Flametongue, Wand of Depths, Wand of Deepwood, Staff of Power, Staff of Abundance) carry no variance field; their wielders' physical hits use `ctx.variance` (which is `{1, 1}` for the universal Knight `attack`).

## Rationale

**Weapon-side over ability-side.** Variance is a property of the swing's hardware, not the abstract attack action. Authoring on the weapon keeps the universal `attack` ability universal; axe variance is an axe trait, not an attack-with-axe trait.

**`physicalVariance` field name.** Disambiguates from ability-side `damageVariance` / `damageSpec.variance` (a shadowed name would be confusing). Signals scope: physical hits only (the magical / healing handlers don't compose with weapon WP, so weapon variance on them would be conceptually misplaced anyway).

**Optional field, default fallback.** Most weapons don't declare variance; the absent-field path falls through to `ctx.variance` identically to pre-Session-31 behavior. Zero-impact on existing content authoring.

**Sub-stream 0 stays.** Picking a different sub-stream for the weapon band would change variance roll values for War Axe (and any later content that swaps band sources) — a determinism shift across the same `(state, action, seed)` triple, breaking replay parity. The fork picks the band; the lane stays at 0.

**Field lives on `WeaponEquipment`, not `EquipmentBase`.** The fork already gates on `getEquippedWeapon(...)`; placing the field on the union's weapon arm keeps the type contract local. Future expansion (a shield's "+0.05 variance band" support gear?) would require explicit decision and ADR-level discussion; for v1 the field is weapon-scoped.

**Mean of `[0.9, 1.3]` is 1.1, not 1.0.** Asymmetric. War Axe's expected effective WP is `WP × hitRate × varianceMean = 12 × 0.75 × 1.1 = 9.9` — matches the equipment doc's expected effective WP. Sword family's expected effective is `8 × 0.95 × 1.0 = 7.6` (no variance, no asymmetry). The 30% damage upgrade in exchange for accuracy cost lands as designed.

## Consequences

- **`WeaponEquipment` gains one optional field** (`physicalVariance`). No v1 path requires it; opt-in.
- **`varianceRoll` reads `ctx.attacker` via `getEquippedWeapon(ctx.attacker, env.catalog)`.** Adds one cheap lookup per physical pipeline run (`Map.get` over the unit's equipment). No measurable hot-path impact in v1.
- **War Axe retrofit lands as a free regression** — its prior deterministic-damage behavior is now band-driven. Tests that pinned War Axe damage to a literal value will need to extend to a band assertion; no v1 such test exists.
- **Future weapons can opt in without engine work.** New axes, hammers, or any other identity-driven variance gear set the field on their definition; the fork picks them up automatically.
- **The fork applies only to physical hits.** A future "magical weapon variance" need (a wand whose magic has a variance band) would need a sibling field (`magicalVariance`) and a parallel fork — not yet warranted by v1 content.
- **Replay parity preserved.** Same `(masterSeed, sequenceNumber, action)` produces the same factor — the band swap is on the SAME sub-stream, so the same float lands in the same place. War Axe's variance roll today is reproducible across replays.

## Alternatives considered

**Weapon variance overrides ability variance only when ability variance is `{1, 1}` (the default).** Considered — would allow a weapon-specific override but let a future "high-variance spell with a low-variance weapon" path declare its variance and have it dominate. Rejected: makes the precedence order non-obvious (designers have to remember "ability declares variance? Skip the weapon. Otherwise, use the weapon."). The physical-gated fork is the cleaner rule: physical → weapon (if present), else ability.

**Sub-stream 4 (next-free) for weapon-band rolls.** Rejected — different sub-stream means different float across the same seed, breaking the "variance roll is variance roll" determinism contract. The lane stays at 0; the band picker changes.

**Field on `EquipmentBase`.** Rejected — armor / accessories can't declare meaningful weapon-side variance. Type-side authoring discipline trumps schema uniformity here.

**Multiplicative composition (weapon band × ability band).** Rejected — multiplying would mean a `[0.9, 1.3]` × `[0.5, 1.5]` band lands at `[0.45, 1.95]`. Variance bands are usually small swings around 1.0; compounding them would produce wider-than-intended spread. The fork (one-or-the-other) preserves authored intent.

## References

- `src/engine/catalog/definitions/item-definition.ts` — `WeaponEquipment.physicalVariance` field.
- `src/engine/damage/handlers.ts:varianceRoll` — pipeline stage handler; `resolveVarianceBand` helper.
- `src/content/items/war-axe.ts` — first consumer.
- `src/content/items/bolt-hammer.ts` — second consumer (Session 31).
- `src/engine/actions/session-31-integration.test.ts` — fork tests (weapon-declared, ability-fallback, magical-ignored, determinism).
- ADR-0028 — equipment-driven weapon stats (WP, accuracy precedent).
- ADR-0064 — sub-stream architecture (Session 30 `PROC_ROLL_SUB_STREAM = 8`; variance still at 0).
