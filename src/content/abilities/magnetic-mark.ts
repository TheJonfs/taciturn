// Magnetic Mark — Lightning Mage's Debuff.
//
// Charged single-enemy debuff that applies Vulnerable (×1.5 next
// damage taken, then auto-removes) on a Faith × MA roll. No damage
// component — the entire payload is the Vulnerable application.
//
// Per session 20 plaintext review:
//   - mpCost 8, actionSpeed 35 (deliberately *faster* than the Strike
//     tier — actionSpeed 35 > 30 means the charge's CT accumulates
//     faster, so Mark resolves before a Strike or Storm Caller cast
//     on the same or following turn; the fast charge is the
//     mechanism that lets the kit's setup→exploit loop work)
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
  availability: 'available',
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
