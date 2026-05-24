// "Defensive Front" — attrition / sustain template (Session 38; retrofit
// for Session 39b).
//
// Pre-S39b version used Earth's Blessing's Regen as a stopgap for
// healing (cross-class Earth Spells on the Knight + Water Mage). Now
// that the Alchemist ships with Compound + Throw Item + Phoenix Down,
// the team trades the Earth-Spells stopgap for a real Alchemist:
//   - Halric (Knight) — front-line wall, drops the Earth Spells
//     secondary (open slot for future content).
//   - Beorn (Alchemist) — replaces the second Earth Mage's Regen role
//     with Potion / Phoenix Down sustain. Position mid-line so Throw
//     Item's 3h × 3v range reaches both front and back.
//   - Ysolde (Water Mage) — same defensive identity; drops the second
//     Earth Spells command set (Alchemist handles healing now).
//   - Auralia (Fire Mage) — unchanged from the S38 build.
//
// Knight + Crusader's Helm still exercises the Faith-bump hybrid
// reading from S37; the Alchemist's heal-throw economy doesn't
// interact with the Knight's Faith (Throw Item's Potion HP scales
// off the Alchemist's PA, not the recipient's Faith).

import { classId, itemId } from '@engine/index.ts';
import {
  ALCHEMIST_LOADOUT,
  FIRE_MAGE_LOADOUT,
  KNIGHT_LOADOUT,
  WATER_MAGE_LOADOUT,
} from '../battles/demo.ts';
import { buildBaseStats, type BuiltTeam } from './built-team.ts';

const BRAVE = 70;
const FAITH = 70;

export const defensiveFront: BuiltTeam = {
  name: 'Defensive Front',
  units: [
    {
      name: 'Halric',
      classId: classId('knight'),
      baseStats: buildBaseStats(classId('knight'), BRAVE, FAITH, 25),
      level: 25,
      loadout: KNIGHT_LOADOUT,
      equipment: {
        leftHand: itemId('warriors_aegis'),
        rightHand: itemId('long_sword'),
        headgear: itemId('crusaders_helm'),
        armor: itemId('war_plate'),
        accessory: itemId('tintinibar'),
      },
    },
    {
      name: 'Beorn',
      classId: classId('alchemist'),
      baseStats: buildBaseStats(classId('alchemist'), BRAVE, FAITH, 24),
      level: 24,
      loadout: ALCHEMIST_LOADOUT,
      equipment: {
        leftHand: null,
        // Universal weapon (per S39 D2). War Axe's asymmetric variance
        // pairs with Beorn's PA-second role — he'll take the
        // occasional swing between Compounds.
        rightHand: itemId('war_axe'),
        // Lookout's Hood: Universal +1 Speed head (S37) — useful for
        // the support role to act more often.
        headgear: itemId('lookouts_hood'),
        // Battle Gear: Universal body armor.
        armor: itemId('battle_gear'),
        // Diamond Bracelet: Universal accessory.
        accessory: itemId('diamond_bracelet'),
      },
    },
    {
      name: 'Ysolde',
      classId: classId('water_mage'),
      baseStats: buildBaseStats(classId('water_mage'), BRAVE, FAITH, 26),
      level: 26,
      loadout: WATER_MAGE_LOADOUT,
      equipment: {
        leftHand: null,
        rightHand: itemId('wand_of_depths'),
        headgear: itemId('magus_crown'),
        armor: itemId('dark_robe'),
        accessory: itemId('lightfoot'),
      },
    },
    {
      name: 'Auralia',
      classId: classId('fire_mage'),
      baseStats: buildBaseStats(classId('fire_mage'), BRAVE, FAITH, 23),
      level: 23,
      loadout: FIRE_MAGE_LOADOUT,
      equipment: {
        leftHand: null,
        rightHand: itemId('staff_of_abundance'),
        headgear: itemId('tricorn'),
        armor: itemId('light_robe'),
        accessory: itemId('augmentor'),
      },
    },
  ],
};
