// Terrain texture asset manifest. Mirrors `assets/portraits/index.ts`
// (ADR-0048) with one deliberate deviation: each terrain type has an
// *array* of variants rather than a single asset, because tile layers
// repeat the same terrain across many positions and uniform tiling
// reads as obviously textured rather than as a battlefield. The
// renderer picks per-tile variants via a deterministic hash over
// `(masterSeed, x, y)`.
//
// File-naming convention (enforced by hand at the import statements):
// `<terrain-type>-<NN>.png`, e.g., `ground-01.png`, `ground-02.png`,
// `stone-ridge-01.png`. The leading token must match the engine's
// `TerrainType` string used in map tile data — for v1 that's
// `'ground'` for the demo's flat training field. New variants are
// added by importing them and extending the relevant manifest entry.
//
// Manifest is intentionally hand-written rather than glob-scanned —
// explicit lists are inspectable, diff-friendly, and avoid build-time
// resolution surprises when contributor environments differ. The cost
// is a one-line edit per new asset; the brief flags this as
// "infrastructure ships before assets," so adds are routine.
//
// Coverage is partial by design. Today only `ground` ships with
// variants (grass-themed PNGs); other terrain types render as their
// colored-tile fallback until art lands. The renderer composes
// manifest-present and manifest-absent tiles transparently — see
// `renderer/tile-layer.ts`.

import ground01Url from './ground-01.png';
import ground02Url from './ground-02.png';
import ground03Url from './ground-03.png';
import shallowWater01Url from './shallow-water-01.png';
import shallowWater02Url from './shallow-water-02.png';
import shallowWater03Url from './shallow-water-03.png';
import deepWater01Url from './deep-water-01.png';
import deepWater02Url from './deep-water-02.png';
import deepWater03Url from './deep-water-03.png';
import rampart01Url from './rampart-01.png';
import rampart02Url from './rampart-02.png';
import rampart03Url from './rampart-03.png';
import rock01Url from './rock-01.png';
import rock02Url from './rock-02.png';
import rock03Url from './rock-03.png';
import grassRock01Url from './grass-rock-01.png';
import grassRock02Url from './grass-rock-02.png';
import type { TerrainType } from '@engine/index.ts';

// Session 33 (ADR-0073): `water_shallow` / `water_deep` ship with
// three variants each, mirroring `ground`. The texture pool determinism
// (via masterSeed + position) keeps replay-stable.
//
// Session 47: `rampart` ships with three variants of wooden plank
// walling for Stonebridge's SE keep. Source art was authored at ~700px
// and downscaled to 256×256 to match the other terrain variants.
//
// Session 70: `rock` ships with three bare-stone variants for Mountain
// Pass's high ground (elevation ≥ 7 — the SW massif and NE ridge), and
// `grass_rock` two grass-over-stone variants for the mid band (elev 5-6)
// — a visual transition between the green lowlands and the bare heights.
export const TERRAIN_MANIFEST: ReadonlyMap<TerrainType, ReadonlyArray<string>> = new Map([
  ['ground', [ground01Url, ground02Url, ground03Url]],
  ['water_shallow', [shallowWater01Url, shallowWater02Url, shallowWater03Url]],
  ['water_deep', [deepWater01Url, deepWater02Url, deepWater03Url]],
  ['rampart', [rampart01Url, rampart02Url, rampart03Url]],
  ['rock', [rock01Url, rock02Url, rock03Url]],
  ['grass_rock', [grassRock01Url, grassRock02Url]],
]);

// Returns the texture-URL pool for a terrain type, or `null` if no
// variants are registered. Consumers (the renderer) interpret `null`
// as "use the colored-fill fallback for this terrain."
export function terrainTexturePoolFor(type: TerrainType): ReadonlyArray<string> | null {
  const pool = TERRAIN_MANIFEST.get(type);
  return pool === undefined || pool.length === 0 ? null : pool;
}

// Deterministic per-tile variant pick. Given the battle's masterSeed
// and a tile's (x, y), returns a stable index into a pool of size
// `poolSize`. The same battle replayed (same masterSeed, same map)
// produces the same per-tile choices, which keeps determinism replay
// guarantees intact for visual rendering.
//
// The mixer borrows the murmurhash finalizer pattern (xor-shift +
// Math.imul). Math.imul keeps the multiply in 32-bit; the final modulo
// uses Math.abs to coerce any sign-bit result into [0, poolSize).
//
// Returns 0 when `poolSize` is 0 or 1 (degenerate cases — the caller
// usually checks the pool's existence before calling, but the
// defensive return keeps the function total).
export function pickTerrainVariantIndex(
  masterSeed: number,
  x: number,
  y: number,
  poolSize: number,
): number {
  if (poolSize <= 1) return 0;
  let h = masterSeed | 0;
  h = Math.imul(h ^ x, 0x85ebca6b);
  h = Math.imul(h ^ y, 0xc2b2ae35);
  h ^= h >>> 16;
  return Math.abs(h) % poolSize;
}
