// Absolom — the first Knight Sword (S50). WP 13, accuracy 95, two-
// handed, Brave-scaled variance, +1 Reaction-bucket capacity.
//
// Weapon class: Knight Sword. Like the bow class, Knight Swords are
// two-handed — equipping one forbids any off-hand item (no shield, no
// second weapon), so a Two Weapons wielder collapses to a single
// (heavy) swing instead of two. The upside is some of the highest WP
// in v1 paired with attached riders (here: the Reaction-capacity bump).
// Despite the name, Knight Swords carry no `classRestrictions` — any
// class can wield one; the soft filter is whether a class wants to be
// attacking at all and whether their Brave is high enough to make the
// variance band land where they want.
//
// Variance: `attacker_brave` with spread 0.05. Band = `[Brave/100 -
// 0.05, Brave/100 + 0.05]`. At the standard 70 Brave: `[0.65, 0.75]`
// (center 0.70). At a Bravestrider-bumped Knight (Brave 80): `[0.75,
// 0.85]`. At a Soul-Vest + Bravestrider Knight (Brave 90): `[0.85,
// 0.95]`. At Brave 100: parity around 1.0. Rewards Brave-stacking
// builds — Soul Vest, Tricorn, Crusader's Helm, Bravestrider — and
// taxes default-Brave wielders relative to a Long Sword's flat 1.0
// variance.
//
// Capacity rider: +1 Reaction. Same shape as Steel Helm's
// `bucketCapacityMods: [[bucketId('reaction'), 1]]` — opens room for
// a fourth Reaction passive or upgrades to a higher-cost slot. Pairs
// strongly with Brave-amplified Reaction builds (more Reaction slots,
// more Brave to make them fire).
//
// Tags: `['sword']` so weapon-tag composition works the same as Long
// Sword / Parrying Sword. The `'knight_sword'` taxonomy is implicit in
// the class name; if a future ability needs to gate on it specifically,
// the tag can be added without breaking the existing pattern.

import { bucketId, itemId, type WeaponEquipment } from '@engine/index.ts';

export const absolom: WeaponEquipment = {
  id: itemId('absolom'),
  name: 'Absolom',
  availability: 'available',
  kind: 'weapon',
  wp: 13,
  accuracy: 95,
  tags: ['sword'],
  twoHanded: true,
  physicalVariance: { kind: 'attacker_brave', spread: 0.05 },
  bucketCapacityMods: new Map([[bucketId('reaction'), 1]]),
};
