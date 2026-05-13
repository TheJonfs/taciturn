// War Axe — high-WP, low-accuracy physical weapon. WP 12, accuracy 75,
// asymmetric variance [0.9, 1.3].
//
// Per the equipment doc: ~30% damage upgrade vs Long Sword in exchange
// for 25% miss rate plus variance noise.
//
// Session 31: the weapon-sourced asymmetric variance band ships via
// `physicalVariance` (ADR-0067). Effective WP across the band's mean
// 1.1 is 12 × 0.75 (hit rate) × 1.1 (variance mean) = 9.9 — matches
// the equipment doc's expected effective WP for War Axe.

import { itemId, type WeaponEquipment } from '@engine/index.ts';

export const warAxe: WeaponEquipment = {
  id: itemId('war_axe'),
  name: 'War Axe',
  availability: 'available',
  kind: 'weapon',
  wp: 12,
  accuracy: 75,
  tags: ['axe'],
  physicalVariance: { min: 0.9, max: 1.3 },
};
