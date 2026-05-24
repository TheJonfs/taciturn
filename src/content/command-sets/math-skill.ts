// Math Skill — the Calculator's signature command set (Session 49).
// Five First Action members covering damage, heal, CT push, party
// offensive buff, and party defensive buff. A Calculator with Math
// Skill equipped picks any of the five from the action menu on its
// First Action.
//
// Cross-class equippers receive the same five abilities but pay the
// secondary-command-set cost; without the Mathematician Support passive
// they also pay the unmodified per-target MP term (3 × matchCount) per
// cast — the anti-parasitism lever described in the brief.

import {
  abilityId,
  commandSetId,
  type CommandSetDefinition,
} from '@engine/index.ts';

export const mathSkill: CommandSetDefinition = {
  id: commandSetId('math_skill'),
  name: 'Math Skill',
  members: [
    abilityId('precision_fire'),
    abilityId('targeted_treatment'),
    abilityId('exact_rhythm'),
    abilityId('sculpted_enhancement'),
    abilityId('engineered_defenses'),
  ],
  baseCost: 1,
  availability: 'available',
};
