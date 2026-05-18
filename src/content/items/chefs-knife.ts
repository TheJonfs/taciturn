// Chef's Knife — Session 40. WP 4, accuracy 95, +1 PA. The
// healing-flavored knife: Alchemist's natural sidearm.
//
// Per the S40 brief: the Chef's Knife synergizes with the Alchemist's
// PA-scaled consumables. Potion heals `PA × 12 HP`; Phoenix Down revives
// + `PA × 4 HP`; Ether restores `PA × 4 MP`. +1 PA reads as +12 / +4 /
// +4 across the stockpile — meaningful but not transformative.
//
// Weapon class: knife. Physical variance is Speed-derived per the
// session's dynamic-variance substrate. The class is weapon-agnostic
// (no `classRestrictions`); a Lightning Mage (Speed 11) wielding a
// Chef's Knife computes variance band `[1.05, 1.15]` — higher than the
// Knight's `[0.85, 0.95]` — but the soft filter is whether non-melee
// classes want to be attacking at all.
//
// Tag set carries 'knife' so future anti-knife content can compose
// resistance / interaction without per-item taxonomy.

import { itemId, type WeaponEquipment } from '@engine/index.ts';

export const chefsKnife: WeaponEquipment = {
  id: itemId('chefs_knife'),
  name: "Chef's Knife",
  availability: 'available',
  kind: 'weapon',
  wp: 4,
  accuracy: 95,
  tags: ['knife'],
  statMods: { pa: 1 },
  physicalVariance: { kind: 'attacker_speed', spread: 0.05 },
};
