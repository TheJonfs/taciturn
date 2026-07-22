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
  CampaignFlags,
  CampaignFlagValue,
  UnitFate,
  EarnedByClass,
} from './types.ts';
export { EMPTY_EARNED_BY_CLASS } from './types.ts';

// Ch1 substrate — the persistent campaign-flag store (set at battle
// outcome recording; get wherever content branches).
export { setFlag, getFlag } from './flags.ts';

// M2 progression — the JP economy subsystem (tables, selectors, ops).
export * from './progression/index.ts';
export { reclassUnit } from './reclass.ts';

export {
  CAMPAIGN_SCHEMA_VERSION,
  serializeCampaign,
  deserializeCampaign,
} from './serialization.ts';

// TABA M3 — the party inventory (instance counting + equip/unequip ops).
export {
  EMPTY_INVENTORY,
  bootstrapInventory,
  equipItem,
  equipOnUnit,
  equippedCount,
  equippedCounts,
  freeCount,
  grantItems,
  ownedCount,
  removeItems,
  unequipItem,
  type InventoryRecord,
} from './inventory.ts';
export { DEBUG_SEED_TARGET, debugSeedGrants, debugSeedInventory } from './debug-seed.ts';
export { DEBUG_JP_GRANT, debugGrantJp } from './debug-grant-jp.ts';
export { DEBUG_LEVEL_GRANT, debugGrantLevel } from './debug-grant-level.ts';

export {
  M0_ROSTER_SIZE,
  M0_BASELINE_LEVEL,
  campaignUnitFromBuilt,
  m0Roster,
  m1Roster,
} from './roster.ts';

// Chapter 1 — the real campaign-start roster (rolled at New Campaign) and
// the staggered plot-join units (S93).
export {
  CH1_CHRIS_ALCHEMIST_JP,
  CH1_GENERIC_CLASSES,
  CH1_START_LEVEL,
  ch1StartingRoster,
  clioJoinUnit,
  rollCh1Generics,
  seraJoinUnit,
  thessalyJoinUnit,
} from './ch1-roster.ts';

// Chunk 2 — the pure loop core (snapshot-fold in, summarize + apply-back out).
export { foldCampaignRoster, foldEnemyTeam, foldGuestTeam, foldBattle, probeEffectiveMaxes, probeUnitStats } from './snapshot-fold.ts';
export type { EffectiveUnitStats } from './snapshot-fold.ts';
export { authoredEnemy } from './authored-enemy.ts';
export type { AuthoredEnemySpec } from './authored-enemy.ts';
export { summarizeBattleResult } from './battle-result.ts';
export type { BattleResult, UnitBattleSummary, UnitOutcome } from './battle-result.ts';
export { applyBattleResult } from './apply-back.ts';
export { effectiveMaxVitals, refillVitalsToEffectiveFull } from './vitals.ts';

// The branching graph model + routing (M1) and the authored graph.
export type {
  CampaignNode,
  CampaignEdge,
  CampaignOutcome,
  CampaignGraph,
  Engagement,
} from './graph.ts';
export {
  getNode,
  nextNodes,
  winChoices,
  isTerminal,
  isWinChoice,
  allNodeBeats,
  engagementBeatId,
} from './graph.ts';

// M3 economy Stage 1 — the navigable map (travel selectors) + the skirmish
// valve (stub generator behind the M4 seam). Engagement queues (M3): the
// current-engagement selectors + per-beat edge gating.
export {
  currentEngagement,
  hasArmedStory,
  hasAvailability,
  isEdgeOpen,
  isEngagementArmed,
  isEngagementCleared,
  isFarmableNow,
  isHubNow,
  isStoryCleared,
  isTravelChoice,
  travelChoices,
} from './travel.ts';
export type { CurrentEngagement, TravelChoice } from './travel.ts';
export {
  buildSkirmishBattle,
  generateSkirmishParty,
  recordSkirmishWin,
  skirmishLevelAt,
  skirmishSeed,
  skirmishWinsAt,
} from './skirmish.ts';
// S98 Tier 2 — authored lineups (Cartographer unit mode): the identity half
// of a generated lineup module, framed by the M4 unified composer.
export {
  composeLineupEnemyDraft,
  enemiesFromLineup,
  lineupSlotSeed,
  unlockRefToToken,
} from './lineup.ts';
// M4 — the unified generated-enemy composer + archetype registry.
export {
  composeEnemyBuild,
  generatedEnemyUnit,
  stringSeed,
  type ComposedEnemyBuild,
  type ComposeEnemyArgs,
} from './enemy-generation.ts';
export {
  archetypeForNode,
  DEFAULT_ARCHETYPE,
  ENEMY_ARCHETYPES,
  NODE_ARCHETYPES,
  rollArchetypeClasses,
  type EnemyArchetype,
} from './archetypes.ts';
export { enemyJpBudget, enemyKitForBudget, enemyKitForLevel } from './enemy-kit.ts';
export { CANONICAL_PROBE_BATTLE, probeBattleFor } from './probe-battle.ts';
export type { VitalsProbeBattle } from './probe-battle.ts';
export { CAMPAIGN_GRAPH, CAMPAIGN_NODES } from './node.ts';
export { CAMPAIGN_RULESET_ID, contentBeats, hasContentBeats } from './node-content.ts';
export {
  DEFAULT_PLACEHOLDER_TEMPLATE_KEY,
  PLACEHOLDER_DEPLOY_CAP,
  PLACEHOLDER_SCENE_TITLE,
  placeholderBattleBeat,
  placeholderSceneBeat,
} from './placeholder-beat.ts';
export { PLOT_UNIT_IDS } from './plot-unit-ids.ts';

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
  outcomeFollowUpScene,
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
  buildLocationMenuBeat,
  buildResultSummaryBeat,
  buildRouteChoiceBeat,
  buildRouteChoice,
  buildUnitResultLines,
} from './interstitial.ts';
export type {
  InterstitialBeat,
  LocationMenuBeat,
  LocationOption,
  ResultSummaryBeat,
  WorldMapChoiceBeat,
  UnitResultLine,
  NodeResolution,
  BeatOutput,
} from './interstitial.ts';
// M3 economy Stage 0 — the tunable-constants module, the gil wallet, and the
// single enemy-level lever.
export {
  DEFAULT_ITEM_PRICE,
  GIL_PER_ENEMY_LEVEL,
  ITEM_PRICE_OVERRIDES,
  SELL_RATE,
  STARTING_GIL,
} from './economy-config.ts';

// M3 economy Stage 2 — the shop (cumulative story-gated stock; buy/sell).
export {
  buyItem,
  itemPrice,
  sellBlockReason,
  sellItem,
  sellValue,
  shopStock,
} from './shop.ts';

// M3 economy Stage 3 — recruitment (the gil sink).
export {
  buildHire,
  hireableClasses,
  hireCost,
  hireGeneric,
  hireJpBonus,
  maxHireLevel,
  starterGearFor,
} from './recruit.ts';
export type { HireSpec } from './recruit.ts';
// Ch1 substrate (WI4) — the mid-campaign plot-unit join (Sera at Node 6).
export { joinPlotUnit } from './join.ts';
export { grantGil, spendGil, computeGilReward } from './gil.ts';
export { DIFFICULTY_FACTOR, resolveEnemyLevel, partyAverageLevel } from './enemy-level.ts';

// M3 — the TABA equipment pool (Stage 0 isolation substrate).
export type { GearChapter, GearAcquisition, TabaGearEntry } from './equipment-pool.ts';
export {
  TABA_GEAR_POOL,
  MAGE_WAR_SHARED_ENTRIES,
  TABA_NEW_ENTRIES,
  tabaShopPool,
  tabaGearEntry,
} from './equipment-pool.ts';

export {
  CAMPAIGN_SAVE_KEY,
  saveCampaign,
  loadCampaign,
  hasSavedCampaign,
  clearSavedCampaign,
} from './persistence.ts';
