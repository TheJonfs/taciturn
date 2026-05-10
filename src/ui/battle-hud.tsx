// BattleHud — top-level layout shell for the in-battle UI per
// `docs/twentyOneDesign/battle-ui-architecture.md` (Starting Layout).
//
// Four regions overlay the PixiJS canvas:
//   - Top bar:  full-width slim strip with the turn label.
//   - Left:     QueueTower (active-unit anchor + upcoming events).
//   - Right:    Action log slot (empty in Session 22; populated in
//               Session 23/24).
//   - Bottom:   Action menu slot (empty in Session 22; populated in
//               Session 23 when interaction returns) + a settings
//               placeholder. Per the design doc, settings actually
//               live behind the pause overlay (ESC); the placeholder
//               here is provisional, called out by Session 22's brief
//               item 5 ("empty layout component placed in the side-
//               panel slot. Populated in Session 24 with animation
//               speed, log verbosity, etc.").
//
// All HUD regions render *over* the canvas with semi-transparent
// backgrounds. Mouse-wheel zoom is dispatched from `app.canvas` only,
// so wheel events on these regions don't trigger zoom. WASD pan is
// window-level. Click-through is not intended in Session 22 since no
// interaction is wired.
//
// The legacy components (`current-unit-panel.tsx`, `turn-queue-panel
// .tsx`, `action-menu.tsx`, `use-battle-ui.ts`) are still exported
// from `index.ts` for Session 23 to refactor against the new layout
// when interaction returns. They aren't imported here.

import type { CSSProperties, ReactElement } from 'react';
import type { Action, Catalog, GameState } from '@engine/index.ts';
import { QueueTower } from './queue-tower.tsx';

export interface BattleHudProps {
  readonly state: GameState | null;
  readonly catalog: Catalog;
}

export function BattleHud({ state, catalog }: BattleHudProps): ReactElement {
  return (
    <div style={hudOverlayStyle}>
      <TopBar state={state} />
      <QueueTower state={state} catalog={catalog} />
      <ActionLogSlot />
      <BottomBar />
    </div>
  );
}

function TopBar({ state }: { readonly state: GameState | null }): ReactElement {
  // Derive T-event index from the action log: each `turn_start` action
  // marks the beginning of a unit-turn T-event. The design doc calls
  // for charged-action resolutions to also count as T-events; for
  // first-pass we use turn_start only since `charged_action_resolve`
  // emission detail varies by action shape and the visible distinction
  // matters more in 23/24 when the action log panel surfaces it.
  const tNumber = state === null ? 0 : countTurnStarts(state.actionLog);
  const label = tNumber === 0 ? 'Battle Start' : `Turn ${formatT(tNumber)}`;
  return (
    <header style={topBarStyle}>
      <div style={topBarLabelStyle}>{label}</div>
    </header>
  );
}

function ActionLogSlot(): ReactElement {
  // Empty panel chrome. Streaming log entries land in Session 23/24.
  return (
    <aside style={actionLogSlotStyle} aria-label="Action log">
      <div style={slotHeaderStyle}>Action Log</div>
      <div style={slotPlaceholderStyle}>(coming Session 23/24)</div>
    </aside>
  );
}

function BottomBar(): ReactElement {
  // Action-menu slot + provisional settings placeholder. Both empty in
  // Session 22; interaction returns in Session 23.
  return (
    <div style={bottomBarStyle}>
      <div style={actionMenuSlotStyle} aria-label="Action menu">
        <div style={slotHeaderStyle}>Action Menu</div>
        <div style={slotPlaceholderStyle}>
          (visualization-only; interaction returns Session 23)
        </div>
      </div>
      <div style={settingsSlotStyle} aria-label="Settings">
        <div style={slotHeaderStyle}>Settings</div>
        <div style={slotPlaceholderStyle}>(coming Session 24)</div>
      </div>
    </div>
  );
}

function countTurnStarts(log: ReadonlyArray<Action>): number {
  let n = 0;
  for (const a of log) {
    if (a.type === 'turn_start') n++;
  }
  return n;
}

function formatT(n: number): string {
  return `T${String(n).padStart(4, '0')}`;
}

// ---- styles ----

const hudOverlayStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
};

const topBarStyle: CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  height: 28,
  display: 'flex',
  alignItems: 'center',
  padding: '0 14px',
  background: 'rgba(28, 30, 35, 0.85)',
  borderBottom: '1px solid #2c2f36',
  color: '#e7e9ee',
  fontFamily: 'system-ui, sans-serif',
  fontSize: 12,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  pointerEvents: 'auto',
};

const topBarLabelStyle: CSSProperties = {
  opacity: 0.85,
  fontVariantNumeric: 'tabular-nums',
};

const actionLogSlotStyle: CSSProperties = {
  position: 'absolute',
  top: 36,
  right: 12,
  bottom: 12,
  width: 280,
  padding: 12,
  background: 'rgba(28, 30, 35, 0.85)',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: '#2c2f36',
  borderRadius: 8,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  pointerEvents: 'auto',
  fontFamily: 'system-ui, sans-serif',
  color: '#e7e9ee',
};

const bottomBarStyle: CSSProperties = {
  position: 'absolute',
  left: 304,
  right: 304,
  bottom: 12,
  height: 96,
  display: 'flex',
  gap: 12,
  pointerEvents: 'none',
  fontFamily: 'system-ui, sans-serif',
  color: '#e7e9ee',
};

const actionMenuSlotStyle: CSSProperties = {
  flex: 1,
  padding: 12,
  background: 'rgba(28, 30, 35, 0.85)',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: '#2c2f36',
  borderRadius: 8,
  pointerEvents: 'auto',
};

const settingsSlotStyle: CSSProperties = {
  width: 200,
  padding: 12,
  background: 'rgba(28, 30, 35, 0.85)',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: '#2c2f36',
  borderRadius: 8,
  pointerEvents: 'auto',
};

const slotHeaderStyle: CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  opacity: 0.65,
  marginBottom: 4,
};

const slotPlaceholderStyle: CSSProperties = {
  fontSize: 12,
  opacity: 0.45,
  fontStyle: 'italic',
};
