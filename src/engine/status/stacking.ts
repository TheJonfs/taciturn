// Stacking rule dispatch.
//
// Given an incoming candidate instance and the existing instances of the
// same type on the target unit, returns the new ordered list of
// instances of that type, the application outcome (refreshed, replaced,
// stacked, applied, or rejected), and the set of instances whose
// lifecycle hooks (onApply / onRemove) should fire.
//
// Lifecycle nuance: REFRESH and STACK_ADDITIVE *semantically* mutate an
// existing instance (duration resets / magnitude grows) — even though
// the immutability rule means we produce a new object reference. They
// do NOT fire onApply/onRemove. REPLACE and REPLACE_IF_STRONGER (yes
// branch) fire both. STACK_INDEPENDENT fires onApply on the new
// instance. The dispatch returns these decisions so applyStatus
// doesn't have to re-derive them.
//
// All six rules from docs/design/status-effects.md are implemented;
// the Haste demo only exercises REFRESH, but the others having tests
// is what makes the dispatch shape honest.

import type { StatusEffectType } from '../catalog/index.ts';
import type { StatusInstance } from '../types/index.ts';
import type { StatusApplicationResult } from './result.ts';

export interface StackingLifecycle {
  // Instances whose onRemove handlers should fire (because they were
  // removed from the unit by this application).
  readonly removed: ReadonlyArray<StatusInstance>;
  // Instances whose onApply handlers should fire (because they were
  // newly added to the unit by this application).
  readonly added: ReadonlyArray<StatusInstance>;
}

export interface StackingDispatchOutcome {
  readonly newInstancesOfType: ReadonlyArray<StatusInstance>;
  readonly result: StatusApplicationResult;
  readonly lifecycle: StackingLifecycle;
}

const NO_LIFECYCLE: StackingLifecycle = { removed: [], added: [] };

export function applyStackingRule(
  type: StatusEffectType,
  existing: ReadonlyArray<StatusInstance>,
  incoming: StatusInstance,
): StackingDispatchOutcome {
  if (existing.length === 0) {
    return {
      newInstancesOfType: [incoming],
      result: { kind: 'applied', instance: incoming },
      lifecycle: { removed: [], added: [incoming] },
    };
  }

  switch (type.stackingRule) {
    case 'REJECT':
      return {
        newInstancesOfType: existing,
        result: { kind: 'rejected', reason: 'stacking_rule' },
        lifecycle: NO_LIFECYCLE,
      };

    case 'REFRESH': {
      // Semantically updates the head's duration; new object due to
      // immutability, but no lifecycle hook fires.
      const head = existing[0]!;
      const refreshed: StatusInstance = {
        ...head,
        remainingDuration: incoming.remainingDuration,
      };
      return {
        newInstancesOfType: [refreshed, ...existing.slice(1)],
        result: { kind: 'refreshed', instance: refreshed },
        lifecycle: NO_LIFECYCLE,
      };
    }

    case 'REPLACE': {
      const previous = existing[0]!;
      return {
        newInstancesOfType: [incoming],
        result: { kind: 'replaced', previousInstance: previous, instance: incoming },
        lifecycle: { removed: [previous], added: [incoming] },
      };
    }

    case 'REPLACE_IF_STRONGER': {
      const previous = existing[0]!;
      const incomingMag = incoming.magnitude ?? 0;
      const previousMag = previous.magnitude ?? 0;
      if (incomingMag > previousMag) {
        return {
          newInstancesOfType: [incoming],
          result: { kind: 'replaced', previousInstance: previous, instance: incoming },
          lifecycle: { removed: [previous], added: [incoming] },
        };
      }
      return {
        newInstancesOfType: existing,
        result: { kind: 'rejected', reason: 'stacking_rule' },
        lifecycle: NO_LIFECYCLE,
      };
    }

    case 'STACK_INDEPENDENT': {
      // All instances coexist; each carries its own duration/magnitude.
      // The new instance is genuinely added — fire onApply on it.
      return {
        newInstancesOfType: [...existing, incoming],
        result: { kind: 'stacked', mode: 'independent', instance: incoming },
        lifecycle: { removed: [], added: [incoming] },
      };
    }

    case 'STACK_ADDITIVE': {
      // Magnitudes add; duration refreshes; stacks count incremented.
      // The collapsed instance preserves the head's source attribution
      // (the original applier "owns" the stack); semantically a mutation
      // of the existing instance — no lifecycle hook.
      const head = existing[0]!;
      const incomingMag = incoming.magnitude ?? 0;
      const previousMag = head.magnitude ?? 0;
      const stacks = (head.stacks ?? 1) + 1;
      const merged: StatusInstance = {
        ...head,
        magnitude: previousMag + incomingMag,
        remainingDuration: incoming.remainingDuration,
        stacks,
      };
      return {
        newInstancesOfType: [merged, ...existing.slice(1)],
        result: { kind: 'stacked', mode: 'additive', instance: merged },
        lifecycle: NO_LIFECYCLE,
      };
    }
  }
}
