// Cure — placeholder stub used to verify the catalog loader end-to-end.
// Real ability content (cost, bucket, target rules, effects) arrives with
// the ability-slots and action-resolver sessions and the ability-catalog
// expansion pass.

import { abilityId, type AbilityDefinition } from '@engine/index.ts';

export const cure: AbilityDefinition = {
  id: abilityId('cure'),
  name: 'Cure',
};
