// Precision Fire — Math Skill #1 (Session 49 / ADR-0086).
//
// The Calculator's multi-target fire spell. SP 3 base (4 with
// Mathematician); damage per matching target = `SP × MA × Faith Factor`,
// identical to mage spells. Tags `magical` + `fire` so resistance
// composition runs through the standard pipeline (a high-Fire-resistance
// target soaks more; a `-fire` target takes more).
//
// 50% base chance per matching target to apply 1 stack of Burn. Stack
// content reads the caster's MA at apply time (per existing Burn
// composeApplyState), so a high-MA Calculator's Burn DoTs hit hard for
// the rest of their lifetime.
//
// Targeting: math_skill (parameter + value picked at cast time). The
// dispatcher enumerates matching units across the entire field —
// friendly fire applies, self-targeting applies, KO'd / removed
// excluded. Base MP cost 4 + 3 × matchedCount (1 × matchedCount with
// Mathematician).

import {
  abilityId,
  bucketId,
  commandSetId,
  statusTypeId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const precisionFire: ActiveAbilityDefinition = {
  id: abilityId('precision_fire'),
  name: 'Precision Fire',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'available',
  // Inherits the command set's cost; `commandSetId('math_skill')` is
  // declared on the Calculator's First Action.
  targeting: { kind: 'math_skill' },
  actionSpeed: 0,
  mpCost: 4,
  mathSkillMpCost: { perTarget: 3 },
  tags: ['math_skill', 'fire'],
  effects: {
    damage: {
      tags: ['magical', 'fire'],
      power_coefficient: 3,
      // S63: Faith removed from the magnitude (deliberate buff — Math Skill
      // reads as a deterministic instrument, not a Faith-gated spell). Damage
      // is `SP × MA`; ~2× prior output at default Faith. SP unchanged.
      noFaithScaling: true,
    },
    statusEffects: [
      {
        typeId: statusTypeId('burn'),
        target: 'primary_target',
        // S71 (#15, Option B): Faith dropped from the Burn application too —
        // the Calculator's identity is faith-independent, MA-scaled (matching
        // the magnitude above). Base lowered 50 → 25 so the MA factor (≥1.8
        // for MA ≥ 9) lands it near the prior effective rate (~45% at MA 9)
        // instead of jumping to ~90%. The 25/25/40 Math-Skill status base set
        // is a tuning watch item (see playtest-watch.md / ADR-0119).
        baseChance: 25,
        factors: { ma: true },
      },
    ],
  },
};
// Hard-coded reference so the math_skill command set author sees the
// id at the same location as the export. Mirrors marksmanship's pattern.
export const PRECISION_FIRE_COMMAND_SET = commandSetId('math_skill');
