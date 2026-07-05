// TABA M2 — the reclass op.
//
// Reclassing a durable unit is NOT just swapping `classId`: a class's identity
// includes the command set it wields, which lives in the loadout's
// `first_action` bucket. The snapshot-fold passes `unit.loadout` + `unit.classId`
// verbatim into battle, so a reclass that left `first_action` pointing at the
// OLD class's command set would field a unit wielding the wrong commands. This
// op keeps the two consistent: it rebinds `first_action` to the new class's
// default command set.
//
// Everything else in the loadout (secondary command sets, R/S/M passives) is
// preserved as-is — the Customization tab is where the player curates those,
// consulting `canEquipPassive` for the export-tax rule. The engine's structural
// `validateLoadout` still runs at fold time; this op does not attempt to
// pre-validate capacity (that is a per-battle, equipment-aware concern).
//
// Pure and total: same (unit, class, catalog) → same unit. Reclassing to the
// current class is a no-op (returns the same reference).

import { bucketId, type Catalog, type ClassId, type Loadout } from '@engine/index.ts';
import type { CampaignUnit } from './types.ts';

const FIRST_ACTION = bucketId('first_action');

export function reclassUnit(
  unit: CampaignUnit,
  newClassId: ClassId,
  catalog: Catalog,
): CampaignUnit {
  if (unit.classId === newClassId) return unit;

  const primaryCommand = catalog.getClass(newClassId).firstActionCommandSet;
  const loadout: Loadout = {
    ...unit.loadout,
    actionBuckets: {
      ...unit.loadout.actionBuckets,
      [FIRST_ACTION]: [primaryCommand],
    },
  };
  return { ...unit, classId: newClassId, loadout };
}
