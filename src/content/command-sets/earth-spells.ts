// Earth Spells — Earth Mage's First Action command set.
//
// Session 16 shipped the 3 non-AoE actives (strike, blessing, curse).
// Session 17b adds the AoE (earth_quake) and Ultimate (earth_cataclysm)
// to round out Earth's First Action kit. The reaction (earth_resilience)
// and support (earth_communion) live in their respective passive
// buckets, not here.

import {
  abilityId,
  commandSetId,
  type CommandSetDefinition,
} from '@engine/index.ts';

export const earthSpells: CommandSetDefinition = {
  id: commandSetId('earth_spells'),
  name: 'Earth Spells',
  members: [
    abilityId('earth_strike'),
    abilityId('earth_blessing'),
    abilityId('earth_curse'),
    abilityId('earth_quake'),
    abilityId('earth_cataclysm'),
  ],
  baseCost: 1,
};
