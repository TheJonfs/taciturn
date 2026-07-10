// Freelancer's Charm — TABA Ch1 unique accessory, the breadth-enabler
// (M3 equipment expansion). +1 secondary command-set capacity; the
// wearer CANNOT equip a class-restricted (Heavy/Magical-lane) body
// while it's worn.
//
// Ch1's uniques teach; this one teaches "exploring breadth is
// rewarding" — a pre-Magus-Crown taste of the second command set. The
// cost is deliberately LATERAL (armor-identity, not raw stats) so it
// never obsoletes the Crown: two enablers, same lesson, different
// currencies ("the generalist travels light").
//
// First consumer of the equip-legality override seam (`equipLegality` —
// enforced at battle setup beside the class↔item checks; a future
// universal-equip item is instance two of the same shape).
//
// Found-not-shopped, single instance (supply cap 1, countable inventory
// — the acquisition flow is economy-pass work). TABA-only: `hidden` +
// campaign pool (chapter 1, unique).

import { bucketId, itemId, type AccessoryEquipment } from '@engine/index.ts';

export const freelancersCharm: AccessoryEquipment = {
  id: itemId('freelancers_charm'),
  name: "Freelancer's Charm",
  availability: 'hidden',
  kind: 'accessory',
  bucketCapacityMods: new Map([[bucketId('secondary_command_sets'), 1]]),
  equipLegality: { forbidClassRestrictedInSlots: ['armor'] },
};
