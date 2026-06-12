// Long Sword — the basic Knight weapon. The first WP-bearing equipment
// item in v1; per ADR-0028, equipment integration in session 17c
// promotes WP from the embedded `attack.power = 4` placeholder into
// real weapon-sourced data here.
//
// Tags: ['sword'] only. The `'weapon'` damage-tag composition trigger
// is on the using ability (Knight `attack` declares `tags: ['physical',
// 'weapon']`); the weapon's own tag list contributes `'sword'` for
// future "anti-sword" content (Stop-on-swords, parry, etc.) without
// re-listing per-ability.
//
// Accuracy 95 (per session 17c plaintext review): a 5-point evasion
// exposure that's a no-op against today's zero-evasion classes but
// becomes meaningful when Blind ships and when classes acquire non-
// zero evasion. Per the Battle Mechanics Guide's "no weapon / unarmed
// → 100" default, anything other than 100 is a deliberate weapon
// authoring choice.

import { itemId, type WeaponEquipment } from '@engine/index.ts';

export const longSword: WeaponEquipment = {
  id: itemId('long_sword'),
  name: 'Long Sword',
  availability: 'available',
  kind: 'weapon',
  weaponType: 'sword',
  wp: 8,
  accuracy: 95,
  tags: ['sword'],
};
