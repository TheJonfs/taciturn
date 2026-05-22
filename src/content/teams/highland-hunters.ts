// "Highland Hunters" — Hunter showcase template (Session 45).
//
// Demonstrates the S45 bow kit alongside a classic front-line + control
// spine. The Hunter fights from elevation (its Longbow's height-delta
// variance rewards the high ground) behind a Knight wall, while the two
// mages convert positioning into kills:
//
//   - Faramund (Hunter) — Longbow (two-handed → off-hand empty), full
//     Marksmanship (Pin Down / Charged Attack / Scramble) and native
//     R/S/M (Updraft / Eagle Eye / High Jump). Eagle Eye lifts the bow's
//     bare 33 accuracy to ~66%; Pin Down Slows a priority threat.
//   - Bremondt (Knight) — Long Sword + shield, the front-line tank that
//     screens the Hunter's 2-tile minimum range.
//   - Saphira (Earth Mage) — status pressure (Quake / Curse) to soften
//     and lock targets the Hunter then picks off.
//   - Maelis (Water Mage) — CT control to manipulate turn order in the
//     Hunter's favor.

import { abilityId, bucketId, classId, commandSetId, itemId } from '@engine/index.ts';
import {
  EARTH_MAGE_LOADOUT,
  KNIGHT_LOADOUT,
  WATER_MAGE_LOADOUT,
} from '../battles/demo.ts';
import { buildBaseStats, type BuiltTeam } from './built-team.ts';

const BRAVE = 70;
const FAITH = 70;

// Hunter loadout: Marksmanship on First Action (class-pinned), native
// R/S/M (Updraft / Eagle Eye / High Jump) — all free for the Hunter.
const HUNTER_LOADOUT = {
  actionBuckets: {
    [bucketId('first_action')]: [commandSetId('marksmanship')],
    [bucketId('secondary_command_sets')]: [],
  },
  passiveBuckets: {
    [bucketId('reaction')]: [abilityId('updraft')],
    [bucketId('support')]: [abilityId('eagle_eye')],
    [bucketId('movement')]: [abilityId('high_jump')],
  },
};

export const highlandHunters: BuiltTeam = {
  name: 'Highland Hunters',
  units: [
    {
      name: 'Faramund',
      classId: classId('hunter'),
      baseStats: buildBaseStats(classId('hunter'), BRAVE, FAITH),
      loadout: HUNTER_LOADOUT,
      equipment: {
        // Two-handed bow → off-hand stays empty (slotting enforces it).
        leftHand: null,
        rightHand: itemId('longbow'),
        headgear: itemId('lookouts_hood'),
        armor: itemId('travel_garb'),
        accessory: itemId('lightfoot'),
      },
    },
    {
      name: 'Bremondt',
      classId: classId('knight'),
      baseStats: buildBaseStats(classId('knight'), BRAVE, FAITH),
      loadout: KNIGHT_LOADOUT,
      equipment: {
        leftHand: itemId('warriors_aegis'),
        rightHand: itemId('long_sword'),
        headgear: itemId('crusaders_helm'),
        armor: itemId('war_plate'),
        accessory: itemId('tintinibar'),
      },
    },
    {
      name: 'Saphira',
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
    {
      name: 'Maelis',
      classId: classId('water_mage'),
      baseStats: buildBaseStats(classId('water_mage'), BRAVE, FAITH),
      loadout: WATER_MAGE_LOADOUT,
      equipment: {
        leftHand: null,
        rightHand: itemId('wand_of_depths'),
        headgear: itemId('pointy_hat'),
        armor: itemId('light_robe'),
        accessory: itemId('arcane_lens'),
      },
    },
  ],
};
