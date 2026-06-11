// Gravity Well — Chris-authored default template. S50 added a Calculator
// (Thessaly) to reach 5; S51/S55 reworked equipment and bucket picks; S63 (this
// pass) re-authors per Chris's playtest export — most notably Chris swaps Knight
// → Templar.
//
// 5-unit composition under the variable-length BuiltTeam shape. Slot levels
// follow the alternating-outward pattern (25 / 24 / 26 / 23 / 27) for slots
// 0–4; per-unit `level` matches its slot.
//
// Concept (per Chris's S63 authoring):
//   - Sera (Assassin) leads at slot 0 (L25). Sai + Chef's Knife dual-wield under
//     Two Weapons; Worldcraft secondary. Golden Hairpin + Soul Vest + Boots of
//     Haste. (Unchanged this pass.)
//   - Thessaly (Calculator) at slot 1 (L24) — Math Skill + Earth Spells
//     secondary. Mathematician + Conductor + Earth Communion; Staff of Power +
//     Tome of Power + Focus Band + Silvered Vest + Ironfoot.
//   - Lumen (Pyromancer) at slot 2 (L26). Fire Spells + Templar Arts secondary.
//     Wand of Lumen + Livre of Urgency + Pointy Hat + Wizard's Robe + Lightfoot.
//   - Chris (Templar) at slot 3 (L23) — was a Knight. Templar Arts + Shadow Arts
//     secondary. Monkeygrip + Emissary support; Managuard off-hand alongside the
//     two-handed Imp Halberd (legal via Monkeygrip). Tactical Mask + Soldier's
//     Leathers + Diamond Bracelet.
//   - Clio (Hydrologist) at slot 4 (L27). Water Spells + Math Skill secondary.
//     Wand of the Depths + Battle Dictionary + Guard Cap + Sorcerer's Robe +
//     Augmentor.
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
        rightHand: itemId('chefs_knife'),
        headgear: itemId('golden_hairpin'),
        armor: itemId('soul_vest'),
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
            abilityId('tidal_pull'),
            abilityId('smolder'),
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
            abilityId('fleet_of_foot'),
          ],
        },
      },
      equipment: {
        leftHand: itemId('staff_of_power'),
        rightHand: itemId('tome_of_power'),
        headgear: itemId('focus_band'),
        armor: itemId('silvered_vest'),
        accessory: itemId('ironfoot'),
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
          [bucketId('secondary_command_sets')]: [commandSetId('templar_arts')],
        },
        passiveBuckets: {
          [bucketId('reaction')]: [
            abilityId('smolder'),
            abilityId('discharge'),
            abilityId('unified_calling'),
          ],
          [bucketId('support')]: [
            abilityId('ignition'),
            abilityId('aether_bloom'),
            abilityId('conductor'),
            abilityId('flow_state'),
          ],
          [bucketId('movement')]: [
            abilityId('hotfoot'),
            abilityId('quickstep'),
            abilityId('faithstrider'),
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
      classId: classId('templar'),
      baseStats: buildBaseStats(classId('templar'), BRAVE, FAITH, 23),
      level: 23,
      loadout: {
        actionBuckets: {
          [bucketId('first_action')]: [commandSetId('templar_arts')],
          [bucketId('secondary_command_sets')]: [commandSetId('shadow_arts')],
        },
        passiveBuckets: {
          [bucketId('reaction')]: [
            abilityId('unified_calling'),
            abilityId('counter'),
            abilityId('damage_split'),
          ],
          [bucketId('support')]: [
            abilityId('emissary'),
            abilityId('monkeygrip'),
            abilityId('martial_expertise'),
            abilityId('earth_communion'),
          ],
          [bucketId('movement')]: [
            abilityId('faithstrider'),
            abilityId('fleet_of_foot'),
            abilityId('thoughtful_pacing'),
            abilityId('quickstep'),
          ],
        },
      },
      equipment: {
        leftHand: itemId('managuard'),
        rightHand: itemId('imp_halberd'),
        headgear: itemId('tactical_mask'),
        armor: itemId('soldiers_leathers'),
        accessory: itemId('diamond_bracelet'),
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
          [bucketId('secondary_command_sets')]: [commandSetId('math_skill')],
        },
        passiveBuckets: {
          [bucketId('reaction')]: [
            abilityId('tidal_pull'),
            abilityId('smolder'),
            abilityId('unified_calling'),
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
        headgear: itemId('guard_cap'),
        armor: itemId('sorcerers_robe'),
        accessory: itemId('augmentor'),
      },
    },
  ],
};
