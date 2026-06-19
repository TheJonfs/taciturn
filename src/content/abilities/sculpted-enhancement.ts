// Sculpted Enhancement — Math Skill #4 (Session 49 / ADR-0086).
//
// The Calculator's multi-target party buff. 25% base chance per matching
// target, MA-scaled and Faith-independent (S71 #15 Option B), to apply 1
// stack of PA Up + 1 stack of MA Up. At MA 9 the MA factor (1.8) lands it
// ~45% per target — about the prior effective rate at default Faith, but no
// longer dragged by the buff target's Faith. PA Up + MA Up share one roll
// (linkRoll), so both land or both miss together.
//
// Stackable infinite — PA Up / MA Up are STACK_ADDITIVE per existing
// substrate. Multiple casts compound the party's offensive output;
// Chris settled on both effects stackable (Brief D7).
//
// No SP scaling — Sculpted Enhancement is status-application only.
// Mathematician's +1 SP bonus has no effect (the dispatcher's synthesis
// only touches damage / ctEffect; no SP field here to bump).
//
// Friendly fire applies but is *desirable* here: hitting allies is the
// design intent. Hitting matching enemies *also* buffs them (a real
// trade-off the human controller must consider) — the AI scoring layer
// disprefers it (buffing enemies is negative value).
//
// Targeting: math_skill. Standard 4 MP base + per-target term.

import {
  abilityId,
  bucketId,
  statusTypeId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const sculptedEnhancement: ActiveAbilityDefinition = {
  id: abilityId('sculpted_enhancement'),
  name: 'Sculpted Enhancement',
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
        typeId: statusTypeId('pa_up'),
        target: 'primary_target',
        // S71 (#15, Option B): MA-only (Faith dropped), base 50 → 25 —
        // tuning watch item (the 25/25/40 Math-Skill status set).
        baseChance: 25,
        factors: { ma: true },
      },
      {
        typeId: statusTypeId('ma_up'),
        target: 'primary_target',
        // Must match PA Up's baseChance + factors for `linkRoll` to keep
        // the two coupled (same roll AND same computed chance → both land
        // or both miss).
        baseChance: 25,
        factors: { ma: true },
        // Per session 19 / Fire Strike precedent: `linkRoll: true`
        // links the PA Up + MA Up rolls so both apply or both miss as a
        // unit — preserves the "+PA+MA together" identity of the buff
        // and prevents partial coverage that'd feel arbitrary.
        linkRoll: true,
      },
    ],
  },
};
