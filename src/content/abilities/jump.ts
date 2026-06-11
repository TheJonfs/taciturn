// Jump — the Templar's offensive pillar (S62, Dragoon Jump). A charged
// off-field leap: the unit vaults off the board (airborne, untargetable)
// while it charges, then comes down on a target tile for a heavy strike,
// landing back on its own tile.
//
// Mechanism (ADR-0103):
//   - `effects.jumpLeap` → the caster goes `airborne` at charge commit
//     (untargetable — safe mid-air) and clears it at resolution, landing on
//     its (reserved) takeoff tile. No relocation.
//   - `chargeSpeedFromUnitSpeed: 3` → the ChargedAction's CT rate is
//     3 × the caster's *computed* Speed (Haste composes), so the telegraph
//     shrinks as Speed is invested — a third build axis (Speed) orthogonal
//     to PA/MA. `actionSpeed` (24) is just the >0 "is charged" flag; the
//     Speed formula overrides the rate.
//   - Damage `PA × WP × (1 + isLance)` — `power_coefficient: 1` + the
//     `lanceBonus` flag doubles it when a Lance is wielded (the canonical
//     Dragoon reward; reads the new `'lance'` tag).
//
// Tile-targeted at H6/V6 (arc — leaps over obstacles, no LoS). Tile (not
// unit) so the target's dodge window is real: vacate the tile before the
// leap lands and it whiffs. The V6 reach is the roster's answer to
// perch-camping — it beats melee's vertical-3 defence. Range likely tunes
// down after playtest (concept-notes). MP 6.
//
// NOT 'weapon'-tagged: Jump keeps its own H6/V6 range rather than forking to
// the Lance's H2 weapon range. `physical_pa_wp` still reads the equipped
// weapon's WP (it keys on the 'physical' tag, not 'weapon').

import {
  abilityId,
  bucketId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const jump: ActiveAbilityDefinition = {
  id: abilityId('jump'),
  name: 'Jump',
  kind: 'active',
  bucket: bucketId('secondary_command_sets'),
  baseCost: 1,
  availability: 'hidden',
  tags: ['physical'],
  targeting: {
    kind: 'tile',
    range: { horizontal: 6, vertical: 6 },
    rangeMode: 'arc',
  },
  actionSpeed: 24, // >0 marks it charged; chargeSpeedFromUnitSpeed sets the rate
  chargeSpeedFromUnitSpeed: 3,
  mpCost: 6,
  effects: {
    jumpLeap: true,
    damage: {
      tags: ['physical'],
      power_coefficient: 1,
      lanceBonus: true,
    },
  },
};
