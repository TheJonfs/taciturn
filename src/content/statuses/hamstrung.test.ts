// TABA — Hamstrung (Sera's stacking Move/Jump permadebuff) behavior.
//
// The modifyStatQuery hook subtracts the instance magnitude from BOTH moveRange
// and jump, flooring EACH at 0 independently — so "immobilized" (Move 0 AND
// Jump 0) is only reached once enough stacks accumulate, and a target can be
// Move-locked while still able to climb (Jump > 0). Stacking (magnitude
// accumulation) is the engine's STACK_ADDITIVE rule, unit-tested via Combat
// Focus; here we pin the Hamstrung-specific stat reduction + config + the
// ability that applies it.

import { describe, expect, it } from 'vitest';
import { runModifyStatQuery } from '@engine/index.ts';
import { makeGameState, makeUnit } from '../../engine/ct/test-fixtures.ts';
import { catalogWith, makeStatusInstance } from '../../engine/status/test-fixtures.ts';
import { hamstrung } from './hamstrung.ts';
import { hamstring } from '../abilities/hamstring.ts';

const catalog = catalogWith([hamstrung]);

function moveJumpAt(magnitude: number, baseMove: number, baseJump: number) {
  const u = makeUnit({
    id: 'v',
    spd: 10,
    statuses: [makeStatusInstance({ typeId: 'hamstrung', magnitude })],
  });
  const state = makeGameState({ units: [u] });
  const move = runModifyStatQuery(state, catalog, { unit: u, statName: 'moveRange', baseValue: baseMove });
  const jump = runModifyStatQuery(state, catalog, { unit: u, statName: 'jump', baseValue: baseJump });
  return { move, jump };
}

describe('Hamstrung — Move/Jump reduction', () => {
  it('subtracts one stack of magnitude from both Move and Jump', () => {
    expect(moveJumpAt(1, 4, 3)).toEqual({ move: 3, jump: 2 });
  });

  it('floors Move and Jump at 0 INDEPENDENTLY (jump floors first when it starts lower)', () => {
    // Base Move 4 / Jump 2, 3 stacks: Move 1 (still mobile), Jump 0 (can't climb).
    expect(moveJumpAt(3, 4, 2)).toEqual({ move: 1, jump: 0 });
  });

  it('reaches full immobilize (both at 0) once stacks exceed both bases', () => {
    expect(moveJumpAt(5, 4, 2)).toEqual({ move: 0, jump: 0 });
  });

  it('leaves non-movement stats untouched', () => {
    const u = makeUnit({ id: 'v', spd: 10, statuses: [makeStatusInstance({ typeId: 'hamstrung', magnitude: 3 })] });
    const state = makeGameState({ units: [u] });
    expect(runModifyStatQuery(state, catalog, { unit: u, statName: 'pa', baseValue: 6 })).toBe(6);
  });
});

describe('Hamstrung — config + applying ability', () => {
  it('is a permanent, magnitude-accumulating debuff', () => {
    expect(hamstrung.durationMode).toBe('permanent');
    expect(hamstrung.stackingRule).toBe('STACK_ADDITIVE');
    expect(hamstrung.defaultMagnitude).toBe(1);
  });

  it('Hamstring applies Hamstrung via the Speed-based proc, no damage, MP 8', () => {
    expect(hamstring.mpCost).toBe(8);
    expect(hamstring.effects.damage).toBeUndefined();
    const eff = hamstring.effects.statusEffects?.[0];
    expect(eff?.typeId).toBe(hamstrung.id);
    expect(eff?.factors).toEqual({ brave: true, speed: true });
  });
});
