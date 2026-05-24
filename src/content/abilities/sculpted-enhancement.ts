// Sculpted Enhancement — Math Skill #4 (Session 49 / ADR-0086).
//
// The Calculator's multi-target party buff. 50% base chance per matching
// target (Faith × MA gated per the standard status-application formula)
// to apply 1 stack of PA Up + 1 stack of MA Up. Net ~24.5% per target at
// default Faith 70/70, MA 8: a 4-target cast lands ~1 buff per ability
// on average. Over 5+ casts in a battle, most allies eventually receive
// at least one stack each.
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
        baseChance: 50,
        // Default `{ faith: true, ma: true }` — Faith × MA gate, per
        // the audit-confirmed MA-factor-already-present finding (the
        // Brief's "missing MA factor" concern was a misdirection).
      },
      {
        typeId: statusTypeId('ma_up'),
        target: 'primary_target',
        baseChance: 50,
        // Per session 19 / Fire Strike precedent: `linkRoll: true`
        // links the PA Up + MA Up rolls so both apply or both miss as a
        // unit — preserves the "+PA+MA together" identity of the buff
        // and prevents partial coverage that'd feel arbitrary.
        linkRoll: true,
      },
    ],
  },
};
