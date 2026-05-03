// Test-only fixtures for abilities subsystem tests.
// Does not match Vitest's pattern, so it's not picked up as a test file.
//
// Builds Knight-class catalogs with whatever set of abilities and
// command sets a test needs, plus loadout helpers that wrap the
// EMPTY_LOADOUT in a typed builder pattern.

import { createCatalog, type Catalog } from '../catalog/index.ts';
import type {
  AbilityDefinition,
  ActiveAbilityDefinition,
  ClassDefinition,
  CommandSetDefinition,
} from '../catalog/index.ts';
import { defaultTestRulesets } from '../catalog/test-fixtures.ts';
import {
  abilityId,
  bucketId,
  classId,
  commandSetId,
  EMPTY_LOADOUT,
  type AbilityId,
  type BucketId,
  type CommandSetId,
  type Loadout,
} from '../types/index.ts';
import type { PassiveHookRegistration } from './hooks.ts';
import {
  ACTIVE_BUCKET_IDS,
  PASSIVE_BUCKET_IDS,
} from './constants.ts';

export function makePassive(args: {
  readonly id: string;
  readonly bucket: BucketId;
  readonly baseCost?: number;
  readonly hooks?: ReadonlyArray<PassiveHookRegistration>;
}): AbilityDefinition {
  return {
    id: abilityId(args.id),
    name: args.id,
    kind: 'passive',
    bucket: args.bucket,
    baseCost: args.baseCost ?? 1,
    hooks: args.hooks ?? [],
  };
}

export function makeActive(args: {
  readonly id: string;
  readonly bucket?: BucketId;
  readonly baseCost?: number;
  readonly targeting?: ActiveAbilityDefinition['targeting'];
  readonly chargeTicks?: number;
  readonly mpCost?: number;
  readonly effects?: ActiveAbilityDefinition['effects'];
}): ActiveAbilityDefinition {
  return {
    id: abilityId(args.id),
    name: args.id,
    kind: 'active',
    bucket: args.bucket ?? bucketId('first_action'),
    baseCost: args.baseCost ?? 1,
    targeting: args.targeting ?? { kind: 'self' },
    chargeTicks: args.chargeTicks ?? 0,
    mpCost: args.mpCost ?? 0,
    effects: args.effects ?? {},
  };
}

export function makeCommandSet(args: {
  readonly id: string;
  readonly members?: ReadonlyArray<string>;
  readonly baseCost?: number;
}): CommandSetDefinition {
  return {
    id: commandSetId(args.id),
    name: args.id,
    members: (args.members ?? []).map(abilityId),
    baseCost: args.baseCost ?? 1,
  };
}

export function makeKnight(args?: {
  readonly freeAbilities?: ReadonlyArray<string>;
  readonly firstActionCommandSet?: string;
}): ClassDefinition {
  return {
    id: classId('knight'),
    name: 'Knight',
    movement: {
      moveRange: 3,
      jump: 2,
      terrainCosts: new Map(),
      canEnter: new Set(['ground']),
    },
    firstActionCommandSet: commandSetId(args?.firstActionCommandSet ?? 'battle_skill'),
    freeAbilities: new Set((args?.freeAbilities ?? []).map(abilityId)),
  };
}

export function makeAbilitiesCatalog(args: {
  readonly abilities?: ReadonlyArray<AbilityDefinition>;
  readonly commandSets?: ReadonlyArray<CommandSetDefinition>;
  readonly classes?: ReadonlyArray<ClassDefinition>;
}): Catalog {
  return createCatalog({
    statusTypes: [],
    abilities: args.abilities ?? [],
    commandSets: args.commandSets ?? [makeCommandSet({ id: 'battle_skill' })],
    classes: args.classes ?? [makeKnight()],
    items: [],
    rulesets: defaultTestRulesets,
  });
}

export function loadoutOf(args: {
  readonly active?: ReadonlyArray<readonly [BucketId, CommandSetId | null]>;
  readonly passive?: ReadonlyArray<readonly [BucketId, ReadonlyArray<AbilityId>]>;
}): Loadout {
  const actionBuckets: Record<string, CommandSetId | null> = {};
  for (const b of ACTIVE_BUCKET_IDS) actionBuckets[b] = null;
  for (const [b, v] of args.active ?? []) actionBuckets[b] = v;
  const passiveBuckets: Record<string, ReadonlyArray<AbilityId>> = {};
  for (const b of PASSIVE_BUCKET_IDS) passiveBuckets[b] = [];
  for (const [b, v] of args.passive ?? []) passiveBuckets[b] = v;
  return { actionBuckets, passiveBuckets };
}

// Class-pinned loadout helper. Sets first_action to the named command
// set so the first_action class-pin (session 7) is satisfied by default.
// Use this whenever a test goes through `validateLoadout` or
// `createInitialState` for a Knight-class unit.
export function knightLoadout(args?: {
  readonly active?: ReadonlyArray<readonly [BucketId, CommandSetId | null]>;
  readonly passive?: ReadonlyArray<readonly [BucketId, ReadonlyArray<AbilityId>]>;
}): Loadout {
  const active: Array<readonly [BucketId, CommandSetId | null]> = [
    [bucketId('first_action'), commandSetId('battle_skill')],
  ];
  if (args?.active) {
    for (const entry of args.active) active.push(entry);
  }
  return loadoutOf({ active, ...(args?.passive !== undefined ? { passive: args.passive } : {}) });
}

export { EMPTY_LOADOUT };
