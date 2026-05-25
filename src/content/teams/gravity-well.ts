// Gravity Well — Chris-authored default template; S50 revision adds a
// Calculator (Thessaly) to bring the roster to 5.
//
// 5-unit composition under the variable-length BuiltTeam shape. Slot
// levels follow the alternating-outward pattern (25 / 24 / 26 / 23 / 27)
// for slots 0–4; per-unit `level` matches its slot.
//
// Concept (per Chris's authoring):
//   - Sera (Assassin) leads at slot 0 with dual-knife (Sai + Chef's
//     Knife) and a packed Reaction bucket (Speed Save + Counter + Combat
//     Focus + Landwalker). Battle Skill secondary, Lookout's Hood +
//     Battle Gear + Boots of Haste — tempo over burst.
//   - Thessaly (Calculator) at slot 1 (L24) — Math Skill with Earth
//     Spells secondary. Mathematician + Conductor for the SP /
//     MP-discount stack, Earth Communion for the universal status
//     multiplier. Staff of Power + Focus Band + Silvered Vest + Mantle
//     of Protection — Calculator-as-fragile-keystone leaning hard on
//     mitigation.
//   - Lumen (Pyromancer / Fire Mage) at slot 2 (L26). Ironfoot trades
//     mobility for +1 PA/+1 MA + Movement-capacity headroom, letting
//     all five Movement passives ride. Wand of Lumen + Pointy Hat +
//     Wizard's Robe — high-volume Burn pressure.
//   - Chris (Knight) at slot 3 (L23). Long Sword + War Axe dual-wield
//     with The Offering (four basic-Attack swings per turn). Battle
//     Skill + Shadow Arts secondary. Tactical Mask + Soldier's Leathers
//     — fast bruiser.
//   - Clio (Hydrologist / Water Mage) at slot 4 (L27). Magus Crown
//     unlocks dual secondary command sets — Math Skill + Fire Spells —
//     on top of native Water Spells. Augmentor expands the Support
//     bucket; Sorcerer's Robe's Auto-Shell grant + Wand of the Depths
//     buy back the defensive layer Magus Crown's −MA implies.
//
// Authored unit names are personal picks; the team builder respects
// authored values on template load (S38 naming convention).

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

export const gravityWell: BuiltTeam = {
  name: 'Gravity Well',
  units: [
    {
      name: 'Sera',
      classId: classId('assassin'),
      baseStats: buildBaseStats(classId('assassin'), BRAVE, FAITH, 25),
      level: 25,
      loadout: {
        actionBuckets: {
          [bucketId('first_action')]: [commandSetId('shadow_arts')],
          [bucketId('secondary_command_sets')]: [commandSetId('battle_skill')],
        },
        passiveBuckets: {
          [bucketId('reaction')]: [
            abilityId('speed_save'),
            abilityId('counter'),
            abilityId('combat_focus'),
            abilityId('earth_resilience'),
          ],
          [bucketId('support')]: [
            abilityId('two_weapons'),
            abilityId('martial_expertise'),
            abilityId('earth_communion'),
          ],
          [bucketId('movement')]: [
            abilityId('fleet_of_foot'),
            abilityId('bravestrider'),
            abilityId('field_recovery'),
          ],
        },
      },
      equipment: {
        leftHand: itemId('sai'),
        rightHand: itemId('chefs_knife'),
        headgear: itemId('golden_hairpin'),
        armor: itemId('battle_gear'),
        accessory: itemId('boots_of_haste'),
      },
    },
    {
      name: 'Thessaly',
      classId: classId('calculator'),
      baseStats: buildBaseStats(classId('calculator'), BRAVE, FAITH, 24),
      level: 24,
      loadout: {
        actionBuckets: {
          [bucketId('first_action')]: [commandSetId('math_skill')],
          [bucketId('secondary_command_sets')]: [commandSetId('earth_spells')],
        },
        passiveBuckets: {
          [bucketId('reaction')]: [
            abilityId('cornered_focus'),
            abilityId('speed_save'),
            abilityId('tidal_pull'),
            abilityId('earth_resilience'),
          ],
          [bucketId('support')]: [
            abilityId('mathematician'),
            abilityId('conductor'),
            abilityId('earth_communion'),
          ],
          [bucketId('movement')]: [
            abilityId('thoughtful_pacing'),
            abilityId('quickstep'),
            abilityId('hotfoot'),
          ],
        },
      },
      equipment: {
        leftHand: itemId('staff_of_power'),
        rightHand: null,
        headgear: itemId('focus_band'),
        armor: itemId('silvered_vest'),
        accessory: itemId('mantle_of_protection'),
      },
    },
    {
      name: 'Lumen',
      classId: classId('fire_mage'),
      baseStats: buildBaseStats(classId('fire_mage'), BRAVE, FAITH, 26),
      level: 26,
      loadout: {
        actionBuckets: {
          [bucketId('first_action')]: [commandSetId('fire_spells')],
          [bucketId('secondary_command_sets')]: [commandSetId('water_spells')],
        },
        passiveBuckets: {
          [bucketId('reaction')]: [
            abilityId('smolder'),
            abilityId('discharge'),
            abilityId('cornered_focus'),
          ],
          [bucketId('support')]: [
            abilityId('ignition'),
            abilityId('aether_bloom'),
            abilityId('conductor'),
            abilityId('flow_state'),
          ],
          [bucketId('movement')]: [
            abilityId('hotfoot'),
            abilityId('thoughtful_pacing'),
            abilityId('fleet_of_foot'),
            abilityId('tidewalker'),
            abilityId('quickstep'),
          ],
        },
      },
      equipment: {
        leftHand: itemId('wand_of_lumen'),
        rightHand: null,
        headgear: itemId('pointy_hat'),
        armor: itemId('wizards_robe'),
        accessory: itemId('ironfoot'),
      },
    },
    {
      name: 'Chris',
      classId: classId('knight'),
      baseStats: buildBaseStats(classId('knight'), BRAVE, FAITH, 23),
      level: 23,
      loadout: {
        actionBuckets: {
          [bucketId('first_action')]: [commandSetId('battle_skill')],
          [bucketId('secondary_command_sets')]: [commandSetId('shadow_arts')],
        },
        passiveBuckets: {
          [bucketId('reaction')]: [
            abilityId('counter'),
            abilityId('combat_focus'),
            abilityId('speed_save'),
            abilityId('earth_resilience'),
          ],
          [bucketId('support')]: [
            abilityId('martial_expertise'),
            abilityId('two_weapons'),
          ],
          [bucketId('movement')]: [
            abilityId('bravestrider'),
            abilityId('field_recovery'),
            abilityId('thoughtful_pacing'),
            abilityId('fleet_of_foot'),
          ],
        },
      },
      equipment: {
        leftHand: itemId('long_sword'),
        rightHand: itemId('war_axe'),
        headgear: itemId('tactical_mask'),
        armor: itemId('soldiers_leathers'),
        accessory: itemId('the_offering'),
      },
    },
    {
      name: 'Clio',
      classId: classId('water_mage'),
      baseStats: buildBaseStats(classId('water_mage'), BRAVE, FAITH, 27),
      level: 27,
      loadout: {
        actionBuckets: {
          [bucketId('first_action')]: [commandSetId('water_spells')],
          [bucketId('secondary_command_sets')]: [
            commandSetId('math_skill'),
            commandSetId('fire_spells'),
          ],
        },
        passiveBuckets: {
          [bucketId('reaction')]: [
            abilityId('tidal_pull'),
            abilityId('smolder'),
            abilityId('cornered_focus'),
          ],
          [bucketId('support')]: [
            abilityId('flow_state'),
            abilityId('conductor'),
            abilityId('mathematician'),
          ],
          [bucketId('movement')]: [
            abilityId('tidewalker'),
            abilityId('thoughtful_pacing'),
            abilityId('hotfoot'),
          ],
        },
      },
      equipment: {
        leftHand: itemId('wand_of_depths'),
        rightHand: null,
        headgear: itemId('magus_crown'),
        armor: itemId('sorcerers_robe'),
        accessory: itemId('augmentor'),
      },
    },
  ],
};
