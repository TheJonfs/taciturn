// Bolt Hammer — Session 31 hybrid PA/MA axe with a Lightning spell-cast
// rider on each successful physical hit.
//
// Per the equipment doc: WP 10, accuracy 75, asymmetric variance
// [0.9, 1.3] (axe family identity). 25% per-hit chance to fire a basic
// Lightning spell at the target, riding through ADR-0064's
// `attackProcs` substrate. The procced ability is the existing
// `lightning_strike` (Lightning Mage's Base spell) — same SP, same
// display name in the action log per Chris's design call ("I want to
// make it clear to the player that they're getting the first level
// spell on the hit"). The proc is MP-free (rider bypass), bypasses
// Silence (rider bypass), and resolves instantly regardless of
// Lightning Strike's authored `actionSpeed: 30` (ADR-0068 rider bypass).
//
// Damage tuning notes per the equipment doc:
//   - At Knight PA 11, basic swing: 11 × 10 × 0.7 (Brave) ≈ 77 base,
//     variance mean 1.1 → ~85 effective per landed hit; 75% land rate
//     → ~64 expected per swing.
//   - Procced Lightning Strike uses the wielder's MA (per ADR-0064
//     "Equipment-procced spell uses the actor's stats for damage
//     formula"). At Knight MA 4: 4 × 12 × 0.49 (Faith × Faith) ≈ 24
//     per proc. Stacks with Silvered Vest (+2 MA) and Managuard (+2
//     MA) for an MA-8 Knight: ~47 per proc against zero-resistance
//     targets, more vs Lightning-vulnerable.

import { abilityId, itemId, type WeaponEquipment } from '@engine/index.ts';

export const boltHammer: WeaponEquipment = {
  id: itemId('bolt_hammer'),
  name: 'Bolt Hammer',
  availability: 'available',
  kind: 'weapon',
  wp: 10,
  accuracy: 75,
  tags: ['axe'],
  physicalVariance: { min: 0.9, max: 1.3 },
  attackProcs: [{ chance: 0.25, abilityId: abilityId('lightning_strike') }],
};
