// TeamBuilderEquipmentSlots — the equipment region of the unit card
// (Pass 2 redesign). Two states, matching the approved concept:
//
//   1. Default: five slot *pills* (icon + equipped item, or "empty").
//      Clicking a pill opens that slot's picker.
//   2. Open: the slot's legal candidates, grouped by type, sorted, and
//      searchable, with key stats inline and the equipped item tagged.
//      Hovering a candidate routes it to the context inspector; selecting
//      equips it and returns to the pills.
//
// The legal-options enumeration (class eligibility, unique-per-team, the
// two-handed / dual-wield hand gates) lives in `equipmentOptionsForSlot`
// in team-builder-state — one shared source the validity checker and the
// engine validator agree with; this component no longer re-derives those
// rules.

import { useState, type CSSProperties, type ReactElement } from 'react';
import {
  isEquipment,
  type Catalog,
  type EquipmentDefinition,
  type EquipmentSlotId,
  type ItemId,
  type WeaponType,
} from '@engine/index.ts';
import { equipmentOptionsForSlot } from './team-builder-state.ts';
import type { TeamBuilder } from './use-team-builder.ts';
import type { InspectorFocus, SetInspectorFocus } from './team-builder-inspector.tsx';
import { Icon, weaponTypeIcon, type IconName } from './team-builder-icons.tsx';

const SLOT_LABELS: ReadonlyMap<EquipmentSlotId, string> = new Map([
  ['rightHand', 'Right hand'],
  ['leftHand', 'Left hand'],
  ['headgear', 'Headgear'],
  ['armor', 'Armor'],
  ['accessory', 'Accessory'],
]);

const SLOT_ORDER: ReadonlyArray<EquipmentSlotId> = [
  'rightHand',
  'leftHand',
  'headgear',
  'armor',
  'accessory',
];

// Display label per weapon family, plus the group order for the picker
// (melee families, then ranged, then casters — shields/kind groups slot
// in after weapons).
const WEAPON_GROUP: ReadonlyArray<{ type: WeaponType; label: string }> = [
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

// Non-weapon kinds, ordered after the weapon families.
const KIND_GROUP: ReadonlyMap<string, { label: string; icon: IconName; order: number }> =
  new Map([
    ['shield', { label: 'Shields & off-hand', icon: 'shield', order: 100 }],
    ['armor', { label: 'Armor', icon: 'armor', order: 101 }],
    ['headgear', { label: 'Headgear', icon: 'headgear', order: 102 }],
    ['accessory', { label: 'Accessories', icon: 'accessory', order: 103 }],
  ]);

type SortMode = 'type' | 'name';

export interface TeamBuilderEquipmentSlotsProps {
  readonly builder: TeamBuilder;
  readonly catalog: Catalog;
  readonly onFocus: SetInspectorFocus;
}

export function TeamBuilderEquipmentSlots({
  builder,
  catalog,
  onFocus,
}: TeamBuilderEquipmentSlotsProps): ReactElement {
  const { selectedIndex, selectedUnit, setEquipment } = builder;
  const [openSlot, setOpenSlot] = useState<EquipmentSlotId | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortMode>('type');

  if (selectedUnit.classId === null) {
    return (
      <div style={rootStyle}>
        <div style={sectionLabelStyle}>Equipment</div>
        <div style={emptyHintStyle}>Pick a class to choose equipment.</div>
      </div>
    );
  }

  const closeSlot = (): void => {
    setOpenSlot(null);
    setSearch('');
    onFocus(null);
  };

  if (openSlot !== null) {
    return (
      <SlotPicker
        slot={openSlot}
        builder={builder}
        catalog={catalog}
        search={search}
        onSearch={setSearch}
        sort={sort}
        onSort={setSort}
        onFocus={onFocus}
        onClose={closeSlot}
        onPick={(itemId) => {
          setEquipment(selectedIndex, openSlot, itemId);
          closeSlot();
        }}
      />
    );
  }

  return (
    <div style={rootStyle}>
      <div style={sectionLabelStyle}>Equipment</div>
      <div style={pillListStyle}>
        {SLOT_ORDER.map((slot) => {
          const itemId = selectedUnit.equipment[slot];
          const item = itemId !== null ? catalog.getItem(itemId) : null;
          return (
            <button
              key={slot}
              type="button"
              style={{ ...pillStyle, ...(item === null ? pillEmptyStyle : {}) }}
              onClick={() => {
                setSearch('');
                setOpenSlot(slot);
              }}
            >
              <Icon name={slotIcon(slot, item)} size={15} />
              <span style={pillNameStyle}>
                {item !== null ? item.name : `${SLOT_LABELS.get(slot)} — empty`}
              </span>
              <Icon name="chevron-down" size={13} style={{ opacity: 0.4 }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---- open-slot picker ----

interface SlotPickerProps {
  readonly slot: EquipmentSlotId;
  readonly builder: TeamBuilder;
  readonly catalog: Catalog;
  readonly search: string;
  readonly onSearch: (value: string) => void;
  readonly sort: SortMode;
  readonly onSort: (mode: SortMode) => void;
  readonly onFocus: SetInspectorFocus;
  readonly onClose: () => void;
  readonly onPick: (itemId: ItemId | null) => void;
}

interface OptionGroup {
  readonly key: string;
  readonly label: string;
  readonly icon: IconName;
  readonly order: number;
  readonly items: EquipmentDefinition[];
}

function SlotPicker({
  slot,
  builder,
  catalog,
  search,
  onSearch,
  sort,
  onSort,
  onFocus,
  onClose,
  onPick,
}: SlotPickerProps): ReactElement {
  const { selectedUnit, state } = builder;
  const equippedId = selectedUnit.equipment[slot];

  const options = equipmentOptionsForSlot(state, selectedUnit, slot, catalog).filter(
    (item) => item.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  const groups = groupOptions(options);
  const flat = [...options].sort((a, b) => a.name.localeCompare(b.name));

  const renderRow = (item: EquipmentDefinition): ReactElement => (
    <button
      key={String(item.id)}
      type="button"
      style={rowStyle}
      onClick={() => onPick(item.id)}
      onMouseEnter={() => onFocus(equipmentFocus(slot, item.id))}
      onMouseLeave={() => onFocus(null)}
      onFocus={() => onFocus(equipmentFocus(slot, item.id))}
    >
      <Icon name={equipmentIcon(item)} size={15} style={{ opacity: 0.85 }} />
      <span style={rowNameStyle}>{item.name}</span>
      <span style={rowStatStyle}>{optionStatLine(item)}</span>
      {equippedId === item.id && <span style={equippedTagStyle}>equipped</span>}
    </button>
  );

  return (
    <div style={rootStyle}>
      <div style={pickerHeaderStyle}>
        <button type="button" style={iconButtonStyle} onClick={onClose} title="Back">
          <Icon name="back" size={16} />
        </button>
        <Icon name={slotIcon(slot, equippedId !== null ? catalog.getItem(equippedId) : null)} size={15} />
        <span style={pickerTitleStyle}>{SLOT_LABELS.get(slot)}</span>
        <span style={pickerHintStyle}>— choose equipment</span>
        <div style={{ flex: 1 }} />
        <div style={searchWrapStyle}>
          <Icon name="search" size={13} style={{ opacity: 0.5 }} />
          <input
            autoFocus
            value={search}
            placeholder="Search"
            onChange={(e) => onSearch(e.target.value)}
            style={searchInputStyle}
          />
        </div>
        <button
          type="button"
          style={sortButtonStyle}
          onClick={() => onSort(sort === 'type' ? 'name' : 'type')}
          title="Toggle sort"
        >
          <Icon name="sort" size={13} />
          <span>{sort === 'type' ? 'by type' : 'A–Z'}</span>
        </button>
      </div>

      <div style={listStyle}>
        <button
          type="button"
          style={{ ...rowStyle, ...emptyRowStyle }}
          onClick={() => onPick(null)}
          onMouseEnter={() => onFocus(null)}
        >
          <Icon name="hand-empty" size={15} style={{ opacity: 0.6 }} />
          <span style={rowNameStyle}>— Empty —</span>
          {equippedId === null && <span style={equippedTagStyle}>equipped</span>}
        </button>

        {options.length === 0 ? (
          <div style={noResultsStyle}>No matching equipment.</div>
        ) : sort === 'name' ? (
          flat.map(renderRow)
        ) : (
          groups.map((group) => (
            <div key={group.key} style={groupStyle}>
              <div style={groupHeaderStyle}>
                <Icon name={group.icon} size={13} style={{ opacity: 0.7 }} />
                <span>{group.label}</span>
                <span style={groupCountStyle}>{group.items.length}</span>
              </div>
              {group.items.map(renderRow)}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function groupOptions(options: ReadonlyArray<EquipmentDefinition>): OptionGroup[] {
  const byKey = new Map<string, OptionGroup>();
  for (const item of options) {
    const meta = groupMeta(item);
    let g = byKey.get(meta.key);
    if (g === undefined) {
      g = { key: meta.key, label: meta.label, icon: meta.icon, order: meta.order, items: [] };
      byKey.set(meta.key, g);
    }
    g.items.push(item);
  }
  const groups = [...byKey.values()];
  for (const g of groups) g.items.sort((a, b) => a.name.localeCompare(b.name));
  groups.sort((a, b) => a.order - b.order);
  return groups;
}

function groupMeta(item: EquipmentDefinition): {
  key: string;
  label: string;
  icon: IconName;
  order: number;
} {
  if (item.kind === 'weapon') {
    const type = item.weaponType;
    if (type !== undefined) {
      return {
        key: `weapon:${type}`,
        label: WEAPON_GROUP_LABEL.get(type) ?? 'Weapons',
        icon: weaponTypeIcon(type),
        order: WEAPON_GROUP_INDEX.get(type) ?? 50,
      };
    }
    return { key: 'weapon:other', label: 'Other weapons', icon: 'sword', order: 99 };
  }
  const meta = KIND_GROUP.get(item.kind);
  if (meta !== undefined) {
    return { key: item.kind, label: meta.label, icon: meta.icon, order: meta.order };
  }
  return { key: item.kind, label: item.kind, icon: 'accessory', order: 200 };
}

// ---- presentation helpers ----

function equipmentFocus(slot: EquipmentSlotId, itemId: ItemId): InspectorFocus {
  return { kind: 'equipment', slot, itemId };
}

function slotIcon(
  slot: EquipmentSlotId,
  item: ReturnType<Catalog['getItem']> | null,
): IconName {
  if (item !== null && isEquipment(item)) return equipmentIcon(item);
  if (slot === 'headgear') return 'headgear';
  if (slot === 'armor') return 'armor';
  if (slot === 'accessory') return 'accessory';
  return 'hand-empty';
}

function equipmentIcon(item: EquipmentDefinition): IconName {
  if (item.kind === 'weapon') return weaponTypeIcon(item.weaponType);
  return KIND_GROUP.get(item.kind)?.icon ?? 'accessory';
}

// Short inline stat line for a candidate row — the key numbers a player
// scans, not the full detail (that's the inspector's job). Weapons lead
// with WP + range; other equipment shows its salient stat / status mods.
function optionStatLine(item: EquipmentDefinition): string {
  const parts: string[] = [];
  if (item.kind === 'weapon') {
    parts.push(`WP ${item.wp}`);
    if (item.range !== undefined && item.range.max > 1) parts.push(`rng ${item.range.max}`);
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

// ---- styles ----

const rootStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  minWidth: 0,
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

const pillListStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

const pillStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '7px 10px',
  background: '#1c1e23',
  border: '1px solid #2c2f36',
  borderRadius: 6,
  color: '#e7e9ee',
  fontFamily: 'inherit',
  fontSize: 13,
  cursor: 'pointer',
  textAlign: 'left',
};

const pillEmptyStyle: CSSProperties = {
  color: '#7e828c',
  fontStyle: 'italic',
  background: '#171a1f',
};

const pillNameStyle: CSSProperties = {
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const pickerHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
};

const iconButtonStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 4,
  background: '#1c1e23',
  border: '1px solid #2c2f36',
  borderRadius: 5,
  color: '#cfd2da',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const pickerTitleStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
};

const pickerHintStyle: CSSProperties = {
  fontSize: 11,
  fontStyle: 'italic',
  opacity: 0.5,
};

const searchWrapStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  padding: '3px 8px',
  background: '#16181d',
  border: '1px solid #2c2f36',
  borderRadius: 5,
};

const searchInputStyle: CSSProperties = {
  width: 110,
  background: 'transparent',
  border: 'none',
  color: '#e7e9ee',
  fontSize: 12,
  fontFamily: 'inherit',
  outline: 'none',
};

const sortButtonStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  padding: '4px 8px',
  background: '#1c1e23',
  border: '1px solid #2c2f36',
  borderRadius: 5,
  color: '#aab0bb',
  fontSize: 11,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const listStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  // No inner max-height: the card body (scrollBodyStyle) is the single
  // scroll region, so the candidate list flows and scrolls with it rather
  // than nesting a second scrollbar.
};

const groupStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
};

const groupHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 4px 2px',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: '#8c93a0',
};

const groupCountStyle: CSSProperties = {
  fontSize: 10,
  opacity: 0.5,
  fontWeight: 400,
};

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 9,
  padding: '6px 8px',
  background: 'transparent',
  border: '1px solid transparent',
  borderRadius: 5,
  color: '#e7e9ee',
  fontFamily: 'inherit',
  fontSize: 12,
  cursor: 'pointer',
  textAlign: 'left',
  width: '100%',
};

const emptyRowStyle: CSSProperties = {
  opacity: 0.7,
  marginBottom: 2,
};

const rowNameStyle: CSSProperties = {
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const rowStatStyle: CSSProperties = {
  fontSize: 11,
  opacity: 0.6,
  fontVariantNumeric: 'tabular-nums',
  flexShrink: 0,
};

const equippedTagStyle: CSSProperties = {
  fontSize: 10,
  color: '#6dc66d',
  flexShrink: 0,
};

const noResultsStyle: CSSProperties = {
  fontSize: 12,
  fontStyle: 'italic',
  opacity: 0.5,
  padding: '8px 4px',
};
