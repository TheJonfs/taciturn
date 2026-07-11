// Golden Rod — TABA Ch3 weapon unique. Wand, WP 2, accuracy 90; every
// turn start: −10% MaxHP and −10% MaxMP (LINEAR), +1 MA (stacking,
// permanent).
//
// The Faustian countdown. The whole mechanism lives on the granted
// status (`golden_rod_pact`, via `statusGrants` — the Boots of Haste /
// Defender battle-start path): its per-turn tick emits the HP drain
// (`system_damage`, lethal by ruling), the MP burn (negative
// `system_mp_restore`, floored at 0), and one Gilded Focus stack
// (+1 MA, Terra Attunement's accumulator pattern).
//
// Load-bearing ruling: the drain is 10% OF MAX per turn, LINEAR — flat,
// not compounding on current. Dead and dry in ~10 turns without
// recovery: the rod FORCES a sustain pairing (healer, Star Robe
// lifesteal, Auto-Regen) rather than merely rewarding one. The HP half
// is the lethal one; the MP half mostly outruns the 10–20/tick restore
// economy, keeping the wielder's casting honest.
//
// TABA-only: `hidden` + campaign pool (chapter 3, unique).

import { itemId, statusTypeId, type WeaponEquipment } from '@engine/index.ts';

export const goldenRod: WeaponEquipment = {
  id: itemId('golden_rod'),
  name: 'Golden Rod',
  availability: 'hidden',
  kind: 'weapon',
  weaponType: 'wand',
  wp: 2,
  accuracy: 90,
  tags: ['wand'],
  statusGrants: [statusTypeId('golden_rod_pact')],
};
