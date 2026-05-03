// Cure — placeholder healing ability. Active (would live in a White
// Magic command set when one exists). Healing is the damage pipeline
// with tag inversion; session 8 wires it. Session 7 carries the
// targeting/charge/MP/effects shape so the catalog stays loadable
// end-to-end.

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
  targeting: {
    kind: 'single_unit',
    range: { horizontal: 4, vertical: 3 },
    rangeMode: 'arc',
  },
  chargeTicks: 0,
  mpCost: 4,
  effects: {
    damage: { tags: ['holy', 'healing'] },
  },
};
