// Pendant of Lumara — Session 74 caster accessory (the Burn amplifier).
// MA +2, and the Burn the wearer applies hits twice as hard per stack.
//
// Substrate: `outgoingStatusMagnitudeMods: [{ statusTypeId: 'burn',
// factor: 2 }]` rides the (now generalized) `modifyOutgoingStatusMagnitude`
// hook (ADR-0128). Burn's `composeApplyState` routes its per-stack
// MA-derived damage through that caster-side chain, so the Pendant doubles
// each stack the wearer lays down — Spark, Flame Lance, Smolder, Precision
// Fire / Ignition, anything. The snapshot is baked into the stack at apply
// time (per Burn's existing model), so doubled stacks keep hitting hard for
// their whole lifetime even after the Pendant comes off.
//
// The hook also carries the Enchanter's Aura Mastery (buff amplifier), but
// that handler gates on `amplifiable` — which Burn does not declare — so
// the two amplifiers stay independent.
//
// Balance: lowest-risk of the batch — fire resistance is the natural brake
// (Burn is fire-tagged, so a fire-resistant target soaks the doubled
// ticks). Watch multi-Burn-amp stacking vs. healing in playtest.

import { itemId, statusTypeId, type AccessoryEquipment } from '@engine/index.ts';

export const pendantOfLumara: AccessoryEquipment = {
  id: itemId('pendant_of_lumara'),
  name: 'Pendant of Lumara',
  availability: 'available',
  kind: 'accessory',
  statMods: { ma: 2 },
  outgoingStatusMagnitudeMods: [{ statusTypeId: statusTypeId('burn'), factor: 2 }],
};
