// ClassDefinition — the catalog definition of a unit class.
// See docs/design/ability-slots.md and the deferred class/progression doc.
//
// Minimal session-2 shape. Session 5 adds command sets and bucket capacities;
// session 6 adds Speed and movement-profile baselines.

import type { ClassId } from '../../types/index.ts';

export interface ClassDefinition {
  readonly id: ClassId;
  readonly name: string;
}
