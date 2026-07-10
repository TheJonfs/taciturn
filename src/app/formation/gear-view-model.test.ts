// Gear view-model — the inventory-driven slot-option enumerator.
//
// The gates under test: ownership (free counts, cross-unit contention),
// the shared draft resolver's class/slot legality, and the hand gates
// (two-handed lock / dual-wield). The pool is what the party OWNS —
// hidden TABA items appear once owned; nothing with zero free instances
// is offered except the slot's own current item.

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '@content/index.ts';
import { abilityId, bucketId, classId, itemId, unitId } from '@engine/index.ts';
import type { CampaignUnit, InventoryRecord } from '@campaign/index.ts';
import { m0Roster } from '@campaign/index.ts';
import { gearOptionsForSlot, gearStatLine } from './gear-view-model.ts';

const cat = loadDefaultCatalog();

const knightBase = m0Roster.find((u) => String(u.classId) === 'knight')!;

function knight(overrides: Partial<CampaignUnit> = {}): CampaignUnit {
  return { ...knightBase, ...overrides } as CampaignUnit;
}

const EMPTY_HANDS = {
  leftHand: null,
  rightHand: null,
  headgear: null,
  armor: null,
  accessory: null,
} as const;

function names(opts: ReturnType<typeof gearOptionsForSlot>): string[] {
  return opts.map((o) => String(o.item.id));
}

describe('gearOptionsForSlot — ownership gates', () => {
  it('offers only items with a free instance; the current item is always offered', () => {
    const u = knight({ equipment: { ...EMPTY_HANDS, rightHand: itemId('long_sword') } });
    // Party owns 1 long_sword (equipped on u) and 1 dagger (free).
    const inventory: InventoryRecord = { long_sword: 1, dagger: 1 };
    const opts = gearOptionsForSlot(u, [u], inventory, 'rightHand', cat);
    expect(names(opts)).toContain('long_sword'); // current — offered at 0 free
    expect(names(opts)).toContain('dagger');
    expect(opts.find((o) => String(o.item.id) === 'long_sword')?.equipped).toBe(true);
    expect(opts.find((o) => String(o.item.id) === 'dagger')?.free).toBe(1);
    // Owned-but-not-in-inventory items don't appear.
    expect(names(opts)).not.toContain('flametongue');
  });

  it('cross-unit contention: an instance equipped on a teammate is not free here', () => {
    const holder = knight({ equipment: { ...EMPTY_HANDS, rightHand: itemId('dagger') } });
    const other = knight({ id: unitId('second-knight'), equipment: EMPTY_HANDS });
    const inventory: InventoryRecord = { dagger: 1 };
    const opts = gearOptionsForSlot(other, [holder, other], inventory, 'rightHand', cat);
    expect(names(opts)).not.toContain('dagger'); // the only instance is on `holder`
  });
});

describe('gearOptionsForSlot — legality gates (shared resolver)', () => {
  const RICH: InventoryRecord = { war_plate: 5, long_sword: 5, dagger: 5, absolom: 5, buckler: 5 };

  it('slot kind: no weapons offered for headgear', () => {
    const u = knight({ equipment: EMPTY_HANDS });
    const opts = gearOptionsForSlot(u, [u], RICH, 'headgear', cat);
    expect(names(opts)).toEqual([]);
  });

  it('class restriction: war_plate offered to a knight, not to an earth mage', () => {
    const k = knight({ equipment: EMPTY_HANDS });
    expect(names(gearOptionsForSlot(k, [k], RICH, 'armor', cat))).toContain('war_plate');
    const mage = knight({ classId: classId('earth_mage'), equipment: EMPTY_HANDS });
    expect(names(gearOptionsForSlot(mage, [mage], RICH, 'armor', cat))).not.toContain('war_plate');
  });

  it('two-handed lock: off-hand offers nothing beside a two-hander (unless Monkeygrip)', () => {
    const u = knight({ equipment: { ...EMPTY_HANDS, rightHand: itemId('absolom') } });
    expect(names(gearOptionsForSlot(u, [u], RICH, 'leftHand', cat))).toEqual([]);

    const gripped = knight({
      equipment: { ...EMPTY_HANDS, rightHand: itemId('absolom') },
      loadout: {
        ...knightBase.loadout,
        passiveBuckets: {
          ...knightBase.loadout.passiveBuckets,
          [String(bucketId('support'))]: [abilityId('monkeygrip')],
        },
      },
    });
    expect(names(gearOptionsForSlot(gripped, [gripped], RICH, 'leftHand', cat))).toContain('buckler');
  });

  it('dual-wield gate: no second weapon without Two Weapons; shields still offered', () => {
    const u = knight({ equipment: { ...EMPTY_HANDS, rightHand: itemId('long_sword') } });
    const opts = names(gearOptionsForSlot(u, [u], RICH, 'leftHand', cat));
    expect(opts).not.toContain('dagger');
    expect(opts).toContain('buckler');
  });
});

describe('gearStatLine', () => {
  it("shows Spiked Maul's capacity bite alongside its WP", () => {
    const line = gearStatLine(cat.getItem(itemId('spiked_maul')) as never);
    expect(line).toContain('WP 20');
    expect(line).toContain('-3 reaction');
  });
});
