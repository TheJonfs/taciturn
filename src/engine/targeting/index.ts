// Public surface of engine/targeting — predicates and enumerators that
// turn ability targeting specs into concrete target sets.
//
// Today only Math Skill lives here (Session 49 / ADR-0086). The
// single-target / AoE pathways still live alongside the action
// reducers; this directory exists so the Math Skill substrate has a
// clear engine home outside the per-action-kind reducer module.

export {
  enumerateMathSkillTargets,
  isPrime,
  unitMatchesMathSkill,
} from './math-skill.ts';
