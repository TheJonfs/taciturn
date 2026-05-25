// Mage War — third S48-authored default template (Chris); S51 refresh
// fills four off-hand slots that were empty pre-S51 (Livre of Urgency
// on Roderic, Talisman of Conviction on Bethla, Tome of Power on
// Aldric, Battle Dictionary on Octavia). Every mage now carries an
// off-hand piece, showcasing the new universal off-hand opening.
//
// The "original five classes" lineup: Knight + one of each magic school
// (Geosage / Pyromancer / Aethurge / Hydrologist). Named after the v1
// playable surface that locked in around S17–S20 — the five classes
// that defined the engine's first complete combat surface.
//
// Concept (per Chris's authoring):
//   - Knight "Grant" in a defensive package: Escutcheon shield +
//     Flametongue (one-handed; the 25% Burn proc rides every basic
//     swing), Steel Helm's +1 Reaction-capacity heads room, War Plate
//     (Knight-restricted heavy armor), Tintinibar's Auto-Regen
//     battle-start grant. Field Kit + Earth Communion ride the cross-
//     class Support, Alchemy as the secondary command set.
//   - Geosage "Roderic" — straightforward earth control. Wand of the
//     Deepwood (actionSpeed mod on earth casts + tagged_resistance_shift
//     proc) plus S51's Livre of Urgency (+1 Speed + +5 charged action
//     speed on magical) layering more tempo onto an already-tempo-
//     focused build. Dark Robe + Guard Cap, Capacitor Ring's per-tag
//     resistance shifts. Water Spells as the secondary.
//   - Pyromancer "Bethla" — Wand of Lumen's S45-followup +Earth/−Water
//     shift, Tricorn (+Brave) to push Brave-gated apply rolls plus S51's
//     Talisman of Conviction (+5 Brave / +5 Faith) compounding the
//     Brave-roll bias, Silvered Vest (+30 MP / +2 MA mage-hybrid armor),
//     Diamond Bracelet for status defense. Earth Communion as a cross-
//     class Support pickup (× 1.25 status application chance on every
//     cast). Lightning Spells as the secondary.
//   - Aethurge "Aldric" — classic Lightning glass cannon: Staff of
//     Power's MA buff (in exchange for × 1.20 MP cost) plus S51's
//     Tome of Power (+1 MA / +10 MP) stacking another MA bump and
//     buying back the MP tax, Wizard's Robe, Pointy Hat, Rasp Pendant
//     (10% damage-to-MP-drain on hit). Fire Spells as the secondary.
//   - Hydrologist "Octavia" runs the team's most layered loadout:
//     Magus Crown's +1 secondary-command-set capacity opens *two*
//     secondary sets (Alchemy + Earth Spells), and Augmentor's +1
//     Support-bucket capacity fits four Support passives (Flow State
//     + Field Kit + Conductor + Earth Communion). Wand of the Depths
//     + S51's Battle Dictionary (+1 PA / +1 horizontal range / +1 AoE
//     vertical tolerance on magical) + Sorcerer's Robe (Auto-Shell
//     grant) — the Battle Dictionary's +1 horizontal range compounds
//     with the Wand of the Depths' existing +1 horizontal on water
//     casts for a +2 horizontal reach on every Water Spell.
//
// One of every magic school + Knight, no class duplication — the team
// can answer almost any matchup with the right cast picked from the
// right cross-school secondary.

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

export const mageWar: BuiltTeam = {
  name: 'Mage War',
  units: [
    {
      name: 'Grant',
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
            abilityId('combat_focus'),
            abilityId('earth_resilience'),
            abilityId('speed_save'),
          ],
          [bucketId('support')]: [
            abilityId('martial_expertise'),
            abilityId('field_kit'),
            abilityId('earth_communion'),
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
        leftHand: itemId('escutcheon'),
        rightHand: itemId('flametongue'),
        headgear: itemId('steel_helm'),
        armor: itemId('war_plate'),
        accessory: itemId('tintinibar'),
      },
    },
    {
      name: 'Roderic',
      classId: classId('earth_mage'),
      baseStats: buildBaseStats(classId('earth_mage'), BRAVE, FAITH, 24),
      level: 24,
      loadout: {
        actionBuckets: {
          [bucketId('first_action')]: [commandSetId('earth_spells')],
          [bucketId('secondary_command_sets')]: [commandSetId('water_spells')],
        },
        passiveBuckets: {
          [bucketId('reaction')]: [
            abilityId('earth_resilience'),
            abilityId('smolder'),
            abilityId('tidal_pull'),
          ],
          [bucketId('support')]: [
            abilityId('earth_communion'),
            abilityId('conductor'),
            abilityId('flow_state'),
          ],
          [bucketId('movement')]: [
            abilityId('bedrock_stride'),
            abilityId('tidewalker'),
            abilityId('quickstep'),
            abilityId('field_recovery'),
          ],
        },
      },
      equipment: {
        leftHand: itemId('livre_of_urgency'),
        rightHand: itemId('wand_of_deepwood'),
        headgear: itemId('guard_cap'),
        armor: itemId('dark_robe'),
        accessory: itemId('capacitor_ring'),
      },
    },
    {
      name: 'Bethla',
      classId: classId('fire_mage'),
      baseStats: buildBaseStats(classId('fire_mage'), BRAVE, FAITH, 26),
      level: 26,
      loadout: {
        actionBuckets: {
          [bucketId('first_action')]: [commandSetId('fire_spells')],
          [bucketId('secondary_command_sets')]: [commandSetId('lightning_spells')],
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
            abilityId('earth_communion'),
          ],
          [bucketId('movement')]: [
            abilityId('hotfoot'),
            abilityId('quickstep'),
            abilityId('tidewalker'),
            abilityId('fleet_of_foot'),
          ],
        },
      },
      equipment: {
        leftHand: itemId('talisman_of_conviction'),
        rightHand: itemId('wand_of_lumen'),
        headgear: itemId('tricorn'),
        armor: itemId('silvered_vest'),
        accessory: itemId('diamond_bracelet'),
      },
    },
    {
      name: 'Aldric',
      classId: classId('lightning_mage'),
      baseStats: buildBaseStats(classId('lightning_mage'), BRAVE, FAITH, 23),
      level: 23,
      loadout: {
        actionBuckets: {
          [bucketId('first_action')]: [commandSetId('lightning_spells')],
          [bucketId('secondary_command_sets')]: [commandSetId('fire_spells')],
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
            abilityId('flow_state'),
          ],
          [bucketId('movement')]: [
            abilityId('quickstep'),
            abilityId('bedrock_stride'),
            abilityId('tidewalker'),
          ],
        },
      },
      equipment: {
        leftHand: itemId('tome_of_power'),
        rightHand: itemId('staff_of_power'),
        headgear: itemId('pointy_hat'),
        armor: itemId('wizards_robe'),
        accessory: itemId('rasp_pendant'),
      },
    },
    {
      name: 'Octavia',
      classId: classId('water_mage'),
      baseStats: buildBaseStats(classId('water_mage'), BRAVE, FAITH, 27),
      level: 27,
      loadout: {
        actionBuckets: {
          [bucketId('first_action')]: [commandSetId('water_spells')],
          // Magus Crown's +1 secondary-command-set capacity opens both
          // slots. Alchemy is the toolkit pivot; Earth Spells is the
          // control / sustain back-up.
          [bucketId('secondary_command_sets')]: [
            commandSetId('alchemy'),
            commandSetId('earth_spells'),
          ],
        },
        passiveBuckets: {
          [bucketId('reaction')]: [
            abilityId('tidal_pull'),
            abilityId('smolder'),
            abilityId('speed_save'),
          ],
          [bucketId('support')]: [
            abilityId('flow_state'),
            abilityId('field_kit'),
            abilityId('conductor'),
            abilityId('earth_communion'),
          ],
          [bucketId('movement')]: [
            abilityId('tidewalker'),
            abilityId('quickstep'),
            abilityId('hotfoot'),
          ],
        },
      },
      equipment: {
        leftHand: itemId('battle_dictionary'),
        rightHand: itemId('wand_of_depths'),
        headgear: itemId('magus_crown'),
        armor: itemId('sorcerers_robe'),
        accessory: itemId('augmentor'),
      },
    },
  ],
};
