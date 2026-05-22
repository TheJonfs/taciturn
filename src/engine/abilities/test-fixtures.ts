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

// Test-only definitions default to `availability: 'hidden'` so future
// team-builder integrations never pick them up — they're scaffolding
// for engine tests, not real content. Per ADR-0049.
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
    availability: 'hidden',
    hooks: args.hooks ?? [],
  };
}

export function makeActive(args: {
  readonly id: string;
  readonly bucket?: BucketId;
  readonly baseCost?: number;
  readonly targeting?: ActiveAbilityDefinition['targeting'];
  readonly actionSpeed?: number;
  readonly mpCost?: number;
  readonly effects?: ActiveAbilityDefinition['effects'];
}): ActiveAbilityDefinition {
  return {
    id: abilityId(args.id),
    name: args.id,
    kind: 'active',
    bucket: args.bucket ?? bucketId('first_action'),
    baseCost: args.baseCost ?? 1,
    availability: 'hidden',
    targeting: args.targeting ?? { kind: 'self' },
    actionSpeed: args.actionSpeed ?? 0,
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
    availability: 'hidden',
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
    evasion: { front: 0, side: 0, back: 0 },
    firstActionCommandSet: commandSetId(args?.firstActionCommandSet ?? 'battle_skill'),
    freeAbilities: new Set((args?.freeAbilities ?? []).map(abilityId)),
    equipmentSlots: {
      leftHand: true,
      rightHand: true,
      headgear: true,
      armor: true,
      accessory: true,
    },
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

// Per ADR-0061, active buckets hold lists. The `active` tuples accept
// either a CommandSetId (sugar for a single-entry list), null (empty),
// or an explicit list — keeps existing callsites terse while making the
// list-shape callable for tests that exercise Magus Crown's +1 bucket
// capacity in the secondary_command_sets bucket.
type ActiveEntry = CommandSetId | null | ReadonlyArray<CommandSetId>;

function asList(entry: ActiveEntry): ReadonlyArray<CommandSetId> {
  if (entry === null) return [];
  if (Array.isArray(entry)) return entry;
  return [entry as CommandSetId];
}

export function loadoutOf(args: {
  readonly active?: ReadonlyArray<readonly [BucketId, ActiveEntry]>;
  readonly passive?: ReadonlyArray<readonly [BucketId, ReadonlyArray<AbilityId>]>;
}): Loadout {
  const actionBuckets: Record<string, ReadonlyArray<CommandSetId>> = {};
  for (const b of ACTIVE_BUCKET_IDS) actionBuckets[b] = [];
  for (const [b, v] of args.active ?? []) actionBuckets[b] = asList(v);
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
  readonly active?: ReadonlyArray<readonly [BucketId, ActiveEntry]>;
  readonly passive?: ReadonlyArray<readonly [BucketId, ReadonlyArray<AbilityId>]>;
}): Loadout {
  const active: Array<readonly [BucketId, ActiveEntry]> = [
    [bucketId('first_action'), commandSetId('battle_skill')],
  ];
  if (args?.active) {
    for (const entry of args.active) active.push(entry);
  }
  return loadoutOf({ active, ...(args?.passive !== undefined ? { passive: args.passive } : {}) });
}

export { EMPTY_LOADOUT };
