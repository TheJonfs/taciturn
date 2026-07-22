// Zelmonia Hills wiring (S98) — the first Cartographer-authored story
// battlefield + lineup replacing a River Ridge stand-in. Pins the division
// of labor the tool established: the generated module supplies the map and
// the SPATIAL slots (Theo's ★ lead position included), node-content
// supplies identity (theoRenault re-skins the lead), death protection
// (withLeadEnemySlot), and the retreat victory condition targeting
// THEO_ID. Also boots the folded battle through the unchanged engine.

import { describe, expect, it } from 'vitest';
import { createInitialState, teamId } from '@engine/index.ts';
import { loadDefaultCatalog } from '@content/index.ts';
import { zelmoniaHills } from '@content/maps/zelmonia-hills.ts';
import { ZELMONIA_HILLS_LINEUP } from '@content/battles/zelmonia-hills-battle.ts';
import { contentBeats, THEO_ID } from './node-content.ts';
import { foldEnemyTeam } from './snapshot-fold.ts';
import type { NodeBattle } from './sequence.ts';

const catalog = loadDefaultCatalog();
const ENEMY = teamId('team_b');

function zelmoniaHillsBattleBeat(): NodeBattle {
  const beat = contentBeats('node-zelmonia-hills').find((b) => b.type === 'battle');
  if (beat === undefined || beat.type !== 'battle') throw new Error('no battle beat');
  return beat.battle;
}

describe('Zelmonia Hills — Cartographer-authored node wiring', () => {
  const battle = zelmoniaHillsBattleBeat();

  it('fights on the authored map with the authored six enemy slots', () => {
    expect(battle.template.map).toBe(zelmoniaHills);
    expect(battle.template.battleId).toBe('ch1_zelmonia_hills_v1');
    const slots = battle.template.units.filter((u) => u.team === ENEMY);
    expect(slots).toHaveLength(6);
    // The ★ lead slot keeps the tool's position/facing and carries the
    // death-protection stamp withLeadEnemySlot added.
    expect(slots[0]!.position).toEqual({
      x: ZELMONIA_HILLS_LINEUP.enemies[0]!.x,
      y: ZELMONIA_HILLS_LINEUP.enemies[0]!.y,
      layer: 0,
    });
    expect(slots[0]!.deathProtected).toBe(true);
  });

  it('Theo re-skins the lead; the five authored troops follow in slot order', () => {
    const enemies = battle.enemies!;
    expect(enemies).toHaveLength(6);
    expect(String(enemies[0]!.id)).toBe(String(THEO_ID));
    // Overridden generics land at their authored indices (slot order).
    expect(enemies[2]!.name).toBe('Oscar');
    expect(enemies[5]!.name).toBe('Tina');
    expect(String(enemies[4]!.classId)).toBe('monk'); // the sixth-slot experiment stays
  });

  it('keeps the retreat condition targeting THEO_ID', () => {
    const predicate = battle.template.victoryConditions.find((c) => c.kind === 'predicate');
    expect(predicate).toBeDefined();
    expect(JSON.stringify(predicate)).toContain(String(THEO_ID));
  });

  it('the folded battle boots through the unchanged engine', () => {
    const folded = foldEnemyTeam(battle.template, battle.enemies!, ENEMY, catalog);
    const state = createInitialState(folded, catalog);
    const theo = state.units.get(THEO_ID);
    expect(theo).toBeDefined();
    expect(theo!.position).toEqual(battle.template.units.filter((u) => u.team === ENEMY)[0]!.position);
    // Everyone stands on a real tile of the authored map.
    for (const unit of state.units.values()) {
      expect(
        zelmoniaHills.tiles.some(
          (t) =>
            t.x === unit.position.x && t.y === unit.position.y && t.layer === unit.position.layer,
        ),
        `unit ${String(unit.id)} stands on the map`,
      ).toBe(true);
    }
  });
});
