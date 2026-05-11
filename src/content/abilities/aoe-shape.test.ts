// Regression tests for the documented AoE shapes on the Mage AoE
// abilities. Per Chris's session 24 playtest: Tidal Wave and Chain
// Lightning were observed rendering as Cross-r1 instead of the spec'd
// Diamond-r1. The audit found the content files declare diamond
// correctly; these tests pin that invariant so a future content edit
// can't silently regress (and so the next playtest occurrence can be
// attributed to a build/cache issue rather than a content bug).
//
// We assert two things per ability:
//   1. The `effects.aoe.shape` declaration matches the spec.
//   2. The `aoeFootprint` resolver produces the expected tile set when
//      the shape is anchored at a sample target on a flat map.

import { describe, expect, it } from 'vitest';
import { aoeFootprint, type AoeShape, type Position, type Tile } from '@engine/index.ts';
import { flatMap } from '../../engine/map/test-fixtures.ts';
import { tidalWave } from './tidal-wave.ts';
import { chainLightning } from './chain-lightning.ts';
import { earthQuake } from './earth-quake.ts';
import { fireStorm } from './fire-storm.ts';

const DIAMOND_R1: AoeShape = { kind: 'diamond', radius: 1 };

// Helper: convert resolved tiles to a sortable set of "x,y" strings so
// equality checks are order-independent.
function tileKeys(tiles: ReadonlyArray<Tile>): ReadonlyArray<string> {
  return tiles.map((t) => `${t.x},${t.y}`).sort();
}

function expectedDiamondR1(center: Position): ReadonlyArray<string> {
  return [
    `${center.x},${center.y - 1}`, // N
    `${center.x - 1},${center.y}`, // W
    `${center.x},${center.y}`,     // center
    `${center.x + 1},${center.y}`, // E
    `${center.x},${center.y + 1}`, // S
  ].sort();
}

describe('Mage AoE shape declarations', () => {
  it('Tidal Wave is diamond r1', () => {
    expect(tidalWave.effects.aoe?.shape).toEqual(DIAMOND_R1);
  });

  it('Chain Lightning is diamond r1', () => {
    expect(chainLightning.effects.aoe?.shape).toEqual(DIAMOND_R1);
  });
});

describe('Mage AoE footprint resolution', () => {
  // 5×5 flat map at elevation 0 (the test fixture default). Vertical
  // tolerance set generously so all 5 cells qualify regardless.
  const map = flatMap(5, 5);
  const center: Position = { x: 2, y: 2, layer: 0 };

  it('Tidal Wave footprint is exactly the diamond-r1 5-cell pattern', () => {
    const tiles = aoeFootprint({
      map,
      shape: tidalWave.effects.aoe!.shape,
      anchor: { x: center.x, y: center.y, elevation: 0 },
      verticalTolerance: 1,
    });
    expect(tileKeys(tiles)).toEqual(expectedDiamondR1(center));
  });

  it('Chain Lightning footprint is exactly the diamond-r1 5-cell pattern', () => {
    const tiles = aoeFootprint({
      map,
      shape: chainLightning.effects.aoe!.shape,
      anchor: { x: center.x, y: center.y, elevation: 0 },
      verticalTolerance: 1,
    });
    expect(tileKeys(tiles)).toEqual(expectedDiamondR1(center));
  });

  it('Earth Quake declares cross r1 (control)', () => {
    // Earth Quake is spec'd as cross r1. At radius 1 the cross and
    // diamond footprints both resolve to the same 5 cells (center + 4
    // cardinals); the distinguishing test would need radius ≥ 2. This
    // assertion pins the shape *kind* so a content edit can't silently
    // swap diamond ↔ cross at r1 without breaking the test.
    expect(earthQuake.effects.aoe?.shape).toEqual({ kind: 'cross', radius: 1 });
  });

  it('Fire Storm shape resolves without error (control)', () => {
    const fsShape = fireStorm.effects.aoe?.shape;
    expect(fsShape).toBeDefined();
    if (fsShape !== undefined) {
      const tiles = aoeFootprint({
        map,
        shape: fsShape,
        anchor: { x: center.x, y: center.y, elevation: 0 },
        verticalTolerance: 1,
      });
      // At minimum the center tile is included for any non-cone shape.
      expect(tiles.some((t) => t.x === center.x && t.y === center.y)).toBe(true);
    }
  });
});
