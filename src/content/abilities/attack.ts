// Attack — the basic melee strike that lives in Knight's Battle Skill.
// Per design, every active ability is priced in its containing command
// set's bucket; the v1 active baseline is capacity 1 / cost 1. Damage
// parameters (PA-derived, melee weapon damage) land with session 8.

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
};
