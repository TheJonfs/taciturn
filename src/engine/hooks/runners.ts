// Chain-runner helpers — fire a chain hook against every active handler
// for a unit, threading a value through each handler's return.
//
// These runners are source-agnostic: they consume the uniform
// `CollectedHandler<K>` produced by the collector and don't know which
// kind of source registered the handler. Single-source event runners
// (e.g., status-specific `fireOnApply`) live with their owning lifecycle
// instead.

import type { Catalog } from '../catalog/index.ts';
import type {
  DamageContext,
  DamageTag,
  GameState,
  MovementProfile,
  ProposedAction,
  StatName,
  TerrainType,
  Unit,
} from '../types/index.ts';
import { collectActiveHandlers } from './collector.ts';
import type { ActionAttemptResult, TurnSkipResult } from './hooks.ts';

export function runModifyStatQuery(
  state: GameState,
  catalog: Catalog,
  args: { unit: Unit; statName: StatName; baseValue: number },
): number {
  const handlers = collectActiveHandlers(state, args.unit.id, catalog, 'modifyStatQuery');
  let value = args.baseValue;
  for (const h of handlers) {
    value = h.invoke({ unit: args.unit, statName: args.statName, baseValue: value });
  }
  return value;
}

export function runModifyCanEnter(
  state: GameState,
  catalog: Catalog,
  args: { unit: Unit; baseValue: ReadonlySet<TerrainType> },
): ReadonlySet<TerrainType> {
  const handlers = collectActiveHandlers(state, args.unit.id, catalog, 'modifyCanEnter');
  let value = args.baseValue;
  for (const h of handlers) {
    value = h.invoke({ unit: args.unit, baseValue: value });
  }
  return value;
}

export function runModifyTerrainCosts(
  state: GameState,
  catalog: Catalog,
  args: { unit: Unit; baseValue: ReadonlyMap<TerrainType, number> },
): ReadonlyMap<TerrainType, number> {
  const handlers = collectActiveHandlers(state, args.unit.id, catalog, 'modifyTerrainCosts');
  let value = args.baseValue;
  for (const h of handlers) {
    value = h.invoke({ unit: args.unit, baseValue: value });
  }
  return value;
}

export function runModifySpecialMovement(
  state: GameState,
  catalog: Catalog,
  args: { unit: Unit; baseValue: MovementProfile['specialMovement'] },
): MovementProfile['specialMovement'] {
  const handlers = collectActiveHandlers(state, args.unit.id, catalog, 'modifySpecialMovement');
  let value = args.baseValue;
  for (const h of handlers) {
    value = h.invoke({ unit: args.unit, baseValue: value });
  }
  return value;
}

// Pre-resolution hook firing — short-circuits on the first non-`allowed`
// result. Stop returns `blocked`, Berserk returns `replaced`. Equipment
// → Class → Passive → Status order is preserved so a class trait that
// allows after a status that blocks does not run (status fires later
// in the order, but the comparator places equipment-tier first; the
// short-circuit means the most-recently-applied source wins by default
// when multiple sources contend — a knob the per-handler priority
// adjusts).
export function runOnActionAttempted(
  state: GameState,
  catalog: Catalog,
  args: { unit: Unit; action: ProposedAction },
): ActionAttemptResult {
  const handlers = collectActiveHandlers(state, args.unit.id, catalog, 'onActionAttempted');
  let current = args.action;
  for (const h of handlers) {
    const result = h.invoke({ unit: args.unit, action: current });
    if (result.kind === 'blocked') return result;
    if (result.kind === 'replaced') {
      current = result.with;
    }
  }
  if (current === args.action) return { kind: 'allowed' };
  return { kind: 'replaced', with: current };
}

// Post-application hook firing — collects reactions every handler
// produces, then gates each by a Brave-based trigger roll on the
// reactor (per docs/battle-mechanics-guide.md "Reaction trigger
// chance"): `trigger_chance = Brave / 100`. A unit at Brave 100 (the
// v1 demo default) triggers deterministically; lower-Brave units skip
// reactions probabilistically.
//
// Brave is read through `modifyStatQuery` so future buff/debuff statuses
// modifying brave compose. v1 has no such status — the chain is
// identity today.
//
// Seed determinism: the per-action `seed` is folded with a sub-stream
// constant (BRAVE_REACTION_SUB_STREAM) plus a per-reaction index. Same
// action seed + same proposed reactions list always produce the same
// trigger pattern. Brave is rolled per *proposed* reaction, not per
// handler — multiple reactions from one handler each roll separately.
//
// The reducer enqueues the surviving reactions onto the action chain.
// Damage-bearing actions enrich the args with the final damage amount
// and tag set so reaction handlers (Counter, Auto-Potion) can gate
// without a catalog re-lookup.
//
// Seed contract: `seed` is the per-action seed of the *incoming* action
// (the one that fired onActionTargeted). Stable across replay because
// the action's seed is recorded on its envelope.
const BRAVE_REACTION_SUB_STREAM = 2;

export function runOnActionTargeted(
  state: GameState,
  catalog: Catalog,
  args: {
    unit: Unit;
    incomingAction: ProposedAction;
    damageDealt?: number;
    damageTags?: ReadonlySet<DamageTag>;
    seed: number;
  },
): ReadonlyArray<ProposedAction> {
  const handlers = collectActiveHandlers(state, args.unit.id, catalog, 'onActionTargeted');
  const proposed: ProposedAction[] = [];
  for (const h of handlers) {
    const result = h.invoke({
      unit: args.unit,
      incomingAction: args.incomingAction,
      ...(args.damageDealt !== undefined ? { damageDealt: args.damageDealt } : {}),
      ...(args.damageTags !== undefined ? { damageTags: args.damageTags } : {}),
    });
    for (const r of result) proposed.push(r);
  }
  if (proposed.length === 0) return proposed;

  const brave = runModifyStatQuery(state, catalog, {
    unit: args.unit,
    statName: 'brave',
    baseValue: args.unit.baseStats.brave,
  });
  const triggerChance = Math.max(0, Math.min(1, brave / 100));
  if (triggerChance >= 1) return proposed; // deterministic at Brave 100+
  if (triggerChance <= 0) return [];        // deterministic at Brave 0

  const surviving: ProposedAction[] = [];
  for (let i = 0; i < proposed.length; i++) {
    const subSeed = args.seed ^ ((BRAVE_REACTION_SUB_STREAM + i) >>> 0);
    const r = unitFloatFromSeed(subSeed);
    if (r < triggerChance) {
      const reaction = proposed[i];
      if (reaction !== undefined) surviving.push(reaction);
    }
  }
  return surviving;
}

// mulberry32-style mixer matching engine/damage/handlers.ts's variance
// roll. Kept here so reaction-roll determinism doesn't depend on a
// damage-package import. Returns a unit float in [0, 1).
function unitFloatFromSeed(seed: number): number {
  let s = seed >>> 0;
  s = (s + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// Damage-pipeline chain hooks — fired at the attacker / target stages
// of the seven-stage damage pipeline (action-resolution.md "Damage
// pipeline"). Each handler reads the in-flight `DamageContext`, may
// contribute multipliers / additives / hit overrides, and returns the
// next ctx. The pipeline orchestrator threads the chain through all
// stages; these runners thread it through one stage's handlers.
export function runOnDamageDealt(
  state: GameState,
  catalog: Catalog,
  args: { unit: Unit; ctx: DamageContext },
): DamageContext {
  const handlers = collectActiveHandlers(state, args.unit.id, catalog, 'onDamageDealt');
  let ctx = args.ctx;
  for (const h of handlers) {
    ctx = h.invoke({ unit: args.unit, ctx });
  }
  return ctx;
}

export function runOnDamageReceived(
  state: GameState,
  catalog: Catalog,
  args: { unit: Unit; ctx: DamageContext },
): DamageContext {
  const handlers = collectActiveHandlers(state, args.unit.id, catalog, 'onDamageReceived');
  let ctx = args.ctx;
  for (const h of handlers) {
    ctx = h.invoke({ unit: args.unit, ctx });
  }
  return ctx;
}

// Turn-skip query: fires at turn_start, returns the first non-null
// result (the first handler that decides "skip"). Stop / Sleep / Petrify
// register handlers that return `{ reason }` while active; default-
// acting statuses don't register on this hook. Tier order applies; a
// status registered later in the tier chain that wants to *override* a
// prior skip directive isn't supported (the runner short-circuits).
// Today no v1 case needs override semantics; revisit if future content
// surfaces one.
export function runQueryTurnSkipped(
  state: GameState,
  catalog: Catalog,
  args: { unit: Unit },
): TurnSkipResult {
  const handlers = collectActiveHandlers(state, args.unit.id, catalog, 'queryTurnSkipped');
  for (const h of handlers) {
    const result = h.invoke({ unit: args.unit });
    if (result !== null) return result;
  }
  return null;
}
