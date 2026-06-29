// TABA campaign — save/resume persistence (the side-effecting I/O edge).
//
// Between-battle save only (D-C): one implicit autosave slot in
// `localStorage`. The pure serialize/deserialize live in serialization.ts;
// this module is the thin I/O boundary around them (the only place the
// campaign touches `localStorage`). The autosave is written at campaign
// start and after each winning apply-back — always positioned at the start
// of the next node — so it doubles as the retry checkpoint (a loss reloads
// it and re-runs the node).

import { deserializeCampaign, serializeCampaign } from './serialization.ts';
import type { CampaignState } from './types.ts';

// Versioned key so a future save-format break can coexist with / supersede
// an old slot rather than mis-parsing it. (The payload also carries
// `schemaVersion`; this is the coarse outer guard.)
export const CAMPAIGN_SAVE_KEY = 'taba.campaign.save.v1';

export function saveCampaign(state: CampaignState, key: string = CAMPAIGN_SAVE_KEY): void {
  localStorage.setItem(key, serializeCampaign(state));
}

// Load the saved campaign, or null if none. Throws (does not swallow) if a
// slot exists but is corrupt/incompatible — fail loud per the deserializer,
// so a broken save surfaces rather than silently starting fresh.
export function loadCampaign(key: string = CAMPAIGN_SAVE_KEY): CampaignState | null {
  const raw = localStorage.getItem(key);
  if (raw === null) return null;
  return deserializeCampaign(raw);
}

export function hasSavedCampaign(key: string = CAMPAIGN_SAVE_KEY): boolean {
  return localStorage.getItem(key) !== null;
}

export function clearSavedCampaign(key: string = CAMPAIGN_SAVE_KEY): void {
  localStorage.removeItem(key);
}
