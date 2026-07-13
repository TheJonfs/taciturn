// Ch1 substrate (WI2) — campaign-flag store tests: set/get semantics,
// the save round-trip (typed wider than Ch1's boolean-only authoring),
// lenient absence on legacy saves, and the outcome-branched follow-up
// scene pick.

import { describe, expect, it } from 'vitest';
import { deserializeCampaign, serializeCampaign } from './serialization.ts';
import { getFlag, setFlag } from './flags.ts';
import { newCampaign } from './loop.ts';
import { m0Roster } from './roster.ts';
import { outcomeFollowUpScene, type BattleBeat, type NodeBattle, type StoryScene } from './sequence.ts';
import { DEFAULT_PLACEHOLDER_TEMPLATE_KEY, placeholderBattleBeat } from './placeholder-beat.ts';

const fresh = () => newCampaign(m0Roster, 'node-river-ridge');

describe('setFlag / getFlag', () => {
  it('a fresh campaign has no flags; get returns undefined (never set)', () => {
    expect(fresh().flags).toEqual({});
    expect(getFlag(fresh(), 'ester')).toBeUndefined();
  });

  it('set → get round-trips all three value types', () => {
    let state = fresh();
    state = setFlag(state, 'ester', 'ester-good');
    state = setFlag(state, 'oskun-warned', true);
    state = setFlag(state, 'bandits-routed', 3);
    expect(getFlag(state, 'ester')).toBe('ester-good');
    expect(getFlag(state, 'oskun-warned')).toBe(true);
    expect(getFlag(state, 'bandits-routed')).toBe(3);
  });

  it('set overwrites an existing key', () => {
    const state = setFlag(setFlag(fresh(), 'ester', 'ester-standard'), 'ester', 'ester-good');
    expect(getFlag(state, 'ester')).toBe('ester-good');
  });

  it('rejects an empty key (authoring bug, fail loudly)', () => {
    expect(() => setFlag(fresh(), '', true)).toThrow(/non-empty/);
  });
});

describe('flags — save round-trip', () => {
  it('flags persist through serialize → deserialize', () => {
    const state = setFlag(setFlag(fresh(), 'ester', 'ester-good'), 'ruk-count', 2);
    const back = deserializeCampaign(serializeCampaign(state));
    expect(back.flags).toEqual({ ester: 'ester-good', 'ruk-count': 2 });
    expect(getFlag(back, 'ester')).toBe('ester-good');
  });

  it('a save without a flags field loads with an empty store (lenient grandfather)', () => {
    const legacy = JSON.parse(serializeCampaign(fresh())) as Record<string, unknown>;
    delete legacy['flags'];
    const back = deserializeCampaign(JSON.stringify(legacy));
    expect(back.flags).toEqual({});
  });

  it('rejects non-scalar flag values loudly', () => {
    const raw = JSON.parse(serializeCampaign(fresh())) as Record<string, unknown>;
    raw['flags'] = { bad: { nested: true } };
    expect(() => deserializeCampaign(JSON.stringify(raw))).toThrow(/flags\.bad/);
  });
});

describe('outcomeFollowUpScene', () => {
  const goodScene: StoryScene = {
    title: 'Mercy at Ester',
    lines: [{ speaker: 'Ester', text: 'You could have killed us. You did not.' }],
  };
  const battleWith = (onOutcome?: NodeBattle['onOutcome']): NodeBattle => ({
    ...(placeholderBattleBeat(DEFAULT_PLACEHOLDER_TEMPLATE_KEY) as BattleBeat).battle,
    ...(onOutcome !== undefined ? { onOutcome } : {}),
  });

  it('picks the scene for the fired tag', () => {
    const beat = outcomeFollowUpScene(battleWith({ 'ester-good': goodScene }), 'ester-good');
    expect(beat).toEqual({ type: 'story-scene', scene: goodScene });
  });

  it('returns undefined when the tag has no entry, the battle has no map, or no tag fired', () => {
    expect(outcomeFollowUpScene(battleWith({ 'ester-good': goodScene }), 'ester-standard')).toBeUndefined();
    expect(outcomeFollowUpScene(battleWith(undefined), 'ester-good')).toBeUndefined();
    expect(outcomeFollowUpScene(battleWith({ 'ester-good': goodScene }), undefined)).toBeUndefined();
  });
});
