// BattleHud — top-level layout shell for the in-battle UI per
// `docs/twentyOneDesign/battle-ui-architecture.md` (Starting Layout).
//
// Four regions overlay the PixiJS canvas:
//   - Top bar:  full-width slim strip with the turn label.
//   - Left:     QueueTower (active-unit anchor + 20-event horizon).
//   - Right:    ActionLogPanel (streaming entries, click-to-expand).
//   - Bottom:   ActionMenu (left slot) + ForecastPanel (right slot).
//
// Session 24 additions:
//   - ForecastPanel occupies the bottom-right slot, populated during
//     target-select / await-confirm via the turn-flow hook's forecast.
//   - All hover-counterpart and unit-detail click-through wiring is
//     plumbed through props from BattleView.

import type { CSSProperties, ReactElement } from 'react';
import type { Action, Catalog, GameState, UnitId } from '@engine/index.ts';
import { QueueTower } from './queue-tower.tsx';
import { ActionMenu } from './action-menu.tsx';
import { ActionLogPanel } from './action-log-panel.tsx';
import { ForecastPanel } from './forecast-panel.tsx';
import type { TurnFlow } from './use-turn-flow.ts';

export interface BattleHudProps {
  readonly state: GameState | null;
  readonly catalog: Catalog;
  readonly turnFlow: TurnFlow;
  readonly onHoverParticipants?: (ids: ReadonlyArray<UnitId>) => void;
  readonly onOpenUnitDetail?: (unitId: UnitId) => void;
}

export function BattleHud({
  state,
  catalog,
  turnFlow,
  onHoverParticipants,
  onOpenUnitDetail,
}: BattleHudProps): ReactElement {
  return (
    <div style={hudOverlayStyle}>
      <TopBar state={state} />
      <div style={leftPanelStyle}>
        <QueueTower
          state={state}
          catalog={catalog}
          onHoverParticipants={onHoverParticipants}
          onOpenUnitDetail={onOpenUnitDetail}
        />
      </div>
      <div style={rightPanelStyle}>
        <ActionLogPanel
          state={state}
          catalog={catalog}
          onHoverParticipants={onHoverParticipants}
        />
      </div>
      <div style={bottomBarStyle}>
        <div style={actionMenuSlotStyle} aria-label="Action menu">
          <ActionMenu
            turnFlow={turnFlow}
            catalog={catalog}
            engineState={state}
            onOpenUnitDetail={onOpenUnitDetail}
          />
        </div>
        <div style={forecastSlotStyle} aria-label="Forecast">
          <ForecastPanel forecast={turnFlow.forecast} catalog={catalog} />
        </div>
      </div>
    </div>
  );
}

function TopBar({ state }: { readonly state: GameState | null }): ReactElement {
  const tNumber = state === null ? 0 : countTurnStarts(state.actionLog);
  const label = tNumber === 0 ? 'Battle Start' : `Turn ${formatT(tNumber)}`;
  return (
    <header style={topBarStyle}>
      <div style={topBarLabelStyle}>{label}</div>
    </header>
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

const leftPanelStyle: CSSProperties = {
  position: 'absolute',
  top: 36,
  left: 12,
  bottom: 12,
  width: 280,
  pointerEvents: 'none',
};

const rightPanelStyle: CSSProperties = {
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
  pointerEvents: 'auto',
};

const bottomBarStyle: CSSProperties = {
  position: 'absolute',
  left: 304,
  right: 304,
  bottom: 12,
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
  maxHeight: 280,
  overflowY: 'auto',
};

const forecastSlotStyle: CSSProperties = {
  flex: 1,
  padding: 12,
  background: 'rgba(28, 30, 35, 0.85)',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: '#2c2f36',
  borderRadius: 8,
  pointerEvents: 'auto',
  maxHeight: 280,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
};
