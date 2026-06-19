// Engineered Defenses — Math Skill #5 (Session 49 / ADR-0086).
//
// The Calculator's multi-target defensive buff. 40% base chance per
// matching target, MA-scaled and Faith-independent (S71 #15 Option B), to
// apply 1 stack of Engineered Defenses status — +10 to each elemental
// resistance + 5% to every evasion facing, permanent for the battle. At
// MA 9 the MA factor (1.8) lands it ~72% per target — about the prior
// effective rate at default Faith, without the buff target's Faith
// dragging it.
//
// Stackable
// per Brief D7 — multiple successful casts on the same target compound
// the resistance and evasion uplift. Lever for runaway: convert to
// non-stackable; flagged in handoff watch-fors.
//
// No SP scaling (status-application only). Mathematician's +1 SP bonus
// has no effect.
//
// Tactical posture (per blueprint): a Calculator that opens with
// Engineered Defenses → Sculpted Enhancement → Exact Rhythm establishes
// the team's defensive + offensive baseline before pivoting to damage.

import {
  abilityId,
  bucketId,
  statusTypeId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const engineeredDefenses: ActiveAbilityDefinition = {
  id: abilityId('engineered_defenses'),
  name: 'Engineered Defenses',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'available',
  targeting: { kind: 'math_skill' },
  actionSpeed: 0,
  mpCost: 4,
  mathSkillMpCost: { perTarget: 3 },
  tags: ['math_skill'],
  effects: {
    statusEffects: [
      {
        typeId: statusTypeId('engineered_defenses'),
        target: 'primary_target',
        // S71 (#15, Option B): MA-only (Faith dropped), base 80 → 40 —
        // tuning watch item (the 25/25/40 Math-Skill status set).
        baseChance: 40,
        factors: { ma: true },
      },
    ],
  },
};
