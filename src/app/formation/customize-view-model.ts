// Formation Loadout tab — the pure view-model + loadout-edit ops (TABA M2 UI).
//
// Lets a unit curate what its learned kit actually equips: the SECONDARY command
// set and the R/S/M passives. (The primary command is fixed by the class and set
// on reclass; equipment/gear is M3.) The rules:
//   - Secondary command: any class the unit has unlocked ≥1 ACTIVE in (excluding
//     the current class) — access is earned through JP investment (Chris's call).
//   - Passives: `canEquipPassive` — every current-class passive is free (innate);
//     other-class passives need the export tax (an unlock). Enabler passives
//     equip but note their command-set condition.
// Capacity is equipment-adjusted via the engine's draft resolver
// (`draftBucketCapacity`) — the SAME function `createInitialState`'s
// legality side reads, per the M3 gear-UI brief's D3 discipline (one
// resolver; the pre-M3 "equipment can only LIFT capacity" assumption was
// falsified by Spiked Maul's reaction −3). Under the campaign's ruleset
// (`CAMPAIGN_RULESET_ID`), so the numbers here are what battle entry
// will enforce.

import {
  bucketId,
  draftAbilityCost,
  draftBucketCapacity,
  type AbilityId,
  type BucketId,
  type Catalog,
  type ClassId,
  type CommandSetId,
  type Loadout,
} from '@engine/index.ts';
import {
  CAMPAIGN_RULESET_ID,
  COMPONENT_ENTRIES,
  canEquipPassive,
  componentMetaOf,
  tierEntryOf,
  type CampaignUnit,
  type ComponentCatalog,
} from '@campaign/index.ts';
import { COMPONENT_TAGLINE, ENABLER_CONDITION } from './component-display.ts';
import { DOMAIN_COLOR, type Domain } from './roster-view-model.ts';

const FIRST_ACTION = bucketId('first_action');
const SECONDARY = bucketId('secondary_command_sets');

// Effective bucket capacity between battles: ruleset baseline + equipped
// items' `bucketCapacityMods`, via the engine's shared draft resolver.
// A campaign unit carries no statuses, so this is exactly what the
// hook-based `getCapacity` produces at battle entry (pinned in
// `draft-legality.test.ts`).
export function bucketCapacity(unit: CampaignUnit, bucket: string, catalog: Catalog): number {
  return draftBucketCapacity(unit.equipment, bucketId(bucket), catalog, CAMPAIGN_RULESET_ID);
}

export type PassiveBucket = 'reaction' | 'support' | 'movement';
export const PASSIVE_BUCKETS: ReadonlyArray<PassiveBucket> = ['reaction', 'support', 'movement'];
export const PASSIVE_BUCKET_LABEL: Readonly<Record<PassiveBucket, string>> = {
  reaction: 'Reaction',
  support: 'Support',
  movement: 'Movement',
};

// --- reads ------------------------------------------------------------------

function commandsIn(unit: CampaignUnit, bucket: BucketId): ReadonlyArray<CommandSetId> {
  return unit.loadout.actionBuckets[bucket] ?? [];
}
function passivesIn(unit: CampaignUnit, bucket: PassiveBucket): ReadonlyArray<AbilityId> {
  return unit.loadout.passiveBuckets[bucketId(bucket)] ?? [];
}

export function primaryCommand(unit: CampaignUnit, catalog: Catalog): { readonly id: CommandSetId; readonly name: string } {
  const id = commandsIn(unit, FIRST_ACTION)[0] ?? catalog.getClass(unit.classId).firstActionCommandSet;
  return { id, name: catalog.hasCommandSet(id) ? catalog.getCommandSet(id).name : String(id) };
}

export function currentSecondary(unit: CampaignUnit): CommandSetId | null {
  return commandsIn(unit, SECONDARY)[0] ?? null;
}

// --- availability -----------------------------------------------------------

export interface SecondaryOption {
  readonly classId: ClassId;
  readonly commandSetId: CommandSetId;
  readonly className: string;
  readonly commandName: string;
  readonly domain: Domain;
  readonly color: string;
}

// Command sets the unit may equip as secondary: one per class it has unlocked
// ≥1 active in, excluding the current class (that's the primary). Sorted by name.
export function equippableSecondaryCommands(
  unit: CampaignUnit,
  catalog: Catalog,
  componentCatalog: ComponentCatalog,
): ReadonlyArray<SecondaryOption> {
  const classesWithActive = new Set<string>();
  for (const token of unit.unlocks) {
    if (token.kind !== 'ability') continue;
    if (!catalog.hasAbility(token.id) || catalog.getAbility(token.id).kind !== 'active') continue;
    classesWithActive.add(String(componentMetaOf(token, componentCatalog).nativeClass));
  }
  classesWithActive.delete(String(unit.classId));

  const out: SecondaryOption[] = [];
  for (const cls of classesWithActive) {
    const classId = cls as ClassId;
    if (!catalog.hasClass(classId)) continue;
    const classDef = catalog.getClass(classId);
    const domain = tierEntryOf(classId).half;
    out.push({
      classId,
      commandSetId: classDef.firstActionCommandSet,
      className: classDef.name,
      commandName: catalog.hasCommandSet(classDef.firstActionCommandSet)
        ? catalog.getCommandSet(classDef.firstActionCommandSet).name
        : String(classDef.firstActionCommandSet),
      domain,
      color: DOMAIN_COLOR[domain],
    });
  }
  return out.sort((a, b) => a.className.localeCompare(b.className));
}

export interface PassiveOption {
  readonly abilityId: AbilityId;
  readonly name: string;
  readonly effect: string;
  readonly bucket: PassiveBucket;
  readonly innate: boolean; // native to the current class (free) vs exported (unlocked)
  readonly equipped: boolean;
  readonly cost: number; // slot cost in the current class (0 if free)
  readonly condition?: string; // enabler command-set requirement
}

// Every passive the unit may equip in its current class, grouped by bucket:
// current-class passives (free/innate) + unlocked other-class passives (exported).
export function equippablePassives(
  unit: CampaignUnit,
  catalog: Catalog,
  componentCatalog: ComponentCatalog,
): Readonly<Record<PassiveBucket, ReadonlyArray<PassiveOption>>> {
  const groups: Record<PassiveBucket, PassiveOption[]> = { reaction: [], support: [], movement: [] };

  for (const meta of COMPONENT_ENTRIES) {
    if (meta.token.kind !== 'ability') continue;
    const abilityId = meta.token.id;
    if (!catalog.hasAbility(abilityId)) continue;
    const ability = catalog.getAbility(abilityId);
    if (ability.kind !== 'passive') continue;
    const bucket = String(ability.bucket) as PassiveBucket;
    if (!PASSIVE_BUCKETS.includes(bucket)) continue;
    const equipped = passivesIn(unit, bucket).some((id) => id === abilityId);
    // Show a passive if it's equippable now OR already equipped (so a passive
    // carried over from a prior class / authored loadout the unit hasn't unlocked
    // is still visible and removable — never a stuck, invisible slot).
    if (!equipped && !canEquipPassive(unit, abilityId, unit.classId, componentCatalog).ok) continue;

    const displayKey = String(abilityId);
    const condition = ENABLER_CONDITION[displayKey];
    groups[bucket].push({
      abilityId,
      name: ability.name,
      effect: COMPONENT_TAGLINE[displayKey] ?? '',
      bucket,
      innate: meta.nativeClass === unit.classId,
      equipped,
      cost: passiveCost(unit, abilityId, catalog),
      ...(condition ? { condition } : {}),
    });
  }

  for (const b of PASSIVE_BUCKETS) {
    groups[b].sort((a, z) => Number(z.innate) - Number(a.innate) || a.name.localeCompare(z.name));
  }
  return groups;
}

export function equippedCount(unit: CampaignUnit, bucket: PassiveBucket): number {
  return passivesIn(unit, bucket).length;
}

// A passive's slot COST in the current class: 0 if the class grants it free
// (`freeAbilities` — typically the class's own passives), else its baseCost.
// Bucket capacity is a cost BUDGET, not a count — this is why a class can slot
// more of its own (free) passives than a naive count suggests.
export function passiveCost(unit: CampaignUnit, abilityId: AbilityId, catalog: Catalog): number {
  // Unknown ids read as cost 0 (a stale save must not crash the budget
  // display); known ids go through the engine's shared draft resolver.
  if (!catalog.hasAbility(abilityId)) return 0;
  return draftAbilityCost(unit.classId, abilityId, catalog);
}

// Total slot cost currently used in a passive bucket.
export function bucketUsed(unit: CampaignUnit, bucket: PassiveBucket, catalog: Catalog): number {
  return passivesIn(unit, bucket).reduce((sum, id) => sum + passiveCost(unit, id, catalog), 0);
}

// --- edit ops (pure) --------------------------------------------------------

// Set (or clear, with null) the single secondary command set.
export function setSecondaryCommand(unit: CampaignUnit, commandSetId: CommandSetId | null): CampaignUnit {
  const next: ReadonlyArray<CommandSetId> = commandSetId === null ? [] : [commandSetId];
  const loadout: Loadout = {
    ...unit.loadout,
    actionBuckets: { ...unit.loadout.actionBuckets, [SECONDARY]: next },
  };
  return { ...unit, loadout };
}

// Toggle a passive in its bucket. Capacity is a COST budget: equipping is a
// no-op when the passive's slot cost wouldn't fit in the remaining capacity;
// unequipping always succeeds. The caller passes the effective (equipment-aware)
// capacity from `bucketCapacity`.
export function togglePassive(
  unit: CampaignUnit,
  abilityId: AbilityId,
  bucket: PassiveBucket,
  capacity: number,
  catalog: Catalog,
): CampaignUnit {
  const current = passivesIn(unit, bucket);
  const has = current.some((id) => id === abilityId);
  let next: ReadonlyArray<AbilityId>;
  if (has) {
    next = current.filter((id) => id !== abilityId);
  } else {
    const used = current.reduce((sum, id) => sum + passiveCost(unit, id, catalog), 0);
    if (used + passiveCost(unit, abilityId, catalog) > capacity) return unit; // wouldn't fit
    next = [...current, abilityId];
  }
  const loadout: Loadout = {
    ...unit.loadout,
    passiveBuckets: { ...unit.loadout.passiveBuckets, [bucketId(bucket)]: next },
  };
  return { ...unit, loadout };
}
