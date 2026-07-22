// TABA Ch1 substrate (WI2) — the campaign-flag store's two APIs.
//
// `set` is called by the driver when a battle's recorded outcome (or a
// future scripted event) needs to persist a fact; `get` is how later
// content branches on it — a post-battle scene pick this chapter, a
// Ch2 dialogue line reading a Ch1 flag next chapter. Both are trivial
// on purpose: the store is a plain keyed record on the save, and all
// meaning lives in the authored keys/values.
//
// Convention for battle outcomes: the key is the battle's
// `recordOutcomeAs` (e.g. 'ester'), the value is the fired victory
// condition's outcome tag (e.g. 'ester-good'). Content owns naming.

import type { CampaignFlagValue, CampaignState } from './types.ts';

// Set (or overwrite) one flag. Returns the new state — pure,
// spread-based like every other campaign mutation.
export function setFlag(
  state: CampaignState,
  key: string,
  value: CampaignFlagValue,
): CampaignState {
  if (key.length === 0) {
    throw new Error('setFlag: key must be a non-empty string');
  }
  return { ...state, flags: { ...state.flags, [key]: value } };
}

// Read one flag. `undefined` means never set — meaningful absence, per
// the accessor convention (ADR-0002).
export function getFlag(state: CampaignState, key: string): CampaignFlagValue | undefined {
  // `?.` — the lenient-field convention (pre-Ch1 saves and bare test
  // factories carry no flag store; absent reads as never-set).
  return state.flags?.[key];
}
