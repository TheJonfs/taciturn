// "Pure Mage Team" — one mage of each element, no Knight anchor.
//
// A team builder template showcasing the elemental matrix without a
// melee front-line. Earth / Water / Fire / Lightning, each on its
// class-default loadout (reused from `demo.ts`), with diversified
// equipment chosen for unique-per-team compliance.
//
// Note (Session 36 handoff item): the four-mage case consumes *every*
// mage-eligible headgear and armor item in the current catalog — there
// are exactly four of each once hidden items are excluded. The head and
// armor slots here are effectively forced, not chosen. A future content
// session should widen the mage equipment pool so a pure-mage team has
// real slot choices.

import { classId, itemId } from '@engine/index.ts';
import {
  EARTH_MAGE_LOADOUT,
  FIRE_MAGE_LOADOUT,
  LIGHTNING_MAGE_LOADOUT,
  WATER_MAGE_LOADOUT,
} from '../battles/demo.ts';
import { buildBaseStats, type BuiltTeam } from './built-team.ts';

const BRAVE = 70;
const FAITH = 70;

export const pureMageTeam: BuiltTeam = {
  name: 'Pure Mage Team',
  units: [
    {
      name: 'Earth Mage',
      classId: classId('earth_mage'),
      baseStats: buildBaseStats(classId('earth_mage'), BRAVE, FAITH),
      loadout: EARTH_MAGE_LOADOUT,
      equipment: {
        leftHand: null,
        rightHand: itemId('wand_of_deepwood'),
        headgear: itemId('pointy_hat'),
        armor: itemId('wizards_robe'),
        accessory: itemId('capacitor_ring'),
      },
    },
    {
      name: 'Water Mage',
      classId: classId('water_mage'),
      baseStats: buildBaseStats(classId('water_mage'), BRAVE, FAITH),
      loadout: WATER_MAGE_LOADOUT,
      equipment: {
        leftHand: null,
        rightHand: itemId('wand_of_depths'),
        headgear: itemId('magus_crown'),
        armor: itemId('sorcerers_robe'),
        accessory: itemId('lightfoot'),
      },
    },
    {
      name: 'Fire Mage',
      classId: classId('fire_mage'),
      baseStats: buildBaseStats(classId('fire_mage'), BRAVE, FAITH),
      loadout: FIRE_MAGE_LOADOUT,
      equipment: {
        leftHand: null,
        rightHand: itemId('staff_of_abundance'),
        headgear: itemId('guard_cap'),
        armor: itemId('battle_gear'),
        accessory: itemId('augmentor'),
      },
    },
    {
      name: 'Lightning Mage',
      classId: classId('lightning_mage'),
      baseStats: buildBaseStats(classId('lightning_mage'), BRAVE, FAITH),
      loadout: LIGHTNING_MAGE_LOADOUT,
      equipment: {
        leftHand: null,
        rightHand: itemId('staff_of_power'),
        headgear: itemId('focus_band'),
        armor: itemId('silvered_vest'),
        accessory: itemId('diamond_bracelet'),
      },
    },
  ],
};
