// S55 — offensive AoEs can catch the caster.
//
// Playtest (S55): a Geosage's Cataclysm landed adjacent to itself (the target
// moved next to the caster) and the caster wasn't hit. Root cause was the
// `excludeCaster: true` default (ADR-0025 #7), documented across every AoE
// ability as "FFT-canonical." Per Chris's call, the offensive AoEs now opt out
// — the caster CAN be caught in their own blast. This test pins that decision
// on the production catalog so it can't silently revert to the default.
//
// Caster-anchored cone/line shapes (Maelstrom, Flame Lance) carry the flag too,
// but it's a no-op for them: their footprints start one tile ahead, so the
// caster's tile is never in the affected set regardless.

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '../index.ts';
import { abilityId } from '@engine/index.ts';

const catalog = loadDefaultCatalog();

const OFFENSIVE_AOES = [
  'earth_cataclysm',
  'earth_quake',
  'fire_storm',
  'tidal_wave',
  'chain_lightning',
  'maelstrom',
  'flame_lance',
] as const;

describe('S55 — offensive AoEs include the caster (excludeCaster: false)', () => {
  for (const id of OFFENSIVE_AOES) {
    it(`${id} declares an AoE that does not exclude the caster`, () => {
      const ability = catalog.getAbility(abilityId(id));
      expect(ability.kind).toBe('active');
      if (ability.kind !== 'active') return;
      expect(ability.effects.aoe).toBeDefined();
      expect(ability.effects.aoe?.excludeCaster).toBe(false);
    });
  }
});
