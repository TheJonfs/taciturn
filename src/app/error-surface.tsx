// Defensive error surface — global window-level error capture for the
// playtest white-flash incident debrief (post-S38).
//
// Symptom (from playtest): the screen flashed white briefly, then game
// resumed but inputs went partially dead (clicking units no longer
// surfaced details; the terrain bar disappeared). A second flash some
// minutes later. The `BattleErrorBoundary` shows a "Something went
// wrong" panel when React render-tree errors fire, but the user saw
// no such panel — meaning the error happened *outside* the React render
// path (Pixi tick, async timer, promise rejection, etc.).
//
// What this captures:
//   1. `window.error` — uncaught exceptions anywhere on the page,
//      including Pixi tick callbacks and microtasks.
//   2. `window.unhandledrejection` — async errors that nothing
//      caught upstream.
//   3. React error-boundary errors are NOT covered here (they're caught
//      by `BattleErrorBoundary`). Add a sibling hook there if those
//      need surfacing too.
//
// Captured errors are kept in module-local state and exposed via a
// React hook. A floating toast renders when count > 0 with a "view"
// button that expands the list. Dismissing clears the toast but keeps
// the record (so the user can copy the stack when they next look).
// Persisted to `sessionStorage` so a hard reload doesn't lose the
// trace (the user reported a "Reload" button workflow was their
// recovery).

import { useEffect, useState, type CSSProperties, type ReactElement } from 'react';

export interface CapturedError {
  readonly timestamp: number;
  readonly source:
    | 'window.error'
    | 'unhandledrejection'
    | 'react.errorBoundary'
    | 'webgl.contextLost'
    | 'webgl.contextRestored';
  readonly message: string;
  readonly stack: string;
  readonly url?: string;
  readonly line?: number;
  readonly column?: number;
  readonly componentStack?: string;
}

const SESSION_STORAGE_KEY = 'taciturn.capturedErrors';
const MAX_PERSISTED = 30; // cap so a runaway loop doesn't blow out storage

// Module-local state. Listeners install on first import; subsequent
// imports observe the same list. The React hook subscribes to a
// version counter so it re-renders when the list grows.
let errors: CapturedError[] = loadFromStorage();
let version = 0;
const subscribers = new Set<() => void>();

function loadFromStorage(): CapturedError[] {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as CapturedError[];
  } catch {
    return [];
  }
}

function persistToStorage(): void {
  try {
    const trimmed = errors.slice(-MAX_PERSISTED);
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Quota or privacy-mode block — ignore. The in-memory list still
    // serves the toast for the current page session.
  }
}

function notify(): void {
  version++;
  for (const s of subscribers) s();
}

function record(err: CapturedError): void {
  errors = [...errors, err];
  persistToStorage();
  notify();
  // Console-log for dev visibility — the toast is for the player, but
  // the developer console wants the structured object too.
  // eslint-disable-next-line no-console
  console.error('[taciturn] captured', err);
}

// Sibling capture path for React error-boundary throws. `BattleErrorBoundary`
// (the only error boundary in v1) forwards into this so the surface
// shows the same stacks as window-level captures.
export function recordReactBoundaryError(error: Error, componentStack: string): void {
  record({
    timestamp: Date.now(),
    source: 'react.errorBoundary',
    message: error.message,
    stack: error.stack ?? '(no stack)',
    componentStack,
  });
}

// WebGL context-loss / restore capture. Pixi v8 doesn't surface these
// as React-tree or window-level errors; the canvas dispatches
// `webglcontextlost` / `webglcontextrestored` directly. BattleView
// installs listeners and forwards into the surface so the player gets
// the same banner-and-stack experience as other crashes. Post-S38
// playtest reported the white-flash + missing-terrain-bar shape that
// matched a WebGL context loss followed by partial recovery.
export function recordWebglContextLost(reason: string): void {
  record({
    timestamp: Date.now(),
    source: 'webgl.contextLost',
    message: `WebGL context lost — ${reason}`,
    stack: '(no JS stack — browser-emitted)',
  });
}

export function recordWebglContextRestored(): void {
  record({
    timestamp: Date.now(),
    source: 'webgl.contextRestored',
    message:
      'WebGL context restored — renderer state may be partial. Reload recommended.',
    stack: '(no JS stack — browser-emitted)',
  });
}

export function clearCapturedErrors(): void {
  errors = [];
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  notify();
}

let installed = false;

export function installGlobalErrorListeners(): void {
  if (installed) return;
  installed = true;
  window.addEventListener('error', (event: ErrorEvent) => {
    record({
      timestamp: Date.now(),
      source: 'window.error',
      message: event.message ?? 'Unknown error',
      stack: event.error?.stack ?? '(no stack)',
      ...(event.filename !== undefined ? { url: event.filename } : {}),
      ...(event.lineno !== undefined ? { line: event.lineno } : {}),
      ...(event.colno !== undefined ? { column: event.colno } : {}),
    });
  });
  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? (reason.stack ?? '(no stack)') : '(non-Error rejection)';
    record({
      timestamp: Date.now(),
      source: 'unhandledrejection',
      message,
      stack,
    });
  });
}

export function useCapturedErrors(): ReadonlyArray<CapturedError> {
  const [, setLocal] = useState(version);
  useEffect(() => {
    const cb = (): void => setLocal(version);
    subscribers.add(cb);
    return () => {
      subscribers.delete(cb);
    };
  }, []);
  return errors;
}

// Floating banner shown when one or more errors have been captured.
// Click the chevron to expand the list; click the X to dismiss the
// banner (errors stay recorded; banner reappears if a new one fires).
export function ErrorSurface(): ReactElement | null {
  const captured = useCapturedErrors();
  const [expanded, setExpanded] = useState(false);
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);

  // Show if any captured error is newer than the dismiss cutoff.
  const visible = captured.some((e) => dismissedAt === null || e.timestamp > dismissedAt);
  if (!visible) return null;

  const latest = captured[captured.length - 1]!;
  const count = captured.length;
  return (
    <div style={bannerStyle} role="alert">
      <div style={rowStyle}>
        <span style={badgeStyle}>⚠ {count}</span>
        <span style={messageStyle}>{latest.message.slice(0, 80)}</span>
        <button type="button" style={chevronStyle} onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Hide' : 'Details'}
        </button>
        <button
          type="button"
          style={chevronStyle}
          onClick={() => setDismissedAt(Date.now())}
          title="Dismiss until next error"
        >
          ✕
        </button>
      </div>
      {expanded ? (
        <pre style={detailsStyle}>
          {captured
            .map(
              (e, i) =>
                `[${i + 1}] ${new Date(e.timestamp).toLocaleTimeString()} · ${e.source}\n${e.message}\n${e.stack}${
                  e.componentStack !== undefined ? `\n--- component stack ---\n${e.componentStack}` : ''
                }`,
            )
            .join('\n\n')}
        </pre>
      ) : null}
    </div>
  );
}

const bannerStyle: CSSProperties = {
  position: 'fixed',
  top: 12,
  right: 12,
  maxWidth: 480,
  zIndex: 9999,
  background: '#2c1c1c',
  color: '#fce8e6',
  border: '1px solid #8a3030',
  borderRadius: 6,
  padding: '8px 10px',
  fontFamily: 'system-ui, sans-serif',
  fontSize: 12,
  boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
};

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const badgeStyle: CSSProperties = {
  background: '#8a3030',
  color: '#fff',
  borderRadius: 4,
  padding: '2px 6px',
  fontWeight: 600,
  flexShrink: 0,
};

const messageStyle: CSSProperties = {
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const chevronStyle: CSSProperties = {
  background: 'transparent',
  color: 'inherit',
  border: '1px solid #5a2020',
  borderRadius: 4,
  padding: '2px 6px',
  cursor: 'pointer',
  fontSize: 11,
};

const detailsStyle: CSSProperties = {
  marginTop: 8,
  maxHeight: 320,
  overflow: 'auto',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: 11,
  lineHeight: 1.4,
};
