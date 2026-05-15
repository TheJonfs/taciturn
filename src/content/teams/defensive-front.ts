// "Defensive Front" — attrition / sustain template (Session 38).
//
// Knight wall in front with cross-class Earth Magic (Earth's Blessing
// applies Regen) — the placeholder for healing until White Mage lands
// in a future content session. Mages behind with defensive equipment
// bias: Sorcerer's Robe generalist on Earth, Dark Robe specialist on
// Water (Earth + Water resist), Light Robe specialist on Fire
// (Fire + Lightning resist).
//
// Knight + Earth Spells + Crusader's Helm Faith bump exercises the
// hybrid-caster Knight design discussed in S37 (Crusader's Helm
// rationale). The Water Mage carries Earth Spells as a second Regen
// source via Magus Crown's +1 secondary command set capacity.
//
// **Caveat per S38 plan-review (Chris):** Earth's Blessing applies
// Regen, the closest substitute for healing in v1 since White Magic
// is suppressed in the picker. A real White-Mage class is high
// priority for the next big content expansion; this template is the
// best the current ruleset allows for a defensive theme.

import { classId, commandSetId, itemId } from '@engine/index.ts';
import {
  EARTH_MAGE_LOADOUT,
  FIRE_MAGE_LOADOUT,
  KNIGHT_LOADOUT,
  WATER_MAGE_LOADOUT,
} from '../battles/demo.ts';
import { buildBaseStats, type BuiltTeam } from './built-team.ts';

const BRAVE = 70;
const FAITH = 70;

// Knight default secondary command set capacity is 1 (ruleset baseline);
// Earth Spells fits in the slot without any capacity-bumping equipment.
const DEFENSIVE_KNIGHT_LOADOUT = {
  ...KNIGHT_LOADOUT,
  actionBuckets: {
    ...KNIGHT_LOADOUT.actionBuckets,
    secondary_command_sets: [commandSetId('earth_spells')],
  },
};

// Water Mage uses Magus Crown's +1 capacity to add `earth_spells` as
// a second Regen source.
const DEFENSIVE_WATER_LOADOUT = {
  ...WATER_MAGE_LOADOUT,
  actionBuckets: {
    ...WATER_MAGE_LOADOUT.actionBuckets,
    secondary_command_sets: [commandSetId('earth_spells')],
  },
};

export const defensiveFront: BuiltTeam = {
  name: 'Defensive Front',
  units: [
    {
      name: 'Halric',
      classId: classId('knight'),
      baseStats: buildBaseStats(classId('knight'), BRAVE, FAITH),
      loadout: DEFENSIVE_KNIGHT_LOADOUT,
      equipment: {
        leftHand: itemId('warriors_aegis'),
        rightHand: itemId('long_sword'),
        headgear: itemId('crusaders_helm'),
        armor: itemId('war_plate'),
        accessory: itemId('tintinibar'),
      },
    },
    {
      name: 'Talia',
      classId: classId('earth_mage'),
      baseStats: buildBaseStats(classId('earth_mage'), BRAVE, FAITH),
      loadout: EARTH_MAGE_LOADOUT,
      equipment: {
        leftHand: null,
        rightHand: itemId('wand_of_deepwood'),
        headgear: itemId('pointy_hat'),
        armor: itemId('sorcerers_robe'),
        accessory: itemId('diamond_bracelet'),
      },
    },
    {
      name: 'Ysolde',
      classId: classId('water_mage'),
      baseStats: buildBaseStats(classId('water_mage'), BRAVE, FAITH),
      loadout: DEFENSIVE_WATER_LOADOUT,
      equipment: {
        leftHand: null,
        rightHand: itemId('wand_of_depths'),
        headgear: itemId('magus_crown'),
        armor: itemId('dark_robe'),
        accessory: itemId('lightfoot'),
      },
    },
    {
      name: 'Auralia',
      classId: classId('fire_mage'),
      baseStats: buildBaseStats(classId('fire_mage'), BRAVE, FAITH),
      loadout: FIRE_MAGE_LOADOUT,
      equipment: {
        leftHand: null,
        rightHand: itemId('staff_of_abundance'),
        headgear: itemId('tricorn'),
        armor: itemId('light_robe'),
        accessory: itemId('augmentor'),
      },
    },
  ],
};
