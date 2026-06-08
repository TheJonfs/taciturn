// AI Math Skill scoring (Session 49 / ADR-0086).
//
// The Calculator's Math Skill cast space is bounded: 5 abilities ×
// 4 parameters × 4 values = 80 calculation options per turn. For each
// option, the AI enumerates the matching unit set via the engine's
// predicate (`enumerateMathSkillTargets`) and computes a net team-value
// score. The highest-scoring option above a positive threshold wins.
//
// v1 scoring shape (simple max-EV per the brief — Aggressive /
// Conservative variants deferred per Brief D8):
//
//   - **Precision Fire** (damage):       sum(enemy_damage capped at hp)
//                                       - sum(ally_damage capped at hp)
//   - **Targeted Treatment** (heal):    sum(ally_heal_needed)
//                                       - sum(enemy_heal capped at missing_hp)
//   - **Exact Rhythm** (CT push):       sum(enemy_ct_reduction_value)
//                                       - sum(ally_ct_reduction_value)
//   - **Sculpted Enhancement** (PA/MA buff):
//        sum(allies_who_would_apply × small_value)
//      - sum(enemies_who_would_apply × small_value)
//   - **Engineered Defenses** (resist/evade buff):
//        same shape as Sculpted Enhancement
//
// Per-option score uses the FAITH-gated chance for status applications
// (so a high-Faith Calculator scoring Sculpted Enhancement values it
// more) but doesn't simulate the per-target Faith × MA roll variance
// for damage (uses expected value instead). Variance is rolled by the
// engine at commit time; the AI plans on the mean.
//
// Returns the best positive-scoring option, or null when none scores
// above zero. Per S57 (ADR-0092) the standalone MATH_SCORE_THRESHOLD
// pre-empt is gone: this scorer no longer commits on its own — the caller
// (`bestMathCandidate`) injects the returned score into the unified
// candidate pool, where it competes against attacks/heals/items. A lethal
// attack (small damage × large killValue) thus outranks a marginal Math
// cast. Note the score here is raw net-team-value (HP-swing units, no
// killValue weighting yet); a full killValue-weighted re-base is deferred.

import {
  abilityId,
  commandSetId,
  enumerateMathSkillTargets,
  computeMpCost,
  type AbilityId,
  type ActiveAbilityDefinition,
  type CommandSetId,
  type Catalog,
  type GameState,
  type MathSkillParameter,
  type MathSkillValue,
  type ProposedAction,
  type Unit,
} from '@engine/index.ts';

const MATH_SKILL_COMMAND_SET: CommandSetId = commandSetId('math_skill');

const PRECISION_FIRE: AbilityId = abilityId('precision_fire');
const TARGETED_TREATMENT: AbilityId = abilityId('targeted_treatment');
const EXACT_RHYTHM: AbilityId = abilityId('exact_rhythm');
const SCULPTED_ENHANCEMENT: AbilityId = abilityId('sculpted_enhancement');
const ENGINEERED_DEFENSES: AbilityId = abilityId('engineered_defenses');

const PARAMETERS: ReadonlyArray<MathSkillParameter> = ['ct', 'height', 'level', 'current_hp'];
const VALUES: ReadonlyArray<MathSkillValue> = ['prime', 3, 4, 5];

// Returns the actor's Math Skill ability ids if they have the command
// set equipped (as First Action or secondary). Otherwise empty — caller
// skips the Math phase.
function actorMathSkillAbilities(
  actor: Unit,
  catalog: Catalog,
): ReadonlyArray<ActiveAbilityDefinition> {
  let hasMath = false;
  for (const set of Object.values(actor.loadout.actionBuckets)) {
    if ((set ?? []).includes(MATH_SKILL_COMMAND_SET)) {
      hasMath = true;
      break;
    }
  }
  if (!hasMath) return [];

  const commandSet = catalog.getCommandSet(MATH_SKILL_COMMAND_SET);
  const out: ActiveAbilityDefinition[] = [];
  for (const id of commandSet.members) {
    if (!catalog.hasAbility(id)) continue;
    const ability = catalog.getAbility(id);
    if (ability.kind !== 'active') continue;
    out.push(ability);
  }
  return out;
}

// Estimate per-target damage from a Math Skill damage ability. Uses
// expected value (MA × power × Faith × any SP bonus from Mathematician),
// capped at the target's current HP so overkill is wasted. The pipeline's
// variance / resistance / evasion contributions are approximated as
// identity at this layer — close enough for picking the best option
// among 80; the engine resolves the actual numbers on commit.
function estimatePerTargetDamage(
  actor: Unit,
  target: Unit,
  ability: ActiveAbilityDefinition,
): number {
  const damage = ability.effects.damage;
  if (damage === undefined) return 0;
  const power = damage.power_coefficient ?? 1;
  const ma = actor.baseStats.ma;
  const faithFactor = (actor.baseStats.faith / 100) * (target.baseStats.faith / 100);
  return ma * power * faithFactor;
}

// Same shape as damage but flipped for heal — capped at the target's
// missing HP so over-heal is wasted.
function estimatePerTargetHeal(
  actor: Unit,
  target: Unit,
  ability: ActiveAbilityDefinition,
): number {
  const damage = ability.effects.damage;
  if (damage === undefined) return 0;
  const power = damage.power_coefficient ?? 1;
  const ma = actor.baseStats.ma;
  const faithFactor = (actor.baseStats.faith / 100) * (target.baseStats.faith / 100);
  return ma * power * faithFactor;
}

// Score a candidate option (ability × parameter × value). Returns the
// net team value. Positive = good for actor's team; negative = bad.
function scoreOption(
  state: GameState,
  _catalog: Catalog,
  actor: Unit,
  ability: ActiveAbilityDefinition,
  parameter: MathSkillParameter,
  value: MathSkillValue,
): number {
  const matched = enumerateMathSkillTargets(state, parameter, value);
  if (matched.length === 0) return 0;

  let score = 0;
  for (const target of matched) {
    const isEnemy = target.team !== actor.team;
    const isSelf = target.id === actor.id;
    const sign = isEnemy ? 1 : -1;

    if (ability.id === PRECISION_FIRE) {
      const dmg = Math.min(target.vitals.hp, estimatePerTargetDamage(actor, target, ability));
      score += sign * dmg;
    } else if (ability.id === TARGETED_TREATMENT) {
      const maxHp = target.baseStats.maxHpBase;
      const missing = Math.max(0, maxHp - target.vitals.hp);
      const heal = Math.min(missing, estimatePerTargetHeal(actor, target, ability));
      // Heal is *good for allies, bad for enemies* — flip the sign.
      score += -sign * heal;
    } else if (ability.id === EXACT_RHYTHM) {
      // CT push value: 1 point per CT pushed back from an enemy; same
      // off allies. Magnitude approximates `SP × MA × Faith Factor` per
      // the engine, capped at the unit's current CT (clamp at 0).
      const spec = ability.effects.ctEffects?.[0];
      if (spec === undefined) continue;
      const factor = Math.abs(spec.factor);
      const faithFactor = (actor.baseStats.faith / 100) * (target.baseStats.faith / 100);
      const magnitude = Math.min(target.ct, Math.floor(factor * actor.baseStats.ma * faithFactor));
      score += sign * magnitude;
    } else if (ability.id === SCULPTED_ENHANCEMENT || ability.id === ENGINEERED_DEFENSES) {
      // Buff value: ~5 per expected application (Sculpted is 2 stat
      // bumps × 50% × Faith × MA factor; Engineered is per-cast
      // defense uplift at 80%). Self-buff is positive; ally-buff is
      // positive; enemy-buff is negative.
      const baseChance = ability.id === SCULPTED_ENHANCEMENT ? 0.5 : 0.8;
      const faithFactor = (actor.baseStats.faith / 100) * (target.baseStats.faith / 100);
      const maFactor = 0.9 + actor.baseStats.ma / 10;
      const chance = Math.min(1, baseChance * faithFactor * maFactor);
      const value = chance * 5; // tuned coefficient
      // Buffs are good for allies, bad for enemies — flip the sign.
      score += -sign * value;
      // Self-buff is always good (a Calculator buffing themselves is
      // strictly positive; the `sign` flip above already covers this
      // since isSelf → isEnemy false → sign = -1 → flipped = +1).
      void isSelf;
    }
  }
  return score;
}

// Public entry: enumerate the 80 Math Skill options and return the
// best ProposedAction (with the picked parameter + value baked into the
// payload), or null when no option clears the threshold. Caller still
// has to verify the MP cost is affordable — this scorer doesn't gate
// on MP since the cost depends on cluster size; the caller checks via
// `canCommitAction`.
export interface MathSkillCandidate {
  readonly action: ProposedAction;
  readonly score: number;
}

export function pickBestMathSkill(
  state: GameState,
  catalog: Catalog,
  actor: Unit,
): MathSkillCandidate | null {
  const abilities = actorMathSkillAbilities(actor, catalog);
  if (abilities.length === 0) return null;

  let best: MathSkillCandidate | null = null;
  for (const ability of abilities) {
    for (const parameter of PARAMETERS) {
      for (const value of VALUES) {
        const score = scoreOption(state, catalog, actor, ability, parameter, value);
        if (score <= 0) continue;
        // MP affordability check — Math casts have a variable per-target
        // cost. Compute the full cost (base + perTarget × matchCount)
        // and skip when the actor can't pay.
        const matched = enumerateMathSkillTargets(state, parameter, value);
        if (matched.length === 0) continue;
        const baseMp = computeMpCost(state, catalog, actor.id, ability.id);
        const perTarget = ability.mathSkillMpCost?.perTarget ?? 0;
        // Pessimistic: assume default perTarget (no Mathematician modifier
        // visible at this layer); the engine resolves the actual cost.
        // A future improvement: thread `modifyMathSkillPerTargetMpCost`
        // through this preview.
        const totalCost = baseMp + perTarget * matched.length;
        if (actor.vitals.mp < totalCost) continue;

        if (best === null || score > best.score) {
          best = {
            action: {
              type: 'use_ability',
              source: 'player',
              actorId: actor.id,
              payload: {
                abilityId: ability.id,
                target: { kind: 'math_skill', parameter, value },
              },
            },
            score,
          };
        }
      }
    }
  }
  return best;
}
