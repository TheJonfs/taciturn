// Earth Spells — Earth Mage's First Action command set.
//
// Session 16 ships the 5 non-AoE / non-Ultimate abilities:
//   - earth_strike  — Base spell (charged, magical damage + Move/Jump debuff)
//   - earth_blessing — Buff (charged, Regen on ally)
//   - earth_curse   — Debuff (charged, Blind + Silence)
//
// The reaction (earth_resilience) and support (earth_communion) live
// in their respective passive buckets, not here.
//
// Session 17 will add the AoE spell (cross damage with debuff) and
// Ultimate (cross damage applying Poison + Don't Act + Don't Move) to
// this command set.

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
  ],
  baseCost: 1,
};
