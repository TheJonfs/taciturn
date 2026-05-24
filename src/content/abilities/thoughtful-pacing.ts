// Thoughtful Pacing — the Calculator's Movement passive (Session 49).
// Free and native on the Calculator; cross-class costs 1.
//
// Restore `2 × tilesMoved` MP at the end of each Move action. The
// `onMoveCompleted` hook fires once per Move action with the tile
// count; a Calculator that moves once for 2 tiles refunds 4 MP, a
// move-2-then-move-3 turn refunds 4 + 6 = 10 MP across both Move
// commits. Mirrors Healthy Stride's (`tilesMoved²` HP) structural
// pattern, but linear scaling on the MP axis.
//
// Pairs naturally with Mathematician: the Calculator that walks each
// turn refunds enough MP to sustain another Math cast a few turns
// later, even after the per-target Mathematician multiplier.
//
// Intentional-only gating is structural: knockback / pull bypass
// `reduceMove` and don't fire the hook. The cap at maxMp is enforced
// by `reduceSystemMpRestore`.

import {
  abilityId,
  bucketId,
  passiveHook,
  type PassiveAbilityDefinition,
  type ProposedAction,
} from '@engine/index.ts';

const THOUGHTFUL_PACING_ID = abilityId('thoughtful_pacing');
const MP_PER_TILE = 2;

export const thoughtfulPacing: PassiveAbilityDefinition = {
  id: THOUGHTFUL_PACING_ID,
  name: 'Thoughtful Pacing',
  kind: 'passive',
  bucket: bucketId('movement'),
  baseCost: 1,
  availability: 'available',
  hooks: [
    passiveHook('onMoveCompleted', (args): readonly ProposedAction[] => {
      const amount = args.tilesMoved * MP_PER_TILE;
      if (amount <= 0) return [];
      return [
        {
          type: 'system_mp_restore',
          source: 'system',
          payload: {
            targetId: args.unit.id,
            amount,
            source: {
              kind: 'movement_passive',
              abilityId: THOUGHTFUL_PACING_ID,
              unitId: args.unit.id,
            },
          },
        },
      ];
    }),
  ],
};
