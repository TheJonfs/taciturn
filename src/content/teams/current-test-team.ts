// "Current Test Team" — the adjusted Blue River Ridge roster as a
// loadable team builder template.
//
// This is the unique-per-team-compliant Blue team from
// `river-ridge-battle.ts` (Session 36's loadout adjustment), expressed
// as a `BuiltTeam`. Loading it into the team builder reproduces the
// roster the project has been playtesting. The class loadouts are
// reused verbatim from `demo.ts`; the equipment mirrors
// `river-ridge-battle.ts`'s `RIVER_RIDGE_EQUIPMENT` for team_a.
//
// `current-test-team.test.ts` asserts this stays in sync with
// `riverRidgeBattle`'s Blue team — if the battle config's Blue loadouts
// change, this template must follow.

import { classId, itemId } from '@engine/index.ts';
import {
  FIRE_MAGE_LOADOUT,
  KNIGHT_LOADOUT,
  LIGHTNING_MAGE_LOADOUT,
  WATER_MAGE_LOADOUT,
} from '../battles/demo.ts';
import { buildBaseStats, type BuiltTeam } from './built-team.ts';

// Brave / Faith match the placement default the demo roster uses
// (`SHARED_STAT_DEFAULTS` in `demo.ts`).
const BRAVE = 70;
const FAITH = 70;

export const currentTestTeam: BuiltTeam = {
  name: 'Current Test Team',
  units: [
    {
      name: 'Knight',
      classId: classId('knight'),
      baseStats: buildBaseStats(classId('knight'), BRAVE, FAITH),
      loadout: KNIGHT_LOADOUT,
      equipment: {
        leftHand: itemId('managuard'),
        rightHand: itemId('bolt_hammer'),
        headgear: itemId('focus_band'),
        armor: itemId('silvered_vest'),
        accessory: itemId('tintinibar'),
      },
    },
    {
      name: 'Water Mage',
      classId: classId('water_mage'),
      baseStats: buildBaseStats(classId('water_mage'), BRAVE, FAITH),
      loadout: WATER_MAGE_LOADOUT,
      equipment: {
        leftHand: null,
        rightHand: itemId('wand_of_depths'),
        headgear: itemId('pointy_hat'),
        armor: itemId('sorcerers_robe'),
        accessory: itemId('lightfoot'),
      },
    },
    {
      name: 'Lightning Mage',
      classId: classId('lightning_mage'),
      baseStats: buildBaseStats(classId('lightning_mage'), BRAVE, FAITH),
      loadout: LIGHTNING_MAGE_LOADOUT,
      equipment: {
        leftHand: null,
        rightHand: itemId('flametongue'),
        headgear: itemId('magus_crown'),
        armor: itemId('wizards_robe'),
        accessory: itemId('rasp_pendant'),
      },
    },
    {
      name: 'Fire Mage',
      classId: classId('fire_mage'),
      baseStats: buildBaseStats(classId('fire_mage'), BRAVE, FAITH),
      loadout: FIRE_MAGE_LOADOUT,
      equipment: {
        leftHand: null,
        rightHand: null,
        headgear: itemId('guard_cap'),
        armor: itemId('battle_gear'),
        accessory: null,
      },
    },
  ],
};
