// The Offering — Session 42 accessory (ADR-0080's swings-per-weapon
// axis). On the basic Attack command, each equipped weapon swings TWICE
// (`attackSwingMultiplier: 2`) — and only on Attack: Counter (a reaction)
// and the Battle Skills are excluded by the `basicAttack` + `isReaction`
// gate in `attackingWeaponSlots`. Composes with Two Weapons: dual-wield
// (off-hand slot) × The Offering (double per slot) = four swings.
//
// Balancing: `−3 PA` (S46 tuning, was −2). Doubling swing count is a
// large raw-output lever, so the accessory pays a flat Power tax. The
// −3 composes at the equipment tier (additive), *before* multiplicative
// passives like Two Weapons' PA × 0.75, so a Two-Weapons Assassin pays
// the −3 first and then the × 0.75 — a deliberately steep trade for
// four swings.

import { itemId, type AccessoryEquipment } from '@engine/index.ts';

export const theOffering: AccessoryEquipment = {
  id: itemId('the_offering'),
  name: 'The Offering',
  availability: 'available',
  kind: 'accessory',
  statMods: { pa: -3 },
  attackSwingMultiplier: 2,
};
