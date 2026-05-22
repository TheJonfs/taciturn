// Mantle of Protection — the most defensively-oriented accessory in v1
// (Session 45 follow-up). A flat +25 across both axes of mitigation:
// elemental/spiritual resistance and per-facing evasion.
//
//   - `resistanceMods`: +25 to fire / water / earth / lightning / holy /
//     dark — every damage-tag a unit might *take* from an attack. (Poison
//     and DoT are status-tick sources, not attack tags, so they're not
//     included here.) Composes additively through `runModifyResistance`.
//   - `evasionMods`: +25 to front / side / back. Composes additively
//     through `runModifyEvasion` against the target's class baseline.
//
// Intended use: a panic-button slot for a unit you can't afford to lose
// (a sole healer, a debuff-vulnerable squishy). Trades the buff /
// utility upside of accessories like Tintinibar or Augmentor for raw
// staying power against both magic and physical pressure.

import { itemId, type AccessoryEquipment } from '@engine/index.ts';

export const mantleOfProtection: AccessoryEquipment = {
  id: itemId('mantle_of_protection'),
  name: 'Mantle of Protection',
  availability: 'available',
  kind: 'accessory',
  resistanceMods: new Map([
    ['fire', 25],
    ['water', 25],
    ['earth', 25],
    ['lightning', 25],
    ['holy', 25],
    ['dark', 25],
  ]),
  evasionMods: { front: 25, side: 25, back: 25 },
};
