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
  rulesetId,
  teamId,
  unitId as mkUnitId,
  type ChargedAction,
  type GameState,
  type Loadout,
  type Position,
  type StatusInstance,
  type Unit,
  type UnitId,
} from '../types/index.ts';

export function makeUnit(overrides: {
  readonly id: string;
  readonly spd: number;
  readonly ct?: number;
  readonly team?: string;
  readonly hp?: number;
  readonly mp?: number;
  readonly statuses?: ReadonlyArray<StatusInstance>;
  readonly classId?: string;
  readonly position?: Position;
  readonly loadout?: Loadout;
}): Unit {
  return {
    id: mkUnitId(overrides.id),
    team: teamId(overrides.team ?? 'team_a'),
    name: overrides.id,
    classState: { currentClass: mkClassId(overrides.classId ?? 'knight') },
    loadout: overrides.loadout ?? EMPTY_LOADOUT,
    position: overrides.position ?? { x: 0, y: 0, layer: 0 },
    facing: 'N',
    ct: overrides.ct ?? 0,
    baseStats: { spd: overrides.spd },
    vitals: { hp: overrides.hp ?? 100, mp: overrides.mp ?? 0 },
    statuses: overrides.statuses ?? [],
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
}): GameState {
  const unitMap = new Map<UnitId, Unit>();
  for (const u of args.units ?? []) unitMap.set(u.id, u);
  return {
    battleId: 'test',
    map: args.map ?? { width: 0, height: 0, tiles: [] },
    teams: [],
    ruleset: { id: rulesetId('default') },
    units: unitMap,
    chargedActions: args.chargedActions ?? [],
    globalEffects: [],
    tick: args.tick ?? 0,
    turnState: {},
    rng: { masterSeed: 0, nextSeq: 0 },
    actionLog: [],
  };
}
