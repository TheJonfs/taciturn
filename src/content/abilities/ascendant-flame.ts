// Ascendant Flame — Lumen's signature (TABA chapter-1 plot unit).
//
// A free, innate, always-equipped passive: multiply any FIRE-tagged damage
// Lumen deals by `1 + 0.1 × chapter` (×1.1 / ×1.2 / ×1.3 across the 3-chapter
// campaign). A fire-only, chapter-bounded second Conductor — potent but not
// runaway (tops at ×1.3 on the 3-chapter horizon).
//
// Reads Seam 1 (the battle's `scenarioTier`, carried on the DamageContext). Fires
// on `onDamageDealt` against the ATTACKER's hooks (so it only boosts Lumen's own
// fire damage), and adds a multiplier the way Damage Reduction does — composing
// with resistance / variance / crit at finalize, no new hook. Gated to `'fire'`
// damage tags (fire spells carry `['magical', 'fire']`), excluding healing.
//
// Not a purchasable component (outside the JP catalog): innate to the character,
// pre-equipped at 0 cost. Persists across reclass (harmless off a fire class —
// no fire damage to multiply).

import {
  abilityId,
  bucketId,
  DEFAULT_SCENARIO_TIER,
  passiveHook,
  type PassiveAbilityDefinition,
} from '@engine/index.ts';

// Fire-damage multiplier bonus per chapter. 0.1 → ×1.1 / ×1.2 / ×1.3.
export const ASCENDANT_FLAME_PER_TIER = 0.1;

export const ascendantFlame: PassiveAbilityDefinition = {
  id: abilityId('ascendant_flame'),
  name: 'Ascendant Flame',
  kind: 'passive',
  bucket: bucketId('support'),
  baseCost: 0, // free innate
  availability: 'hidden', // unit-specific signature — not in the picker
  tags: ['fire'],
  hooks: [
    passiveHook('onDamageDealt', (args) => {
      const tags = args.ctx.damageTags;
      if (!tags.has('fire')) return args.ctx;
      if (tags.has('healing')) return args.ctx;
      const tier = args.ctx.scenarioTier ?? DEFAULT_SCENARIO_TIER;
      const factor = 1 + ASCENDANT_FLAME_PER_TIER * tier;
      return {
        ...args.ctx,
        multipliers: [...args.ctx.multipliers, { source: 'ascendant_flame', factor }],
      };
    }),
  ],
};
