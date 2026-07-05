// Tidal Cadence — Clio's signature (TABA chapter-1 plot unit).
//
// A free, innate, always-equipped passive built on Seam 1's widened
// `onTurnStart`: on EVERY turn Clio takes (she's always conducting — not gated
// to an action), each living ally gains `3 × chapter` CT (a mild team-tempo
// accelerant nobody else provides). Reads the battle's `scenarioTier` off
// `args.state` and emits one `system_ct_push` per ally.
//
// WATCH-FOR (playtest, not a blocker): stacked with Clio's own Hydrologist CT
// tools (Flow State, Quickstep, Short Charge) this could compound toward a
// degenerate "Clio acts → allies accelerate → Clio comes up sooner" loop. She
// pushes ALLIES, not herself, which limits the direct loop; committed as-is with
// the per-tier multiplier as the tuning knob. Watch for it; don't pre-nerf.
//
// Not a purchasable component (innate; 0 cost). Fires only on her non-skipped
// turns (runOnTurnStart isn't called on a Stopped/Charging turn).

import {
  abilityId,
  bucketId,
  DEFAULT_SCENARIO_TIER,
  passiveHook,
  type PassiveAbilityDefinition,
  type ProposedAction,
} from '@engine/index.ts';

// CT granted to each ally per chapter. Start at 3 (conservative given the
// tempo-loop watch); the brief allows 3–4, tune up from playtest if it feels weak.
export const TIDAL_CADENCE_CT_PER_TIER = 3;

const TIDAL_CADENCE_ID = abilityId('tidal_cadence');

export const tidalCadence: PassiveAbilityDefinition = {
  id: TIDAL_CADENCE_ID,
  name: 'Tidal Cadence',
  kind: 'passive',
  bucket: bucketId('support'),
  baseCost: 0, // free innate
  availability: 'hidden', // unit-specific signature — not in the picker
  tags: ['water'],
  hooks: [
    passiveHook('onTurnStart', (args) => {
      const tier = args.state.scenarioTier ?? DEFAULT_SCENARIO_TIER;
      const gain = TIDAL_CADENCE_CT_PER_TIER * tier;
      const self = args.unit;
      const emitted: ProposedAction[] = [];
      for (const u of args.state.units.values()) {
        if (u.id === self.id) continue; // the conductor buffs the team, not herself
        if (u.team !== self.team) continue;
        if (u.removed || u.vitals.hp <= 0) continue;
        emitted.push({
          type: 'system_ct_push',
          source: 'system',
          payload: {
            targetId: u.id,
            delta: gain,
            source: { kind: 'support', abilityId: TIDAL_CADENCE_ID, unitId: self.id },
          },
        });
      }
      return { emittedActions: emitted };
    }),
  ],
};
