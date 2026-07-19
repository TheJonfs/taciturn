// S97 (bridge over/under UI) — regression pin for the S96 gap this
// session's playtest exposed: `'bridge'` deck terrain was registered in
// the ruleset ("behaves as land — walkable by every class") but never
// added to any class's `canEnter` whitelist, so NO unit could actually
// step onto a deck. These tests pin both the content rule (every class
// admits the terrain) and the live-map behavior (the Alvera deck is a
// legal move destination from its bank approach).

import { describe, expect, it } from 'vitest';
import { getLegalMoves, positionKey, unitId } from '@engine/index.ts';
import { makeGameState, makeUnit } from '../engine/ct/test-fixtures.ts';
import { classes, loadDefaultCatalog } from './index.ts';
import { alveraVillage } from './maps/alvera-village.ts';

// Chris's S97 ruling: every class can enter every authored terrain —
// per-class terrain RESTRICTION is not a design lever in v1 (terrain
// differentiation lives in per-class terrainCosts, e.g. Tidewalker).
// The list below is the full authored-map terrain vocabulary; a new
// terrain type must be added here AND to every class's canEnter (the
// legacy `'water'` literal lives only in test fixtures and is exempt).
const AUTHORED_TERRAINS = [
  'ground',
  'water_shallow',
  'water_deep',
  'rampart',
  'rock',
  'grass_rock',
  'bridge',
] as const;

describe('bridge terrain walkability (S97 regression)', () => {
  it("every class's canEnter admits every authored terrain (Chris's S97 ruling)", () => {
    for (const cls of classes) {
      for (const terrain of AUTHORED_TERRAINS) {
        expect(
          cls.movement.canEnter.has(terrain),
          `${String(cls.id)} cannot enter '${terrain}' terrain`,
        ).toBe(true);
      }
    }
  });

  it('the Alvera deck is a legal move destination from the north bank (2,6)', () => {
    const catalog = loadDefaultCatalog();
    const u = makeUnit({
      id: 'walker',
      spd: 10,
      position: { x: 2, y: 6, layer: 0 },
      classId: 'knight',
    });
    const state = makeGameState({ units: [u], map: alveraVillage });
    const { reachable } = getLegalMoves(state, unitId('walker'), catalog);
    // One step south onto the deck's north end — elev 2 → 3, jump 1.
    expect(reachable.has(positionKey({ x: 2, y: 7, layer: 1 }))).toBe(true);
    // And onward along the span within knight move range.
    expect(reachable.has(positionKey({ x: 2, y: 8, layer: 1 }))).toBe(true);
  });
});
