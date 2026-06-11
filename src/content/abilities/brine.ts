// Brine — Water Mage's Debuff.
//
// Charged single-target enemy debuff. Faith-chance roll applies one
// stack of Speed Down (additive flat -1 Speed via STACK_INDEPENDENT,
// permanent until cleared). Two casts on the same target stack to
// -2 Speed; three to -3; and so on.
//
// Per session 18 plaintext review:
//   - mpCost 8, actionSpeed 30 (parity with Earth Strike / Water Strike
//     tier — debuffs come online quickly)
//   - baseChance 50 (~51% net at default Faith / MA — moderate-but-
//     meaningful for a permanent-in-battle debuff)
//   - duration: omitted; Speed Down is `'permanent'` mode → applyStatus
//     stores no duration and the status never decrements
//   - range horizontal 4 / vertical 2, arc
//
// Tactical comparison vs. Earth Curse: Curse rolls two independent
// chances against a single target (Blind + Silence with their own
// timed durations). Brine rolls one chance and applies a single
// permanent stack — different cadence (Brine pays off across the
// whole battle if it lands).

import {
  abilityId,
  bucketId,
  statusTypeId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const brine: ActiveAbilityDefinition = {
  id: abilityId('brine'),
  name: 'Brine',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'available',
  tags: ['magical', 'water'],
  targeting: {
    kind: 'unit_or_tile',
    range: { horizontal: 4, vertical: 99 },
    rangeMode: 'arc',
  },
  actionSpeed: 30,
  mpCost: 8,
  effects: {
    statusEffects: [
      {
        typeId: statusTypeId('speed_down'),
        target: 'primary_target',
        baseChance: 50,
        // S63: bumped from the status default of -1 to -2 Speed per cast —
        // Brine went unused, and Speed is high-leverage (it drives CT accrual
        // and turn frequency). Scoped to Brine via this per-instance override;
        // the shared `speed_down` default (and Slow, which also rides it) is
        // untouched. Two casts now reach -4. baseChance unchanged.
        magnitude: 2,
      },
    ],
  },
};
