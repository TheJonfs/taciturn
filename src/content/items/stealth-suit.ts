// Stealth Suit — TABA Ch3 universal dodge-scout body (M3 equipment
// expansion). HP +80, MP +10, +10 all-facing evade, Move +1, Jump +1.
//
// Authored TRIMMED per the lineup's own overload ruling: the draft
// carried +20 all-res as a sixth bonus (double-dipping evade AND
// mitigation on a mobility body); the settled cut drops the resistance
// — dodge-scouts dodge, resistance lives on off-hands/heads. What's
// left is the clean identity: mobile, slippery, modestly bulky.
//
// TABA-only: `hidden` + campaign pool (chapter 3, shop).

import { itemId, type ArmorEquipment } from '@engine/index.ts';

export const stealthSuit: ArmorEquipment = {
  id: itemId('stealth_suit'),
  name: 'Stealth Suit',
  availability: 'hidden',
  kind: 'armor',
  statMods: { maxHpBase: 80, maxMpBase: 10 },
  evasionMods: { front: 10, side: 10, back: 10 },
  movementMods: { moveRange: 1, jump: 1 },
};
