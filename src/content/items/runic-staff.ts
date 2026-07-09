// Runic Staff — TABA Ch2 second-pass glass-cannon staff (M3 equipment
// expansion). WP 4, accuracy 80, MA +5, Speed −2.
//
// Lateral to Staff of Power's MA+4 / ×1.5-MP-cost trade: the Runic
// buys one more MA with tempo instead of economy — the wielder hits
// hardest in the roster but acts noticeably less often. The lineup doc
// flags "watch: 4 vs 5" on the MA; authored at 5 per the settled table,
// tune down post-playtest if the glass cannon out-glasses.
//
// TABA-only: `hidden` + campaign pool (chapter 2, shop).

import { itemId, type WeaponEquipment } from '@engine/index.ts';

export const runicStaff: WeaponEquipment = {
  id: itemId('runic_staff'),
  name: 'Runic Staff',
  availability: 'hidden',
  kind: 'weapon',
  weaponType: 'staff',
  wp: 4,
  accuracy: 80,
  tags: ['staff'],
  statMods: { ma: 5, spd: -2 },
};
