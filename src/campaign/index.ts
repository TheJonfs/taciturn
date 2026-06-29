// Public API of the TABA campaign shell region.
//
// The campaign is a SHELL: it consumes the shared core (engine + content)
// and is consumed by the app. Nothing in the core imports from here. M0
// (the spine slice) ships the durable container + identity here; later
// milestones add the snapshot-fold / summarizer / apply-back (Chunk 2),
// the node graph + loop (Chunk 3), and progression/economy/story.

export type {
  CampaignUnit,
  CampaignState,
  CampaignPhase,
  UnitFate,
} from './types.ts';

export {
  CAMPAIGN_SCHEMA_VERSION,
  serializeCampaign,
  deserializeCampaign,
} from './serialization.ts';

export {
  M0_ROSTER_SIZE,
  M0_BASELINE_LEVEL,
  campaignUnitFromBuilt,
  m0Roster,
} from './roster.ts';

// Chunk 2 — the pure loop core (snapshot-fold in, summarize + apply-back out).
export { foldCampaignRoster, probeEffectiveMaxes } from './snapshot-fold.ts';
export { summarizeBattleResult } from './battle-result.ts';
export type { BattleResult, UnitBattleSummary, UnitOutcome } from './battle-result.ts';
export { applyBattleResult } from './apply-back.ts';
export { effectiveMaxVitals } from './vitals.ts';

// Chunk 3 — the node graph, the loop transitions, and persistence.
export type { CampaignNode } from './node.ts';
export { M0_NODE_GRAPH } from './node.ts';
export {
  startCampaign,
  newCampaign,
  bootstrapRosterVitals,
  currentNode,
  deployableRoster,
  battleWasWon,
  advanceOnWin,
  isComplete,
} from './loop.ts';
export {
  CAMPAIGN_SAVE_KEY,
  saveCampaign,
  loadCampaign,
  hasSavedCampaign,
  clearSavedCampaign,
} from './persistence.ts';
