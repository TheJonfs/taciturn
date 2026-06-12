// Defender — the second Knight Sword (S62, Templar arc). WP 11, accuracy
// 95, two-handed, Brave-scaled variance (the Knight-Sword pattern, per
// Absolom), and grants Auto-Protect.
//
// Auto-Protect: a permanent `protect` status applied at battle start via
// the equipment `statusGrants` path (ADR-0028), exactly like Boots of
// Haste / Auto-Shell. Protect's default magnitude (50) gives +50% physical
// resistance ((100 − 50) / 100 = 0.5× incoming physical). The magnitude is
// the lever for Chris's planned tank stress-test; like the Auto-Shell
// magnitude reservation, it can be tuned down later (a `statusGrants`
// variant carrying an explicit magnitude) without re-architecting.
//
// Weapons are universal — any class may wield Defender (and so reach
// Auto-Protect); only armor is class-gated. Two-handed, so pairing Defender
// with a second weapon or a shield needs Monkeygrip (two-handers in one
// hand). Under Two Weapons it swings normally as the off-hand weapon —
// being two-handed does not suppress the dual-wield swing (ADR-0107).
// Like Absolom, the `'knight_sword'` taxonomy is implicit in the name; tags
// carry `['sword']` so weapon-tag composition matches the other swords.
//
// Variance: `attacker_brave`, spread 0.05 — the same Brave-rewards band as
// Absolom (at Brave 70: [0.65, 0.75]; rising with Brave-stacking gear).

import { itemId, statusTypeId, type WeaponEquipment } from '@engine/index.ts';

export const defender: WeaponEquipment = {
  id: itemId('defender'),
  name: 'Defender',
  availability: 'available',
  kind: 'weapon',
  weaponType: 'knight_sword',
  wp: 11,
  accuracy: 95,
  tags: ['sword'],
  twoHanded: true,
  physicalVariance: { kind: 'attacker_brave', spread: 0.05 },
  statusGrants: [statusTypeId('protect')],
};
