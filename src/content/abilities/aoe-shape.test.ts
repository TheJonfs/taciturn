// Regression tests for the documented AoE shapes on the Mage AoE
// abilities. Per Chris's session 24 playtest: Tidal Wave and Chain
// Lightning were observed rendering as Cross-r1 instead of the spec'd
// Diamond-r1. The audit found the content files declare diamond
// correctly; these tests pin that invariant so a future content edit
// can't silently regress (and so the next playtest occurrence can be
// attributed to a build/cache issue rather than a content bug).
//
// Session 26: Earth Quake, Earth Cataclysm, and Fire Storm migrated from
// `cross r1` to `diamond r1`. At radius 1 the two shapes produce the
// same 5-cell footprint, so the meaningful test of the change is the
// Aether-Bloom-enlarged Fire Storm: diamond r2 produces 13 tiles vs
// cross r2's 9. Added as a dedicated case below.
//
// We assert two things per ability:
//   1. The `effects.aoe.shape` declaration matches the spec.
//   2. The `aoeFootprint` resolver produces the expected tile set when
//      the shape is anchored at a sample target on a flat map.

import { describe, expect, it } from 'vitest';
import {
  aoeFootprint,
  enlargeAoeShape,
  type AoeShape,
  type Position,
  type Tile,
} from '@engine/index.ts';
import { flatMap } from '../../engine/map/test-fixtures.ts';
import { tidalWave } from './tidal-wave.ts';
import { chainLightning } from './chain-lightning.ts';
import { earthQuake } from './earth-quake.ts';
import { earthCataclysm } from './earth-cataclysm.ts';
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

  it('Earth Quake is diamond r1 (session 26 — was cross r1)', () => {
    expect(earthQuake.effects.aoe?.shape).toEqual(DIAMOND_R1);
  });

  it('Earth Cataclysm is diamond r1 (session 26 — was cross r1)', () => {
    expect(earthCataclysm.effects.aoe?.shape).toEqual(DIAMOND_R1);
  });

  it('Fire Storm is diamond r1 (session 26 — was cross r1)', () => {
    expect(fireStorm.effects.aoe?.shape).toEqual(DIAMOND_R1);
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

  it('Earth Quake footprint is exactly the diamond-r1 5-cell pattern', () => {
    const tiles = aoeFootprint({
      map,
      shape: earthQuake.effects.aoe!.shape,
      anchor: { x: center.x, y: center.y, elevation: 0 },
      verticalTolerance: 1,
    });
    expect(tileKeys(tiles)).toEqual(expectedDiamondR1(center));
  });

  it('Fire Storm footprint is exactly the diamond-r1 5-cell pattern', () => {
    const tiles = aoeFootprint({
      map,
      shape: fireStorm.effects.aoe!.shape,
      anchor: { x: center.x, y: center.y, elevation: 0 },
      verticalTolerance: 1,
    });
    expect(tileKeys(tiles)).toEqual(expectedDiamondR1(center));
  });

  it('Fire Storm + Aether Bloom enlargement produces diamond r2 (13 tiles)', () => {
    // The session-26 motivation for the cross-r1 → diamond-r1 swap:
    // when Aether Bloom (free for Fire Mage) enlarges Fire Storm's
    // shape, diamond r2 covers 13 tiles versus the pre-26 cross r2's 9.
    // We verify the rule indirectly via `enlargeAoeShape`, which both
    // the live `modifyAoeShape` chain (Aether Bloom) and this test use.
    const enlarged = enlargeAoeShape(fireStorm.effects.aoe!.shape);
    expect(enlarged).toEqual({ kind: 'diamond', radius: 2 });

    const tiles = aoeFootprint({
      map: flatMap(7, 7), // larger map to fit r2 around the center
      shape: enlarged,
      anchor: { x: 3, y: 3, elevation: 0 },
      verticalTolerance: 1,
    });
    expect(tiles).toHaveLength(13);
  });
});
