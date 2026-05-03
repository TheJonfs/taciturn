// ItemDefinition — the catalog definition of an equippable or consumable
// item.
//
// Minimal session-2 shape. Slot, stat contributions, and hook registrations
// arrive with the equipment system in session 5+.

import type { ItemId } from '../../types/index.ts';

export interface ItemDefinition {
  readonly id: ItemId;
  readonly name: string;
}
