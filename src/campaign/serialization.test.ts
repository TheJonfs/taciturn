// TABA campaign — serialization round-trip + loud-validation tests.
// The durable container is the save target (D-C); these prove it survives
// a naive JSON round-trip with stable identity, and that a malformed or
// wrong-version save fails loudly rather than coercing.

import { describe, expect, it } from 'vitest';
import { newCampaign } from './index.ts';
import { M1_NODES } from './node.ts';
import { m0Roster } from './roster.ts';
import {
  CAMPAIGN_SCHEMA_VERSION,
  deserializeCampaign,
  serializeCampaign,
} from './serialization.ts';
import type { CampaignState } from './types.ts';

const START = M1_NODES.riverRidge;

function sampleState(): CampaignState {
  // A mid-run state: routed past the start to a fork branch, one unit lost,
  // one wounded.
  const base = newCampaign(m0Roster, START);
  const roster = base.roster.map((u, i) => {
    if (i === 0) return { ...u, fate: 'lost' as const };
    if (i === 1) return { ...u, vitals: { hp: 3, mp: 0 } };
    return u;
  });
  return { ...base, roster, currentNodeId: M1_NODES.stonebridge };
}

describe('campaign serialization', () => {
  it('round-trips a fresh campaign losslessly', () => {
    const state = newCampaign(m0Roster, START);
    const restored = deserializeCampaign(serializeCampaign(state));
    expect(restored).toEqual(state);
  });

  it('round-trips a mid-run campaign (advanced node, lost + wounded units)', () => {
    const state = sampleState();
    const restored = deserializeCampaign(serializeCampaign(state));
    expect(restored).toEqual(state);
  });

  it('preserves stable unit identity across the round-trip', () => {
    const state = newCampaign(m0Roster, START);
    const restored = deserializeCampaign(serializeCampaign(state));
    expect(restored.roster.map((u) => u.id)).toEqual(state.roster.map((u) => u.id));
  });

  it('serializes to plain JSON with no Map/Set/undefined artifacts', () => {
    const json = serializeCampaign(sampleState());
    // A clean round-trip through the generic JSON parser must equal what
    // our typed parser produces — proves no exotic (Map/Set/class) values
    // leaked into the container.
    const generic = JSON.parse(json) as CampaignState;
    expect(deserializeCampaign(json)).toEqual(generic);
  });

  it('omits gender entirely for units without one (no `gender: undefined`)', () => {
    // Author a unit without gender, confirm the key is absent post-parse.
    const state = newCampaign(m0Roster, START);
    const json = serializeCampaign(state);
    const generic = JSON.parse(json) as { roster: Array<Record<string, unknown>> };
    for (const u of generic.roster) {
      // Either the key is absent or (if a source unit had a gender) it's a
      // concrete value — never the literal undefined.
      if (!('gender' in u)) continue;
      expect(['male', 'female']).toContain(u['gender']);
    }
  });

  it('rejects a wrong schemaVersion loudly', () => {
    const state = newCampaign(m0Roster, START);
    const tampered = JSON.stringify({ ...state, schemaVersion: CAMPAIGN_SCHEMA_VERSION + 1 });
    expect(() => deserializeCampaign(tampered)).toThrow(/unsupported schemaVersion/);
  });

  it('rejects non-JSON input loudly', () => {
    expect(() => deserializeCampaign('{not json')).toThrow(/not valid JSON/);
  });

  it('rejects a non-object root', () => {
    expect(() => deserializeCampaign('[]')).toThrow(/must be an object/);
  });

  it('rejects a missing/empty currentNodeId', () => {
    const state = { ...newCampaign(m0Roster, START), currentNodeId: '' };
    expect(() => deserializeCampaign(JSON.stringify(state))).toThrow(/currentNodeId/);
  });

  it('round-trips an awaiting_route save (cleared node, choosing next)', () => {
    const state = { ...newCampaign(m0Roster, START), phase: 'awaiting_route' as const };
    const restored = deserializeCampaign(serializeCampaign(state));
    expect(restored.phase).toBe('awaiting_route');
    expect(restored).toEqual(state);
  });

  it('rejects an unknown phase', () => {
    const state = { ...newCampaign(m0Roster, START), phase: 'paused' };
    expect(() => deserializeCampaign(JSON.stringify(state))).toThrow(/phase/);
  });

  it('rejects an unknown fate on a roster unit', () => {
    const state = newCampaign(m0Roster, START);
    const broken = {
      ...state,
      roster: [{ ...state.roster[0], fate: 'fled' }, ...state.roster.slice(1)],
    };
    expect(() => deserializeCampaign(JSON.stringify(broken))).toThrow(/fate/);
  });

  it('rejects a unit missing its id', () => {
    const state = newCampaign(m0Roster, START);
    const firstWithoutId = { ...state.roster[0] } as Record<string, unknown>;
    delete firstWithoutId['id'];
    const broken = { ...state, roster: [firstWithoutId, ...state.roster.slice(1)] };
    expect(() => deserializeCampaign(JSON.stringify(broken))).toThrow(/roster\[0\]\.id/);
  });

  it('rejects malformed vitals', () => {
    const state = newCampaign(m0Roster, START);
    const broken = {
      ...state,
      roster: [{ ...state.roster[0], vitals: { hp: 'full', mp: 0 } }, ...state.roster.slice(1)],
    };
    expect(() => deserializeCampaign(JSON.stringify(broken))).toThrow(/vitals\.hp/);
  });

  // --- M2 progression state (v3) ---

  it('round-trips a unit carrying per-class JP, unlocks, and a class-access override', () => {
    const state = newCampaign(m0Roster, START);
    const progressed = {
      ...state,
      roster: [
        {
          ...state.roster[0]!,
          xp: 42,
          earnedByClass: { monk: 800, knight: 200 },
          unlocks: [
            { kind: 'ability', id: 'chakra' },
            { kind: 'item', id: 'potion' },
            { kind: 'mathParameter', id: 'level' },
            { kind: 'mathValue', id: 3 },
          ],
          classAccessOverride: ['calculator'],
        },
        ...state.roster.slice(1),
      ],
    } as unknown as CampaignState;
    const restored = deserializeCampaign(serializeCampaign(progressed));
    expect(restored).toEqual(progressed);
  });

  it('defaults omitted earnedByClass/unlocks (lenient, like loadout) for hand-trimmed saves', () => {
    const state = newCampaign(m0Roster, START);
    const trimmed = { ...state.roster[0] } as Record<string, unknown>;
    delete trimmed['earnedByClass'];
    delete trimmed['unlocks'];
    delete trimmed['xp'];
    const broken = { ...state, roster: [trimmed, ...state.roster.slice(1)] };
    const restored = deserializeCampaign(JSON.stringify(broken));
    expect(restored.roster[0]!.earnedByClass).toEqual({});
    expect(restored.roster[0]!.unlocks).toEqual([]);
    expect(restored.roster[0]!.xp).toBe(0); // omitted xp defaults to 0
  });

  it('rejects a malformed earnedByClass value', () => {
    const state = newCampaign(m0Roster, START);
    const broken = {
      ...state,
      roster: [{ ...state.roster[0], earnedByClass: { monk: 'lots' } }, ...state.roster.slice(1)],
    };
    expect(() => deserializeCampaign(JSON.stringify(broken))).toThrow(/earnedByClass\.monk/);
  });

  it('rejects an unlock token with an unknown kind', () => {
    const state = newCampaign(m0Roster, START);
    const broken = {
      ...state,
      roster: [
        { ...state.roster[0], unlocks: [{ kind: 'spell', id: 'x' }] },
        ...state.roster.slice(1),
      ],
    };
    expect(() => deserializeCampaign(JSON.stringify(broken))).toThrow(/unlocks\[0\]\.kind/);
  });
});
