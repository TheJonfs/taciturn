// Earth Resilience (display: Landwalker) — Geosage's Reaction.
//
// On taking damage from a non-healing-tagged hit, self-applies a
// `movement_self_buff` instance — +1 Move for 6 CT-units (S48: dropped
// the +1 Jump component to keep the stacking-mobility-reaction family
// — Landwalker / Updraft / Speed Save — each axis-specific).
// STACK_INDEPENDENT means each trigger creates a new instance with its
// own timer; repeated triggers stack additively (3 hits in quick
// succession → +3 Move until the timers age out).
//
// Per session 16 plaintext review: baseCost 2 (powerful when triggered
// multiple times). Brave-gated trigger per ADR-0021 — fires probabilistically
// at lower Brave; deterministic at Brave 100.
//
// Compiled via `compileReaction` from the spec-driven reaction shape
// (per ADR-0017 / ADR-0024). Counter is the parallel worked example.

import {
  abilityId,
  bucketId,
  compileReactionAbility,
  statusTypeId,
  type PassiveAbilityDefinition,
} from '@engine/index.ts';

export const earthResilience: PassiveAbilityDefinition = compileReactionAbility(
  {
    id: abilityId('earth_resilience'),
    // S40 name-update pass: display name 'Landwalker'; id preserved.
    name: 'Landwalker',
    bucket: bucketId('reaction'),
    baseCost: 1,
    availability: 'available',
    tags: ['magical', 'earth'],
  },
  {
    triggerOn: ['onActionTargeted'],
    triggerCondition: {
      type: 'damage_received',
      // Only triggers when actual damage lands. Misses don't trigger
      // (the reactor wasn't actually hit).
      minDamage: 1,
      damageTagsNone: ['healing'],
    },
    effects: [
      {
        kind: 'apply_status',
        statusTypeId: statusTypeId('movement_self_buff'),
        targetSelector: 'self',
        magnitude: 1,
        duration: 6,
      },
    ],
  },
);
