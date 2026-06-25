// "Claude's Answers" — an offense-focused team (Session 74).
//
// A planner-chat build, transcribed verbatim from its team-export JSON.
// Conceived by the planner as a deliberate counter to Claude's Bulwark:
// where the Bulwark grinds and sustains, the Answers race to kill before
// the buffs stack — burst, reach, and tempo over attrition.
//
//   - Silas (Hunter) — reach: a Longbow with Eagle Eye (accuracy) + Vantage
//     (high-ground damage), Gauntlet of Might (+PA), Battle Skill secondary.
//     Updraft reaction, High Jump to reach perches.
//   - Hellion (Lightning Mage) — burst: Lightning + Fire secondary, Conductor
//     (MA×1.25) + Aether Bloom (bigger AoEs), Discharge retaliation.
//   - Abel (Knight) — the spearhead: a fast scimitar anvil mirroring the
//     Bulwark's Wynn (Martial Expertise / Momentum / Short Charge), Water
//     Spells secondary.
//   - Crystal (Assassin) — the finisher: Two Weapons dual-wield (Sai +
//     Vicious Dagger), Shadow Arts + Thief Arts, Speed Save + Martial
//     Expertise, Skullclamp for raw stats.
//   - Anastasia (Calculator) — the wildcard: Math Skill + Earth Spells,
//     Mathematician + Conductor + Earth Communion for status/AoE math.
//
// Per-unit levels (25/24/26/23/27) follow the slot-level pattern; all
// Brave/Faith 70. Transcribed as-authored — the planner's intent preserved,
// including any picks that aren't strictly optimal.

import { abilityId, bucketId, classId, commandSetId, itemId } from '@engine/index.ts';
import { buildBaseStats, type BuiltTeam } from './built-team.ts';

const BRAVE = 70;
const FAITH = 70;

export const claudesAnswers: BuiltTeam = {
  name: "Claude's Answers",
  units: [
    {
      name: 'Silas',
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
            abilityId('combat_focus'),
            abilityId('damage_split'),
          ],
          [bucketId('support')]: [
            abilityId('eagle_eye'),
            abilityId('vantage'),
            abilityId('earth_communion'),
            abilityId('martial_expertise'),
          ],
          [bucketId('movement')]: [
            abilityId('high_jump'),
            abilityId('fleet_of_foot'),
            abilityId('hotfoot'),
          ],
        },
      },
      equipment: {
        leftHand: null,
        rightHand: itemId('longbow'),
        headgear: itemId('lookouts_hood'),
        armor: itemId('battle_gear'),
        accessory: itemId('gauntlet_of_might'),
      },
    },
    {
      name: 'Hellion',
      classId: classId('lightning_mage'),
      baseStats: buildBaseStats(classId('lightning_mage'), BRAVE, FAITH, 24),
      level: 24,
      loadout: {
        actionBuckets: {
          [bucketId('first_action')]: [commandSetId('lightning_spells')],
          [bucketId('secondary_command_sets')]: [commandSetId('fire_spells')],
        },
        passiveBuckets: {
          [bucketId('reaction')]: [
            abilityId('discharge'),
            abilityId('cornered_focus'),
            abilityId('damage_split'),
          ],
          [bucketId('support')]: [
            abilityId('conductor'),
            abilityId('aether_bloom'),
            abilityId('earth_communion'),
          ],
          [bucketId('movement')]: [
            abilityId('quickstep'),
            abilityId('move_plus_1'),
            abilityId('hotfoot'),
          ],
        },
      },
      equipment: {
        leftHand: itemId('tome_of_power'),
        rightHand: itemId('staff_of_power'),
        headgear: itemId('pointy_hat'),
        armor: itemId('wizards_robe'),
        accessory: itemId('diamond_bracelet'),
      },
    },
    {
      name: 'Abel',
      classId: classId('knight'),
      baseStats: buildBaseStats(classId('knight'), BRAVE, FAITH, 26),
      level: 26,
      loadout: {
        actionBuckets: {
          [bucketId('first_action')]: [commandSetId('battle_skill')],
          [bucketId('secondary_command_sets')]: [commandSetId('water_spells')],
        },
        passiveBuckets: {
          [bucketId('reaction')]: [
            abilityId('counter'),
            abilityId('combat_focus'),
            abilityId('damage_split'),
          ],
          [bucketId('support')]: [
            abilityId('martial_expertise'),
            abilityId('momentum'),
            abilityId('short_charge'),
            abilityId('earth_communion'),
          ],
          [bucketId('movement')]: [
            abilityId('bravestrider'),
            abilityId('fleet_of_foot'),
            abilityId('hotfoot'),
          ],
        },
      },
      equipment: {
        leftHand: itemId('warriors_aegis'),
        rightHand: itemId('scimitar'),
        headgear: itemId('tactical_mask'),
        armor: itemId('soldiers_leathers'),
        accessory: itemId('lightfoot'),
      },
    },
    {
      name: 'Crystal',
      classId: classId('assassin'),
      baseStats: buildBaseStats(classId('assassin'), BRAVE, FAITH, 23),
      level: 23,
      loadout: {
        actionBuckets: {
          [bucketId('first_action')]: [commandSetId('shadow_arts')],
          [bucketId('secondary_command_sets')]: [commandSetId('thief_arts')],
        },
        passiveBuckets: {
          [bucketId('reaction')]: [
            abilityId('speed_save'),
            abilityId('combat_focus'),
            abilityId('damage_split'),
          ],
          [bucketId('support')]: [
            abilityId('two_weapons'),
            abilityId('martial_expertise'),
            abilityId('earth_communion'),
          ],
          [bucketId('movement')]: [
            abilityId('fleet_of_foot'),
            abilityId('hotfoot'),
            abilityId('move_plus_1'),
          ],
        },
      },
      equipment: {
        leftHand: itemId('sai'),
        rightHand: itemId('vicious_dagger'),
        headgear: itemId('skullclamp'),
        armor: itemId('shimmer_cloak'),
        accessory: itemId('boots_of_haste'),
      },
    },
    {
      name: 'Anastasia',
      classId: classId('calculator'),
      baseStats: buildBaseStats(classId('calculator'), BRAVE, FAITH, 27),
      level: 27,
      loadout: {
        actionBuckets: {
          [bucketId('first_action')]: [commandSetId('math_skill')],
          [bucketId('secondary_command_sets')]: [commandSetId('earth_spells')],
        },
        passiveBuckets: {
          [bucketId('reaction')]: [
            abilityId('cornered_focus'),
            abilityId('damage_split'),
            abilityId('earth_resilience'),
          ],
          [bucketId('support')]: [
            abilityId('mathematician'),
            abilityId('earth_communion'),
            abilityId('conductor'),
          ],
          [bucketId('movement')]: [
            abilityId('thoughtful_pacing'),
            abilityId('hotfoot'),
            abilityId('move_plus_1'),
          ],
        },
      },
      equipment: {
        leftHand: itemId('battle_dictionary'),
        rightHand: itemId('staff_of_abundance'),
        headgear: itemId('circlet'),
        armor: itemId('silvered_vest'),
        accessory: itemId('tintinibar'),
      },
    },
  ],
};
