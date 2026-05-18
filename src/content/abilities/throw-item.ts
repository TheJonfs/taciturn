// Throw Item — Alchemist Command Set entry (Session 39b).
//
// UI handle for the S39a `use_throw_item` action. Targeting kind is
// `single_unit` with the throw range (3 horizontal × 3 vertical with
// LoS — see `THROW_ITEM_RANGE` in `engine/actions/validate.ts`). The
// ability shell declares the same range so the picker overlay and
// validation agree.
//
// The action-menu FSM detects this ability by id (`throw_item`) and
// routes through: target-select → `throw-item-item-select` (new
// state). The commit emits `use_throw_item` (not `use_ability`) with
// the player-picked itemId and target — see `src/ui/use-turn-flow.ts`
// for the routing.

import {
  abilityId,
  bucketId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const throwItem: ActiveAbilityDefinition = {
  id: abilityId('throw_item'),
  name: 'Throw Item',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 0,
  availability: 'available',
  targeting: {
    kind: 'single_unit',
    range: { horizontal: 3, vertical: 3 },
    // 'arc' matches spell-style reach: any tile within 3 horizontal /
    // 3 vertical that has arc visibility (uncovered source + target).
    // Straight-line would have restricted throws to a single row /
    // column, which isn't the intent — see Chris's S39b bug report.
    rangeMode: 'arc',
  },
  actionSpeed: 0,
  mpCost: 0,
  effects: {},
};
