// TABA equipment-pool invariants (M3 Stage 0 — the isolation substrate).
//
// Two directions of the D1 contract:
//   1. TABA-new items never leak into Mage War → every TABA_NEW entry must be
//      `availability: 'hidden'` (Mage War's picker keys on 'available').
//   2. TABA's Ch2 anchor IS the Mage War set → the Mage War–shared sections
//      reconstruct the frozen picker pool exactly (no shared item forgotten,
//      no phantom shared item).
// Plus hygiene: every id resolves in the catalog to real equipment, no
// duplicate entries across sections.

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '@content/index.ts';
import { isEquipment } from '@engine/index.ts';
import { AVAILABLE_EQUIPMENT } from '../ui/team-builder-state.ts';
import {
  MAGE_WAR_SHARED_ENTRIES,
  TABA_GEAR_POOL,
  TABA_NEW_ENTRIES,
  tabaShopPool,
} from './equipment-pool.ts';

const catalog = loadDefaultCatalog();

describe('TABA equipment pool (Stage 0 isolation invariants)', () => {
  it('every pool entry resolves to real equipment in the catalog', () => {
    for (const entry of TABA_GEAR_POOL) {
      expect(catalog.hasItem(entry.itemId), `unknown item ${String(entry.itemId)}`).toBe(true);
      expect(
        isEquipment(catalog.getItem(entry.itemId)),
        `${String(entry.itemId)} is not equipment`,
      ).toBe(true);
    }
  });

  it('has no duplicate item ids across sections', () => {
    const ids = TABA_GEAR_POOL.map((e) => String(e.itemId));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every TABA-new item is 'hidden' — invisible to Mage War by construction", () => {
    for (const entry of TABA_NEW_ENTRIES) {
      expect(
        catalog.getItem(entry.itemId).availability,
        `TABA-only item ${String(entry.itemId)} must be 'hidden' or it leaks into Mage War`,
      ).toBe('hidden');
    }
  });

  it('the Mage War–shared sections reconstruct the frozen Mage War pool exactly', () => {
    const shared = MAGE_WAR_SHARED_ENTRIES.map((e) => String(e.itemId)).sort();
    const mageWar = AVAILABLE_EQUIPMENT.map((e) => String(e.id)).sort();
    expect(shared).toEqual(mageWar);
  });

  it('chapter gating: the Ch1 shop pool contains no chapter-2+ entries', () => {
    for (const entry of tabaShopPool(1)) {
      expect(entry.chapter).toBe(1);
      expect(entry.acquisition).toBe('shop');
    }
  });
});
