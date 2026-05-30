// Test-only fixture builders. Does not match Vitest's test pattern, so it
// is not picked up as a test file but can be imported from real test files.
//
// Keeps test setup lean and consistent across CT tests; the same factories
// will be useful in adjacent subsystems as they land.

import { createCatalog, type Catalog } from '../catalog/index.ts';
import { defaultTestRulesets } from '../catalog/test-fixtures.ts';
import {
  abilityId as mkAbilityId,
  chargedActionId as mkChargedActionId,
  classId as mkClassId,
  EMPTY_LOADOUT,
  EMPTY_UNIT_EQUIPMENT,
  rulesetId,
  teamId,
  unitId as mkUnitId,
  type ChargedAction,
  type DamageTag,
  type Direction,
  type GameState,
  type ItemId,
  type Loadout,
  type Position,
  type StatusInstance,
  type Unit,
  type UnitEquipment,
  type UnitId,
} from '../types/index.ts';

export function makeUnit(overrides: {
  readonly id: string;
  readonly spd: number;
  readonly pa?: number;
  readonly ma?: number;
  readonly maxHpBase?: number;
  readonly maxMpBase?: number;
  readonly brave?: number;
  readonly faith?: number;
  // Session 20: crit defaults to 0/1 in fixtures so pre-session-20 tests
  // that assert specific damage values stay deterministic. Tests that
  // exercise crit pass overrides explicitly.
  readonly crit_chance?: number;
  readonly crit_multiplier?: number;
  readonly ct?: number;
  readonly team?: string;
  readonly hp?: number;
  readonly mp?: number;
  readonly statuses?: ReadonlyArray<StatusInstance>;
  readonly resistances?: ReadonlyMap<DamageTag, number>;
  readonly classId?: string;
  readonly position?: Position;
  readonly facing?: Direction;
  readonly loadout?: Loadout;
  readonly equipment?: UnitEquipment;
  readonly stockpile?: ReadonlyMap<ItemId, number>;
  readonly turnsKOd?: number;
  readonly removed?: boolean;
}): Unit {
  return {
    id: mkUnitId(overrides.id),
    team: teamId(overrides.team ?? 'team_a'),
    name: overrides.id,
    classState: { currentClass: mkClassId(overrides.classId ?? 'knight') },
    loadout: overrides.loadout ?? EMPTY_LOADOUT,
    equipment: overrides.equipment ?? EMPTY_UNIT_EQUIPMENT,
    level: 25,
    position: overrides.position ?? { x: 0, y: 0, layer: 0 },
    facing: overrides.facing ?? 'N',
    ct: overrides.ct ?? 0,
    baseStats: {
      spd: overrides.spd,
      pa: overrides.pa ?? 5,
      ma: overrides.ma ?? 4,
      maxHpBase: overrides.maxHpBase ?? 100,
      maxMpBase: overrides.maxMpBase ?? 50,
      brave: overrides.brave ?? 100,
      faith: overrides.faith ?? 80,
      crit_chance: overrides.crit_chance ?? 0,
      crit_multiplier: overrides.crit_multiplier ?? 1,
    },
    vitals: { hp: overrides.hp ?? 100, mp: overrides.mp ?? 0 },
    resistances: overrides.resistances ?? new Map(),
    statuses: overrides.statuses ?? [],
    worldcraftEffects: [],
    stockpile: overrides.stockpile ?? new Map(),
    turnsKOd: overrides.turnsKOd ?? 0,
    removed: overrides.removed ?? false,
  };
}

// An empty Catalog — every CT test that doesn't care about statuses
// can pass this. Includes the default test ruleset so consumers that
// resolve `state.ruleset.id` find it. Tests that exercise hooks build
// a Catalog with their status types directly.
export function emptyCatalog(): Catalog {
  return createCatalog({
    statusTypes: [],
    abilities: [],
    commandSets: [],
    classes: [],
    items: [],
    rulesets: defaultTestRulesets,
  });
}

export function makeChargedAction(overrides: {
  readonly id: string;
  readonly speed: number;
  readonly ct?: number;
  readonly casterId?: string;
  readonly abilityId?: string;
  readonly sourceSequenceNumber?: number;
}): ChargedAction {
  return {
    id: mkChargedActionId(overrides.id),
    casterId: mkUnitId(overrides.casterId ?? 'caster'),
    ct: overrides.ct ?? 0,
    speed: overrides.speed,
    abilityId: mkAbilityId(overrides.abilityId ?? 'fireball'),
    targets: [],
    sourceSequenceNumber: overrides.sourceSequenceNumber ?? 0,
  };
}

export function makeGameState(args: {
  readonly units?: ReadonlyArray<Unit>;
  readonly chargedActions?: ReadonlyArray<ChargedAction>;
  readonly tick?: number;
  readonly map?: GameState['map'];
  readonly teams?: GameState['teams'];
  readonly turnState?: GameState['turnState'];
  readonly masterSeed?: number;
  readonly victoryConditions?: GameState['victoryConditions'];
  readonly outcome?: GameState['outcome'];
}): GameState {
  const unitMap = new Map<UnitId, Unit>();
  for (const u of args.units ?? []) unitMap.set(u.id, u);
  return {
    battleId: 'test',
    map: args.map ?? { width: 0, height: 0, tiles: [] },
    teams: args.teams ?? [],
    ruleset: { id: rulesetId('default') },
    units: unitMap,
    chargedActions: args.chargedActions ?? [],
    globalEffects: [],
    victoryConditions: args.victoryConditions ?? [],
    tick: args.tick ?? 0,
    turnState: args.turnState ?? null,
    rng: { masterSeed: args.masterSeed ?? 0, nextSeq: 0 },
    actionLog: [],
    ...(args.outcome !== undefined ? { outcome: args.outcome } : {}),
  };
}

// Build a turnState in-progress for the named unit. Used by tests that
// need to commit player actions (Move, UseAbility, Wait, SetFacing).
export function activeTurnFor(unitId: UnitId): NonNullable<GameState['turnState']> {
  return {
    unitId,
    budget: { movesAvailable: 1, actsAvailable: 1 },
    consumed: { movesConsumed: 0, actsConsumed: 0 },
    reactionsUsedThisTurn: new Map(),
  };
}
