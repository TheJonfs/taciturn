// Test-only fixtures for status tests. Not picked up by Vitest's pattern.

import { createCatalog, type Catalog, type StatusEffectType } from '../catalog/index.ts';
import type { StatusHookRegistration } from './hooks.ts';
import {
  statusTypeId,
  type StackingRule,
  type StatusInstance,
  type StatusTypeId,
  type UnitId,
} from '../types/index.ts';

export interface MakeStatusTypeArgs {
  readonly id: string;
  readonly stackingRule?: StackingRule;
  readonly defaultMagnitude?: number;
  readonly hooks?: ReadonlyArray<StatusHookRegistration>;
  readonly tags?: ReadonlyArray<string>;
}

export function makeStatusType(args: MakeStatusTypeArgs): StatusEffectType {
  return {
    id: statusTypeId(args.id),
    name: args.id,
    tags: args.tags ?? [],
    durationMode: 'per_unit_ct',
    stackingRule: args.stackingRule ?? 'REFRESH',
    ...(args.defaultMagnitude !== undefined ? { defaultMagnitude: args.defaultMagnitude } : {}),
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
}): StatusInstance {
  return {
    typeId: statusTypeId(args.typeId),
    source: { unitId: args.sourceUnitId ?? null, actionSeq: args.sourceActionSeq ?? null },
    remainingDuration: args.remainingDuration ?? 5,
    ...(args.magnitude !== undefined ? { magnitude: args.magnitude } : {}),
    ...(args.stacks !== undefined ? { stacks: args.stacks } : {}),
  };
}

export function catalogWith(types: ReadonlyArray<StatusEffectType>): Catalog {
  return createCatalog({
    statusTypes: types,
    abilities: [],
    classes: [],
    items: [],
  });
}

// Re-export for convenience: callers that build a status type often want
// the matching id back as a branded UnitId / StatusTypeId.
export function asStatusTypeId(id: string): StatusTypeId {
  return statusTypeId(id);
}
