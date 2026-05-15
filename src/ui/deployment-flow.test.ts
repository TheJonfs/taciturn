// Tests for the deployment-flow state machine reducer.
// Covers every documented transition (happy path), the cancel
// back-paths, the lift-and-replace re-placement flow, and the
// completion / occupant-lookup helpers.

import { describe, expect, it } from 'vitest';
import { teamId, unitId, type Direction, type Position } from '@engine/index.ts';
import {
  createDeploymentState,
  isDeploymentComplete,
  transition,
  unitPlacedOn,
  type DeploymentState,
} from './deployment-flow.ts';

const BLUE = teamId('team_a');
const knight = unitId('blue_knight_n');
const mage = unitId('blue_water_mage');

const tileA: Position = { x: 5, y: 1, layer: 0 };
const tileB: Position = { x: 7, y: 2, layer: 0 };
const south: Direction = 'S';
const east: Direction = 'E';

// Walk a fresh state through events, returning the final state.
function run(...events: Parameters<typeof transition>[1][]): DeploymentState {
  let s = createDeploymentState(BLUE);
  for (const e of events) s = transition(s, e);
  return s;
}

describe('deployment-flow — initial state', () => {
  it('starts idle with no placements, carrying currentTeam', () => {
    const s = createDeploymentState(BLUE);
    expect(s.phase).toEqual({ kind: 'idle' });
    expect(s.placements.size).toBe(0);
    expect(s.currentTeam).toBe(BLUE);
  });
});

describe('deployment-flow — happy path (idle → tile → unit → placed)', () => {
  it('selectTile from idle → tile_selected', () => {
    const s = run({ kind: 'selectTile', tile: tileA });
    expect(s.phase).toEqual({ kind: 'tile_selected', tile: tileA });
  });

  it('pickUnit from tile_selected → unit_selected', () => {
    const s = run(
      { kind: 'selectTile', tile: tileA },
      { kind: 'pickUnit', unitId: knight },
    );
    expect(s.phase).toEqual({ kind: 'unit_selected', tile: tileA, unitId: knight });
  });

  it('pickFacing from unit_selected commits the placement and returns to idle', () => {
    const s = run(
      { kind: 'selectTile', tile: tileA },
      { kind: 'pickUnit', unitId: knight },
      { kind: 'pickFacing', facing: south },
    );
    expect(s.phase).toEqual({ kind: 'idle' });
    expect(s.placements.get(knight)).toEqual({ position: tileA, facing: south });
  });
});

describe('deployment-flow — cancel back-paths', () => {
  it('cancel from tile_selected → idle', () => {
    const s = run(
      { kind: 'selectTile', tile: tileA },
      { kind: 'cancel' },
    );
    expect(s.phase).toEqual({ kind: 'idle' });
  });

  it('cancel from unit_selected → tile_selected (unit not committed)', () => {
    const s = run(
      { kind: 'selectTile', tile: tileA },
      { kind: 'pickUnit', unitId: knight },
      { kind: 'cancel' },
    );
    expect(s.phase).toEqual({ kind: 'tile_selected', tile: tileA });
    expect(s.placements.size).toBe(0);
  });

  it('cancel from idle is a no-op', () => {
    const s = run({ kind: 'cancel' });
    expect(s.phase).toEqual({ kind: 'idle' });
  });
});

describe('deployment-flow — re-select and ignored events', () => {
  it('selectTile from tile_selected moves the selection', () => {
    const s = run(
      { kind: 'selectTile', tile: tileA },
      { kind: 'selectTile', tile: tileB },
    );
    expect(s.phase).toEqual({ kind: 'tile_selected', tile: tileB });
  });

  it('pickUnit from idle is a no-op', () => {
    const s = run({ kind: 'pickUnit', unitId: knight });
    expect(s.phase).toEqual({ kind: 'idle' });
  });

  it('pickFacing from tile_selected is a no-op (no unit picked yet)', () => {
    const s = run(
      { kind: 'selectTile', tile: tileA },
      { kind: 'pickFacing', facing: south },
    );
    expect(s.phase).toEqual({ kind: 'tile_selected', tile: tileA });
    expect(s.placements.size).toBe(0);
  });
});

describe('deployment-flow — re-placement (lift-and-replace)', () => {
  it('liftUnit removes the placement and selects the unit prior tile', () => {
    const s = run(
      { kind: 'selectTile', tile: tileA },
      { kind: 'pickUnit', unitId: knight },
      { kind: 'pickFacing', facing: south },
      { kind: 'liftUnit', unitId: knight },
    );
    expect(s.phase).toEqual({ kind: 'tile_selected', tile: tileA });
    expect(s.placements.has(knight)).toBe(false);
  });

  it('liftUnit preserves all other placements', () => {
    const s = run(
      { kind: 'selectTile', tile: tileA },
      { kind: 'pickUnit', unitId: knight },
      { kind: 'pickFacing', facing: south },
      { kind: 'selectTile', tile: tileB },
      { kind: 'pickUnit', unitId: mage },
      { kind: 'pickFacing', facing: east },
      { kind: 'liftUnit', unitId: knight },
    );
    expect(s.placements.has(knight)).toBe(false);
    expect(s.placements.get(mage)).toEqual({ position: tileB, facing: east });
  });

  it('liftUnit for an un-placed unit is a no-op', () => {
    const before = run({ kind: 'selectTile', tile: tileA });
    const after = transition(before, { kind: 'liftUnit', unitId: knight });
    expect(after).toBe(before);
  });

  it('re-placing a lifted unit on the same tile with a new facing works', () => {
    const s = run(
      { kind: 'selectTile', tile: tileA },
      { kind: 'pickUnit', unitId: knight },
      { kind: 'pickFacing', facing: south },
      { kind: 'liftUnit', unitId: knight },
      { kind: 'pickUnit', unitId: knight },
      { kind: 'pickFacing', facing: east },
    );
    expect(s.placements.get(knight)).toEqual({ position: tileA, facing: east });
  });
});

describe('deployment-flow — helpers', () => {
  it('unitPlacedOn finds the unit on a tile, null when empty', () => {
    const s = run(
      { kind: 'selectTile', tile: tileA },
      { kind: 'pickUnit', unitId: knight },
      { kind: 'pickFacing', facing: south },
    );
    expect(unitPlacedOn(s, tileA)).toBe(knight);
    expect(unitPlacedOn(s, tileB)).toBeNull();
  });

  it('isDeploymentComplete is true only when every roster unit is placed', () => {
    const roster = [knight, mage];
    let s = createDeploymentState(BLUE);
    expect(isDeploymentComplete(s, roster)).toBe(false);

    s = run(
      { kind: 'selectTile', tile: tileA },
      { kind: 'pickUnit', unitId: knight },
      { kind: 'pickFacing', facing: south },
    );
    expect(isDeploymentComplete(s, roster)).toBe(false);

    s = transition(s, { kind: 'selectTile', tile: tileB });
    s = transition(s, { kind: 'pickUnit', unitId: mage });
    s = transition(s, { kind: 'pickFacing', facing: east });
    expect(isDeploymentComplete(s, roster)).toBe(true);
  });
});
