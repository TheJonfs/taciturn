// Cure — placeholder healing ability. Active (would live in a White
// Magic command set when one exists). Effects are filled in by the
// damage pipeline (session 8); session 5 only carries the slot/cost
// shape so the catalog stays loadable end-to-end.

import {
  abilityId,
  bucketId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const cure: ActiveAbilityDefinition = {
  id: abilityId('cure'),
  name: 'Cure',
  kind: 'active',
  bucket: bucketId('second_action'),
  baseCost: 1,
};
