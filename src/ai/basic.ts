// Basic AI — heuristic decision-making for non-player units.
//
// Tier 1.5 (session 20a) refines the v1 heuristic on four axes:
//
//   - Status-aware target selection. A Vulnerable target is worth ~1.5×
//     the kill-value of an unmarked one; the Vulnerable bonus carries
//     into both the attack phase and the move phase's threat scoring.
//     Pre-tier-1.5, the AI would mark and not exploit (or attack a
//     non-Vulnerable target while a Vulnerable one stood next to it).
//
//   - Reaction-aware planning. A target's equipped reaction passives
//     deduct from its kill-value (the AI prefers attacking the target
//     less likely to bite back). The penalty is Brave-gated — at
//     Brave 100 a Counter is ~deterministic; at Brave 50 the penalty
//     halves. The penalty is *tag-agnostic* in tier 1.5 — Counter's
//     `'physical'` filter would correctly NOT trigger against a magical
//     attack, but tier 1.5 doesn't decompose the reaction's source
//     fields. Tier 2 (in 20b) gets stat-aware projection that runs the
//     reaction compiler's filter directly.
//
//   - AoE handling. AoE abilities score by total cluster value: sum of
//     per-target kill-values for enemies in the cluster minus the
//     friendly-fire deduction for allies caught in it. The dispatcher
//     handles the per-target seed branching (per ADR-0025); the AI's
//     job is to anchor the AoE on the tile that maximizes net cluster
//     value. Today this covers tile-targeted AoEs (Chain Lightning,
//     Earth Quake, Fire Storm) and unit-targeted AoEs (Tidal Wave) by
//     enumerating in-range tiles and scoring each anchor. Self-anchored
//     AoEs (Maelstrom cone, Flame Lance line) require direction
//     planning and ship in 20b.
//
//   - Lightning-specific awareness. (a) Storm Caller's 25% maxHpBase
//     self-cost is refused when the cast would self-KO. (b) Magnetic
//     Mark is preferred over a damage spell when the target isn't yet
//     Vulnerable AND the actor has a damage follow-up — this encodes
//     the kit's setup→exploit pattern without multi-turn planning.
//     (c) Static Embrace targets the ally with the highest projected
//     damage potential (high MA + has offensive abilities).
//
// Pure function (same `(state, catalog)` always yields the same
// decision); no I/O, no RNG. The orchestrator commits the decision and
// re-asks; "Move then Attack" is two calls, not a planned sequence.
//
// Phases (in priority order — first phase that produces a winning
// candidate wins):
//   0. Heal — wounded ally in range. Priority over Action because
//      saving an ally has binary value.
//   1. Action — unified pool of damage, debuff, AoE, and buff. All
//      actions score on the same scale; the highest-scoring action
//      wins. Buffs (Static Embrace) compete with offense (Lightning
//      Strike) — buffs win only when offensive options are weak (no
//      enemies in range) or the buff multiplier is dramatic.
//   2. Move — toward the best Action opportunity.
//
// What's still deferred to 20b:
//   - Stat-aware damage projection (real PA × WP × power_coefficient
//     × variance midpoint × resistance × Faith × Vulnerable × crit
//     expectation, not the stripped-down ability-score proxy).
//   - Two-action turn planning (consider Move + Act jointly, not
//     independent evaluation).
//   - Reaction tag-filter inspection (decompose ReactionAbilityFields
//     to know whether Counter would trigger against a magical attack).
//   - Move-to-heal / move-to-buff (closing distance to a wounded /
//     buffable ally).
//   - Self-anchored AoE direction planning (Maelstrom, Flame Lance).

import {
  endpointFrom,
  getLegalMoves,
  horizontalDistance,
  inRange,
  positionKey,
  tileAt,
  validateAction,
  aoeFootprint,
  type Catalog,
  type GameState,
  type Position,
  type ProposedAction,
  type Tile,
  type Unit,
  type ActiveAbilityDefinition,
  type AbilityId,
  type AbilityTarget,
  type AoeSpec,
  type StatusInstance,
  type StatusTypeId,
} from '@engine/index.ts';
import { statusTypeId } from '@engine/index.ts';

// AI's answer for a single decision step. Mirrors the orchestrator's
// `ControllerDecision` minus the `pending` case — the AI always has an
// answer. Defined locally instead of imported from the orchestrator so
// that `src/ai/` stays in the engine-only dependency tier (per
// docs/architecture/architecture-overview.md).
export type BasicAiDecision =
  | { readonly kind: 'commit'; readonly action: ProposedAction }
  | { readonly kind: 'end-turn' };

const END_TURN: BasicAiDecision = { kind: 'end-turn' };

// Heal threshold: an ally is "wounded enough to justify a heal" when
// their hp / maxHpBase ratio is at or below this fraction. 0.5 means
// "half health or less."
const HEAL_THRESHOLD = 0.5;

// Reaction-penalty constants (tier 1.5). The AI deducts proportional
// to how likely each reaction is to fire and how much it would cost.
// Coarse — tier 1.5 doesn't decompose reaction effects, just counts
// equipped reactions. The constant is tuned so a single Brave-100
// reaction reduces target appeal by ~15% (a real but not dominant
// signal); two stacked reactions cap at ~30%.
const REACTION_PENALTY_PER_STACK = 0.15;
const REACTION_PENALTY_CAP = 0.4;

// Vulnerable amplifies next damage by ×1.5 (per ADR-0032). Mirrored on
// the AI side so target evaluation favors Vulnerable targets.
const VULNERABLE_DAMAGE_MULTIPLIER = 1.5;
const VULNERABLE_TYPE_ID: StatusTypeId = statusTypeId('vulnerable');

// Hardcoded list of v1 status types whose application benefits the
// recipient. Used to gate the buff phase so it doesn't try to apply a
// debuff to an ally (e.g., picking Magnetic Mark on self because the
// targeting filter alone can't tell Mark from Static Embrace).
//
// LIMITATION: this is a content-side concern leaking into the AI. A
// future refinement (20b or beyond) should add an explicit polarity
// hint to StatusEffectType (`{ aiHints?: { polarity?: 'buff' |
// 'debuff' } }`) so the AI reads polarity from content. Until then,
// new buff statuses must be added here when they ship.
const KNOWN_BUFF_STATUS_IDS: ReadonlySet<StatusTypeId> = new Set([
  statusTypeId('crit_modifier'),
  statusTypeId('pa_up'),
  statusTypeId('ma_up'),
  statusTypeId('movement_self_buff'),
  statusTypeId('haste'),
  statusTypeId('regen'),
]);

// Friendly-fire deduction in AoE scoring. An ally caught in the AoE
// counts negatively against the cluster value. Tuned to ~1.0 (one ally
// hit cancels one enemy hit). If a future kit wants the AI to avoid
// friendly fire more strongly, raise this.
const FRIENDLY_FIRE_PENALTY_FACTOR = 1.0;

// Setup→exploit weight for Magnetic Mark. The AI scores Mark on a
// non-Vulnerable target proportional to the target's HP — high-HP
// targets benefit more from being marked (more room for Vulnerable's
// ×1.5 bonus to apply to a future hit). Tuned so a fresh full-HP
// target's mark score (15) edges out a Lightning Strike's chip
// damage (12), but a low-HP target's mark score (~2) loses to a
// Strike kill-shot (~90). Storm Caller's mark score is dampened by
// the SELF_COST_DAMPING_FACTOR below.
const MARK_SETUP_WEIGHT = 15;

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

  const offensive = enumerateOffensiveAbilities(actor, catalog);
  const healing = enumerateHealingAbilities(actor, catalog);
  const allyBuffs = enumerateAllyBuffAbilities(actor, catalog);

  // Phase 0: heal if an ally is wounded and in range.
  if (state.turnState.budget.actsAvailable > 0 && healing.length > 0) {
    const heal = pickBestHeal(state, catalog, actor, allies, healing);
    if (heal !== null) return { kind: 'commit', action: heal };
  }

  // Phase 1: unified action pool — damage, debuff, AoE, and buff
  // compete on the same scoring scale. The highest-scoring valid
  // action wins.
  if (state.turnState.budget.actsAvailable > 0 && (offensive.length > 0 || allyBuffs.length > 0)) {
    const action = pickBestAction(state, catalog, actor, enemies, allies, offensive, allyBuffs);
    if (action !== null) return { kind: 'commit', action };
  }

  // Phase 2: move toward an offensive opportunity. Skipped when no
  // enemies remain — there's nowhere meaningful to advance.
  if (state.turnState.budget.movesAvailable > 0 && enemies.length > 0) {
    const move = pickBestMove(state, catalog, actor, enemies, allies, offensive);
    if (move !== null) return { kind: 'commit', action: move };
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
// Ability enumeration
// =====================

// Walk the actor's loadout and resolve every active member of every
// equipped command set, returning unique active abilities. Other
// enumerators filter the result.
function enumerateActiveAbilities(
  actor: Unit,
  catalog: Catalog,
): ActiveAbilityDefinition[] {
  const seen = new Set<AbilityId>();
  const out: ActiveAbilityDefinition[] = [];
  for (const commandSetId of Object.values(actor.loadout.actionBuckets)) {
    if (commandSetId === null) continue;
    if (!catalog.hasCommandSet(commandSetId)) continue;
    const cs = catalog.getCommandSet(commandSetId);
    for (const memberId of cs.members) {
      if (seen.has(memberId)) continue;
      seen.add(memberId);
      if (!catalog.hasAbility(memberId)) continue;
      const ability = catalog.getAbility(memberId);
      if (ability.kind !== 'active') continue;
      out.push(ability);
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
// Excludes healing-tagged abilities (those flow through pickBestHeal).
function enumerateOffensiveAbilities(
  actor: Unit,
  catalog: Catalog,
): ActiveAbilityDefinition[] {
  return enumerateActiveAbilities(actor, catalog).filter(isOffensive);
}

function isOffensive(ability: ActiveAbilityDefinition): boolean {
  // Self-anchored AoE (Maelstrom, Flame Lance) — defer to 20b.
  if (ability.targeting.kind === 'self') return false;

  const damage = ability.effects.damage;
  if (damage !== undefined) {
    // Healing flows through the heal phase, not offensive.
    if (damage.tags.includes('healing')) return false;
    return true;
  }

  // No damage — offensive only if it applies a debuff to an enemy.
  // Magnetic Mark hits this branch (single_unit Vulnerable applier).
  // Earth Curse / Earth Cataclysm (cross-r1 AoE debuff applier) hit
  // this branch when targeting === 'tile'. Static Embrace (Crit_modifier
  // on ally) is excluded — its statuses are all buffs, so it has no
  // value when cast on an enemy.
  const statusEffects = ability.effects.statusEffects;
  if (statusEffects === undefined || statusEffects.length === 0) return false;
  const hasDebuff = statusEffects.some((s) => !KNOWN_BUFF_STATUS_IDS.has(s.typeId));
  if (!hasDebuff) return false;
  return ability.targeting.kind === 'single_unit' || ability.targeting.kind === 'tile';
}

// Healing abilities — single_unit, has a 'healing'-tagged damage spec.
// (Cure, future Raise, etc.)
function enumerateHealingAbilities(
  actor: Unit,
  catalog: Catalog,
): ActiveAbilityDefinition[] {
  return enumerateActiveAbilities(actor, catalog).filter(isHealingSingleUnit);
}

function isHealingSingleUnit(ability: ActiveAbilityDefinition): boolean {
  if (ability.targeting.kind !== 'single_unit') return false;
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
  actor: Unit,
  catalog: Catalog,
): ActiveAbilityDefinition[] {
  return enumerateActiveAbilities(actor, catalog).filter(isAllyBuff);
}

function isAllyBuff(ability: ActiveAbilityDefinition): boolean {
  if (ability.targeting.kind !== 'single_unit') return false;
  // Has damage → it's offensive or healing, not a pure buff.
  if (ability.effects.damage !== undefined) return false;
  const statusEffects = ability.effects.statusEffects;
  if (statusEffects === undefined || statusEffects.length === 0) return false;
  // Must apply at least one *known buff* status (per the polarity
  // limitation noted on KNOWN_BUFF_STATUS_IDS). Magnetic Mark is
  // excluded here — it applies Vulnerable, which isn't on the buff
  // list, so the buff phase doesn't propose Mark on self.
  return statusEffects.some((s) => KNOWN_BUFF_STATUS_IDS.has(s.typeId));
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

// Coarse penalty in [0, REACTION_PENALTY_CAP] proportional to the
// target's equipped reactions and Brave. Tier 1.5 doesn't decompose
// the reaction's tag filter — Counter's physical-only gate is treated
// the same as Discharge's any-tag gate. Tier 2 (in 20b) refines this
// by inspecting `ReactionAbilityFields` per equipped reaction.
function reactionPenalty(target: Unit, catalog: Catalog): number {
  let count = 0;
  for (const bucketAbilities of Object.values(target.loadout.passiveBuckets)) {
    if (bucketAbilities === undefined) continue;
    for (const aid of bucketAbilities) {
      if (!catalog.hasAbility(aid)) continue;
      const a = catalog.getAbility(aid);
      if (a.kind !== 'passive') continue;
      // The `bucket` brand is `BucketId & { __brand }`, but its raw
      // string value is one of 'first_action' | 'reaction' | 'support'
      // | 'movement' (per BUCKET_IDS). String comparison is the
      // pragmatic shape — Support / Movement passives don't react on
      // attack and shouldn't count.
      if (String(a.bucket) === 'reaction') count += 1;
    }
  }
  if (count === 0) return 0;
  const braveFactor = Math.max(0, Math.min(1, target.baseStats.brave / 100));
  return Math.min(REACTION_PENALTY_CAP, count * REACTION_PENALTY_PER_STACK * braveFactor);
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

// =====================
// Targeting helpers
// =====================

// Pure range check. Used for both single_unit and tile targeting via
// a uniform Position-to-Position check.
function positionInAbilityRange(
  state: GameState,
  source: Position,
  target: Position,
  ability: ActiveAbilityDefinition,
  catalog: Catalog,
): boolean {
  const sourceTile = tileAt(state.map, source.x, source.y, source.layer);
  const targetTile = tileAt(state.map, target.x, target.y, target.layer);
  if (sourceTile === undefined || targetTile === undefined) return false;
  const ruleset = catalog.getRuleset(state.ruleset.id);
  return inRange({
    source: endpointFrom(source, sourceTile.elevation),
    target: endpointFrom(target, targetTile.elevation),
    params: {
      horizontalMax: ability.targeting.range.horizontal,
      horizontalMin: ability.targeting.range.minHorizontal ?? ruleset.rangeDefaults.minHorizontal,
      verticalMax: ability.targeting.range.vertical,
    },
  });
}

function targetIsInAbilityRange(
  state: GameState,
  source: Position,
  target: Unit,
  ability: ActiveAbilityDefinition,
  catalog: Catalog,
): boolean {
  return positionInAbilityRange(state, source, target.position, ability, catalog);
}

// Enumerate every reachable tile within an ability's range from the
// given source position. Used by AoE scoring to find candidate
// anchors. Bounded by the ability's `horizontal` range — for a
// horizontal=4 ability, scans a 9×9 window around the source.
function tilesInAbilityRange(
  state: GameState,
  source: Position,
  ability: ActiveAbilityDefinition,
  catalog: Catalog,
): Tile[] {
  const out: Tile[] = [];
  const range = ability.targeting.range.horizontal;
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
      if (!positionInAbilityRange(state, source, candidatePos, ability, catalog)) continue;
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
// preferred. Composes Vulnerable, reaction penalty, ability score,
// kill-value.
function scoreSingleUnitOffensive(
  state: GameState,
  catalog: Catalog,
  actor: Unit,
  source: Position,
  target: Unit,
  ability: ActiveAbilityDefinition,
): number {
  if (selfDamageWouldKO(actor, ability)) return Number.NEGATIVE_INFINITY;
  if (!targetIsInAbilityRange(state, source, target, ability, catalog)) {
    return Number.NEGATIVE_INFINITY;
  }

  const damage = ability.effects.damage;
  if (damage !== undefined) {
    // Damage path (Lightning Strike, Storm Caller, attack, ...).
    const power = damage.power_coefficient ?? 1;
    let score = killValue(target) * power;
    if (isVulnerable(target)) score *= VULNERABLE_DAMAGE_MULTIPLIER;
    score *= 1 - reactionPenalty(target, catalog);
    if (ability.selfDamage !== undefined && ability.selfDamage.fraction > 0) {
      score *= SELF_COST_DAMPING_FACTOR;
    }
    return score;
  }

  // No damage — debuff applier (Magnetic Mark). Setup→exploit weight:
  // already-Vulnerable targets gain little from another mark; high-HP
  // targets benefit most because there's room for the next damage hit
  // to amplify by ×1.5.
  if (ability.effects.statusEffects !== undefined) {
    if (isVulnerable(target)) return 0; // already marked
    const followUpExists = actorHasDamageFollowUp(actor, catalog);
    if (!followUpExists) return 0;
    // Score proportional to target's HP ratio. A full-HP target gets
    // the full mark weight; a near-dead target's score collapses
    // (kill it directly with a damage spell). The kill-value
    // multiplier is intentionally omitted here — at low HP, killValue
    // is huge (1/hpRatio diverges) and would make Mark dominant on
    // exactly the targets where it shouldn't be picked.
    const maxHp = Math.max(1, target.baseStats.maxHpBase);
    const hpRatio = Math.max(0, Math.min(1, target.vitals.hp / maxHp));
    return MARK_SETUP_WEIGHT * hpRatio;
  }
  return 0;
}

// Whether the actor has any damage-dealing offensive ability — used
// to gate the Magnetic Mark setup→exploit bonus. Without a follow-up,
// marking is wasted.
function actorHasDamageFollowUp(actor: Unit, catalog: Catalog): boolean {
  const offensives = enumerateOffensiveAbilities(actor, catalog);
  for (const a of offensives) {
    if (a.effects.damage !== undefined && !a.effects.damage.tags.includes('healing')) {
      return true;
    }
  }
  return false;
}

// Score for an AoE ability anchored at `anchor`. Sums per-target
// scores for enemies in the cluster and subtracts a per-ally penalty
// for friendly fire. The chainBonus contribution is folded in via
// `effectivePowerForCluster` so a full Chain Lightning cluster scores
// proportional to its actual scaled power.
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
  if (!positionInAbilityRange(state, source, anchor, ability, catalog)) {
    return Number.NEGATIVE_INFINITY;
  }
  const aoe = ability.effects.aoe;
  if (aoe === undefined) return Number.NEGATIVE_INFINITY;

  const tiles = aoeTilesAffected(state, catalog, source, anchor, ability, aoe);
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

  const damage = ability.effects.damage;
  // For damage-bearing AoEs, fold chainBonus into the effective power
  // applied uniformly across the cluster (per ADR-0032).
  const targetCount = enemiesInCluster.length + alliesInCluster.length;
  const effectivePower = damage !== undefined
    ? effectivePowerForCluster(damage.power_coefficient ?? 1, damage.chainBonus, targetCount)
    : 1;

  let total = 0;
  for (const enemy of enemiesInCluster) {
    let perTarget = killValue(enemy) * effectivePower;
    if (isVulnerable(enemy)) perTarget *= VULNERABLE_DAMAGE_MULTIPLIER;
    perTarget *= 1 - reactionPenalty(enemy, catalog);
    total += perTarget;
  }
  for (const ally of alliesInCluster) {
    // Friendly fire: subtract a fraction of the ally's kill-value.
    // Using the same kill-value shape so allies-near-death contribute
    // a larger penalty than full-HP allies.
    total -= FRIENDLY_FIRE_PENALTY_FACTOR * killValue(ally) * effectivePower;
  }
  return total;
}

// Mirrors the engine's effectivePowerCoefficient helper (per ADR-0032)
// for AI-side damage projection. Kept local to avoid pulling the
// internal helper across the engine/AI boundary.
function effectivePowerForCluster(
  basePower: number,
  chainBonus: { readonly powerPerAdditionalTarget: number } | undefined,
  targetCount: number,
): number {
  if (chainBonus === undefined) return basePower;
  return basePower + chainBonus.powerPerAdditionalTarget * Math.max(0, targetCount - 1);
}

// Resolve the tiles affected by an AoE for AI scoring. Mirrors what
// the dispatcher would compute at cast time: anchor + shape + vertical
// tolerance. Cone / line require a direction (caster-anchored only,
// 20b territory) — we return an empty footprint here so callers fall
// through to other ability options.
function aoeTilesAffected(
  state: GameState,
  catalog: Catalog,
  source: Position,
  anchor: Position,
  ability: ActiveAbilityDefinition,
  aoe: AoeSpec,
): ReadonlyArray<Tile> {
  // Cone / line require direction planning — out of tier 1.5 scope.
  if (aoe.shape.kind === 'cone' || aoe.shape.kind === 'line') return [];
  const ruleset = catalog.getRuleset(state.ruleset.id);
  // AoeAnchor carries `elevation`, not `layer` — without it the
  // verticalTolerance filter compares undefined and rejects every
  // tile.
  const anchorTile = tileAt(state.map, anchor.x, anchor.y, anchor.layer);
  if (anchorTile === undefined) return [];
  return aoeFootprint({
    map: state.map,
    shape: aoe.shape,
    anchor: { x: anchor.x, y: anchor.y, elevation: anchorTile.elevation },
    verticalTolerance: aoe.verticalTolerance ?? ruleset.rangeDefaults.aoeVerticalTolerance,
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
  if (!targetIsInAbilityRange(state, source, target, ability, catalog)) {
    return Number.NEGATIVE_INFINITY;
  }
  // The buff's effect is applying status_effects; we don't know which
  // status without name-matching, but we can use the actor-side intent
  // (declared by ability.effects.statusEffects) as a proxy. For tier
  // 1.5, score by ally's projected damage output: high MA + has
  // offensive abilities = high value to buff.
  const offensives = enumerateOffensiveAbilities(target, catalog);
  if (offensives.length === 0) return 0;
  // Damage potential = MA × number of offensive abilities. A Mage
  // with MA 9 and 5 offensive spells scores 45; a Knight with MA 4
  // and 1 attack scores 4. The dampening factor scales this into the
  // same range as direct-damage scores so buffs don't always dominate.
  return target.baseStats.ma * offensives.length * BUFF_SCORE_DAMPING_FACTOR;
}

// =====================
// Phase orchestrators
// =====================

// Pick the best heal action this turn (existing logic — simplified
// for tier 1.5: score-based to allow extension later).
function pickBestHeal(
  state: GameState,
  catalog: Catalog,
  actor: Unit,
  allies: ReadonlyArray<Unit>,
  healing: ReadonlyArray<ActiveAbilityDefinition>,
): ProposedAction | null {
  const wounded = allies.filter((u) => woundedRatio(u) <= HEAL_THRESHOLD);
  if (wounded.length === 0) return null;

  const sortedTargets = [...wounded].sort(compareWounded);

  for (const target of sortedTargets) {
    const sortedAbilities = [...healing].sort((a, b) => abilityScore(b) - abilityScore(a));
    for (const ability of sortedAbilities) {
      if (!targetIsInAbilityRange(state, actor.position, target, ability, catalog)) continue;
      const proposed: ProposedAction = {
        type: 'use_ability',
        source: 'player',
        actorId: actor.id,
        payload: {
          abilityId: ability.id,
          target: { kind: 'unit', unitId: target.id },
        },
      };
      if (validateAction(state, proposed, catalog).valid) return proposed;
    }
  }
  return null;
}

// Pick the best action this turn — unified pool of offensive (damage,
// debuff, AoE) and buff candidates. Each candidate produces a score on
// the same scale; the highest-scoring valid candidate wins.
function pickBestAction(
  state: GameState,
  catalog: Catalog,
  actor: Unit,
  enemies: ReadonlyArray<Unit>,
  allies: ReadonlyArray<Unit>,
  offensive: ReadonlyArray<ActiveAbilityDefinition>,
  buffs: ReadonlyArray<ActiveAbilityDefinition>,
): ProposedAction | null {
  let best: { score: number; action: ProposedAction; key: string } | null = null;

  // Buff branch — ally-targeting status appliers. Score against each
  // ally; pick the highest. Self-buff is allowed (the actor counts as
  // their own ally) — a Lightning Mage self-buffing with Static
  // Embrace before a Storm Caller is the natural use case.
  for (const ability of buffs) {
    for (const ally of allies) {
      const score = scoreAllyBuff(state, catalog, actor, actor.position, ally, ability);
      if (score <= 0) continue;
      const proposed: ProposedAction = {
        type: 'use_ability',
        source: 'player',
        actorId: actor.id,
        payload: {
          abilityId: ability.id,
          target: { kind: 'unit', unitId: ally.id },
        },
      };
      if (!validateAction(state, proposed, catalog).valid) continue;
      const key = `${ability.id}|buff|${ally.id}`;
      const candidate = { score, action: proposed, key };
      if (best === null || compareScored(candidate, best) > 0) best = candidate;
    }
  }

  // Offensive branch — single-unit damage, single-unit debuff
  // (Magnetic Mark), and AoE.
  for (const ability of offensive) {
    if (ability.effects.aoe !== undefined) {
      // AoE: enumerate candidate anchor tiles and score each.
      // For tile-targeted AoEs, anchors are arbitrary tiles in range.
      // For unit-targeted AoEs, anchor is the chosen unit's tile.
      if (ability.targeting.kind === 'tile') {
        const tiles = tilesInAbilityRange(state, actor.position, ability, catalog);
        for (const tile of tiles) {
          const anchor: Position = { x: tile.x, y: tile.y, layer: tile.layer };
          const score = scoreAoeOffensive(
            state, catalog, actor, actor.position, anchor, ability, enemies, allies,
          );
          if (score <= 0) continue;
          const proposed: ProposedAction = {
            type: 'use_ability',
            source: 'player',
            actorId: actor.id,
            payload: {
              abilityId: ability.id,
              target: { kind: 'tile', position: anchor } as AbilityTarget,
            },
          };
          if (!validateAction(state, proposed, catalog).valid) continue;
          const key = `${ability.id}|tile|${positionKey(anchor)}`;
          const candidate = { score, action: proposed, key };
          if (best === null || compareScored(candidate, best) > 0) best = candidate;
        }
      } else if (ability.targeting.kind === 'single_unit') {
        for (const enemy of enemies) {
          const score = scoreAoeOffensive(
            state, catalog, actor, actor.position, enemy.position, ability, enemies, allies,
          );
          if (score <= 0) continue;
          const proposed: ProposedAction = {
            type: 'use_ability',
            source: 'player',
            actorId: actor.id,
            payload: {
              abilityId: ability.id,
              target: { kind: 'unit', unitId: enemy.id },
            },
          };
          if (!validateAction(state, proposed, catalog).valid) continue;
          const key = `${ability.id}|unit|${enemy.id}`;
          const candidate = { score, action: proposed, key };
          if (best === null || compareScored(candidate, best) > 0) best = candidate;
        }
      }
    } else if (ability.targeting.kind === 'single_unit') {
      // Single-unit, no AoE — damage or debuff.
      for (const enemy of enemies) {
        const score = scoreSingleUnitOffensive(
          state, catalog, actor, actor.position, enemy, ability,
        );
        if (score <= 0) continue;
        const proposed: ProposedAction = {
          type: 'use_ability',
          source: 'player',
          actorId: actor.id,
          payload: {
            abilityId: ability.id,
            target: { kind: 'unit', unitId: enemy.id },
          },
        };
        if (!validateAction(state, proposed, catalog).valid) continue;
        const key = `${ability.id}|unit|${enemy.id}`;
        const candidate = { score, action: proposed, key };
        if (best === null || compareScored(candidate, best) > 0) best = candidate;
      }
    }
    // Tile-targeted, no AoE (Bolt) — not in any v1 class loadout.
    // Self-anchored AoEs (cone, line) — out of tier 1.5 scope.
  }
  return best?.action ?? null;
}

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

// Approximation of "how wounded is this unit?" — current HP divided by
// `baseStats.maxHpBase`.
function woundedRatio(u: Unit): number {
  if (u.baseStats.maxHpBase <= 0) return 1;
  return u.vitals.hp / u.baseStats.maxHpBase;
}

// Most-wounded first, then lex-id for stable tiebreaks.
function compareWounded(a: Unit, b: Unit): number {
  const ra = woundedRatio(a);
  const rb = woundedRatio(b);
  if (ra !== rb) return ra - rb;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

// Score an ability for the heal phase — power coefficient as a
// stand-in. Used only by pickBestHeal for ordering among healers.
function abilityScore(ability: ActiveAbilityDefinition): number {
  return ability.effects.damage?.power_coefficient ?? 1;
}

interface MoveScore {
  readonly destination: Position;
  // Best offensive score reachable from this destination, or 0 if no
  // viable offensive option (no enemy in range from here).
  readonly bestOffensiveScore: number;
  // Distance (horizontal) to the best-kill-value enemy. Tiebreak when
  // no destination puts anyone in offensive range.
  readonly distanceToPriority: number;
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
): ProposedAction | null {
  const moves = getLegalMoves(state, actor.id, catalog);
  // Priority target: highest kill-value (with Vulnerable bonus).
  // When no enemy yields a meaningful score, fall back to lowest-HP.
  const priorityTarget = pickPriorityTarget(enemies, catalog);

  let best: MoveScore | null = null;

  for (const [key, path] of moves.reachable) {
    const dest = path.destination;
    if (samePosition(dest, actor.position)) continue;

    const bestOffensiveScore = bestOffensiveScoreFrom(
      state, catalog, actor, dest, enemies, allies, offensive,
    );
    const distanceToPriority = horizontalDistance(dest, priorityTarget.position);
    const candidate: MoveScore = {
      destination: dest,
      bestOffensiveScore,
      distanceToPriority,
      key,
    };

    if (best === null || compareMoves(candidate, best) > 0) {
      best = candidate;
    }
  }

  if (best === null) return null;

  const proposed: ProposedAction = {
    type: 'move',
    source: 'player',
    actorId: actor.id,
    payload: { destination: best.destination },
  };
  if (!validateAction(state, proposed, catalog).valid) return null;
  return proposed;
}

// Pick the priority enemy for move-distance tiebreak. Highest kill-
// value × Vulnerable bonus. Among equals, lex-id.
function pickPriorityTarget(
  enemies: ReadonlyArray<Unit>,
  catalog: Catalog,
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
  if (isVulnerable(u)) s *= VULNERABLE_DAMAGE_MULTIPLIER;
  return s;
}

function samePosition(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y && a.layer === b.layer;
}

// Higher score is better; longer distance is worse; lex-id stable
// tiebreak. (The orientation differs from compareScored — this returns
// >0 when a is better, so callers use `compareMoves(candidate, best) > 0`.)
function compareMoves(a: MoveScore, b: MoveScore): number {
  if (a.bestOffensiveScore !== b.bestOffensiveScore) {
    return a.bestOffensiveScore - b.bestOffensiveScore;
  }
  if (a.distanceToPriority !== b.distanceToPriority) {
    // Lower distance is better — invert.
    return b.distanceToPriority - a.distanceToPriority;
  }
  return a.key < b.key ? 1 : a.key > b.key ? -1 : 0;
}

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
        const tiles = tilesInAbilityRange(state, from, ability, catalog);
        for (const tile of tiles) {
          const anchor: Position = { x: tile.x, y: tile.y, layer: tile.layer };
          const score = scoreAoeOffensive(state, catalog, actor, from, anchor, ability, enemies, allies);
          if (score > best) best = score;
        }
      } else if (ability.targeting.kind === 'single_unit') {
        for (const enemy of enemies) {
          const score = scoreAoeOffensive(state, catalog, actor, from, enemy.position, ability, enemies, allies);
          if (score > best) best = score;
        }
      }
    } else if (ability.targeting.kind === 'single_unit') {
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
};

// Type re-exports needed by the test internals.
export type { StatusInstance };
