// ActionLogPanel — the per-turn events view (Session 63 redesign).
//
// Reads `state.actionLog`, feeds it through `buildLogView`, and renders
// one collapsible block per turn. By default each turn shows its **events**
// only (the icon-gutter top line); the per-turn **ledger** — CT/MP/HP
// regen, status countdowns, KO timers, non-firing reactions — is collapsed
// behind the turn header. A header click toggles that turn's ledger; the
// global "Show ledger" toggle reveals them all. Nothing is dropped: every
// log row is either an event or a ledger entry, so the full mechanical
// trace stays available (replay/audit completeness).
//
// The flat `[tick]/[end]/[ko]` text tags are gone — significance is carried
// by an icon gutter, weight, and color, with the kill line emphasized.
// KO countdowns no longer appear as log lines; they render on the unit
// (map sprite + detail panel), so the per-tick rows live in the ledger.
//
// Retained from before: newest-at-bottom auto-scroll, and hovering an event
// row reports its participants for the on-canvas hover-counterpart pulse.

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
} from 'react';
import type { Catalog, GameState, TeamId, UnitId } from '@engine/index.ts';
import {
  buildLogView,
  type LogIcon,
  type LogRow,
  type LogSegment,
  type TurnGroup,
} from './action-log-format.ts';

// Per-team text color for unit-name segments + actor-tinted icons. Mirrors
// the renderer's TEAM_COLORS and the queue-tower's border palette so the
// log visually pairs with the canvas + tower.
const TEAM_TEXT_COLORS: Readonly<Record<string, string>> = {
  team_a: '#7eb6ec',
  team_b: '#e07866',
};
function teamTextColor(team: TeamId | undefined): string | undefined {
  if (team === undefined) return undefined;
  return TEAM_TEXT_COLORS[team];
}

const COLOR_KO = '#f0635a';
const COLOR_GOLD = '#e3b341';
const COLOR_STATUS = '#e3a14a';
const COLOR_DIM = '#7a828e';

export interface ActionLogPanelProps {
  readonly state: GameState | null;
  readonly catalog: Catalog;
  // Called whenever the hovered row changes. Receives the row's actor
  // and target IDs (empty array when no row is hovered). Consumer
  // typically forwards to a renderer's `setCounterpartUnits`.
  readonly onHoverParticipants?: ((ids: ReadonlyArray<UnitId>) => void) | undefined;
}

export function ActionLogPanel({
  state,
  catalog,
  onHoverParticipants,
}: ActionLogPanelProps): ReactElement {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef<boolean>(true);
  // Per-turn ledger expansion (by group key) + the global "show all" toggle.
  const [expandedGroups, setExpandedGroups] = useState<ReadonlySet<string>>(new Set());
  const [showAllLedgers, setShowAllLedgers] = useState<boolean>(false);

  const view = state === null ? null : buildLogView(state.actionLog, state, catalog);

  // Auto-scroll on append when the user is parked at the bottom. Keyed on
  // the raw log length so a new action (event or ledger) re-pins.
  const logLength = state?.actionLog.length ?? 0;
  useEffect(() => {
    const el = scrollRef.current;
    if (el === null) return;
    if (stickToBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [logLength, showAllLedgers]);

  // On unmount, clear any counterpart highlight so it doesn't outlive the panel.
  useEffect(() => {
    return () => {
      if (onHoverParticipants !== undefined) onHoverParticipants([]);
    };
  }, [onHoverParticipants]);

  function onScroll(e: React.UIEvent<HTMLDivElement>): void {
    const el = e.currentTarget;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceFromBottom < 8;
  }

  function toggleGroup(key: string): void {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleHover(row: LogRow | null): void {
    if (onHoverParticipants === undefined) return;
    if (row === null) {
      onHoverParticipants([]);
      return;
    }
    const ids: UnitId[] = [];
    if (row.participants.actorId !== null) ids.push(row.participants.actorId);
    for (const t of row.participants.targetIds) {
      if (!ids.includes(t)) ids.push(t);
    }
    onHoverParticipants(ids);
  }

  const isEmpty =
    view === null ||
    (view.groups.length === 0 && view.preamble.length === 0 && view.outro.length === 0);

  return (
    <aside style={panelStyle} aria-label="Action log">
      <div style={headerRowStyle}>
        <span style={headerLabelStyle}>Action Log</span>
        {!isEmpty && (
          <button
            type="button"
            style={toggleButtonStyle}
            onClick={() => setShowAllLedgers((v) => !v)}
          >
            {showAllLedgers ? 'Events only' : 'Show ledger'}
          </button>
        )}
      </div>
      <div style={listScrollStyle} ref={scrollRef} onScroll={onScroll}>
        {isEmpty || view === null ? (
          <div style={emptyStyle}>(no actions yet)</div>
        ) : (
          <>
            {view.preamble.length > 0 && (
              <SetupGroup
                rows={view.preamble}
                open={showAllLedgers || expandedGroups.has('setup')}
                onToggle={() => toggleGroup('setup')}
              />
            )}
            {view.groups.map((g) => (
              <TurnBlock
                key={g.key}
                group={g}
                state={state}
                open={showAllLedgers || expandedGroups.has(g.key)}
                onToggle={() => toggleGroup(g.key)}
                onHoverRow={handleHover}
              />
            ))}
            {view.outro.map((r) => (
              <EventRowView key={r.key} row={r} state={state} onHover={handleHover} />
            ))}
          </>
        )}
      </div>
    </aside>
  );
}

function TurnBlock(props: {
  readonly group: TurnGroup;
  readonly state: GameState | null;
  readonly open: boolean;
  readonly onToggle: () => void;
  readonly onHoverRow: (row: LogRow | null) => void;
}): ReactElement {
  const { group, state, open, onToggle, onHoverRow } = props;
  const hasLedger = group.ledger.length > 0;
  return (
    <div style={turnBlockStyle}>
      <div
        style={turnHeadStyle(hasLedger)}
        onClick={hasLedger ? onToggle : undefined}
      >
        <span style={chevronStyle(open, hasLedger)}>▾</span>
        {group.tLabel !== '' && <span style={tLabelStyle}>{group.tLabel}</span>}
        <span style={headerTextStyle}>
          {group.headerSegments.map((s, i) => (
            <SegmentSpan key={i} segment={s} />
          ))}
        </span>
      </div>
      {group.events.map((r) => (
        <EventRowView key={r.key} row={r} state={state} onHover={onHoverRow} />
      ))}
      {open && hasLedger && <LedgerLine rows={group.ledger} />}
    </div>
  );
}

// Pre-battle setup rows (equipment grants, initial CT) as a collapsed group.
function SetupGroup(props: {
  readonly rows: ReadonlyArray<LogRow>;
  readonly open: boolean;
  readonly onToggle: () => void;
}): ReactElement {
  const { rows, open, onToggle } = props;
  return (
    <div style={turnBlockStyle}>
      <div style={turnHeadStyle(true)} onClick={onToggle}>
        <span style={chevronStyle(open, true)}>▾</span>
        <span style={headerTextStyle}>
          <span style={{ color: COLOR_DIM }}>Setup</span>
        </span>
      </div>
      {open && <LedgerLine rows={rows} />}
    </div>
  );
}

function EventRowView(props: {
  readonly row: LogRow;
  readonly state: GameState | null;
  readonly onHover: (row: LogRow | null) => void;
}): ReactElement {
  const { row, state, onHover } = props;
  return (
    <div
      style={eventRowStyle(row.emphasis)}
      onMouseEnter={() => onHover(row)}
      onMouseLeave={() => onHover(null)}
    >
      <span style={iconGutterStyle}>
        {row.icon !== null && <IconGlyph icon={row.icon} color={iconColor(row, state)} />}
      </span>
      <span style={eventTextStyle(row.emphasis)}>
        {row.segments.map((s, i) => (
          <SegmentSpan key={i} segment={s} />
        ))}
      </span>
    </div>
  );
}

// The per-turn ledger: a single muted line joining the state rows' text.
function LedgerLine({ rows }: { readonly rows: ReadonlyArray<LogRow> }): ReactElement {
  return <div style={ledgerStyle}>{rows.map((r) => r.text).join(' · ')}</div>;
}

// Inline span renderer for a single log segment. Applies team-color
// styling when the segment carries a `team` field; otherwise inherits the
// row's default text color. Per ADR-0051.
function SegmentSpan({ segment }: { readonly segment: LogSegment }): ReactElement {
  const color = teamTextColor(segment.team);
  if (color === undefined) return <>{segment.text}</> as unknown as ReactElement;
  return <span style={{ color, fontWeight: 500 }}>{segment.text}</span>;
}

// Resolve an icon's tint. Team-driven for actor-centric icons (attack,
// ability); fixed for the semantic ones (status, KO, victory, move).
function iconColor(row: LogRow, state: GameState | null): string {
  switch (row.icon) {
    case 'skull':
      return COLOR_KO;
    case 'trophy':
      return COLOR_GOLD;
    case 'flame':
      return COLOR_STATUS;
    case 'arrow':
      return COLOR_DIM;
    case 'sword':
    case 'spark': {
      const actorId = row.participants.actorId;
      const team = actorId !== null ? state?.units.get(actorId)?.team : undefined;
      return teamTextColor(team) ?? COLOR_DIM;
    }
    default:
      return COLOR_DIM;
  }
}

// --- icon glyphs (concept symbol set; small by design) ---

function IconGlyph({ icon, color }: { readonly icon: LogIcon; readonly color: string }): ReactElement {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'block' }}
      aria-hidden="true"
    >
      {ICON_PATHS[icon]}
    </svg>
  );
}

const ICON_PATHS: Readonly<Record<LogIcon, ReactElement>> = {
  sword: (
    <>
      <path d="M14.5 17.5 L3 6 V3 H6 L17.5 14.5" />
      <path d="M13 19 L19 13" />
      <path d="M16 16 L20.5 20.5" />
    </>
  ),
  spark: <path d="M12 3 L13.7 9.3 L20 11 L13.7 12.7 L12 19 L10.3 12.7 L4 11 L10.3 9.3 Z" />,
  flame: (
    <path d="M12 3 c1.5 3.5 5 5 5 9 a5 5 0 0 1 -10 0 c0 -2 1 -3.5 2.2 -4.3 c-.2 1.8 .6 2.8 1.8 3.3 c-.6 -3 -1.5 -4.5 1 -8 Z" />
  ),
  arrow: (
    <>
      <path d="M4 12 H20" />
      <path d="M14 6 L20 12 L14 18" />
    </>
  ),
  skull: (
    <>
      <path d="M12 3 a8 8 0 0 0 -8 8 c0 3 1.8 5 3.8 6 v3 h8.4 v-3 c2 -1 3.8 -3 3.8 -6 a8 8 0 0 0 -8 -8 Z" />
      <circle cx="9" cy="11.5" r="1.5" />
      <circle cx="15" cy="11.5" r="1.5" />
      <path d="M11 17 v2.6 M13 17 v2.6" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 4 H16 V9 a4 4 0 0 1 -8 0 Z" />
      <path d="M8 5.5 H5.2 a1.8 1.8 0 0 0 0 3.6 H8.5" />
      <path d="M16 5.5 H18.8 a1.8 1.8 0 0 1 0 3.6 H15.5" />
      <path d="M12 13 V16.5" />
      <path d="M9.5 20 H14.5" />
      <path d="M10 16.5 H14 V20 H10 Z" />
    </>
  ),
};

// ---- styles ----

const panelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  height: '100%',
  pointerEvents: 'auto',
  fontFamily: 'system-ui, sans-serif',
  color: '#e7e9ee',
  minHeight: 0,
};

const headerRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
};

const headerLabelStyle: CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  opacity: 0.65,
};

const toggleButtonStyle: CSSProperties = {
  font: 'inherit',
  fontSize: 11,
  color: '#cfd6df',
  background: 'transparent',
  border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: 6,
  padding: '2px 8px',
  cursor: 'pointer',
};

const listScrollStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  paddingRight: 4,
};

const emptyStyle: CSSProperties = {
  fontSize: 12,
  opacity: 0.45,
  fontStyle: 'italic',
};

const turnBlockStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 1,
};

const turnHeadStyle = (clickable: boolean): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 13,
  padding: '4px 2px 1px',
  cursor: clickable ? 'pointer' : 'default',
});

const chevronStyle = (open: boolean, visible: boolean): CSSProperties => ({
  fontSize: 10,
  width: 10,
  flexShrink: 0,
  color: COLOR_DIM,
  opacity: visible ? 0.8 : 0,
  transform: open ? 'none' : 'rotate(-90deg)',
  transition: 'transform 0.12s',
});

const tLabelStyle: CSSProperties = {
  fontSize: 12,
  fontVariantNumeric: 'tabular-nums',
  fontWeight: 600,
  color: COLOR_GOLD,
  flexShrink: 0,
};

const headerTextStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  minWidth: 0,
  wordBreak: 'break-word',
};

const eventRowStyle = (emphasis: boolean): CSSProperties => ({
  display: 'flex',
  gap: 8,
  alignItems: 'flex-start',
  padding: emphasis ? '2px 4px 2px 6px' : '1px 4px 1px 6px',
  ...(emphasis
    ? { background: 'rgba(240,99,90,0.12)', borderRadius: 6 }
    : {}),
});

const iconGutterStyle: CSSProperties = {
  width: 15,
  flexShrink: 0,
  display: 'flex',
  justifyContent: 'center',
  paddingTop: 2,
};

const eventTextStyle = (emphasis: boolean): CSSProperties => ({
  flex: 1,
  minWidth: 0,
  wordBreak: 'break-word',
  fontSize: emphasis ? 14 : 12.5,
  fontWeight: emphasis ? 600 : 400,
  lineHeight: 1.4,
  ...(emphasis ? { color: COLOR_KO } : {}),
});

const ledgerStyle: CSSProperties = {
  fontSize: 11,
  color: COLOR_DIM,
  lineHeight: 1.6,
  padding: '2px 6px 4px 29px',
  wordBreak: 'break-word',
};
