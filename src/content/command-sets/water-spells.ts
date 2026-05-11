// Water Spells — Water Mage's First Action command set.
//
// All five active abilities ship at once (parallel to Earth Spells'
// session-17b state): Strike (CT push damage rider), Surge (free-
// standing CT push buff), Wave (AoE damage + chance knockback),
// Brine (Speed Down debuff), Maelstrom (cone damage + always knockback).
//
// The reaction (tidal_pull) and support (flow_state) live in their
// respective passive buckets, not here.

import {
  abilityId,
  commandSetId,
  type CommandSetDefinition,
} from '@engine/index.ts';

export const waterSpells: CommandSetDefinition = {
  id: commandSetId('water_spells'),
  name: 'Water Spells',
  members: [
    abilityId('water_strike'),
    abilityId('tide_surge'),
    abilityId('tidal_wave'),
    abilityId('brine'),
    abilityId('maelstrom'),
  ],
  baseCost: 1,
  availability: 'available',
};
