// Sline — TABA Ch3 weapon unique. Lance (two-handed), WP 8, accuracy 90,
// lance variance (0.9–1.1) and lance range/pierce; the basic attack
// STRIKES TWICE.
//
// Composes the Lance chassis wholesale (reach 2, vertical 4, piercing
// line, `['lance']` tag — Jump's ×2 reads it) with The Offering's
// swings-per-weapon multiplier (`attackSwingMultiplier: 2`, ADR-0080 —
// basic Attack only, no reactions/Battle Skills). Each swing resolves
// its own pierce footprint (per-swing pierce, ADR-0107), so an aligned
// pair of enemies eats the line twice.
//
// D1 ruling: The Offering is NOT reworked, and the two multipliers
// compose — Sline + The Offering = 4 strikes. The multi-proc ceiling at
// the late-Ch3 PA curve is reported as data check 5b (Knight L50: ~288
// per Attack alone, ~576 with The Offering, before The Offering's PA −3
// and variance), and watched, not pre-nerfed. Sline is back-half-of-Ch3
// content by placement.
//
// TABA-only: `hidden` + campaign pool (chapter 3, unique).

import { itemId, type WeaponEquipment } from '@engine/index.ts';

export const sline: WeaponEquipment = {
  id: itemId('sline'),
  name: 'Sline',
  availability: 'hidden',
  kind: 'weapon',
  weaponType: 'polearm',
  wp: 8,
  accuracy: 90,
  tags: ['lance'],
  twoHanded: true,
  range: { min: 1, max: 2, vertical: 4 },
  pierces: true,
  physicalVariance: { kind: 'static', min: 0.9, max: 1.1 },
  attackSwingMultiplier: 2,
};
