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

// Session 63 action-log redesign. The small icon vocabulary that replaces
// the `[tick]/[end]/[ko]` text tags in the events view. Kept deliberately
// small (per the brief's icon-discipline watch-for); rare events stay
// textual with `icon: null`.
export type LogIcon =
  | 'sword' // basic attack
  | 'spark' // ability / charged resolve / reaction / item
  | 'flame' // status landing / damaging status tick (Burn)
  | 'arrow' // move / falling damage
  | 'skull' // KO / fade
  | 'trophy'; // victory

// Session 63: the events-vs-state cut. `event` rows show on the top line by
// default; `state` rows are bookkeeping that already lives on the unit
// cards / queue / status badges, collapsed into the per-turn ledger.
export type LogCategory = 'event' | 'state';

export interface LogRow {
  // Stable key for React reconciliation.
  readonly key: string;
  // Optional left-side tag (T####, [tick], etc). Retained for the flat
  // `formatActionLog` API + its tests; the grouped events view
  // (`buildLogView`) renders icons/weight instead of these text tags.
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
  // Session 63: events-vs-state classification. `state` rows default-hide
  // into the per-turn ledger; `event` rows stay on the top line.
  readonly category: LogCategory;
  // Session 63: icon-gutter glyph for the events view. `null` → no icon
  // (rare/textual events, ledger rows).
  readonly icon: LogIcon | null;
  // Session 63: visual emphasis for the climax of a turn — set on a kill
  // line (large weight + danger tint). The renderer reads it; the flat
  // API leaves it `false` for non-kill rows.
  readonly emphasis: boolean;
}

// A log row's displayed T-number advances on each turn boundary AND each
// charged-action resolve (Chris's playtest call: a resolve gets its own
// T-number, rendered as a top-level T#### row). Single source of truth so
// the results screen's "Battle ended on turn T####" matches the last
// action-log row instead of re-deriving it — the two had drifted (the
// results screen counted only turn_start, undercounting every battle with
// a charged spell).
export function advancesTurnNumber(action: Action): boolean {
  return action.type === 'turn_start' || action.type === 'charged_action_resolve';
}

// The T-number of the final action-log row — i.e. how many T#### headers
// the log produced. Equals the `tNumber` the formatter reaches on its last
// row (tNumber only ever increments).
export function finalTurnNumber(log: ReadonlyArray<Action>): number {
  let n = 0;
  for (const action of log) if (advancesTurnNumber(action)) n += 1;
  return n;
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
    // than an indented [charged] row. Shared predicate so the results
    // screen's end-of-battle count can't drift from this.
    if (advancesTurnNumber(action)) tNumber += 1;
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
          // Session 63: a KO is the climax of a turn — event, skull icon,
          // emphasized. `buildLogView` folds this into the killing-blow row
          // when one shares its sequence; otherwise it stands alone.
          category: 'event',
          icon: 'skull',
          emphasis: true,
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

// Per-action JP the ACTOR earns — mirrors the campaign's `defaultJpBase`
// (`floor(10 + level/4)`). Duplicated rather than imported: the action log is
// core UI and must not depend on the campaign shell. `action-log-format.test.ts`
// pins this in sync with `defaultJpBase`.
export function uiJpBase(level: number): number {
  return Math.floor(10 + level / 4);
}

function teamIsHuman(state: GameState, team: TeamId): boolean {
  return state.teams.some((t) => t.id === team && t.control === 'human');
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
  // Session 63: default events-vs-state class + icon for this action type.
  // A row() call may override either (e.g. a status-tick `system_damage`
  // promotes itself to a Burn event); otherwise it inherits these.
  const cls = categorize(action, catalog);

  function row(opts: {
    readonly tag: string | null;
    readonly segments: ReadonlyArray<LogSegment>;
    readonly indent: boolean;
    readonly tagKind: LogRow['tagKind'];
    readonly category?: LogCategory;
    readonly icon?: LogIcon | null;
    readonly emphasis?: boolean;
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
      category: opts.category ?? cls.category,
      icon: 'icon' in opts ? opts.icon ?? null : cls.icon,
      emphasis: opts.emphasis ?? false,
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
      if (source.kind === 'status_tick') {
        // Session 63: consolidated DoT event — "Burn → Tina 9". The bare
        // "Burn ticked / cleared" status_tick row (and any stack decrement)
        // stays in the ledger, so the damage reads as a single event.
        const statusName = safeStatusName(catalog, source.statusTypeId);
        const segments: LogSegment[] = [
          plain(`${statusName} → `),
          unitSeg(state, action.payload.targetId),
          plain(` ${applied}`),
        ];
        return [row({ tag: '[tick]', segments, indent: false, tagKind: 'system' })];
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

    case 'system_cover_redirect': {
      // TABA Seam 2: "Chris covers Ally (−N)" — the mitigated HP the bearer soaked.
      const soaked = action.outcome?.damageDealt ?? 0;
      const segments: LogSegment[] = [
        unitSeg(state, action.payload.coverId),
        plain(' covers '),
        unitSeg(state, action.payload.coveredId),
        plain(` (−${soaked})`),
      ];
      return [row({ tag: '[cover]', segments, indent: true, tagKind: 'system' })];
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

    case 'system_xp_award': {
      // TABA M2. Two facets from one action:
      //   - a level-up is a ledger EVENT ("Ramza reached Level 26!"), shown for
      //     any leveling unit (player or enemy);
      //   - the XP + JP this connecting action earned show as a collapsed ledger
      //     detail — but only for the PLAYER's units (human team). Enemies level
      //     (they emit XP awards too) but bank no JP (they're not the roster), so
      //     their earn-line is suppressed.
      const levels = action.outcome?.levelsGained ?? 0;
      const uid = action.payload.unitId;
      const actor = state.units.get(uid);
      const rows: LogRow[] = [];

      if (levels > 0) {
        const newLevel = action.outcome?.newLevel ?? 0;
        rows.push(
          row({
            tag: '[level]',
            segments: [
              unitSeg(state, uid),
              plain(levels === 1 ? ` reached Level ${newLevel}!` : ` reached Level ${newLevel}! (+${levels})`),
            ],
            indent: false,
            tagKind: 'system',
            category: 'event',
          }),
        );
      }

      if (actor !== undefined && teamIsHuman(state, actor.team)) {
        rows.push(
          row({
            tag: '[earn]',
            segments: [
              unitSeg(state, uid),
              plain(` earned +${action.payload.amount} XP · +${uiJpBase(actor.level)} JP`),
            ],
            indent: true,
            tagKind: 'system',
            category: 'state',
          }),
        );
      }

      return rows;
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

    case 'system_terrain_change': {
      // Session 53. One row per cast (or revert): how many tiles moved and
      // how many occupants fell. The fall damage itself logs separately via
      // the generated `[fall]` system_damage rows.
      const n = action.outcome?.appliedCount ?? action.payload.tileChanges.length;
      const fellCount = action.outcome?.fallDamageUnitIds.length ?? 0;
      const tileWord = n === 1 ? 'tile' : 'tiles';
      const base = `${n} ${tileWord} reshaped`;
      const text = fellCount > 0 ? `${base} — ${fellCount} fell` : base;
      return [row({ tag: '[terrain]', segments: [plain(text)], indent: true, tagKind: 'system' })];
    }

    case 'system_barrier_change': {
      // Session 53. Barrier spawn / clear (one row per cast or revert).
      const n = action.outcome?.appliedCount ?? action.payload.tileChanges.length;
      const clearing = action.payload.tileChanges.every((c) => c.barrier === null);
      const verb = clearing ? 'cleared' : 'raised';
      const tileWord = n === 1 ? 'barrier' : 'barriers';
      return [
        row({
          tag: '[barrier]',
          segments: [plain(`${n} ${tileWord} ${verb}`)],
          indent: true,
          tagKind: 'system',
        }),
      ];
    }

    case 'system_barrier_damage': {
      // Session 53. A barrier took (precomputed) damage; note destruction.
      const applied = action.outcome?.applied ?? action.payload.amount;
      const destroyed = action.outcome?.destroyed ?? false;
      const text = destroyed ? `barrier destroyed (${applied})` : `barrier −${applied}`;
      return [row({ tag: '[barrier]', segments: [plain(text)], indent: true, tagKind: 'system' })];
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

function isBasicAttack(catalog: Catalog, id: AbilityId): boolean {
  try {
    const ab = catalog.getAbility(id);
    return ab.kind === 'active' && ab.basicAttack === true;
  } catch {
    return false;
  }
}

// Session 63: the events-vs-state cut + icon selection, keyed on action
// type (and a few payload details). Pure classification — `formatAction`
// applies this as the default for every row it produces, overriding only
// where a single action type splits (e.g. a status-tick `system_damage`
// promotes to a Burn event; a pre-battle equipment grant demotes to
// state). See the brief's authoritative events-vs-state mapping.
function categorize(action: Action, catalog: Catalog): {
  readonly category: LogCategory;
  readonly icon: LogIcon | null;
} {
  switch (action.type) {
    case 'turn_start':
      // Rendered as the group header, not an event row.
      return { category: 'event', icon: null };
    case 'move':
      return { category: 'event', icon: 'arrow' };
    case 'wait':
      return { category: 'event', icon: null };
    case 'use_ability':
      return {
        category: 'event',
        icon: isBasicAttack(catalog, action.payload.abilityId) ? 'sword' : 'spark',
      };
    case 'use_compound':
    case 'use_throw_item':
    case 'charged_action_resolve':
      return { category: 'event', icon: 'spark' };
    case 'system_apply_status': {
      // Pre-battle equipment grants are setup bookkeeping.
      const ctx = action.payload.context;
      if (ctx !== undefined && ctx.kind === 'pre_battle_equipment') {
        return { category: 'state', icon: null };
      }
      // Only a status that actually *landed* is a tactical event. A failed
      // application (rejected / resisted / missed) is bookkeeping — notably
      // a reaction that didn't fire (e.g. "Updraft rejected" on a KO'd
      // unit). Route those to the ledger.
      const result = action.outcome?.result;
      if (result !== undefined && !classifyStatusOutcome(result).applied) {
        return { category: 'state', icon: null };
      }
      return { category: 'event', icon: 'flame' };
    }
    case 'system_damage': {
      const kind = action.payload.source.kind;
      if (kind === 'status_tick') return { category: 'event', icon: 'flame' };
      if (kind === 'revenge' || kind === 'reflect') return { category: 'event', icon: 'spark' };
      if (kind === 'falling') return { category: 'event', icon: 'arrow' };
      // ability_self_cost — the caster paying HP; bookkeeping.
      return { category: 'state', icon: null };
    }
    case 'system_cover_redirect':
      // TABA Seam 2: a bearer soaking a redirected hit is a visible event.
      return { category: 'event', icon: 'spark' };
    case 'system_unit_removed':
      return { category: 'event', icon: 'skull' };
    case 'system_xp_award':
      // A level-up is a ledger event; a pure XP gain is hidden bookkeeping.
      return (action.outcome?.levelsGained ?? 0) > 0
        ? { category: 'event', icon: null }
        : { category: 'state', icon: null };
    case 'battle_end':
      return { category: 'event', icon: 'trophy' };
    case 'system_terrain_change':
    case 'system_barrier_change':
    case 'system_barrier_damage':
      // Battlefield-shape changes are tactical events.
      return { category: 'event', icon: null };
    // --- state: bookkeeping already shown on the unit cards / queue /
    // status badges. Default-hidden in the per-turn ledger. ---
    case 'status_tick':
    case 'status_decrement_stack':
    case 'status_remove':
    case 'system_ct_push':
    case 'system_heal':
    case 'system_mp_restore':
    case 'system_mp_drain':
    case 'system_ko_tick':
    case 'system_set_ct':
    case 'turn_end':
    case 'set_facing':
      return { category: 'state', icon: null };
    default: {
      const _exhaustive: never = action;
      void _exhaustive;
      return { category: 'state', icon: null };
    }
  }
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
    case 'reflect':
      // Damage Split's Reaction-triggered reflect (Session 53). Parallel
      // to `revenge`; distinguished in the log as a reflect bounce.
      return 'reflect';
  }
}

// ===== Session 63: grouped events view =====

// A turn's worth of log, split for the events-vs-state display. `events`
// is the top-line stream; `ledger` is the default-hidden bookkeeping
// (CT/MP/HP regen, status countdowns, KO timers, non-firing reactions).
export interface TurnGroup {
  readonly key: string;
  // "T0089"; '' for the pre-battle setup group.
  readonly tLabel: string;
  // The group header: a turn's actor (+ class), or a charged spell's
  // resolution line. Team-tagged like any segment list.
  readonly headerSegments: ReadonlyArray<LogSegment>;
  readonly events: ReadonlyArray<LogRow>;
  readonly ledger: ReadonlyArray<LogRow>;
}

// The full grouped view the panel renders.
export interface LogView {
  // Pre-first-turn setup rows ([init] grants, initial CT) — all state,
  // shown as a collapsed "Setup" group. Empty once a battle is underway.
  readonly preamble: ReadonlyArray<LogRow>;
  readonly groups: ReadonlyArray<TurnGroup>;
  // Trailing standalone events with no owning turn — the victory line.
  readonly outro: ReadonlyArray<LogRow>;
}

interface MutableGroup {
  key: string;
  tLabel: string;
  headerSegments: ReadonlyArray<LogSegment>;
  events: LogRow[];
  ledger: LogRow[];
}

// Wrap the flat `formatActionLog` rows into per-turn groups, each split
// into top-line `events` and a default-hidden `ledger`. Nothing is
// dropped — every flat row lands in exactly one bucket, so the ledger
// preserves the full mechanical trace for replay/audit. Consolidation:
// DoT damage already renders as a single "Burn → X 9" event (its bare
// tick / decrement rows go to the ledger), and a KO is folded into its
// killing-blow row when one shares its sequence (see `foldKills`).
export function buildLogView(
  log: ReadonlyArray<Action>,
  state: GameState,
  catalog: Catalog,
): LogView {
  const flat = formatActionLog(log, state, catalog);
  const actionsBySeq = new Map<number, Action>();
  for (const a of log) actionsBySeq.set(a.sequenceNumber, a);

  const preamble: LogRow[] = [];
  const outro: LogRow[] = [];
  const groups: MutableGroup[] = [];
  let current: MutableGroup | null = null;

  const flush = (): void => {
    if (current !== null) groups.push(current);
    current = null;
  };

  for (const r of flat) {
    const type = r.actionSeq !== null ? actionsBySeq.get(r.actionSeq)?.type : undefined;
    // A turn header: turn_start, or a charged-action resolve (its own
    // T-number). `tagKind === 'turn'` excludes a [ko] row that happens to
    // share a resolve's sequence (it carries tagKind 'ko').
    if (r.tagKind === 'turn' && (type === 'turn_start' || type === 'charged_action_resolve')) {
      flush();
      current = {
        key: `g-${r.actionSeq ?? r.key}`,
        tLabel: r.tag ?? '',
        headerSegments: r.segments,
        events: [],
        ledger: [],
      };
      continue;
    }
    if (type === 'battle_end') {
      outro.push(r);
      continue;
    }
    if (current === null) {
      preamble.push(r); // pre-first-turn setup (all state)
      continue;
    }
    (r.category === 'event' ? current.events : current.ledger).push(r);
  }
  flush();

  return {
    preamble,
    groups: groups.map((g) => ({
      key: g.key,
      tLabel: g.tLabel,
      headerSegments: g.headerSegments,
      events: foldKills(g.events),
      ledger: g.ledger,
    })),
    outro,
  };
}

// Fold each [ko] row into the killing-blow event that shares its sequence
// (an ability/attack/reaction row naming the same victim), emphasizing it
// and appending a "— KO" marker. A KO with no such sibling (system-dealt:
// a Burn tick, falling damage) stays as its own skull event, in place.
function foldKills(events: ReadonlyArray<LogRow>): ReadonlyArray<LogRow> {
  const koRows = events.filter((r) => r.tagKind === 'ko');
  if (koRows.length === 0) return events;
  const folded = new Set<string>();
  const out: LogRow[] = [];
  for (const r of events) {
    if (r.tagKind === 'ko') {
      if (!folded.has(r.key)) out.push(r); // unfolded → standalone skull
      continue;
    }
    const isBlow = r.tagKind === null || r.tagKind === 'reaction';
    const ko = isBlow
      ? koRows.find(
          (k) =>
            !folded.has(k.key) &&
            k.actionSeq === r.actionSeq &&
            k.participants.targetIds.some((t) => r.participants.targetIds.includes(t)),
        )
      : undefined;
    if (ko !== undefined) {
      folded.add(ko.key);
      const segments: LogSegment[] = [...r.segments, plain('  — KO')];
      out.push({ ...r, segments, text: joinSegments(segments), emphasis: true });
    } else {
      out.push(r);
    }
  }
  return out;
}
