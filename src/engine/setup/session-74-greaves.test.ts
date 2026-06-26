// Session 74 — Greaves of Seraphis battle-start CT seed (ADR-0125).
//
// The wearer begins the battle at full CT (acts first). The seed is
// `battleStartCt: 100`, consumed once by the pre-battle phase as a
// `system_set_ct` with `source: { kind: 'equipment' }`. It overrides both
// the ruleset's initial-CT formula draw and an explicit placement.initialCT.
// The `system_set_ct` reducer clamps to [0, 99], so the applied value is 99
// (the pre-trigger ceiling) — still first to act.

import { describe, expect, it } from 'vitest';
import {
  bucketId,
  classId,
  commandSetId,
  computeSpeed,
  rulesetId,
  teamId,
  unitId,
  type BattleConfig,
  type ItemId,
  type UnitPlacement,
} from '@engine/index.ts';
import { greavesOfSeraphis } from '../../content/items/greaves-of-seraphis.ts';
import { loadDefaultCatalog } from '../../content/index.ts';
import { createInitialState, runPreBattlePhase } from './create-initial-state.ts';

const cat = loadDefaultCatalog();
const FIRST = bucketId('first_action');

function knight(args: {
  id: string;
  spd?: number;
  accessory?: ItemId | null;
  initialCT?: number;
}): UnitPlacement {
  return {
    id: unitId(args.id),
    name: args.id,
    team: teamId('team_a'),
    classId: classId('knight'),
    position: { x: 0, y: 0, layer: 0 },
    facing: 'N',
    baseStats: { spd: args.spd ?? 9, pa: 5, ma: 4, maxHpBase: 100, maxMpBase: 50, brave: 100, faith: 80, crit_chance: 0, crit_multiplier: 1 },
    vitals: { hp: 100, mp: 0 },
    loadout: { actionBuckets: { [FIRST]: [commandSetId('battle_skill')] }, passiveBuckets: {} },
    equipment: {
      leftHand: null,
      rightHand: null,
      headgear: null,
      armor: null,
      accessory: args.accessory ?? null,
    },
    ...(args.initialCT !== undefined ? { initialCT: args.initialCT } : {}),
  };
}

function config(units: ReadonlyArray<UnitPlacement>): BattleConfig {
  return {
    battleId: 'greaves-test',
    rulesetId: rulesetId('default'),
    map: { width: 4, height: 4, tiles: Array.from({ length: 16 }, (_, i) => ({
      x: i % 4, y: Math.floor(i / 4), layer: 0, elevation: 0, terrain: 'ground' as const, properties: [],
    })) },
    teams: [{ id: teamId('team_a'), name: 'A', control: 'ai' }],
    units,
    victoryConditions: [],
    masterSeed: 12345,
  };
}

function ctOf(cfg: BattleConfig, id: string): number {
  const state = runPreBattlePhase(createInitialState(cfg, cat), cfg, cat);
  const u = state.units.get(unitId(id));
  if (u === undefined) throw new Error('unit missing');
  return u.ct;
}

describe('S74 — Greaves of Seraphis CT seed', () => {
  it('seeds the wearer to the pre-trigger ceiling (99) at battle start', () => {
    const cfg = config([knight({ id: 'wearer', accessory: greavesOfSeraphis.id })]);
    expect(ctOf(cfg, 'wearer')).toBe(99);
  });

  it('a non-wearer takes the formula draw (well below the ceiling)', () => {
    const cfg = config([knight({ id: 'plain' })]);
    expect(ctOf(cfg, 'plain')).toBeLessThan(99);
  });

  it('overrides an explicit placement.initialCT', () => {
    const cfg = config([knight({ id: 'wearer', accessory: greavesOfSeraphis.id, initialCT: 10 })]);
    expect(ctOf(cfg, 'wearer')).toBe(99);
  });

  it('grants Speed +2 (the stat-mod half) via modifyStatQuery', () => {
    const base = config([knight({ id: 'plain', spd: 9 })]);
    const geared = config([knight({ id: 'wearer', spd: 9, accessory: greavesOfSeraphis.id })]);
    const baseState = createInitialState(base, cat);
    const gearedState = createInitialState(geared, cat);
    const baseSpeed = computeSpeed(baseState, unitId('plain'), cat);
    const gearedSpeed = computeSpeed(gearedState, unitId('wearer'), cat);
    expect(gearedSpeed).toBe(baseSpeed + 2);
  });
});
