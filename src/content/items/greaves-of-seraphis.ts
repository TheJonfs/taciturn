// Greaves of Seraphis — Session 74 caster accessory (the CT-throughline's
// opener). Speed +2 and a battle-start CT seed: the wearer begins the
// battle at full CT and acts first.
//
// `battleStartCt: 100` is consumed once by the pre-battle phase
// (`enumeratePreBattleActions` → `system_set_ct`, ADR-0125), overriding
// both the ruleset's initial-CT formula draw and any explicit
// `placement.initialCT`. The `system_set_ct` reducer clamps to [0, 99]
// ("no unit starts pre-triggered"), so the seed lands at the pre-trigger
// ceiling — which still guarantees first action: at CT 99 the wearer
// triggers in one tick, ahead of every formula-derived starter. Applied
// exactly once at setup; it does not re-trigger.
//
// Design: the costed, unique re-introduction of the pre-emption the old
// Haste bug used to hand out for free. One guaranteed opener per battle
// (unique-per-team by the equipment catalog rule) — a planned alpha, not
// a loop.

import { itemId, type AccessoryEquipment } from '@engine/index.ts';

export const greavesOfSeraphis: AccessoryEquipment = {
  id: itemId('greaves_of_seraphis'),
  name: 'Greaves of Seraphis',
  availability: 'available',
  kind: 'accessory',
  statMods: { spd: 2 },
  battleStartCt: 100,
};
