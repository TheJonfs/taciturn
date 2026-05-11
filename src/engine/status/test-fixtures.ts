// Test-only fixtures for status tests. Not picked up by Vitest's pattern.

import { createCatalog, type Catalog, type StatusEffectType } from '../catalog/index.ts';
import { defaultTestRulesets } from '../catalog/test-fixtures.ts';
import type { StatusHookRegistration } from './hooks.ts';
import {
  statusTypeId,
  type DamageTag,
  type DurationMode,
  type StackingRule,
  type StatusInstance,
  type StatusTypeId,
  type UnitId,
} from '../types/index.ts';

export interface MakeStatusTypeArgs {
  readonly id: string;
  readonly stackingRule?: StackingRule;
  readonly durationMode?: DurationMode;
  readonly defaultMagnitude?: number;
  readonly hooks?: ReadonlyArray<StatusHookRegistration>;
  readonly tags?: ReadonlyArray<string>;
  readonly resistanceTag?: DamageTag;
}

export function makeStatusType(args: MakeStatusTypeArgs): StatusEffectType {
  return {
    id: statusTypeId(args.id),
    name: args.id,
    tags: args.tags ?? [],
    durationMode: args.durationMode ?? 'per_unit_ct',
    stackingRule: args.stackingRule ?? 'REFRESH',
    ...(args.defaultMagnitude !== undefined ? { defaultMagnitude: args.defaultMagnitude } : {}),
    ...(args.resistanceTag !== undefined ? { resistanceTag: args.resistanceTag } : {}),
    hooks: args.hooks ?? [],
  };
}

export function makeStatusInstance(args: {
  readonly typeId: string;
  readonly magnitude?: number;
  readonly remainingDuration?: number | null;
  readonly stacks?: number;
  readonly sourceUnitId?: UnitId | null;
  readonly sourceActionSeq?: number | null;
  readonly customState?: Readonly<Record<string, unknown>>;
}): StatusInstance {
  return {
    typeId: statusTypeId(args.typeId),
    source: { unitId: args.sourceUnitId ?? null, actionSeq: args.sourceActionSeq ?? null },
    remainingDuration: args.remainingDuration ?? 5,
    ...(args.magnitude !== undefined ? { magnitude: args.magnitude } : {}),
    ...(args.stacks !== undefined ? { stacks: args.stacks } : {}),
    ...(args.customState !== undefined ? { customState: args.customState } : {}),
  };
}

export function catalogWith(types: ReadonlyArray<StatusEffectType>): Catalog {
  return createCatalog({
    statusTypes: types,
    abilities: [],
    commandSets: [],
    classes: [],
    items: [],
    rulesets: defaultTestRulesets,
  });
}

// Re-export for convenience: callers that build a status type often want
// the matching id back as a branded UnitId / StatusTypeId.
export function asStatusTypeId(id: string): StatusTypeId {
  return statusTypeId(id);
}
