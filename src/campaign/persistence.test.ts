// TABA campaign — persistence (localStorage autosave/resume) tests.
// jsdom provides localStorage. Each test uses a unique key to stay isolated.

import { afterEach, describe, expect, it } from 'vitest';
import { newCampaign } from './loop.ts';
import { CAMPAIGN_NODES } from './node.ts';
import { m0Roster } from './roster.ts';

const START = CAMPAIGN_NODES.zarghidas;
import {
  clearSavedCampaign,
  hasSavedCampaign,
  loadCampaign,
  saveCampaign,
} from './persistence.ts';

const KEY = 'taba.test.save';
afterEach(() => clearSavedCampaign(KEY));

describe('campaign persistence', () => {
  it('round-trips a campaign through localStorage', () => {
    const state = {
      ...newCampaign(m0Roster, START),
      currentNodeId: CAMPAIGN_NODES.oskun,
      // Runtime invariant: `visited` covers the position (routeToNode stamps it).
      visited: [START, CAMPAIGN_NODES.oskun],
    };
    expect(hasSavedCampaign(KEY)).toBe(false);
    saveCampaign(state, KEY);
    expect(hasSavedCampaign(KEY)).toBe(true);
    expect(loadCampaign(KEY)).toEqual(state);
  });

  it('returns null when no save exists', () => {
    expect(loadCampaign(KEY)).toBeNull();
  });

  it('clear removes the slot', () => {
    saveCampaign(newCampaign(m0Roster, START), KEY);
    clearSavedCampaign(KEY);
    expect(hasSavedCampaign(KEY)).toBe(false);
    expect(loadCampaign(KEY)).toBeNull();
  });

  it('throws loudly on a corrupt slot rather than starting fresh', () => {
    localStorage.setItem(KEY, '{garbage');
    expect(() => loadCampaign(KEY)).toThrow();
  });
});
