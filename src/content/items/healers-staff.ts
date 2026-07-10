// Healer's Staff — TABA Ch3 staff (M3 equipment expansion). WP 6,
// accuracy 80, MA +3; weapon attacks HEAL their target instead of
// damaging (heal = MA × 6 × Faith_factor — the FFT healing-staff
// shape via the attack-as-heal pipeline flip).
//
// Widens healing access beyond the four healer classes — a weak,
// slot-costed splash by design (a real healer's Cure out-scales it),
// but a CONSCIOUS softening of the healing gate per the lineup ruling.
// The flip follows the aimed target: bonking an enemy heals the enemy
// (FFT-faithful rope). Heals always land — no 'physical' tag means the
// evasion roll is skipped, and 'healing' skips resistance/crit.
//
// First consumer of `attackResolvesAsHeal` (the Stage 3a engine seam).
//
// TABA-only: `hidden` + campaign pool (chapter 3, shop).

import { itemId, type WeaponEquipment } from '@engine/index.ts';

export const healersStaff: WeaponEquipment = {
  id: itemId('healers_staff'),
  name: "Healer's Staff",
  availability: 'hidden',
  kind: 'weapon',
  weaponType: 'staff',
  wp: 6,
  accuracy: 80,
  tags: ['staff'],
  statMods: { ma: 3 },
  attackResolvesAsHeal: true,
};
