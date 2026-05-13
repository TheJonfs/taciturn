// Rasp Pendant — Session 31 resource-attrition accessory.
//
// Per the equipment doc (Session 31 spec update, captured in this
// session's handoff and the equipment doc revision):
//   "Bonus 10% of final damage dealt is converted to MP drain (wielder
//   gains, target loses; no damage reduction on attacker's swing)."
//
// The "damage reduction" half of the original equipment spec was
// dropped per Chris's session 30 mid-call (recorded in ADR-0065). The
// pendant gains slight extra power in exchange for not needing a
// `modifyOutgoingDamage`-style transform substrate. Effect-only.
//
// Ships via Session 30's `damageMpDrainPercent` field + the
// `finalDamageDrainContributor` registered against the `onFinalDamage`
// hook. Drain math is transfer-bounded by both the target's current
// MP (no negative MP) and the wielder's headroom under their `maxMp`
// (spillover lost, per ADR-0065).
//
// Skipped on absorbed hits (per ADR-0057 absorption → 'healing' tag
// flip; the contributor gates on `args.absorbed === true`). Skipped
// on KO'd targets (no posthumous drain).

import { itemId, type AccessoryEquipment } from '@engine/index.ts';

export const raspPendant: AccessoryEquipment = {
  id: itemId('rasp_pendant'),
  name: 'Rasp Pendant',
  availability: 'available',
  kind: 'accessory',
  damageMpDrainPercent: 10,
};
