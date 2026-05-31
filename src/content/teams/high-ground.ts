// High Ground — second S48-authored default template (Chris); S51 refresh added
// the off-hand books/talismans; S55 revision (this pass) reworks the roster per
// Chris's playtest authoring — notably Cecil is now a Terraformer (was a
// Knight), making this the first default template to field the 10th class.
//
// 5-unit composition that exercises the S48 5v5 unlock. Both maps
// (River Ridge / Stonebridge) have authored 5 player-side slots.
//
// Concept (per Chris's authoring; S55 deltas noted):
//   - Hunter "Ajax" — Riptide Bow + The Offering, Hunter-native kit (Updraft /
//     Eagle Eye / High Jump). Worldcraft secondary (S55 — terrain control off
//     the bow line). Focus Band + Battle Gear.
//   - Alchemist "Tina" — cross-class Longbow + Augmentor (+1 Support capacity)
//     to fit Field Kit / Martial Expertise / Eagle Eye. Shadow Arts secondary
//     (S55). Lookout's Hood + Travel Garb.
//   - Aethurge "Eldred" — Staff of Power + Tome of Power (raw-MA spike), Pointy
//     Hat + Wizard's Robe + Boots of Haste (S55 accessory). Fire Spells
//     secondary.
//   - Geosage "Samuel" — Magus Crown's +1 secondary-command-set capacity
//     unlocks *two* secondary sets (Lightning Spells + Water Spells). Wand of
//     the Deepwood + Sorcerer's Robe + Mantle of Protection + Talisman of
//     Warding.
//   - Terraformer "Cecil" (S55 — replaces the Knight) — native Worldcraft with
//     Alchemy secondary; the full native R/S/M kit (Damage Split / Expert
//     Former / Ignore Height) plus cross-class picks. Chef's Knife + Battle
//     Dictionary (the Book's +1 PA feeds Barrier HP) + Skullclamp + Silvered
//     Vest + Diamond Bracelet.
//
// Authored unit names are personal picks; the team builder respects authored
// values on template load (S38 naming convention).

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

export const highGround: BuiltTeam = {
  name: 'High Ground',
  units: [
    {
      name: 'Ajax',
      classId: classId('hunter'),
      baseStats: buildBaseStats(classId('hunter'), BRAVE, FAITH, 25),
      level: 25,
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
            abilityId('martial_expertise'),
            abilityId('earth_communion'),
          ],
          [bucketId('movement')]: [
            abilityId('high_jump'),
            abilityId('bravestrider'),
            abilityId('fleet_of_foot'),
          ],
        },
      },
      equipment: {
        leftHand: itemId('riptide_bow'),
        rightHand: null,
        headgear: itemId('focus_band'),
        armor: itemId('battle_gear'),
        accessory: itemId('the_offering'),
      },
    },
    {
      name: 'Tina',
      classId: classId('alchemist'),
      baseStats: buildBaseStats(classId('alchemist'), BRAVE, FAITH, 24),
      level: 24,
      loadout: {
        actionBuckets: {
          [bucketId('first_action')]: [commandSetId('alchemy')],
          [bucketId('secondary_command_sets')]: [commandSetId('shadow_arts')],
        },
        passiveBuckets: {
          [bucketId('reaction')]: [
            abilityId('combat_focus'),
            abilityId('counter'),
            abilityId('speed_save'),
            abilityId('earth_resilience'),
          ],
          [bucketId('support')]: [
            abilityId('field_kit'),
            abilityId('martial_expertise'),
            abilityId('eagle_eye'),
          ],
          [bucketId('movement')]: [
            abilityId('field_recovery'),
            abilityId('high_jump'),
            abilityId('fleet_of_foot'),
            abilityId('thoughtful_pacing'),
          ],
        },
      },
      equipment: {
        leftHand: itemId('longbow'),
        rightHand: null,
        headgear: itemId('lookouts_hood'),
        armor: itemId('travel_garb'),
        accessory: itemId('augmentor'),
      },
    },
    {
      name: 'Eldred',
      classId: classId('lightning_mage'),
      baseStats: buildBaseStats(classId('lightning_mage'), BRAVE, FAITH, 26),
      level: 26,
      loadout: {
        actionBuckets: {
          [bucketId('first_action')]: [commandSetId('lightning_spells')],
          [bucketId('secondary_command_sets')]: [commandSetId('fire_spells')],
        },
        passiveBuckets: {
          [bucketId('reaction')]: [
            abilityId('discharge'),
            abilityId('smolder'),
            abilityId('tidal_pull'),
          ],
          [bucketId('support')]: [
            abilityId('conductor'),
            abilityId('aether_bloom'),
            abilityId('flow_state'),
          ],
          [bucketId('movement')]: [
            abilityId('quickstep'),
            abilityId('tidewalker'),
            abilityId('hotfoot'),
          ],
        },
      },
      equipment: {
        leftHand: itemId('staff_of_power'),
        rightHand: itemId('tome_of_power'),
        headgear: itemId('pointy_hat'),
        armor: itemId('wizards_robe'),
        accessory: itemId('boots_of_haste'),
      },
    },
    {
      name: 'Samuel',
      classId: classId('earth_mage'),
      baseStats: buildBaseStats(classId('earth_mage'), BRAVE, FAITH, 23),
      level: 23,
      loadout: {
        actionBuckets: {
          [bucketId('first_action')]: [commandSetId('earth_spells')],
          [bucketId('secondary_command_sets')]: [
            commandSetId('lightning_spells'),
            commandSetId('water_spells'),
          ],
        },
        passiveBuckets: {
          [bucketId('reaction')]: [
            abilityId('earth_resilience'),
            abilityId('smolder'),
            abilityId('tidal_pull'),
          ],
          [bucketId('support')]: [
            abilityId('earth_communion'),
            abilityId('conductor'),
            abilityId('flow_state'),
          ],
          [bucketId('movement')]: [
            abilityId('bedrock_stride'),
            abilityId('field_recovery'),
            abilityId('fleet_of_foot'),
            abilityId('thoughtful_pacing'),
          ],
        },
      },
      equipment: {
        leftHand: itemId('talisman_of_warding'),
        rightHand: itemId('wand_of_deepwood'),
        headgear: itemId('magus_crown'),
        armor: itemId('sorcerers_robe'),
        accessory: itemId('mantle_of_protection'),
      },
    },
    {
      name: 'Cecil',
      classId: classId('terraformer'),
      baseStats: buildBaseStats(classId('terraformer'), BRAVE, FAITH, 27),
      level: 27,
      loadout: {
        actionBuckets: {
          [bucketId('first_action')]: [commandSetId('worldcraft')],
          [bucketId('secondary_command_sets')]: [commandSetId('alchemy')],
        },
        passiveBuckets: {
          [bucketId('reaction')]: [
            abilityId('damage_split'),
            abilityId('combat_focus'),
            abilityId('speed_save'),
            abilityId('counter'),
          ],
          [bucketId('support')]: [
            abilityId('expert_former'),
            abilityId('field_kit'),
            abilityId('martial_expertise'),
          ],
          [bucketId('movement')]: [
            abilityId('ignore_height'),
            abilityId('hotfoot'),
            abilityId('tidewalker'),
          ],
        },
      },
      equipment: {
        leftHand: itemId('chefs_knife'),
        rightHand: itemId('battle_dictionary'),
        headgear: itemId('skullclamp'),
        armor: itemId('silvered_vest'),
        accessory: itemId('diamond_bracelet'),
      },
    },
  ],
};
