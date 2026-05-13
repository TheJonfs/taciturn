// Tagged Resistance Shift (Session 31) — parametric per-tag resistance
// modifier carried as a status instance.
//
// First v1 consumers: Wand of the Depths (+25 Fire / -25 Lightning on
// hit) and Wand of the Deepwood (+25 Lightning / -25 Fire on hit) per
// `docs/twentyOneDesign/mage-war-equipment.md`. The applying ability
// authors the per-instance deltas and a display name on the
// `StatusEffectSpec.customState`; this status registers a single
// `modifyResistance` handler that reads from `ctx.instance.customState`
// per fire.
//
// Stacking — `STACK_INDEPENDENT`. Each application is a distinct
// instance and contributes one handler to the `modifyResistance`
// additive chain. Two Wand of the Depths hits → two instances → +50
// Fire / -50 Lightning. Wand of the Depths + Wand of the Deepwood on
// the same target → instances cancel additively to zero net.
//
// Duration — `permanent`. The equipment doc spec is "persists for the
// duration of the battle." `permanent` matches: never decremented by
// time, never ticks, removable only by explicit dispel / forced
// removal. The status's `aiHints.polarity` is `'debuff'` because v1's
// applying abilities (per Session 31, decision 8) target enemies only;
// when ally-targetability ships (deferred), polarity may need to read
// off the *net* effect (signedMax of deltas vs. target's intent), but
// for v1 the simple debuff read is correct.
//
// `dispellable` is included so a future Dispel-class ability can clear
// the shift — matches Shell / Protect's tag set.

import {
  statusHook,
  statusTypeId,
  type DamageTag,
  type StatusEffectType,
} from '@engine/index.ts';

// Per-instance customState carried by every application. The applying
// ability authors both fields on its `StatusEffectSpec.customState`.
interface TaggedResistanceShiftCustomState extends Readonly<Record<string, unknown>> {
  // Signed deltas per damage tag. Composed additively with the unit's
  // native resistance and with other instances on the same target via
  // `runModifyResistance`. Example: `{ fire: 25, lightning: -25 }`
  // (Wand of the Depths).
  readonly tagDeltas: Readonly<Partial<Record<DamageTag, number>>>;
  // Display name for the action log / UI badge. Per-instance so two
  // different applying abilities can read distinctly ("Wand of the
  // Depths Resonance" vs "Wand of the Deepwood Resonance") even though
  // the underlying status type is shared.
  readonly displayName: string;
}

function readTagDeltas(
  customState: Readonly<Record<string, unknown>> | undefined,
): Readonly<Partial<Record<DamageTag, number>>> {
  if (customState === undefined) return {};
  const candidate = (customState as TaggedResistanceShiftCustomState).tagDeltas;
  // Defensive read — content authoring should always provide a valid
  // map. An absent / malformed customState produces a no-op handler
  // rather than a runtime error, since the status carries no other
  // meaningful effect to surface.
  return candidate !== null && typeof candidate === 'object' ? candidate : {};
}

export const taggedResistanceShift: StatusEffectType = {
  id: statusTypeId('tagged_resistance_shift'),
  name: 'Resonance',
  tags: ['negative', 'dispellable'],
  durationMode: 'permanent',
  stackingRule: 'STACK_INDEPENDENT',
  aiHints: { polarity: 'debuff' },
  hooks: [
    statusHook('modifyResistance', (args, ctx) => {
      const deltas = readTagDeltas(ctx.instance.customState);
      const delta = deltas[args.tag];
      if (delta === undefined) return args.baseValue;
      return args.baseValue + delta;
    }),
  ],
};
