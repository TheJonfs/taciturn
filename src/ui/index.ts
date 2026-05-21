// Public API of src/ui.
//
// React components and hooks for the battle HUD. The UI depends on the
// engine (state in, ProposedActions out via the UiController) and the
// renderer (for highlight overlays and tile-click events). The
// orchestration glue lives in src/app/BattleView.
//
// Session 23 shape: 4-region shell (top bar / left QueueTower /
// right ActionLogPanel / bottom ActionMenu) plus a pause overlay
// modal triggered from BattleView's ESC handler. Settings live inline
// in the pause overlay per the design doc. The player drives turn_a
// through the turn-flow state machine; team_b is basic AI.

export { BattleHud, type BattleHudProps } from './battle-hud.tsx';
export { ActiveTeamBanner, TurnTransitionAlert } from './active-team-signals.tsx';
export { QueueTower, type QueueTowerProps } from './queue-tower.tsx';
export { ActionMenu, type ActionMenuProps } from './action-menu.tsx';
export { ActionLogPanel, type ActionLogPanelProps } from './action-log-panel.tsx';
export { ForecastPanel, type ForecastPanelProps } from './forecast-panel.tsx';
export { ForecastTooltip, type ForecastTooltipProps } from './forecast-tooltip.tsx';
export { UnitDetailPanel, type UnitDetailPanelProps } from './unit-detail-panel.tsx';
export {
  ChargedActionDetailPanel,
  type ChargedActionDetailPanelProps,
} from './charged-action-detail-panel.tsx';
export { ResultsScreen, type ResultsScreenProps } from './results-screen.tsx';
export { PauseOverlay, type PauseOverlayProps } from './pause-overlay.tsx';
export {
  SettingsProvider,
  useSettings,
  DEFAULT_SETTINGS,
  type Settings,
  type SettingsApi,
  type AnimationSpeed,
  type ConfirmStepPreference,
  type StatusIconDensity,
} from './settings-context.tsx';
export { useTurnFlow, type TurnFlow, type UseTurnFlowArgs } from './use-turn-flow.ts';
export {
  transition,
  INITIAL_TURN_FLOW,
  type TurnFlowState,
  type TurnFlowEvent,
} from './turn-flow.ts';
export {
  createDeploymentState,
  isDeploymentComplete,
  transition as deploymentTransition,
  unitPlacedOn,
  type DeploymentEvent,
  type DeploymentPhase,
  type DeploymentPlacement,
  type DeploymentState,
} from './deployment-flow.ts';
export {
  useDeploymentFlow,
  type DeploymentFlow,
  type UseDeploymentFlowArgs,
} from './use-deployment-flow.ts';
export {
  DeploymentRosterPanel,
  type DeploymentRosterPanelProps,
} from './deployment-roster-panel.tsx';
export {
  DeploymentFacingPicker,
  type DeploymentFacingPickerProps,
} from './deployment-facing-picker.tsx';
export {
  composeForecast,
  type Forecast,
  type ForecastTargetRow,
  type ComposeForecastArgs,
} from './forecast-compose.ts';
export {
  buildDefaultLoadout,
  classCanEquip,
  computeDraftUnitStats,
  computeTeamValidity,
  createEmptyTeamBuilderState,
  draftAbilityCost,
  draftBucketCapacity,
  draftBucketUsage,
  draftCommandSetCost,
  selectUnit,
  setBrave,
  setClass,
  setEquipment,
  setFaith,
  slotAcceptsKind,
  teamBuilderStateFromBuiltTeam,
  teamBuilderStateToBuiltTeam,
  togglePassive,
  toggleSecondaryCommandSet,
  TEAM_SIZE,
  type BucketOverage,
  type BucketUsage,
  type DraftUnit,
  type DraftUnitStats,
  type TeamBuilderState,
  type TeamValidity,
  type UnitValidity,
} from './team-builder-state.ts';
export {
  useTeamBuilder,
  type TeamBuilder,
  type UseTeamBuilderArgs,
} from './use-team-builder.ts';
export {
  TeamBuilderRoster,
  type TeamBuilderRosterProps,
} from './team-builder-roster.tsx';
export {
  TeamBuilderClassPicker,
  type TeamBuilderClassPickerProps,
} from './team-builder-class-picker.tsx';
export {
  TeamBuilderEquipmentSlots,
  type TeamBuilderEquipmentSlotsProps,
} from './team-builder-equipment-slots.tsx';
export {
  TeamBuilderAbilityPicker,
  type TeamBuilderAbilityPickerProps,
} from './team-builder-ability-picker.tsx';
export {
  TeamBuilderDefaultLoader,
  type TeamBuilderDefaultLoaderProps,
} from './team-builder-default-loader.tsx';
export {
  deriveKoEvents,
  derivePerUnitStats,
  deriveActionParticipants,
  type KoEvent,
  type PerUnitStats,
  type ActionParticipants,
} from './derived-events.ts';
