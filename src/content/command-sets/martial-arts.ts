// Martial Arts — the Monk's command set (Session 76). The utility/elemental
// flow: Chakra (PA-scaled HP+MP self-sustain) plus the four elemental Fists,
// each a `PA × coefficient` element-tagged strike that sets a mutually-
// exclusive stance and carries a rider:
//   - Foxfire       → Fox Stance (+Fire/−Earth),    50% Burn
//   - Bear's Heave  → Bear Stance (+Earth/−Lightning), grapple-throw
//   - Storm Stoop   → Falcon Stance (+Lightning/−Water), line reach
//   - Serpent's Coil→ Serpent Stance (+Water/−Fire), Speed×2 CT refund
//
// The basic Attack (the PA² barehanded punch) comes from the class's
// freeAbilities, not here (the battle-skill convention) — leaning on it means
// NO stance is up, the central tension of the kit.

import {
  abilityId,
  commandSetId,
  type CommandSetDefinition,
} from '@engine/index.ts';

export const martialArts: CommandSetDefinition = {
  id: commandSetId('martial_arts'),
  name: 'Martial Arts',
  members: [
    abilityId('chakra'),
    abilityId('foxfire'),
    abilityId('bears_heave'),
    abilityId('storm_stoop'),
    abilityId('serpents_coil'),
  ],
  baseCost: 1,
  availability: 'available',
};
