// Parrying Sword — sword-class defensive weapon. WP 6, accuracy 95.
//
// Trades 25% raw output vs. Long Sword (WP 8 → WP 6) for per-facing
// evade: +10 Front, +5 Side. Back evade is unchanged — a Parrying
// Sword wielder still wants to face the enemy or take cover; flanking
// remains the canonical counter. The defensive bonuses run through
// the standard `modifyEvasion` additive chain at evasion-check time
// (parallel to Steel Helm's per-facing modifiers), composing with any
// other evasion contributors the wearer carries (Shimmer Cloak's +10
// F/S/B → 20 Front / 15 Side / 10 Back with both equipped).
//
// Tags: ['sword'] — matches Long Sword's family. The damage-tag
// composition for `'weapon'`-tagged abilities still flows through the
// standard pipeline. No procs; no class restriction (sword is
// universal-equipping).

import { itemId, type WeaponEquipment } from '@engine/index.ts';

export const parryingSword: WeaponEquipment = {
  id: itemId('parrying_sword'),
  name: 'Parrying Sword',
  availability: 'available',
  kind: 'weapon',
  weaponType: 'sword',
  wp: 6,
  accuracy: 95,
  tags: ['sword'],
  evasionMods: { front: 10, side: 5 },
};
