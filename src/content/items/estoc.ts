// Estoc — TABA Ch3 reach knife (M3 equipment expansion). WP 7, accuracy
// 95, horizontal reach 2 (vs the melee 1), knife-class Speed variance.
//
// The lineup's melee-with-reach confirm: the weapon-sourced range fork
// (Session 45, computeAbilityRange) already lets any weapon override the
// basic Attack's reach — the Estoc is pure content on it. min 1 (no bow
// dead zone — it still stabs adjacent), vertical 3 matching the melee
// elevation window. Unlike the Lance's reach it does NOT pierce: one
// target, picked at up to 2 tiles.
//
// TABA-only: `hidden` + campaign pool (chapter 3, shop).

import { itemId, type WeaponEquipment } from '@engine/index.ts';

export const estoc: WeaponEquipment = {
  id: itemId('estoc'),
  name: 'Estoc',
  availability: 'hidden',
  kind: 'weapon',
  weaponType: 'knife',
  wp: 7,
  accuracy: 95,
  tags: ['knife'],
  range: { min: 1, max: 2, vertical: 3 },
  physicalVariance: { kind: 'attacker_speed', spread: 0.05 },
};
