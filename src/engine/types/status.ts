// Status instance — a per-unit application of a status type.
// See docs/design/status-effects.md ("Status type and instance").
//
// The instance carries everything per-application; the type
// (StatusEffectType, in catalog/) carries everything universal to that
// kind of effect. Identity-by-ID — `typeId` references the catalog.

import type { ItemId, StatusTypeId, UnitId } from './ids.ts';

export interface StatusInstanceSource {
  // null when the status was applied by something other than a unit
  // (e.g., environmental effect, system action, initial state, or an
  // equipment grant — see `kind` below).
  readonly unitId: UnitId | null;
  // null when the status was not applied as part of a logged Action
  // (e.g., applied during initial state construction).
  readonly actionSeq: number | null;
  // Source provenance discriminator (per ADR-0028). When omitted,
  // implicit `'unit'` — preserves backward compatibility with sources
  // built before equipment integration. `'equipment'` flags statuses
  // applied by an equipped item (e.g., Boots of Haste granting Haste);
  // these statuses are immune to in-battle removal until the equipment
  // itself is removed.
  readonly kind?: 'unit' | 'equipment';
  // Set when `kind === 'equipment'` — the item id of the equipping
  // source. Allows later lookup back to the granting equipment for the
  // mid-battle-equipment-removal path (deferred per ADR-0028).
  readonly equipmentId?: ItemId;
}

export interface StatusInstance {
  readonly typeId: StatusTypeId;
  readonly source: StatusInstanceSource;

  // Remaining duration in the units of the type's `durationMode`.
  // null for permanent and conditional modes — those never decrement.
  // Decrement is the turn loop's job (session 9); session 3 only sets
  // and reads.
  remainingDuration: number | null;

  // Per-instance numeric strength when the type declares it meaningful
  // (Haste's Speed multiplier, Poison damage, Regen healing, etc.).
  // Statuses with no notion of strength (Stop, Don't Move, Silence) omit it.
  readonly magnitude?: number;

  // Stack count for rules that accumulate (STACK_INDEPENDENT,
  // STACK_ADDITIVE). For non-stacking rules, omitted.
  readonly stacks?: number;

  // Escape hatch for status-specific instance state not captured by
  // the standard fields. The Charging status uses this to carry the
  // ChargedActionId of the spell whose cast it pairs with. Avoided
  // where possible — most statuses fit duration/magnitude/stacks.
  readonly customState?: Readonly<Record<string, unknown>>;
}
