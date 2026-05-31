// Fire Spells — Fire Mage's First Action command set.
//
// All five active abilities ship at once: Strike (linked PA/MA debuff
// rider), Embrace (linked PA/MA buff on ally), Storm (cross AoE; grows
// to cross r2 with Aether Bloom equipped), Spark (2-stack Burn bomb),
// Flame Lance (line-shape Ultimate with applyAlways Burn rider).
//
// The reaction (smolder) and supports (ignition, aether_bloom) live in
// their respective passive buckets, not here.

import {
  abilityId,
  commandSetId,
  type CommandSetDefinition,
} from '@engine/index.ts';

export const fireSpells: CommandSetDefinition = {
  id: commandSetId('fire_spells'),
  name: 'Pyromancy',
  members: [
    abilityId('fire_strike'),
    abilityId('fire_embrace'),
    abilityId('fire_storm'),
    abilityId('spark'),
    abilityId('flame_lance'),
  ],
  baseCost: 1,
  availability: 'available',
};
