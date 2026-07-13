// TABA M3 Stage 0 — inventory instance counting.
//
// The stored state is owned totals only; equipped counts derive from
// roster equipment and free = owned − equipped. These pin the
// derivation, the grandfather bootstrap, receipt, and the equip/unequip
// ops (including cross-unit contention on the last free instance — the
// brief's headline edge case).

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '../content/index.ts';
import { abilityId, bucketId, itemId, unitId, type ItemId } from '@engine/index.ts';
import {
  bootstrapInventory,
  equipItem,
  equippedCount,
  freeCount,
  grantItems,
  ownedCount,
  removeItems,
  unequipItem,
} from './inventory.ts';
import { newCampaign } from './loop.ts';
import { CAMPAIGN_NODES } from './node.ts';
import { m0Roster } from './roster.ts';
import type { CampaignState } from './types.ts';

const cat = loadDefaultCatalog();
const LONG_SWORD = itemId('long_sword');
const ABSOLOM = itemId('absolom'); // two-handed knight sword
const FLAMETONGUE = itemId('flametongue');

function fresh(): CampaignState {
  return newCampaign(m0Roster, CAMPAIGN_NODES.oskun);
}

// The roster's knight (carries Flametongue + Warrior's Aegis).
function knightId(state: CampaignState) {
  const knight = state.roster.find((u) => String(u.classId) === 'knight');
  if (knight === undefined) throw new Error('fixture: m0Roster has no knight');
  return knight.id;
}

describe('inventory — derivation and grandfather bootstrap', () => {
  it('a fresh campaign owns exactly what the roster has equipped (all free counts 0)', () => {
    const state = fresh();
    expect(ownedCount(state, FLAMETONGUE)).toBe(1);
    expect(equippedCount(state.roster, FLAMETONGUE)).toBe(1);
    expect(freeCount(state, FLAMETONGUE)).toBe(0);
    // Nothing owned beyond the equipped set.
    const totalOwned = Object.values(state.inventory).reduce((a, b) => a + b, 0);
    const totalEquipped = state.roster
      .flatMap((u) => Object.values(u.equipment))
      .filter((id) => id !== null).length;
    expect(totalOwned).toBe(totalEquipped);
  });

  it('bootstrapInventory raises owned to cover equipped, never lowers, and is idempotent', () => {
    const state = fresh();
    const withSpare = { ...state.inventory, [String(FLAMETONGUE)]: 3 };
    const boot = bootstrapInventory(withSpare, state.roster);
    expect(boot[String(FLAMETONGUE)]).toBe(3); // never lowered
    expect(bootstrapInventory(boot, state.roster)).toEqual(boot); // idempotent
  });

  it('a LOST unit keeps its kit — its gear stays equipped, not free', () => {
    const state = fresh();
    const kId = knightId(state);
    const roster = state.roster.map((u) => (u.id === kId ? { ...u, fate: 'lost' as const } : u));
    const lostState = { ...state, roster };
    expect(freeCount(lostState, FLAMETONGUE)).toBe(0);
  });
});

describe('inventory — receipt (grantItems)', () => {
  it('adds owned instances; free counts rise', () => {
    const state = grantItems(fresh(), [[LONG_SWORD, 2]]);
    expect(ownedCount(state, LONG_SWORD)).toBe(2);
    expect(freeCount(state, LONG_SWORD)).toBe(2);
  });

  it('is additive across grants and does not cap uniques (receipt-gated model)', () => {
    let state = grantItems(fresh(), [[FLAMETONGUE, 1]]);
    state = grantItems(state, [[FLAMETONGUE, 1]]);
    // One equipped on the knight + two granted = three owned.
    expect(ownedCount(state, FLAMETONGUE)).toBe(3);
    expect(freeCount(state, FLAMETONGUE)).toBe(2);
  });

  it('rejects non-positive and fractional quantities loudly', () => {
    expect(() => grantItems(fresh(), [[LONG_SWORD, 0]])).toThrow(/positive integer/);
    expect(() => grantItems(fresh(), [[LONG_SWORD, -1]])).toThrow(/positive integer/);
    expect(() => grantItems(fresh(), [[LONG_SWORD, 1.5]])).toThrow(/positive integer/);
  });
});

describe('inventory — equip / unequip ops', () => {
  it('equip consumes a free instance; the displaced item returns to the pool', () => {
    let state = grantItems(fresh(), [[LONG_SWORD, 1]]);
    const kId = knightId(state);
    state = equipItem(state, kId, 'rightHand', LONG_SWORD, cat);
    const knight = state.roster.find((u) => u.id === kId)!;
    expect(knight.equipment.rightHand).toBe(LONG_SWORD);
    expect(freeCount(state, LONG_SWORD)).toBe(0);
    // Flametongue came off the hand and is free again.
    expect(freeCount(state, FLAMETONGUE)).toBe(1);
    expect(ownedCount(state, FLAMETONGUE)).toBe(1); // owned never changed
  });

  it('unequip returns the instance to the pool', () => {
    let state = fresh();
    const kId = knightId(state);
    state = unequipItem(state, kId, 'rightHand');
    expect(freeCount(state, FLAMETONGUE)).toBe(1);
    const knight = state.roster.find((u) => u.id === kId)!;
    expect(knight.equipment.rightHand).toBeNull();
  });

  it('cross-unit contention: the last free instance equips once, then fails loud elsewhere', () => {
    let state = grantItems(fresh(), [[LONG_SWORD, 1]]);
    const [a, b] = state.roster.filter((u) => String(u.classId) !== 'knight');
    state = equipItem(state, a!.id, 'rightHand', LONG_SWORD, cat);
    expect(freeCount(state, LONG_SWORD)).toBe(0);
    expect(() => equipItem(state, b!.id, 'rightHand', LONG_SWORD, cat)).toThrow(
      /no free instance/,
    );
  });

  it('re-equipping the item already in the slot is a no-op (no availability check)', () => {
    const state = fresh();
    const kId = knightId(state);
    // Flametongue is equipped (0 free) — re-selecting it must not throw.
    expect(equipItem(state, kId, 'rightHand', FLAMETONGUE, cat)).toBe(state);
  });

  it('placing a two-handed weapon clears the off-hand, returning its item', () => {
    let state = grantItems(fresh(), [[ABSOLOM, 1]]);
    const kId = knightId(state);
    const before = state.roster.find((u) => u.id === kId)!;
    const offHand = before.equipment.leftHand!;
    const mainHand = before.equipment.rightHand!;
    expect(offHand).not.toBeNull(); // fixture sanity: the knight carries a shield
    state = equipItem(state, kId, 'rightHand', ABSOLOM, cat);
    const knight = state.roster.find((u) => u.id === kId)!;
    expect(knight.equipment.rightHand).toBe(ABSOLOM);
    expect(knight.equipment.leftHand).toBeNull(); // off-hand auto-cleared
    expect(freeCount(state, offHand)).toBe(1);
    expect(freeCount(state, mainHand)).toBe(1);
  });

  it('Monkeygrip relaxes the two-handed auto-clear — the off-hand keeps its item', () => {
    let state = grantItems(fresh(), [[ABSOLOM, 1]]);
    const kId = knightId(state);
    const roster = state.roster.map((u) =>
      u.id === kId
        ? {
            ...u,
            loadout: {
              ...u.loadout,
              passiveBuckets: {
                ...u.loadout.passiveBuckets,
                [String(bucketId('support'))]: [abilityId('monkeygrip')],
              },
            },
          }
        : u,
    );
    const offHand = roster.find((u) => u.id === kId)!.equipment.leftHand;
    state = equipItem({ ...state, roster }, kId, 'rightHand', ABSOLOM, cat);
    const knight = state.roster.find((u) => u.id === kId)!;
    expect(knight.equipment.rightHand).toBe(ABSOLOM);
    expect(knight.equipment.leftHand).toBe(offHand); // kept, not auto-cleared
    expect(offHand).not.toBeNull();
  });

  it('unknown unit / unknown item fail loud', () => {
    const state = fresh();
    expect(() => equipItem(state, unitId('nobody'), 'rightHand', LONG_SWORD, cat)).toThrow(
      /not on the roster/,
    );
    expect(() =>
      equipItem(state, knightId(state), 'rightHand', 'no_such_item' as ItemId, cat),
    ).toThrow(/not in the catalog/);
  });
});

describe('inventory — removal (the exit door; M3 economy Stage 2)', () => {
  it('removes free instances and drops zero entries', () => {
    const state = grantItems(fresh(), [[LONG_SWORD, 2]]);
    const one = removeItems(state, LONG_SWORD, 1);
    expect(ownedCount(one, LONG_SWORD)).toBe(ownedCount(state, LONG_SWORD) - 1);
    const freeBefore = freeCount(state, LONG_SWORD);
    const none = removeItems(state, LONG_SWORD, freeBefore);
    expect(freeCount(none, LONG_SWORD)).toBe(0);
  });

  it('refuses to remove more than the FREE count (equipped gear is safe)', () => {
    const state = fresh(); // day-one gear: owned == equipped, nothing free
    expect(() => removeItems(state, FLAMETONGUE, 1)).toThrow(/free instance/);
  });

  it('refuses non-positive quantities', () => {
    const state = grantItems(fresh(), [[LONG_SWORD, 1]]);
    expect(() => removeItems(state, LONG_SWORD, 0)).toThrow(/positive integer/);
    expect(() => removeItems(state, LONG_SWORD, -1)).toThrow(/positive integer/);
  });
});
