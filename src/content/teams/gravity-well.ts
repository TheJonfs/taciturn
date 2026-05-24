// Gravity Well — first S48-authored default template (Chris).
//
// 4-unit composition that uses the variable-length BuiltTeam shape S48
// introduced. The pre-S48 template set was 4-unit too; the 5v5 unlock
// is structural (the builder ACCEPTS up to 5), not a content mandate
// that every team be max-sized. Gravity Well chooses 4 deliberately.
//
// Concept (per Chris's authoring):
//   - Knight + dual-wield (Bolt Hammer + War Axe) anchored by The
//     Offering — every basic Attack swings each weapon 2× for four
//     hits per turn. Pairs Two Weapons with Martial Expertise's PA × 1.25
//     and a packed Reaction bucket (Counter + Combat Focus + Speed
//     Save + Landwalker). Tactical Mask for the secondary Shadow Arts
//     command set + Soldier's Leathers as the lightweight armor.
//   - Pyromancer with Wand of Lumen's S45-follow-up shifts. Ironfoot
//     trades −Move/−Jump/−Spd for +1 PA/+1 MA + the Movement-bucket
//     capacity headroom that lets all five Movement passives ride
//     (Hotfoot + Tidewalker + Quickstep + Fleet of Foot + Field
//     Recovery). Pyromancer's native Ignition + Aether Bloom buttress
//     a Burn-pressure plan; Conductor + Flow State buy back the MA and
//     CT for the cross-class Water Spells secondary.
//   - Hydrologist with Wand of the Depths' on-hit Resonance + Augmentor
//     +1 Reaction-bucket capacity so Tidal Pull / Smolder / Speed Save
//     ride together. Guard Cap + Sorcerer's Robe (Auto-Shell grant).
//   - Assassin with dual-knife (Sai + Chef's Knife) — Two Weapons free
//     for Assassin makes the +per-weapon-swing The Offering shape
//     redundant, so Boots of Haste (battle-start Haste grant) takes
//     the accessory slot for tempo. Lookout's Hood + Battle Gear.
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
      name: 'Chris',
      classId: classId('knight'),
      baseStats: buildBaseStats(classId('knight'), BRAVE, FAITH),
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
            abilityId('fleet_of_foot'),
            abilityId('tidewalker'),
          ],
        },
      },
      equipment: {
        leftHand: itemId('bolt_hammer'),
        rightHand: itemId('war_axe'),
        headgear: itemId('tactical_mask'),
        armor: itemId('soldiers_leathers'),
        accessory: itemId('the_offering'),
      },
    },
    {
      name: 'Lumen',
      classId: classId('fire_mage'),
      baseStats: buildBaseStats(classId('fire_mage'), BRAVE, FAITH),
      loadout: {
        actionBuckets: {
          [bucketId('first_action')]: [commandSetId('fire_spells')],
          [bucketId('secondary_command_sets')]: [commandSetId('water_spells')],
        },
        passiveBuckets: {
          [bucketId('reaction')]: [
            abilityId('smolder'),
            abilityId('discharge'),
            abilityId('tidal_pull'),
          ],
          [bucketId('support')]: [
            abilityId('ignition'),
            abilityId('aether_bloom'),
            abilityId('conductor'),
            abilityId('flow_state'),
          ],
          [bucketId('movement')]: [
            abilityId('hotfoot'),
            abilityId('tidewalker'),
            abilityId('quickstep'),
            abilityId('fleet_of_foot'),
            abilityId('field_recovery'),
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
      name: 'Clio',
      classId: classId('water_mage'),
      baseStats: buildBaseStats(classId('water_mage'), BRAVE, FAITH),
      loadout: {
        actionBuckets: {
          [bucketId('first_action')]: [commandSetId('water_spells')],
          [bucketId('secondary_command_sets')]: [commandSetId('fire_spells')],
        },
        passiveBuckets: {
          [bucketId('reaction')]: [
            abilityId('tidal_pull'),
            abilityId('smolder'),
            abilityId('speed_save'),
          ],
          [bucketId('support')]: [
            abilityId('flow_state'),
            abilityId('conductor'),
            abilityId('ignition'),
          ],
          [bucketId('movement')]: [
            abilityId('tidewalker'),
            abilityId('hotfoot'),
            abilityId('quickstep'),
          ],
        },
      },
      equipment: {
        leftHand: itemId('wand_of_depths'),
        rightHand: null,
        headgear: itemId('guard_cap'),
        armor: itemId('sorcerers_robe'),
        accessory: itemId('augmentor'),
      },
    },
    {
      name: 'Sera',
      classId: classId('assassin'),
      baseStats: buildBaseStats(classId('assassin'), BRAVE, FAITH),
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
            abilityId('hotfoot'),
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
  ],
};
