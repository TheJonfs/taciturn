// Longbow — the Hunter's signature weapon and the first ranged weapon in
// v1 (Session 45). The "snipe at range" bow: high WP, low accuracy, and a
// range/variance profile that makes elevation matter.
//
// WP 9 / Acc 40 (S68 tuning — was WP 7 / Acc 33) — hits hard but
// unreliably bare (Eagle Eye doubles the 40 to ~80% net). The S68 bump
// addressed the accuracy-starved, lowest-DPS-in-the-roster bow Hunter:
// +7 accuracy fixes the actual bottleneck (reliability) and +2 WP pays
// off *earned high ground* — a perched Hunter (Vantage + real elevation)
// now out-damages the Knight, while the flat-ground Hunter stays well
// behind, making "take the high ground" a real party goal. See the S68
// damage-over-time re-analysis. Range 2-5 (`min: 2` → can't fire
// adjacent; the bow's dead zone the Hunter covers with Scramble) and
// vertical 99 (effectively infinite — bows shoot across any elevation).
// Two-handed, so it forbids an off-hand item and can't dual-wield.
//
// Height-delta variance (`falloffPerHeight: 0.2`): damage scales with the
// elevation the shot is taken from — same height ×1.0, each tile the
// target sits *above* the Hunter shaves 0.2 (4 up → ×0.2, 5+ up → 0), and
// shooting *down* multiplies up (5 below → ×2.0). The deterministic
// reward for taking the high ground.

import { itemId, type WeaponEquipment } from '@engine/index.ts';

export const longbow: WeaponEquipment = {
  id: itemId('longbow'),
  name: 'Longbow',
  availability: 'available',
  kind: 'weapon',
  weaponType: 'bow',
  wp: 9,
  accuracy: 40,
  tags: ['bow'],
  twoHanded: true,
  range: { min: 2, max: 5, vertical: 99 },
  physicalVariance: { kind: 'height_delta', falloffPerHeight: 0.2 },
  // Session 52: FFT-canon range-from-height — +1 horizontal range per
  // 2 tiles the shooter sits above the target. Stacks with the
  // height-delta damage reward above (high ground hits harder AND
  // farther). No bonus shooting level or uphill.
  rangeFromHeightBonus: { perDeltaVertical: 2, deltaHorizontal: 1 },
};
