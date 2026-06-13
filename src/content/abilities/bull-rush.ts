// Bull Rush — Knight Battle Skill (Session 65). A melee weapon strike that,
// on hit, has a high chance to knock the target back one tile. The Knight's
// entry into the "control sub-game": displacement that can shove a target
// off a ledge or into a Pit/Valley for fall damage, or simply break an
// enemy's formation.
//
// Design (per S65 brief §1 + the Taunt-audit lesson):
//   - Deals real weapon damage. No-damage abilities are AI-invisible and
//     can soft-lock turns (ADR-0104); the knockback rides a real hit, so
//     the AI scores it through the normal attack path and the Brave-gated
//     reaction surface behaves as usual.
//   - Knockback is a `damage.knockback` rider on the existing knockback
//     substrate (ADR-0026) — the same primitive the Hydrologist's Tidal
//     Wave / Maelstrom use. Collision policy (map edge / unit blocker /
//     height tolerance) and knock-into-hazard fall damage come for free.
//
// Numbers:
//   - power_coefficient 1.0, variance 0.9–1.1: same damage as basic Attack;
//     the value is the displacement, not extra damage.
//   - mpCost 6: Knight base MP is 20 (unchanged by the S65 rebaseline), so
//     ~3 uses per battle — a deliberate tool, not a spammed shove.
//   - knockback distance 1: matches the substrate's existing Water Mage
//     riders; one tile is enough to push off a ledge / into a hazard.
//   - knockback chance 85, factors `{ brave: true, pa: true }`. The Knight's
//     Battle Skill riders scale on PA, not MA (S65; Lightning Stab shares
//     this shape — see ADR-0108). At Knight baseline Brave 70 / PA 10 vs a
//     Brave-70 target → 0.85 × (0.7 × 0.7) × (0.9 + 1.0) = 0.85 × 0.49 ×
//     1.9 ≈ 0.79 — "fairly high," and a Bravestrider / high-PA Knight lands
//     it harder (the identity reward). A high-Brave target resists the
//     shove (the symmetric Brave gate, same as the Assassin's Shadow Stitch).
//     baseChance is the lever if playtest reads too sticky / too whiffy.
//
// Single-swing by default: no `multiWeapon`, so a Two-Weapons wielder
// applies the knockback once rather than rolling it per swing (mirrors
// Lightning Stab's rider opt-out — keeps the displacement rate readable).

import {
  abilityId,
  bucketId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const bullRush: ActiveAbilityDefinition = {
  id: abilityId('bull_rush'),
  name: 'Bull Rush',
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
  mpCost: 6,
  hitRoll: {},
  effects: {
    damage: {
      tags: ['physical', 'weapon'],
      power_coefficient: 1.0,
      variance: { min: 0.9, max: 1.1 },
      knockback: {
        distance: 1,
        chance: 85,
        factors: { brave: true, pa: true },
      },
    },
  },
};
