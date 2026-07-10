// void_vulnerable_proc — TABA M3 (Void Robe). Hidden single-target
// Vulnerable application fired by the robe's `spellProcs` rider on
// every landed lightning-tagged damage event.
//
// UNLIKE the weapon procs (flat applyAlways), this rolls the standard
// BMG status-application formula at baseChance 50 — the lineup's
// "Vulnerable 50% (MA/Faith-scaled)" — so a high-Faith caster marks
// more reliably and a lightning-resistant target shrugs more often
// (Vulnerable carries the lightning resistance tag). Magnetic Mark's
// application convention, delivered by gear.
//
// Vulnerable is the existing one-shot ×1.5 amp, REFRESH stacking — the
// robe re-arms it, never compounds it (the doc's stack/refresh question
// resolves to the status's own REFRESH rule).

import {
  abilityId,
  bucketId,
  statusTypeId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const voidVulnerableProc: ActiveAbilityDefinition = {
  id: abilityId('void_vulnerable_proc'),
  name: 'Void Mark',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'hidden',
  tags: ['lightning'],
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
        typeId: statusTypeId('vulnerable'),
        target: 'primary_target',
        baseChance: 50,
      },
    ],
  },
};
