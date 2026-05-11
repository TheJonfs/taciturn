// Damage Reduction — Knight support passive. All incoming physical
// damage is reduced by 25%. First consumer of an `onDamageReceived`
// handler that returns a multiplier — composes with the existing
// resistance / variance / clamp stages without a new hook (per
// ADR-0028's "compose via existing hook" decision).
//
// Numbers per session 17c plaintext review:
//   - cost 2 (out of 3 Support capacity): meaningful tradeoff against
//     other passives.
//   - 25% reduction: 0.75× multiplier on physical damage.
//   - Physical-only gating: keeps it from becoming a generic tank
//     passive that overshadows class-specific magical defense.
//
// Composes with:
//   - Resistance: applies multiplicatively. A target with 50% physical
//     resistance plus Damage Reduction takes (1 − 0.5) × 0.75 = 0.375×.
//   - Earth Resilience: independent — Earth Resilience is a self-buff
//     stat boost on damage; Damage Reduction is a flat damage cut.
//     Both can stack on a unit if the loadout supports it.
//   - Counter (reaction-fired damage): reactions still flow through
//     `onDamageReceived` against their target's hooks, so a Knight
//     with Damage Reduction takes 0.75× damage from incoming Counters
//     too.

import {
  abilityId,
  bucketId,
  passiveHook,
  type PassiveAbilityDefinition,
} from '@engine/index.ts';

export const damageReduction: PassiveAbilityDefinition = {
  id: abilityId('damage_reduction'),
  name: 'Damage Reduction',
  kind: 'passive',
  bucket: bucketId('support'),
  baseCost: 2,
  availability: 'available',
  hooks: [
    passiveHook('onDamageReceived', (args) => {
      if (!args.ctx.damageTags.has('physical')) return args.ctx;
      return {
        ctx: {
          ...args.ctx,
          multipliers: [...args.ctx.multipliers, { source: 'damage_reduction', factor: 0.75 }],
        },
      };
    }),
  ],
};
