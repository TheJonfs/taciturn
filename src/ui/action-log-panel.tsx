// ActionLogPanel — streaming list of formatted log rows.
//
// Renders into the right region of the 4-region HUD shell. Reads
// `state.actionLog` and feeds it through `formatActionLog` to produce
// rows; renders them top-to-bottom with newest at the bottom and
// auto-scrolls on append (unless the user has manually scrolled up).
//
// Click-to-expand for full detail is Session 24; v1 ships the compact
// one-row-per-event view per the design doc's "Compact view" example.

import { useEffect, useRef, type CSSProperties, type ReactElement } from 'react';
import type { Catalog, GameState } from '@engine/index.ts';
import { formatActionLog, type LogRow } from './action-log-format.ts';

export interface ActionLogPanelProps {
  readonly state: GameState | null;
  readonly catalog: Catalog;
}

export function ActionLogPanel({ state, catalog }: ActionLogPanelProps): ReactElement {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef<boolean>(true);

  const rows: ReadonlyArray<LogRow> = state === null ? [] : formatActionLog(state.actionLog, state, catalog);

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

  function onScroll(e: React.UIEvent<HTMLDivElement>): void {
    const el = e.currentTarget;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceFromBottom < 8;
  }

  return (
    <aside style={panelStyle} aria-label="Action log">
      <div style={headerStyle}>Action Log</div>
      <div style={listScrollStyle} ref={scrollRef} onScroll={onScroll}>
        {rows.length === 0 ? (
          <div style={emptyStyle}>(no actions yet)</div>
        ) : (
          rows.map((row) => <Row key={row.key} row={row} />)
        )}
      </div>
    </aside>
  );
}

function Row({ row }: { readonly row: LogRow }): ReactElement {
  return (
    <div style={rowStyle(row.indent)}>
      {row.tag !== null && <span style={tagStyle(row.tagKind)}>{row.tag}</span>}
      <span style={textStyle}>{row.text}</span>
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

const tagStyle = (kind: 'turn' | 'system' | 'reaction' | null): CSSProperties => {
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
  return { ...base, opacity: 0.5 };
};
