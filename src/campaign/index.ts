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
  EarnedByClass,
} from './types.ts';
export { EMPTY_EARNED_BY_CLASS } from './types.ts';

// M2 progression — the JP economy subsystem (tables, selectors, ops).
export * from './progression/index.ts';

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
  m1Roster,
} from './roster.ts';

// Chunk 2 — the pure loop core (snapshot-fold in, summarize + apply-back out).
export { foldCampaignRoster, probeEffectiveMaxes } from './snapshot-fold.ts';
export { summarizeBattleResult } from './battle-result.ts';
export type { BattleResult, UnitBattleSummary, UnitOutcome } from './battle-result.ts';
export { applyBattleResult } from './apply-back.ts';
export { effectiveMaxVitals } from './vitals.ts';

// The branching graph model + routing (M1) and the authored graph.
export type {
  CampaignNode,
  CampaignEdge,
  CampaignOutcome,
  CampaignGraph,
} from './graph.ts';
export {
  getNode,
  nextNodes,
  winChoices,
  isTerminal,
  isWinChoice,
} from './graph.ts';
export { M1_CAMPAIGN_GRAPH, M1_NODES } from './node.ts';

// The node beat-sequence model (M1.5 battle-as-beat) — descriptors + pure
// cursor helpers.
export type {
  NodeBattle,
  NodeBeat,
  BattleBeat,
  StorySceneBeat,
  StoryScene,
  DialogueLine,
} from './sequence.ts';
export {
  takeStoryRun,
  battleBeats,
  firstBattleBeat,
  hasBattleAtOrAfter,
  isStandalone,
} from './sequence.ts';

// The loop transitions + selectors.
export {
  startCampaign,
  newCampaign,
  bootstrapRosterVitals,
  currentNode,
  deployableRoster,
  battleWasWon,
  applyBattleBeatWin,
  resolveNode,
  routeToNode,
  isComplete,
} from './loop.ts';

// The presentational interstitial beats (the between-beat screens) — pure half.
export {
  buildResultSummaryBeat,
  buildRouteChoiceBeat,
  buildRouteChoice,
  buildUnitResultLines,
} from './interstitial.ts';
export type {
  InterstitialBeat,
  ResultSummaryBeat,
  WorldMapChoiceBeat,
  UnitResultLine,
  NodeResolution,
  BeatOutput,
} from './interstitial.ts';
export {
  CAMPAIGN_SAVE_KEY,
  saveCampaign,
  loadCampaign,
  hasSavedCampaign,
  clearSavedCampaign,
} from './persistence.ts';
