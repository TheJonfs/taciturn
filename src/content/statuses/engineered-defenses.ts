// Engineered Defenses — multi-axis defensive buff applied by the
// Calculator's Math ability of the same name (Session 49).
//
// Per the brief / blueprint, each successful application adds to the
// target:
//   - +10 to each elemental resistance (fire / water / earth / lightning
//     / holy / dark) — registered via `modifyResistance`, gated on the
//     six elemental DamageTags.
//   - +5% to evasion in every facing (front / side / back) — registered
//     via `modifyEvasion`, gated on all three facings.
//
// Stacking: STACK_INDEPENDENT per Chris's settling (Brief D7). Each
// application is a distinct instance; two applications on the same
// target → +20 per element, +10% per facing. Bounded only by the
// Faith-gated 80% base chance × the cluster size on each cast — Chris
// will stress-test for runaway compounding.
//
// Polarity / duration: `positive`, `permanent` (rest of battle). Per
// ADR-0079, permanent + positive means Remedy (which clears
// negative-polarity statuses) doesn't touch it, and the buff persists
// through KO recovery.
//
// Per-stack magnitudes are read from `defaultMagnitude` (1 = "one
// application's worth"). The handlers multiply the magnitude into the
// canonical per-stack contributions (10 per resistance, 5 per evasion
// facing), so a future content consumer could override magnitude for
// half-strength / double-strength variants without changing the handler
// shape.

import {
  statusHook,
  statusTypeId,
  type DamageTag,
  type StatusEffectType,
} from '@engine/index.ts';

const ELEMENTAL_TAGS: ReadonlySet<DamageTag> = new Set([
  'fire',
  'water',
  'earth',
  'lightning',
  'holy',
  'dark',
]);

const RESISTANCE_PER_STACK = 10;
const EVASION_PER_STACK = 5;

export const engineeredDefenses: StatusEffectType = {
  id: statusTypeId('engineered_defenses'),
  name: 'Engineered Defenses',
  tags: ['positive', 'dispellable'],
  durationMode: 'permanent',
  stackingRule: 'STACK_INDEPENDENT',
  defaultMagnitude: 1,
  aiHints: { polarity: 'buff' },
  hooks: [
    statusHook('modifyResistance', (args, ctx) => {
      if (!ELEMENTAL_TAGS.has(args.tag)) return args.baseValue;
      const magnitude = ctx.instance.magnitude ?? 1;
      return args.baseValue + RESISTANCE_PER_STACK * magnitude;
    }),
    statusHook('modifyEvasion', (args, ctx) => {
      const magnitude = ctx.instance.magnitude ?? 1;
      return args.baseEvasion + EVASION_PER_STACK * magnitude;
    }),
  ],
};
