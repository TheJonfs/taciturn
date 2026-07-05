// TABA M2 — the reclass op.
//
// Reclassing a durable unit is NOT just swapping `classId`: a class's identity
// includes the command set it wields, which lives in the loadout's
// `first_action` bucket. The snapshot-fold passes `unit.loadout` + `unit.classId`
// verbatim into battle, so a reclass that left `first_action` pointing at the
// OLD class's command set would field a unit wielding the wrong commands. This
// op keeps the two consistent: it rebinds `first_action` to the new class's
// default command set, and cleans up loadout state the reclass invalidates:
//
//   - Passives that are no longer equippable in the new class (old-class natives
//     the unit never paid the export tax on) are UNEQUIPPED — they'd otherwise
//     sit in their buckets occupying (cost) capacity while being impossible to
//     re-equip, stranding slots. Passives that stay legal (new-class natives,
//     which become free, and already-exported ones) are kept.
//   - A secondary command that now equals the primary (you reclassed INTO your
//     secondary's class) is cleared — it's redundant and not a real option.
//
// Pure and total: same inputs → same unit. Reclassing to the current class is a
// no-op (returns the same reference).

import {
  bucketId,
  type AbilityId,
  type Catalog,
  type ClassId,
  type CommandSetId,
  type Loadout,
} from '@engine/index.ts';
import type { CampaignUnit } from './types.ts';
import { canEquipPassive, tokenKey, type ComponentCatalog } from './progression/index.ts';

const FIRST_ACTION = bucketId('first_action');
const SECONDARY = bucketId('secondary_command_sets');

export function reclassUnit(
  unit: CampaignUnit,
  newClassId: ClassId,
  catalog: Catalog,
  componentCatalog: ComponentCatalog,
): CampaignUnit {
  if (unit.classId === newClassId) return unit;

  const primaryCommand = catalog.getClass(newClassId).firstActionCommandSet;

  // Rebind the primary command; drop a secondary that now duplicates it.
  const actionBuckets: Record<string, ReadonlyArray<CommandSetId>> = {
    ...unit.loadout.actionBuckets,
    [FIRST_ACTION]: [primaryCommand],
  };
  const secondary = actionBuckets[SECONDARY] ?? [];
  actionBuckets[SECONDARY] = secondary.filter((cs) => cs !== primaryCommand);

  // The reclassed unit, used to re-test passive equip-legality against the NEW
  // class (unlocks are unchanged by reclass, so `canEquipPassive` reads them).
  const reclassed: CampaignUnit = { ...unit, classId: newClassId };
  const passiveBuckets: Record<string, ReadonlyArray<AbilityId>> = {};
  for (const [bucket, ids] of Object.entries(unit.loadout.passiveBuckets)) {
    passiveBuckets[bucket] = ids.filter((id) =>
      stillEquippable(reclassed, id, newClassId, componentCatalog),
    );
  }

  const loadout: Loadout = { actionBuckets, passiveBuckets };
  return { ...unit, classId: newClassId, loadout };
}

// A passive stays equipped through a reclass iff it's still legal in the new
// class. Non-component passives (outside the export-tax model) can't be
// evaluated, so they're kept (conservative — never strip what we can't price).
function stillEquippable(
  unit: CampaignUnit,
  abilityId: AbilityId,
  newClassId: ClassId,
  componentCatalog: ComponentCatalog,
): boolean {
  const key = tokenKey({ kind: 'ability', id: abilityId });
  if (!componentCatalog.has(key)) return true;
  return canEquipPassive(unit, abilityId, newClassId, componentCatalog).ok;
}
