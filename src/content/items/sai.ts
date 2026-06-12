// Sai — Session 40. WP 4, accuracy 95, +1 Speed. The self-compensating
// knife: brings its own Speed scaling, lifting a slow class's variance
// band into neutrality.
//
// Per the S40 brief: a Knight (Speed 9) wielding a Sai computes Speed
// 10 → variance band `[0.95, 1.05]` (mean 1.0), neutral instead of the
// `[0.85, 0.95]` (mean 0.9) of an un-Sai'd knife. The +1 Speed feeds
// directly into the knife's own variance computation — the variance
// resolver reads attacker Speed through `modifyStatQuery`, which
// composes the equipment additive contribution from Sai's `statMods.spd`.
//
// Beyond variance, +1 Speed also accelerates the wielder's CT
// accumulation — independent benefit. A Sai-equipped unit reaches its
// next turn faster than an Long-Sword-equipped one of the same class.
//
// Weapon class: knife. Physical variance is Speed-derived per the
// session's dynamic-variance substrate.
//
// Sai + Healthy Stride interaction note: Healthy Stride heals based on
// tiles moved (Move stat), not Speed. Sai's +1 Speed does NOT amplify
// Healthy Stride directly. See `docs/playtest-watch.md` if the
// expectation gap matters in play.

import { itemId, type WeaponEquipment } from '@engine/index.ts';

export const sai: WeaponEquipment = {
  id: itemId('sai'),
  name: 'Sai',
  availability: 'available',
  kind: 'weapon',
  weaponType: 'knife',
  wp: 4,
  accuracy: 95,
  tags: ['knife'],
  statMods: { spd: 1 },
  physicalVariance: { kind: 'attacker_speed', spread: 0.05 },
};
