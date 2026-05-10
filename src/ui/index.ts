// Public API of src/ui.
//
// React components and hooks for the battle HUD. The UI depends on the
// engine (state in, ProposedActions out via the UiController) and the
// renderer (for highlight overlays and tile-click events). The
// orchestration glue lives in src/app/BattleView.
//
// Session 22 layout shift: BattleHud is now a 4-region shell (top bar
// / left QueueTower / right action-log slot / bottom action-menu +
// settings slots). The Session 23-and-earlier components (ActionMenu,
// CurrentUnitPanel, TurnQueuePanel, useBattleUi) are still exported
// for the interaction-layer session to refactor against the new shell
// when it returns.

export { BattleHud, type BattleHudProps } from './battle-hud.tsx';
export { QueueTower, type QueueTowerProps } from './queue-tower.tsx';
export { ActionMenu, type ActionMenuProps } from './action-menu.tsx';
export { CurrentUnitPanel, type CurrentUnitPanelProps } from './current-unit-panel.tsx';
export { TurnQueuePanel, type TurnQueuePanelProps } from './turn-queue-panel.tsx';
export { useBattleUi, type BattleUi, type UiMode } from './use-battle-ui.ts';
