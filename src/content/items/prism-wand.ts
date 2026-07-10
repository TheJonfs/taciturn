// Prism Wand — TABA Ch3 diverse-caster wand (M3 equipment expansion).
// WP 2, accuracy 90; ALL FOUR element-wand utilities, each applying to
// ANY elemental spell: +1 horizontal range, +1 AoE vertical tolerance,
// +5 action speed, +1 Spell Power, +1 Burn stack.
//
// The breadth wand — pure utility, no raw MA (a Runic-Staff nuker
// out-damages it; power-location discipline). Pairs with Magus Crown
// for the wide-but-shallow mage. Every rider is an existing element-
// wand rider with the tag gate widened to the four elements; the Burn
// stack rides `sourceAbilityTagAny` (Chris's ruling: ANY elemental
// spell that applies Burn gets the extra stack, not just fire — the
// "a bit of everything" reading).
//
// Open-register watch: if breadth outclasses power in playtest, trim
// the action-speed rider first (the doc's own prescription).
//
// TABA-only: `hidden` + campaign pool (chapter 3, shop).

import { itemId, statusTypeId, type WeaponEquipment } from '@engine/index.ts';
import type { DamageTag } from '@engine/index.ts';

const ELEMENTS: ReadonlyArray<DamageTag> = ['fire', 'water', 'earth', 'lightning'];

export const prismWand: WeaponEquipment = {
  id: itemId('prism_wand'),
  name: 'Prism Wand',
  availability: 'hidden',
  kind: 'weapon',
  weaponType: 'wand',
  wp: 2,
  accuracy: 90,
  tags: ['wand'],
  abilityRangeModifiers: [{ deltaHorizontal: 1, tagFilter: ELEMENTS }],
  aoeVerticalToleranceModifiers: [{ delta: 1, tagFilter: ELEMENTS }],
  actionSpeedModifiers: [{ delta: 5, tagFilter: ELEMENTS }],
  spellPowerModifiers: [{ delta: 1, tagFilter: ELEMENTS }],
  statusApplicationStackCountModifiers: [
    { delta: 1, statusTypeId: statusTypeId('burn'), sourceAbilityTagAny: ELEMENTS },
  ],
};
