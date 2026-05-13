// apply_burn_proc — Session 31. Hidden single-target Burn application
// fired by Flametongue's `attackProcs`.
//
// Distinct from `smolder` (Fire Mage's reaction) and from `spark` (Fire
// Mage's first-action Burn-bomb). Smolder is a reaction-compiled
// passive that applies Burn to the *attacker* of a magical hit; this
// ability fires against the *target* of Flametongue's physical hit.
// Spark applies 2 stacks with a charged cast, 80% Faith-gated chance,
// and 10 MP — different consumer surface entirely.
//
// Per the equipment doc:
//   "Weapon-applied status procs use flat percentages, not Faith-gated
//   rolls. Decouples weapon riders from the wielder's casting prowess;
//   consistent with FFT weapon-effect mechanics. A Knight with a
//   Flametongue procs Burn at the same rate as a Fire Mage with one."
//
// The flat-percentage gate is the weapon-side `attackProcs[].chance`
// (Flametongue: 25%). Once the proc lands, the Burn application
// short-circuits the BMG formula via `applyAlways: true` — the cast
// always lands modulo per-target customState computation. The Burn
// ITSELF still routes through the standard onTick → system_damage path
// where target Fire resistance modulates the damage.
//
// `actionSpeed: 0` is the explicit-instant authoring choice; the rider
// bypass path (ADR-0068) would short-circuit charge regardless, but
// keeping the field at 0 keeps the ability self-coherent if it ever
// surfaces in a non-rider context.
//
// MP-free, hidden. The ability never appears in a command menu — only
// fired from the attackProcs substrate via riderSource.

import {
  abilityId,
  bucketId,
  statusTypeId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const applyBurnProc: ActiveAbilityDefinition = {
  id: abilityId('apply_burn_proc'),
  name: 'Burn',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'hidden',
  tags: ['fire'],
  targeting: {
    kind: 'single_unit',
    // Range is irrelevant for rider-fired emission (the proc handler
    // emits against `ctx.target.id` directly); declared 1H/0V so the
    // ability self-describes a "melee" reach if it ever surfaces in a
    // non-rider context.
    range: { horizontal: 1, vertical: 1 },
    rangeMode: 'melee',
  },
  actionSpeed: 0,
  mpCost: 0,
  effects: {
    statusEffects: [
      {
        typeId: statusTypeId('burn'),
        target: 'primary_target',
        applyAlways: true,
        stackQuantity: 1,
      },
    ],
  },
};
