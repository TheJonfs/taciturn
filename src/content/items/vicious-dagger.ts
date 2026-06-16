// Vicious Dagger — Session 68. Knife, WP 5, accuracy 95. The crit
// anchor of the knife family: +25 crit chance (percentage points,
// per-unit) via the same additive `modifyStatQuery('crit_chance')`
// contribution Arcane Lens uses (+10). Stacks additively with the base
// 5%, Arcane Lens, and Static Embrace's Crit Modifier; applies to every
// hit the wielder lands, including the off-hand swing under Two Weapons
// (the contribution is per-unit, not per-weapon).
//
// Weapon class: knife → Speed-derived dynamic variance band
// (`attacker_speed`, spread 0.05) per the Session 40 substrate, same as
// Sai / Chef's Knife / Magebane. WP 5 sits one above Sai (4) and below
// the sword tier; the crit rider is the draw.
//
// Seeds the crit archetype rather than completing it: base 5 + Vicious
// 25 (+ Arcane Lens 10 + a Crit Modifier) can push a dedicated build
// past ~40% crit, which at ×1.5 is a strong-but-bounded ~+20% average
// damage. Further crit-support pieces are a future pass.

import { itemId, type WeaponEquipment } from '@engine/index.ts';

export const viciousDagger: WeaponEquipment = {
  id: itemId('vicious_dagger'),
  name: 'Vicious Dagger',
  availability: 'available',
  kind: 'weapon',
  weaponType: 'knife',
  wp: 5,
  accuracy: 95,
  tags: ['knife'],
  statMods: { crit_chance: 25 },
  physicalVariance: { kind: 'attacker_speed', spread: 0.05 },
};
