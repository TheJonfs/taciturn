// Draft-legality resolver — behavior pins + the D3 drift alarm.
//
// The drift alarm is the load-bearing part: the state-free draft
// functions must agree with the hook-based engine (`getCapacity` /
// `getCost`) for status-free units, because the pre-battle UIs enforce
// legality through the draft side while `createInitialState` /
// `validateLoadout` enforce it through the hook side. If a
// non-equipment `modifyBucketCapacity` contributor (class trait,
// status-at-placement) ever ships, the exhaustive agreement sweep here
// fails loud and `draftBucketCapacity` must learn the new rule before
// the UIs can trust it again.

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '../../content/index.ts';
import { makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { getCapacity } from '../abilities/capacity.ts';
import { getCost } from '../abilities/cost.ts';
import { isEquipment } from './equipment.ts';
import {
  ALL_BUCKET_IDS,
  draftAbilityCost,
  draftBucketCapacity,
  validateDraftUnit,
  type DraftUnitView,
} from './draft-legality.ts';
import {
  EMPTY_LOADOUT,
  EMPTY_UNIT_EQUIPMENT,
  abilityId,
  bucketId,
  classId,
  itemId,
  rulesetId,
  unitId,
  type EquipmentSlotId,
  type UnitEquipment,
} from '../types/index.ts';

const cat = loadDefaultCatalog();
const DEFAULT = rulesetId('default');

const holding = (id: string, slot: EquipmentSlotId = 'rightHand'): UnitEquipment => ({
  ...EMPTY_UNIT_EQUIPMENT,
  [slot]: itemId(id),
});

// The slot an item of this kind naturally occupies (for the sweep).
function slotForKind(kind: string): EquipmentSlotId {
  switch (kind) {
    case 'weapon':
    case 'shield':
      return 'rightHand';
    case 'headgear':
      return 'headgear';
    case 'armor':
      return 'armor';
    default:
      return 'accessory';
  }
}

describe('drift alarm — draft resolver vs hook-based engine (D3)', () => {
  it('draftBucketCapacity agrees with getCapacity for EVERY catalog equipment item', () => {
    for (const item of cat.items()) {
      if (!isEquipment(item)) continue;
      const equipment = holding(String(item.id), slotForKind(item.kind));
      const unit = makeUnit({ id: 'u', spd: 10, equipment });
      const state = makeGameState({ units: [unit] });
      for (const bucket of ALL_BUCKET_IDS) {
        const draft = draftBucketCapacity(equipment, bucket, cat, DEFAULT);
        const engine = getCapacity(state, unitId('u'), bucket, cat);
        expect(draft, `${String(item.id)} / ${String(bucket)}`).toBe(engine);
      }
    }
  });

  it('draftBucketCapacity agrees with getCapacity for the bare-equipment baseline', () => {
    const unit = makeUnit({ id: 'u', spd: 10 });
    const state = makeGameState({ units: [unit] });
    for (const bucket of ALL_BUCKET_IDS) {
      expect(draftBucketCapacity(EMPTY_UNIT_EQUIPMENT, bucket, cat, DEFAULT)).toBe(
        getCapacity(state, unitId('u'), bucket, cat),
      );
    }
  });

  it('draftAbilityCost agrees with getCost for EVERY ability, innate and imported', () => {
    for (const cls of ['knight', 'earth_mage']) {
      const unit = makeUnit({ id: 'u', spd: 10, classId: cls });
      const state = makeGameState({ units: [unit] });
      for (const ability of cat.abilities()) {
        const draft = draftAbilityCost(classId(cls), ability.id, cat);
        const engine = getCost(state, unitId('u'), ability.id, cat);
        expect(draft, `${cls} / ${String(ability.id)}`).toBe(engine);
      }
    }
  });
});

describe('validateDraftUnit — composite report', () => {
  const knightView = (equipment: UnitEquipment, reactions: ReadonlyArray<string> = []): DraftUnitView => ({
    classId: classId('knight'),
    loadout: {
      ...EMPTY_LOADOUT,
      passiveBuckets: { [bucketId('reaction')]: reactions.map((r) => abilityId(r)) },
    },
    equipment,
  });

  it('a plain armed knight is valid', () => {
    const report = validateDraftUnit(knightView(holding('long_sword')), cat, DEFAULT);
    expect(report.valid).toBe(true);
    expect(report.invalidSlots).toEqual([]);
    expect(report.bucketOverages).toEqual([]);
  });

  it('Spiked Maul (reaction capacity 0) + an IMPORTED reaction → over-capacity', () => {
    const report = validateDraftUnit(
      knightView(holding('spiked_maul'), ['cornered_focus']),
      cat,
      DEFAULT,
    );
    expect(report.valid).toBe(false);
    expect(report.bucketOverages).toEqual([
      { bucketId: bucketId('reaction'), used: 1, capacity: 0 },
    ]);
  });

  it('Spiked Maul + the class-INNATE reaction stays valid (innate costs 0)', () => {
    const report = validateDraftUnit(knightView(holding('spiked_maul'), ['counter']), cat, DEFAULT);
    expect(report.valid).toBe(true);
    expect(report.bucketOverages).toEqual([]);
  });

  it("Freelancer's Charm + a class-restricted body → equipLegality conflict", () => {
    const report = validateDraftUnit(
      knightView({
        ...EMPTY_UNIT_EQUIPMENT,
        accessory: itemId('freelancers_charm'),
        armor: itemId('war_plate'),
      }),
      cat,
      DEFAULT,
    );
    expect(report.valid).toBe(false);
    expect(report.equipLegalityConflicts).toEqual([
      {
        wornSlot: 'accessory',
        wornItemId: itemId('freelancers_charm'),
        forbiddenSlot: 'armor',
        otherItemId: itemId('war_plate'),
      },
    ]);
  });

  it('a two-hander + off-hand item conflicts; Monkeygrip relaxes it', () => {
    const equipment: UnitEquipment = {
      ...EMPTY_UNIT_EQUIPMENT,
      rightHand: itemId('absolom'),
      leftHand: itemId('buckler'),
    };
    const bare = validateDraftUnit(knightView(equipment), cat, DEFAULT);
    expect(bare.valid).toBe(false);
    expect(bare.twoHandedConflictHands).toEqual(['rightHand']);

    const withGrip: DraftUnitView = {
      classId: classId('knight'),
      loadout: {
        ...EMPTY_LOADOUT,
        passiveBuckets: { [bucketId('support')]: [abilityId('monkeygrip')] },
      },
      equipment,
    };
    const relaxed = validateDraftUnit(withGrip, cat, DEFAULT);
    expect(relaxed.twoHandedConflictHands).toEqual([]);
    expect(relaxed.valid).toBe(true);
  });

  it('two weapons without a dual-wield grant → dualWielding (UI-tier rule)', () => {
    const report = validateDraftUnit(
      knightView({
        ...EMPTY_UNIT_EQUIPMENT,
        rightHand: itemId('long_sword'),
        leftHand: itemId('dagger'),
      }),
      cat,
      DEFAULT,
    );
    expect(report.dualWielding).toBe(true);
    expect(report.valid).toBe(false);
  });

  it('a class-restricted item on the wrong class → invalid slot with reason', () => {
    const report = validateDraftUnit(
      {
        classId: classId('earth_mage'),
        loadout: EMPTY_LOADOUT,
        equipment: holding('war_plate', 'armor'),
      },
      cat,
      DEFAULT,
    );
    expect(report.valid).toBe(false);
    expect(report.invalidSlots).toEqual([
      { slot: 'armor', itemId: itemId('war_plate'), reason: 'class_restricted' },
    ]);
  });

  it('a weapon in the headgear slot → wrong_kind; an unknown id → unknown_item', () => {
    const report = validateDraftUnit(
      knightView({
        ...EMPTY_UNIT_EQUIPMENT,
        headgear: itemId('long_sword'),
        accessory: itemId('no_such_item'),
      }),
      cat,
      DEFAULT,
    );
    expect(report.valid).toBe(false);
    expect(report.invalidSlots).toEqual([
      { slot: 'headgear', itemId: itemId('long_sword'), reason: 'wrong_kind' },
      { slot: 'accessory', itemId: itemId('no_such_item'), reason: 'unknown_item' },
    ]);
  });
});
