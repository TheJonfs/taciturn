// Gravity Well — Chris-authored default template; S50 revision added a
// Calculator (Thessaly) to bring the roster to 5; S51 revision adds the
// new off-hand pieces (Tome of Power on Thessaly, Livre of Urgency on
// Lumen, Battle Dictionary on Clio) and reworks Chris into a Knight-Sword
// + Alchemy support build.
//
// 5-unit composition under the variable-length BuiltTeam shape. Slot
// levels follow the alternating-outward pattern (25 / 24 / 26 / 23 / 27)
// for slots 0–4; per-unit `level` matches its slot.
//
// Concept (per Chris's authoring):
//   - Sera (Assassin) leads at slot 0 with dual-knife (Sai + Chef's
//     Knife) and a packed Reaction bucket (Speed Save + Counter + Combat
//     Focus + Landwalker). Battle Skill secondary, Lookout's Hood +
//     Battle Gear + Boots of Haste — tempo over burst. S51: Thoughtful
//     Pacing replaces Field Recovery in the Movement bucket for MP-on-
//     move sustain across the longer engagements the new books enable.
//   - Thessaly (Calculator) at slot 1 (L24) — Math Skill with Earth
//     Spells secondary. Mathematician + Conductor for the SP /
//     MP-discount stack, Earth Communion for the universal status
//     multiplier. Staff of Power + Tome of Power (S51 — +1 MA / +10 MP)
//     + Focus Band + Silvered Vest + Mantle of Protection — the Book
//     compounds with the MA 8 → 9 baseline bump for Math Skill output.
//   - Lumen (Pyromancer / Fire Mage) at slot 2 (L26). Ironfoot trades
//     mobility for +1 PA/+1 MA + Movement-capacity headroom, letting
//     all five Movement passives ride. Wand of Lumen + Livre of Urgency
//     (S51 — +1 Speed + +5 charged action speed on magical) + Pointy Hat
//     + Wizard's Robe — the Book compounds tempo on top of the high-
//     volume Burn pressure.
//   - Chris (Knight) at slot 3 (L23). S51 rework: Absolom Knight Sword
//     (two-handed, attacker_brave variance) replaces the Long Sword +
//     War Axe dual-wield; Alchemy secondary replaces Shadow Arts;
//     Field Kit + Earth Communion replace Two Weapons in Support. The
//     Offering still rides in the accessory slot, but with a single
//     two-handed weapon the swing math is the same per swing — the
//     trade is rider chains (Alchemy items) for raw swing volume.
//   - Clio (Hydrologist / Water Mage) at slot 4 (L27). Magus Crown
//     unlocks dual secondary command sets — Math Skill + Fire Spells —
//     on top of native Water Spells. Augmentor expands the Support
//     bucket; Sorcerer's Robe's Auto-Shell grant + Wand of the Depths +
//     Battle Dictionary (S51 — +1 PA / +1 horizontal range / +1 AoE
//     vertical tolerance on magical) buy a richer caster profile.
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
            abilityId('thoughtful_pacing'),
          ],
        },
      },
      equipment: {
        leftHand: itemId('sai'),
        rightHand: itemId('chefs_knife'),
        headgear: itemId('lookouts_hood'),
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
        rightHand: itemId('tome_of_power'),
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
        rightHand: itemId('livre_of_urgency'),
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
          [bucketId('secondary_command_sets')]: [commandSetId('alchemy')],
        },
        passiveBuckets: {
          [bucketId('reaction')]: [
            abilityId('counter'),
            abilityId('combat_focus'),
            abilityId('speed_save'),
            abilityId('earth_resilience'),
            abilityId('tidal_pull'),
          ],
          [bucketId('support')]: [
            abilityId('martial_expertise'),
            abilityId('field_kit'),
            abilityId('earth_communion'),
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
        leftHand: itemId('absolom'),
        rightHand: null,
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
        rightHand: itemId('battle_dictionary'),
        headgear: itemId('magus_crown'),
        armor: itemId('sorcerers_robe'),
        accessory: itemId('augmentor'),
      },
    },
  ],
};
