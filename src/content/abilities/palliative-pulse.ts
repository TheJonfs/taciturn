// palliative_pulse — TABA M3 (Palliative Pike). Hidden self-anchored
// ally-only heal fired by the pike's 100% attackProcs rider on every
// LANDED hit (the proc contributor gates on ctx.hit — the doc's
// on-successful-hit confirm).
//
// Diamond-1 around the WIELDER (targeting self + AoE), allies only
// (`teamFilter: 'allies_only'` — the first consumer of the
// ally-discriminating AoE filter; enemies standing in the diamond are
// skipped, not healed). The wielder is excluded (default excludeCaster):
// the doc's "allies in diamond-1 around the wielder."
//
// Heal = MA × 4 flat (`noFaithScaling` — deterministic, per the doc's
// "restore MA×4 HP"). No 'weapon' damage tag, so the attack-as-heal
// WP scaling never applies here. Ability-level 'magical' tag makes
// Aether Bloom's expander grow the pulse to diamond-2 — the doc's
// "expandable by Aether Bloom" confirm, which falls out of the proc
// being a real use_ability running the normal modifyAoeShape chain.
//
// Built-in tension (the design's own note): allies must cluster around
// the wielder to collect the heal, and a cluster is an enemy-AoE
// target — the reward is its own risk.

import {
  abilityId,
  bucketId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const palliativePulse: ActiveAbilityDefinition = {
  id: abilityId('palliative_pulse'),
  name: 'Palliative Pulse',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'hidden',
  tags: ['magical', 'healing'],
  targeting: {
    kind: 'self',
  },
  actionSpeed: 0,
  mpCost: 0,
  effects: {
    damage: {
      tags: ['healing'],
      power_coefficient: 4,
      noFaithScaling: true,
    },
    aoe: {
      shape: { kind: 'diamond', radius: 1 },
      verticalTolerance: 1,
      teamFilter: 'allies_only',
    },
  },
};
