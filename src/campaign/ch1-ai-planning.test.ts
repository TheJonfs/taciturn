// S94 — the AI plans only with USABLE abilities (the passive-enemy fix).
//
// With JP gating live and lean level-budgeted kits, the AI's ability
// enumeration used to include LOCKED command-set members: a locked member
// scored well, won the joint plan, failed commit-validation — and the
// planner's fail-hard null discarded the valid lesser attack with it,
// leaving low-level enemies wandering without ever swinging (Chris's
// speedrun report). This walks every generated stub's full turn against
// the REAL folded Oskun battle, adjacent to a target, and requires each
// to ACT — not merely reposition and give up.

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '@content/index.ts';
import { decideBasicAi } from '../ai/index.ts';
import { commitAction, createInitialState, unitId, type GameState, type Unit } from '@engine/index.ts';
import { ch1StartingRoster } from './ch1-roster.ts';
import { foldBattle } from './snapshot-fold.ts';
import { allNodeBeats, getNode } from './graph.ts';
import { firstBattleBeat } from './sequence.ts';
import { CAMPAIGN_GRAPH, CAMPAIGN_NODES } from './node.ts';

const catalog = loadDefaultCatalog();

function stubRng(): () => number {
  let n = 1;
  return () => {
    n = (n * 9301 + 49297) % 233280;
    return n / 233280;
  };
}

describe('gated-kit AI planning — the real Oskun stubs act, never just wander', () => {
  const oskun = getNode(CAMPAIGN_GRAPH, CAMPAIGN_NODES.oskun);
  const battle = firstBattleBeat(allNodeBeats(oskun))!.battle;
  const roster = ch1StartingRoster(stubRng(), catalog).slice(0, 5);
  const folded = foldBattle(battle, roster, catalog);
  const base = createInitialState(folded, catalog);

  it('every L2 stub placed adjacent to the party COMMITS an action this turn', () => {
    const lumen = base.units.get(unitId('plot-lumen'))!;
    const enemies = [...base.units.values()].filter((u) => u.team === 'team_b');
    expect(enemies.length).toBeGreaterThan(0);

    for (const enemy of enemies) {
      const adjacent = { x: lumen.position.x + 1, y: lumen.position.y, layer: 0 };
      const units = new Map(base.units);
      units.set(enemy.id, { ...enemy, position: adjacent } as Unit);
      let cur: GameState = {
        ...base,
        units,
        turnState: {
          unitId: enemy.id,
          budget: { movesAvailable: 1, actsAvailable: 1 },
          consumed: { movesConsumed: 0, actsConsumed: 0 },
          reactionsUsedThisTurn: new Map(),
        },
      };

      // Walk the whole turn (move leg + act leg of a joint plan).
      let acted = false;
      for (let step = 0; step < 4; step += 1) {
        const decision = decideBasicAi(cur, catalog);
        if (decision.kind !== 'commit') break;
        if (decision.action.type !== 'move') acted = true;
        const r = commitAction(cur, decision.action, catalog);
        expect(r.ok, `${enemy.name}: ${decision.action.type} must commit`).toBe(true);
        if (!r.ok) break;
        cur = r.newState;
        if (cur.turnState === null || cur.turnState.unitId !== enemy.id) break;
        const { budget, consumed } = cur.turnState;
        if (consumed.actsConsumed >= budget.actsAvailable) break;
      }
      expect(acted, `${enemy.name} must ACT, not just wander (locked-kit planning bug)`).toBe(true);
    }
  });

  it('the AI never proposes a LOCKED ability (enumeration respects usableActives)', () => {
    // The L2 generated monk knows only Bear's Heave + its innates;
    // storm_stoop et al are locked. Pre-fix the joint planner picked them
    // and nulled out. Found by CLASS (M4: the party is archetype-rolled,
    // so slot order isn't monk-first anymore; the fixed node seed keeps a
    // monk in the Oskun bandit party — re-anchor if the archetype pools
    // change).
    const monk = [...base.units.values()].find(
      (u) =>
        String(u.id).startsWith('skirmish-enemy') &&
        String(u.classState.currentClass) === 'monk',
    )!;
    expect(monk).toBeDefined();
    expect(monk.usableActives).toBeDefined();
    const lumen = base.units.get(unitId('plot-lumen'))!;
    const units = new Map(base.units);
    units.set(monk.id, { ...monk, position: { x: lumen.position.x + 1, y: lumen.position.y, layer: 0 } } as Unit);
    const state: GameState = {
      ...base,
      units,
      turnState: {
        unitId: monk.id,
        budget: { movesAvailable: 1, actsAvailable: 1 },
        consumed: { movesConsumed: 0, actsConsumed: 0 },
        reactionsUsedThisTurn: new Map(),
      },
    };
    const decision = decideBasicAi(state, catalog);
    expect(decision.kind).toBe('commit');
    if (decision.kind !== 'commit') return;
    expect(decision.action.type).toBe('use_ability');
    if (decision.action.type !== 'use_ability') return;
    expect(monk.usableActives!.has(decision.action.payload.abilityId)).toBe(true);
  });
});
