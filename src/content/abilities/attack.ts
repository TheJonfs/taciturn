// Attack — the basic melee strike that lives in Knight's Battle Skill.
// Session 5 carried the slot/cost shape; session 7 added the targeting,
// charge, MP, and damage declaration. Session 8 wires it through the
// damage pipeline: 'physical' tag triggers the PA × power formula at
// the base stage. `power: 4` is a placeholder weapon power — when
// equipment lands, the equipped weapon's WP composes here instead of
// the ability's own coefficient.

import {
  abilityId,
  bucketId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const attack: ActiveAbilityDefinition = {
  id: abilityId('attack'),
  name: 'Attack',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  targeting: {
    kind: 'single_unit',
    range: { horizontal: 1, vertical: 3 },
    rangeMode: 'melee',
  },
  chargeTicks: 0,
  mpCost: 0,
  effects: {
    damage: {
      tags: ['physical', 'weapon'],
      power: 4,
      variance: { min: 0.9, max: 1.1 },
    },
  },
};
