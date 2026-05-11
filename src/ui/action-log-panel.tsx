// ActionLogPanel — streaming list of formatted log rows.
//
// Renders into the right region of the 4-region HUD shell. Reads
// `state.actionLog` and feeds it through `formatActionLog` to produce
// rows; renders them top-to-bottom with newest at the bottom and
// auto-scrolls on append (unless the user has manually scrolled up).
//
// Session 24 additions:
//   - Click row → expand to show outcome detail; click again to collapse.
//     Multiple expanded rows allowed simultaneously.
//   - Hover row → callback with the row's participants for the canvas
//     hover-counterpart pulse. Hover off → callback with empty set.

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement } from 'react';
import type { Action, Catalog, GameState, UnitId } from '@engine/index.ts';
import { formatActionLog, type LogRow } from './action-log-format.ts';

export interface ActionLogPanelProps {
  readonly state: GameState | null;
  readonly catalog: Catalog;
  // Called whenever the hovered row changes. Receives the row's actor
  // and target IDs (empty array when no row is hovered). Consumer
  // typically forwards to a renderer's `setCounterpartUnits`.
  readonly onHoverParticipants?: (ids: ReadonlyArray<UnitId>) => void;
}

export function ActionLogPanel({ state, catalog, onHoverParticipants }: ActionLogPanelProps): ReactElement {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef<boolean>(true);
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set());

  const rows: ReadonlyArray<LogRow> = state === null ? [] : formatActionLog(state.actionLog, state, catalog);
  // Quick-lookup: actionSeq → Action, for the expanded view.
  const actionsBySeq = useMemo(() => {
    const m = new Map<number, Action>();
    if (state !== null) {
      for (const a of state.actionLog) m.set(a.sequenceNumber, a);
    }
    return m;
  }, [state]);

  // Auto-scroll on append when user is parked at the bottom. When the
  // user scrolls up, the wheel handler flips stickToBottom off; scrolling
  // back to within a few px of the bottom re-enables it.
  useEffect(() => {
    const el = scrollRef.current;
    if (el === null) return;
    if (stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [rows.length]);

  // On unmount, clear any counterpart highlight so it doesn't outlive
  // the panel.
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

  function toggleExpanded(seq: number): void {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(seq)) next.delete(seq);
      else next.add(seq);
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

  return (
    <aside style={panelStyle} aria-label="Action log">
      <div style={headerStyle}>Action Log</div>
      <div style={listScrollStyle} ref={scrollRef} onScroll={onScroll}>
        {rows.length === 0 ? (
          <div style={emptyStyle}>(no actions yet)</div>
        ) : (
          rows.map((row) => {
            const seq = row.actionSeq;
            const isExpandable = seq !== null && actionsBySeq.has(seq);
            const isExpanded = seq !== null && expanded.has(seq);
            return (
              <RowView
                key={row.key}
                row={row}
                isExpandable={isExpandable}
                isExpanded={isExpanded}
                onToggle={() => seq !== null && toggleExpanded(seq)}
                onHoverEnter={() => handleHover(row)}
                onHoverLeave={() => handleHover(null)}
                detail={isExpanded && seq !== null ? actionsBySeq.get(seq) : undefined}
                state={state}
              />
            );
          })
        )}
      </div>
    </aside>
  );
}

function RowView(props: {
  readonly row: LogRow;
  readonly isExpandable: boolean;
  readonly isExpanded: boolean;
  readonly onToggle: () => void;
  readonly onHoverEnter: () => void;
  readonly onHoverLeave: () => void;
  readonly detail?: Action;
  readonly state: GameState | null;
}): ReactElement {
  const { row, isExpandable, isExpanded, onToggle, onHoverEnter, onHoverLeave, detail, state } = props;
  return (
    <div
      style={rowContainerStyle(row.indent, isExpandable)}
      onClick={isExpandable ? onToggle : undefined}
      onMouseEnter={onHoverEnter}
      onMouseLeave={onHoverLeave}
    >
      <div style={rowStyle(row.indent)}>
        {row.tag !== null && <span style={tagStyle(row.tagKind)}>{row.tag}</span>}
        <span style={textStyle}>{row.text}</span>
        {isExpandable && (
          <span style={chevronStyle}>{isExpanded ? '▾' : '▸'}</span>
        )}
      </div>
      {isExpanded && detail !== undefined && state !== null && (
        <ExpandedDetail action={detail} state={state} />
      )}
    </div>
  );
}

// Renders the post-click expanded view of an action. v1 shows the
// outcome's structured data in plain rows; future polish could tween
// this in or animate the chevron.
function ExpandedDetail({ action, state }: { readonly action: Action; readonly state: GameState }): ReactElement {
  const lines: string[] = [];
  lines.push(`seq ${action.sequenceNumber}  ·  source ${action.source}`);
  if (action.actorId !== undefined) {
    lines.push(`actor: ${state.units.get(action.actorId)?.name ?? String(action.actorId)}`);
  }
  if (action.type === 'use_ability' || action.type === 'charged_action_resolve') {
    const results = action.outcome?.perTargetResults ?? [];
    for (const r of results) {
      const targetLabel =
        r.target.kind === 'unit'
          ? state.units.get(r.target.unitId)?.name ?? String(r.target.unitId)
          : r.target.kind === 'tile'
            ? `(${r.target.position.x}, ${r.target.position.y})`
            : 'self';
      if (!r.hit) {
        lines.push(`  ${targetLabel}: missed`);
        continue;
      }
      const parts: string[] = [];
      if (r.damage !== undefined && r.damage > 0) parts.push(`${r.damage} dmg`);
      if (r.healing !== undefined && r.healing > 0) parts.push(`+${r.healing} HP`);
      if (r.statusesApplied !== undefined) {
        for (const s of r.statusesApplied) {
          parts.push(`${String(s.statusTypeId)} ${s.applied ? '✓' : '✗'}`);
        }
      }
      lines.push(`  ${targetLabel}: ${parts.join(', ') || 'hit'}`);
    }
    if (action.type === 'use_ability' && action.outcome?.mpSpent !== undefined) {
      lines.push(`MP spent: ${action.outcome.mpSpent}`);
    }
  } else if (action.type === 'move') {
    if (action.outcome !== undefined) {
      lines.push(`path length: ${action.outcome.pathTaken.length} tiles`);
      lines.push(`facing after: ${action.outcome.facingAfter}`);
    }
  } else if (action.type === 'turn_end') {
    if (action.outcome !== undefined) {
      lines.push(`CT spent: ${action.outcome.ctSpent}`);
    }
  } else if (action.type === 'system_damage') {
    lines.push(`amount: ${action.payload.amount}  ·  applied: ${action.outcome?.applied ?? '?'}`);
  } else if (action.type === 'system_heal') {
    lines.push(`amount: ${action.payload.amount}  ·  applied: ${action.outcome?.applied ?? '?'}`);
  }
  return (
    <div style={detailStyle}>
      {lines.map((line, i) => (
        <div key={i} style={detailLineStyle}>{line}</div>
      ))}
    </div>
  );
}

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

const headerStyle: CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  opacity: 0.65,
};

const listScrollStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  paddingRight: 4,
};

const emptyStyle: CSSProperties = {
  fontSize: 12,
  opacity: 0.45,
  fontStyle: 'italic',
};

const rowContainerStyle = (_indent: boolean, expandable: boolean): CSSProperties => ({
  cursor: expandable ? 'pointer' : 'default',
});

const rowStyle = (indent: boolean): CSSProperties => ({
  fontSize: 12,
  lineHeight: 1.35,
  paddingLeft: indent ? 16 : 0,
  display: 'flex',
  gap: 6,
  flexWrap: 'wrap',
});

const textStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  wordBreak: 'break-word',
};

const chevronStyle: CSSProperties = {
  fontSize: 10,
  opacity: 0.45,
  flexShrink: 0,
};

const tagStyle = (kind: LogRow['tagKind']): CSSProperties => {
  const base: CSSProperties = {
    fontSize: 11,
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '0.05em',
    flexShrink: 0,
    minWidth: 44,
  };
  if (kind === 'turn') return { ...base, color: '#f6e5a8', fontWeight: 600 };
  if (kind === 'system') return { ...base, color: '#7ab8d9' };
  if (kind === 'reaction') return { ...base, color: '#d0a76e', minWidth: 12 };
  if (kind === 'ko') return { ...base, color: '#e67865', fontWeight: 600 };
  return { ...base, opacity: 0.5 };
};

const detailStyle: CSSProperties = {
  marginLeft: 24,
  marginTop: 2,
  marginBottom: 4,
  padding: '4px 8px',
  background: 'rgba(255,255,255,0.04)',
  borderLeft: '2px solid #3a4150',
  borderRadius: 4,
  fontSize: 11,
};

const detailLineStyle: CSSProperties = {
  fontFamily: 'ui-monospace, monospace',
  fontSize: 11,
  opacity: 0.85,
  lineHeight: 1.4,
};
