// Shadow Arts — the Assassin's signature command set (Session 42). Four
// instant, ranged, no-damage status-application abilities that define the
// Assassin's control / permadebuff identity:
//   - Shadow Stitch — Stop (lock a target out of its turn)
//   - Blowdart — Poison (sustained chip pressure)
//   - Undermine — Brave −20 (permanent; suppress reactions / Brave gates)
//   - Sow Doubt — Faith −20 (permanent; soften an enemy caster)
// All four are First Action members on the same set, so an Assassin with
// Shadow Arts equipped picks any of them from the action menu on its
// First Action.

import {
  abilityId,
  commandSetId,
  type CommandSetDefinition,
} from '@engine/index.ts';

export const shadowArts: CommandSetDefinition = {
  id: commandSetId('shadow_arts'),
  name: 'Shadow Arts',
  members: [
    abilityId('shadow_stitch'),
    abilityId('blowdart'),
    abilityId('undermine'),
    abilityId('sow_doubt'),
    // TABA: Sera's Hamstring — a Shadow Arts member so she can wield it; gated
    // to Sera in campaign (unit-restricted component + usableActives), hidden
    // from the Mage War picker (availability 'hidden').
    abilityId('hamstring'),
  ],
  baseCost: 1,
  availability: 'available',
};
