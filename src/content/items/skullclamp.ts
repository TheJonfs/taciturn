// Skullclamp — universal headgear (any class). Hybrid-offense head with
// HP/MP tax: -20 HP / -10 MP / +1 PA / +1 MA. The first universal piece
// to put a negative on HP/MP (mirrors War Plate's spd: -1 and Ironfoot's
// spd: -1 in negative-stat-mod territory). The two-axis offensive bump
// (+1 PA AND +1 MA) makes this distinct from any other head — Pointy
// Hat is +1 MA (Mage-only), Tactical Mask is +1 PA / +1 Speed (Knight-
// only), no head currently bumps both physical AND magical attack
// stats. Universal access means hybrid attackers across all 9 classes
// can pick this up.
//
// Use cases:
//   - Knight running a magic secondary command set (Battle Skill + a
//     mage school): +1 PA on swings AND +1 MA on the secondary spells.
//   - Alchemist with offensive items (chefs_knife wielder casting
//     Compound heals at slightly higher MA).
//   - Calculator wanting a tiny MA bump on Math Skill damage/healing
//     casts. The -10 MP and -20 HP are real costs on a fragile L24-26
//     keystone, so it's a deliberate tradeoff vs. Focus Band / Golden
//     Hairpin.
//   - Hybrid Mage running a physical knife secondary.
//
// Composition: -20 maxHpBase and -10 maxMpBase run additively through
// `modifyStatQuery` (the same chain Battle Gear's +110 HP composes on);
// negative values flow correctly through the additive arithmetic. The
// engine's vitals filling (`fillVitalsFromComputedMaxes` at battle
// start) reads the post-equipment effective max, so a Skullclamp
// wearer starts at the reduced HP/MP — not over-cap.

import { itemId, type HeadgearEquipment } from '@engine/index.ts';

export const skullclamp: HeadgearEquipment = {
  id: itemId('skullclamp'),
  name: 'Skullclamp',
  availability: 'available',
  kind: 'headgear',
  statMods: { maxHpBase: -20, maxMpBase: -10, pa: 1, ma: 1 },
};
