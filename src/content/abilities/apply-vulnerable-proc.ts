// apply_vulnerable_proc — TABA M3 (Ch1 equipment). Hidden single-target
// Vulnerable application fired by the Dagger's `attackProcs`.
//
// Mirrors `apply_burn_proc` (Session 31): the flat-percentage gate is
// the weapon-side `attackProcs[].chance` (Dagger: 50%); once the proc
// lands, the application short-circuits the BMG chance formula via
// `applyAlways: true`. Distinct from Magnetic Mark (the Lightning
// Mage's charged, Faith-gated, MP-costed Vulnerable applier) — this is
// a weapon rider, decoupled from the wielder's casting prowess.
//
// Vulnerable itself is the existing one-shot × 1.5 next-damage amp
// (REFRESH stacking — repeat procs re-arm, never compound).
//
// MP-free, hidden, instant. Never appears in a command menu — only
// fired from the attackProcs substrate via riderSource.

import {
  abilityId,
  bucketId,
  statusTypeId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const applyVulnerableProc: ActiveAbilityDefinition = {
  id: abilityId('apply_vulnerable_proc'),
  name: 'Vulnerable',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'hidden',
  tags: ['lightning'],
  targeting: {
    kind: 'single_unit',
    // Range is irrelevant for rider-fired emission (the proc handler
    // emits against `ctx.target.id` directly); declared 1H/1V so the
    // ability self-describes a "melee" reach if it ever surfaces in a
    // non-rider context.
    range: { horizontal: 1, vertical: 1 },
    rangeMode: 'melee',
  },
  actionSpeed: 0,
  mpCost: 0,
  effects: {
    statusEffects: [
      {
        typeId: statusTypeId('vulnerable'),
        target: 'primary_target',
        applyAlways: true,
      },
    ],
  },
};
