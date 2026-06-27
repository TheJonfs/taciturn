// "T-Munny" — a custom team (Session 75).
//
// Transcribed verbatim from its team-export JSON (the export's placeholder
// "Custom Team" name renamed to "T-Munny" per Chris). A sustain-and-control
// roster: every unit runs Damage Split, most run a Speed/Resistance Save,
// and the backline leans on Earth Communion / Flow State / Short Charge to
// keep statuses and casts flowing.
//
//   - Adrian (Knight) — anvil: Defender + Warrior's Aegis behind Counter /
//     Damage Split / Speed Save, Alchemy secondary, Monkeygrip for the
//     shield-plus-weapon hold.
//   - Ostara (Thief) — skirmisher: Riptide Bow + Worldcraft, Slip Free /
//     Unified Calling, Eagle Eye for reach accuracy, Move +2 mobility.
//   - Vionne (Enchanter) — the buff engine: Auramancy + Templar Arts, Aura
//     Mastery / Short Charge / Emissary / Flow State, Float for terrain.
//   - Octavius (Templar) — bruiser-support: Imp Halberd + Managuard
//     (Monkeygrip), Templar Arts + Worldcraft, Expert Former / Short Charge.
//   - Calista (Water Mage) — control caster: Water Spells + Math Skill,
//     Mathematician + Flow State, Tidal Pull, Tidewalker mobility.
//
// Per-unit levels (25/24/26/23/27) follow the slot-level pattern; all
// Brave/Faith 70. Transcribed as-authored — the build's intent preserved.

import { abilityId, bucketId, classId, commandSetId, itemId } from '@engine/index.ts';
import { buildBaseStats, type BuiltTeam } from './built-team.ts';

const BRAVE = 70;
const FAITH = 70;

export const tMunny: BuiltTeam = {
  name: 'T-Munny',
  units: [
    {
      name: 'Adrian',
      classId: classId('knight'),
      baseStats: buildBaseStats(classId('knight'), BRAVE, FAITH, 25),
      level: 25,
      loadout: {
        actionBuckets: {
          [bucketId('first_action')]: [commandSetId('battle_skill')],
          [bucketId('secondary_command_sets')]: [commandSetId('alchemy')],
        },
        passiveBuckets: {
          [bucketId('reaction')]: [
            abilityId('counter'),
            abilityId('damage_split'),
            abilityId('speed_save'),
          ],
          [bucketId('support')]: [
            abilityId('martial_expertise'),
            abilityId('field_kit'),
            abilityId('monkeygrip'),
          ],
          [bucketId('movement')]: [
            abilityId('bravestrider'),
            abilityId('field_recovery'),
            abilityId('fleet_of_foot'),
            abilityId('move_plus_1'),
          ],
        },
      },
      equipment: {
        leftHand: itemId('warriors_aegis'),
        rightHand: itemId('defender'),
        headgear: itemId('lookouts_hood'),
        armor: itemId('soldiers_leathers'),
        accessory: itemId('tintinibar'),
      },
    },
    {
      name: 'Ostara',
      classId: classId('thief'),
      baseStats: buildBaseStats(classId('thief'), BRAVE, FAITH, 24),
      level: 24,
      loadout: {
        actionBuckets: {
          [bucketId('first_action')]: [commandSetId('thief_arts')],
          [bucketId('secondary_command_sets')]: [commandSetId('worldcraft')],
        },
        passiveBuckets: {
          [bucketId('reaction')]: [
            abilityId('slip_free'),
            abilityId('unified_calling'),
            abilityId('damage_split'),
          ],
          [bucketId('support')]: [
            abilityId('momentum'),
            abilityId('eagle_eye'),
            abilityId('earth_communion'),
          ],
          [bucketId('movement')]: [
            abilityId('move_plus_2'),
            abilityId('hotfoot'),
            abilityId('thoughtful_pacing'),
          ],
        },
      },
      equipment: {
        leftHand: null,
        rightHand: itemId('riptide_bow'),
        headgear: itemId('golden_hairpin'),
        armor: itemId('shimmer_cloak'),
        accessory: itemId('rasp_pendant'),
      },
    },
    {
      name: 'Vionne',
      classId: classId('enchanter'),
      baseStats: buildBaseStats(classId('enchanter'), BRAVE, FAITH, 26),
      level: 26,
      loadout: {
        actionBuckets: {
          [bucketId('first_action')]: [commandSetId('auramancy')],
          [bucketId('secondary_command_sets')]: [commandSetId('templar_arts')],
        },
        passiveBuckets: {
          [bucketId('reaction')]: [
            abilityId('resistance_save'),
            abilityId('damage_split'),
            abilityId('speed_save'),
          ],
          [bucketId('support')]: [
            abilityId('short_charge'),
            abilityId('aura_mastery'),
            abilityId('emissary'),
            abilityId('earth_communion'),
            abilityId('flow_state'),
          ],
          [bucketId('movement')]: [
            abilityId('float'),
            abilityId('field_recovery'),
            abilityId('thoughtful_pacing'),
            abilityId('fleet_of_foot'),
          ],
        },
      },
      equipment: {
        leftHand: itemId('battle_dictionary'),
        rightHand: itemId('staff_of_power'),
        headgear: itemId('circlet'),
        armor: itemId('wizards_robe'),
        accessory: itemId('mantle_of_protection'),
      },
    },
    {
      name: 'Octavius',
      classId: classId('templar'),
      baseStats: buildBaseStats(classId('templar'), BRAVE, FAITH, 23),
      level: 23,
      loadout: {
        actionBuckets: {
          [bucketId('first_action')]: [commandSetId('templar_arts')],
          [bucketId('secondary_command_sets')]: [commandSetId('worldcraft')],
        },
        passiveBuckets: {
          [bucketId('reaction')]: [
            abilityId('unified_calling'),
            abilityId('damage_split'),
            abilityId('slip_free'),
          ],
          [bucketId('support')]: [
            abilityId('emissary'),
            abilityId('monkeygrip'),
            abilityId('expert_former'),
            abilityId('short_charge'),
            abilityId('flow_state'),
          ],
          [bucketId('movement')]: [
            abilityId('faithstrider'),
            abilityId('thoughtful_pacing'),
            abilityId('field_recovery'),
            abilityId('fleet_of_foot'),
          ],
        },
      },
      equipment: {
        leftHand: itemId('managuard'),
        rightHand: itemId('imp_halberd'),
        headgear: itemId('crusaders_helm'),
        armor: itemId('battlemages_chain'),
        accessory: itemId('diamond_bracelet'),
      },
    },
    {
      name: 'Calista',
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
            abilityId('damage_split'),
            abilityId('speed_save'),
          ],
          [bucketId('support')]: [
            abilityId('flow_state'),
            abilityId('mathematician'),
            abilityId('earth_communion'),
          ],
          [bucketId('movement')]: [
            abilityId('tidewalker'),
            abilityId('thoughtful_pacing'),
            abilityId('faithstrider'),
          ],
        },
      },
      equipment: {
        leftHand: itemId('livre_of_urgency'),
        rightHand: itemId('staff_of_abundance'),
        headgear: itemId('pointy_hat'),
        armor: itemId('silvered_vest'),
        accessory: itemId('boots_of_haste'),
      },
    },
  ],
};
