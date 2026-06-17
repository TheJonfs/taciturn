// "The Irregulars" — a cross-trained, off-class showcase team (Session 68).
//
// Authored by Chris to exercise the recent additions, deliberately
// piling abilities onto classes outside their home kit:
//
//   - Alice (Alchemist) — the standout: a Longbow + the Hunter's Eagle Eye
//     & Vantage on an *Alchemist*, whose higher base PA (8) feeds the bow
//     AND her native Alchemy (Throw Item) and borrowed Thievery, both
//     PA-scaled. Gauntlet of Might (+3 PA) leans into that. Skullclamp
//     for more PA/MA at an HP/MP cost.
//   - Octavian (Templar) — Monkeygrip pairs the two-handed Imp Halberd
//     with a Managuard shield; Fire Spells secondary + Conductor; the
//     Templar's heal/sustain spine (Emissary / Unified Calling).
//   - Lily (Lightning Mage) — the Wand of Potential (lightning SP rider +
//     water/earth resonance) + Vantage so her straight-line Lightning
//     Bolts clear cover from the high ground; Earth Spells secondary.
//   - Morgan (Terraformer) — Worldcraft + Math Skill; builds the high
//     ground the bow/Vantage units want, and a Defender knight-sword for
//     self-defense. Mantle of Protection + Damage Split to survive.
//   - Alistair (Fire Mage) — Two Weapons dual-wielding Wand of Lumen +
//     Staff of Power (a mixed magical off-hand), Templar Arts secondary
//     for utility, Ignition/Smolder burn pressure.
//
// All loadouts are Chris's; this file is the BuiltTeam transcription of
// the team-export JSON. Per-unit levels vary (23-27) to exercise the
// level modifier.

import { abilityId, bucketId, classId, commandSetId, itemId } from '@engine/index.ts';
import { buildBaseStats, type BuiltTeam } from './built-team.ts';

const BRAVE = 70;
const FAITH = 70;

export const theIrregulars: BuiltTeam = {
  name: 'The Irregulars',
  units: [
    {
      name: 'Alice',
      classId: classId('alchemist'),
      baseStats: buildBaseStats(classId('alchemist'), BRAVE, FAITH, 25),
      level: 25,
      loadout: {
        actionBuckets: {
          [bucketId('first_action')]: [commandSetId('alchemy')],
          [bucketId('secondary_command_sets')]: [commandSetId('thief_arts')],
        },
        passiveBuckets: {
          [bucketId('reaction')]: [
            abilityId('combat_focus'),
            abilityId('damage_split'),
            abilityId('counter'),
          ],
          [bucketId('support')]: [
            abilityId('field_kit'),
            abilityId('vantage'),
            abilityId('eagle_eye'),
          ],
          [bucketId('movement')]: [
            abilityId('field_recovery'),
            abilityId('bravestrider'),
            abilityId('thoughtful_pacing'),
          ],
        },
      },
      equipment: {
        leftHand: null,
        rightHand: itemId('longbow'),
        headgear: itemId('skullclamp'),
        armor: itemId('battle_gear'),
        accessory: itemId('gauntlet_of_might'),
      },
    },
    {
      name: 'Octavian',
      classId: classId('templar'),
      baseStats: buildBaseStats(classId('templar'), BRAVE, FAITH, 24),
      level: 24,
      loadout: {
        actionBuckets: {
          [bucketId('first_action')]: [commandSetId('templar_arts')],
          [bucketId('secondary_command_sets')]: [commandSetId('fire_spells')],
        },
        passiveBuckets: {
          [bucketId('reaction')]: [
            abilityId('unified_calling'),
            abilityId('tidal_pull'),
            abilityId('counter'),
            abilityId('combat_focus'),
          ],
          [bucketId('support')]: [
            abilityId('emissary'),
            abilityId('monkeygrip'),
            abilityId('conductor'),
            abilityId('flow_state'),
          ],
          [bucketId('movement')]: [
            abilityId('faithstrider'),
            abilityId('thoughtful_pacing'),
            abilityId('fleet_of_foot'),
            abilityId('field_recovery'),
          ],
        },
      },
      equipment: {
        leftHand: itemId('managuard'),
        rightHand: itemId('imp_halberd'),
        headgear: itemId('tactical_mask'),
        armor: itemId('battlemages_chain'),
        accessory: itemId('diamond_bracelet'),
      },
    },
    {
      name: 'Lily',
      classId: classId('lightning_mage'),
      baseStats: buildBaseStats(classId('lightning_mage'), BRAVE, FAITH, 26),
      level: 26,
      loadout: {
        actionBuckets: {
          [bucketId('first_action')]: [commandSetId('lightning_spells')],
          [bucketId('secondary_command_sets')]: [commandSetId('earth_spells')],
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
            abilityId('vantage'),
            abilityId('earth_communion'),
          ],
          [bucketId('movement')]: [
            abilityId('quickstep'),
            abilityId('faithstrider'),
            abilityId('thoughtful_pacing'),
          ],
        },
      },
      equipment: {
        leftHand: itemId('tome_of_power'),
        rightHand: itemId('wand_of_potential'),
        headgear: itemId('pointy_hat'),
        armor: itemId('wizards_robe'),
        accessory: itemId('augmentor'),
      },
    },
    {
      name: 'Morgan',
      classId: classId('terraformer'),
      baseStats: buildBaseStats(classId('terraformer'), BRAVE, FAITH, 23),
      level: 23,
      loadout: {
        actionBuckets: {
          [bucketId('first_action')]: [commandSetId('worldcraft')],
          [bucketId('secondary_command_sets')]: [commandSetId('math_skill')],
        },
        passiveBuckets: {
          [bucketId('reaction')]: [
            abilityId('damage_split'),
            abilityId('combat_focus'),
            abilityId('cornered_focus'),
            abilityId('speed_save'),
          ],
          [bucketId('support')]: [
            abilityId('expert_former'),
            abilityId('mathematician'),
            abilityId('earth_communion'),
          ],
          [bucketId('movement')]: [
            abilityId('ignore_height'),
            abilityId('bravestrider'),
            abilityId('quickstep'),
          ],
        },
      },
      equipment: {
        leftHand: null,
        rightHand: itemId('defender'),
        headgear: itemId('circlet'),
        armor: itemId('sorcerers_robe'),
        accessory: itemId('mantle_of_protection'),
      },
    },
    {
      name: 'Alistair',
      classId: classId('fire_mage'),
      baseStats: buildBaseStats(classId('fire_mage'), BRAVE, FAITH, 27),
      level: 27,
      loadout: {
        actionBuckets: {
          [bucketId('first_action')]: [commandSetId('fire_spells')],
          [bucketId('secondary_command_sets')]: [commandSetId('templar_arts')],
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
            abilityId('two_weapons'),
          ],
          [bucketId('movement')]: [
            abilityId('hotfoot'),
            abilityId('faithstrider'),
            abilityId('move_plus_2'),
          ],
        },
      },
      equipment: {
        leftHand: itemId('wand_of_lumen'),
        rightHand: itemId('staff_of_power'),
        headgear: itemId('golden_hairpin'),
        armor: itemId('silvered_vest'),
        accessory: itemId('ironfoot'),
      },
    },
  ],
};
