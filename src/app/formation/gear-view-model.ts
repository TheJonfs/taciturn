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
  validateDraftUnit,
  type AbilityId,
  type BucketId,
  type Catalog,
  type CommandSetId,
  type DraftUnitLegality,
  type EquipmentDefinition,
  type EquipmentSlotId,
  type ItemId,
  type WeaponType,
} from '@engine/index.ts';
import {
  CAMPAIGN_RULESET_ID,
  CANONICAL_PROBE_BATTLE,
  equipOnUnit,
  equippedCounts,
  probeUnitStats,
  type EffectiveUnitStats,
  type InventoryRecord,
  type VitalsProbeBattle,
} from '@campaign/index.ts';
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

// --- effective stats + hypothetical projections (Stage 3) ---------------

// The battle template the Formation stat probes fold onto — the campaign's
// CANONICAL probe field (probe-battle.ts; any template works — the probe
// never fights, and the template choice can't change the numbers, pinned
// by probe-battle.test.ts). Was the start node's battle beat; the canonical
// field drops the graph dependency and the start-must-have-a-battle throw.
function probeBattle(): VitalsProbeBattle {
  return CANONICAL_PROBE_BATTLE;
}

// The unit's live effective stats (equipment/passive/class-composed via
// the real fold — see `probeUnitStats`). Null when the loadout is
// invalid (the header shows "—" + the cause banner instead).
export function effectiveUnitStats(
  unit: CampaignUnit,
  catalog: Catalog,
): EffectiveUnitStats | null {
  const { template, playerTeam } = probeBattle();
  return probeUnitStats(template, unit, playerTeam, catalog);
}

// Re-project stats for a hypothetical gear pick (the Mage War
// `projectEquipmentStats` behavior): what the unit's numbers become if
// `slot` held `itemId` (null = emptied). Includes the 2H off-hand
// auto-clear, so the preview matches what the pick would really do.
export function projectGearStats(
  unit: CampaignUnit,
  slot: EquipmentSlotId,
  itemId: ItemId | null,
  catalog: Catalog,
): EffectiveUnitStats | null {
  return effectiveUnitStats(equipOnUnit(unit, slot, itemId, catalog), catalog);
}

// Re-project stats for a hypothetical passive toggle (equip if absent,
// remove if equipped) — Move +1 and friends preview their effect the
// same way gear does. No capacity gate: the picker already disables
// unaffordable adds, and an over-capacity hypothetical probes to null.
export function projectPassiveStats(
  unit: CampaignUnit,
  bucket: BucketId,
  abilityId: AbilityId,
  catalog: Catalog,
): EffectiveUnitStats | null {
  const current = unit.loadout.passiveBuckets[bucket] ?? [];
  const next = current.includes(abilityId)
    ? current.filter((id) => id !== abilityId)
    : [...current, abilityId];
  const hypothetical: CampaignUnit = {
    ...unit,
    loadout: {
      ...unit.loadout,
      passiveBuckets: { ...unit.loadout.passiveBuckets, [bucket]: next },
    },
  };
  return effectiveUnitStats(hypothetical, catalog);
}

// What the Loadout inspector is focused on — reported by the pickers on
// hover, cleared on leave (the Team Builder's InspectorFocus pattern).
// Carries identity + the cheap display context the rows already know.
export type LoadoutFocus =
  | { readonly kind: 'gear'; readonly slot: EquipmentSlotId; readonly itemId: ItemId | null; readonly free?: number }
  | {
      readonly kind: 'passive';
      readonly bucket: BucketId;
      readonly abilityId: AbilityId;
      readonly equipped: boolean;
      readonly cost: number;
    }
  | { readonly kind: 'secondary'; readonly commandSetId: CommandSetId };

export interface StatDeltaChip {
  readonly text: string;
  readonly tone: 'up' | 'down';
}

const STAT_LABELS: ReadonlyArray<readonly [keyof EffectiveUnitStats, string]> = [
  ['maxHp', 'HP'],
  ['maxMp', 'MP'],
  ['pa', 'PA'],
  ['ma', 'MA'],
  ['spd', 'SPD'],
  ['moveRange', 'Move'],
  ['jump', 'Jump'],
];

// The non-zero stat changes between two projections, as signed chips.
export function statDeltaChips(
  before: EffectiveUnitStats,
  after: EffectiveUnitStats,
): ReadonlyArray<StatDeltaChip> {
  const chips: StatDeltaChip[] = [];
  for (const [key, label] of STAT_LABELS) {
    const delta = after[key] - before[key];
    if (delta === 0) continue;
    chips.push({ text: `${delta > 0 ? '+' : ''}${delta} ${label}`, tone: delta > 0 ? 'up' : 'down' });
  }
  return chips;
}

// --- legality surfacing (Stage 2: surface, don't resolve) ---------------

// The unit's draft legality under the campaign ruleset — the SAME
// resolver `createInitialState` throws from (D3), so no unit this view
// calls valid can fail battle entry. Held-but-invalid states (the maul
// pushing a filled bucket over, a reclass leaving illegal gear) are
// reported here for the UI to surface; deploy blocks on `.valid`.
export function unitLegality(unit: CampaignUnit, catalog: Catalog): DraftUnitLegality {
  return validateDraftUnit(
    { classId: unit.classId, loadout: unit.loadout, equipment: unit.equipment },
    catalog,
    CAMPAIGN_RULESET_ID,
  );
}

const BUCKET_DISPLAY: Readonly<Record<string, string>> = {
  first_action: 'Primary Command',
  secondary_command_sets: 'Secondary Command',
  reaction: 'Reaction',
  support: 'Support',
  movement: 'Movement',
};

function itemName(id: ItemId, catalog: Catalog): string {
  return catalog.hasItem(id) ? catalog.getItem(id).name : String(id);
}

// Human cause lines for an invalid loadout — D2's "surface the specific
// cause so the player can go fix it". Each violation names the thing to
// act on; capacity overages also name the equipped item(s) reducing the
// bucket (the "why did my reaction disappear" pointer).
export function legalityCauses(
  legality: DraftUnitLegality,
  unit: CampaignUnit,
  catalog: Catalog,
): ReadonlyArray<string> {
  const causes: string[] = [];
  const className = catalog.hasClass(unit.classId)
    ? catalog.getClass(unit.classId).name
    : String(unit.classId);

  for (const over of legality.bucketOverages) {
    // Which equipped items are shrinking this bucket?
    const reducers: string[] = [];
    for (const slot of EQUIPMENT_SLOT_IDS) {
      const id = unit.equipment[slot];
      if (id === null || !catalog.hasItem(id)) continue;
      const item = catalog.getItem(id);
      if (!isEquipment(item)) continue;
      const delta = item.bucketCapacityMods?.get(over.bucketId);
      if (delta !== undefined && delta < 0) reducers.push(`${item.name} ${delta}`);
    }
    const cause = reducers.length > 0 ? ` — ${reducers.join(', ')}` : '';
    causes.push(
      `${BUCKET_DISPLAY[String(over.bucketId)] ?? String(over.bucketId)} over capacity: ` +
        `${over.used} equipped, ${over.capacity} available${cause}`,
    );
  }

  for (const bad of legality.invalidSlots) {
    const name = itemName(bad.itemId, catalog);
    switch (bad.reason) {
      case 'class_restricted':
        causes.push(`${name} can't be worn by a ${className}`);
        break;
      case 'slot_not_permitted':
        causes.push(`A ${className} can't use the ${SLOT_LABEL[bad.slot].toLowerCase()} slot`);
        break;
      case 'wrong_kind':
        causes.push(`${name} doesn't fit the ${SLOT_LABEL[bad.slot].toLowerCase()} slot`);
        break;
      case 'unknown_item':
        causes.push(`${String(bad.itemId)} is not a known item`);
        break;
    }
  }

  for (const hand of legality.twoHandedConflictHands) {
    const id = unit.equipment[hand];
    const other = hand === 'rightHand' ? 'left hand' : 'right hand';
    causes.push(
      `${id !== null ? itemName(id, catalog) : 'A two-handed weapon'} needs both hands — ` +
        `empty the ${other} (or equip Monkeygrip)`,
    );
  }

  if (legality.dualWielding) {
    causes.push('Two weapons equipped without a dual-wield passive (Two Weapons)');
  }

  for (const conflict of legality.equipLegalityConflicts) {
    causes.push(
      `${itemName(conflict.wornItemId, catalog)} forbids class-restricted gear in the ` +
        `${SLOT_LABEL[conflict.forbiddenSlot].toLowerCase()} slot — remove ` +
        `${itemName(conflict.otherItemId, catalog)}`,
    );
  }

  return causes;
}
