// High Ground — second S48-authored default template (Chris).
//
// 5-unit composition that exercises the S48 5v5 unlock. Both maps
// (River Ridge / Stonebridge) have authored 5 player-side slots; this
// is the first template that uses all of them.
//
// Concept (per Chris's authoring):
//   - Hunter "Ajax" with the Riptide Bow + The Offering — the bow
//     class gets the +per-weapon-swing accessory's single-weapon
//     payoff, plus a Hunter-native R/S/M kit (Updraft / Eagle Eye /
//     High Jump). Focus Band defuses incoming status pressure, Battle
//     Gear is the lightweight default armor.
//   - Alchemist "Tina" with a Longbow (cross-class bow use — Hunter
//     doesn't monopolize the bow class) + The Offering's sibling
//     accessory, Augmentor (+1 Support-bucket capacity), to fit Field
//     Kit / Martial Expertise / Eagle Eye on a Support-stacked
//     toolkit-medic. Travel Garb + Lookout's Hood.
//   - Aethurge "Eldred" with Staff of Power (× 1.20 MP cost / MA buff
//     trade) + Ironfoot for the Movement-bucket headroom (4 passives
//     fit: Quickstep + Fleet of Foot + Tidewalker + Hotfoot). Wizard's
//     Robe + Pointy Hat. Fire Spells as the secondary command set.
//   - Geosage "Samuel" with Magus Crown's +1 secondary-command-set
//     capacity unlocking *two* secondary sets (Lightning Spells +
//     Water Spells) — control plus a long-charge sustain back-up.
//     Wand of the Deepwood + Sorcerer's Robe + Mantle of Protection
//     for the elemental-resist + per-facing evasion package.
//   - Knight "Cecil" with Bolt Hammer + Managuard (weapon + shield —
//     no dual-wield, so basic Attack stays single-swing but the
//     Managuard's +2 MA hybrid shield buys some magic resistance).
//     Crusader's Helm + Silvered Vest + Diamond Bracelet. Field Kit
//     as a cross-class Support pickup.

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
          [bucketId('secondary_command_sets')]: [commandSetId('battle_skill')],
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
            abilityId('field_recovery'),
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
            abilityId('bravestrider'),
            abilityId('high_jump'),
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
            abilityId('fleet_of_foot'),
            abilityId('tidewalker'),
            abilityId('hotfoot'),
          ],
        },
      },
      equipment: {
        leftHand: itemId('staff_of_power'),
        rightHand: null,
        headgear: itemId('pointy_hat'),
        armor: itemId('wizards_robe'),
        accessory: itemId('ironfoot'),
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
          // Magus Crown's +1 secondary-command-set capacity unlocks two
          // secondary sets on this slot. Lightning is the primary
          // cross-school pick; Water Spells is the long-charge sustain
          // back-up.
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
            abilityId('quickstep'),
          ],
        },
      },
      equipment: {
        leftHand: null,
        rightHand: itemId('wand_of_deepwood'),
        headgear: itemId('magus_crown'),
        armor: itemId('sorcerers_robe'),
        accessory: itemId('mantle_of_protection'),
      },
    },
    {
      name: 'Cecil',
      classId: classId('knight'),
      baseStats: buildBaseStats(classId('knight'), BRAVE, FAITH, 27),
      level: 27,
      loadout: {
        actionBuckets: {
          [bucketId('first_action')]: [commandSetId('battle_skill')],
          [bucketId('secondary_command_sets')]: [commandSetId('alchemy')],
        },
        passiveBuckets: {
          [bucketId('reaction')]: [
            abilityId('counter'),
            abilityId('discharge'),
            abilityId('combat_focus'),
          ],
          [bucketId('support')]: [
            abilityId('martial_expertise'),
            abilityId('field_kit'),
            abilityId('eagle_eye'),
          ],
          [bucketId('movement')]: [
            abilityId('bravestrider'),
            abilityId('field_recovery'),
            abilityId('tidewalker'),
            abilityId('quickstep'),
          ],
        },
      },
      equipment: {
        leftHand: itemId('bolt_hammer'),
        rightHand: itemId('managuard'),
        headgear: itemId('crusaders_helm'),
        armor: itemId('silvered_vest'),
        accessory: itemId('diamond_bracelet'),
      },
    },
  ],
};
