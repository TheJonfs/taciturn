// Lightning Spells — Lightning Mage's First Action command set.
//
// Five active abilities ship: Strike (raw-damage premium per session 20
// tuning), Static Embrace (Crit_modifier on ally), Chain Lightning
// (diamond-r1 AoE with chainBonus scaling), Magnetic Mark (Vulnerable
// debuff with deliberate slow actionSpeed for follow-up planning),
// Storm Caller (Ultimate ×3 with 25% maxHp self-cost).
//
// The reaction (discharge) and support (conductor) live in their
// respective passive buckets, not here.

import {
  abilityId,
  commandSetId,
  type CommandSetDefinition,
} from '@engine/index.ts';

export const lightningSpells: CommandSetDefinition = {
  id: commandSetId('lightning_spells'),
  name: 'Lightning Spells',
  members: [
    abilityId('lightning_strike'),
    abilityId('static_embrace'),
    abilityId('chain_lightning'),
    abilityId('magnetic_mark'),
    abilityId('storm_caller'),
  ],
  baseCost: 1,
};
