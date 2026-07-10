// Formation gear view-model — the equipment column of the merged Loadout
// tab (TABA M3 UI). Pure; React wiring lives in Customize.tsx.
//
// The campaign twin of the Team Builder's `equipmentOptionsForSlot`, with
// one structural difference: the candidate pool is WHAT THE PARTY OWNS
// (the M3 inventory), not a global availability flag. Mage War's
// unique-per-team rule is replaced by instance counts — an item with no
// free instance simply doesn't appear (except as the slot's own current
// item). Hidden TABA-pool items surface here the moment the party owns
// one; the `availability` flag never enters into it.
//
// Legality gates mirror the Team Builder's picker: the shared draft
// resolver's `classCanEquip` (slot/kind + class permission + class
// restriction), the two-handed off-hand lock (relaxed by Monkeygrip),
// and the dual-wield off-hand gate (lifted by Two Weapons). The picker
// only OFFERS legal choices; illegal states that ARISE (reclass,
// capacity-reducing gear) are held and surfaced per D2, never blocked
// here.

import {
  EQUIPMENT_SLOT_IDS,
  classCanEquip,
  isEquipment,
  loadoutGrantsDualWield,
  loadoutGrantsTwoHandedGrip,
  type Catalog,
  type EquipmentDefinition,
  type EquipmentSlotId,
  type ItemId,
  type WeaponType,
} from '@engine/index.ts';
import { equippedCounts, type InventoryRecord } from '@campaign/index.ts';
import type { CampaignUnit } from '@campaign/index.ts';

export const SLOT_ORDER: ReadonlyArray<EquipmentSlotId> = [
  'rightHand',
  'leftHand',
  'headgear',
  'armor',
  'accessory',
];

export const SLOT_LABEL: Readonly<Record<EquipmentSlotId, string>> = {
  rightHand: 'Right hand',
  leftHand: 'Left hand',
  headgear: 'Headgear',
  armor: 'Armor',
  accessory: 'Accessory',
};

export interface GearOption {
  readonly item: EquipmentDefinition;
  // Instances free to equip (owned − equipped across the roster). The
  // slot's current item shows its own free count (usually 0) but is
  // always offered so re-selecting / keeping it is never blocked.
  readonly free: number;
  readonly equipped: boolean; // equipped in THIS slot of THIS unit
}

// The legal candidates for one slot of one roster unit, in catalog
// (authoring) order; `gearOptionGroups` sorts for display.
export function gearOptionsForSlot(
  unit: CampaignUnit,
  roster: ReadonlyArray<CampaignUnit>,
  inventory: InventoryRecord,
  slot: EquipmentSlotId,
  catalog: Catalog,
): ReadonlyArray<GearOption> {
  const equipped = equippedCounts(roster);
  const free = (id: ItemId): number =>
    Math.max(0, (inventory[String(id)] ?? 0) - (equipped.get(String(id)) ?? 0));

  const currentItemId = unit.equipment[slot];
  const gripRelaxed = loadoutGrantsTwoHandedGrip(unit.loadout, catalog);
  const dualWieldEnabled = loadoutGrantsDualWield(unit.loadout, catalog);

  // The off-hand's contents gate this hand (two-handed lock / dual-wield).
  const otherHand: EquipmentSlotId | null =
    slot === 'leftHand' ? 'rightHand' : slot === 'rightHand' ? 'leftHand' : null;
  const otherHandItemId = otherHand !== null ? unit.equipment[otherHand] : null;
  const otherHandItem =
    otherHandItemId !== null && catalog.hasItem(otherHandItemId)
      ? catalog.getItem(otherHandItemId)
      : null;
  const otherHandHasWeapon = otherHandItem?.kind === 'weapon';
  const otherHandTwoHanded =
    otherHandItem?.kind === 'weapon' && otherHandItem.twoHanded === true;

  const options: GearOption[] = [];
  for (const item of catalog.items()) {
    if (!isEquipment(item)) continue;
    const isCurrent = item.id === currentItemId;
    // Ownership gate: offered only while a free instance exists — except
    // the slot's own current item, which stays selectable.
    if (!isCurrent && free(item.id) < 1) continue;
    if (!classCanEquip(unit.classId, slot, item, catalog)) continue;
    if (!isCurrent) {
      // Two-handed off-hand lock — nothing fits beside a two-hander
      // unless Monkeygrip relaxes it.
      if (otherHandTwoHanded && !gripRelaxed) continue;
      // Dual-wield gate — no second weapon without Two Weapons.
      if (otherHandHasWeapon && item.kind === 'weapon' && !dualWieldEnabled) continue;
    }
    options.push({ item, free: free(item.id), equipped: isCurrent });
  }
  return options;
}

// --- display grouping (ported from the Team Builder's picker) ---------

const WEAPON_GROUP: ReadonlyArray<{ readonly type: WeaponType; readonly label: string }> = [
  { type: 'sword', label: 'Swords' },
  { type: 'knight_sword', label: 'Knight Swords' },
  { type: 'knife', label: 'Knives' },
  { type: 'axe', label: 'Axes & Hammers' },
  { type: 'polearm', label: 'Polearms' },
  { type: 'bow', label: 'Bows' },
  { type: 'wand', label: 'Wands' },
  { type: 'staff', label: 'Staves' },
];
const WEAPON_GROUP_INDEX: ReadonlyMap<WeaponType, number> = new Map(
  WEAPON_GROUP.map((g, i) => [g.type, i]),
);
const WEAPON_GROUP_LABEL: ReadonlyMap<WeaponType, string> = new Map(
  WEAPON_GROUP.map((g) => [g.type, g.label]),
);
const KIND_GROUP: ReadonlyMap<string, { readonly label: string; readonly order: number }> =
  new Map([
    ['shield', { label: 'Shields & off-hand', order: 100 }],
    ['armor', { label: 'Armor', order: 101 }],
    ['headgear', { label: 'Headgear', order: 102 }],
    ['accessory', { label: 'Accessories', order: 103 }],
  ]);

export interface GearOptionGroup {
  readonly key: string;
  readonly label: string;
  readonly options: ReadonlyArray<GearOption>;
}

export function gearOptionGroups(
  options: ReadonlyArray<GearOption>,
): ReadonlyArray<GearOptionGroup> {
  const byKey = new Map<string, { label: string; order: number; options: GearOption[] }>();
  for (const opt of options) {
    const meta = groupMeta(opt.item);
    let g = byKey.get(meta.key);
    if (g === undefined) {
      g = { label: meta.label, order: meta.order, options: [] };
      byKey.set(meta.key, g);
    }
    g.options.push(opt);
  }
  const groups = [...byKey.entries()].map(([key, g]) => {
    g.options.sort((a, b) => a.item.name.localeCompare(b.item.name));
    return { key, label: g.label, order: g.order, options: g.options };
  });
  groups.sort((a, b) => a.order - b.order);
  return groups.map(({ key, label, options: opts }) => ({ key, label, options: opts }));
}

function groupMeta(item: EquipmentDefinition): { key: string; label: string; order: number } {
  if (item.kind === 'weapon') {
    const type = item.weaponType;
    if (type !== undefined) {
      return {
        key: `weapon:${type}`,
        label: WEAPON_GROUP_LABEL.get(type) ?? 'Weapons',
        order: WEAPON_GROUP_INDEX.get(type) ?? 50,
      };
    }
    return { key: 'weapon:other', label: 'Other weapons', order: 99 };
  }
  const meta = KIND_GROUP.get(item.kind);
  if (meta !== undefined) return { key: item.kind, label: meta.label, order: meta.order };
  return { key: item.kind, label: item.kind, order: 200 };
}

// Short inline stat line for a candidate row — the key numbers a player
// scans (the Stage 3 inspector owns full detail). Weapons lead with
// WP + range; everything shows salient stat / capacity / grant mods.
export function gearStatLine(item: EquipmentDefinition): string {
  const parts: string[] = [];
  if (item.kind === 'weapon') {
    parts.push(`WP ${item.wp}`);
    if (item.range !== undefined && item.range.max > 1) parts.push(`rng ${item.range.max}`);
    if (item.twoHanded === true) parts.push('2H');
  }
  if (item.statMods !== undefined) {
    for (const [stat, value] of Object.entries(item.statMods)) {
      if (typeof value === 'number' && value !== 0) {
        parts.push(`${value > 0 ? '+' : ''}${value} ${stat}`);
      }
    }
  }
  if (item.bucketCapacityMods !== undefined) {
    for (const [bucket, delta] of item.bucketCapacityMods) {
      parts.push(`${delta > 0 ? '+' : ''}${delta} ${String(bucket)}`);
    }
  }
  if (item.statusGrants !== undefined && item.statusGrants.length > 0) {
    parts.push(`grants ${item.statusGrants.map((id) => String(id)).join(', ')}`);
  }
  return parts.slice(0, 3).join(' · ');
}

// How many free instances of each item the party could equip in ANY slot
// of this unit — used by Customize to badge the slot pills. (Cheap
// aggregate; recomputed per render like the rest of the view-model.)
export function slotHasOptions(
  unit: CampaignUnit,
  roster: ReadonlyArray<CampaignUnit>,
  inventory: InventoryRecord,
  catalog: Catalog,
): Readonly<Record<EquipmentSlotId, number>> {
  const out = {} as Record<EquipmentSlotId, number>;
  for (const slot of EQUIPMENT_SLOT_IDS) {
    out[slot] = gearOptionsForSlot(unit, roster, inventory, slot, catalog).filter(
      (o) => !o.equipped,
    ).length;
  }
  return out;
}
