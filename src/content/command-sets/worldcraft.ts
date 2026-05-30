// Worldcraft — the Terraformer's signature command set (Session 54). Five
// First Action members, all instant-cast terrain manipulation: Pillar / Pit
// (single-tile ±3), Hill / Valley (3×3 kernel raise/lower), and Barrier
// (a 3-5 tile destructible wall line). A Terraformer with Worldcraft equipped
// picks any of the five from the action menu on its First Action.
//
// Cross-class equippers receive the same five abilities at the secondary-
// command-set cost. Worldcraft effects are bounded by the per-unit
// `worldcraft_effect_cap` (base 2; Expert Former Support adds +2) — a
// cross-class user wanting the full 4-effect cap must also spend a Support
// slot on Expert Former.

import {
  abilityId,
  commandSetId,
  type CommandSetDefinition,
} from '@engine/index.ts';

export const worldcraft: CommandSetDefinition = {
  id: commandSetId('worldcraft'),
  name: 'Worldcraft',
  members: [
    abilityId('pillar'),
    abilityId('pit'),
    abilityId('hill'),
    abilityId('valley'),
    abilityId('barrier'),
  ],
  baseCost: 1,
  availability: 'available',
};
