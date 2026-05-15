// Tests for `assignAiTeamNames` — the AI roster name rewriter.

import { describe, expect, it } from 'vitest';
import { riverRidgeBattle } from '@content/battles/river-ridge-battle.ts';
import { ivalicianNames, type Rng } from '../names/index.ts';
import { assignAiTeamNames } from './assign-ai-team-names.ts';

function seededRng(values: number[]): Rng {
  let i = 0;
  return () => {
    const v = values[i % values.length]!;
    i += 1;
    return v;
  };
}

describe('assignAiTeamNames', () => {
  const blueTeamId = riverRidgeBattle.teams[0]!.id;
  const redTeamId = riverRidgeBattle.teams[1]!.id;

  it('renames every unit on the targeted team', () => {
    const result = assignAiTeamNames(
      riverRidgeBattle,
      redTeamId,
      new Set(),
      { rng: seededRng([0.1, 0.2, 0.3, 0.4]) },
    );
    const redUnits = result.units.filter((u) => u.team === redTeamId);
    for (const unit of redUnits) {
      expect(ivalicianNames).toContain(unit.name);
    }
  });

  it('leaves the other team(s) untouched', () => {
    const before = riverRidgeBattle.units
      .filter((u) => u.team === blueTeamId)
      .map((u) => ({ id: u.id, name: u.name }));
    const result = assignAiTeamNames(
      riverRidgeBattle,
      redTeamId,
      new Set(),
      { rng: seededRng([0.0, 0.5, 0.99, 0.25]) },
    );
    const after = result.units
      .filter((u) => u.team === blueTeamId)
      .map((u) => ({ id: u.id, name: u.name }));
    expect(after).toEqual(before);
  });

  it('returns distinct names across the AI team', () => {
    const result = assignAiTeamNames(
      riverRidgeBattle,
      redTeamId,
      new Set(),
      { rng: seededRng([0.0, 0.25, 0.5, 0.75]) },
    );
    const redNames = result.units
      .filter((u) => u.team === redTeamId)
      .map((u) => u.name);
    expect(new Set(redNames).size).toBe(redNames.length);
  });

  it('excludes names in the excludedNames set', () => {
    // Use names from the actual pool so the exclusion test is meaningful
    // (a name that's already excluded from the pool by absence is a
    // weaker test than a pool name that's deliberately blocked).
    const playerNames = new Set([
      ivalicianNames[0]!,
      ivalicianNames[1]!,
      ivalicianNames[2]!,
      ivalicianNames[3]!,
    ]);
    const result = assignAiTeamNames(
      riverRidgeBattle,
      redTeamId,
      playerNames,
      { rng: seededRng([0.1, 0.2, 0.3, 0.4]) },
    );
    const redNames = result.units
      .filter((u) => u.team === redTeamId)
      .map((u) => u.name);
    for (const name of redNames) {
      expect(playerNames.has(name)).toBe(false);
    }
  });

  it('is deterministic with a seeded RNG', () => {
    const a = assignAiTeamNames(riverRidgeBattle, redTeamId, new Set(), {
      rng: seededRng([0.1, 0.4, 0.7, 0.9]),
    });
    const b = assignAiTeamNames(riverRidgeBattle, redTeamId, new Set(), {
      rng: seededRng([0.1, 0.4, 0.7, 0.9]),
    });
    expect(a.units.map((u) => u.name)).toEqual(b.units.map((u) => u.name));
  });

  it('preserves unit order, ids, and non-name fields', () => {
    const result = assignAiTeamNames(
      riverRidgeBattle,
      redTeamId,
      new Set(),
      { rng: seededRng([0.0, 0.25, 0.5, 0.75]) },
    );
    expect(result.units).toHaveLength(riverRidgeBattle.units.length);
    for (let i = 0; i < result.units.length; i++) {
      const before = riverRidgeBattle.units[i]!;
      const after = result.units[i]!;
      expect(after.id).toBe(before.id);
      expect(after.team).toBe(before.team);
      expect(after.classId).toBe(before.classId);
      expect(after.position).toEqual(before.position);
    }
  });

  it('returns the input config unchanged when no units belong to the targeted team', () => {
    // A made-up TeamId that isn't on the config.
    const result = assignAiTeamNames(
      riverRidgeBattle,
      'team_does_not_exist' as TeamId_,
      new Set(),
      { rng: seededRng([0.0]) },
    );
    expect(result).toBe(riverRidgeBattle);
  });
});

// Local TeamId-typed alias just for the no-match test, so the cast
// stays narrow.
type TeamId_ = Parameters<typeof assignAiTeamNames>[1];
