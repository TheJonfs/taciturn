// Action-log formatters — pure functions that turn engine Actions into
// renderable log rows.
//
// Per `docs/twentyOneDesign/battle-ui-architecture.md` §"Log Entry
// Format", each action becomes either a top-level T-event row (turn
// boundaries) or an indented sub-row (the work that happened during a
// turn). System-emitted events get bracketed prefixes: [init] (before
// T0001), [tick], [charged], [ko], [end].
//
// Each row carries a `participants` payload (actor + targets) for the
// hover-counterpart feature and an optional `actionSeq` for click-to-
// expand (rows derived from a logged Action store its sequence number;
// synthetic [ko] rows carry the killing action's seq).

import type { Action, AbilityId, Catalog, GameState, UnitId } from '@engine/index.ts';
import { deriveKoEvents, deriveActionParticipants } from './derived-events.ts';

export interface LogRow {
  // Stable key for React reconciliation.
  readonly key: string;
  // Optional left-side tag (T####, [tick], etc).
  readonly tag: string | null;
  // Main human-readable text.
  readonly text: string;
  // Sub-entries are indented under their parent T-event.
  readonly indent: boolean;
  // Visual class for tag color.
  readonly tagKind: 'turn' | 'system' | 'reaction' | 'ko' | null;
  // The originating action's sequence number. Used by click-to-expand
  // to look up the action and render its outcome details. `null` for
  // rows synthesized without a single backing action (none in v1).
  readonly actionSeq: number | null;
  // Units this row references — the on-canvas hover-counterpart pulse
  // lights these up when the user hovers the row.
  readonly participants: {
    readonly actorId: UnitId | null;
    readonly targetIds: ReadonlyArray<UnitId>;
  };
}

// Format every visible action in the log, interleaving `[ko]` rows at
// the sequence points where units fall. Caller renders top-to-bottom
// with newest at the bottom.
export function formatActionLog(
  log: ReadonlyArray<Action>,
  state: GameState,
  catalog: Catalog,
): ReadonlyArray<LogRow> {
  const koEvents = deriveKoEvents(log, state);
  const koBySeq = new Map<number, typeof koEvents>();
  for (const ev of koEvents) {
    const list = koBySeq.get(ev.atSequence) ?? [];
    koBySeq.set(ev.atSequence, [...list, ev]);
  }

  // Charged-action context lookup: `charged_action_resolve` carries no
  // ability id on its envelope (the spell's identity lives in the
  // spawning `use_ability`). Build a map from chargedActionId → caster
  // + ability so we can render "Brunhilde's Earth Quake resolves on
  // Sparky" instead of the raw id.
  const chargedContext = new Map<string, { abilityId: AbilityId; casterId: UnitId | null }>();
  for (const action of log) {
    if (action.type !== 'use_ability') continue;
    const cid = action.outcome?.chargedActionId;
    if (cid === undefined) continue;
    chargedContext.set(String(cid), {
      abilityId: action.payload.abilityId,
      casterId: action.actorId ?? null,
    });
  }

  const out: LogRow[] = [];
  let tNumber = 0;

  for (const action of log) {
    if (action.type === 'turn_start') tNumber += 1;
    const rows = formatAction(action, state, catalog, tNumber, chargedContext);
    for (const row of rows) out.push(row);
    const kos = koBySeq.get(action.sequenceNumber);
    if (kos !== undefined) {
      for (const ev of kos) {
        const name = state.units.get(ev.unitId)?.name ?? String(ev.unitId);
        const killer =
          ev.killingActor !== null
            ? state.units.get(ev.killingActor)?.name ?? String(ev.killingActor)
            : null;
        const text = killer === null
          ? `${name} defeated`
          : `${name} defeated by ${killer}`;
        out.push({
          key: `ko-${ev.unitId}-${ev.atSequence}`,
          tag: '[ko]',
          text,
          indent: false,
          tagKind: 'ko',
          actionSeq: ev.atSequence,
          participants: {
            actorId: ev.killingActor,
            targetIds: [ev.unitId],
          },
        });
      }
    }
  }
  return out;
}

function formatAction(
  action: Action,
  state: GameState,
  catalog: Catalog,
  currentTNumber: number,
  chargedContext: ReadonlyMap<string, { abilityId: AbilityId; casterId: UnitId | null }>,
): ReadonlyArray<LogRow> {
  const key = String(action.sequenceNumber);
  const seq = action.sequenceNumber;
  const participants = deriveActionParticipants(action);

  function row(opts: {
    readonly tag: string | null;
    readonly text: string;
    readonly indent: boolean;
    readonly tagKind: LogRow['tagKind'];
  }): LogRow {
    return {
      key,
      tag: opts.tag,
      text: opts.text,
      indent: opts.indent,
      tagKind: opts.tagKind,
      actionSeq: seq,
      participants,
    };
  }

  switch (action.type) {
    case 'turn_start': {
      const tag = formatT(currentTNumber);
      const unit = state.units.get(action.payload.unitId);
      const cls = unit !== undefined ? safeClassName(catalog, unit.classState.currentClass) : '';
      const name = unit?.name ?? String(action.payload.unitId);
      const skipped = action.outcome?.skipped ? ' (skipped)' : '';
      const text = `${name}${cls === '' ? '' : ` (${cls})`}${skipped}`;
      return [row({ tag, text, indent: false, tagKind: 'turn' })];
    }

    case 'turn_end':
      // Turn ends close a group implicitly; no row needed.
      return [];

    case 'move': {
      const dest = action.payload.destination;
      return [row({
        tag: null,
        text: `→ Moved to (${dest.x}, ${dest.y})`,
        indent: true,
        tagKind: null,
      })];
    }

    case 'use_ability':
      return formatUseAbility(action, state, catalog, row);

    case 'wait':
      return [row({ tag: null, text: `→ Waited`, indent: true, tagKind: null })];

    case 'set_facing':
      return []; // no row — internal bookkeeping

    case 'charged_action_resolve': {
      const id = action.payload.chargedActionId;
      const ctx = chargedContext.get(String(id));
      const abilityName = ctx !== undefined
        ? safeAbilityName(catalog, ctx.abilityId)
        : String(id);
      const casterName = ctx?.casterId !== null && ctx?.casterId !== undefined
        ? unitName(state, ctx.casterId)
        : null;
      const tag = '[charged]';
      const perTarget = action.outcome?.perTargetResults ?? [];
      const summary = perTarget.length === 0
        ? 'resolved'
        : perTarget.map((r) => formatTargetResult(r, state)).join('; ');
      const text = casterName === null
        ? `${abilityName} resolves: ${summary}`
        : `${casterName}'s ${abilityName} resolves: ${summary}`;
      return [row({ tag, text, indent: true, tagKind: 'system' })];
    }

    case 'status_tick': {
      const targetName = unitName(state, action.payload.unitId);
      const statusName = safeStatusName(catalog, action.payload.statusTypeId);
      const text = `${statusName} ticked on ${targetName}${action.outcome?.removed ? ' (cleared)' : ''}`;
      return [row({ tag: '[tick]', text, indent: true, tagKind: 'system' })];
    }

    case 'system_damage': {
      const targetName = unitName(state, action.payload.targetId);
      const applied = action.outcome?.applied ?? action.payload.amount;
      return [row({
        tag: '[tick]',
        text: `${targetName} took ${applied} dmg (${formatDamageSource(action.payload.source)})`,
        indent: true,
        tagKind: 'system',
      })];
    }

    case 'system_heal': {
      const targetName = unitName(state, action.payload.targetId);
      const applied = action.outcome?.applied ?? action.payload.amount;
      return [row({
        tag: '[tick]',
        text: `${targetName} healed ${applied} HP`,
        indent: true,
        tagKind: 'system',
      })];
    }

    case 'system_apply_status': {
      const targetName = unitName(state, action.payload.targetId);
      const statusName = safeStatusName(catalog, action.payload.statusTypeId);
      const applied = action.outcome?.result.applied;
      const text = applied === true
        ? `${statusName} applied to ${targetName}`
        : `${statusName} attempted on ${targetName} (failed)`;
      return [row({ tag: '[tick]', text, indent: true, tagKind: 'system' })];
    }

    case 'system_ct_push': {
      const targetName = unitName(state, action.payload.targetId);
      const delta = action.outcome?.applied ?? action.payload.delta;
      const sign = delta >= 0 ? '+' : '';
      return [row({
        tag: '[tick]',
        text: `${targetName} CT ${sign}${delta}`,
        indent: true,
        tagKind: 'system',
      })];
    }

    case 'status_remove': {
      if (action.outcome?.removed === false) return []; // no-op removals are noise
      const targetName = unitName(state, action.payload.targetId);
      const statusName = safeStatusName(catalog, action.payload.statusTypeId);
      return [row({
        tag: '[tick]',
        text: `${statusName} removed from ${targetName}`,
        indent: true,
        tagKind: 'system',
      })];
    }

    case 'status_decrement_stack': {
      if (action.outcome?.newStackCount === undefined) return [];
      const targetName = unitName(state, action.payload.targetId);
      const statusName = safeStatusName(catalog, action.payload.statusTypeId);
      const newCount = action.outcome.newStackCount;
      const text = newCount === 0
        ? `${statusName} cleared from ${targetName}`
        : `${statusName} on ${targetName} → ×${newCount}`;
      return [row({ tag: '[tick]', text, indent: true, tagKind: 'system' })];
    }

    case 'battle_end': {
      const winner = String(action.payload.winner);
      const desc = action.outcome?.description ?? '';
      const text = desc === '' ? `${winner} wins` : `${winner} wins — ${desc}`;
      return [row({ tag: '[end]', text, indent: false, tagKind: 'system' })];
    }
  }
}

function formatUseAbility(
  action: Extract<Action, { type: 'use_ability' }>,
  state: GameState,
  catalog: Catalog,
  row: (opts: {
    readonly tag: string | null;
    readonly text: string;
    readonly indent: boolean;
    readonly tagKind: LogRow['tagKind'];
  }) => LogRow,
): ReadonlyArray<LogRow> {
  const abilityName = safeAbilityName(catalog, action.payload.abilityId);
  const actorName = action.actorId !== undefined ? unitName(state, action.actorId) : 'unit';
  const isReaction = action.isReaction;
  const perTarget = action.outcome?.perTargetResults ?? [];
  const tag = isReaction ? '↳' : null;
  const tagKind: LogRow['tagKind'] = isReaction ? 'reaction' : null;
  // Charged casts: the per-target results are empty until resolution.
  if (action.outcome?.chargedActionId !== undefined) {
    return [row({ tag, text: `${actorName} began casting ${abilityName}`, indent: true, tagKind })];
  }
  if (perTarget.length === 0) {
    return [row({ tag, text: `${actorName} → ${abilityName}`, indent: true, tagKind })];
  }
  const targets = perTarget.map((r) => formatTargetResult(r, state)).join('; ');
  return [row({ tag, text: `${actorName} → ${abilityName}: ${targets}`, indent: true, tagKind })];
}

function formatTargetResult(
  r: import('@engine/index.ts').AbilityTargetResult,
  state: GameState,
): string {
  let label: string;
  if (r.target.kind === 'unit') label = unitName(state, r.target.unitId);
  else if (r.target.kind === 'tile') label = `(${r.target.position.x}, ${r.target.position.y})`;
  else label = 'self';
  if (!r.hit) return `${label} missed`;
  const dmg = r.damage ?? 0;
  const heal = r.healing ?? 0;
  if (heal > 0) return `${label} +${heal} HP`;
  if (dmg > 0) return `${label} ${dmg} dmg`;
  if (r.statusesApplied !== undefined && r.statusesApplied.length > 0) {
    const applied = r.statusesApplied.filter((s) => s.applied).length;
    if (applied > 0) return `${label} status ×${applied}`;
    return `${label} resisted`;
  }
  return label;
}

function formatT(n: number): string {
  return `T${String(n).padStart(4, '0')}`;
}

function unitName(state: GameState, id: UnitId): string {
  return state.units.get(id)?.name ?? String(id);
}

function safeClassName(catalog: Catalog, classId: import('@engine/index.ts').ClassId): string {
  try {
    return catalog.getClass(classId).name;
  } catch {
    return String(classId);
  }
}

function safeAbilityName(catalog: Catalog, id: import('@engine/index.ts').AbilityId): string {
  try {
    return catalog.getAbility(id).name;
  } catch {
    return String(id);
  }
}

function safeStatusName(catalog: Catalog, id: import('@engine/index.ts').StatusTypeId): string {
  try {
    return catalog.getStatusType(id).name;
  } catch {
    return String(id);
  }
}

function formatDamageSource(source: import('@engine/index.ts').SystemDamageSource): string {
  switch (source.kind) {
    case 'status_tick':
      return String(source.statusTypeId);
    case 'falling':
      return `fall ${source.dropDistance}`;
    case 'ability_self_cost':
      return `self-cost ${String(source.abilityId)}`;
  }
}
