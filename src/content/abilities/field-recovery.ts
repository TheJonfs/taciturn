// Field Recovery — Alchemist Movement (Session 39b).
//
// Restore (tiles moved)² HP at the end of intentional movement. The
// `onMoveCompleted` hook (S39b engine addition) fires once after a
// Move action commits with the tilesMoved count. Field Recovery
// emits a `system_heal` of `tilesMoved²` HP against the mover.
//
// Square scaling means Move-boosting equipment (Boots of Haste,
// Sorcerer's Robe Move +1) is dramatically more valuable for the
// Alchemist than for other classes — flagged in the S39 brief's
// watch-fors. Calibrated against the existing Cure (MA × 5 magical
// healing): a Move-4 Alchemist heals 16 HP per full move, comparable
// to a Cure cast but without the MP cost and on the move turn rather
// than the act turn.
//
// Intentional-only gating is structural: knockback / pull go through
// `applyKnockback`, not `reduceMove`, so they don't fire the hook.
// Per-turn ordering: a unit that moves then acts gets the heal before
// the act; a unit that acts then moves gets the heal after the act.
// HP cap is enforced by `reduceSystemHeal` (no overheal).

import {
  abilityId,
  bucketId,
  passiveHook,
  type PassiveAbilityDefinition,
} from '@engine/index.ts';

const FIELD_RECOVERY_ABILITY_ID = abilityId('field_recovery');

export const fieldRecovery: PassiveAbilityDefinition = {
  id: FIELD_RECOVERY_ABILITY_ID,
  name: 'Field Recovery',
  kind: 'passive',
  bucket: bucketId('movement'),
  baseCost: 1,
  availability: 'available',
  hooks: [
    passiveHook('onMoveCompleted', (args) => {
      const amount = args.tilesMoved * args.tilesMoved;
      if (amount <= 0) return [];
      return [
        {
          type: 'system_heal',
          source: 'system',
          payload: {
            targetId: args.unit.id,
            amount,
            tags: ['healing'],
            source: {
              kind: 'movement_passive',
              abilityId: FIELD_RECOVERY_ABILITY_ID,
              unitId: args.unit.id,
            },
          },
        },
      ];
    }),
  ],
};
