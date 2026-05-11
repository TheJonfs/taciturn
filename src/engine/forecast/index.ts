// Public API of src/engine/forecast.
//
// The forecast module composes existing pure queries (projection, status
// chance, AoE footprint, CT cost) into hover-friendly "what would happen
// if I committed this?" payloads. Pure: no state mutation, no random
// draws, no side effects. Consumed by the UI's forecast hover panel and
// tooltip.
//
// Per ADR-0042: the forecast module sits at the engine boundary, not the
// UI, so the AI can adopt the same queries once Phase B's AI tier-3 work
// lands. Today's consumers are the UI surfaces in `src/ui/forecast-*`.

export {
  projectDamageRange,
  type DamageRange,
  type ProjectDamageRangeArgs,
} from './damage-range.ts';
export {
  projectStatusChances,
  type StatusChanceForecast,
  type ProjectStatusChancesArgs,
} from './status-chance.ts';
export {
  projectTurnEndCt,
  projectChargedResolution,
  thresholdAfterTurn,
  type PlannedNextAction,
  type ProjectTurnEndCtArgs,
  type ChargedResolutionProjection,
  type ProjectChargedResolutionArgs,
} from './ct-preview.ts';
export {
  projectAoePreview,
  type AoePreviewTile,
  type ProjectAoePreviewArgs,
} from './aoe-preview.ts';
