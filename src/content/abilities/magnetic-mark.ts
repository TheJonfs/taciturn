// Magnetic Mark — Lightning Mage's Debuff.
//
// Charged single-enemy debuff that applies Vulnerable (×1.5 next
// damage taken, then auto-removes) on a Faith × MA roll. No damage
// component — the entire payload is the Vulnerable application.
//
// Per session 20 plaintext review:
//   - mpCost 8, actionSpeed 35 (deliberately *slower* than the Strike
//     tier — Chris explicitly chose 35 over 25-30 so the player has
//     time to plan a follow-up cast that exploits the mark before it's
//     consumed; the slow charge is part of the kit's tactical loop)
//   - baseChance 60 → with v1 demo Faith 80 → ~38% expected apply
//     against a non-resistant target
//   - range horizontal 4 / vertical 2, arc — parity with Lightning Strike
//
// Vulnerable's resistance tag is `'lightning'`, so a lightning-resistant
// target is harder to mark. The status itself is REFRESH-stacking and
// custom-trigger consumed on next damage — multiple Magnetic Marks
// against the same target don't compound.
//
// Tactical setup: Magnetic Mark (turn N) → Lightning Strike or Storm
// Caller (turn N+1) — the mark survives turn-end-to-turn-start
// transitions, and the second cast eats the ×1.5 multiplier.

import {
  abilityId,
  bucketId,
  statusTypeId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const magneticMark: ActiveAbilityDefinition = {
  id: abilityId('magnetic_mark'),
  name: 'Magnetic Mark',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  tags: ['magical', 'lightning'],
  targeting: {
    kind: 'single_unit',
    range: { horizontal: 4, vertical: 2 },
    rangeMode: 'arc',
  },
  actionSpeed: 35,
  mpCost: 8,
  effects: {
    statusEffects: [
      {
        typeId: statusTypeId('vulnerable'),
        target: 'primary_target',
        baseChance: 60,
      },
    ],
  },
};
