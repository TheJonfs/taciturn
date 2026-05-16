// BattleErrorBoundary — defensive error boundary around `BattleViewInner`
// (Session 33.5A / S33.5 carry).
//
// `BattleViewInner` mounts PixiJS + the orchestrator pump in a large
// effect; a render-time throw — historically the content-file HMR path
// (S34 root-caused: a cleanup-ordering bug accessing `app.canvas` after
// `app.destroy()`) — otherwise unmounts the React tree to a blank canvas
// with no recovery affordance. This catches the throw and degrades to a
// panel with a hard-refresh button.
//
// Why this lives in its own file: it is a *class* component.
// `@vitejs/plugin-react` cannot Fast Refresh a module that exports a
// class, so co-locating it in `BattleView.tsx` disqualified that whole
// module as a refresh boundary — content edits then propagated up to
// `App.tsx` and remounted `BattleViewInner` instead of refreshing it in
// place, which is what triggered the cleanup-ordering crash (S34 audit).
// Keeping the class isolated lets `BattleView.tsx` stay a clean,
// function-component-only Fast Refresh boundary.

import { Component, type ErrorInfo, type ReactNode } from 'react';

const BACKGROUND = '#0e0f12';

export class BattleErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Console-log for dev visibility — the boundary swallows the throw,
    // so without this the error would vanish silently.
    console.error('BattleView crashed:', error, info.componentStack);
    // Forward to the global error surface so the playtest debrief flow
    // captures React render-tree errors alongside async/Pixi-tick
    // exceptions. Best-effort: the surface module is dynamically
    // imported to keep this class component leaf-only re: dependencies
    // (it lives in its own Fast Refresh boundary; see file header).
    void import('./error-surface.tsx').then(({ recordReactBoundaryError }) => {
      recordReactBoundaryError(error, info.componentStack ?? '(no component stack)');
    });
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
            height: '100vh',
            background: BACKGROUND,
            color: '#e8e8ea',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <div style={{ fontSize: '1.1rem' }}>Something went wrong rendering the battle.</div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.95rem',
              cursor: 'pointer',
              background: '#2a2c33',
              color: '#e8e8ea',
              border: '1px solid #44464f',
              borderRadius: '4px',
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
