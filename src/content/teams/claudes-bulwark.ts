// "Claude's Bulwark" — a sustain-and-buff bulwark team (Session 74).
//
// A planner-chat build, transcribed from its team-export JSON. The theme
// is a resilient front that buffs itself up and grinds: Damage Split on
// nearly everyone, Earth Communion + Conductor amplifying status/magic, and
// a heavy support spine (Enchanter Auramancy + Templar sustain + Alchemist
// items). Every passive bucket is filled to its exact capacity of 3 using
// each class's free natives:
//
//   - Marina (Enchanter) — the buff engine: Auramancy (Haste/Protect/Shell)
//     amplified by Aura Mastery, Short Charge to land it sooner, Templar
//     Arts secondary for extra sustain. Conductor + Earth Communion deepen
//     her magic; Resistance Save + Cornered Focus + Damage Split keep her up.
//   - Wynn (Knight) — the anvil: Battle Skill + Water Spells secondary, a
//     scimitar-and-escutcheon line. Martial Expertise / Momentum tempo,
//     Counter + Damage Split retaliation.
//   - Tanis (Templar) — the sustain hybrid: Templar Arts + Battle Skill,
//     Monkeygrip + Emissary / Unified Calling on-heal spine, Conductor.
//   - Linus (Earth Mage) — the controller: Earth Spells + Templar Arts,
//     Conductor + Flow State magic economy, Earth Resilience tankiness.
//   - Morgaine (Alchemist) — the field medic: a Riptide Bow throw/heal
//     economy (Field Kit / Field Recovery), Earth Communion + Martial
//     Expertise, Earth Resilience + Combat Focus + Damage Split survival.
//
// Per-unit levels (25/24/26/23/27) follow the slot-level pattern; all
// Brave/Faith 70. Loadout is the planner's; this file is the BuiltTeam
// transcription.

import { abilityId, bucketId, classId, commandSetId, itemId } from '@engine/index.ts';
import { buildBaseStats, type BuiltTeam } from './built-team.ts';

const BRAVE = 70;
const FAITH = 70;

export const claudesBulwark: BuiltTeam = {
  name: "Claude's Bulwark",
  units: [
    {
      name: 'Marina',
      classId: classId('enchanter'),
      baseStats: buildBaseStats(classId('enchanter'), BRAVE, FAITH, 25),
      level: 25,
      loadout: {
        actionBuckets: {
          [bucketId('first_action')]: [commandSetId('auramancy')],
          [bucketId('secondary_command_sets')]: [commandSetId('templar_arts')],
        },
        passiveBuckets: {
          [bucketId('reaction')]: [
            abilityId('resistance_save'),
            abilityId('cornered_focus'),
            abilityId('damage_split'),
          ],
          [bucketId('support')]: [
            abilityId('short_charge'),
            abilityId('aura_mastery'),
            abilityId('conductor'),
            abilityId('earth_communion'),
          ],
          [bucketId('movement')]: [
            abilityId('float'),
            abilityId('hotfoot'),
            abilityId('quickstep'),
          ],
        },
      },
      equipment: {
        leftHand: itemId('tome_of_power'),
        rightHand: itemId('staff_of_abundance'),
        headgear: itemId('focus_band'),
        armor: itemId('silvered_vest'),
        accessory: itemId('tintinibar'),
      },
    },
    {
      name: 'Wynn',
      classId: classId('knight'),
      baseStats: buildBaseStats(classId('knight'), BRAVE, FAITH, 24),
      level: 24,
      loadout: {
        actionBuckets: {
          [bucketId('first_action')]: [commandSetId('battle_skill')],
          [bucketId('secondary_command_sets')]: [commandSetId('water_spells')],
        },
        passiveBuckets: {
          [bucketId('reaction')]: [
            abilityId('counter'),
            abilityId('damage_split'),
            abilityId('combat_focus'),
          ],
          [bucketId('support')]: [
            abilityId('martial_expertise'),
            abilityId('earth_communion'),
            abilityId('momentum'),
            abilityId('short_charge'),
          ],
          [bucketId('movement')]: [
            abilityId('bravestrider'),
            abilityId('move_plus_1'),
            abilityId('float'),
          ],
        },
      },
      equipment: {
        leftHand: itemId('escutcheon'),
        rightHand: itemId('scimitar'),
        headgear: itemId('guard_cap'),
        armor: itemId('war_plate'),
        accessory: itemId('boots_of_haste'),
      },
    },
    {
      name: 'Tanis',
      classId: classId('templar'),
      baseStats: buildBaseStats(classId('templar'), BRAVE, FAITH, 26),
      level: 26,
      loadout: {
        actionBuckets: {
          [bucketId('first_action')]: [commandSetId('templar_arts')],
          [bucketId('secondary_command_sets')]: [commandSetId('battle_skill')],
        },
        passiveBuckets: {
          [bucketId('reaction')]: [
            abilityId('unified_calling'),
            abilityId('damage_split'),
            abilityId('counter'),
          ],
          [bucketId('support')]: [
            abilityId('emissary'),
            abilityId('monkeygrip'),
            abilityId('conductor'),
            abilityId('earth_communion'),
          ],
          [bucketId('movement')]: [
            abilityId('faithstrider'),
            abilityId('hotfoot'),
            abilityId('move_plus_1'),
          ],
        },
      },
      equipment: {
        leftHand: itemId('talisman_of_warding'),
        rightHand: itemId('long_sword'),
        headgear: itemId('crusaders_helm'),
        armor: itemId('battlemages_chain'),
        accessory: itemId('diamond_bracelet'),
      },
    },
    {
      name: 'Linus',
      classId: classId('earth_mage'),
      baseStats: buildBaseStats(classId('earth_mage'), BRAVE, FAITH, 23),
      level: 23,
      loadout: {
        actionBuckets: {
          [bucketId('first_action')]: [commandSetId('earth_spells')],
          [bucketId('secondary_command_sets')]: [commandSetId('templar_arts')],
        },
        passiveBuckets: {
          [bucketId('reaction')]: [
            abilityId('earth_resilience'),
            abilityId('cornered_focus'),
            abilityId('damage_split'),
          ],
          [bucketId('support')]: [
            abilityId('earth_communion'),
            abilityId('conductor'),
            abilityId('flow_state'),
          ],
          [bucketId('movement')]: [
            abilityId('bedrock_stride'),
            abilityId('hotfoot'),
            abilityId('quickstep'),
          ],
        },
      },
      equipment: {
        leftHand: itemId('buckler'),
        rightHand: itemId('staff_of_power'),
        headgear: itemId('pointy_hat'),
        armor: itemId('dark_robe'),
        accessory: itemId('capacitor_ring'),
      },
    },
    {
      name: 'Morgaine',
      classId: classId('alchemist'),
      baseStats: buildBaseStats(classId('alchemist'), BRAVE, FAITH, 27),
      level: 27,
      loadout: {
        actionBuckets: {
          [bucketId('first_action')]: [commandSetId('alchemy')],
          [bucketId('secondary_command_sets')]: [commandSetId('battle_skill')],
        },
        passiveBuckets: {
          [bucketId('reaction')]: [
            abilityId('combat_focus'),
            abilityId('earth_resilience'),
            abilityId('damage_split'),
          ],
          [bucketId('support')]: [
            abilityId('field_kit'),
            abilityId('earth_communion'),
            abilityId('martial_expertise'),
          ],
          [bucketId('movement')]: [
            abilityId('field_recovery'),
            abilityId('fleet_of_foot'),
            abilityId('hotfoot'),
          ],
        },
      },
      equipment: {
        leftHand: null,
        rightHand: itemId('riptide_bow'),
        headgear: itemId('lookouts_hood'),
        armor: itemId('shimmer_cloak'),
        accessory: itemId('lightfoot'),
      },
    },
  ],
};
