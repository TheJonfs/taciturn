// "Shadow and Steel" — Assassin showcase template (Session 42).
//
// Full-toolkit demo of the S42 content: the Assassin's control /
// permadebuff kit alongside the modern Knight (Lightning Stab +
// Bravestrider), the Alchemist's sustain, and an Earth Mage's control +
// damage. Pairs the Assassin's debuffs with mage burst — Sow Doubt softens
// a target the Earth Mage then finishes, while Shadow Stitch / Undermine
// lock down and weaken priority threats.
//
//   - Lysha (Assassin) — dual knives (Sai + Magebane) exercise Two
//     Weapons multi-swing; the off-hand Magebane procs Silence on its
//     own swing. Shadow Arts for the ranged debuff kit.
//   - Aldric (Knight) — modern S41/S42 kit: Martial Expertise + Bravestrider
//     + Lightning Stab (the Bravestrider Brave bump lifts the Silence rate).
//   - Corvin (Alchemist) — Compound / Throw Item sustain.
//   - Senna (Earth Mage) — control + damage to convert the Assassin's
//     debuffs into kills.

import { abilityId, bucketId, classId, commandSetId, itemId } from '@engine/index.ts';
import {
  ALCHEMIST_LOADOUT,
  EARTH_MAGE_LOADOUT,
} from '../battles/demo.ts';
import { buildBaseStats, type BuiltTeam } from './built-team.ts';

const BRAVE = 70;
const FAITH = 70;

// Assassin loadout: Shadow Arts on First Action (class-pinned), native
// R/S/M (Speed Save / Two Weapons / Fleet of Foot). Two Weapons + a
// weapon in both hands is what unlocks the multi-swing.
const ASSASSIN_LOADOUT = {
  actionBuckets: {
    [bucketId('first_action')]: [commandSetId('shadow_arts')],
    [bucketId('secondary_command_sets')]: [],
  },
  passiveBuckets: {
    [bucketId('reaction')]: [abilityId('speed_save')],
    [bucketId('support')]: [abilityId('two_weapons')],
    [bucketId('movement')]: [abilityId('fleet_of_foot')],
  },
};

// Modern Knight loadout (post-S41/S42): Battle Skill (now carrying
// Lightning Stab), Counter, Martial Expertise, Bravestrider — the kit
// the Lightning Stab + Bravestrider synergy is tuned around.
const MODERN_KNIGHT_LOADOUT = {
  actionBuckets: {
    [bucketId('first_action')]: [commandSetId('battle_skill')],
    [bucketId('secondary_command_sets')]: [],
  },
  passiveBuckets: {
    [bucketId('reaction')]: [abilityId('counter')],
    [bucketId('support')]: [abilityId('martial_expertise')],
    [bucketId('movement')]: [abilityId('bravestrider')],
  },
};

export const shadowAndSteel: BuiltTeam = {
  name: 'Shadow and Steel',
  units: [
    {
      name: 'Lysha',
      classId: classId('assassin'),
      baseStats: buildBaseStats(classId('assassin'), BRAVE, FAITH),
      loadout: ASSASSIN_LOADOUT,
      equipment: {
        // Two knives → Two Weapons swings both. Magebane in the off-hand
        // procs Silence on its own swing (per-swing proc scoping).
        leftHand: itemId('magebane'),
        rightHand: itemId('sai'),
        // Distinct head/armor from Corvin (unique-per-team rule).
        headgear: itemId('focus_band'),
        armor: itemId('travel_garb'),
        accessory: itemId('lightfoot'),
      },
    },
    {
      name: 'Aldric',
      classId: classId('knight'),
      baseStats: buildBaseStats(classId('knight'), BRAVE, FAITH),
      loadout: MODERN_KNIGHT_LOADOUT,
      equipment: {
        leftHand: itemId('warriors_aegis'),
        rightHand: itemId('long_sword'),
        headgear: itemId('crusaders_helm'),
        armor: itemId('war_plate'),
        accessory: itemId('tintinibar'),
      },
    },
    {
      name: 'Corvin',
      classId: classId('alchemist'),
      baseStats: buildBaseStats(classId('alchemist'), BRAVE, FAITH),
      loadout: ALCHEMIST_LOADOUT,
      equipment: {
        leftHand: null,
        rightHand: itemId('war_axe'),
        headgear: itemId('lookouts_hood'),
        armor: itemId('battle_gear'),
        accessory: itemId('diamond_bracelet'),
      },
    },
    {
      name: 'Senna',
      classId: classId('earth_mage'),
      baseStats: buildBaseStats(classId('earth_mage'), BRAVE, FAITH),
      loadout: EARTH_MAGE_LOADOUT,
      equipment: {
        leftHand: null,
        rightHand: itemId('wand_of_deepwood'),
        headgear: itemId('magus_crown'),
        armor: itemId('sorcerers_robe'),
        accessory: itemId('capacitor_ring'),
      },
    },
  ],
};
