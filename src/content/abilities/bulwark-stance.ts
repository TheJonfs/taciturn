// Bulwark Stance — Knight movement passive. The Knight plants:
// trades -1 Move and -1 Jump for +20% MaxHP and +10 Front Evade. A
// "tank harder, move less" passive distinct from Move +1 / Float / Fly.
//
// Numbers per session 17c plaintext review:
//   - cost 2 (out of 3 Movement capacity): a meaningful tradeoff;
//     pairs with a cost-1 movement passive in a 3-capacity bucket.
//   - -1 Move, -1 Jump: composes additively through `modifyStatQuery`.
//   - +20% MaxHP: multiplicative composition through `modifyStatQuery`.
//     Composes after equipment's flat additives — equipment first,
//     then percentage. (Order matters; Bulwark's multiplier reads the
//     post-equipment max.)
//   - +10 Front Evade: composes additively through the new
//     `modifyEvasion` hook. Side and back evasion unchanged — this is
//     a "facing forward" stance.
//
// First consumer of `modifyEvasion` (per ADR-0028) — the hook ships
// in 17c specifically because Bulwark needs evasion to be a chained
// modifier rather than a flat read.

import {
  abilityId,
  bucketId,
  passiveHook,
  type PassiveAbilityDefinition,
} from '@engine/index.ts';

export const bulwarkStance: PassiveAbilityDefinition = {
  id: abilityId('bulwark_stance'),
  name: 'Bulwark Stance',
  kind: 'passive',
  bucket: bucketId('movement'),
  baseCost: 2,
  availability: 'available',
  hooks: [
    // -1 Move
    passiveHook('modifyStatQuery', (args) => {
      if (args.statName !== 'moveRange') return args.baseValue;
      return Math.max(0, args.baseValue - 1);
    }),
    // -1 Jump
    passiveHook('modifyStatQuery', (args) => {
      if (args.statName !== 'jump') return args.baseValue;
      return Math.max(0, args.baseValue - 1);
    }),
    // +20% MaxHP (multiplicative — read after equipment's flat
    // additives so the percentage applies to the buffed total)
    passiveHook('modifyStatQuery', (args) => {
      if (args.statName !== 'maxHp') return args.baseValue;
      return args.baseValue * 1.2;
    }),
    // +10 Front Evade
    passiveHook('modifyEvasion', (args) => {
      if (args.facing !== 'front') return args.baseEvasion;
      return args.baseEvasion + 10;
    }),
  ],
};
