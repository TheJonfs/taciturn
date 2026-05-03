// Cure — placeholder healing ability. Active (would live in a White
// Magic command set when one exists). Healing is the damage pipeline
// with tag inversion: the 'healing' tag triggers the MA × power formula
// at the base stage and flips the finalize stage's polarity (HP rises
// rather than falls). The cap stage clamps to (maxHp − currentHp) so
// healing never overflows.

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
    damage: {
      tags: ['holy', 'healing'],
      power: 5,
      variance: { min: 0.95, max: 1.05 },
    },
  },
};
