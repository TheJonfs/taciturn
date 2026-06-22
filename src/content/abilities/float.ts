// Float — Movement-bucket passive. The Enchanter's Movement (S72): a
// water-crosser with hazard immunity, deliberately WITHOUT any elevation
// effect (brief D2 — Float is not Fly).
//
// Two effects through the existing hook surface:
//   1. `modifyTerrainCosts` on the `'water'` tag: drops every water tile's
//      move cost to min(cost, 1) — water_shallow 2 → 1 and water_deep 3 → 1
//      on the v1 ruleset. Fully negates the water penalty (stronger than
//      Tidewalker, which only shaves one point: shallow 2 → 1, deep 3 → 2).
//      Future water variants inherit the negation once they register the
//      tag.
//   2. `modifySystemDamage` returns 0 when `source.kind === 'falling'` — the
//      Bedrock Stride pattern. Immunity to fall damage from elevation drops
//      (knockback over a ledge, a Pit/Valley collapse underfoot) — the v1
//      "ground hazard." The source-discriminant gate leaves Poison ticks,
//      `ability_self_cost`, and ordinary attacks untouched.
//
// No canEnter change: under S33's universal-water-enter convention every
// class can already step into water (at a cost penalty), so Float's job is
// to remove the penalty + the fall risk, not to grant eligibility. No
// elevation / Jump effect by design — crossing deep water and shrugging off
// a fall is the whole kit.
//
// Cost-2 in v1 (S72): two effects (full water-cost negation + fall immunity)
// price at the Mage-Movement tier (Bedrock Stride 2, Hotfoot 2). Revived
// from the S48 `'hidden'` suppression now that the Enchanter adopts it.

import {
  abilityId,
  bucketId,
  mapTerrainCostsByTag,
  passiveHook,
  type PassiveAbilityDefinition,
} from '@engine/index.ts';

export const float: PassiveAbilityDefinition = {
  id: abilityId('float'),
  name: 'Float',
  kind: 'passive',
  bucket: bucketId('movement'),
  baseCost: 2,
  availability: 'available',
  hooks: [
    passiveHook('modifyTerrainCosts', (args) =>
      mapTerrainCostsByTag(args.baseValue, args.terrainRegistry, 'water', (c) =>
        Math.min(c, 1),
      ),
    ),
    passiveHook('modifySystemDamage', (args) =>
      args.source.kind === 'falling' ? 0 : args.baseAmount,
    ),
  ],
};
