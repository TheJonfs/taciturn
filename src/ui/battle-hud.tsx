// BattleHud — composes the action menu, current-unit panel, and turn
// queue into a single right-side overlay. Layout is intentionally
// simple: a vertical stack pinned to the right edge. v1 only — a more
// considered layout (left-side roster, bottom log) lands during a
// later UX pass.

import type { CSSProperties, ReactElement } from 'react';
import type { Catalog } from '@engine/index.ts';
import { ActionMenu } from './action-menu.tsx';
import { CurrentUnitPanel } from './current-unit-panel.tsx';
import { TurnQueuePanel } from './turn-queue-panel.tsx';
import type { BattleUi } from './use-battle-ui.ts';
import type { GameState } from '@engine/index.ts';

export interface BattleHudProps {
  readonly state: GameState | null;
  readonly catalog: Catalog;
  readonly ui: BattleUi;
}

export function BattleHud(props: BattleHudProps): ReactElement {
  const { state, catalog, ui } = props;
  return (
    <div style={hudContainerStyle}>
      <CurrentUnitPanel unit={ui.activeUnit} state={state} catalog={catalog} />
      <ActionMenu
        mode={ui.mode}
        isOurTurn={ui.isOurTurn}
        waiting={ui.waiting}
        turnState={state?.turnState ?? null}
        hasCure={ui.hasCure}
        onMove={ui.startMove}
        onAttack={ui.startAttack}
        onCure={ui.startCure}
        onWait={ui.submitWait}
        onCancel={ui.cancelSelection}
      />
      <TurnQueuePanel state={state} catalog={catalog} count={5} />
    </div>
  );
}

const hudContainerStyle: CSSProperties = {
  position: 'absolute',
  top: 16,
  right: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  pointerEvents: 'auto',
  width: 240,
};
