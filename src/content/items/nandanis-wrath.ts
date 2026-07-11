// Nandani's Wrath — TABA Ch3 weapon unique. Sword, WP 11, accuracy 95;
// Brave +11 (flat).
//
// The plainest of the eight Ch3 uniques, but the stat is load-bearing:
// Brave drives BOTH physical damage (the attacker-Brave factor) and the
// reaction trigger rate (trigger_chance = Brave/100), so this is the
// reaction-synergy sword — a Counter/Counterpunch build's anchor, not a
// vanilla stat stick. `statMods.brave` rides the ordinary additive
// modifyStatQuery chain (the key has been in STAT_MOD_KEYS since 13.7;
// this is its first content consumer).
//
// Family ruling: plain SWORD, deliberately NOT a Knight Sword — no
// Brave-variance band, no two-handed cost. The Brave bonus helps any
// wielder; the Knight Sword family's Brave-multiplier gamble is a
// different contract (see Excalibur).
//
// TABA-only: `hidden` + campaign pool (chapter 3, unique).

import { itemId, type WeaponEquipment } from '@engine/index.ts';

export const nandanisWrath: WeaponEquipment = {
  id: itemId('nandanis_wrath'),
  name: "Nandani's Wrath",
  availability: 'hidden',
  kind: 'weapon',
  weaponType: 'sword',
  wp: 11,
  accuracy: 95,
  tags: ['sword'],
  statMods: { brave: 11 },
};
