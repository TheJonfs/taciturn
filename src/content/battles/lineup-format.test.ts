// Lineup-format tests (S98 Tier 2) — buildBattleFromLineup restages the base
// config onto authored slots: the spatial contract every generated lineup
// module rides.

import { describe, expect, it } from 'vitest';
import { buildBattleFromLineup, type LineupSpec } from './lineup-format.ts';
import { riverRidgeBattle } from './river-ridge-battle.ts';
import { riverRidge } from '../maps/river-ridge.ts';
import { marshmoor } from '../maps/marshmoor.ts';

const PLAYERS = [
  { x: 5, y: 12, layer: 0, facing: 'N' },
  { x: 6, y: 12, layer: 0, facing: 'N' },
  { x: 7, y: 12, layer: 0, facing: 'N' },
  { x: 5, y: 13, layer: 0, facing: 'N' },
  { x: 6, y: 13, layer: 0, facing: 'N' },
] as const;

const SPEC: LineupSpec = {
  key: 'test_field',
  mapKey: 'marshmoor',
  battleId: 'test_field_v1',
  players: PLAYERS,
  guests: [{ x: 3, y: 12, layer: 0, facing: 'E' }],
  enemies: [
    { x: 7, y: 1, layer: 0, facing: 'S', classId: 'monk', level: 3 },
    { x: 6, y: 1, layer: 0, facing: 'S', classId: 'fire_mage', level: 3 },
    { x: 8, y: 2, layer: 0, facing: 'W', classId: 'hunter', level: 4 },
    { x: 5, y: 2, layer: 0, facing: 'S', classId: 'water_mage', level: 3 },
    { x: 7, y: 3, layer: 0, facing: 'S', classId: 'alchemist', level: 3 },
    // A sixth slot — beyond the base's five, exercising id synthesis.
    { x: 6, y: 3, layer: 0, facing: 'S', classId: 'monk', level: 5 },
  ],
};

describe('buildBattleFromLineup', () => {
  const built = buildBattleFromLineup(SPEC, marshmoor, riverRidgeBattle);
  const playerTeam = riverRidgeBattle.teams[0]!.id;
  const enemyTeam = riverRidgeBattle.teams[1]!.id;

  it('swaps battleId + map and inherits the rest of the base config', () => {
    expect(built.battleId).toBe('test_field_v1');
    expect(built.map).toBe(marshmoor);
    expect(built.teams).toBe(riverRidgeBattle.teams);
    expect(built.victoryConditions).toBe(riverRidgeBattle.victoryConditions);
    expect(built.masterSeed).toBe(riverRidgeBattle.masterSeed);
    expect(built.rulesetId).toBe(riverRidgeBattle.rulesetId);
  });

  it('restages the five player fixtures onto the authored slots, in order', () => {
    const players = built.units.filter((u) => u.team === playerTeam && u.guest !== true);
    expect(players).toHaveLength(5);
    players.forEach((p, i) => {
      expect(p.position).toEqual({ x: PLAYERS[i]!.x, y: PLAYERS[i]!.y, layer: 0 });
      expect(p.facing).toBe('N');
    });
    // Identity (id/class/loadout/equipment) comes from the base fixtures.
    const baseIds = riverRidgeBattle.units
      .filter((u) => u.team === playerTeam && u.guest !== true)
      .map((u) => u.id);
    expect(players.map((p) => p.id)).toEqual(baseIds);
  });

  it('emits guest markers as guest-flagged player-team clones with authored position + facing', () => {
    const guests = built.units.filter((u) => u.guest === true);
    expect(guests).toHaveLength(1);
    expect(guests[0]!.team).toBe(playerTeam);
    expect(guests[0]!.name).toBe('Guest');
    expect(String(guests[0]!.id)).toBe('test_field_guest_1');
    expect(guests[0]!.position).toEqual({ x: 3, y: 12, layer: 0 });
    expect(guests[0]!.facing).toBe('E');
  });

  it('keeps enemy slot ORDER (lead = slot 0) and synthesizes ids past the base count', () => {
    const enemies = built.units.filter((u) => u.team === enemyTeam);
    expect(enemies).toHaveLength(6);
    enemies.forEach((e, i) => {
      expect(e.position).toEqual({
        x: SPEC.enemies[i]!.x,
        y: SPEC.enemies[i]!.y,
        layer: 0,
      });
      expect(e.facing).toBe(SPEC.enemies[i]!.facing);
    });
    // First five reuse base fixture ids (the fold re-skins them); the sixth
    // is synthesized fresh.
    const baseEnemyIds = riverRidgeBattle.units
      .filter((u) => u.team === enemyTeam)
      .map((u) => u.id);
    expect(enemies.slice(0, 5).map((e) => e.id)).toEqual(baseEnemyIds);
    expect(String(enemies[5]!.id)).toBe('test_field_enemy_6');
  });

  it('throws on a player-slot count mismatch and on an enemy-less lineup', () => {
    expect(() =>
      buildBattleFromLineup({ ...SPEC, players: PLAYERS.slice(0, 3) }, marshmoor, riverRidgeBattle),
    ).toThrow(/3 player slot\(s\)/);
    expect(() =>
      buildBattleFromLineup({ ...SPEC, enemies: [] }, marshmoor, riverRidgeBattle),
    ).toThrow(/at least one enemy/);
  });

  it('works against the base map too (restage without a map swap)', () => {
    const sameMap = buildBattleFromLineup(SPEC, riverRidge, riverRidgeBattle);
    expect(sameMap.map).toBe(riverRidge);
  });
});
