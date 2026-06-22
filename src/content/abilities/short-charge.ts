// Short Charge — Enchanter's Support (S72). Free and native on the
// Enchanter; cross-class costs 1. A *universal* charged-action-speed boost:
// it speeds every charged ability the wielder casts (any class, any tag),
// via the `modifyActionSpeed` chain hook (the same surface Livre of Urgency
// and Wand of Deepwood use). Instant abilities (actionSpeed 0) are untouched
// — `0 × multiplier = 0` stays instant, preserving the charged-vs-instant
// invariant `computeBaseActionSpeed` guards.
//
// FORM: multiplier ×1.33 (S72 chunk-2 analysis / brief D4; magnitude set by
// Chris at the chunk-2 checkpoint). The two candidate forms behave very
// differently against the actSpd tier spread (basics ~30, ultimates ~18,
// Magnetic Mark 35):
//
//   flat add (+10):  30 → 40 (×1.33 faster), 18 → 28 (×1.56 faster).
//                    Disproportionately accelerates slow ultimates — a +10
//                    on an 18-actSpd ultimate is a 56% speedup but only 33%
//                    on a 30 basic. It *front-loads* the slowest, most
//                    powerful spells, flattening the deliberate fast-basic /
//                    slow-ultimate tier separation the kits are tuned around.
//   multiplier (×1.33): 30 → 39, 18 → 23, 25 → 33. An *even* proportional
//                    speedup that preserves the tier ordering — every charge
//                    resolves ~33% sooner relative to where it started, and
//                    the ultimate stays the slowest thing on the board.
//
// The multiplier is the chosen form: it matches FFT's proportional
// charge-time spirit and doesn't distort the actSpd tuning the brief warns
// about ("Short Charge over-accelerating ultimates if flat-add is chosen").
// Floored to keep CT accumulation integer (30 → 39, 18 → 23). The magnitude
// is a single-constant tuning lever if playtest wants it stronger / milder.

import {
  abilityId,
  bucketId,
  passiveHook,
  type PassiveAbilityDefinition,
} from '@engine/index.ts';

const SHORT_CHARGE_MULTIPLIER = 1.33;

export const shortCharge: PassiveAbilityDefinition = {
  id: abilityId('short_charge'),
  name: 'Short Charge',
  kind: 'passive',
  bucket: bucketId('support'),
  baseCost: 1,
  availability: 'available',
  hooks: [
    passiveHook('modifyActionSpeed', (args) =>
      Math.floor(args.baseActionSpeed * SHORT_CHARGE_MULTIPLIER),
    ),
  ],
};
