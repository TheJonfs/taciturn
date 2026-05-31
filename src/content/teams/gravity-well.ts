// Gravity Well — Chris-authored default template. S50 added a Calculator
// (Thessaly) to reach 5; S51 added the off-hand books + the Knight-Alchemy
// rework; S55 revision (this pass) reworks equipment and a few bucket picks per
// Chris's playtest authoring.
//
// 5-unit composition under the variable-length BuiltTeam shape. Slot levels
// follow the alternating-outward pattern (25 / 24 / 26 / 23 / 27) for slots
// 0–4; per-unit `level` matches its slot.
//
// Concept (per Chris's authoring; S55 deltas noted):
//   - Sera (Assassin) leads at slot 0. Sai + Staff of Abundance dual-wield
//     under Two Weapons; Worldcraft secondary (S55 — terrain control off the
//     Assassin's mobility). Golden Hairpin + Shimmer Cloak + Boots of Haste.
//   - Thessaly (Calculator) at slot 1 (L24) — Math Skill + Earth Spells
//     secondary. Mathematician + Conductor + Earth Communion; Staff of Power +
//     Tome of Power + Focus Band + Silvered Vest + Mantle of Protection.
//   - Lumen (Pyromancer) at slot 2 (L26). Fire Spells + Water Spells secondary.
//     Wand of Lumen + Livre of Urgency + Pointy Hat + Wizard's Robe + Lightfoot
//     (S55 — accessory swap).
//   - Chris (Knight) at slot 3 (L23). Battle Skill + Alchemy secondary. S55:
//     Parrying Sword + Warrior's Aegis (sword-and-board) replace the two-handed
//     Absolom; Tactical Mask + Soldier's Leathers + The Offering.
//   - Clio (Hydrologist) at slot 4 (L27). Magus Crown unlocks dual secondary —
//     Math Skill + Fire Spells — atop native Water Spells. Wand of the Depths +
//     Battle Dictionary + Sorcerer's Robe + Augmentor.
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
          [bucketId('secondary_command_sets')]: [commandSetId('worldcraft')],
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
        rightHand: itemId('staff_of_abundance'),
        headgear: itemId('golden_hairpin'),
        armor: itemId('shimmer_cloak'),
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
        accessory: itemId('lightfoot'),
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
        leftHand: itemId('parrying_sword'),
        rightHand: itemId('warriors_aegis'),
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
