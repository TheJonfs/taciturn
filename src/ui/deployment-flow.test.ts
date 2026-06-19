// Tests for the deployment-flow state machine reducer.
// Covers every documented transition (happy path), the cancel
// back-paths, the lift-and-replace re-placement flow, and the
// completion / occupant-lookup helpers.

import { describe, expect, it } from 'vitest';
import {
  teamId,
  unitId,
  type Direction,
  type DeploymentZoneConfig,
  type Position,
} from '@engine/index.ts';
import {
  canPlaceInZone,
  createDeploymentState,
  isDeploymentComplete,
  lockedZoneTileKeys,
  subZoneUsage,
  transition,
  unitPlacedOn,
  type DeploymentPlacement,
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

describe('deployment-flow — per-sub-zone cap helpers (S70)', () => {
  const RED = teamId('team_b');
  // Two capped sub-zones: A (cap 2) and B (cap 1).
  const split: DeploymentZoneConfig = {
    teams: [
      {
        team: RED,
        subZones: [
          { cap: 2, tiles: [{ x: 0, y: 0, layer: 0 }, { x: 1, y: 0, layer: 0 }, { x: 2, y: 0, layer: 0 }] },
          { cap: 1, tiles: [{ x: 0, y: 5, layer: 0 }, { x: 1, y: 5, layer: 0 }] },
        ],
      },
    ],
  };
  const at = (x: number, y: number): DeploymentPlacement => ({
    position: { x, y, layer: 0 },
    facing: south,
  });

  it('subZoneUsage counts placements per sub-zone', () => {
    const placements = new Map([
      [unitId('a'), at(0, 0)], // sub-zone 0
      [unitId('b'), at(1, 0)], // sub-zone 0
      [unitId('c'), at(0, 5)], // sub-zone 1
    ]);
    expect(subZoneUsage(split, RED, placements)).toEqual([2, 1]);
  });

  it('canPlaceInZone rejects a tile whose sub-zone is at cap', () => {
    const placements = new Map([
      [unitId('a'), at(0, 0)],
      [unitId('b'), at(1, 0)], // sub-zone 0 now full (cap 2)
    ]);
    // Sub-zone 0's remaining empty tile (2,0) is no longer placeable.
    expect(canPlaceInZone(split, RED, { x: 2, y: 0, layer: 0 }, placements)).toBe(false);
    // Sub-zone 1 still has room.
    expect(canPlaceInZone(split, RED, { x: 0, y: 5, layer: 0 }, placements)).toBe(true);
    // Off-zone tile is never placeable.
    expect(canPlaceInZone(split, RED, { x: 9, y: 9, layer: 0 }, placements)).toBe(false);
  });

  it('lockedZoneTileKeys returns every tile of an at-capacity sub-zone', () => {
    const placements = new Map([
      [unitId('a'), at(0, 0)],
      [unitId('b'), at(1, 0)], // sub-zone 0 full
    ]);
    const locked = lockedZoneTileKeys(split, RED, placements);
    // All three sub-zone-0 tiles lock (incl. the still-empty (2,0)).
    expect(locked.has('0,0,0')).toBe(true);
    expect(locked.has('1,0,0')).toBe(true);
    expect(locked.has('2,0,0')).toBe(true);
    // Sub-zone 1 (under cap) stays open.
    expect(locked.has('0,5,0')).toBe(false);
  });

  it('an uncapped zone never locks and always admits in-zone tiles', () => {
    const uncapped: DeploymentZoneConfig = {
      teams: [{ team: RED, subZones: [{ tiles: [{ x: 0, y: 0, layer: 0 }] }] }],
    };
    const many = new Map([[unitId('a'), at(0, 0)]]);
    expect(lockedZoneTileKeys(uncapped, RED, many).size).toBe(0);
    expect(canPlaceInZone(uncapped, RED, { x: 0, y: 0, layer: 0 }, many)).toBe(true);
  });
});

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
