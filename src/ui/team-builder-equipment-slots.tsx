// TeamBuilderEquipmentSlots — five per-slot dropdowns for the unit
// being edited (plan decision 5). Each dropdown lists items eligible
// for the unit's class and slot, minus any item already used elsewhere
// on the team (unique-per-team enforcement, client side). A "none"
// option empties the slot.

import type { CSSProperties, ReactElement } from 'react';
import {
  EQUIPMENT_SLOT_IDS,
  isEquipment,
  type Catalog,
  type EquipmentSlotId,
  type ItemDefinition,
  type ItemId,
} from '@engine/index.ts';
import { items } from '@content/index.ts';
import { classCanEquip, type DraftUnit } from './team-builder-state.ts';
import type { TeamBuilder } from './use-team-builder.ts';

// True when the unit has a passive granting dual-wield — detected by a
// `modifyDualWield` hook on any equipped passive (Two Weapons). Content-
// agnostic: no hard-coded ability id. `passiveBuckets` already folds in
// the class's free abilities, so the Assassin's native Two Weapons and a
// cross-class equip both resolve here.
function unitHasDualWield(unit: DraftUnit, catalog: Catalog): boolean {
  for (const abilityIds of Object.values(unit.loadout.passiveBuckets)) {
    for (const aid of abilityIds) {
      const ability = catalog.getAbility(aid);
      if (ability.kind === 'passive' && ability.hooks.some((h) => h.name === 'modifyDualWield')) {
        return true;
      }
    }
  }
  return false;
}

const SLOT_LABELS: ReadonlyMap<EquipmentSlotId, string> = new Map([
  ['rightHand', 'Right Hand'],
  ['leftHand', 'Left Hand'],
  ['headgear', 'Headgear'],
  ['armor', 'Armor'],
  ['accessory', 'Accessory'],
]);

// Display order — weapons first, then defensive slots top-down.
const SLOT_ORDER: ReadonlyArray<EquipmentSlotId> = [
  'rightHand',
  'leftHand',
  'headgear',
  'armor',
  'accessory',
];

const AVAILABLE_ITEMS: ReadonlyArray<ItemDefinition> = items.filter(
  (item) => item.availability === 'available',
);

export interface TeamBuilderEquipmentSlotsProps {
  readonly builder: TeamBuilder;
  readonly catalog: Catalog;
}

export function TeamBuilderEquipmentSlots({
  builder,
  catalog,
}: TeamBuilderEquipmentSlotsProps): ReactElement {
  const { selectedIndex, selectedUnit, state, setEquipment } = builder;
  const classId = selectedUnit.classId;

  if (classId === null) {
    return (
      <div style={rootStyle}>
        <div style={sectionLabelStyle}>Equipment</div>
        <div style={emptyHintStyle}>Pick a class to choose equipment.</div>
      </div>
    );
  }

  // Dual-wield capability (Session 42): the off-hand weapon slot opens
  // only when the unit has a passive granting dual-wield (Two Weapons).
  // Detected content-agnostically by scanning the unit's equipped
  // passives for a `modifyDualWield` hook — `passiveBuckets` already
  // includes the class's free abilities (merged at class assignment), so
  // the native-Assassin and cross-class-equipped cases both resolve here.
  const dualWieldEnabled = unitHasDualWield(selectedUnit, catalog);

  // Items used anywhere on the team — the unique-per-team pool. An item
  // equipped by another unit (or in another slot of this unit) is
  // excluded from a slot's options; the slot's own current item is
  // always kept so it stays selectable.
  const usedByOthers = new Set<ItemId>();
  state.units.forEach((unit, unitIndex) => {
    for (const slot of EQUIPMENT_SLOT_IDS) {
      const itemId = unit.equipment[slot];
      if (itemId === null) continue;
      usedByOthers.add(itemId);
    }
    void unitIndex;
  });

  return (
    <div style={rootStyle}>
      <div style={sectionLabelStyle}>Equipment</div>
      <div style={slotListStyle}>
        {SLOT_ORDER.map((slot) => {
          const currentItemId = selectedUnit.equipment[slot];
          // Without dual-wield (the default), when one hand holds a weapon
          // the other hand can only show shields / non-weapon (or empty),
          // enforced at the dropdown level. Two Weapons (`dualWieldEnabled`)
          // lifts the gate so the off-hand can hold a second weapon.
          const otherHand: EquipmentSlotId | null =
            slot === 'leftHand' ? 'rightHand' :
            slot === 'rightHand' ? 'leftHand' : null;
          const otherHandItemId = otherHand !== null ? selectedUnit.equipment[otherHand] : null;
          const otherHandItem = otherHandItemId !== null ? catalog.getItem(otherHandItemId) : null;
          const otherHandHasWeapon = otherHandItem?.kind === 'weapon';
          // Session 45: a two-handed weapon (the bow class) in the other
          // hand locks this hand shut — no shield, no second weapon. The
          // slot grays out (only "Empty" selectable).
          const otherHandTwoHanded =
            otherHandItem?.kind === 'weapon' && otherHandItem.twoHanded === true;
          const options = AVAILABLE_ITEMS.filter((item) => {
            if (!classCanEquip(classId, slot, item, catalog)) return false;
            // Keep the slot's current item; drop anything used elsewhere.
            if (item.id === currentItemId) return true;
            if (usedByOthers.has(item.id)) return false;
            // Two-handed gate: the off-hand of a two-handed weapon takes
            // nothing.
            if (otherHandTwoHanded) return false;
            // Dual-wield gate: don't offer a second weapon for the
            // off-hand slot unless the unit has Two Weapons.
            if (otherHandHasWeapon && item.kind === 'weapon' && !dualWieldEnabled) return false;
            return true;
          });
          return (
            <SlotRow
              key={slot}
              slot={slot}
              currentItemId={currentItemId}
              options={options}
              onChange={(itemId) => setEquipment(selectedIndex, slot, itemId)}
            />
          );
        })}
      </div>
    </div>
  );
}

interface SlotRowProps {
  readonly slot: EquipmentSlotId;
  readonly currentItemId: ItemId | null;
  readonly options: ReadonlyArray<ItemDefinition>;
  readonly onChange: (itemId: ItemId | null) => void;
}

function SlotRow({
  slot,
  currentItemId,
  options,
  onChange,
}: SlotRowProps): ReactElement {
  const current = options.find((item) => item.id === currentItemId) ?? null;
  return (
    <div style={slotRowStyle}>
      <div style={slotLabelStyle}>{SLOT_LABELS.get(slot)}</div>
      <select
        style={selectStyle}
        value={currentItemId === null ? '' : String(currentItemId)}
        onChange={(e) => {
          const value = e.target.value;
          onChange(value === '' ? null : (value as unknown as ItemId));
        }}
      >
        <option value="">— Empty —</option>
        {options.map((item) => (
          <option key={String(item.id)} value={String(item.id)}>
            {item.name}
          </option>
        ))}
      </select>
      {current !== null && (
        <div style={itemSummaryStyle}>{itemSummary(current)}</div>
      )}
    </div>
  );
}

// One-line mechanical summary for the equipped item — weapon power,
// stat mods, status grants. Imported data only; no hand-authored numbers.
function itemSummary(item: ItemDefinition): string {
  const parts: string[] = [];
  if (item.kind === 'weapon') {
    parts.push(`WP ${item.wp}`, `Acc ${item.accuracy}`);
  }
  if (!isEquipment(item)) return parts.length > 0 ? parts.join(' · ') : '—';
  if (item.statMods !== undefined) {
    for (const [stat, value] of Object.entries(item.statMods)) {
      if (typeof value === 'number' && value !== 0) {
        parts.push(`${value > 0 ? '+' : ''}${value} ${stat}`);
      }
    }
  }
  if (item.bucketCapacityMods !== undefined) {
    for (const [bucket, delta] of item.bucketCapacityMods) {
      parts.push(`${delta > 0 ? '+' : ''}${delta} ${String(bucket)} cap`);
    }
  }
  if (item.statusGrants !== undefined && item.statusGrants.length > 0) {
    parts.push(
      `grants ${item.statusGrants.map((id) => String(id)).join(', ')}`,
    );
  }
  if (item.attackSwingMultiplier !== undefined && item.attackSwingMultiplier > 1) {
    parts.push(`Attack swings ×${item.attackSwingMultiplier}`);
  }
  return parts.length > 0 ? parts.join(' · ') : '—';
}

// ---- styles ----

const rootStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const sectionLabelStyle: CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  opacity: 0.55,
};

const emptyHintStyle: CSSProperties = {
  fontSize: 12,
  opacity: 0.5,
  fontStyle: 'italic',
};

const slotListStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const slotRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '92px 1fr',
  gridTemplateRows: 'auto auto',
  columnGap: 8,
  rowGap: 2,
  alignItems: 'center',
};

const slotLabelStyle: CSSProperties = {
  fontSize: 11,
  opacity: 0.7,
  gridRow: '1 / 2',
};

const selectStyle: CSSProperties = {
  gridColumn: '2 / 3',
  gridRow: '1 / 2',
  padding: '5px 7px',
  fontSize: 12,
  background: '#15171b',
  color: '#e7e9ee',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: '#2c2f36',
  borderRadius: 5,
  fontFamily: 'inherit',
};

const itemSummaryStyle: CSSProperties = {
  gridColumn: '2 / 3',
  gridRow: '2 / 3',
  fontSize: 10,
  opacity: 0.5,
};
