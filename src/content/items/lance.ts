// Lance — the vanilla Lance weapon class (S62, Templar arc). WP 10,
// accuracy 95, two-handed, reach H2 / V4 (vs. melee 1/3), pierces, static
// variance [0.9, 1.1].
//
// Pierce (ADR-0102): a basic Attack with the Lance resolves as a caster-
// anchored 2-tile line — it strikes the targeted unit AND the one behind
// it, and friendly-fires an intervening ally (ruleset friendlyFire). The
// canonical Dragoon/Lance reward; doubles Jump damage too (Jump reads the
// Lance tag). Two-handed, so pairing it with a shield needs Monkeygrip.
//
// Universal (no classRestrictions) like every weapon — any class can wield
// it. Tags `['lance']` mark the weapon class (Jump's ×2 reads it); the tag
// also merges into the attack's damage tags.

import { itemId, type WeaponEquipment } from '@engine/index.ts';

export const lance: WeaponEquipment = {
  id: itemId('lance'),
  name: 'Lance',
  availability: 'available',
  kind: 'weapon',
  wp: 10,
  accuracy: 95,
  tags: ['lance'],
  twoHanded: true,
  range: { min: 1, max: 2, vertical: 4 },
  pierces: true,
  physicalVariance: { kind: 'static', min: 0.9, max: 1.1 },
};
