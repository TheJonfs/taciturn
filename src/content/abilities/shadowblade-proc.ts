// Speed Steal — hidden proc ability fired by the Shadowblade's 50%
// on-hit (TABA Ch3 unique).
//
// One proc, two applications: Speed Up (+1 Spd, permanent, stacking) on
// the WIELDER via `target: 'caster'`, Speed Down (−1 Spd, permanent,
// stacking) on the victim via `target: 'primary_target'`. Both stack
// permanently, both directions — settled Ch3-brief ruling; the widening
// tempo gap is the knife's identity. Degenerate only vs HP-sponge
// bosses, where the lever is boss Speed-Down resistance, not a change
// here.
//
// Proc convention mirrors Magebane (Chris's ruling for this weapon):
// the weapon-side `attackProcs[].chance` is a flat 50% — no Brave/PA
// gate — and the applications here use `applyAlways: true`, so only the
// TARGET-side modifier chain bends the Speed Down (the self-side Speed
// Up always lands on a landed proc).

import {
  abilityId,
  bucketId,
  statusTypeId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const shadowbladeProc: ActiveAbilityDefinition = {
  id: abilityId('shadowblade_proc'),
  name: 'Speed Steal',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'hidden',
  tags: [],
  targeting: {
    kind: 'single_unit',
    range: { horizontal: 1, vertical: 1 },
    rangeMode: 'melee',
  },
  actionSpeed: 0,
  mpCost: 0,
  effects: {
    statusEffects: [
      {
        typeId: statusTypeId('speed_up'),
        target: 'caster',
        applyAlways: true,
      },
      {
        typeId: statusTypeId('speed_down'),
        target: 'primary_target',
        applyAlways: true,
      },
    ],
  },
};
