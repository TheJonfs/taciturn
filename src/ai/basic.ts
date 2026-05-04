// Basic AI — heuristic decision-making for non-player units.
//
// MVP v1 (session 12): not a strong opponent, but smart enough to make
// the demo battle feel like a battle. The greedy placeholder controller
// (`src/app/demo/controller.ts`) walks toward the *closest* enemy; this
// upgrade walks toward the *lowest-HP* enemy and considers the full
// move radius (not just one step) when choosing where to land. Net
// effect: focuses fire to KO and exploits range better.
//
// Pure function — same `(state, catalog)` always yields the same
// decision. No I/O, no RNG. Determinism matters because the same
// orchestrator drives both teams in the integration test, and any
// nondeterminism here would mask real bugs in the engine.
//
// One decision per call. The orchestrator commits the decision and
// re-asks; "Move then Attack" is two calls, not a planned sequence.
// This matches the existing greedy-controller cadence and keeps the AI
// composable with the same pump that drives the UI.
//
// Session 13 added a healing phase: when an ally (incl self) is below
// the wound threshold (50% maxHpBase) and a healing ability is in
// range, the AI casts heal in preference to attacking. The threshold
// and the heal-over-attack priority are deliberately blunt — there's
// no notion of "an attack that would KO is worth more than the heal."
// That kind of stat-aware projection lands when content has more than
// one option to choose between. Move-to-heal (closing distance to a
// wounded ally) also waits — v1 only heals allies already in range.
//
// Scope still narrow elsewhere: buffing, charged actions, AoE, and
// reaction-aware play wait for the content that introduces them —
// adding them piecemeal here would invent decision policy without a
// content consumer to constrain it.

import {
  endpointFrom,
  getLegalMoves,
  horizontalDistance,
  inRange,
  positionKey,
  tileAt,
  validateAction,
  type Catalog,
  type GameState,
  type Position,
  type ProposedAction,
  type Unit,
  type ActiveAbilityDefinition,
  type AbilityId,
} from '@engine/index.ts';

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
// "half health or less." Tuned for the v1 demo where Cure restores
// ~20 HP on a 60-HP knight (~33%) — healing a near-full ally is mostly
// wasted, so we wait until a real chunk has been taken.
const HEAL_THRESHOLD = 0.5;

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

  // Phase 0: heal if an ally is wounded and in range.
  if (state.turnState.budget.actsAvailable > 0 && healing.length > 0) {
    const heal = pickBestHeal(state, catalog, actor, allies, healing);
    if (heal !== null) return { kind: 'commit', action: heal };
  }

  // Phase 1: attack if anything is in range. Skip if no enemies remain
  // (heal phase still runs above so a "nobody to attack but a wounded
  // ally" turn still does useful work).
  if (
    state.turnState.budget.actsAvailable > 0 &&
    offensive.length > 0 &&
    enemies.length > 0
  ) {
    const attack = pickBestAttack(state, catalog, actor, enemies, offensive);
    if (attack !== null) return { kind: 'commit', action: attack };
  }

  // Phase 2: move toward an attack opportunity. Skipped when no enemies
  // remain — there's nowhere meaningful to advance.
  if (state.turnState.budget.movesAvailable > 0 && enemies.length > 0) {
    const move = pickBestMove(state, catalog, actor, enemies, offensive);
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

// Living allies (same team), including the actor itself — self-heal
// is a valid move when no other allies are in range or the actor is
// the most-wounded one. KO'd allies aren't healable via Cure (Raise
// is a different ability that lands later); filter them.
function livingAllies(state: GameState, actor: Unit): Unit[] {
  const out: Unit[] = [];
  for (const u of state.units.values()) {
    if (u.team !== actor.team) continue;
    if (u.vitals.hp <= 0) continue;
    out.push(u);
  }
  return out;
}

// Walk the actor's loadout, resolve every active member of every
// equipped command set, and keep those that look offensive (single_unit
// targeting, has a damage spec, no 'healing' tag). Returned in
// equip-bucket-then-set-member order — deterministic.
function enumerateOffensiveAbilities(
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
      if (!isOffensiveSingleUnit(ability)) continue;
      out.push(ability);
    }
  }
  return out;
}

function isOffensiveSingleUnit(ability: ActiveAbilityDefinition): boolean {
  if (ability.targeting.kind !== 'single_unit') return false;
  const damage = ability.effects.damage;
  if (damage === undefined) return false;
  // Healing is delivered via the damage pipeline with the 'healing' tag;
  // we exclude it from offensive options. (Buffs / debuffs land in
  // `statusEffects`, which the AI doesn't reason about yet.)
  if (damage.tags.includes('healing')) return false;
  return true;
}

// Healing-side parallel of `enumerateOffensiveAbilities`. Walks the
// actor's loadout and keeps active, single_unit, healing-tagged
// abilities. The 'healing' tag is what the damage pipeline's finalize
// stage uses to flip polarity (HP rises rather than falls).
function enumerateHealingAbilities(
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
      if (!isHealingSingleUnit(ability)) continue;
      out.push(ability);
    }
  }
  return out;
}

function isHealingSingleUnit(ability: ActiveAbilityDefinition): boolean {
  if (ability.targeting.kind !== 'single_unit') return false;
  const damage = ability.effects.damage;
  if (damage === undefined) return false;
  return damage.tags.includes('healing');
}

// Pick the best heal action this turn. Filters allies down to those
// below the HEAL_THRESHOLD ratio, sorts most-wounded first, and tries
// each ability in order against each candidate. Returns null when no
// wounded ally is in range — the caller falls through to attack /
// move phases.
//
// "Best" is currently shallow: lowest-HP-ratio ally wins; among
// abilities, the highest-power one. With Cure as the only v1 healer
// the inner sort is a no-op; it's there for the second healing
// ability to land cleanly.
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

// Approximation of "how wounded is this unit?" — current HP divided by
// `baseStats.maxHpBase`. The truly correct denominator is the
// `modifyStatQuery`'d maxHp (composed against the unit's status /
// equipment hooks), but for v1 content nothing modifies maxHp at
// runtime, so the cheap base is identical. Switch to the full query
// when a maxHp-modifying status / equipment effect ships.
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

// Score an offensive ability for a given (actor, target). Higher = more
// preferred. v1 heuristic: power coefficient as a stand-in for expected
// damage. When stat-aware projection (PA × power × variance midpoint)
// is worth wiring, this is where it goes; for the v1 single-attack
// content set, all candidates score the same and lex-id breaks ties.
function abilityScore(ability: ActiveAbilityDefinition): number {
  return ability.effects.damage?.power ?? 1;
}

// Lowest-HP enemy first, then lex-id. The targeting bias of the AI:
// finishing a wounded enemy is worth more than chipping a healthy one.
function compareTargets(a: Unit, b: Unit): number {
  if (a.vitals.hp !== b.vitals.hp) return a.vitals.hp - b.vitals.hp;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

// Best attack from the actor's *current* position. For each enemy in
// range of any offensive ability, prefer the lowest-HP enemy; among
// tied targets, prefer the higher-scoring ability. Validates each
// candidate via `validateAction` so an unforeseen rule (LoS, MP, etc.)
// is honored — pure cheap insurance.
function pickBestAttack(
  state: GameState,
  catalog: Catalog,
  actor: Unit,
  enemies: ReadonlyArray<Unit>,
  offensive: ReadonlyArray<ActiveAbilityDefinition>,
): ProposedAction | null {
  const sortedTargets = [...enemies].sort(compareTargets);

  for (const target of sortedTargets) {
    const sortedAbilities = [...offensive].sort((a, b) => abilityScore(b) - abilityScore(a));
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

// Pure range check using `inRange` — the AI uses this both for
// validating attacks at the current position and for projecting which
// enemies a hypothetical move destination would put in range.
function targetIsInAbilityRange(
  state: GameState,
  source: Position,
  target: Unit,
  ability: ActiveAbilityDefinition,
  catalog: Catalog,
): boolean {
  if (ability.targeting.kind !== 'single_unit') return false;
  const sourceTile = tileAt(state.map, source.x, source.y, source.layer);
  const targetTile = tileAt(state.map, target.position.x, target.position.y, target.position.layer);
  if (sourceTile === undefined || targetTile === undefined) return false;
  const ruleset = catalog.getRuleset(state.ruleset.id);
  return inRange({
    source: endpointFrom(source, sourceTile.elevation),
    target: endpointFrom(target.position, targetTile.elevation),
    params: {
      horizontalMax: ability.targeting.range.horizontal,
      horizontalMin: ability.targeting.range.minHorizontal ?? ruleset.rangeDefaults.minHorizontal,
      verticalMax: ability.targeting.range.vertical,
    },
  });
}

interface MoveScore {
  readonly destination: Position;
  // Lower hp of the best target reachable from this destination, or
  // +Infinity if no enemy is in range from here.
  readonly bestThreatHp: number;
  // Distance (horizontal) to the global priority target (lowest-HP
  // enemy). Tiebreak when no destination puts anyone in range.
  readonly distanceToPriority: number;
  // Stable lex key for final tiebreak.
  readonly key: string;
}

// Best move destination for advancing the AI's plan. Two-tier scoring:
// (1) destinations that put some enemy in attack range win; among them,
// the one that threatens the lowest-HP enemy wins. (2) Otherwise,
// minimize distance to the lowest-HP enemy globally — focuses fire over
// time even when no kill is on the table this turn.
//
// Returns null when the only legal move is staying put. The orchestrator
// then ends the turn (no point committing a no-op move action).
function pickBestMove(
  state: GameState,
  catalog: Catalog,
  actor: Unit,
  enemies: ReadonlyArray<Unit>,
  offensive: ReadonlyArray<ActiveAbilityDefinition>,
): ProposedAction | null {
  const moves = getLegalMoves(state, actor.id, catalog);
  const priorityTarget = [...enemies].sort(compareTargets)[0]!;

  let best: MoveScore | null = null;

  for (const [key, path] of moves.reachable) {
    const dest = path.destination;
    if (samePosition(dest, actor.position)) continue;

    const bestThreatHp = offensive.length === 0
      ? Number.POSITIVE_INFINITY
      : minThreatenedHpFrom(state, dest, enemies, offensive, catalog);
    const distanceToPriority = horizontalDistance(dest, priorityTarget.position);
    const candidate: MoveScore = { destination: dest, bestThreatHp, distanceToPriority, key };

    if (best === null || compareMoves(candidate, best) < 0) {
      best = candidate;
    }
  }

  if (best === null) return null;

  // Belt and suspenders: validate the chosen move. `getLegalMoves`
  // already returned only legal destinations, but if a future hook ever
  // adds a per-move veto (Don't Move-style), validateAction will catch
  // it before we hand the orchestrator a doomed action.
  const proposed: ProposedAction = {
    type: 'move',
    source: 'player',
    actorId: actor.id,
    payload: { destination: best.destination },
  };
  if (!validateAction(state, proposed, catalog).valid) return null;
  return proposed;
}

function samePosition(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y && a.layer === b.layer;
}

// Lower is better.
function compareMoves(a: MoveScore, b: MoveScore): number {
  if (a.bestThreatHp !== b.bestThreatHp) return a.bestThreatHp - b.bestThreatHp;
  if (a.distanceToPriority !== b.distanceToPriority) {
    return a.distanceToPriority - b.distanceToPriority;
  }
  return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
}

// Lowest HP among enemies reachable by *any* offensive ability from
// `from`. +Infinity when none are.
function minThreatenedHpFrom(
  state: GameState,
  from: Position,
  enemies: ReadonlyArray<Unit>,
  offensive: ReadonlyArray<ActiveAbilityDefinition>,
  catalog: Catalog,
): number {
  let lowest = Number.POSITIVE_INFINITY;
  for (const enemy of enemies) {
    for (const ability of offensive) {
      if (targetIsInAbilityRange(state, from, enemy, ability, catalog)) {
        if (enemy.vitals.hp < lowest) lowest = enemy.vitals.hp;
        break; // any reaching ability is enough; don't double-count.
      }
    }
  }
  return lowest;
}

// Re-export so consumers using `positionKey` for stable orderings don't
// need a second import. The MoveScore.key field is stable on
// (x, y, layer); positionKey is the canonical formatter.
export { positionKey };
