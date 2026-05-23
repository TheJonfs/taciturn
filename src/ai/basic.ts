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
  positionKey,
  runModifyAoeShape,
  runModifyAoeVerticalTolerance,
  tileAt,
  aoeFootprint,
  cardinalFromTo,
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
  statusTypeId,
} from '@engine/index.ts';
import { projectExpectedDamage } from './projection.ts';

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

  // Session 39b — Phase 0a: Alchemist's Compound + Throw Item. Runs
  // before Cure-style heals because Phoenix Down revival is binary-
  // value (lost unit comes back) and Potion stockpile heals are an
  // efficient use of an Act on a wounded ally without paying MP at
  // the throw site. Falls through to standard phases if the actor
  // isn't an Alchemist (no `alchemy` command set / Compound + Throw
  // Item available).
  if (state.turnState.budget.actsAvailable > 0 && isAlchemistActor(actor, catalog)) {
    const alch = pickAlchemistAction(state, catalog, actor, allies);
    if (alch !== null) return { kind: 'commit', action: alch };
  }

  // Phase 0: heal if an ally is wounded and in range.
  if (state.turnState.budget.actsAvailable > 0 && healing.length > 0) {
    const heal = pickBestHeal(state, catalog, actor, allies, healing);
    if (heal !== null) return { kind: 'commit', action: heal };
  }

  // Phase 1: joint two-action plan — enumerate (destination, ability,
  // target) triples across the actor's reachable destinations. The
  // highest-scoring plan wins; if it's "act in place" we commit the
  // Act, else we commit the Move and the next call commits the Act
  // from the new position (per ADR-00X4 / session-20b two-action
  // planning). Skipped when neither offensives nor buffs are available.
  if (offensive.length > 0 || allyBuffs.length > 0) {
    const action = pickJointActOrMove(state, catalog, actor, enemies, allies, offensive, allyBuffs);
    if (action !== null) return { kind: 'commit', action };
  }

  // Phase 2: distance-closing move fallback — no positive-score Act
  // exists from any reachable destination (typically: enemies all
  // out of range, no buffable allies in range either). Close distance
  // to the priority enemy globally so the next turn has a real plan.
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

interface ThrowCandidate {
  readonly action: ProposedAction;
  readonly priority: number;
}

function pickAlchemistAction(
  state: GameState,
  catalog: Catalog,
  actor: Unit,
  livingAlliesList: ReadonlyArray<Unit>,
): ProposedAction | null {
  // 1) Throw priorities: Phoenix Down on KO'd ally > Potion on wounded
  //    ally > Remedy on debuffed ally > Ether on low-MP ally. Higher
  //    `priority` wins (numeric for stable tie-break).
  const candidates: ThrowCandidate[] = [];

  // Phoenix Down — KO'd ally in range. Highest priority by design.
  const havePhoenixDown = (actor.stockpile.get(PHOENIX_DOWN) ?? 0) > 0;
  if (havePhoenixDown) {
    for (const ally of koAlliesInRange(state, actor)) {
      candidates.push({
        action: throwAction(actor, PHOENIX_DOWN, ally.id),
        priority: 100,
      });
    }
  }

  // Potion — most-wounded living ally in range below the wounded
  // threshold. Score by missing HP so the lowest-HP ally is picked.
  const havePotion = (actor.stockpile.get(POTION) ?? 0) > 0;
  if (havePotion) {
    for (const ally of livingAlliesList) {
      if (!isInThrowRange(state, catalog, actor, ally)) continue;
      const maxHp = readMaxHpProxy(ally);
      const hpRatio = ally.vitals.hp / maxHp;
      if (hpRatio >= WOUNDED_HP_FRACTION) continue;
      // priority 50 + missing-HP bias so most-wounded wins ties.
      const missing = Math.max(0, maxHp - ally.vitals.hp);
      candidates.push({
        action: throwAction(actor, POTION, ally.id),
        priority: 50 + missing / Math.max(1, maxHp),
      });
    }
  }

  // Remedy — any living ally with a debuff-polarity status in range.
  const haveRemedy = (actor.stockpile.get(REMEDY) ?? 0) > 0;
  if (haveRemedy) {
    for (const ally of livingAlliesList) {
      if (!isInThrowRange(state, catalog, actor, ally)) continue;
      if (!hasDebuffStatus(ally, catalog)) continue;
      candidates.push({
        action: throwAction(actor, REMEDY, ally.id),
        priority: 30,
      });
    }
  }

  // Ether — ally with low MP in range. Heuristic: ally has < 50% MP and
  // their class baseline MP > 20 (skip Knight-style low-MP units where
  // a free Ether is overkill).
  const haveEther = (actor.stockpile.get(ETHER) ?? 0) > 0;
  if (haveEther) {
    for (const ally of livingAlliesList) {
      if (!isInThrowRange(state, catalog, actor, ally)) continue;
      if (ally.baseStats.maxMpBase <= 20) continue;
      const mpRatio = ally.vitals.mp / Math.max(1, ally.baseStats.maxMpBase);
      if (mpRatio >= 0.5) continue;
      candidates.push({
        action: throwAction(actor, ETHER, ally.id),
        priority: 20,
      });
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => b.priority - a.priority);
    const best = candidates[0]!;
    if (canCommitAction(state, catalog, actor, best.action)) {
      return best.action;
    }
  }

  // 2) Nothing urgent to throw → Compound the most-needed item. Skip
  // when the actor's MP can't afford any consumable's Compound cost.
  const compoundChoice = pickCompoundItem(state, actor, livingAlliesList, catalog);
  if (compoundChoice !== null) {
    const action: ProposedAction = {
      type: 'use_compound',
      source: 'player',
      actorId: actor.id,
      payload: { itemId: compoundChoice },
    };
    if (canCommitAction(state, catalog, actor, action)) return action;
  }
  return null;
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

function hasDebuffStatus(unit: Unit, catalog: Catalog): boolean {
  for (const inst of unit.statuses) {
    if (inst.source.kind === 'equipment') continue;
    if (!catalog.hasStatusType(inst.typeId)) continue;
    const type = catalog.getStatusType(inst.typeId);
    const polarity = type.aiHints?.polarity ?? 'debuff';
    if (polarity !== 'buff') return true;
  }
  return false;
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
// Excludes healing-tagged abilities (those flow through pickBestHeal).
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
  return inRange({
    source: endpointFrom(source, sourceTile.elevation),
    target: endpointFrom(target, targetTile.elevation),
    params: {
      horizontalMax: effective.horizontal,
      horizontalMin: effective.minHorizontal ?? ruleset.rangeDefaults.minHorizontal,
      verticalMax: effective.vertical,
    },
  });
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
  const range = computeAbilityRange(state, catalog, actor.id, ability).horizontal;
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
    return score;
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
    return marginal * killValue(target);
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
  }
  return total;
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
      if (!targetIsInAbilityRange(state, actor, actor.position, target, ability, catalog)) continue;
      const proposed: ProposedAction = {
        type: 'use_ability',
        source: 'player',
        actorId: actor.id,
        payload: {
          abilityId: ability.id,
          target: { kind: 'unit', unitId: target.id },
        },
      };
      if (canCommitAction(state, catalog, actor, proposed)) return proposed;
    }
  }
  return null;
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
// Returns:
//   - A Move ProposedAction when the best plan requires moving first.
//   - A use_ability ProposedAction when the best plan is to act in
//     place (or move budget is exhausted).
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
): ProposedAction | null {
  const turn = state.turnState;
  if (turn === null) return null;
  const canAct = turn.budget.actsAvailable > 0;
  const canMove = turn.budget.movesAvailable > 0;
  if (!canAct) return null; // no Act → joint planner has nothing to plan

  // Enumerate sources: actor.position is always a candidate (the
  // "act in place" plan); other destinations only if Move budget allows.
  type Plan = { score: number; action: ProposedAction; key: string; destination: Position };
  const plans: Plan[] = [];
  const here = bestActFromSource(state, catalog, actor, actor.position, enemies, allies, offensive, buffs);
  if (here !== null) {
    plans.push({ ...here, destination: actor.position });
  }

  if (canMove) {
    const moves = getLegalMoves(state, actor.id, catalog);
    for (const [moveKey, path] of moves.reachable) {
      const dest = path.destination;
      if (samePosition(dest, actor.position)) continue;
      const fromHere = bestActFromSource(state, catalog, actor, dest, enemies, allies, offensive, buffs);
      if (fromHere === null) continue;
      // Move-cost dampening: tiny shave per step encourages "stay put
      // when a same-score Act exists here." Without it, the AI might
      // detour for cosmetic reasons. Tuned to 0.001 — enough to break
      // ties, far too small to swing decisions.
      const moveCost = MOVE_TIE_BREAK_PENALTY * (path.cost ?? 0);
      plans.push({
        score: fromHere.score - moveCost,
        action: fromHere.action,
        key: `${moveKey}|${fromHere.key}`,
        destination: dest,
      });
    }
  }

  if (plans.length === 0) return null;

  // Pick highest score; lex-id tiebreak on the composite key.
  let best: Plan = plans[0]!;
  for (let i = 1; i < plans.length; i++) {
    const candidate = plans[i]!;
    if (compareScored(candidate, best) > 0) best = candidate;
  }

  // Act in place: validate and commit the Act now.
  if (samePosition(best.destination, actor.position)) {
    if (!canCommitAction(state, catalog, actor, best.action)) return null;
    return best.action;
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
  return moveAction;
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
};

// Type re-exports needed by the test internals.
export type { StatusInstance };
