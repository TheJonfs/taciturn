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

import { CAMPAIGN_SCHEMA_VERSION } from './serialization.ts';
import type { CampaignState, CampaignUnit } from './types.ts';

// Start a fresh campaign at node A from an authored roster. The single
// place the `schemaVersion` is stamped onto a new run, so the constant has
// one writer. (Roster vitals are normalized to effective-full when the
// first battle is set up in Chunk 2; the authored roster carries
// provisional fulls — see roster.ts.)
export function newCampaign(roster: ReadonlyArray<CampaignUnit>): CampaignState {
  return {
    schemaVersion: CAMPAIGN_SCHEMA_VERSION,
    roster,
    nodeIndex: 0,
    phase: 'in_progress',
  };
}
