// Action-log formatters — pure functions that turn engine Actions into
// renderable log rows.
//
// Per `docs/twentyOneDesign/battle-ui-architecture.md` §"Log Entry
// Format", each action becomes either a top-level T-event row (turn
// boundaries) or an indented sub-row (the work that happened during a
// turn). System-emitted events get bracketed prefixes: [init] (before
// T0001), [tick], [charged], [end].
//
// v1 scope (Session 23): one row per logged action, human-readable
// summary, no expandable details. Click-to-expand and click-to-
// highlight-counterpart-row are Session 24 polish.
//
// KO detection — the design doc emits a `[ko]` row when a unit drops
// to 0 HP. v1 omits this; visualization makes the KO obvious and the
// damage row carries the magnitude. A running-HP tracker over the log
// is straightforward but punts to Session 24 along with the rest of
// the log polish.

import type { Action, Catalog, GameState, UnitId } from '@engine/index.ts';

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
  readonly tagKind: 'turn' | 'system' | 'reaction' | null;
}

// Format every visible action in the log. Skipped actions (set_facing,
// internal bookkeeping) drop out. Caller renders the rows top-to-bottom
// with newest at the bottom.
export function formatActionLog(
  log: ReadonlyArray<Action>,
  state: GameState,
  catalog: Catalog,
): ReadonlyArray<LogRow> {
  const out: LogRow[] = [];
  // T-event counter — incremented on each turn_start. Charged action
  // resolutions also count per the design doc; v1 keeps it simple and
  // counts unit-turn starts only.
  let tNumber = 0;

  for (const action of log) {
    if (action.type === 'turn_start') tNumber += 1;
    const rows = formatAction(action, state, catalog, tNumber);
    for (const row of rows) out.push(row);
  }
  return out;
}

function formatAction(
  action: Action,
  state: GameState,
  catalog: Catalog,
  currentTNumber: number,
): ReadonlyArray<LogRow> {
  const key = String(action.sequenceNumber);
  switch (action.type) {
    case 'turn_start': {
      const tag = formatT(currentTNumber);
      const unit = state.units.get(action.payload.unitId);
      const cls = unit !== undefined ? safeClassName(catalog, unit.classState.currentClass) : '';
      const name = unit?.name ?? String(action.payload.unitId);
      const skipped = action.outcome?.skipped ? ' (skipped)' : '';
      const text = `${name}${cls === '' ? '' : ` (${cls})`}${skipped}`;
      return [{ key, tag, text, indent: false, tagKind: 'turn' }];
    }

    case 'turn_end':
      // Turn ends close a group implicitly; no row needed.
      return [];

    case 'move': {
      const dest = action.payload.destination;
      return [
        {
          key,
          tag: null,
          text: `→ Moved to (${dest.x}, ${dest.y})`,
          indent: true,
          tagKind: null,
        },
      ];
    }

    case 'use_ability':
      return formatUseAbility(action, state, catalog, key);

    case 'wait':
      return [
        {
          key,
          tag: null,
          text: `→ Waited`,
          indent: true,
          tagKind: null,
        },
      ];

    case 'set_facing':
      return []; // no row — internal bookkeeping

    case 'charged_action_resolve': {
      const id = action.payload.chargedActionId;
      // The charged action may have been removed from state by now; use
      // its action-log entry alone as the source of truth for the name.
      const tag = '[charged]';
      // Per-target damage summary.
      const perTarget = action.outcome?.perTargetResults ?? [];
      const summary = perTarget.length === 0
        ? 'resolved'
        : perTarget.map((r) => formatTargetResult(r, state)).join('; ');
      return [
        {
          key,
          tag,
          text: `${String(id)} → ${summary}`,
          indent: true,
          tagKind: 'system',
        },
      ];
    }

    case 'status_tick': {
      const targetName = unitName(state, action.payload.unitId);
      const statusName = safeStatusName(catalog, action.payload.statusTypeId);
      const text = `${statusName} ticked on ${targetName}${action.outcome?.removed ? ' (cleared)' : ''}`;
      return [
        {
          key,
          tag: '[tick]',
          text,
          indent: true,
          tagKind: 'system',
        },
      ];
    }

    case 'system_damage': {
      const targetName = unitName(state, action.payload.targetId);
      const applied = action.outcome?.applied ?? action.payload.amount;
      return [
        {
          key,
          tag: '[tick]',
          text: `${targetName} took ${applied} dmg (${formatDamageSource(action.payload.source)})`,
          indent: true,
          tagKind: 'system',
        },
      ];
    }

    case 'system_heal': {
      const targetName = unitName(state, action.payload.targetId);
      const applied = action.outcome?.applied ?? action.payload.amount;
      return [
        {
          key,
          tag: '[tick]',
          text: `${targetName} healed ${applied} HP`,
          indent: true,
          tagKind: 'system',
        },
      ];
    }

    case 'system_apply_status': {
      const targetName = unitName(state, action.payload.targetId);
      const statusName = safeStatusName(catalog, action.payload.statusTypeId);
      const applied = action.outcome?.result.applied;
      const text = applied === true
        ? `${statusName} applied to ${targetName}`
        : `${statusName} attempted on ${targetName} (failed)`;
      return [
        {
          key,
          tag: '[tick]',
          text,
          indent: true,
          tagKind: 'system',
        },
      ];
    }

    case 'system_ct_push': {
      const targetName = unitName(state, action.payload.targetId);
      const delta = action.outcome?.applied ?? action.payload.delta;
      const sign = delta >= 0 ? '+' : '';
      return [
        {
          key,
          tag: '[tick]',
          text: `${targetName} CT ${sign}${delta}`,
          indent: true,
          tagKind: 'system',
        },
      ];
    }

    case 'status_remove': {
      if (action.outcome?.removed === false) return []; // no-op removals are noise
      const targetName = unitName(state, action.payload.targetId);
      const statusName = safeStatusName(catalog, action.payload.statusTypeId);
      return [
        {
          key,
          tag: '[tick]',
          text: `${statusName} removed from ${targetName}`,
          indent: true,
          tagKind: 'system',
        },
      ];
    }

    case 'status_decrement_stack': {
      if (action.outcome?.newStackCount === undefined) return [];
      const targetName = unitName(state, action.payload.targetId);
      const statusName = safeStatusName(catalog, action.payload.statusTypeId);
      const newCount = action.outcome.newStackCount;
      const text = newCount === 0
        ? `${statusName} cleared from ${targetName}`
        : `${statusName} on ${targetName} → ×${newCount}`;
      return [{ key, tag: '[tick]', text, indent: true, tagKind: 'system' }];
    }

    case 'battle_end': {
      const winner = String(action.payload.winner);
      const desc = action.outcome?.description ?? '';
      const text = desc === '' ? `${winner} wins` : `${winner} wins — ${desc}`;
      return [{ key, tag: '[end]', text, indent: false, tagKind: 'system' }];
    }
  }
}

function formatUseAbility(
  action: Extract<Action, { type: 'use_ability' }>,
  state: GameState,
  catalog: Catalog,
  key: string,
): ReadonlyArray<LogRow> {
  const abilityName = safeAbilityName(catalog, action.payload.abilityId);
  const actorName = action.actorId !== undefined ? unitName(state, action.actorId) : 'unit';
  const isReaction = action.isReaction;
  const perTarget = action.outcome?.perTargetResults ?? [];
  // Charged casts: the per-target results are empty until resolution.
  if (action.outcome?.chargedActionId !== undefined) {
    return [
      {
        key,
        tag: isReaction ? '↳' : null,
        text: `${actorName} began casting ${abilityName}`,
        indent: true,
        tagKind: isReaction ? 'reaction' : null,
      },
    ];
  }
  if (perTarget.length === 0) {
    return [
      {
        key,
        tag: isReaction ? '↳' : null,
        text: `${actorName} → ${abilityName}`,
        indent: true,
        tagKind: isReaction ? 'reaction' : null,
      },
    ];
  }
  const targets = perTarget.map((r) => formatTargetResult(r, state)).join('; ');
  return [
    {
      key,
      tag: isReaction ? '↳' : null,
      text: `${actorName} → ${abilityName}: ${targets}`,
      indent: true,
      tagKind: isReaction ? 'reaction' : null,
    },
  ];
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
