// BattleHud — top-level layout shell for the in-battle UI per
// `docs/twentyOneDesign/battle-ui-architecture.md` (Starting Layout).
//
// Four regions overlay the PixiJS canvas:
//   - Top bar:  full-width strip with hovered-tile readout (X / Y /
//               Elev / Terrain + reserved icon area). Session 26.5
//               replaced the Turn-T#### readout — redundant with the
//               action log's per-turn T-numbering live since session 25.
//   - Left:     QueueTower (active-unit anchor + 20-event horizon).
//   - Right:    ActionLogPanel (streaming entries, click-to-expand).
//   - Bottom:   ActionMenu (left slot) + ForecastPanel (right slot).

import type { CSSProperties, ReactElement } from 'react';
import type { Catalog, ChargedActionId, GameState, UnitId } from '@engine/index.ts';
import { QueueTower } from './queue-tower.tsx';
import { ActionMenu } from './action-menu.tsx';
import { ActionLogPanel } from './action-log-panel.tsx';
import { ForecastPanel } from './forecast-panel.tsx';
import { TileInfoPanel } from './tile-info-panel.tsx';
import { ActiveTeamBanner } from './active-team-signals.tsx';
import type { TurnFlow } from './use-turn-flow.ts';

export interface BattleHudProps {
  readonly state: GameState | null;
  readonly catalog: Catalog;
  readonly turnFlow: TurnFlow;
  readonly onHoverParticipants?: (ids: ReadonlyArray<UnitId>) => void;
  readonly onOpenUnitDetail?: (unitId: UnitId) => void;
  readonly onOpenChargedActionDetail?: (chargedActionId: ChargedActionId) => void;
  // Active-team signaling (S43). `activeTeamName` / `activeTeamColor`
  // describe whose turn it is; the two booleans gate signal (a) the
  // persistent banner and (b) the team-color glow on the action menu.
  // All optional so non-pass-and-play callers can omit them.
  readonly activeTeamName?: string | null;
  readonly activeTeamColor?: string | null;
  readonly showActiveTeamBanner?: boolean;
  readonly highlightActiveMenu?: boolean;
}

export function BattleHud({
  state,
  catalog,
  turnFlow,
  onHoverParticipants,
  onOpenUnitDetail,
  onOpenChargedActionDetail,
  activeTeamName,
  activeTeamColor,
  showActiveTeamBanner,
  highlightActiveMenu,
}: BattleHudProps): ReactElement {
  // The action-menu glow draws attention to the active player's controls
  // during selection — only meaningful while it's a human team's turn
  // (the menu is interactive) and the cue is enabled.
  const menuAccent =
    highlightActiveMenu === true && turnFlow.isOurTurn && activeTeamColor != null
      ? activeTeamColor
      : null;
  return (
    <div style={hudOverlayStyle}>
      <TileInfoPanel state={state} catalog={catalog} cursorTile={turnFlow.cursorTile} />
      {showActiveTeamBanner === true && activeTeamName != null && activeTeamColor != null && (
        <ActiveTeamBanner teamName={activeTeamName} color={activeTeamColor} />
      )}
      <div style={leftPanelStyle}>
        <QueueTower
          state={state}
          catalog={catalog}
          onHoverParticipants={onHoverParticipants}
          onOpenUnitDetail={onOpenUnitDetail}
          onOpenChargedActionDetail={onOpenChargedActionDetail}
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
        <div
          style={
            menuAccent !== null
              ? {
                  ...actionMenuSlotStyle,
                  borderColor: menuAccent,
                  boxShadow: `0 0 0 2px ${menuAccent}, 0 0 16px ${menuAccent}`,
                }
              : actionMenuSlotStyle
          }
          aria-label="Action menu"
        >
          <ActionMenu
            turnFlow={turnFlow}
            catalog={catalog}
            engineState={state}
            onOpenUnitDetail={onOpenUnitDetail}
          />
        </div>
        <div style={forecastSlotStyle} aria-label="Forecast">
          <ForecastPanel forecast={turnFlow.forecast} catalog={catalog} state={state} />
        </div>
      </div>
    </div>
  );
}

// ---- styles ----

const hudOverlayStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
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
