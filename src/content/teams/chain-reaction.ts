// Chain Reaction — Chris-authored default template (team-builder Pass 2
// follow-up). A control-and-chain comp: three Conductors plus Discharge
// and Smolder thread an elemental-reaction theme through a battlefield-
// control shell (Calculator's global parameters, Terraformer's Worldcraft,
// a Hunter working elevation).
//
// 5-unit composition under the variable-length BuiltTeam shape. Slot
// levels follow the alternating-outward pattern (25 / 24 / 26 / 23 / 27)
// for slots 0–4; per-unit `level` matches its slot.
//
// Authored from Chris's team-builder JSON export; unit names and bucket
// orders are reproduced verbatim (the team builder respects authored
// names on template load, S38). Two off-hand pairings ride Monkeygrip:
// Oliver's Defender beside the two-handed Lance, and Erica's Buckler
// beside the two-handed Riptide Bow.

import {
  abilityId,
  bucketId,
  classId,
  commandSetId,
  itemId,
} from '@engine/index.ts';
import { buildBaseStats, type BuiltTeam } from './built-team.ts';

const BRAVE = 70;
const FAITH = 70;

export const chainReaction: BuiltTeam = {
  name: 'Chain Reaction',
  units: [
    {
      name: 'Oliver',
      classId: classId('assassin'),
      baseStats: buildBaseStats(classId('assassin'), BRAVE, FAITH, 25),
      level: 25,
      gender: 'male',
      loadout: {
        actionBuckets: {
          [bucketId('first_action')]: [commandSetId('shadow_arts')],
          [bucketId('secondary_command_sets')]: [commandSetId('templar_arts')],
        },
        passiveBuckets: {
          [bucketId('reaction')]: [
            abilityId('speed_save'),
            abilityId('counter'),
            abilityId('damage_split'),
          ],
          [bucketId('support')]: [
            abilityId('two_weapons'),
            abilityId('monkeygrip'),
            abilityId('martial_expertise'),
          ],
          [bucketId('movement')]: [
            abilityId('fleet_of_foot'),
            abilityId('hotfoot'),
            abilityId('thoughtful_pacing'),
          ],
        },
      },
      equipment: {
        leftHand: itemId('defender'),
        rightHand: itemId('lance'),
        headgear: itemId('skullclamp'),
        armor: itemId('battle_gear'),
        accessory: itemId('augmentor'),
      },
    },
    {
      name: 'Alfredo',
      classId: classId('calculator'),
      baseStats: buildBaseStats(classId('calculator'), BRAVE, FAITH, 24),
      level: 24,
      gender: 'male',
      loadout: {
        actionBuckets: {
          [bucketId('first_action')]: [commandSetId('math_skill')],
          [bucketId('secondary_command_sets')]: [commandSetId('earth_spells')],
        },
        passiveBuckets: {
          [bucketId('reaction')]: [
            abilityId('cornered_focus'),
            abilityId('smolder'),
            abilityId('tidal_pull'),
          ],
          [bucketId('support')]: [
            abilityId('mathematician'),
            abilityId('conductor'),
            abilityId('earth_communion'),
          ],
          [bucketId('movement')]: [
            abilityId('thoughtful_pacing'),
            abilityId('faithstrider'),
            abilityId('fleet_of_foot'),
            abilityId('quickstep'),
          ],
        },
      },
      equipment: {
        leftHand: itemId('tome_of_power'),
        rightHand: itemId('staff_of_abundance'),
        headgear: itemId('lookouts_hood'),
        armor: itemId('silvered_vest'),
        accessory: itemId('ironfoot'),
      },
    },
    {
      name: 'Erica',
      classId: classId('hunter'),
      baseStats: buildBaseStats(classId('hunter'), BRAVE, FAITH, 26),
      level: 26,
      gender: 'female',
      loadout: {
        actionBuckets: {
          [bucketId('first_action')]: [commandSetId('marksmanship')],
          [bucketId('secondary_command_sets')]: [commandSetId('worldcraft')],
        },
        passiveBuckets: {
          [bucketId('reaction')]: [
            abilityId('updraft'),
            abilityId('counter'),
            abilityId('combat_focus'),
            abilityId('speed_save'),
          ],
          [bucketId('support')]: [
            abilityId('eagle_eye'),
            abilityId('monkeygrip'),
            abilityId('expert_former'),
          ],
          [bucketId('movement')]: [
            abilityId('high_jump'),
            abilityId('bravestrider'),
            abilityId('fleet_of_foot'),
          ],
        },
      },
      equipment: {
        leftHand: itemId('buckler'),
        rightHand: itemId('riptide_bow'),
        headgear: itemId('guard_cap'),
        armor: itemId('soul_vest'),
        accessory: itemId('the_offering'),
      },
    },
    {
      name: 'Alessi',
      classId: classId('terraformer'),
      baseStats: buildBaseStats(classId('terraformer'), BRAVE, FAITH, 23),
      level: 23,
      gender: 'female',
      loadout: {
        actionBuckets: {
          [bucketId('first_action')]: [commandSetId('worldcraft')],
          [bucketId('secondary_command_sets')]: [commandSetId('templar_arts')],
        },
        passiveBuckets: {
          [bucketId('reaction')]: [
            abilityId('damage_split'),
            abilityId('counter'),
            abilityId('combat_focus'),
            abilityId('cornered_focus'),
          ],
          [bucketId('support')]: [
            abilityId('expert_former'),
            abilityId('conductor'),
            abilityId('emissary'),
          ],
          [bucketId('movement')]: [
            abilityId('ignore_height'),
            abilityId('bravestrider'),
            abilityId('fleet_of_foot'),
          ],
        },
      },
      equipment: {
        leftHand: null,
        rightHand: itemId('imp_halberd'),
        headgear: itemId('golden_hairpin'),
        armor: itemId('sorcerers_robe'),
        accessory: itemId('diamond_bracelet'),
      },
    },
    {
      name: 'Helia',
      classId: classId('lightning_mage'),
      baseStats: buildBaseStats(classId('lightning_mage'), BRAVE, FAITH, 27),
      level: 27,
      gender: 'female',
      loadout: {
        actionBuckets: {
          [bucketId('first_action')]: [commandSetId('lightning_spells')],
          [bucketId('secondary_command_sets')]: [commandSetId('fire_spells')],
        },
        passiveBuckets: {
          [bucketId('reaction')]: [
            abilityId('discharge'),
            abilityId('cornered_focus'),
            abilityId('smolder'),
          ],
          [bucketId('support')]: [
            abilityId('conductor'),
            abilityId('aether_bloom'),
            abilityId('flow_state'),
          ],
          [bucketId('movement')]: [
            abilityId('quickstep'),
            abilityId('faithstrider'),
            abilityId('thoughtful_pacing'),
          ],
        },
      },
      equipment: {
        leftHand: itemId('livre_of_urgency'),
        rightHand: itemId('staff_of_power'),
        headgear: itemId('pointy_hat'),
        armor: itemId('wizards_robe'),
        accessory: itemId('boots_of_haste'),
      },
    },
  ],
};
