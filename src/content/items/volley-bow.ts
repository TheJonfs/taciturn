// Volley Bow — TABA Ch3 weapon unique. Bow (two-handed), WP 8, accuracy
// 40; the basic attack hits a diamond-1 AREA around the aimed tile
// instead of a single target — and it FRIENDLY-FIRES.
//
// The starting-cluster opener (`attackAoe` — the target-anchored arm of
// the weapon-attack-shape seam; lance pierce is the caster-anchored
// arm). Aiming: units OR empty ground (validateAction upgrades the
// basic Attack's targeting off this field, per Chris's tile-aim
// ruling). Every unit in the diamond — allies included, settled ruling:
// deliberately NOT a safe melee tool — rolls its own accuracy/evasion
// check at the bow's Acc 40 via the standard per-target AoE seeds.
//
// Aether Bloom does NOT expand this blast: its shape hook gates on the
// 'magical' ability tag, and the basic Attack is physical (same answer
// as Palliative Pike's pulse-vs-Bloom question).
//
// Chassis: the bow family standard minus the sniper reach — range 2–4
// (vs the Longbow's 2–5; a volley is an opener, not a snipe), vertical
// 99, height-delta variance and the FFT-canon range-from-height bonus.
//
// TABA-only: `hidden` + campaign pool (chapter 3, unique).

import { itemId, type WeaponEquipment } from '@engine/index.ts';

export const volleyBow: WeaponEquipment = {
  id: itemId('volley_bow'),
  name: 'Volley Bow',
  availability: 'hidden',
  kind: 'weapon',
  weaponType: 'bow',
  wp: 8,
  accuracy: 40,
  tags: ['bow'],
  twoHanded: true,
  range: { min: 2, max: 4, vertical: 99 },
  physicalVariance: { kind: 'height_delta', falloffPerHeight: 0.2 },
  rangeFromHeightBonus: { perDeltaVertical: 2, deltaHorizontal: 1 },
  attackAoe: { radius: 1 },
};
