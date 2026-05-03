// AbilityDefinition — the catalog definition of an ability.
// See docs/design/ability-slots.md and docs/design/action-resolution.md.
//
// Session 5 added the slot/cost/kind fields and the passive `hooks` list.
// Session 7 will add the action payload and effect specification;
// session 8 the damage parameters.
//
// Discriminated by `kind`:
// - `'active'`  — usable inside a command set; lives only inside an
//   ActiveBucket (via its containing CommandSet). Its `bucket` field
//   identifies which Active bucket the *containing command set* lives
//   in for cost-accounting purposes when needed; v1 active buckets
//   are capacity 1 / cost 1 so this rarely matters today.
// - `'passive'` — equipped directly into a Passive bucket. Its hook
//   handlers (per ADR-0005's typing pattern) fire while equipped via
//   the source-agnostic engine/hooks/ collector and runners.

import type { AbilityId, BucketId } from '../../types/index.ts';
import type { PassiveHookRegistration } from '../../abilities/hooks.ts';

interface AbilityCommon {
  readonly id: AbilityId;
  readonly name: string;
  // The bucket this ability is priced against. For passives, this
  // determines which Passive bucket it equips into. For actives, it
  // identifies its slot category (first_action vs second_action) for
  // future cost-accounting needs.
  readonly bucket: BucketId;
  // Pre-modifier base cost. Per-character cost (`getCost`) may reduce
  // this to 0 via class grants or other modulations.
  readonly baseCost: number;
}

export interface ActiveAbilityDefinition extends AbilityCommon {
  readonly kind: 'active';
}

export interface PassiveAbilityDefinition extends AbilityCommon {
  readonly kind: 'passive';
  readonly hooks: ReadonlyArray<PassiveHookRegistration>;
}

export type AbilityDefinition = ActiveAbilityDefinition | PassiveAbilityDefinition;
