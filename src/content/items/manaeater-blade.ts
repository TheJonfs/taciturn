// Manaeater Blade — TABA Ch3 brute sword (M3 equipment expansion).
// WP 14, accuracy 95; the wielder's MaxMP is HALVED.
//
// The highest-WP one-handed sword by a wide margin — for classes that
// give up their MP/abilities anyway, or builds that offset MP elsewhere
// (Staff of Abundance in the other hand doesn't exist — one weapon —
// but Golden Hairpin economy or MP-light kits do). The ×0.5 MaxMP rides
// the multiplicative stat chain AFTER additive MP gear (ADR-0058
// ordering), so a +20 MP head still ends up halved — the tax is real.
//
// Lineup watch: risks being the default non-caster sword; tweak if
// playtest shows it crowding out the Katana/Epee trades.
//
// TABA-only: `hidden` + campaign pool (chapter 3, shop).

import { itemId, type WeaponEquipment } from '@engine/index.ts';

export const manaeaterBlade: WeaponEquipment = {
  id: itemId('manaeater_blade'),
  name: 'Manaeater Blade',
  availability: 'hidden',
  kind: 'weapon',
  weaponType: 'sword',
  wp: 14,
  accuracy: 95,
  tags: ['sword'],
  statModsMultiplicative: { maxMp: 0.5 },
};
