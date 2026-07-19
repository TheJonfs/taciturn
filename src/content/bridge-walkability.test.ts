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

describe('bridge terrain walkability (S97 regression)', () => {
  it("every class's canEnter admits 'bridge' (decks are walkable by all, like rampart)", () => {
    for (const cls of classes) {
      expect(
        cls.movement.canEnter.has('bridge'),
        `${String(cls.id)} cannot enter 'bridge' terrain`,
      ).toBe(true);
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
