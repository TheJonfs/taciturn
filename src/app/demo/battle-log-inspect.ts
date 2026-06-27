// Battle-log inspection — reads emergent AI behaviour out of a committed
// action log (Session 75). The companion to `headless-battle.ts`: the
// runner produces a deterministic full-battle log, and these readers turn
// it into structured behaviour facts so the implementer can reason about
// *feel* over a log rather than over screenshots.
//
// This is the durable half of the S75 seam. The two readers below answer
// the S74 A/B questions, but the pattern generalizes: a future AI
// feel-check writes a new reader here and runs it over a headless battle.
//
// TEST/DEBUG-ONLY — see `headless-battle.ts`. Nothing in the shipped app
// imports this.

import type {
  AbilityId,
  Catalog,
  ChargedActionId,
  ClassId,
  GameState,
  TeamId,
  UnitId,
} from '@engine/index.ts';
import type { HeadlessBattleResult } from './headless-battle.ts';

// --- shared lookups ------------------------------------------------------

interface UnitFacts {
  readonly team: TeamId;
  readonly classId: ClassId;
}

// Class + team are stable across a v1 battle (charm changes *control*,
// not team; class doesn't change), so a single snapshot from the initial
// state answers "whose unit was this / what class" for every log entry —
// including units that later died.
function unitFacts(state: GameState): ReadonlyMap<UnitId, UnitFacts> {
  const map = new Map<UnitId, UnitFacts>();
  for (const unit of state.units.values()) {
    map.set(unit.id, { team: unit.team, classId: unit.classState.currentClass });
  }
  return map;
}

// --- S74 A: AoE-buff coverage -------------------------------------------

export interface AoeBuffCast {
  readonly caster: UnitId;
  readonly casterClass: ClassId;
  readonly abilityId: AbilityId;
  // Allies the cast's AoE footprint *covered* (ally unit in the per-target
  // result set, regardless of whether the buff landed). This is the S74 A
  // signal — `scoreAoeBuff` is coverage-weighted, so the question is "did
  // the anchor sit over a cluster", not "did every status stick". A
  // clustered anchor covers ≥2 allies; a lonely cast covers one.
  readonly alliesInFootprint: number;
  // Of those covered allies, how many actually received the buff. Diverges
  // from `alliesInFootprint` when S74 buff exclusivity (auto vs. cast
  // form) rejects a stack on an ally who already holds the slot.
  readonly alliesBuffed: number;
  // Every unit the footprint touched (allies + any caught enemies), for
  // context.
  readonly unitsInFootprint: number;
}

// True when an ability is an *AoE buff* — the path that routes through the
// AI's `scoreAoeBuff` (S74 A). It pairs an AoE shape with at least one
// status whose catalog polarity hint is 'buff'.
function isAoeBuffAbility(catalog: Catalog, id: AbilityId): boolean {
  const ability = catalog.getAbility(id);
  if (ability.kind !== 'active') return false;
  const effects = ability.effects;
  if (effects?.aoe === undefined) return false;
  const specs = effects.statusEffects;
  if (specs === undefined || specs.length === 0) return false;
  return specs.some((spec) => catalog.getStatusType(spec.typeId).aiHints?.polarity === 'buff');
}

const POSITIVE_APPLY_KINDS = new Set(['applied', 'refreshed', 'replaced', 'stacked']);

// Of a per-target result set, how many allies of `casterTeam` the
// footprint covered, and how many of those actually received the buff.
function allyCoverage(
  perTarget: ReadonlyArray<{
    readonly target: { readonly kind: string; readonly unitId?: UnitId };
    readonly statusesApplied?: ReadonlyArray<{ readonly kind: string }>;
  }>,
  casterTeam: TeamId,
  facts: ReadonlyMap<UnitId, UnitFacts>,
): { readonly inFootprint: number; readonly buffed: number } {
  let inFootprint = 0;
  let buffed = 0;
  for (const r of perTarget) {
    if (r.target.kind !== 'unit' || r.target.unitId === undefined) continue;
    const targetFacts = facts.get(r.target.unitId);
    if (targetFacts === undefined || targetFacts.team !== casterTeam) continue;
    inFootprint += 1;
    if ((r.statusesApplied ?? []).some((s) => POSITIVE_APPLY_KINDS.has(s.kind))) buffed += 1;
  }
  return { inFootprint, buffed };
}

// Every AoE-buff cast in the battle, optionally filtered to one caster
// class (S74 A uses `'enchanter'`). Each record reports how many allies
// the cast actually buffed — the cluster-vs-lonely read.
//
// Enchanter buffs are *charged* (actionSpeed > 0): the `use_ability`
// commit only creates the ChargedAction (empty per-target results); the
// statuses actually land later in `charged_action_resolve`. So coverage
// is read from the resolution, correlated back to the commit by
// charged-action id. Instant AoE buffs (actionSpeed 0) are read directly
// off the commit.
export function aoeBuffCasts(
  result: HeadlessBattleResult,
  options: { readonly casterClass?: ClassId } = {},
): ReadonlyArray<AoeBuffCast> {
  const { catalog } = result;
  const facts = unitFacts(result.initialState);
  const casts: AoeBuffCast[] = [];

  const matches = (caster: UnitId | undefined, id: AbilityId): UnitFacts | null => {
    if (caster === undefined) return null;
    const f = facts.get(caster);
    if (f === undefined) return null;
    if (options.casterClass !== undefined && f.classId !== options.casterClass) return null;
    if (!isAoeBuffAbility(catalog, id)) return null;
    return f;
  };

  // Pending charged AoE-buff casts, keyed by charged-action id.
  const pending = new Map<ChargedActionId, { readonly caster: UnitId; readonly facts: UnitFacts; readonly abilityId: AbilityId }>();

  for (const action of result.log) {
    if (action.type === 'use_ability') {
      const id = action.payload.abilityId;
      const f = matches(action.actorId, id);
      if (f === null) continue;
      const chargedId = action.outcome?.chargedActionId;
      if (chargedId !== undefined) {
        // Charged — coverage is measured when it resolves.
        pending.set(chargedId, { caster: action.actorId!, facts: f, abilityId: id });
        continue;
      }
      // Instant AoE buff.
      const perTarget = action.outcome?.perTargetResults ?? [];
      const cov = allyCoverage(perTarget, f.team, facts);
      casts.push({
        caster: action.actorId!,
        casterClass: f.classId,
        abilityId: id,
        alliesInFootprint: cov.inFootprint,
        alliesBuffed: cov.buffed,
        unitsInFootprint: perTarget.length,
      });
    } else if (action.type === 'charged_action_resolve') {
      const p = pending.get(action.payload.chargedActionId);
      if (p === undefined) continue;
      const perTarget = action.outcome?.perTargetResults ?? [];
      const cov = allyCoverage(perTarget, p.facts.team, facts);
      casts.push({
        caster: p.caster,
        casterClass: p.facts.classId,
        abilityId: p.abilityId,
        alliesInFootprint: cov.inFootprint,
        alliesBuffed: cov.buffed,
        unitsInFootprint: perTarget.length,
      });
    }
  }
  return casts;
}

// --- S74 B: charged tile-pin attack hit/whiff ---------------------------

export interface ChargedTilePinResolution {
  readonly caster: UnitId;
  readonly abilityId: AbilityId;
  // A tile-pinned charge "lands" when a unit was standing on the pinned
  // tile at resolution (a per-target result with positive damage). It
  // "whiffs" when the tile was empty — the target dodged by moving off
  // before the charge resolved. S74 B devalues *dodgeable* charges, so a
  // low whiff rate is the signal the devaluation is working.
  readonly landed: boolean;
}

// Every resolution of the given tile-pinned charged ability (S74 B uses
// `'charged_attack'`). Correlates each `charged_action_resolve` back to
// its originating `use_ability` commit (by charged-action id) to recover
// which ability charged, then reads the resolution's per-target results
// for hit/whiff.
export function chargedTilePinResolutions(
  result: HeadlessBattleResult,
  id: AbilityId,
): ReadonlyArray<ChargedTilePinResolution> {
  // Pass 1: chargedActionId → { caster, abilityId } from the commits.
  const charged = new Map<ChargedActionId, { readonly caster: UnitId; readonly abilityId: AbilityId }>();
  for (const action of result.log) {
    if (action.type !== 'use_ability') continue;
    const chargedId = action.outcome?.chargedActionId;
    if (chargedId === undefined || action.actorId === undefined) continue;
    charged.set(chargedId, { caster: action.actorId, abilityId: action.payload.abilityId });
  }

  // Pass 2: each resolution of the target ability → landed/whiffed.
  const resolutions: ChargedTilePinResolution[] = [];
  for (const action of result.log) {
    if (action.type !== 'charged_action_resolve') continue;
    const commit = charged.get(action.payload.chargedActionId);
    if (commit === undefined || commit.abilityId !== id) continue;
    const perTarget = action.outcome?.perTargetResults ?? [];
    const landed = perTarget.some((r) => r.hit && (r.damage ?? 0) > 0);
    resolutions.push({ caster: commit.caster, abilityId: id, landed });
  }
  return resolutions;
}
