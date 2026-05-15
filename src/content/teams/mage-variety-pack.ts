// "Mage Variety Pack" — element wheel showcase (Session 38).
//
// Replaces the Session 36 `pure-mage-team` placeholder. One Mage per
// element, each leaning into a different identity axis: Earth as
// generalist with control duo, Water as specialist defender, Fire as
// glass cannon, Lightning as hybrid-physical specialist. Showcases the
// Light vs. Dark vs. Sorcerer's Robe decision matrix and the four
// elemental kits side-by-side.

import { classId, commandSetId, itemId } from '@engine/index.ts';
import {
  EARTH_MAGE_LOADOUT,
  FIRE_MAGE_LOADOUT,
  LIGHTNING_MAGE_LOADOUT,
  WATER_MAGE_LOADOUT,
} from '../battles/demo.ts';
import { buildBaseStats, type BuiltTeam } from './built-team.ts';

const BRAVE = 70;
const FAITH = 70;

// Earth Mage with Magus Crown carries `water_spells` as the secondary
// — Earth + Water is a classic control + sustain duo (root + drain),
// the duo the template is designed to showcase.
const VARIETY_EARTH_LOADOUT = {
  ...EARTH_MAGE_LOADOUT,
  actionBuckets: {
    ...EARTH_MAGE_LOADOUT.actionBuckets,
    secondary_command_sets: [commandSetId('water_spells')],
  },
};

export const mageVarietyPack: BuiltTeam = {
  name: 'Mage Variety Pack',
  units: [
    {
      name: 'Maerwynn',
      classId: classId('earth_mage'),
      baseStats: buildBaseStats(classId('earth_mage'), BRAVE, FAITH),
      loadout: VARIETY_EARTH_LOADOUT,
      equipment: {
        leftHand: null,
        rightHand: itemId('wand_of_deepwood'),
        headgear: itemId('magus_crown'),
        armor: itemId('sorcerers_robe'),
        accessory: itemId('capacitor_ring'),
      },
    },
    {
      name: 'Mireille',
      classId: classId('water_mage'),
      baseStats: buildBaseStats(classId('water_mage'), BRAVE, FAITH),
      loadout: WATER_MAGE_LOADOUT,
      equipment: {
        leftHand: null,
        rightHand: itemId('wand_of_depths'),
        headgear: itemId('pointy_hat'),
        armor: itemId('dark_robe'),
        accessory: itemId('lightfoot'),
      },
    },
    {
      name: 'Calista',
      classId: classId('fire_mage'),
      baseStats: buildBaseStats(classId('fire_mage'), BRAVE, FAITH),
      loadout: FIRE_MAGE_LOADOUT,
      equipment: {
        leftHand: null,
        rightHand: itemId('flametongue'),
        headgear: itemId('tricorn'),
        armor: itemId('wizards_robe'),
        accessory: itemId('augmentor'),
      },
    },
    {
      name: 'Liorel',
      classId: classId('lightning_mage'),
      baseStats: buildBaseStats(classId('lightning_mage'), BRAVE, FAITH),
      loadout: LIGHTNING_MAGE_LOADOUT,
      equipment: {
        leftHand: null,
        rightHand: itemId('staff_of_power'),
        headgear: itemId('lookouts_hood'),
        armor: itemId('light_robe'),
        accessory: itemId('diamond_bracelet'),
      },
    },
  ],
};
