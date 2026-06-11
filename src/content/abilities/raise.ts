// Raise — the Templar's single-target revival (S62). The spell analogue
// of the Alchemist's Phoenix Down: it revives a KO'd ally and heals them
// in one cast.
//
// Mechanism (ADR-0099): `effects.removeKO` revives the target (HP 0 → 1,
// turnsKOd → 0, CT → 0) before the healing `damage` effect lands, so the
// unit returns at 1 + (MA × 10 × faithFactor). On a non-KO'd target the
// revive no-ops and it reads as a single-target heal (matching Phoenix
// Down on a living target).
//
// Spec (templar-concept-notes.md):
//   - Revive HP = MA × 10 × faithFactor (~0.49 at faith 70). At MA 6 +
//     the Templar's innate Emissary (+25%): ≈ 37 HP — a flat premium over
//     the Alchemist's Phoenix Down (4 × PA 8 = 32); the power coefficient
//     was bumped 8 → 10 vs. Cure for exactly this.
//   - MP 12. Action speed 30 (the existing fastest-spell tier — a beat
//     slower than Cure's 40, since a revive is less time-critical than an
//     in-the-moment cluster heal).
//   - Single-target (scope = Phoenix Down); no AoE.
//
// Tags mirror Cure: 'magical' (Flow State / resistance dispatch), 'holy'
// (Glabados flavor), 'healing' (drives the MA × power × faith formula and
// the cap stage).

import {
  abilityId,
  bucketId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const raise: ActiveAbilityDefinition = {
  id: abilityId('raise'),
  name: 'Raise',
  kind: 'active',
  bucket: bucketId('secondary_command_sets'),
  baseCost: 1,
  availability: 'hidden',
  tags: ['magical', 'holy', 'healing'],
  targeting: {
    kind: 'single_unit',
    range: { horizontal: 4, vertical: 99 },
    rangeMode: 'arc',
  },
  actionSpeed: 30,
  mpCost: 12,
  effects: {
    removeKO: true,
    damage: {
      tags: ['magical', 'holy', 'healing'],
      power_coefficient: 10,
      variance: { min: 0.95, max: 1.05 },
    },
  },
};
