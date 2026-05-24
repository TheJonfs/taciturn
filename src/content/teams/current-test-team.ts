// "Aggro Knight Squad" — front-pressure tempo template (Session 38).
//
// Per S38 plan-review (Chris): the Aggro Knight Squad replaces the
// Session 36 / 37 placeholder roster at the same template id
// (`current-test-team`), so existing test references and state keys
// continue to resolve. Display name is "Aggro Knight Squad"; file path
// is retained.
//
// Concept: a Knight wedge with Spiked Mail's revenge tax engaging
// first, three burst-oriented Mages on the flanks. Drop Earth (control
// flavor) for Water (Tidal Wave AoE pressure). Showcases:
//   - Spiked Mail (S37) on the Knight
//   - Lightning glass cannon with Magus Crown second-command-set + Light
//     Robe specialist resist + Boots of Haste tempo
//   - Fire Mage Burn pressure via Flametongue + Tricorn Brave bump
//   - Water Mage AoE knockback with Sorcerer's Robe generalist defense
//
// Authored unit names use Ivalician picks; the team builder's auto-name
// system respects authored values on template load.

import { classId, commandSetId, itemId } from '@engine/index.ts';
import {
  FIRE_MAGE_LOADOUT,
  KNIGHT_LOADOUT,
  LIGHTNING_MAGE_LOADOUT,
  WATER_MAGE_LOADOUT,
} from '../battles/demo.ts';
import { buildBaseStats, type BuiltTeam } from './built-team.ts';

const BRAVE = 70;
const FAITH = 70;

// Lightning Mage with Magus Crown's +1 secondary command set capacity
// uses it for `fire_spells` rather than the (currently picker-hidden)
// `white_magic` default. Demonstrates the Magus Crown payoff in this
// template's archetype.
const AGGRO_LIGHTNING_LOADOUT = {
  ...LIGHTNING_MAGE_LOADOUT,
  actionBuckets: {
    ...LIGHTNING_MAGE_LOADOUT.actionBuckets,
    secondary_command_sets: [commandSetId('fire_spells')],
  },
};

export const currentTestTeam: BuiltTeam = {
  name: 'Aggro Knight Squad',
  units: [
    {
      name: 'Roderic',
      classId: classId('knight'),
      baseStats: buildBaseStats(classId('knight'), BRAVE, FAITH, 25),
      level: 25,
      loadout: KNIGHT_LOADOUT,
      equipment: {
        leftHand: itemId('managuard'),
        rightHand: itemId('war_axe'),
        headgear: itemId('lookouts_hood'),
        armor: itemId('spiked_mail'),
        accessory: itemId('diamond_bracelet'),
      },
    },
    {
      name: 'Caedric',
      classId: classId('lightning_mage'),
      baseStats: buildBaseStats(classId('lightning_mage'), BRAVE, FAITH, 24),
      level: 24,
      loadout: AGGRO_LIGHTNING_LOADOUT,
      equipment: {
        leftHand: null,
        rightHand: itemId('staff_of_power'),
        headgear: itemId('magus_crown'),
        armor: itemId('light_robe'),
        accessory: itemId('boots_of_haste'),
      },
    },
    {
      name: 'Severin',
      classId: classId('fire_mage'),
      baseStats: buildBaseStats(classId('fire_mage'), BRAVE, FAITH, 26),
      level: 26,
      loadout: FIRE_MAGE_LOADOUT,
      equipment: {
        leftHand: null,
        rightHand: itemId('flametongue'),
        headgear: itemId('tricorn'),
        armor: itemId('wizards_robe'),
        accessory: itemId('augmentor'),
      },
    },
    {
      name: 'Marisol',
      classId: classId('water_mage'),
      baseStats: buildBaseStats(classId('water_mage'), BRAVE, FAITH, 23),
      level: 23,
      loadout: WATER_MAGE_LOADOUT,
      equipment: {
        leftHand: null,
        rightHand: itemId('wand_of_depths'),
        headgear: itemId('pointy_hat'),
        armor: itemId('sorcerers_robe'),
        accessory: itemId('lightfoot'),
      },
    },
  ],
};

