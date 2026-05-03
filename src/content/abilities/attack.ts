// Attack — the basic melee strike that lives in Knight's Battle Skill.
// Session 5 carried the slot/cost shape; session 7 adds the targeting,
// charge, MP, and damage declaration. Damage parameters (PA-derived,
// melee weapon damage) drive a real pipeline starting session 8 — for
// now the `damage` tag declaration is metadata; UseAbility's reducer
// applies status effects and ignores damage until the pipeline lands.

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
    damage: { tags: ['physical', 'weapon'] },
  },
};
