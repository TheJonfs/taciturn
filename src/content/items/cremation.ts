// Cremation — TABA Ch3 weapon unique. Axe, WP 14, accuracy 75, axe
// variance (0.9–1.3); every landed hit applies 2 Burn stacks.
//
// The Burn ecosystem's weapon anchor. Composes two precedents exactly:
// Flametongue's weapon on-hit proc (attackProcs → hidden rider ability)
// at chance 1.0 — GUARANTEED, the axe's whole identity — and Spark's
// two-stack application (stackQuantity 2, carried by
// `cremation_burn_proc`). Each stack ticks floor(wielder MA × 0.6), so
// the axe family's usual MA-dump wielders plant embers while a hybrid
// (Templar, Terraformer) turns it into a real DoT engine.
//
// Watch-for (brief ruling: flag, don't pre-nerf): 2 guaranteed stacks ×
// Pendant of Lumara's tick ×2 is a high DoT ceiling.
//
// TABA-only: `hidden` + campaign pool (chapter 3, unique).

import { abilityId, itemId, type WeaponEquipment } from '@engine/index.ts';

export const cremation: WeaponEquipment = {
  id: itemId('cremation'),
  name: 'Cremation',
  availability: 'hidden',
  kind: 'weapon',
  weaponType: 'axe',
  wp: 14,
  accuracy: 75,
  tags: ['axe', 'fire'],
  physicalVariance: { kind: 'static', min: 0.9, max: 1.3 },
  attackProcs: [{ chance: 1.0, abilityId: abilityId('cremation_burn_proc') }],
};
