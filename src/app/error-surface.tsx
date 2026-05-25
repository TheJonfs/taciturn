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
// S50 memory mitigation: cap the in-memory buffer to the same size.
// Pre-S50 the in-memory `errors` array grew unboundedly while only the
// persisted slice was trimmed; a long-running tab with many error /
// context-loss events would compound. Each captured error is small
// (~1 KB), so 30 entries is negligible (~30 KB worst case) while still
// preserving the toast / debug-history surface the player relies on.
const MAX_IN_MEMORY = MAX_PERSISTED;

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
  // S50 memory mitigation: cap the in-memory buffer at MAX_IN_MEMORY
  // (matches the persisted-storage cap). Pre-S50 this was an unbounded
  // append; a long-running tab with many error / context-loss events
  // would compound.
  const next = [...errors, err];
  errors = next.length > MAX_IN_MEMORY ? next.slice(-MAX_IN_MEMORY) : next;
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
      'WebGL context restored — static layers (terrain, cliff edges, elevation labels) redrawn against the cached map. Unit sprites and HP/MP bars heal via the per-frame render pump. Reload if visuals look incomplete.',
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

// Auto-reload guard for Vite's `vite:preloadError`: when a dynamic
// import (Pixi's WebGLRenderer chunk is the canonical v1 case) fails
// because the server has a newer deployment with different chunk
// hashes, the user's stale HTML references chunk URLs that 404. A
// one-shot reload picks up the new HTML and resolves the mismatch.
// Guarded by sessionStorage timestamp so a *genuinely* missing chunk
// (rebuild bug, deployment incomplete) doesn't loop the page.
const PRELOAD_RELOAD_KEY = 'taciturn.preloadReloadAt';
const PRELOAD_RELOAD_COOLDOWN_MS = 10_000;

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
  // Vite emits `vite:preloadError` (cancelable) whenever a `__vitePreload`
  // dynamic import fails. Surfaced post-S38: a redeploy invalidates old
  // chunk URLs, the user's open tab tries to load a Pixi chunk, the
  // fetch 404s, Pixi's Application init throws, the deployment screen
  // renders without a map. One-shot reload picks up the fresh HTML +
  // new chunk URLs.
  //
  // When the auto-reload is going to fire, we ALSO clear the captured-
  // errors list. Without this, the unhandledrejection that may already
  // have fired (browsers vary on whether preventDefault on
  // `vite:preloadError` cancels the downstream rejection) sticks in
  // sessionStorage and the banner reappears every refresh forever.
  // The auto-reload is a successful self-heal; the trace would be
  // misleading. If the reload doesn't resolve the import (cooldown
  // branch below), the next failure is recorded normally.
  window.addEventListener('vite:preloadError', (event: Event) => {
    let lastReload = 0;
    try {
      lastReload = Number(sessionStorage.getItem(PRELOAD_RELOAD_KEY) ?? 0);
    } catch {
      /* sessionStorage may be unavailable in privacy modes */
    }
    if (Date.now() - lastReload < PRELOAD_RELOAD_COOLDOWN_MS) {
      // Reload was attempted recently and didn't resolve the import.
      // Fall through so the unhandledrejection handler records it and
      // the banner surfaces the failure to the player.
      return;
    }
    event.preventDefault();
    try {
      sessionStorage.setItem(PRELOAD_RELOAD_KEY, String(Date.now()));
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    window.location.reload();
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
        <span style={messageStyle} title={latest.message}>
          {latest.message}
        </span>
        <div style={buttonGroupStyle}>
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
  minWidth: 0, // critical: without this, flex's default `min-width: auto`
  // lets the long URL push the buttons off-screen instead of ellipsizing
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const buttonGroupStyle: CSSProperties = {
  display: 'flex',
  gap: 4,
  flexShrink: 0,
};

const chevronStyle: CSSProperties = {
  background: 'transparent',
  color: 'inherit',
  border: '1px solid #5a2020',
  borderRadius: 4,
  padding: '2px 6px',
  cursor: 'pointer',
  fontSize: 11,
  whiteSpace: 'nowrap',
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
