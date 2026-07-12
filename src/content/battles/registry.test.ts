// Pins the battle-template registry's walkability promise: every entry's
// zones key resolves, and every template carries player placeholder slots a
// campaign deploy can fold into. (This is what lets an Atlas placeholder
// battle beat on any registered template be immediately playable.)

import { describe, expect, it } from 'vitest';
import { teamId } from '@engine/index.ts';
import { deploymentZonesFor } from '@content/deployment/index.ts';
import { BATTLE_TEMPLATE_REGISTRY, battleTemplateFor } from './registry.ts';

const PLAYER = teamId('team_a');

describe('BATTLE_TEMPLATE_REGISTRY', () => {
  it('every entry resolves a deployment-zone config for its zonesKey', () => {
    for (const [key, entry] of Object.entries(BATTLE_TEMPLATE_REGISTRY)) {
      expect(() => deploymentZonesFor(entry.zonesKey), key).not.toThrow();
    }
  });

  it('every template has player-team placeholder slots (fold targets)', () => {
    for (const [key, entry] of Object.entries(BATTLE_TEMPLATE_REGISTRY)) {
      const playerSlots = entry.template.units.filter((u) => u.team === PLAYER);
      expect(playerSlots.length, key).toBeGreaterThan(0);
    }
  });

  it('battleTemplateFor throws loud on an unknown key', () => {
    expect(() => battleTemplateFor('atlantis')).toThrow(/no battle template/);
    expect(battleTemplateFor('river_ridge').label).toBe('River Ridge');
  });
});
