// Katana — TABA Ch3 crit sword (M3 equipment expansion). WP 11,
// accuracy 95; critical hits deal DOUBLE damage.
//
// The crit-build capstone. The brief listed "crit-magnitude system" as
// an engine prerequisite, but the audit found it already live (ADR-0032):
// `crit_multiplier` is a base stat (default 1.5) read through
// `modifyStatQuery` at the crit roll — so the Katana is a multiplicative
// stat mod, ×2 on the wielder's crit multiplier (1.5 → 3.0; Chris's
// ruling: double the whole critical hit, arriving at 3). Composes with
// crit-CHANCE stackers (Vicious Dagger +25, Arcane Lens +10, Keen Visor
// +5, Static Embrace) — chance × magnitude is the two-axis build.
//
// TABA-only: `hidden` + campaign pool (chapter 3, shop).

import { itemId, type WeaponEquipment } from '@engine/index.ts';

export const katana: WeaponEquipment = {
  id: itemId('katana'),
  name: 'Katana',
  availability: 'hidden',
  kind: 'weapon',
  weaponType: 'sword',
  wp: 11,
  accuracy: 95,
  tags: ['sword'],
  statModsMultiplicative: { crit_multiplier: 2 },
};
