// Lightning Stab — Knight Battle Skill (Session 42). The S42 swap for
// Stasis Sword in the Knight's Battle Skill set: a normal weapon strike
// that, on hit, has a chance to inflict Silence. Removing the Stop rider
// retires the Knight↔Assassin overlap (the Assassin's Shadow Stitch owns
// Stop now); Silence gives the Knight a caster-disruption tool instead.
//
// Numbers (per S42 brief D3 — hold the rider rate at Stasis Sword's prior
// calibration):
//   - power_coefficient 1.0, variance 0.9–1.1: same damage as basic
//     Attack; the value is the rider.
//   - mpCost 8: parity with Stasis Sword's S41 value — Knight at base
//     20 MP gets two casts.
//   - Silence baseChance 50, factors `{ brave: true, pa: true }` (S65: was
//     `{ brave, ma }`). The Knight's Battle Skill riders now scale on PA, not
//     MA — Bull Rush's knockback and Lightning Stab's Silence share the same
//     PA-driven shape rather than splitting the kit on MA vs PA (Chris's call;
//     ADR-0108). The PA swap is a deliberate *uplift*: PA_factor (Knight PA 10)
//     = 0.9 + 1.0 = 1.9 vs the old MA_factor (MA 4) = 1.3, so at the same
//     baseChance 50 the landed rate rises ~46% (baseline Brave 70/70 → 0.50 ×
//     0.49 × 1.9 ≈ 0.47, up from ~0.32; a Bravestrider Knight at Brave 80 →
//     ~0.53). Lightning Stab is now a solid piece of anti-mage tech — silencing
//     a caster reliably is the point. baseChance is the lever if it reads too
//     sticky in playtest.
//   - Silence duration 4 — matches the v1 Silence palette (Earth Curse,
//     Magebane proc).
//
// Single-swing by default: no `multiWeapon`, so a Two-Weapons wielder
// applies the Silence rider once rather than rolling it per swing (per
// D1b — status-rider attacks opt out of multi-swing to keep proc rates
// interpretable).

import {
  abilityId,
  bucketId,
  statusTypeId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const lightningStab: ActiveAbilityDefinition = {
  id: abilityId('lightning_stab'),
  name: 'Lightning Stab',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'available',
  targeting: {
    kind: 'single_unit',
    range: { horizontal: 1, vertical: 3 },
    rangeMode: 'melee',
  },
  actionSpeed: 0,
  mpCost: 8,
  hitRoll: {},
  effects: {
    damage: {
      tags: ['physical', 'weapon'],
      power_coefficient: 1.0,
      variance: { min: 0.9, max: 1.1 },
    },
    statusEffects: [
      {
        typeId: statusTypeId('silence'),
        target: 'primary_target',
        baseChance: 50,
        duration: 4,
        factors: { brave: true, pa: true },
      },
    ],
  },
};
