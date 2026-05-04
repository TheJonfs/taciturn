// Public API of src/ui.
//
// React components and hooks for the battle HUD. The UI depends on the
// engine (state in, ProposedActions out via the UiController) and the
// renderer (for highlight overlays and tile-click events). The
// orchestration glue lives in src/app/BattleView.

export { BattleHud, type BattleHudProps } from './battle-hud.tsx';
export { ActionMenu, type ActionMenuProps } from './action-menu.tsx';
export { CurrentUnitPanel, type CurrentUnitPanelProps } from './current-unit-panel.tsx';
export { TurnQueuePanel, type TurnQueuePanelProps } from './turn-queue-panel.tsx';
export { useBattleUi, type BattleUi, type UiMode } from './use-battle-ui.ts';
