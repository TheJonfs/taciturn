// Basic AI — heuristic decision-making for non-player units.
//
// Tier 2 (session 20b) replaces tier-1.5's `power_coefficient` proxy
// with real expected-damage projection (`projectExpectedDamage` in
// `./projection.ts`) and sharpens reaction-awareness with tag-filter
// inspection. The score shape is now:
//
//     damageImpact = min(projectedDamage, target.hp)   (overkill is wasted)
//     score = damageImpact × killValue(target) × (1 - reactionPenalty(target, ability))
//
// Where:
//   - `projectedDamage` folds in PA/MA, weapon WP, Faith × Faith,
//     resistance, Vulnerable amplification, crit expectation, evasion
//     (as expected hit_chance × damage), and variance midpoint. Vulnerable
//     and crit no longer need separate AI-side multipliers — the
//     projection observes them through the same hooks the live engine
//     does.
//   - `killValue(target)` = 1 / max(0.05, hpRatio), the same
//     "wounded targets are more valuable" curve as before. Combined with
//     overkill capping, this naturally rewards kills without spending
//     extra damage on overkill.
//   - `reactionPenalty(target, ability)` is now ability-aware: Counter's
//     `'physical'` tag gate doesn't penalize a Lightning Strike anymore,
//     because the AI inspects each equipped reaction's compiled trigger
//     condition (via `PassiveAbilityDefinition.reactionFields`) and only
//     counts reactions that would actually fire against the proposed
//     ability's tags.
//
// Pure function (same `(state, catalog)` always yields the same
// decision); no I/O, no RNG. The two-action joint planner (per
// `pickBestActOrMove`) considers (Move + Act) tuples within the
// actor's reachable destinations, picking the highest-scoring (move,
// ability, target) triple. The orchestrator's one-decision-per-call
// cadence stays — when a Move + Act plan wins, the AI commits the Move
// leg first; the next AI call recomputes from the new position and
// commits the Act leg.
//
// Phases (in priority order — first phase that produces a winning
// candidate wins):
//   0. Heal — wounded ally in range. Priority over Action because
//      saving an ally has binary value.
//   1. Joint plan — enumerate (destination, ability, target) triples
//      across the actor's reachable destinations + abilities + targets.
//      The highest-scoring triple wins. If the chosen destination is
//      the actor's current position, commit the Act directly. Otherwise
//      commit the Move; the next call will re-plan and find the Act
//      from the new position.
//   2. Move — fallback when no offensive plan scores positively (no
//      enemies in any reachable striking position). Closes distance
//      to the priority enemy.
//
// What's still deferred:
//   - Move-to-heal / move-to-buff (closing distance to a wounded /
//     buffable ally — buff branch in joint planner covers in-range
//     buffs but doesn't reach for out-of-range ones).
//   - Charged-action multi-turn awareness (the AI casts charges but
//     doesn't model "I'll be skipped next turn while this resolves").

import {
  arcTargetable,
  canCommitAction,
  classId,
  commandSetId,
  computeAbilityRange,
  computeMpCost,
  endpointFrom,
  getLegalMoves,
  hasLineOfSight,
  horizontalDistance,
  inRange,
  itemId,
  maxRangeFromHeightBonus,
  positionKey,
  rangeFromHeightBonus,
  runModifyAoeShape,
  runModifyAoeVerticalTolerance,
  runModifyAttackerElevation,
  runModifyStatQuery,
  tileAt,
  unitAt,
  weaponRangeFromHeightSpec,
  aoeFootprint,
  applyKnockback,
  buildElevationChanges,
  cardinalFromTo,
  computeAbilityChance,
  computeWorldcraftEffectCap,
  FALLING_DAMAGE_PER_LEVEL,
  type KnockbackDirection,
  type Catalog,
  type GameState,
  type ItemId,
  type Position,
  type ProposedAction,
  type Tile,
  type Unit,
  type ActiveAbilityDefinition,
  type AbilityId,
  type AbilityTarget,
  type AoeSpec,
  type DamageTag,
  type PassiveAbilityDefinition,
  type ReactionTriggerCondition,
  type StatusInstance,
  type StatusTypeId,
  type UnitId,
  type WorldcraftEffectEntry,
  statusTypeId,
} from '@engine/index.ts';
import { projectExpectedDamage } from './projection.ts';
import { pickBestMathSkill } from './math-skill-scoring.ts';
import { buildCoverageMap, threatsToTile, type CoverageMap, type ThreatEntry } from './threat/coverage-map.ts';

// AI's answer for a single decision step. Mirrors the orchestrator's
// `ControllerDecision` minus the `pending` case — the AI always has an
// answer. Defined locally instead of imported from the orchestrator so
// that `src/ai/` stays in the engine-only dependency tier (per
// docs/architecture/architecture-overview.md).
export type BasicAiDecision =
  | { readonly kind: 'commit'; readonly action: ProposedAction }
  | { readonly kind: 'end-turn' };

const END_TURN: BasicAiDecision = { kind: 'end-turn' };

// A scored action candidate in the unified pool. Every action class
// (attack, debuff, buff, heal, item throw, revive, cleanse, Math Skill)
// produces one of these so they compete on a single commensurable scale.
// `score` is expected-damage-equivalent value × target value; `key` is a
// stable lex tiebreak (see compareScored). `action` is pre-validated
// (canCommitAction) by its builder, so the pool winner is always
// committable.
interface ScoredAction {
  readonly score: number;
  readonly action: ProposedAction;
  readonly key: string;
}

// --- Unified-currency value mappings (ADR-0092, S57) ------------------
// These translate non-damage action classes into the offensive scale,
// where an attack scores `projectedDamage × killValue(target)`. Each is a
// playtest dial; see docs/playtest-watch.md.

// Heal value = effectiveHeal × killValue(ally) × HEAL_WEIGHT. Mirrors the
// offensive scale (HP restored to an at-risk ally ≈ HP denied to an enemy)
// but discounted: a heal leaves the threat alive, so it should lose to a
// comparable kill. Start at 0.7.
const HEAL_WEIGHT = 0.7;

// Revive value = ally.maxHpBase × REVIVE_WEIGHT. Deliberately NOT the
// (tiny) on-revive heal × killValue — reviving restores a whole unit's
// battlefield presence. Tuned to sit at "strong attack" tier: beats
// routine attacks, can lose to finishing a key enemy. Competes as a
// scored candidate (Chris's S57 call) rather than pre-empting.
const REVIVE_WEIGHT = 1.5;

// Cleanse value per debuff removed (Remedy). Flat, in damage-equivalent
// units — clearing one debuff ≈ this much expected good.
const CLEANSE_VALUE_PER_DEBUFF = 15;

// MP-restore value factor (Ether). Intentionally small: an Ether throw
// only wins when no combat/heal/buff action scores positive.
const ETHER_VALUE_FACTOR = 0.1;

// MP-spend penalty (S66 chunk 2, D2: soft scaled penalty only — no hard
// floor). An action's MP cost is subtracted from its score in proportion
// to how low the caster's MP is, so the AI conserves its last MP for
// marginal casts while a high-value cast (lethal, big AoE) still wins
// through it (the penalty is bounded and subordinate). ~0 when MP is
// plentiful, so normal play is undistorted. The weight is the per-MP
// penalty at fully-empty MP; the convex scarcity curve keeps it gentle
// until MP runs genuinely low. Playtest dial — see docs/playtest-watch.md.
const MP_SPEND_PENALTY_WEIGHT = 1.5;

// Restore-valuation (Ether) scarcity bonus (S66 chunk 2). An Ether throw
// is worth more as the recipient's MP runs low: the base value is
// multiplied by (1 + this × recipientScarcity), so a bone-dry ally roughly
// doubles Ether's appeal while a near-full ally sees the base value. Keeps
// Ether a situational pick that rises exactly when conservation bites.
const MP_RESTORE_SCARCITY_BONUS = 1.0;

// Math Skill pool-injection scale. Math's net-team-value is raw HP-swing
// (no killValue weighting yet — see math-skill-scoring.ts); 1.0 injects it
// as the un-weighted lower bound so a lethal attack reliably outranks a
// marginal Math cast. A full killValue-weighted re-base is deferred.
const MATH_SCORE_SCALE = 1.0;

// Reaction-penalty constants. Tier 2 (session 20b) sharpens this to
// ability-aware: each equipped reaction's compiled trigger condition
// is inspected (via PassiveAbilityDefinition.reactionFields, populated
// by `compileReactionAbility` in the engine), and only reactions whose
// damageTagsAny / damageTagsNone filters match the *proposed* ability's
// damage tags contribute to the penalty. Counter (physical-only) no
// longer penalizes a Lightning Strike (magical); Discharge (no tag
// filter) still does. The constant is tuned so a single Brave-100
// trigger-matching reaction reduces target appeal by ~15%.
const REACTION_PENALTY_PER_STACK = 0.15;
const REACTION_PENALTY_CAP = 0.4;

const VULNERABLE_TYPE_ID: StatusTypeId = statusTypeId('vulnerable');

// Polarity inspection — reads `StatusEffectType.aiHints.polarity` from
// the catalog. Statuses without an explicit polarity hint default to
// 'debuff' (the AI never proposes them as ally buffs). Tier 2 (session
// 20b) replaces the previous hardcoded `KNOWN_BUFF_STATUS_IDS` list —
// content now declares its own polarity in `StatusEffectType.aiHints`.
function isBuffStatus(catalog: Catalog, typeId: StatusTypeId): boolean {
  if (!catalog.hasStatusType(typeId)) return false;
  return catalog.getStatusType(typeId).aiHints?.polarity === 'buff';
}

// Friendly-fire deduction in AoE scoring. An ally caught in the AoE
// counts negatively against the cluster value. Tuned to ~1.0 (one ally
// hit cancels one enemy hit). If a future kit wants the AI to avoid
// friendly fire more strongly, raise this.
const FRIENDLY_FIRE_PENALTY_FACTOR = 1.0;

// Vulnerable's damage multiplier (per ADR-0032). Used by the Magnetic
// Mark setup→exploit branch to compute the marginal damage gain from
// marking a target — the projection folds in Vulnerable when the target
// is already marked, so for an unmarked target we extrapolate the
// "would-be" damage as `projected × VULNERABLE_MULTIPLIER` and take the
// difference (clamped at the target's remaining HP).
const VULNERABLE_MULTIPLIER = 1.5;

// Self-cost dampening for Storm Caller and other selfDamage abilities.
// Without dampening, killValue × power_36 dominates every target
// score. The Lightning Mage's design intent is "Storm Caller is the
// ultimate, used at decisive moments" — the AI shouldn't reach for it
// on routine attacks. Dampening to 0.25 makes Storm Caller a clear
// finisher on low-HP targets but disprefers it on full-HP targets
// where Strike or Mark are more efficient. selfDamageWouldKO refuses
// the cast outright when the cost would KO the caster.
const SELF_COST_DAMPING_FACTOR = 0.25;

// Buff dampening — without it, scoreAllyBuff (MA × #offensives) easily
// reaches 40+ for a Mage ally, beating most direct-damage options.
// Buffs are valuable but should only win when offensive options are
// weak. The dampening factor brings buff scores into the same range
// as damage options.
const BUFF_SCORE_DAMPING_FACTOR = 0.3;

// Session 40 (D7): minimal weapon-proc-target awareness. When the
// actor's equipped weapon has an `attackProcs` rider that applies a
// status the target is particularly vulnerable to, multiply the
// target's offensive score by this factor. Tuned to give the AI a
// gentle preference rather than a forcing function — Magebane-wielding
// Knights should *lean toward* the opposing Mage line but still pick
// a low-HP non-mage when one is in reach.
//
// v1 scope: only Silence-via-knife vs mage classes is modeled. Future
// proc/status combinations extend the `procTargetSynergyMultiplier`
// helper; sophisticated proc-TTK modeling is a future tactics pass.
const PROC_TARGET_BONUS = 1.5;

// Status types whose application against a class type benefits the
// attacker. Read at scoring time; entries are (procced_status_id,
// vulnerable_class_id_predicate, reason) tuples. Keyed by status type
// id for fast lookup of "does any proc on the wielder's weapon hit
// the target's vulnerability?" Generic enough that adding e.g.
// Berserk-vs-low-Brave or Slow-vs-high-Speed only extends this map.
const SILENCE_TYPE_ID: StatusTypeId = statusTypeId('silence');
const MAGE_CLASS_IDS: ReadonlyArray<ReturnType<typeof classId>> = [
  classId('fire_mage'),
  classId('earth_mage'),
  classId('water_mage'),
  classId('lightning_mage'),
];

// S59 defensive above-melee-reach term (ADR-0095). The threat coverage map
// (ADR-0094) gives the expected incoming damage a tile exposes the actor to.
// Because the map's reach honours melee vertical range (3), a destination
// above a melee threat's reach carries no melee entry — so the "safe high
// ground" preference falls out of the geometry, and ranged threat (never
// elevation-escapable) still counts.
//
// **Applied as a tie-break, not a score penalty.** Offence decides *whether*
// and *what* to attack (and how the attack competes against heals / items /
// Worldcraft in the unified pool); residual danger only chooses *which
// equal-offence tile* to attack from. A score-subtraction form was tried
// first and made the AI cower — in the symmetric demo both sides declined to
// engage and battles never decided (the brief's passivity watch-for, made
// concrete). The tie-break can never push an attack below the commit
// threshold, so engagement is preserved while the AI still prefers safe
// ground (e.g. a mage backing out of melee to cast). A stronger weighted
// form is the future lever if playtest shows safety being ignored; see
// docs/playtest-watch.md.

// Residual expected incoming damage if the actor commits `action` from
// `source`: the coverage-map danger at that tile, **excluding any enemy the
// action would KO** (a neutralised threat poses no danger — the AI won't
// "dodge" an enemy it is about to kill). 0 when there's no coverage map or
// the tile is unthreatened. Lower is safer; used only to break ties between
// equal-offence plans.
function residualDangerForPlan(
  state: GameState,
  catalog: Catalog,
  coverage: CoverageMap | null,
  actor: Unit,
  source: Position,
  action: ProposedAction,
): number {
  if (coverage === null) return 0;
  const entries = coverage.query(source);
  if (entries.length === 0) return 0;
  const koTarget = planKoTargetId(state, catalog, actor, source, action);
  let danger = 0;
  for (const e of entries) {
    if (koTarget !== null && e.enemyId === koTarget) continue;
    danger += e.expectedDamage;
  }
  return danger;
}

// The single enemy this plan's action would KO (expected damage ≥ its HP),
// or null. v1 scope: a single unit-targeted attack only — AoE / tile plans
// take no discount (the multi-target neutralisation case is deferred). Uses
// expected damage so only a confident kill earns the discount.
function planKoTargetId(
  state: GameState,
  catalog: Catalog,
  actor: Unit,
  source: Position,
  action: ProposedAction,
): UnitId | null {
  if (action.type !== 'use_ability') return null;
  const target = action.payload.target;
  if (target.kind !== 'unit') return null;
  const enemy = state.units.get(target.unitId);
  if (enemy === undefined || enemy.vitals.hp <= 0 || enemy.team === actor.team) return null;
  const ability = catalog.getAbility(action.payload.abilityId);
  if (ability.kind !== 'active') return null;
  const attackerAt = samePosition(actor.position, source) ? actor : { ...actor, position: source };
  const projected = projectExpectedDamage({ state, catalog, attacker: attackerAt, target: enemy, ability });
  return projected >= enemy.vitals.hp ? enemy.id : null;
}

export function decideBasicAi(state: GameState, catalog: Catalog): BasicAiDecision {
  if (state.turnState === null) return END_TURN;
  const actor = state.units.get(state.turnState.unitId);
  if (actor === undefined) return END_TURN;
  // KO'd actor is a guard against the orchestrator pumping us with a
  // dead-actor turn (see DemoOrchestrator's mid-turn-KO defensive
  // path); the orchestrator already handles this, but a defensive
  // controller-side return keeps the AI honest.
  if (actor.vitals.hp <= 0) return END_TURN;

  const enemies = livingEnemies(state, actor);
  const allies = livingAllies(state, actor);

  const offensive = enumerateOffensiveAbilities(state, actor, catalog);
  const healing = enumerateHealingAbilities(state, actor, catalog);
  const allyBuffs = enumerateAllyBuffAbilities(state, actor, catalog);

  // S59 incoming-threat model (ADR-0094): danger to the actor at each tile
  // it could move to this turn, used by the defensive term in the
  // move-aware scorers below. Bounded to the actor's reachable destinations
  // (+ its current tile) so the per-tile projection sweep stays cheap —
  // one extra actor-Dijkstra here vs. projecting the whole board.
  let coverage: CoverageMap | null = null;
  if (enemies.length > 0) {
    const reachable: Position[] = [actor.position];
    for (const path of getLegalMoves(state, actor.id, catalog).reachable.values()) {
      reachable.push(path.destination);
    }
    coverage = buildCoverageMap(state, catalog, actor, reachable);
  }

  // === Unified candidate pool (ADR-0092, S57) =========================
  // Every action class is scored in one commensurable currency
  // (expected-damage-equivalent value × target value) and competes in a
  // single pool. There is NO pre-empt cascade: a lethal attack can
  // outrank a banking Compound or a marginal Math cast; a heal wins only
  // when it does more good than attacking; a revive competes as a scored
  // candidate. Compound (deferred-value crafting) and the distance-
  // closing Move are the only true fallbacks, reached when no scored
  // action is positive.
  const candidates: ScoredAction[] = [];
  const canAct = state.turnState.budget.actsAvailable > 0;

  if (canAct) {
    // Heals (Cure-style abilities) — scored, not pre-empting.
    const heal = bestHealCandidate(state, catalog, actor, allies, healing);
    if (heal !== null) candidates.push(heal);

    // Alchemist item throws (Potion / Phoenix Down / Remedy / Ether).
    if (isAlchemistActor(actor, catalog)) {
      const throwCand = bestThrowCandidate(state, catalog, actor, allies);
      if (throwCand !== null) candidates.push(throwCand);
    }

    // Math Skill (Calculator) — normalized into the pool, no threshold
    // pre-empt (per S57: it now competes rather than firing first).
    const math = bestMathCandidate(state, catalog, actor);
    if (math !== null) candidates.push(math);

    // Worldcraft (S57 Tier A): Pit/Valley fall damage. Tile-targeted casts
    // scored in the unified currency (signed fall damage × killValue), so a
    // Pit competes with attacks and declines flat ground.
    const worldcraft = enumerateWorldcraftWorks(state, actor, catalog);
    if (worldcraft.length > 0) {
      const fall = bestWorldcraftFallCandidate(state, catalog, actor, worldcraft);
      if (fall !== null) candidates.push(fall);
      // Tier B perch (Pillar/Hill): lift a height-seeking ally's tile for
      // a better future shot, discounted by the temperament dial.
      const perch = bestPerchCandidate(state, catalog, actor, enemies, worldcraft);
      if (perch !== null) candidates.push(perch);
      // Tier C (S59): spring a loaded revert-trap — a new cast evicts an
      // older raise, dropping an enemy currently riding its footprint.
      const trap = bestRevertTrapCandidate(state, catalog, actor, worldcraft);
      if (trap !== null) candidates.push(trap);
      // Tier B Barrier denial (S61): screen the most-threatened ally with a
      // wall, scored as net protection minus the barrier's cost to the AI's
      // own offense (it blocks both teams).
      const barrier = bestBarrierDenialCandidate(state, catalog, actor, allies, enemies, worldcraft);
      if (barrier !== null) candidates.push(barrier);
    }

    // Joint two-action offense + buff plan (move-aware). Returns its best
    // plan's score and the action to commit — an Act in place, or the
    // Move leg of a Move+Act plan (the next call commits the Act from the
    // new position, per session-20b two-action planning).
    if (offensive.length > 0 || allyBuffs.length > 0) {
      const joint = pickJointActOrMove(state, catalog, actor, enemies, allies, offensive, allyBuffs, coverage);
      if (joint !== null) candidates.push(joint);
    }
  }

  // Pick the highest-scoring candidate; commit if it does positive good.
  if (candidates.length > 0) {
    let best = candidates[0]!;
    for (let i = 1; i < candidates.length; i++) {
      if (compareScored(candidates[i]!, best) > 0) best = candidates[i]!;
    }
    if (best.score > 0) return { kind: 'commit', action: best.action };
  }

  // === Fallbacks (no positive-score action available) =================
  // Distance-closing move: advance toward the priority enemy so the next
  // turn has a real plan.
  if (state.turnState.budget.movesAvailable > 0 && enemies.length > 0) {
    const move = pickBestMove(state, catalog, actor, enemies, allies, offensive, coverage);
    if (move !== null) return { kind: 'commit', action: move };
  }

  // Last resort: an Alchemist that can't advance or attack crafts a
  // needed item. Demoted from its old Phase-0a pre-empt — banking no
  // longer blocks a kill or an advance (S57). (Watch: may now
  // under-craft; see docs/playtest-watch.md.)
  if (canAct && isAlchemistActor(actor, catalog)) {
    const compound = pickCompoundFallback(state, catalog, actor, allies);
    if (compound !== null) return { kind: 'commit', action: compound };
  }

  return END_TURN;
}

// Living enemies of `actor`, by team. KO'd units (hp <= 0) are filtered
// out so the AI doesn't try to "attack" a corpse.
function livingEnemies(state: GameState, actor: Unit): Unit[] {
  const out: Unit[] = [];
  for (const u of state.units.values()) {
    if (u.team === actor.team) continue;
    if (u.vitals.hp <= 0) continue;
    out.push(u);
  }
  return out;
}

// Living allies (same team), including the actor itself — self-heal /
// self-buff is a valid move when no other allies are in range or the
// actor is the most-wounded one. KO'd allies aren't healable via Cure
// (Raise is a different ability that lands later); filter them.
function livingAllies(state: GameState, actor: Unit): Unit[] {
  const out: Unit[] = [];
  for (const u of state.units.values()) {
    if (u.team !== actor.team) continue;
    if (u.vitals.hp <= 0) continue;
    out.push(u);
  }
  return out;
}

// =====================
// Session 39b — Alchemist
// =====================

const ALCHEMY_COMMAND_SET = commandSetId('alchemy');
const ALCHEMIST_CLASS = classId('alchemist');
const POTION = itemId('potion');
const PHOENIX_DOWN = itemId('phoenix_down');
const REMEDY = itemId('remedy');
const ETHER = itemId('ether');
const THROW_HORIZONTAL = 3;
const THROW_VERTICAL = 3;
const WOUNDED_HP_FRACTION = 0.5;

function isAlchemistActor(actor: Unit, _catalog: Catalog): boolean {
  if (actor.classState.currentClass === ALCHEMIST_CLASS) return true;
  // Also detect cross-class equippers via the loadout (Alchemy secondary
  // command set). Iterates without allocating for the common no-match.
  for (const entries of Object.values(actor.loadout.actionBuckets)) {
    if ((entries ?? []).includes(ALCHEMY_COMMAND_SET)) return true;
  }
  return false;
}

// Best Alchemist item-throw as a scored pool candidate (S57). Each throw
// is valued in the unified currency so it competes against attacks rather
// than firing as a pre-empt:
//   - Phoenix Down (revive)  → ally.maxHpBase × REVIVE_WEIGHT.
//   - Potion (heal, PA × 12) → effectiveHeal × killValue × HEAL_WEIGHT
//     (same mapping as Cure).
//   - Remedy (cleanse)       → debuffCount × CLEANSE_VALUE_PER_DEBUFF.
//   - Ether (MP restore)     → effectiveMp × ETHER_VALUE_FACTOR (small).
// Returns the highest-scoring committable throw, or null. Compound is no
// longer produced here — it's a last-resort fallback (pickCompoundFallback).
function bestThrowCandidate(
  state: GameState,
  catalog: Catalog,
  actor: Unit,
  livingAlliesList: ReadonlyArray<Unit>,
): ScoredAction | null {
  let best: ScoredAction | null = null;
  const consider = (score: number, item: ItemId, targetId: import('@engine/index.ts').UnitId, key: string): void => {
    if (score <= 0) return;
    const action = throwAction(actor, item, targetId);
    if (!canCommitAction(state, catalog, actor, action)) return;
    const cand: ScoredAction = { score, action, key };
    if (best === null || compareScored(cand, best) > 0) best = cand;
  };
  const pa = actor.baseStats.pa;

  // Phoenix Down — revive a KO'd ally (battlefield presence restored).
  if ((actor.stockpile.get(PHOENIX_DOWN) ?? 0) > 0) {
    for (const ally of koAlliesInRange(state, actor)) {
      consider(readMaxHpProxy(ally) * REVIVE_WEIGHT, PHOENIX_DOWN, ally.id, `throw|phoenix|${ally.id}`);
    }
  }

  // Potion — heal a wounded living ally (PA × 12, capped at missing HP).
  if ((actor.stockpile.get(POTION) ?? 0) > 0) {
    for (const ally of livingAlliesList) {
      if (!isInThrowRange(state, catalog, actor, ally)) continue;
      const missing = Math.max(0, readMaxHpProxy(ally) - ally.vitals.hp);
      if (missing <= 0) continue;
      const heal = Math.min(missing, pa * POTION_HP_COEFFICIENT);
      consider(heal * killValue(ally) * HEAL_WEIGHT, POTION, ally.id, `throw|potion|${ally.id}`);
    }
  }

  // Remedy — clear debuffs from an afflicted ally.
  if ((actor.stockpile.get(REMEDY) ?? 0) > 0) {
    for (const ally of livingAlliesList) {
      if (!isInThrowRange(state, catalog, actor, ally)) continue;
      const count = countDebuffStatuses(ally, catalog);
      if (count <= 0) continue;
      consider(count * CLEANSE_VALUE_PER_DEBUFF, REMEDY, ally.id, `throw|remedy|${ally.id}`);
    }
  }

  // Ether — restore MP to a depleted ally (skip low-MP-baseline units).
  if ((actor.stockpile.get(ETHER) ?? 0) > 0) {
    for (const ally of livingAlliesList) {
      if (!isInThrowRange(state, catalog, actor, ally)) continue;
      if (ally.baseStats.maxMpBase <= 20) continue;
      const missingMp = Math.max(0, ally.baseStats.maxMpBase - ally.vitals.mp);
      if (missingMp <= 0) continue;
      const restored = Math.min(missingMp, pa * ETHER_MP_COEFFICIENT);
      // S66 chunk 2: restore-valuation — Ether is worth more as the
      // recipient's MP runs low, the mirror of the MP-spend penalty.
      const scarcityMult = 1 + MP_RESTORE_SCARCITY_BONUS * mpScarcity(state, catalog, ally);
      consider(restored * ETHER_VALUE_FACTOR * scarcityMult, ETHER, ally.id, `throw|ether|${ally.id}`);
    }
  }

  return best;
}

// Potion / Ether restore coefficients, mirroring the content definitions
// (`src/content/items/{potion,ether}.ts`). Read here so the AI's throw
// valuation matches the engine's applied amount (PA × coefficient).
const POTION_HP_COEFFICIENT = 12;
const ETHER_MP_COEFFICIENT = 4;

// Last-resort Compound: craft the most-needed item when no scored action
// (combat / heal / throw) is positive and the actor can't advance. Built
// from the existing pickCompoundItem priority cascade — crafting is a
// deferred-value prep action with no immediate battlefield effect, so it
// stays out of the scored pool (it would have no commensurable score).
function pickCompoundFallback(
  state: GameState,
  catalog: Catalog,
  actor: Unit,
  livingAlliesList: ReadonlyArray<Unit>,
): ProposedAction | null {
  const choice = pickCompoundItem(state, actor, livingAlliesList, catalog);
  if (choice === null) return null;
  const action: ProposedAction = {
    type: 'use_compound',
    source: 'player',
    actorId: actor.id,
    payload: { itemId: choice },
  };
  return canCommitAction(state, catalog, actor, action) ? action : null;
}

function koAlliesInRange(state: GameState, actor: Unit): Unit[] {
  const out: Unit[] = [];
  for (const u of state.units.values()) {
    if (u.team !== actor.team) continue;
    if (u.removed) continue;
    if (u.vitals.hp > 0) continue;
    if (!isInThrowRange(state, undefined, actor, u)) continue;
    out.push(u);
  }
  return out;
}

function isInThrowRange(
  state: GameState,
  _catalog: Catalog | undefined,
  actor: Unit,
  target: Unit,
): boolean {
  const sourceTile = tileAt(state.map, actor.position.x, actor.position.y, actor.position.layer);
  const targetTile = tileAt(state.map, target.position.x, target.position.y, target.position.layer);
  if (sourceTile === undefined || targetTile === undefined) return false;
  const ok = inRange({
    source: endpointFrom(actor.position, sourceTile.elevation),
    target: endpointFrom(target.position, targetTile.elevation),
    params: { horizontalMax: THROW_HORIZONTAL, horizontalMin: 0, verticalMax: THROW_VERTICAL },
  });
  if (!ok) return false;
  return hasLineOfSight(
    state.map,
    endpointFrom(actor.position, sourceTile.elevation),
    endpointFrom(target.position, targetTile.elevation),
  );
}

// Count the removable debuff-polarity statuses on a unit (Remedy clears
// all of them). Equipment-sourced statuses are immune (ADR-0028) and
// skipped, matching the engine's clearStatuses behavior. Undeclared
// polarity defaults to 'debuff'.
function countDebuffStatuses(unit: Unit, catalog: Catalog): number {
  let count = 0;
  for (const inst of unit.statuses) {
    if (inst.source.kind === 'equipment') continue;
    if (!catalog.hasStatusType(inst.typeId)) continue;
    const type = catalog.getStatusType(inst.typeId);
    const polarity = type.aiHints?.polarity ?? 'debuff';
    if (polarity !== 'buff') count += 1;
  }
  return count;
}

function throwAction(actor: Unit, item: ItemId, targetId: import('@engine/index.ts').UnitId): ProposedAction {
  return {
    type: 'use_throw_item',
    source: 'player',
    actorId: actor.id,
    payload: { itemId: item, target: { kind: 'unit', unitId: targetId } },
  };
}

// HP-cap proxy: use the unit's baseStats maxHpBase as an approximation.
// Equipment + status maxHp mods aren't read here — sufficient for the
// wounded-fraction heuristic; a tighter read would route through
// runModifyStatQuery but adds AI cost for marginal accuracy gain.
function readMaxHpProxy(unit: Unit): number {
  return Math.max(1, unit.baseStats.maxHpBase);
}

// Compound priority: missing Phoenix Down when allies are at risk >
// missing Potion when allies are wounded > missing Remedy > Potion as
// default fallback for stockpile-building. Returns null when no
// affordable Compound improves the stockpile.
function pickCompoundItem(
  state: GameState,
  actor: Unit,
  allies: ReadonlyArray<Unit>,
  catalog: Catalog,
): ItemId | null {
  void state;
  void catalog;
  const have = (id: ItemId): number => actor.stockpile.get(id) ?? 0;
  const mpFor = (id: ItemId): number => {
    if (!catalog.hasItem(id)) return Infinity;
    const item = catalog.getItem(id);
    return item.kind === 'consumable' ? item.compoundMpCost : Infinity;
  };
  const canAfford = (id: ItemId): boolean => actor.vitals.mp >= mpFor(id);

  // Look at adjacent risk: any ally KO'd or wounded?
  const anyKO = allies.length < state.units.size
    ? Array.from(state.units.values()).some((u) => u.team === actor.team && !u.removed && u.vitals.hp <= 0)
    : false;
  const anyWounded = allies.some(
    (a) => a.vitals.hp / readMaxHpProxy(a) < WOUNDED_HP_FRACTION,
  );

  // Priority cascade.
  if (anyKO && have(PHOENIX_DOWN) === 0 && canAfford(PHOENIX_DOWN)) return PHOENIX_DOWN;
  if (anyWounded && have(POTION) === 0 && canAfford(POTION)) return POTION;
  if (have(REMEDY) === 0 && canAfford(REMEDY)) return REMEDY;
  if (have(POTION) < 2 && canAfford(POTION)) return POTION; // bank a second Potion
  if (have(ETHER) === 0 && canAfford(ETHER)) return ETHER;
  return null;
}

// =====================
// Ability enumeration
// =====================

// Walk the actor's loadout and resolve every active member of every
// equipped command set, plus any active class-granted free abilities
// (per session 25: Attack lives as a class free ability rather than a
// command-set member, mirroring the player's picker which surfaces
// free abilities as peers of command sets). Returns unique active
// abilities; other enumerators filter the result.
function enumerateActiveAbilities(
  actor: Unit,
  catalog: Catalog,
): ActiveAbilityDefinition[] {
  const seen = new Set<AbilityId>();
  const out: ActiveAbilityDefinition[] = [];
  const push = (memberId: AbilityId): void => {
    if (seen.has(memberId)) return;
    seen.add(memberId);
    if (!catalog.hasAbility(memberId)) return;
    const ability = catalog.getAbility(memberId);
    if (ability.kind !== 'active') return;
    out.push(ability);
  };
  // Class-granted free abilities first (Attack appears at the head of
  // the picker; mirror that ordering here for deterministic tie-breaks).
  const cls = catalog.getClass(actor.classState.currentClass);
  for (const freeId of cls.freeAbilities) push(freeId);
  // Then command-set members. Per ADR-0061, each active bucket holds a
  // list of CommandSetIds (capacity-gated). Flatten across all buckets.
  for (const entries of Object.values(actor.loadout.actionBuckets)) {
    for (const commandSetId of entries) {
      if (!catalog.hasCommandSet(commandSetId)) continue;
      const cs = catalog.getCommandSet(commandSetId);
      for (const memberId of cs.members) push(memberId);
    }
  }
  return out;
}

// Offensive = "deals or sets up damage/debuff against an enemy."
// Includes:
//   - Damage abilities (Lightning Strike, Fire Storm, attack, ...).
//   - Enemy-targeting status appliers without damage (Magnetic Mark
//     applying Vulnerable; future Sleep, Don't Move applied via tile
//     AoE — all of which the AI evaluates as "softens the target").
//   - AoE forms of either of the above.
// Excludes healing-tagged abilities (those flow through bestHealCandidate).
// Filters by MP affordability — the AI doesn't propose a cast it can't
// afford.
function enumerateOffensiveAbilities(
  state: GameState,
  actor: Unit,
  catalog: Catalog,
): ActiveAbilityDefinition[] {
  return enumerateActiveAbilities(actor, catalog).filter((a) => isOffensive(a, catalog)).filter((a) => canAfford(state, catalog, actor, a));
}

// MP affordability check — routes through `computeMpCost` so equipment
// / status `modifyMpCost` contributors compose into the AI's planner
// (per ADR-0056). The AI doesn't propose a cast it can't afford.
function canAfford(
  state: GameState,
  catalog: Catalog,
  actor: Unit,
  ability: ActiveAbilityDefinition,
): boolean {
  return actor.vitals.mp >= computeMpCost(state, catalog, actor.id, ability.id);
}

// `unit_or_tile` (post-S38) is the FFT-canonical "pin a unit OR pin a
// tile" charged-spell pattern. AI v1 always picks the unit-mode payload
// — the tactical layer doesn't yet model "pin a tile because the target
// is going to die before resolution." Tile-mode is a player-facing UX
// affordance for forecasting around mortality; AI behavior is identical
// to plain `single_unit` for now.
function targetsUnit(kind: ActiveAbilityDefinition['targeting']['kind']): boolean {
  return kind === 'single_unit' || kind === 'unit_or_tile';
}

function isOffensive(ability: ActiveAbilityDefinition, catalog: Catalog): boolean {
  // `targeting.kind: 'self'` with no target payload — no v1 consumer.
  // Caster-anchored cone / line AoEs use `targeting.kind: 'tile'` with
  // `aoe.anchorMode: 'caster'`; the tile derives direction. Direction
  // planning lives in `aoeTilesAffected`.
  if (ability.targeting.kind === 'self') return false;

  const damage = ability.effects.damage;
  if (damage !== undefined) {
    // Healing flows through the heal phase, not offensive.
    if (damage.tags.includes('healing')) return false;
    return true;
  }

  // No damage — offensive only if it applies a non-buff status. A
  // status without an `aiHints.polarity: 'buff'` declaration is treated
  // as a debuff (per session 20b polarity-hint contract). Magnetic Mark
  // (Vulnerable, debuff) hits this branch as offensive; Static Embrace
  // (crit_modifier, declared 'buff') is excluded.
  const statusEffects = ability.effects.statusEffects;
  if (statusEffects === undefined || statusEffects.length === 0) return false;
  const hasDebuff = statusEffects.some((s) => !isBuffStatus(catalog, s.typeId));
  if (!hasDebuff) return false;
  return targetsUnit(ability.targeting.kind) || ability.targeting.kind === 'tile';
}

// Healing abilities — single_unit, has a 'healing'-tagged damage spec.
// (Cure, future Raise, etc.)
function enumerateHealingAbilities(
  state: GameState,
  actor: Unit,
  catalog: Catalog,
): ActiveAbilityDefinition[] {
  return enumerateActiveAbilities(actor, catalog).filter(isHealingSingleUnit).filter((a) => canAfford(state, catalog, actor, a));
}

function isHealingSingleUnit(ability: ActiveAbilityDefinition): boolean {
  if (!targetsUnit(ability.targeting.kind)) return false;
  // Revive abilities (Raise — `removeKO`) carry a 'healing'-tagged damage
  // spec for the post-revive heal, but they are NOT general heals: validation
  // now gates them to KO'd targets only (amending ADR-0099). Excluding them
  // here stops the AI proposing Raise on a living ally (the playtest misuse) —
  // which validation would reject anyway. AI revive valuation is a separate
  // (deferred) beat; the AI doesn't currently cast Raise on the KO'd.
  if (ability.effects.removeKO === true) return false;
  const damage = ability.effects.damage;
  if (damage === undefined) return false;
  return damage.tags.includes('healing');
}

// Ally-buff abilities — single_unit ally targeting, no damage, applies
// at least one positive status. Static Embrace is the v1 consumer;
// Fire Embrace, Tide Surge, Earth Blessing also fit (they each have
// effects that align with this filter).
//
// Note: Earth Blessing applies Regen, which has health-restoring
// semantics. The AI treats it as a buff (not a heal) because the
// damage pipeline doesn't deliver Regen's healing — it's status-driven.
function enumerateAllyBuffAbilities(
  state: GameState,
  actor: Unit,
  catalog: Catalog,
): ActiveAbilityDefinition[] {
  return enumerateActiveAbilities(actor, catalog).filter((a) => isAllyBuff(a, catalog)).filter((a) => canAfford(state, catalog, actor, a));
}

function isAllyBuff(ability: ActiveAbilityDefinition, catalog: Catalog): boolean {
  if (!targetsUnit(ability.targeting.kind)) return false;
  // Has damage → it's offensive or healing, not a pure buff.
  if (ability.effects.damage !== undefined) return false;
  const statusEffects = ability.effects.statusEffects;
  if (statusEffects === undefined || statusEffects.length === 0) return false;
  // Must apply at least one status declared as a buff via aiHints.
  // Magnetic Mark (Vulnerable, debuff) is excluded — the buff phase
  // doesn't propose it on allies.
  return statusEffects.some((s) => isBuffStatus(catalog, s.typeId));
}

// =====================
// Helpers
// =====================

function hasStatus(unit: Unit, typeId: StatusTypeId): boolean {
  for (const s of unit.statuses) {
    if (s.typeId === typeId) return true;
  }
  return false;
}

function isVulnerable(unit: Unit): boolean {
  return hasStatus(unit, VULNERABLE_TYPE_ID);
}

// True when the cast's selfDamage cost would drop the actor to 0 HP
// or below. Storm Caller's 25% maxHpBase fires after per-target
// dispatch (per ADR-0032); refusing here prevents the AI from
// suicide-casting.
function selfDamageWouldKO(actor: Unit, ability: ActiveAbilityDefinition): boolean {
  const selfDamage = ability.selfDamage;
  if (selfDamage === undefined) return false;
  const cost = Math.floor(selfDamage.fraction * actor.baseStats.maxHpBase);
  return actor.vitals.hp - cost <= 0;
}

// Tag-aware penalty in [0, REACTION_PENALTY_CAP] proportional to the
// number of the target's equipped reactions whose compiled trigger
// condition matches the proposed ability's damage tags, scaled by the
// target's Brave. Counter (`damageTagsAny: ['physical']`) doesn't
// penalize a magical attack; Discharge (no `damageTagsAny`) penalizes
// any incoming non-healing damage.
//
// `reactionFields` decoration on the passive (populated by
// `compileReactionAbility` in the engine) is the inspection surface —
// the AI doesn't run the closure, just reads its declared trigger
// condition. Reactions without `reactionFields` (legacy or hand-built
// ones) fall through as "would always trigger" — the safest default
// (penalize without specific knowledge).
function reactionPenalty(
  target: Unit,
  ability: ActiveAbilityDefinition,
  catalog: Catalog,
): number {
  const damageTags = ability.effects.damage?.tags;
  let count = 0;
  for (const bucketAbilities of Object.values(target.loadout.passiveBuckets)) {
    if (bucketAbilities === undefined) continue;
    for (const aid of bucketAbilities) {
      if (!catalog.hasAbility(aid)) continue;
      const a = catalog.getAbility(aid);
      if (a.kind !== 'passive') continue;
      // The `bucket` brand's raw string value is one of
      // 'first_action' | 'reaction' | 'support' | 'movement' (per
      // BUCKET_IDS). Support / Movement passives don't react on attack
      // and shouldn't count toward the penalty.
      if (String(a.bucket) !== 'reaction') continue;
      if (!reactionWouldTrigger(a, damageTags)) continue;
      count += 1;
    }
  }
  if (count === 0) return 0;
  const braveFactor = Math.max(0, Math.min(1, target.baseStats.brave / 100));
  return Math.min(REACTION_PENALTY_CAP, count * REACTION_PENALTY_PER_STACK * braveFactor);
}

// Whether `reaction` (a passive ability with reaction bucket) would
// trigger against an ability whose damage tags are `incomingTags`.
// Reads the `reactionFields` decorative field; returns `true` when:
//   - the reaction has no decoration (safe default for unknown reactions);
//   - the trigger condition is `'always'`;
//   - the trigger condition is `'damage_received'` with tag filters
//     (damageTagsAny / damageTagsNone) that the incoming tags satisfy.
//
// Returns `false` when the proposed ability has no damage spec (no
// damage → no damage_received trigger). Reactions on healing-tagged
// effects: damageTagsNone: ['healing'] excludes them — but the AI's
// scoring path doesn't pass healing abilities through here anyway
// (heal phase runs separately).
function reactionWouldTrigger(
  reaction: PassiveAbilityDefinition,
  incomingTags: ReadonlyArray<DamageTag> | undefined,
): boolean {
  const fields = reaction.reactionFields;
  if (fields === undefined) return true; // safe default — penalize unknown reactions
  if (incomingTags === undefined) return false; // no damage → no damage_received trigger
  const cond = fields.triggerCondition;
  if (cond === undefined) return true;
  return triggerConditionMatches(cond, incomingTags);
}

function triggerConditionMatches(
  cond: ReactionTriggerCondition,
  tags: ReadonlyArray<DamageTag>,
): boolean {
  if (cond.type === 'always') return true;
  if (cond.type === 'damage_received') {
    const tagSet = new Set(tags);
    if (cond.damageTagsAny !== undefined) {
      const any = cond.damageTagsAny.some((t) => tagSet.has(t));
      if (!any) return false;
    }
    if (cond.damageTagsNone !== undefined) {
      const blocked = cond.damageTagsNone.some((t) => tagSet.has(t));
      if (blocked) return false;
    }
    // minDamage gate — the AI optimistically assumes the attack would
    // deal at least the threshold. Refining this would require running
    // the projection here, but the typical minDamage is 1 and the
    // projection is non-zero for any positive coefficient. Defensively
    // the simple "would trigger" answer suffices.
    return true;
  }
  return true;
}

// "Kill value" of a target — higher when the target is closer to
// dead. Per the v1 heuristic: lower HP is more valuable to attack.
// Returns a positive number; the inverse-HP shape gives diminishing
// returns at high HP and rapid escalation as HP → 0.
function killValue(target: Unit): number {
  const maxHp = Math.max(1, target.baseStats.maxHpBase);
  // 1 / (hp/maxHp + 0.05) — 0.05 floor avoids divide-by-zero on a unit
  // with 0 HP (which the AI shouldn't reach but is defensive).
  return 1 / Math.max(0.05, target.vitals.hp / maxHp);
}

// === MP economy (S66 chunk 2) =========================================

// Computed max MP including equipment / status contributions (ground rule
// 5: max values are computed, never read from a cached field). Mirrors the
// reducer's MP-restore cap path (statName 'maxMp').
function computeMaxMp(state: GameState, catalog: Catalog, unit: Unit): number {
  return runModifyStatQuery(state, catalog, {
    unit,
    statName: 'maxMp',
    baseValue: unit.baseStats.maxMpBase,
  });
}

// MP scarcity of a unit in [0, 1]: ~0 when MP is plentiful, → 1 as MP runs
// empty. Convex ((1 - ratio)²) so the penalty stays negligible during
// normal play and rises only as the pool runs genuinely low.
function mpScarcity(state: GameState, catalog: Catalog, unit: Unit): number {
  const maxMp = computeMaxMp(state, catalog, unit);
  if (maxMp <= 0) return 0;
  const ratio = Math.max(0, Math.min(1, unit.vitals.mp / maxMp));
  const deficit = 1 - ratio;
  return deficit * deficit;
}

// Scarcity-scaled penalty for spending `ability`'s MP cost, subtracted from
// the action's score (S66 chunk 2, D2). Zero for free / 0-MP abilities — a
// basic Attack is never penalized, so it naturally beats a marginal MP cast
// when the caster is low. Bounded (mpCost × weight × scarcity ≤ mpCost ×
// weight), so it tips marginal casts toward conservation without zeroing a
// high-value cast. Applied inside the leaf scorers (offence single / AoE /
// ally-buff) so the joint move-then-act planner's internal ability
// comparison — where the free-attack alternative would otherwise be
// discarded before the pool sees it — accounts for it too.
function mpSpendPenalty(
  state: GameState,
  catalog: Catalog,
  actor: Unit,
  ability: ActiveAbilityDefinition,
): number {
  const mpCost = computeMpCost(state, catalog, actor.id, ability.id);
  if (mpCost <= 0) return 0;
  return mpCost * MP_SPEND_PENALTY_WEIGHT * mpScarcity(state, catalog, actor);
}

// Session 40 (D7): does the actor's equipped weapon have an attackProc
// that applies a status the target is particularly vulnerable to? Returns
// a score multiplier. v1 scope is intentionally narrow — Silence-via-knife
// vs a mage class is the only synergy modeled. The function is generic in
// shape so future combinations (Berserk vs low-Brave, Slow vs high-Speed,
// etc.) extend the inner predicate without touching the call site.
//
// Why a fixed bonus rather than per-procced-status TTK math: a precise
// model would project damage with and without the status applied, weight
// by proc probability, and difference. That's a future tactics-pass shape.
// v1 wants the AI to *lean* toward mage targets when wielding Magebane —
// 1.5× is enough to break ties on roughly-equal HP targets while still
// letting kill-value dominate when a non-mage is genuinely closer to death.
function procTargetSynergyMultiplier(
  actor: Unit,
  target: Unit,
  ability: ActiveAbilityDefinition,
  catalog: Catalog,
): number {
  // Only physical attacks compose with weapon procs. A Knight casting a
  // spell shouldn't get the proc bonus for "wielding Magebane while
  // attacking a mage" — the proc fires from weapon hits.
  if (!ability.effects.damage?.tags.includes('physical')) return 1.0;

  let multiplier = 1.0;
  for (const slot of ['rightHand', 'leftHand'] as const) {
    const itemRef = actor.equipment[slot];
    if (itemRef === null) continue;
    if (!catalog.hasItem(itemRef)) continue;
    const item = catalog.getItem(itemRef);
    if (item.kind !== 'weapon') continue;
    if (item.attackProcs === undefined) continue;
    for (const proc of item.attackProcs) {
      if (procVsTargetIsHighValue(proc.abilityId, target, catalog)) {
        multiplier *= PROC_TARGET_BONUS;
      }
    }
  }
  return multiplier;
}

// True when the actor wields a weapon that rewards high ground — i.e. one
// declaring `height_delta` damage variance or `rangeFromHeightBonus`
// (today: bows). The approach-path positional term (see `pickBestMove`)
// only fires for these units, so a melee fighter still closes distance
// the same way it always did. Per S56's "derive from weapon data, don't
// add a `ranged` tag" decision — the weapon fields are the single source
// of truth for who benefits from elevation, the same gate the offensive
// height term already uses via `weaponRangeFromHeightSpec`.
function isHeightSeeker(actor: Unit, catalog: Catalog): boolean {
  for (const slot of ['rightHand', 'leftHand'] as const) {
    const itemRef = actor.equipment[slot];
    if (itemRef === null) continue;
    if (!catalog.hasItem(itemRef)) continue;
    const item = catalog.getItem(itemRef);
    if (item.kind !== 'weapon') continue;
    if (item.physicalVariance?.kind === 'height_delta') return true;
    if (item.rangeFromHeightBonus !== undefined) return true;
  }
  return false;
}

// Predicate for "this procced ability applied to this target is
// particularly valuable." Inspects the procced ability's status effects
// and matches against the target's profile. v1: Silence vs mage class.
function procVsTargetIsHighValue(
  proccedAbilityId: AbilityId,
  target: Unit,
  catalog: Catalog,
): boolean {
  if (!catalog.hasAbility(proccedAbilityId)) return false;
  const procced = catalog.getAbility(proccedAbilityId);
  if (procced.kind !== 'active') return false;
  const statusEffects = procced.effects.statusEffects;
  if (statusEffects === undefined) return false;
  for (const effect of statusEffects) {
    if (effect.typeId === SILENCE_TYPE_ID) {
      if (MAGE_CLASS_IDS.includes(target.classState.currentClass)) return true;
    }
  }
  return false;
}

// =====================
// Targeting helpers
// =====================

// Pure range check. Used for both single_unit and tile targeting via
// a uniform Position-to-Position check.
function positionInAbilityRange(
  state: GameState,
  actor: Unit,
  source: Position,
  target: Position,
  ability: ActiveAbilityDefinition,
  catalog: Catalog,
): boolean {
  const sourceTile = tileAt(state.map, source.x, source.y, source.layer);
  const targetTile = tileAt(state.map, target.x, target.y, target.layer);
  if (sourceTile === undefined || targetTile === undefined) return false;
  const ruleset = catalog.getRuleset(state.ruleset.id);
  const effective = computeAbilityRange(state, catalog, actor.id, ability);
  // Session 52: bow height-range bonus — the shooter reaches farther
  // horizontally when above the target (no-op otherwise). Mirrors the
  // live-validation site so AI enumeration agrees with the engine.
  // S68 (Vantage, ADR-0115): the actor's offensive elevation — feeds the
  // height-range bonus and the LoS source ("shoot over cover"). Vertical
  // `inRange` stays on the raw source elevation (Vantage doesn't change
  // vertical reach). Mirrors validate.ts.
  const offensiveSourceElev = runModifyAttackerElevation(state, catalog, {
    unit: actor,
    baseValue: sourceTile.elevation,
  });
  const heightBonus = rangeFromHeightBonus(
    weaponRangeFromHeightSpec(actor, catalog, ability),
    offensiveSourceElev,
    targetTile.elevation,
  );
  const sourceEndpoint = endpointFrom(source, sourceTile.elevation);
  const losSourceEndpoint = endpointFrom(source, offensiveSourceElev);
  const targetEndpoint = endpointFrom(target, targetTile.elevation);
  const within = inRange({
    source: sourceEndpoint,
    target: targetEndpoint,
    params: {
      horizontalMax: effective.horizontal + heightBonus,
      horizontalMin: effective.minHorizontal ?? ruleset.rangeDefaults.minHorizontal,
      verticalMax: effective.vertical,
    },
  });
  if (!within) return false;
  // S60 (B2): the rangeMode LoS/arc gate, mirroring validate.ts and the
  // coverage map's canReachAndHit. Without it the AI valued a blocked
  // straight_line shot as if it landed, then dropped its whole offence
  // plan when the winner failed canCommitAction (basic.ts pickJointActOrMove)
  // instead of falling back to a reachable shot. Melee carries no LoS check;
  // straight_line needs an unbroken sightline (terrain/units/barriers break
  // it); arc lobs over intermediate obstructions.
  const mode = 'rangeMode' in ability.targeting ? ability.targeting.rangeMode : undefined;
  if (mode === 'straight_line') {
    return hasLineOfSight(state.map, losSourceEndpoint, targetEndpoint);
  }
  if (mode === 'arc') {
    return arcTargetable(state.map, source, target);
  }
  return true; // melee / no rangeMode — range gate only
}

function targetIsInAbilityRange(
  state: GameState,
  actor: Unit,
  source: Position,
  target: Unit,
  ability: ActiveAbilityDefinition,
  catalog: Catalog,
): boolean {
  return positionInAbilityRange(state, actor, source, target.position, ability, catalog);
}

// Enumerate every reachable tile within an ability's range from the
// given source position. Used by AoE scoring to find candidate
// anchors. Bounded by the ability's effective horizontal range
// (post-`modifyAbilityRange` for the actor).
function tilesInAbilityRange(
  state: GameState,
  actor: Unit,
  source: Position,
  ability: ActiveAbilityDefinition,
  catalog: Catalog,
): Tile[] {
  const out: Tile[] = [];
  const baseRange = computeAbilityRange(state, catalog, actor.id, ability).horizontal;
  // Session 52: widen the enumeration box by the maximum height-range
  // bonus this shooter could earn (vs an elev-0 target), so the far
  // tiles a downhill bow shot newly reaches are actually tested by the
  // per-target `positionInAbilityRange` filter below. Without the
  // widening, those tiles fall outside a box sized to the base range
  // and would be silently dropped.
  const sourceTile = tileAt(state.map, source.x, source.y, source.layer);
  // S68 (Vantage): widen by the height bonus the actor's *offensive*
  // elevation could earn, so the box includes the farther tiles a
  // Vantage shooter newly reaches.
  const offensiveSourceElev = runModifyAttackerElevation(state, catalog, {
    unit: actor,
    baseValue: sourceTile?.elevation ?? 0,
  });
  const range =
    baseRange +
    maxRangeFromHeightBonus(
      weaponRangeFromHeightSpec(actor, catalog, ability),
      offensiveSourceElev,
    );
  for (let dy = -range; dy <= range; dy++) {
    for (let dx = -range; dx <= range; dx++) {
      const tx = source.x + dx;
      const ty = source.y + dy;
      // Bounds-check explicitly — `tileAt` throws on out-of-bounds (per
      // ADR-0002's "throw on programmer error"). The AI's enumeration
      // routinely lands outside the map for units near the edge, so we
      // skip rather than treat it as a programmer error.
      if (tx < 0 || ty < 0 || tx >= state.map.width || ty >= state.map.height) continue;
      const t = tileAt(state.map, tx, ty, 0);
      if (t === undefined) continue;
      const candidatePos: Position = { x: tx, y: ty, layer: 0 };
      if (!positionInAbilityRange(state, actor, source, candidatePos, ability, catalog)) continue;
      out.push(t);
    }
  }
  return out;
}

// =====================
// Score functions
// =====================

// Score for using `ability` on a single enemy `target`, cast from
// `source`. Returns -Infinity if the cast is invalid (out of range,
// would self-KO, etc.); otherwise a positive score with higher = more
// preferred. Tier 2 shape (per ADR-00X3): damageImpact (capped at
// target.hp, no overkill bonus) × killValue × (1 - tag-aware
// reactionPenalty). Vulnerable, crit, evasion, and resistance all
// fold in via the projection.
function scoreSingleUnitOffensive(
  state: GameState,
  catalog: Catalog,
  actor: Unit,
  source: Position,
  target: Unit,
  ability: ActiveAbilityDefinition,
): number {
  if (selfDamageWouldKO(actor, ability)) return Number.NEGATIVE_INFINITY;
  if (!targetIsInAbilityRange(state, actor, source, target, ability, catalog)) {
    return Number.NEGATIVE_INFINITY;
  }

  const damage = ability.effects.damage;
  if (damage !== undefined) {
    // Damage path. The projection runs the live damage pipeline with
    // expected-value substitutes for the random stages — Vulnerable's
    // ×1.5 multiplier, crit expectation, evasion's expected hit chance,
    // resistance, Faith × Faith, weapon WP, and PA/MA all compose
    // automatically. The AI doesn't re-derive any of this.
    const projected = projectExpectedDamageFromActor(state, catalog, actor, source, target, ability);
    let score = projected * killValue(target);
    score *= 1 - reactionPenalty(target, ability, catalog);
    score *= procTargetSynergyMultiplier(actor, target, ability, catalog);
    if (ability.selfDamage !== undefined && ability.selfDamage.fraction > 0) {
      score *= SELF_COST_DAMPING_FACTOR;
    }
    // S66 chunk 1: fold in expected knock-into-hazard fall damage. The
    // target is the knockback anchor (single-target); it survives the
    // direct hit when expected damage is below its current HP. Adds 0 on
    // flat ground / shoves into a wall (consequence-only, D1).
    score += expectedKnockbackFallValue(
      state, catalog, actor, source, target.position, target, ability,
      projected < target.vitals.hp,
    );
    // S66 chunk 2: subordinate MP-spend penalty (0 for free / 0-MP casts).
    return score - mpSpendPenalty(state, catalog, actor, ability);
  }

  // No damage — debuff applier (Magnetic Mark). Tier-2 setup→exploit:
  // value = marginal damage gained from making the target Vulnerable on
  // the actor's strongest follow-up damage ability, clamped at the
  // target's remaining HP. If the strongest follow-up already kills
  // without Vulnerable, marginal value is 0 — Mark adds nothing. If the
  // follow-up does <HP without amplification but kills with it, Mark's
  // value is the kill itself.
  if (ability.effects.statusEffects !== undefined) {
    if (isVulnerable(target)) return 0; // already marked
    const followUpProjected = strongestDamageFollowUp(state, catalog, actor, source, target);
    if (followUpProjected <= 0) return 0;
    const withVulnerable = followUpProjected * VULNERABLE_MULTIPLIER;
    const damageWithoutMark = Math.min(followUpProjected, target.vitals.hp);
    const damageWithMark = Math.min(withVulnerable, target.vitals.hp);
    const marginal = damageWithMark - damageWithoutMark;
    if (marginal <= 0) return 0;
    // S66 chunk 2: the debuff applier (Magnetic Mark) pays MP too.
    return marginal * killValue(target) - mpSpendPenalty(state, catalog, actor, ability);
  }
  return 0;
}

// Project the strongest follow-up damage the actor could deal to
// `target` from `source` next turn (or this turn if Mark is the move).
// Used by the Mark setup→exploit branch to compute marginal Vulnerable
// value. Returns 0 if no damage follow-up exists.
function strongestDamageFollowUp(
  state: GameState,
  catalog: Catalog,
  actor: Unit,
  source: Position,
  target: Unit,
): number {
  const offensives = enumerateOffensiveAbilities(state, actor, catalog);
  let best = 0;
  for (const a of offensives) {
    if (a.effects.damage === undefined) continue;
    if (a.effects.damage.tags.includes('healing')) continue;
    if (selfDamageWouldKO(actor, a)) continue;
    // Project from `source` (the actor's hypothetical position post-Mark)
    // — single-target only here; AoE follow-ups would need cluster-aware
    // projection that's overkill for setup-value estimation.
    if (!targetsUnit(a.targeting.kind) && a.targeting.kind !== 'tile') continue;
    const projected = projectExpectedDamageFromActor(state, catalog, actor, source, target, a);
    if (projected > best) best = projected;
  }
  return best;
}

// Project expected damage with the actor positioned at `source` (which
// may differ from actor.position during joint planning). Builds a
// per-call shallow-copy of the actor at the hypothetical position so
// the projection's evasion / elevation lookups read the correct facing
// distance. The actor's facing isn't mutated — projection's evasion
// formula uses target.facing vs attacker.position, not the other way
// around, so the shallow copy is sufficient.
function projectExpectedDamageFromActor(
  state: GameState,
  catalog: Catalog,
  actor: Unit,
  source: Position,
  target: Unit,
  ability: ActiveAbilityDefinition,
): number {
  if (samePosition(source, actor.position)) {
    return projectExpectedDamage({ state, catalog, attacker: actor, target, ability });
  }
  const repositioned: Unit = { ...actor, position: source };
  return projectExpectedDamage({ state, catalog, attacker: repositioned, target, ability });
}

// Score for an AoE ability anchored at `anchor`. Sums per-target
// damage projections for enemies in the cluster (each evaluated through
// the live damage pipeline with the cluster's targetCount, so chainBonus
// scales correctly) and subtracts friendly-fire deductions. Per-target
// reaction filtering applies to each enemy in the cluster.
function scoreAoeOffensive(
  state: GameState,
  catalog: Catalog,
  actor: Unit,
  source: Position,
  anchor: Position,
  ability: ActiveAbilityDefinition,
  enemies: ReadonlyArray<Unit>,
  allies: ReadonlyArray<Unit>,
): number {
  if (selfDamageWouldKO(actor, ability)) return Number.NEGATIVE_INFINITY;
  if (!positionInAbilityRange(state, actor, source, anchor, ability, catalog)) {
    return Number.NEGATIVE_INFINITY;
  }
  const aoe = ability.effects.aoe;
  if (aoe === undefined) return Number.NEGATIVE_INFINITY;

  const tiles = aoeTilesAffected(state, catalog, actor, source, anchor, ability, aoe);
  if (tiles.length === 0) return 0;

  const tileKeys = new Set(tiles.map(positionKey));

  const enemiesInCluster: Unit[] = [];
  const alliesInCluster: Unit[] = [];
  for (const e of enemies) {
    if (tileKeys.has(positionKey(e.position))) enemiesInCluster.push(e);
  }
  for (const a of allies) {
    if (a.id === actor.id) continue; // dispatcher excludes caster by default
    if (tileKeys.has(positionKey(a.position))) alliesInCluster.push(a);
  }

  if (enemiesInCluster.length === 0) return 0;

  const targetCount = enemiesInCluster.length + alliesInCluster.length;
  const hasDamage = ability.effects.damage !== undefined;
  const repositioned: Unit = samePosition(source, actor.position) ? actor : { ...actor, position: source };

  let total = 0;
  for (const enemy of enemiesInCluster) {
    if (hasDamage) {
      const projected = projectExpectedDamage({
        state, catalog, attacker: repositioned, target: enemy, ability, targetCount,
      });
      let perTarget = projected * killValue(enemy);
      perTarget *= 1 - reactionPenalty(enemy, ability, catalog);
      total += perTarget;
      // S66 chunk 1: knock-into-hazard fall for each caught enemy. AoE
      // knockback direction is uniform (caster→anchor), matching the
      // reducer; project each enemy's landing independently.
      total += expectedKnockbackFallValue(
        state, catalog, actor, source, anchor, enemy, ability,
        projected < enemy.vitals.hp,
      );
    } else {
      // Status-only AoE (Earth Cataclysm-style debuff applier). Coarse
      // proxy: weight by enemy hpRatio so applying e.g. Don't Move is
      // worth more on healthy threats than on near-dead ones (which
      // should be killed directly). Tier 2 doesn't project status
      // application chance × value; that's a future refinement.
      const maxHp = Math.max(1, enemy.baseStats.maxHpBase);
      const hpRatio = Math.max(0, Math.min(1, enemy.vitals.hp / maxHp));
      total += STATUS_AOE_PER_TARGET_WEIGHT * hpRatio;
    }
  }
  for (const ally of alliesInCluster) {
    if (!hasDamage) continue; // status-only AoE doesn't damage allies
    const projected = projectExpectedDamage({
      state, catalog, attacker: repositioned, target: ally, ability, targetCount,
    });
    total -= FRIENDLY_FIRE_PENALTY_FACTOR * projected * killValue(ally);
    // S66 chunk 1: a caught ally shoved into a hazard is a cost — the
    // fall value is signed negative for own-team occupants, so this
    // deters AoE knockbacks that would drop an ally off a ledge.
    total += expectedKnockbackFallValue(
      state, catalog, actor, source, anchor, ally, ability,
      projected < ally.vitals.hp,
    );
  }
  // S66 chunk 2: subordinate MP-spend penalty (0 for free / 0-MP casts).
  return total - mpSpendPenalty(state, catalog, actor, ability);
}

// Per-target weight for status-only AoEs (Earth Cataclysm-style debuff
// appliers without damage). Tuned in the same units as projected damage
// — a value of 15 says "applying a debuff to one healthy enemy is worth
// ~15 expected damage." Coarse but better than zero; refines when
// status-impact projection lands.
const STATUS_AOE_PER_TARGET_WEIGHT = 15;

// Resolve the tiles affected by an AoE for AI scoring. Mirrors what
// the dispatcher would compute at cast time:
//
//   - Target-anchored shapes (diamond/square/cross/custom): anchor =
//     target tile, no direction. Footprint blooms from the anchor.
//   - Caster-anchored cone/line shapes: anchor = caster's hypothetical
//     position (`source`), direction = cardinalFromTo(source, target
//     tile). Footprint blooms from the caster, oriented toward the
//     target tile.
//
// Returns [] when the anchor tile is missing (defensive against bad
// input), or when the cone/line target equals the source (no direction
// can be derived).
// Post-S38 fix (2026-05-17): thread `runModifyAoeShape` through the AI's
// footprint estimate so passive shape modifiers (Aether Bloom etc.) are
// reflected in the AI's targeting math. Without this, the AI scored an
// Aether-Bloom-equipped Fire Mage's Fire Storm as if it covered diamond
// r1 (5 tiles) instead of diamond r2 (13 tiles) — undervaluing the
// cluster pick. Also keeps the AI's AoE scoring in lockstep with the UI's
// preview overlay and the engine's actual cast.
function aoeTilesAffected(
  state: GameState,
  catalog: Catalog,
  actor: Unit,
  source: Position,
  anchor: Position,
  ability: ActiveAbilityDefinition,
  aoe: AoeSpec,
): ReadonlyArray<Tile> {
  // `source` is the AI's *hypothetical* caster position (the joint
  // planner considers casting from different tiles); `actor` is the
  // unit identity, used for the shape-modifier hook lookup. The hook
  // doesn't read position — it looks at the actor's loadout / equipment
  // / statuses for `modifyAoeShape` handlers.
  const ruleset = catalog.getRuleset(state.ruleset.id);
  const baseVerticalTolerance =
    aoe.verticalTolerance ?? ruleset.rangeDefaults.aoeVerticalTolerance;
  const verticalTolerance = runModifyAoeVerticalTolerance(state, catalog, {
    unit: actor,
    ability,
    baseValue: baseVerticalTolerance,
  });
  const finalShape = runModifyAoeShape(state, catalog, {
    unit: actor,
    ability,
    baseShape: aoe.shape,
  });

  if (finalShape.kind === 'cone' || finalShape.kind === 'line') {
    // Caster-anchored: bloom from `source`, orient toward `anchor`.
    if (samePosition(source, anchor)) return []; // can't derive direction
    const sourceTile = tileAt(state.map, source.x, source.y, source.layer);
    if (sourceTile === undefined) return [];
    const direction = cardinalFromTo(source, anchor);
    return aoeFootprint({
      map: state.map,
      shape: finalShape,
      anchor: { x: source.x, y: source.y, elevation: sourceTile.elevation },
      verticalTolerance,
      direction,
    });
  }

  const anchorTile = tileAt(state.map, anchor.x, anchor.y, anchor.layer);
  if (anchorTile === undefined) return [];
  return aoeFootprint({
    map: state.map,
    shape: finalShape,
    anchor: { x: anchor.x, y: anchor.y, elevation: anchorTile.elevation },
    verticalTolerance,
  });
}

// Score for casting an ally-buff ability (Static Embrace) on an
// ally. The buff's value is proportional to the ally's "damage
// potential" — an ally with high MA and offensive abilities benefits
// from a Crit_modifier more than a meatshield. Already-buffed allies
// score lower (no compounding bonus needed).
function scoreAllyBuff(
  state: GameState,
  catalog: Catalog,
  actor: Unit,
  source: Position,
  target: Unit,
  ability: ActiveAbilityDefinition,
): number {
  if (target.team !== actor.team) return Number.NEGATIVE_INFINITY;
  if (!targetIsInAbilityRange(state, actor, source, target, ability, catalog)) {
    return Number.NEGATIVE_INFINITY;
  }
  // The buff's effect is applying status_effects; we don't know which
  // status without name-matching, but we can use the actor-side intent
  // (declared by ability.effects.statusEffects) as a proxy. For tier
  // 1.5, score by ally's projected damage output: high MA + has
  // offensive abilities = high value to buff.
  const offensives = enumerateOffensiveAbilities(state, target, catalog);
  if (offensives.length === 0) return 0;
  // Damage potential = MA × number of offensive abilities. A Mage
  // with MA 9 and 5 offensive spells scores 45; a Knight with MA 4
  // and 1 attack scores 4. The dampening factor scales this into the
  // same range as direct-damage scores so buffs don't always dominate.
  const value = target.baseStats.ma * offensives.length * BUFF_SCORE_DAMPING_FACTOR;
  // S66 chunk 2: subordinate MP-spend penalty (0 for free / 0-MP casts).
  return value - mpSpendPenalty(state, catalog, actor, ability);
}

// =====================
// Worldcraft scoring (S57 Tier A — Pit/Valley fall damage)
// =====================

// Worldcraft works the actor can afford (Pillar/Pit/Hill/Valley/Barrier),
// recognized by `effects.worldcraft`. The candidate builders split them by
// payload: net-lowering elevation → fall damage (Tier A); net-raising
// elevation → perch (Tier B); barrier → denial (Tier B).
function enumerateWorldcraftWorks(
  state: GameState,
  actor: Unit,
  catalog: Catalog,
): ActiveAbilityDefinition[] {
  return enumerateActiveAbilities(actor, catalog)
    .filter((a) => a.effects.worldcraft !== undefined)
    .filter((a) => canAfford(state, catalog, actor, a));
}

// Best Pit/Valley cast as a scored pool candidate (S57 Tier A). A
// Worldcraft elevation cast is scored as an AoE *fall-damage* ability:
// reuse the engine's own `buildElevationChanges` (single source of truth —
// no drift from the terrain-change reducer) to resolve per-tile drops at a
// candidate anchor, then sum signed fall damage over the footprint's
// occupants. Enemies score positive (× killValue); allies and the caster
// itself are penalized (friendly fire). Flat ground / corners (drop ≤ 1)
// contribute 0, so the AI declines a pointless Pit naturally. Cast from the
// actor's current position only — bounded enumeration, no move-then-cast in
// v1 (a deliberate boundary; see docs/handoff.md).
function bestWorldcraftFallCandidate(
  state: GameState,
  catalog: Catalog,
  actor: Unit,
  works: ReadonlyArray<ActiveAbilityDefinition>,
): ScoredAction | null {
  let best: ScoredAction | null = null;
  for (const ability of works) {
    const spec = ability.effects.worldcraft;
    if (spec === undefined || spec.kind !== 'elevation') continue;
    // Only net-lowering works deal immediate fall damage; a raise punishes
    // only on revert (Tier C) and creates a perch now (Tier B).
    if (!spec.deltas.some((d) => d.delta < 0)) continue;
    for (const tile of tilesInAbilityRange(state, actor, actor.position, ability, catalog)) {
      const anchor: Position = { x: tile.x, y: tile.y, layer: tile.layer };
      const score = scoreWorldcraftFall(state, actor, anchor, spec.deltas);
      if (score <= 0) continue;
      const action: ProposedAction = {
        type: 'use_ability',
        source: 'player',
        actorId: actor.id,
        payload: { abilityId: ability.id, target: { kind: 'tile', position: anchor } },
      };
      if (!canCommitAction(state, catalog, actor, action)) continue;
      const cand: ScoredAction = {
        score,
        action,
        key: `worldcraft-fall|${ability.id}|${positionKey(anchor)}`,
      };
      if (best === null || compareScored(cand, best) > 0) best = cand;
    }
  }
  return best;
}

// Signed fall-damage value of an elevation cast anchored at `anchor`.
// Mirrors `reduceSystemTerrainChange` exactly: per footprint tile, the
// pre-change occupant takes `FALLING_DAMAGE_PER_LEVEL × dropDistance` when
// dropDistance > 1. Enemy drops are good (× killValue); ally/self drops are
// bad (× FRIENDLY_FIRE_PENALTY_FACTOR). KO'd occupants are ignored.
function scoreWorldcraftFall(
  state: GameState,
  actor: Unit,
  anchor: Position,
  deltas: ReadonlyArray<{ readonly dx: number; readonly dy: number; readonly delta: number }>,
): number {
  let total = 0;
  for (const c of buildElevationChanges(state, anchor, deltas)) {
    const dropDistance = c.originalElevation - c.newElevation;
    const occupant = unitAt(state, c.x, c.y, c.layer);
    if (occupant === undefined) continue;
    total += fallValueForOccupant(actor, occupant, dropDistance);
  }
  return total;
}

// Signed fall-damage value of a single occupant dropping `dropDistance`
// tiles. Shared by the Worldcraft fall scorer (Pit/Valley terrain drops)
// and the S66 knockback-fall valuation (shove-into-hazard), so both read
// the same currency from the same gate. Mirrors `fallDamageAction`'s
// `dropDistance > 1` threshold and `reduceSystemTerrainChange`'s damage
// formula exactly. Enemy drops score positive (× killValue); ally/self
// drops are penalized (× FRIENDLY_FIRE_PENALTY_FACTOR). KO'd occupants
// contribute nothing (a corpse can't fall). Returns 0 for drops ≤ 1.
function fallValueForOccupant(actor: Unit, occupant: Unit, dropDistance: number): number {
  if (dropDistance <= 1) return 0; // mirrors fallDamageAction's > 1 gate
  if (occupant.vitals.hp <= 0) return 0;
  const dmg = FALLING_DAMAGE_PER_LEVEL * dropDistance;
  return occupant.team !== actor.team
    ? dmg * killValue(occupant)
    : -FRIENDLY_FIRE_PENALTY_FACTOR * dmg * killValue(occupant);
}

// Expected knockback-fall value of a `damage.knockback` rider when it
// shoves `victim` from `victimPos` (S66, chunk 1). Projects the post-
// knockback landing tile via the engine's own `applyKnockback` primitive
// (single source of truth — no drift from the reducer's resolution), then
// values the resulting fall through `fallValueForOccupant`, weighted by
// the expected knockback chance (`computeAbilityChance`, the same formula
// the reducer rolls). The direction mirrors the reducer:
// `cardinalFromTo(attacker, anchor)` — the target is pushed directly away
// from the caster (single-target) or uniformly away from the AoE anchor.
//
// Consequence-only (D1): a shove onto flat ground / into a wall yields
// dropDistance ≤ 1 and scores 0, so the AI values displacement only when
// it triggers a fall. Pure repositioning is deferred to a later beat.
//
// `victimSurvivesDirect` gates the term: knockback fires only when the
// direct hit leaves the target alive (reducer requires hp > 0 post-damage),
// so a shove valued on an expected-lethal hit would be phantom value.
function expectedKnockbackFallValue(
  state: GameState,
  catalog: Catalog,
  attacker: Unit,
  attackerPos: Position,
  anchor: Position,
  victim: Unit,
  ability: ActiveAbilityDefinition,
  victimSurvivesDirect: boolean,
): number {
  const damage = ability.effects.damage;
  if (damage === undefined || damage.knockback === undefined) return 0;
  if (!victimSurvivesDirect) return 0;
  const knockback = damage.knockback;
  // Direction is uniform caster→anchor (matches the reducer). Same
  // tile → no derivable direction; the reducer guards this upstream.
  if (samePosition(attackerPos, anchor)) return 0;
  const direction: KnockbackDirection = cardinalFromTo(attackerPos, anchor);
  const result = applyKnockback({ state, unit: victim, direction, distance: knockback.distance });
  const fall = fallValueForOccupant(attacker, victim, result.dropDistance);
  if (fall === 0) return 0;
  const chance =
    knockback.chance === undefined
      ? 1
      : computeAbilityChance({
          state,
          catalog,
          caster: attacker,
          target: victim,
          baseChance: knockback.chance,
          ...(knockback.factors !== undefined ? { factors: knockback.factors } : {}),
        });
  return chance * fall;
}

// Temperament dial for perch-building (S57 Tier B). A raise is a spent
// Terraformer turn whose payoff is a *future* ally shot, so its pool score
// is discounted — it should win only when the height premium clearly beats
// acting now. Raise to build perches less (favour tempo); lower to build
// more. See docs/playtest-watch.md.
const PERCH_DAMP = 0.5;

// Apply a set of elevation changes to a hypothetical copy of the state's
// map (mirrors `reduceSystemTerrainChange`'s tile patch). Used to project
// an ally's shot from a tile the Terraformer is about to raise. Pure; does
// not emit fall damage (scoring-only).
function withElevationChanges(
  state: GameState,
  changes: ReturnType<typeof buildElevationChanges>,
): GameState {
  if (changes.length === 0) return state;
  const byKey = new Map<string, ReturnType<typeof buildElevationChanges>[number]>();
  for (const c of changes) byKey.set(positionKey({ x: c.x, y: c.y, layer: c.layer }), c);
  const tiles = state.map.tiles.map((t) => {
    const c = byKey.get(positionKey({ x: t.x, y: t.y, layer: t.layer }));
    return c === undefined ? t : { ...t, elevation: c.newElevation, terrain: c.newTerrain };
  });
  return { ...state, map: { ...state.map, tiles } };
}

// Best Pillar/Hill perch cast as a scored pool candidate (S57 Tier B).
//
// v1 scope — **lift-in-place**: value raising a tile a height-seeking ally
// (bow user) is *already standing on*, so the ally gains elevation without
// moving (the strict-subset-of-the-single-move-horizon case, D2). This
// sidesteps the reachability / jump-climb question and cannot gift an
// unreachable perch (the brief's failure mode). "Move onto a created perch"
// is deferred (needs hypothetical-reach + jump-climb validation, which
// overlaps the S59 threat model). Steal-risk is ignored per D3 — only
// allies are lifted, never enemies.
function bestPerchCandidate(
  state: GameState,
  catalog: Catalog,
  actor: Unit,
  enemies: ReadonlyArray<Unit>,
  works: ReadonlyArray<ActiveAbilityDefinition>,
): ScoredAction | null {
  if (enemies.length === 0) return null;
  const priority = pickPriorityTarget(enemies, catalog);
  let best: ScoredAction | null = null;
  for (const ability of works) {
    const spec = ability.effects.worldcraft;
    if (spec === undefined || spec.kind !== 'elevation') continue;
    // Pure raises only (Pillar/Hill). Pit/Valley (lowering) flow through
    // the fall scorer; mixed casts have no v1 content.
    if (spec.deltas.some((d) => d.delta < 0) || !spec.deltas.some((d) => d.delta > 0)) continue;
    for (const tile of tilesInAbilityRange(state, actor, actor.position, ability, catalog)) {
      const anchor: Position = { x: tile.x, y: tile.y, layer: tile.layer };
      const changes = buildElevationChanges(state, anchor, spec.deltas);
      if (changes.length === 0) continue;
      const score = scorePerchLiftInPlace(state, catalog, actor, changes, priority);
      if (score <= 0) continue;
      const action: ProposedAction = {
        type: 'use_ability',
        source: 'player',
        actorId: actor.id,
        payload: { abilityId: ability.id, target: { kind: 'tile', position: anchor } },
      };
      if (!canCommitAction(state, catalog, actor, action)) continue;
      const cand: ScoredAction = { score, action, key: `perch|${ability.id}|${positionKey(anchor)}` };
      if (best === null || compareScored(cand, best) > 0) best = cand;
    }
  }
  return best;
}

// Perch value = the largest improvement to a height-seeking ally's best
// projected shot at the priority target when the tile under it rises,
// discounted by PERCH_DAMP. Only counts allied height-seekers standing on a
// raised tile; enemies and non-height-seekers gain nothing here.
function scorePerchLiftInPlace(
  state: GameState,
  catalog: Catalog,
  actor: Unit,
  changes: ReturnType<typeof buildElevationChanges>,
  priority: Unit,
): number {
  const hypo = withElevationChanges(state, changes);
  let best = 0;
  for (const c of changes) {
    if (c.newElevation <= c.originalElevation) continue; // only raised tiles
    const occupant = unitAt(state, c.x, c.y, c.layer);
    if (occupant === undefined || occupant.vitals.hp <= 0) continue;
    if (occupant.team !== actor.team) continue; // never value lifting an enemy
    if (!isHeightSeeker(occupant, catalog)) continue;
    const baseline = strongestDamageFollowUp(state, catalog, occupant, occupant.position, priority);
    const lifted = strongestDamageFollowUp(hypo, catalog, occupant, occupant.position, priority);
    const improvement = lifted - baseline;
    if (improvement > best) best = improvement;
  }
  return best * PERCH_DAMP;
}

// Best revert-trap cast as a scored pool candidate (S59 Tier C, ADR-0096).
//
// When the actor is at its Worldcraft effect cap, the *next* cast evicts
// (reverts) the oldest queued effect. Reverting a raise (Pillar/Hill) drops
// whoever rides its footprint — the fall the engine deals on eviction. This
// values triggering that revert when an *enemy* currently stands on the
// evicted raise's footprint, springing a loaded trap. It NEVER drops an ally:
// an ally on any dropping footprint tile is a hard veto. No speculative
// trap-laying (the trap must already be loaded and ridden by an enemy *now*)
// and no movement prediction — current footprint occupancy only (D4).
//
// The trigger is a harmless raise (raises deal no fall on cast — the
// "same-turn raise-then-evict" path): casting it springs the older loaded
// raise via the FIFO eviction. Independent of the coverage map.
function bestRevertTrapCandidate(
  state: GameState,
  catalog: Catalog,
  actor: Unit,
  works: ReadonlyArray<ActiveAbilityDefinition>,
): ScoredAction | null {
  const queue = actor.worldcraftEffects;
  if (queue.length === 0) return null;
  // Mirror enqueueWorldcraftEffect: a new cast evicts oldest-first while
  // `length + 1 > cap`. evictCount ≤ 0 → the next cast fits, nothing reverts.
  const cap = computeWorldcraftEffectCap(state, catalog, actor);
  const evictCount = queue.length + 1 - cap;
  if (evictCount <= 0) return null;

  const value = scoreRevertDrop(state, actor, queue.slice(0, evictCount));
  if (value === null) return null; // ally on a dropping footprint → hard veto
  if (value <= 0) return null; // no enemy dropped → no value (no speculative laying)

  const trigger = firstValidRaiseCast(state, catalog, actor, works);
  if (trigger === null) return null; // no harmless raise available to spring it
  return { score: value, action: trigger.action, key: `revert-trap|${trigger.key}` };
}

// Signed fall value of reverting `entries` over their *current* footprint
// occupants. Reverting a raised tile drops its occupant by
// `newElevation − originalElevation`. Enemies dropped (drop > 1, the engine's
// damage gate) score `dmg × killValue`; an ally on *any* dropping tile (drop
// ≥ 1) returns null — a hard veto, never an own-goal. Barrier entries carry
// no fall.
function scoreRevertDrop(
  state: GameState,
  actor: Unit,
  entries: ReadonlyArray<WorldcraftEffectEntry>,
): number | null {
  let value = 0;
  for (const entry of entries) {
    if (entry.kind !== 'terrain') continue;
    for (const c of entry.tileChanges) {
      const drop = c.newElevation - c.originalElevation; // revert lowers the raised tile
      if (drop <= 0) continue; // not a raise (e.g. a Pit revert raises — no drop)
      const occupant = unitAt(state, c.x, c.y, c.layer);
      if (occupant === undefined || occupant.vitals.hp <= 0) continue;
      if (occupant.team === actor.team) return null; // never drop an ally — hard veto
      if (drop <= 1) continue; // enemy, but below the fall-damage gate
      value += FALLING_DAMAGE_PER_LEVEL * drop * killValue(occupant);
    }
  }
  return value;
}

// The first valid pure-raise cast (Pillar/Hill) the actor can commit, used to
// trigger a revert harmlessly (raises deal no fall on cast). Pure raises only
// — a Pit/Valley trigger would itself drop occupants and could harm allies.
// null when none is affordable/legal.
function firstValidRaiseCast(
  state: GameState,
  catalog: Catalog,
  actor: Unit,
  works: ReadonlyArray<ActiveAbilityDefinition>,
): { action: ProposedAction; key: string } | null {
  for (const ability of works) {
    const spec = ability.effects.worldcraft;
    if (spec === undefined || spec.kind !== 'elevation') continue;
    if (spec.deltas.some((d) => d.delta < 0) || !spec.deltas.some((d) => d.delta > 0)) continue;
    for (const tile of tilesInAbilityRange(state, actor, actor.position, ability, catalog)) {
      const anchor: Position = { x: tile.x, y: tile.y, layer: tile.layer };
      const action: ProposedAction = {
        type: 'use_ability',
        source: 'player',
        actorId: actor.id,
        payload: { abilityId: ability.id, target: { kind: 'tile', position: anchor } },
      };
      if (!canCommitAction(state, catalog, actor, action)) continue;
      return { action, key: `${ability.id}|${positionKey(anchor)}` };
    }
  }
  return null;
}

// =====================
// Worldcraft Tier B — Barrier denial (S61)
// =====================

// Sum of expected incoming damage across a tile's threat entries.
function sumIncoming(entries: ReadonlyArray<ThreatEntry>): number {
  return entries.reduce((s, e) => s + e.expectedDamage, 0);
}

// Insert a barrier on each tile of `line` in a hypothetical copy of the map —
// the `withBarrier` substrate the S59 brief assumed existed but didn't. Only
// *presence* matters to the threat model (`hasLineOfSight` reads
// `tile.barrier !== undefined`; pathfinding treats a barrier tile as
// impassable), so a minimal BarrierState suffices for scoring — hp/ttl/owner
// don't affect reach geometry. Pure; mirrors `withElevationChanges`.
function withBarrier(
  state: GameState,
  actor: Unit,
  line: ReadonlyArray<Position>,
  ttl: number,
): GameState {
  const keys = new Set(line.map((p) => positionKey(p)));
  const barrier = { hp: 1, ttl, ownerId: actor.id };
  const tiles = state.map.tiles.map((t) =>
    keys.has(positionKey({ x: t.x, y: t.y, layer: t.layer })) ? { ...t, barrier } : t,
  );
  return { ...state, map: { ...state.map, tiles } };
}

// The AI's most-threatened living ally (the actor included), by live incoming
// expected damage. The single protected unit for v1 Barrier denial (D5 —
// bounded). null when no ally faces any incoming threat (so the AI never builds
// a speculative wall — Barrier is purely reactive in v1).
function mostThreatenedAlly(
  state: GameState,
  catalog: Catalog,
  allies: ReadonlyArray<Unit>,
): { ally: Unit; incoming: number } | null {
  let best: { ally: Unit; incoming: number } | null = null;
  for (const ally of allies) {
    const incoming = sumIncoming(threatsToTile(state, catalog, ally, ally.position));
    if (incoming <= 0) continue;
    if (best === null || incoming > best.incoming) best = { ally, incoming };
  }
  return best;
}

// Candidate barrier lines: four cardinal "screens" around `ally` — a line one
// tile beyond it on N/S/E/W, oriented perpendicular and centred on the ally's
// cross-axis — at each length in `lengths`. 4 × |lengths| candidates; legality
// (range / occupancy / barrier-free / on-map) is left to `canCommitAction`.
// Intentional walls that actually screen the ally, not a full in-range sweep
// (D5 — the perf bound).
function barrierScreenLines(ally: Unit, lengths: ReadonlyArray<number>): Position[][] {
  const { x: ax, y: ay, layer } = ally.position;
  const out: Position[][] = [];
  for (const len of lengths) {
    const half = Math.floor((len - 1) / 2);
    // Vertical screens (East x=ax+1, West x=ax-1): vary y around the ally.
    for (const sx of [ax + 1, ax - 1]) {
      const line: Position[] = [];
      for (let i = 0; i < len; i++) line.push({ x: sx, y: ay - half + i, layer });
      out.push(line);
    }
    // Horizontal screens (South y=ay+1, North y=ay-1): vary x around the ally.
    for (const sy of [ay + 1, ay - 1]) {
      const line: Position[] = [];
      for (let i = 0; i < len; i++) line.push({ x: ax - half + i, y: sy, layer });
      out.push(line);
    }
  }
  return out;
}

// How many of the highest-gain screen candidates pay for the expensive
// self-obstruction (cost) recompute. The two-stage lazy bound (D5): every legal
// screen gets a cheap gain pass; only the top few get the per-enemy cost pass.
const BARRIER_COST_SHORTLIST = 3;

// Best Barrier cast as a scored pool candidate (S61 Tier B — the deferred half).
//
// Net coverage-delta: the reduction in expected incoming damage to the AI's
// most-threatened ally (`threatsToTile` live vs. `withBarrier`) MINUS the
// barrier's cost to the AI team's own offense — because a barrier blocks both
// teams, a wall that mostly severs the AI's own shots/approach must not be
// chosen (D4 — net benefit, not ally-protection only). Self-obstruction is
// measured by the same resolver with `occupant` flipped to each enemy, so
// "enemies-of-occupant" is the AI team: the drop in the AI team's reach-and-hit
// to an enemy is the AI's lost offense. A barrier can only reduce reach (it's
// impassable + sight-blocking), so both deltas are one-signed.
function bestBarrierDenialCandidate(
  state: GameState,
  catalog: Catalog,
  actor: Unit,
  allies: ReadonlyArray<Unit>,
  enemies: ReadonlyArray<Unit>,
  works: ReadonlyArray<ActiveAbilityDefinition>,
): ScoredAction | null {
  if (enemies.length === 0) return null;
  const barrierAbility = works.find((a) => a.effects.worldcraft?.kind === 'barrier');
  if (barrierAbility === undefined) return null;
  const spec = barrierAbility.effects.worldcraft;
  if (spec === undefined || spec.kind !== 'barrier') return null;
  const ttl = spec.ttl;

  const protectedAlly = mostThreatenedAlly(state, catalog, allies);
  if (protectedAlly === null) return null; // nothing to screen → no speculative wall
  const ally = protectedAlly.ally;
  const liveIncoming = protectedAlly.incoming;

  // Stage 1 — gain for every legal screen line (cheap relative to the cost pass:
  // one `withBarrier` threat recompute against the single protected ally).
  interface GainCand {
    line: Position[];
    action: ProposedAction;
    gain: number;
    hypo: GameState;
  }
  const gains: GainCand[] = [];
  for (const line of barrierScreenLines(ally, [3, 4, 5])) {
    const action: ProposedAction = {
      type: 'use_ability',
      source: 'player',
      actorId: actor.id,
      payload: { abilityId: barrierAbility.id, target: { kind: 'tile_set', positions: line } },
    };
    if (!canCommitAction(state, catalog, actor, action)) continue;
    const hypo = withBarrier(state, actor, line, ttl);
    const after = sumIncoming(threatsToTile(hypo, catalog, ally, ally.position));
    const gain = Math.max(0, liveIncoming - after) * killValue(ally);
    if (gain <= 0) continue; // wall screens nothing for this ally
    gains.push({ line, action, gain, hypo });
  }
  if (gains.length === 0) return null;

  // Stage 2 — net = gain − self-obstruction, for the top-K gainers only. The AI
  // team's live offense to each enemy is computed once and reused.
  gains.sort((a, b) => b.gain - a.gain);
  const liveOffense = new Map<UnitId, number>();
  for (const enemy of enemies) {
    liveOffense.set(enemy.id, sumIncoming(threatsToTile(state, catalog, enemy, enemy.position)));
  }

  let best: ScoredAction | null = null;
  for (const cand of gains.slice(0, BARRIER_COST_SHORTLIST)) {
    let cost = 0;
    for (const enemy of enemies) {
      const live = liveOffense.get(enemy.id) ?? 0;
      const after = sumIncoming(threatsToTile(cand.hypo, catalog, enemy, enemy.position));
      cost += Math.max(0, live - after) * killValue(enemy);
    }
    const net = cand.gain - cost;
    if (net <= 0) continue; // self-obstruction outweighs the protection
    const scored: ScoredAction = {
      score: net,
      action: cand.action,
      key: `barrier-denial|${barrierAbility.id}|${positionKey(cand.line[0]!)}|${cand.line.length}`,
    };
    if (best === null || compareScored(scored, best) > 0) best = scored;
  }
  return best;
}

// =====================
// Phase orchestrators
// =====================

// Best heal (Cure-style ability) as a scored pool candidate (S57). For
// each in-range ally and healing ability, value the cast as
// `effectiveHeal × killValue(ally) × HEAL_WEIGHT`, where effectiveHeal =
// min(projectedHeal, missingHP). The killValue weighting makes a heal on
// a near-dead ally score high (mirroring how finishing a near-dead enemy
// scores high) while a top-off on a near-full ally scores ~0 (missingHP
// → 0). Returns the highest-scoring committable heal, or null.
//
// No HP-ratio cliff: full-HP allies fall out naturally via missingHP, so
// the old HEAL_THRESHOLD gate is gone — the score decides.
function bestHealCandidate(
  state: GameState,
  catalog: Catalog,
  actor: Unit,
  allies: ReadonlyArray<Unit>,
  healing: ReadonlyArray<ActiveAbilityDefinition>,
): ScoredAction | null {
  if (healing.length === 0) return null;
  let best: ScoredAction | null = null;
  for (const ally of allies) {
    const missing = Math.max(0, readMaxHpProxy(ally) - ally.vitals.hp);
    if (missing <= 0) continue;
    for (const ability of healing) {
      if (!targetIsInAbilityRange(state, actor, actor.position, ally, ability, catalog)) continue;
      const projectedHeal = projectExpectedDamage({ state, catalog, attacker: actor, target: ally, ability });
      const effectiveHeal = Math.min(projectedHeal, missing);
      if (effectiveHeal <= 0) continue;
      const score = effectiveHeal * killValue(ally) * HEAL_WEIGHT;
      const action: ProposedAction = {
        type: 'use_ability',
        source: 'player',
        actorId: actor.id,
        payload: { abilityId: ability.id, target: { kind: 'unit', unitId: ally.id } },
      };
      if (!canCommitAction(state, catalog, actor, action)) continue;
      const cand: ScoredAction = { score, action, key: `heal|${ability.id}|${ally.id}` };
      if (best === null || compareScored(cand, best) > 0) best = cand;
    }
  }
  return best;
}

// Best Math Skill cast as a scored pool candidate (S57). Wraps
// `pickBestMathSkill` (which now returns its best positive option, with
// the MATH_SCORE_THRESHOLD pre-empt removed) and injects its net-team-
// value into the pool via MATH_SCORE_SCALE so a lethal attack can
// outrank a marginal Math cast. Returns null for non-Math actors or when
// the best option scores ≤ 0 / can't be committed.
function bestMathCandidate(
  state: GameState,
  catalog: Catalog,
  actor: Unit,
): ScoredAction | null {
  const m = pickBestMathSkill(state, catalog, actor);
  if (m === null) return null;
  const score = m.score * MATH_SCORE_SCALE;
  if (score <= 0) return null;
  if (!canCommitAction(state, catalog, actor, m.action)) return null;
  return { score, action: m.action, key: 'math' };
}

// Best Act candidate from `source` — a (score, action, key) triple
// for the highest-scoring offensive or buff that the actor could
// commit IF they were standing at `source`. No validation against the
// live state — validation happens at commit time when the actor is
// actually at the chosen source position.
//
// Used by both:
//   - The single-position `pickBestAction` (source = actor.position)
//   - The two-action joint planner (source = each reachable destination)
//
// The shape of the returned candidate mirrors the plan's commit form:
// the `action` is the Act ProposedAction the AI would commit if it
// chose this plan. For (Move + Act) plans, the Act is committed by
// the next AI call from the new position; for (Act-only) plans, the
// Act is committed directly.
function bestActFromSource(
  state: GameState,
  catalog: Catalog,
  actor: Unit,
  source: Position,
  enemies: ReadonlyArray<Unit>,
  allies: ReadonlyArray<Unit>,
  offensive: ReadonlyArray<ActiveAbilityDefinition>,
  buffs: ReadonlyArray<ActiveAbilityDefinition>,
): { score: number; action: ProposedAction; key: string } | null {
  let best: { score: number; action: ProposedAction; key: string } | null = null;

  for (const ability of buffs) {
    for (const ally of allies) {
      const score = scoreAllyBuff(state, catalog, actor, source, ally, ability);
      if (score <= 0) continue;
      const proposed: ProposedAction = {
        type: 'use_ability',
        source: 'player',
        actorId: actor.id,
        payload: { abilityId: ability.id, target: { kind: 'unit', unitId: ally.id } },
      };
      const candidate = { score, action: proposed, key: `${ability.id}|buff|${ally.id}` };
      if (best === null || compareScored(candidate, best) > 0) best = candidate;
    }
  }

  for (const ability of offensive) {
    if (ability.effects.aoe !== undefined) {
      if (ability.targeting.kind === 'tile') {
        const tiles = tilesInAbilityRange(state, actor, source, ability, catalog);
        for (const tile of tiles) {
          const anchor: Position = { x: tile.x, y: tile.y, layer: tile.layer };
          const score = scoreAoeOffensive(state, catalog, actor, source, anchor, ability, enemies, allies);
          if (score <= 0) continue;
          const proposed: ProposedAction = {
            type: 'use_ability',
            source: 'player',
            actorId: actor.id,
            payload: { abilityId: ability.id, target: { kind: 'tile', position: anchor } as AbilityTarget },
          };
          const candidate = { score, action: proposed, key: `${ability.id}|tile|${positionKey(anchor)}` };
          if (best === null || compareScored(candidate, best) > 0) best = candidate;
        }
      } else if (targetsUnit(ability.targeting.kind)) {
        for (const enemy of enemies) {
          const score = scoreAoeOffensive(state, catalog, actor, source, enemy.position, ability, enemies, allies);
          if (score <= 0) continue;
          const proposed: ProposedAction = {
            type: 'use_ability',
            source: 'player',
            actorId: actor.id,
            payload: { abilityId: ability.id, target: { kind: 'unit', unitId: enemy.id } },
          };
          const candidate = { score, action: proposed, key: `${ability.id}|unit|${enemy.id}` };
          if (best === null || compareScored(candidate, best) > 0) best = candidate;
        }
      }
    } else if (targetsUnit(ability.targeting.kind)) {
      for (const enemy of enemies) {
        const score = scoreSingleUnitOffensive(state, catalog, actor, source, enemy, ability);
        if (score <= 0) continue;
        const proposed: ProposedAction = {
          type: 'use_ability',
          source: 'player',
          actorId: actor.id,
          payload: { abilityId: ability.id, target: { kind: 'unit', unitId: enemy.id } },
        };
        const candidate = { score, action: proposed, key: `${ability.id}|unit|${enemy.id}` };
        if (best === null || compareScored(candidate, best) > 0) best = candidate;
      }
    }
    // Tile-targeted, no AoE (Bolt) — not in any v1 class loadout.
    // Self-anchored AoEs (cone, line) — see `bestSelfAnchoredAoeFromSource`.
  }
  return best;
}

// Joint two-action planner (per ADR-00X4). Enumerates every
// (destination, ability, target) triple across the actor's reachable
// destinations + abilities + targets, scores each, and picks the
// highest. If the chosen destination is the actor's current position,
// commits the Act directly. Otherwise commits the Move toward the
// chosen destination — the next AI call will re-plan from the new
// position and find the matching Act.
//
// Why this matters: today's call cadence (Move first, then Act) misses
// patterns like "step onto a tile that puts a wounded enemy into Strike
// range AND catches an extra enemy in a Chain Lightning AoE." The
// stand-alone `pickBestMove` only knew "best destination by best Act
// score reachable from there"; the joint planner closes the loop by
// committing the Act-aware Move and trusting the next call to pick up
// the Act it implicitly chose.
//
// Returns a ScoredAction so the plan competes in the unified pool (S57):
//   - score = the best plan's value (in the offensive currency, net of
//     the tiny move-cost tiebreak).
//   - action = a use_ability when the best plan is to act in place, or a
//     Move when the best plan requires moving first (the next AI call
//     re-plans from the new position and commits the Act).
//   - null when no positive-score plan exists across any destination
//     (caller falls back to `pickBestMove` for distance-closing).
function pickJointActOrMove(
  state: GameState,
  catalog: Catalog,
  actor: Unit,
  enemies: ReadonlyArray<Unit>,
  allies: ReadonlyArray<Unit>,
  offensive: ReadonlyArray<ActiveAbilityDefinition>,
  buffs: ReadonlyArray<ActiveAbilityDefinition>,
  coverage: CoverageMap | null,
): ScoredAction | null {
  const turn = state.turnState;
  if (turn === null) return null;
  const canAct = turn.budget.actsAvailable > 0;
  const canMove = turn.budget.movesAvailable > 0;
  if (!canAct) return null; // no Act → joint planner has nothing to plan

  // Enumerate sources: actor.position is always a candidate (the
  // "act in place" plan); other destinations only if Move budget allows.
  // Each plan carries its raw offensive value, its move cost, and the S59
  // residual danger at its firing tile. Plans are ranked offence-first; the
  // defensive term is a tie-break (below offence, above move cost) so the
  // planner prefers acting from safe ground (e.g. above melee reach) only
  // when the offence is genuinely equal — it never trades offence for
  // safety, which is what keeps the AI engaging (see `residualDangerForPlan`).
  type Plan = {
    rawOffense: number;
    danger: number;
    moveCost: number;
    action: ProposedAction;
    key: string;
    destination: Position;
  };
  const plans: Plan[] = [];
  const here = bestActFromSource(state, catalog, actor, actor.position, enemies, allies, offensive, buffs);
  if (here !== null) {
    plans.push({
      rawOffense: here.score,
      danger: residualDangerForPlan(state, catalog, coverage, actor, actor.position, here.action),
      moveCost: 0,
      action: here.action,
      key: here.key,
      destination: actor.position,
    });
  }

  if (canMove) {
    const moves = getLegalMoves(state, actor.id, catalog);
    for (const [moveKey, path] of moves.reachable) {
      const dest = path.destination;
      if (samePosition(dest, actor.position)) continue;
      const fromHere = bestActFromSource(state, catalog, actor, dest, enemies, allies, offensive, buffs);
      if (fromHere === null) continue;
      plans.push({
        rawOffense: fromHere.score,
        danger: residualDangerForPlan(state, catalog, coverage, actor, dest, fromHere.action),
        // Move-cost dampening: tiny shave per step encourages "stay put
        // when a same-score Act exists here." Ranked below the safety
        // tie-break so escaping melee outranks a cosmetic short move.
        moveCost: MOVE_TIE_BREAK_PENALTY * (path.cost ?? 0),
        action: fromHere.action,
        key: `${moveKey}|${fromHere.key}`,
        destination: dest,
      });
    }
  }

  if (plans.length === 0) return null;

  // Rank: higher offence wins; ties broken toward lower danger (safer
  // ground), then lower move cost, then lex-id.
  let best: Plan = plans[0]!;
  for (let i = 1; i < plans.length; i++) {
    if (compareJointPlans(plans[i]!, best) > 0) best = plans[i]!;
  }

  // The pool score is the undiscounted offence (minus the tiny move-cost
  // tiebreak) — the defensive term shaped *which tile*, but the attack
  // competes against heals / items / Worldcraft on its true offensive value.
  const poolScore = best.rawOffense - best.moveCost;

  // Act in place: validate and return the Act as a scored candidate.
  if (samePosition(best.destination, actor.position)) {
    if (!canCommitAction(state, catalog, actor, best.action)) return null;
    return { score: poolScore, action: best.action, key: best.key };
  }

  // Otherwise: commit the Move now; next AI call commits the Act from
  // the new position. We deliberately don't validate the Act here —
  // it'd fail (actor still at old position). The next call's
  // bestActFromSource call will re-derive an Act from the new position
  // (likely identical, since nothing in `(state, catalog)` changes
  // between Move-commit and the next decision call other than the
  // actor's position, which is exactly what we planned for).
  const moveAction: ProposedAction = {
    type: 'move',
    source: 'player',
    actorId: actor.id,
    payload: { destination: best.destination },
  };
  if (!canCommitAction(state, catalog, actor, moveAction)) return null;
  return { score: poolScore, action: moveAction, key: best.key };
}

// Joint-plan ranking: offence first (higher wins), then the S59 safety
// tie-break (lower residual danger), then move cost (shorter wins), then
// lex-id. Offence dominates so the planner never trades damage for safety —
// danger only chooses between equal-offence tiles. Returns >0 when `a` beats `b`.
function compareJointPlans(
  a: { rawOffense: number; danger: number; moveCost: number; key: string },
  b: { rawOffense: number; danger: number; moveCost: number; key: string },
): number {
  if (a.rawOffense !== b.rawOffense) return a.rawOffense - b.rawOffense;
  if (a.danger !== b.danger) return b.danger - a.danger; // lower danger wins
  if (a.moveCost !== b.moveCost) return b.moveCost - a.moveCost; // lower cost wins
  return a.key < b.key ? 1 : a.key > b.key ? -1 : 0;
}

// Per-step move-cost tiebreak. See `pickJointActOrMove`. Tuned to be
// orders of magnitude smaller than any meaningful Act score difference.
const MOVE_TIE_BREAK_PENALTY = 0.001;

// Higher score wins; on ties, *lower* lex-id wins (mirrors the
// pre-tier-1.5 `compareTargets` convention so existing tests stay
// stable). Returns >0 when `a` is better than `b`.
function compareScored(
  a: { score: number; key: string },
  b: { score: number; key: string },
): number {
  if (a.score !== b.score) return a.score - b.score;
  return a.key < b.key ? 1 : a.key > b.key ? -1 : 0;
}

interface MoveScore {
  readonly destination: Position;
  // Best offensive score reachable from this destination, or 0 if no
  // viable offensive option (no enemy in range from here).
  readonly bestOffensiveScore: number;
  // Distance (horizontal) to the best-kill-value enemy. Tiebreak when
  // no destination puts anyone in offensive range.
  readonly distanceToPriority: number;
  // Height-seeker approach term (S56): the best damage this unit could
  // project against the priority target *from this destination*, range
  // gate relaxed, via the shared projection resolver. Height-sensitive
  // for free (the longbow's `height_delta` reward folds in), so an
  // elevated approach tile scores higher than a flat one. 0 for
  // non-height-seekers (the term is inert and pure distance-closing
  // applies). See `pickBestMove`.
  readonly positionalValue: number;
  // S59 expected incoming damage at this destination (from the coverage
  // map). Applied only as a tiebreak *below* distance/positional rank — the
  // fallback move's job is to advance, and it is reached only when no attack
  // is possible this turn (so danger is usually ~0 anyway); safety must not
  // override closing the distance, only break ties toward the safer tile.
  readonly incomingDanger: number;
  // Stable lex key for final tiebreak.
  readonly key: string;
}

// Best move destination for advancing the AI's plan. Two-tier scoring:
// (1) destinations that put a high-value offensive option in reach win
// among themselves; (2) otherwise, minimize distance to the priority
// enemy globally — focuses fire over time even when no kill is on the
// table this turn.
//
// Returns null when the only legal move is staying put.
function pickBestMove(
  state: GameState,
  catalog: Catalog,
  actor: Unit,
  enemies: ReadonlyArray<Unit>,
  allies: ReadonlyArray<Unit>,
  offensive: ReadonlyArray<ActiveAbilityDefinition>,
  coverage: CoverageMap | null,
): ProposedAction | null {
  const moves = getLegalMoves(state, actor.id, catalog);
  // Priority target: highest kill-value (with Vulnerable bonus).
  // When no enemy yields a meaningful score, fall back to lowest-HP.
  const priorityTarget = pickPriorityTarget(enemies, catalog);

  // S56 approach-path positional term. For a height-seeker (bow user),
  // value an elevated approach tile by the better future shot it unlocks
  // against the priority target — reusing the projection resolver, so
  // height folds in for free. `baseShot` (the shot from where the actor
  // stands now) sets the scale: the per-tile distance cost is a fraction
  // of it, so the tradeoff is damage-scale-independent. When `baseShot`
  // is 0 (no projectable shot) the term is inert and we fall straight
  // back to pure distance-closing — and non-height-seekers never enter
  // this branch at all, so melee approach is unchanged.
  const heightSeeker = isHeightSeeker(actor, catalog);
  const baseShot = heightSeeker
    ? strongestDamageFollowUp(state, catalog, actor, actor.position, priorityTarget)
    : 0;
  const positionalActive = heightSeeker && baseShot > 0;
  const distanceCost = APPROACH_DISTANCE_FRACTION * baseShot;

  let best: MoveScore | null = null;

  for (const [key, path] of moves.reachable) {
    const dest = path.destination;
    if (samePosition(dest, actor.position)) continue;

    const bestOffensiveScore = bestOffensiveScoreFrom(
      state, catalog, actor, dest, enemies, allies, offensive,
    );
    const distanceToPriority = horizontalDistance(dest, priorityTarget.position);
    const positionalValue = positionalActive
      ? strongestDamageFollowUp(state, catalog, actor, dest, priorityTarget)
      : 0;
    const candidate: MoveScore = {
      destination: dest,
      bestOffensiveScore,
      distanceToPriority,
      positionalValue,
      incomingDanger: coverage === null ? 0 : coverage.expectedIncoming(dest),
      key,
    };

    const better = positionalActive
      ? compareMovesPositional(candidate, best, distanceCost)
      : compareMoves(candidate, best);
    if (better > 0) best = candidate;
  }

  if (best === null) return null;

  const proposed: ProposedAction = {
    type: 'move',
    source: 'player',
    actorId: actor.id,
    payload: { destination: best.destination },
  };
  if (!canCommitAction(state, catalog, actor, proposed)) return null;
  return proposed;
}

// Pick the priority enemy for move-distance tiebreak. Highest kill-
// value × Vulnerable bonus. Among equals, lex-id.
function pickPriorityTarget(
  enemies: ReadonlyArray<Unit>,
  _catalog: Catalog,
): Unit {
  let best: Unit = enemies[0]!;
  let bestScore = scorePriority(best);
  for (let i = 1; i < enemies.length; i++) {
    const u = enemies[i]!;
    const s = scorePriority(u);
    if (s > bestScore || (s === bestScore && u.id < best.id)) {
      best = u;
      bestScore = s;
    }
  }
  return best;
}

function scorePriority(u: Unit): number {
  let s = killValue(u);
  if (isVulnerable(u)) s *= VULNERABLE_MULTIPLIER;
  return s;
}

function samePosition(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y && a.layer === b.layer;
}

// Higher score is better; longer distance is worse; lex-id stable
// tiebreak. (The orientation differs from compareScored — this returns
// >0 when a is better, so callers use `compareMoves(candidate, best) > 0`.)
// A null `b` means "no incumbent yet" — `a` always wins.
function compareMoves(a: MoveScore, b: MoveScore | null): number {
  if (b === null) return 1;
  if (a.bestOffensiveScore !== b.bestOffensiveScore) {
    return a.bestOffensiveScore - b.bestOffensiveScore;
  }
  if (a.distanceToPriority !== b.distanceToPriority) {
    // Lower distance is better — invert.
    return b.distanceToPriority - a.distanceToPriority;
  }
  // S59 safety tiebreak: among equal-offence, equal-distance tiles, prefer
  // the one that exposes the actor to less incoming damage. Below distance
  // so advancing is never sacrificed for safety.
  if (a.incomingDanger !== b.incomingDanger) return b.incomingDanger - a.incomingDanger;
  return a.key < b.key ? 1 : a.key > b.key ? -1 : 0;
}

// S56 — height-seeker approach comparator. Used only when the actor
// benefits from elevation and has a projectable shot (see `pickBestMove`).
//
// An actually-reachable shot still dominates (a destination that puts an
// enemy in offensive range beats any amount of positioning — no passivity
// regression). Below that, destinations compete on a blended rank:
//
//   rank = positionalValue − distanceCost × distanceToPriority
//
// `positionalValue` is the height-sensitive future shot from the tile;
// `distanceCost` (= APPROACH_DISTANCE_FRACTION × baseShot) prices each
// tile of detour as a fraction of the unit's own shot. So the unit still
// advances on flat ground (positionalValue is constant there → distance
// decides), but will step a few tiles aside onto a perch when the height
// premium outweighs the detour. The fraction is the temperament dial:
// raise it to climb less (favour tempo), lower it to climb more.
function compareMovesPositional(
  a: MoveScore,
  b: MoveScore | null,
  distanceCost: number,
): number {
  if (b === null) return 1;
  if (a.bestOffensiveScore !== b.bestOffensiveScore) {
    return a.bestOffensiveScore - b.bestOffensiveScore;
  }
  const rankA = a.positionalValue - distanceCost * a.distanceToPriority;
  const rankB = b.positionalValue - distanceCost * b.distanceToPriority;
  if (rankA !== rankB) return rankA - rankB;
  // S59 safety tiebreak (below the positional rank — see compareMoves).
  if (a.incomingDanger !== b.incomingDanger) return b.incomingDanger - a.incomingDanger;
  return a.key < b.key ? 1 : a.key > b.key ? -1 : 0;
}

// The temperament dial for the height-seeker approach term: each tile of
// detour toward a perch must buy at least this fraction of the unit's
// base shot in extra projected (height-boosted) damage to be worth it.
// Conservative by default to guard against the over-climbing / tempo-loss
// watch-for; tune against live play. See `compareMovesPositional`.
const APPROACH_DISTANCE_FRACTION = 0.25;

// Best offensive score reachable from `from`. Mirrors pickBestOffensive
// but doesn't construct ProposedActions — just returns the max score.
// Score 0 means "no enemy in offensive reach" (fall-through to the
// distance tiebreak).
function bestOffensiveScoreFrom(
  state: GameState,
  catalog: Catalog,
  actor: Unit,
  from: Position,
  enemies: ReadonlyArray<Unit>,
  allies: ReadonlyArray<Unit>,
  offensive: ReadonlyArray<ActiveAbilityDefinition>,
): number {
  let best = 0;
  for (const ability of offensive) {
    if (ability.effects.aoe !== undefined) {
      if (ability.targeting.kind === 'tile') {
        const tiles = tilesInAbilityRange(state, actor, from, ability, catalog);
        for (const tile of tiles) {
          const anchor: Position = { x: tile.x, y: tile.y, layer: tile.layer };
          const score = scoreAoeOffensive(state, catalog, actor, from, anchor, ability, enemies, allies);
          if (score > best) best = score;
        }
      } else if (targetsUnit(ability.targeting.kind)) {
        for (const enemy of enemies) {
          const score = scoreAoeOffensive(state, catalog, actor, from, enemy.position, ability, enemies, allies);
          if (score > best) best = score;
        }
      }
    } else if (targetsUnit(ability.targeting.kind)) {
      for (const enemy of enemies) {
        const score = scoreSingleUnitOffensive(state, catalog, actor, from, enemy, ability);
        if (score > best) best = score;
      }
    }
  }
  return best;
}

// Re-export so consumers using `positionKey` for stable orderings don't
// need a second import.
export { positionKey };

// Test-only helpers for confirming the score/util model. Not part of
// the public API — exported under an unstable prefix so consumers that
// rely on them know they may move/break in 20b's stat-aware revision.
export const _basicAiInternals = {
  killValue,
  isVulnerable,
  selfDamageWouldKO,
  reactionPenalty,
  scoreSingleUnitOffensive,
  scoreAoeOffensive,
  scoreAllyBuff,
  scoreWorldcraftFall,
  fallValueForOccupant,
  expectedKnockbackFallValue,
  computeMaxMp,
  mpScarcity,
  mpSpendPenalty,
  bestThrowCandidate,
  targetIsInAbilityRange,
  tilesInAbilityRange,
  residualDangerForPlan,
  planKoTargetId,
  bestRevertTrapCandidate,
  scoreRevertDrop,
};

// Type re-exports needed by the test internals.
export type { StatusInstance };
