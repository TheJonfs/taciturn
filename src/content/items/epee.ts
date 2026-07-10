// Epee — TABA Ch3 tempo sword (M3 equipment expansion). WP 9, accuracy
// 95; a resolved BASIC weapon attack refunds PA-worth of CT to the
// wielder.
//
// The tempo build: every Attack claws back `floor(composed PA × 1)` CT,
// so a high-PA duelist cycles turns faster the more it swings. Skill
// casts (Power Attack etc.) never refund — `basicAttack` gates it —
// and the refund is ONCE per action (a dual-wield double swing or The
// Offering's extra swings don't compound it; the rider lives on
// `onActionResolved`, not per-hit).
//
// Lineup watch (open register): CT-refund loops with Haste / high
// Speed / Clio's team-CT — playtest the compounding before tuning.
//
// TABA-only: `hidden` + campaign pool (chapter 3, shop).

import { itemId, type WeaponEquipment } from '@engine/index.ts';

export const epee: WeaponEquipment = {
  id: itemId('epee'),
  name: 'Epee',
  availability: 'hidden',
  kind: 'weapon',
  weaponType: 'sword',
  wp: 9,
  accuracy: 95,
  tags: ['sword'],
  basicAttackCtRefundPaFactor: 1,
};
