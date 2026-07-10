// GearSlots — the EQUIPMENT column of the merged Loadout tab (TABA M3).
//
// The celestial port of the Team Builder's slot-pills-and-picker: five
// slot pills; clicking one expands its candidate list inline (accordion,
// one open at a time) — grouped by weapon family / kind, searchable when
// long, each row showing the short stat line and the free-instance
// count. Candidates come from the inventory-driven `gearOptionsForSlot`;
// picking hands the edited unit up via `onChange` (the inventory record
// itself never changes on equip — counts derive from roster equipment).

import { useState, type ReactElement } from 'react';
import type { Catalog, EquipmentSlotId, ItemId } from '@engine/index.ts';
import { equipOnUnit, type CampaignUnit, type InventoryRecord } from '@campaign/index.ts';
import {
  SLOT_LABEL,
  SLOT_ORDER,
  gearOptionGroups,
  gearOptionsForSlot,
  gearStatLine,
  type LoadoutFocus,
} from './gear-view-model.ts';

// Show the in-picker search box above this many candidates.
const SEARCH_THRESHOLD = 12;

export interface GearSlotsProps {
  readonly unit: CampaignUnit;
  readonly roster: ReadonlyArray<CampaignUnit>;
  readonly inventory: InventoryRecord;
  readonly catalog: Catalog;
  readonly col: string; // domain accent colour (section heading)
  readonly onChange: (next: CampaignUnit) => void;
  // Report the hovered candidate to the Loadout inspector (M3 Stage 3).
  readonly onFocus: (focus: LoadoutFocus | null) => void;
}

export function GearSlots({
  unit,
  roster,
  inventory,
  catalog,
  col,
  onChange,
  onFocus,
}: GearSlotsProps): ReactElement {
  const [openSlot, setOpenSlot] = useState<EquipmentSlotId | null>(null);
  const [search, setSearch] = useState('');

  function toggleSlot(slot: EquipmentSlotId): void {
    setSearch('');
    onFocus(null);
    setOpenSlot((prev) => (prev === slot ? null : slot));
  }

  function pick(slot: EquipmentSlotId, itemId: ItemId | null): void {
    onChange(equipOnUnit(unit, slot, itemId, catalog));
    setOpenSlot(null);
    setSearch('');
    onFocus(null);
  }

  return (
    <div className="tf-load-sec">
      <div className="tf-load-h">
        <h3 style={{ color: col }}>Equipment</h3>
        <span className="tf-load-c">from the party&apos;s stores</span>
      </div>
      {SLOT_ORDER.map((slot) => {
        const itemId = unit.equipment[slot];
        const item = itemId !== null && catalog.hasItem(itemId) ? catalog.getItem(itemId) : null;
        const open = openSlot === slot;
        return (
          <div key={slot} className="tf-eq-slot">
            <button
              type="button"
              className={`tf-eq-pill${open ? ' open' : ''}`}
              onClick={() => toggleSlot(slot)}
              aria-expanded={open}
            >
              <span className="tf-eq-slotlab">{SLOT_LABEL[slot]}</span>
              <span className={`tf-eq-nm${item === null ? ' empty' : ''}`}>
                {item !== null ? item.name : itemId !== null ? String(itemId) : '— empty —'}
              </span>
              <span className={`tf-chev${open ? ' open' : ''}`}>▸</span>
            </button>
            {open && (
              <SlotPicker
                unit={unit}
                roster={roster}
                inventory={inventory}
                slot={slot}
                catalog={catalog}
                search={search}
                onSearch={setSearch}
                onFocus={onFocus}
                onPick={(id) => pick(slot, id)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function SlotPicker({
  unit,
  roster,
  inventory,
  slot,
  catalog,
  search,
  onSearch,
  onFocus,
  onPick,
}: {
  readonly unit: CampaignUnit;
  readonly roster: ReadonlyArray<CampaignUnit>;
  readonly inventory: InventoryRecord;
  readonly slot: EquipmentSlotId;
  readonly catalog: Catalog;
  readonly search: string;
  readonly onSearch: (v: string) => void;
  readonly onFocus: (focus: LoadoutFocus | null) => void;
  readonly onPick: (itemId: ItemId | null) => void;
}): ReactElement {
  const all = gearOptionsForSlot(unit, roster, inventory, slot, catalog);
  const needle = search.trim().toLowerCase();
  const filtered =
    needle === '' ? all : all.filter((o) => o.item.name.toLowerCase().includes(needle));
  const groups = gearOptionGroups(filtered);
  const equippedHere = unit.equipment[slot];

  return (
    <div className="tf-eq-list">
      {all.length > SEARCH_THRESHOLD && (
        <div className="tf-eq-search">
          <input
            autoFocus
            value={search}
            placeholder={`Search ${SLOT_LABEL[slot].toLowerCase()}…`}
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
      )}
      <button
        type="button"
        className={`tf-eq-row empty-row${equippedHere === null ? ' on' : ''}`}
        onClick={() => onPick(null)}
        onMouseEnter={() => onFocus({ kind: 'gear', slot, itemId: null })}
        onMouseLeave={() => onFocus(null)}
      >
        <span className="nm">— Empty —</span>
        {equippedHere === null && <span className="fr">✓</span>}
      </button>
      {filtered.length === 0 ? (
        <div className="tf-eq-none">
          {all.length === 0
            ? 'Nothing in the stores fits this slot.'
            : 'No matching equipment.'}
        </div>
      ) : (
        groups.map((group) => (
          <div key={group.key}>
            <div className="tf-eq-grouph">
              {group.label} <b>{group.options.length}</b>
            </div>
            {group.options.map((opt) => (
              <button
                key={String(opt.item.id)}
                type="button"
                className={`tf-eq-row${opt.equipped ? ' on' : ''}`}
                onClick={() => onPick(opt.item.id)}
                onMouseEnter={() =>
                  onFocus({ kind: 'gear', slot, itemId: opt.item.id, free: opt.free })
                }
                onMouseLeave={() => onFocus(null)}
              >
                <span className="nm">{opt.item.name}</span>
                <span className="st">{gearStatLine(opt.item)}</span>
                <span className="fr" title="free instances in the party's stores">
                  {opt.equipped ? '✓' : `×${opt.free}`}
                </span>
              </button>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
