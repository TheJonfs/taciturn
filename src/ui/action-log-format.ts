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

import type {
  Action,
  AbilityId,
  Catalog,
  GameState,
  StatusApplicationOutcome,
  TeamId,
  UnitId,
} from '@engine/index.ts';
import { deriveKoEvents, deriveActionParticipants } from './derived-events.ts';

// A run of text in a log row, optionally tagged with the team it
// belongs to. The renderer applies team color to segments carrying a
// `team` value; plain segments render in the default text color. Per
// ADR-0051: lets the formatter mark unit-name spans (actor, target,
// charged caster) without the renderer doing string parsing.
export interface LogSegment {
  readonly text: string;
  readonly team?: TeamId;
}

// Classifies a StatusApplicationOutcome for log rendering. Success kinds
// (`applied`, `refreshed`, `replaced`, `stacked`) report applied=true with
// a kind-specific label. Failure kinds (`resisted`, `rejected`, `missed`)
// report applied=false. Used by both `system_apply_status` rows and the
// per-target use_ability summary so the two surfaces never disagree.
function classifyStatusOutcome(
  outcome: StatusApplicationOutcome,
): { readonly applied: boolean; readonly label: string } {
  switch (outcome.kind) {
    case 'applied':
      return { applied: true, label: 'applied' };
    case 'refreshed':
      return { applied: true, label: 'refreshed' };
    case 'replaced':
      return { applied: true, label: 'replaced' };
    case 'stacked': {
      const stacks = outcome.instance.stacks ?? 1;
      return { applied: true, label: `stacked ×${stacks}` };
    }
    case 'resisted':
      return { applied: false, label: 'resisted' };
    case 'rejected':
      return { applied: false, label: 'rejected' };
    case 'missed':
      return { applied: false, label: 'missed' };
  }
}

export interface LogRow {
  // Stable key for React reconciliation.
  readonly key: string;
  // Optional left-side tag (T####, [tick], etc).
  readonly tag: string | null;
  // Structured text — an array of segments. Unit-name segments carry a
  // `team` field for renderer-side team coloring. Per ADR-0051.
  readonly segments: ReadonlyArray<LogSegment>;
  // Flat-string view of `segments`, joined with no separator. Kept as
  // a convenience field for tests and ad-hoc string consumers; the
  // renderer uses `segments` directly so team-colored segments don't
  // collapse.
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
  const koEvents = deriveKoEvents(log, state, catalog);
  const koBySeq = new Map<number, typeof koEvents>();
  for (const ev of koEvents) {
    const list = koBySeq.get(ev.atSequence) ?? [];
    koBySeq.set(ev.atSequence, [...list, ev]);
  }

  // Charged-action context lookup: `charged_action_resolve` carries no
  // ability id on its envelope (the spell's identity lives in the
  // spawning `use_ability`). Build a map from chargedActionId → caster
  // + ability + first target so we can render "Brunhilde's Earth Quake
  // resolves on Sparky" instead of the raw id. Per session 25 the
  // resolve row also includes the target (unit name or tile coords).
  const chargedContext = new Map<
    string,
    {
      abilityId: AbilityId;
      casterId: UnitId | null;
      target:
        | { kind: 'unit'; unitId: UnitId }
        | { kind: 'tile'; position: { x: number; y: number } }
        | { kind: 'self' }
        | null;
    }
  >();
  for (const action of log) {
    if (action.type !== 'use_ability') continue;
    const cid = action.outcome?.chargedActionId;
    if (cid === undefined) continue;
    const payloadTarget = action.payload.target;
    let target: ReturnType<typeof chargedContextTarget>;
    if (payloadTarget.kind === 'unit') {
      target = { kind: 'unit', unitId: payloadTarget.unitId };
    } else if (payloadTarget.kind === 'tile') {
      target = {
        kind: 'tile',
        position: { x: payloadTarget.position.x, y: payloadTarget.position.y },
      };
    } else {
      target = { kind: 'self' };
    }
    chargedContext.set(String(cid), {
      abilityId: action.payload.abilityId,
      casterId: action.actorId ?? null,
      target,
    });
  }

  const out: LogRow[] = [];
  let tNumber = 0;

  for (const action of log) {
    // T-number advances on turn boundaries AND on charged-action resolves
    // (per Chris's playtest call: "each charged-action resolve gets its
    // own T-number"). The resolve renders as a top-level T#### row rather
    // than an indented [charged] row.
    if (action.type === 'turn_start') tNumber += 1;
    if (action.type === 'charged_action_resolve') tNumber += 1;
    const rows = formatAction(action, state, catalog, tNumber, chargedContext);
    for (const row of rows) out.push(row);
    const kos = koBySeq.get(action.sequenceNumber);
    if (kos !== undefined) {
      for (const ev of kos) {
        const victimUnit = state.units.get(ev.unitId);
        const killer =
          ev.killingActor !== null ? state.units.get(ev.killingActor) ?? null : null;
        const segments: LogSegment[] = killer === null
          ? [unitSeg(state, ev.unitId), { text: ' defeated' }]
          : [
              unitSeg(state, ev.unitId),
              { text: ' defeated by ' },
              { text: killer.name, team: killer.team },
            ];
        // Drop unused victim-unit lookup (still in `state.units.get` above
        // because it may report a now-removed unit; segment composes via
        // unitSeg).
        void victimUnit;
        out.push({
          key: `ko-${ev.unitId}-${ev.atSequence}`,
          tag: '[ko]',
          segments,
          text: joinSegments(segments),
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

// Type alias for the `target` field on the charged-context value. Kept
// internal — the union mirrors AbilityTarget's kinds without importing
// the full type.
function chargedContextTarget():
  | { kind: 'unit'; unitId: UnitId }
  | { kind: 'tile'; position: { x: number; y: number } }
  | { kind: 'self' }
  | null {
  return null;
}

function joinSegments(segments: ReadonlyArray<LogSegment>): string {
  let out = '';
  for (const s of segments) out += s.text;
  return out;
}

function unitSeg(state: GameState, id: UnitId): LogSegment {
  const u = state.units.get(id);
  if (u === undefined) return { text: String(id) };
  return { text: u.name, team: u.team };
}

function plain(text: string): LogSegment {
  return { text };
}

type ChargedCtx = ReturnType<typeof chargedContextTarget> extends infer _T
  ? {
      abilityId: AbilityId;
      casterId: UnitId | null;
      target: Exclude<ReturnType<typeof chargedContextTarget>, null> | null;
    }
  : never;

function formatAction(
  action: Action,
  state: GameState,
  catalog: Catalog,
  currentTNumber: number,
  chargedContext: ReadonlyMap<string, ChargedCtx>,
): ReadonlyArray<LogRow> {
  const key = String(action.sequenceNumber);
  const seq = action.sequenceNumber;
  const participants = deriveActionParticipants(action);

  function row(opts: {
    readonly tag: string | null;
    readonly segments: ReadonlyArray<LogSegment>;
    readonly indent: boolean;
    readonly tagKind: LogRow['tagKind'];
  }): LogRow {
    return {
      key,
      tag: opts.tag,
      segments: opts.segments,
      text: joinSegments(opts.segments),
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
      const skipped = action.outcome?.skipped ? ' (skipped)' : '';
      const segments: LogSegment[] = [unitSeg(state, action.payload.unitId)];
      if (cls !== '') segments.push(plain(` (${cls})`));
      if (skipped !== '') segments.push(plain(skipped));
      return [row({ tag, segments, indent: false, tagKind: 'turn' })];
    }

    case 'turn_end':
      // Turn ends close a group implicitly; no row needed.
      return [];

    case 'move': {
      const dest = action.payload.destination;
      return [row({
        tag: null,
        segments: [plain(`→ Moved to (${dest.x}, ${dest.y})`)],
        indent: true,
        tagKind: null,
      })];
    }

    case 'use_ability':
      return formatUseAbility(action, state, catalog, row);

    case 'use_compound': {
      // Session 39b. "Beowulf prepared a Potion (2 on hand)".
      const itemName = safeItemName(catalog, action.payload.itemId);
      const stock = action.outcome?.stockpileAfter ?? 0;
      const mpSpent = action.outcome?.mpSpent ?? 0;
      const segments: LogSegment[] = [];
      if (action.actorId !== undefined) {
        segments.push(unitSeg(state, action.actorId));
        segments.push(plain(` prepared a ${itemName}`));
      } else {
        segments.push(plain(`Prepared a ${itemName}`));
      }
      segments.push(plain(` · ${mpSpent} MP · ${stock} on hand`));
      return [row({ tag: formatT(currentTNumber), segments, indent: false, tagKind: 'turn' })];
    }

    case 'use_throw_item': {
      // Session 39b. "Beowulf threw a Potion at Marach for 96 HP" /
      // "Beowulf threw a Phoenix Down at Marach (revived)" /
      // "Beowulf threw a Remedy at Marach". The per-target result's
      // `healing` populates the HP-restore amount; revival isn't
      // surfaced in healing alone (the revive baseline +1 is excluded
      // from `healing`), so we annotate explicitly when the unit was
      // KO'd before the throw and is alive after.
      const itemName = safeItemName(catalog, action.payload.itemId);
      const segments: LogSegment[] = [];
      if (action.actorId !== undefined) {
        segments.push(unitSeg(state, action.actorId));
        segments.push(plain(` threw a ${itemName} at `));
      } else {
        segments.push(plain(`${itemName} thrown at `));
      }
      const target = action.payload.target;
      if (target.kind === 'unit') {
        segments.push(unitSeg(state, target.unitId));
      } else if (target.kind === 'tile') {
        segments.push(plain(`(${target.position.x}, ${target.position.y})`));
      }
      const r = action.outcome?.perTargetResults[0];
      if (r !== undefined) {
        const heal = r.healing ?? 0;
        if (heal > 0) segments.push(plain(` for ${heal} HP`));
      }
      return [row({ tag: formatT(currentTNumber), segments, indent: false, tagKind: 'turn' })];
    }

    case 'wait':
      return [row({ tag: null, segments: [plain('→ Waited')], indent: true, tagKind: null })];

    case 'set_facing':
      return []; // no row — internal bookkeeping

    case 'charged_action_resolve': {
      const id = action.payload.chargedActionId;
      const ctx = chargedContext.get(String(id));
      const abilityName = ctx !== undefined
        ? safeAbilityName(catalog, ctx.abilityId)
        : String(id);
      const tag = formatT(currentTNumber);
      const perTarget = action.outcome?.perTargetResults ?? [];

      const segments: LogSegment[] = [];
      if (ctx?.casterId !== undefined && ctx.casterId !== null) {
        segments.push(unitSeg(state, ctx.casterId));
        segments.push(plain(`'s ${abilityName}`));
      } else {
        segments.push(plain(abilityName));
      }
      // Session 25: target slot. Unit target → "<Target>"; tile target →
      // "(x, y)". Self-target collapses (the caster IS the target).
      if (ctx?.target !== undefined && ctx.target !== null) {
        if (ctx.target.kind === 'unit') {
          segments.push(plain(' resolves on '));
          segments.push(unitSeg(state, ctx.target.unitId));
        } else if (ctx.target.kind === 'tile') {
          segments.push(plain(` resolves on (${ctx.target.position.x}, ${ctx.target.position.y})`));
        } else {
          segments.push(plain(' resolves'));
        }
      } else {
        segments.push(plain(' resolves'));
      }
      if (perTarget.length === 0) {
        // no outcome detail beyond the heading
      } else {
        segments.push(plain(': '));
        let first = true;
        for (const r of perTarget) {
          if (!first) segments.push(plain('; '));
          first = false;
          for (const s of targetResultSegments(r, state)) segments.push(s);
        }
      }
      return [row({ tag, segments, indent: false, tagKind: 'turn' })];
    }

    case 'status_tick': {
      const statusName = safeStatusName(catalog, action.payload.statusTypeId);
      const segments: LogSegment[] = [
        plain(`${statusName} ticked on `),
        unitSeg(state, action.payload.unitId),
      ];
      if (action.outcome?.removed) segments.push(plain(' (cleared)'));
      return [row({ tag: '[tick]', segments, indent: true, tagKind: 'system' })];
    }

    case 'system_damage': {
      const applied = action.outcome?.applied ?? action.payload.amount;
      const source = action.payload.source;
      // Session 37: revenge attributions get a dedicated tag + attribution
      // string ("from <wearer>'s <item>") rather than the generic
      // "(source: revenge)" form, since the wearer + item are the
      // semantic origin of the damage.
      if (source.kind === 'revenge') {
        const itemName = safeItemName(catalog, source.itemId);
        const segments: LogSegment[] = [
          unitSeg(state, action.payload.targetId),
          plain(` took ${applied} dmg from `),
          unitSeg(state, source.wearerId),
          plain(`'s ${itemName}`),
        ];
        return [row({ tag: '[revenge]', segments, indent: true, tagKind: 'system' })];
      }
      const segments: LogSegment[] = [
        unitSeg(state, action.payload.targetId),
        plain(` took ${applied} dmg (${formatDamageSource(source)})`),
      ];
      return [row({ tag: '[tick]', segments, indent: true, tagKind: 'system' })];
    }

    case 'system_heal': {
      const applied = action.outcome?.applied ?? action.payload.amount;
      const segments: LogSegment[] = [
        unitSeg(state, action.payload.targetId),
        plain(` healed ${applied} HP`),
      ];
      return [row({ tag: '[tick]', segments, indent: true, tagKind: 'system' })];
    }

    case 'system_apply_status': {
      const statusName = safeStatusName(catalog, action.payload.statusTypeId);
      const result = action.outcome?.result;
      const verb = result === undefined ? 'attempted' : classifyStatusOutcome(result).label;
      // Session 32 / ADR-0071: pre-battle equipment grants render with
      // item attribution ("Tintinibar grants Regen to Blue Knight") and
      // an [init] tag so the action log distinguishes setup-phase
      // applies from in-battle status emissions.
      const context = action.payload.context;
      if (context !== undefined && context.kind === 'pre_battle_equipment') {
        const itemName = safeItemName(catalog, context.itemId);
        const segments: LogSegment[] = [
          plain(`${itemName} grants ${statusName} to `),
          unitSeg(state, action.payload.targetId),
        ];
        return [row({ tag: '[init]', segments, indent: false, tagKind: 'system' })];
      }
      const segments: LogSegment[] = [
        plain(`${statusName} ${verb} on `),
        unitSeg(state, action.payload.targetId),
      ];
      return [row({ tag: '[tick]', segments, indent: true, tagKind: 'system' })];
    }

    case 'system_ct_push': {
      const delta = action.outcome?.applied ?? action.payload.delta;
      const sign = delta >= 0 ? '+' : '';
      const segments: LogSegment[] = [
        unitSeg(state, action.payload.targetId),
        plain(` CT ${sign}${delta}`),
      ];
      return [row({ tag: '[tick]', segments, indent: true, tagKind: 'system' })];
    }

    case 'system_set_ct': {
      // Session 32 / ADR-0071: emitted once per unit during the
      // orchestrator's pre-battle phase, recording the ruleset-derived
      // initial CT randomization into the action log. [init] tag.
      const ct = action.outcome?.ct ?? action.payload.ct;
      const segments: LogSegment[] = [
        unitSeg(state, action.payload.targetId),
        plain(` enters battle at CT ${ct}`),
      ];
      return [row({ tag: '[init]', segments, indent: false, tagKind: 'system' })];
    }

    case 'system_mp_restore': {
      // Session 39b. Ether's restore lands here as a child of the
      // parent use_throw_item entry. Skip when applied is 0 (KO'd
      // target or maxed-out MP — noise).
      const applied = action.outcome?.applied ?? action.payload.amount;
      if (applied === 0) return [];
      const segments: LogSegment[] = [
        unitSeg(state, action.payload.targetId),
        plain(` recovered ${applied} MP`),
      ];
      return [row({ tag: '[tick]', segments, indent: true, tagKind: 'system' })];
    }

    case 'system_ko_tick': {
      // Session 39b. "Marach (KO, 1/3)" / "Marach (KO, 2/3)" / last
      // tick before removal is recorded as "(KO, 3/3 — fading)" with
      // the queued system_unit_removed following.
      const after = action.outcome?.turnsKOdAfter ?? 0;
      const removalQueued = action.outcome?.removalQueued ?? false;
      const segments: LogSegment[] = [
        unitSeg(state, action.payload.targetId),
        plain(removalQueued ? ` (KO, ${after} — fading)` : ` (KO, ${after})`),
      ];
      return [row({ tag: '[tick]', segments, indent: true, tagKind: 'system' })];
    }

    case 'system_unit_removed': {
      // Session 39b. Terminal — "Marach removed from battle."
      const segments: LogSegment[] = [
        unitSeg(state, action.payload.targetId),
        plain(' removed from battle'),
      ];
      return [row({ tag: '[end]', segments, indent: false, tagKind: 'system' })];
    }

    case 'system_mp_drain': {
      // Per ADR-0065 (Session 30 substrate, Session 31 first consumer
      // via Rasp Pendant): MP transfer event. The outcome records two
      // applied values — `targetApplied` (what the target lost) and
      // `sourceApplied` (what the source gained); they can differ when
      // the source's MP headroom is below the target's loss. Skip the
      // log entry entirely when both applied values are zero (KO'd
      // target / source, or rounded-down drain) — those are noise.
      const t = action.outcome?.targetApplied ?? 0;
      const s = action.outcome?.sourceApplied ?? 0;
      if (t === 0 && s === 0) return [];
      const segments: LogSegment[] = [
        unitSeg(state, action.payload.source),
        plain(` drained ${t} MP from `),
        unitSeg(state, action.payload.target),
      ];
      if (s < t) segments.push(plain(` (${t - s} lost to MP cap)`));
      return [row({ tag: '[tick]', segments, indent: true, tagKind: 'system' })];
    }

    case 'status_remove': {
      if (action.outcome?.removed === false) return []; // no-op removals are noise
      const statusName = safeStatusName(catalog, action.payload.statusTypeId);
      const segments: LogSegment[] = [
        plain(`${statusName} removed from `),
        unitSeg(state, action.payload.targetId),
      ];
      return [row({ tag: '[tick]', segments, indent: true, tagKind: 'system' })];
    }

    case 'status_decrement_stack': {
      if (action.outcome?.newStackCount === undefined) return [];
      const statusName = safeStatusName(catalog, action.payload.statusTypeId);
      const newCount = action.outcome.newStackCount;
      const segments: LogSegment[] = newCount === 0
        ? [plain(`${statusName} cleared from `), unitSeg(state, action.payload.targetId)]
        : [
            plain(`${statusName} on `),
            unitSeg(state, action.payload.targetId),
            plain(` → ×${newCount}`),
          ];
      return [row({ tag: '[tick]', segments, indent: true, tagKind: 'system' })];
    }

    case 'battle_end': {
      const winner = String(action.payload.winner);
      const desc = action.outcome?.description ?? '';
      const text = desc === '' ? `${winner} wins` : `${winner} wins — ${desc}`;
      return [row({ tag: '[end]', segments: [plain(text)], indent: false, tagKind: 'system' })];
    }
    default: {
      // Exhaustiveness check (Session 31 — same gap that crashed the UI
      // when system_mp_drain shipped to v1 content without a formatter
      // case). The `never` cast forces TS-strict to flag a missing case
      // at compile time. Runtime fallback returns an empty row list so a
      // missed case shows nothing rather than crashing React; the build
      // failure is the real load-bearing guarantee.
      const _exhaustive: never = action;
      void _exhaustive;
      return [];
    }
  }
}

function formatUseAbility(
  action: Extract<Action, { type: 'use_ability' }>,
  state: GameState,
  catalog: Catalog,
  row: (opts: {
    readonly tag: string | null;
    readonly segments: ReadonlyArray<LogSegment>;
    readonly indent: boolean;
    readonly tagKind: LogRow['tagKind'];
  }) => LogRow,
): ReadonlyArray<LogRow> {
  const abilityName = safeAbilityName(catalog, action.payload.abilityId);
  const isReaction = action.isReaction;
  const perTarget = action.outcome?.perTargetResults ?? [];
  const tag = isReaction ? '↳' : null;
  const tagKind: LogRow['tagKind'] = isReaction ? 'reaction' : null;

  const actorSegment: LogSegment =
    action.actorId !== undefined ? unitSeg(state, action.actorId) : plain('unit');

  // Charged casts: the per-target results are empty until resolution.
  if (action.outcome?.chargedActionId !== undefined) {
    const segments: LogSegment[] = [actorSegment, plain(` began casting ${abilityName}`)];
    return [row({ tag, segments, indent: true, tagKind })];
  }
  if (perTarget.length === 0) {
    const segments: LogSegment[] = [actorSegment, plain(` → ${abilityName}`)];
    return [row({ tag, segments, indent: true, tagKind })];
  }
  const segments: LogSegment[] = [actorSegment, plain(` → ${abilityName}: `)];
  let first = true;
  for (const r of perTarget) {
    if (!first) segments.push(plain('; '));
    first = false;
    for (const s of targetResultSegments(r, state)) segments.push(s);
  }
  return [row({ tag, segments, indent: true, tagKind })];
}

// Build the segments for a single per-target row entry. Mirrors the old
// `formatTargetResult` string output but tags the target-name segment
// with its team so renderer-side coloring composes.
function targetResultSegments(
  r: import('@engine/index.ts').AbilityTargetResult,
  state: GameState,
): ReadonlyArray<LogSegment> {
  const labelSeg: LogSegment =
    r.target.kind === 'unit'
      ? unitSeg(state, r.target.unitId)
      : r.target.kind === 'tile'
        ? plain(`(${r.target.position.x}, ${r.target.position.y})`)
        : plain('self');
  if (!r.hit) return [labelSeg, plain(' missed')];
  const dmg = r.damage ?? 0;
  const heal = r.healing ?? 0;
  if (heal > 0) {
    // Absorption (per ADR-0057, Session 27): the ability was natively
    // damage but the target's resistance > 100 flipped it to healing.
    // Distinguish from native heals so the log reads honestly.
    if (r.absorbed === true) return [labelSeg, plain(` absorbed ${heal} HP`)];
    return [labelSeg, plain(` +${heal} HP`)];
  }
  if (dmg > 0) return [labelSeg, plain(` ${dmg} dmg`)];
  if (r.statusesApplied !== undefined && r.statusesApplied.length > 0) {
    const appliedCount = r.statusesApplied.filter((s) => classifyStatusOutcome(s).applied).length;
    if (appliedCount > 0) return [labelSeg, plain(` status ×${appliedCount}`)];
    return [labelSeg, plain(' resisted')];
  }
  return [labelSeg];
}

function formatT(n: number): string {
  return `T${String(n).padStart(4, '0')}`;
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

function safeItemName(catalog: Catalog, id: import('@engine/index.ts').ItemId): string {
  try {
    return catalog.getItem(id).name;
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
    case 'revenge':
      // Revenge attributions render via the dedicated `[revenge]` branch
      // in the `system_damage` formatter — this fallback only fires if
      // a future call site uses `formatDamageSource` without the
      // dedicated branch.
      return 'revenge';
  }
}
