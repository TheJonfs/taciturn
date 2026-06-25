// Gravity Well — Chris-authored default template. S50 added a Calculator
// (Thessaly) to reach 5; S51/S55 reworked equipment and bucket picks; S63
// re-authored per playtest; S74 (this pass) re-authors again from a planner
// export — a control/burst mix with heavy CT-manipulation and magic.
//
// 5-unit composition under the variable-length BuiltTeam shape. Slot levels
// follow the alternating-outward pattern (25 / 24 / 26 / 23 / 27) for slots
// 0–4; per-unit `level` matches its slot.
//
// Concept (per the S74 export):
//   - Sera (Assassin) at slot 0 (L25). Shadow Arts + Auramancy secondary; Sai +
//     Scimitar dual-wield under Two Weapons. Biomastery + Aura Mastery + Flow
//     State support; Speed Save / Counter / Combat Focus / Earth Resilience
//     survival.
//   - Thessaly (Calculator) at slot 1 (L24). Math Skill + Auramancy secondary;
//     Conductor + Aura Mastery amplifying the math/buff line. Staff + Tome of
//     Power.
//   - Lumen (Pyromancer) at slot 2 (L26). Fire Spells + Templar Arts secondary;
//     Ignition / Aether Bloom / Conductor / Flow State burn engine.
//   - Chris (Templar) at slot 3 (L23). Templar Arts + Thievery secondary;
//     Monkeygrip pairs the two-handed Imp Halberd with a Managuard off-hand;
//     Emissary / Unified Calling sustain.
//   - Clio (Hydrologist) at slot 4 (L27). Water Spells + Math Skill secondary;
//     Flow State / Conductor / Mathematician; Wand of the Depths + Battle
//     Dictionary.
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
          [bucketId('secondary_command_sets')]: [commandSetId('auramancy')],
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
            abilityId('earth_communion'),
            abilityId('aura_mastery'),
            abilityId('flow_state'),
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
        rightHand: itemId('scimitar'),
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
          [bucketId('secondary_command_sets')]: [commandSetId('auramancy')],
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
            abilityId('aura_mastery'),
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
          [bucketId('secondary_command_sets')]: [commandSetId('thief_arts')],
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
        accessory: itemId('gauntlet_of_might'),
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
