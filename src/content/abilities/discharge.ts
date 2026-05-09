// Discharge — Lightning Mage's Reaction.
//
// On taking damage from a non-healing-tagged hit (physical OR magical
// per session 20's magical-reactions work item), retaliates with
// `discharge_strike` (instant single-target magical lightning damage,
// power 4) targeting the attacker. The strike's MA reads from the
// reactor (the Lightning Mage who got hit), so a high-MA Lightning
// Mage's Discharge bites harder.
//
// Per session 20 plaintext review:
//   - baseCost 2 (mid-tier reaction; parity with Smolder)
//   - free for Lightning Mage (listed in `freeAbilities`)
//   - Brave-gated trigger per ADR-0021 — fires probabilistically at
//     lower Brave; deterministic at Brave 100
//   - Compiled via `compileReaction` (per ADR-0024):
//     - triggerOn: ['onActionTargeted']
//     - triggerCondition.damageTagsNone: ['healing'] — heals don't
//       trigger retaliation
//     - triggerCondition.minDamage: 1 — only fires when damage actually
//       lands (a whiffed swing doesn't trigger Discharge)
//     - effect: use_ability emitting `discharge_strike` against the
//       attacker
//
// Magical-reaction confirmation: by NOT setting `damageTagsAny`, the
// trigger condition matches physical AND magical incoming damage. This
// is the v1 confirmation that the reaction surface is tag-agnostic by
// default — Counter's choice to gate on `'physical'` is per-content,
// not engine-imposed.

import {
  abilityId,
  bucketId,
  compileReaction,
  type PassiveAbilityDefinition,
} from '@engine/index.ts';

export const discharge: PassiveAbilityDefinition = {
  id: abilityId('discharge'),
  name: 'Discharge',
  kind: 'passive',
  bucket: bucketId('reaction'),
  baseCost: 2,
  tags: ['magical', 'lightning'],
  hooks: compileReaction({
    triggerOn: ['onActionTargeted'],
    triggerCondition: {
      type: 'damage_received',
      damageTagsNone: ['healing'],
      minDamage: 1,
    },
    effects: [
      {
        kind: 'use_ability',
        abilityId: abilityId('discharge_strike'),
        targetSelector: 'attacker',
      },
    ],
  }),
};
