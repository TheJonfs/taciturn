# ADR-0054 — Terrain texture infrastructure: per-terrain pool, deterministic variant pick, fallback to colored rect

**Status:** Accepted (Session 26, 2026-05-11)

**Context.** Pre-26 the renderer's `TileLayer` drew the battlefield as flat colored rects (`Graphics.rect().fill(color)`), one rect per tile, colors keyed by terrain type in `TERRAIN_COLORS`. The result was readable but visually flat. Session 26 introduces the first terrain art (a single grass texture, `ground-01.png`) and the infrastructure to load and apply terrain textures generally as more assets land in parallel art passes.

Three requirements shape the design:

1. **Multiple variants per terrain type.** Tiling a single texture across many positions reads as obviously textured (the same image repeating); variation is needed so a field of grass looks natural. Multiple PNGs per terrain type with per-tile variant selection.
2. **Deterministic per-tile selection.** Same battle (same masterSeed, same map) must produce the same per-tile choices across reloads, replays, and (eventually) shared online battles. Random selection at render time breaks determinism.
3. **Fallback to current rendering.** The renderer must remain useful while assets are partial — today only `ground` has a variant; `water` and `wall` have only their colored fills. New terrain types (stone-ridge, shallow-water, deep-water) will land in pieces as art arrives.

Mirrors the portrait integration pattern (ADR-0048) with one deliberate deviation: array-per-type (a *pool*) instead of single-asset-per-id.

**Decision.**

**1. Asset manifest** (`src/assets/terrain/index.ts`). Vite-resolved static URL imports keyed by terrain type, with an *array* per type:

```typescript
import ground01Url from './ground-01.png';
import type { TerrainType } from '@engine/index.ts';

export const TERRAIN_MANIFEST: ReadonlyMap<TerrainType, ReadonlyArray<string>> = new Map([
  ['ground', [ground01Url]],
]);

export function terrainTexturePoolFor(type: TerrainType): ReadonlyArray<string> | null;
export function pickTerrainVariantIndex(seed: number, x: number, y: number, poolSize: number): number;
```

- **Naming convention.** `<terrain-type>-<NN>.png`. The leading token matches the engine's `TerrainType` string. New variants are added by importing the PNG and extending the relevant manifest array.
- **Manifest is hand-written**, not glob-scanned. Explicit, inspectable, diff-friendly. Adds are one-line edits. The trade-off (manual maintenance vs. zero-touch scan) favors explicit because manifest evolution is rare relative to other content edits.
- **Variant pick** uses a small murmurhash-style finalizer (xor-shift + `Math.imul`) over `(masterSeed, x, y)` modulo pool size. Deterministic, distributes well from low-entropy inputs, runs in microseconds per tile. Degenerate inputs (poolSize ≤ 1, empty pool) short-circuit to index 0. The hash is *not* cryptographic — collision pattern matters only for visual interest, not security or replay correctness (correctness is preserved by determinism, not distribution).

**2. Renderer integration** (`src/renderer/battle-renderer.ts` + `src/renderer/tile-layer.ts`).

- **TileLayer container hierarchy** now has two children: the existing `graphics` (colored-rect fallback, drawn every mount) and a new `overlay` Container that holds per-tile Sprites once textures resolve. Sprites label themselves `tile-<terrain-type>` so a future per-type re-apply (HMR, content swap) can remove only its own children.
- **BattleRenderer.mount** kicks off `loadTerrainAssets(state)` as a background promise alongside the existing `loadPortraitAssets`. The loader enumerates unique terrain types present on the loaded map, looks up their pools via `terrainTexturePoolFor`, and `Promise.all(pool.map(Assets.load))` per type. On resolution per type, it calls `tileLayer.applyTerrainTextures(map, terrainType, textures, masterSeed)`.
- **Per-tile sprite placement.** For each tile of the matching terrain type, the pick function chooses a variant index, a Pixi `Sprite` is created from the corresponding texture, sized to the tile's inset bounds (`TILE_SIZE - TILE_INSET`), and added to the overlay. The colored rect underneath is preserved as fallback for any pixel coverage gaps and for the always-on case where a terrain type has no manifest entry.
- **Error handling.** Per-type failures are swallowed (logged in dev). One bad terrain type doesn't break the whole battle; the affected tiles keep their colored-fill rendering. Matches the portrait fallback pattern.

**3. Determinism semantics.** The masterSeed lives on `state.rng.masterSeed`. Replay (same masterSeed) reproduces the same per-tile variant choices. Future shared online battles (Wave 3+ stretch goal) inherit determinism for free.

**Consequences.**

- **Asset load is async.** Tiles render as colored fallback for the first few hundred ms (subjective: ~one heartbeat) before textures swap in. Acceptable; matches the portrait pattern.
- **Pixi Asset cache** means re-mounting the same texture across battles is free after the first load.
- **Coverage is partial by design.** Today only `ground` ships with a variant. `water` and `wall` render as colored fills. New terrain types added without art are silently fine.
- **The overlay container slightly compounds draw cost.** Two layers (Graphics + Sprite container) per tile vs. one Graphics. Pixi batches both passes; the cost is negligible at v1 map sizes (~200 tiles). Worth revisiting if maps grow much larger.
- **`grass-01.png` was renamed to `ground-01.png`** during integration to satisfy the convention. Future grass-themed variants for the ground terrain type follow as `ground-02.png` etc. If a future map needs a distinct "grass" terrain type (e.g., visually different from generic ground), it'd register its own manifest key and the file naming follows.
- **Asset compression discipline.** `ground-01.png` lands at 256×256 / ~64 KB (down from a 2048×2048 / ~9.8 MB source via `sips` resize + `pngquant` compression). Future terrain art should target the same range; the renderer's `TILE_SIZE` is 48px, so 256×256 oversamples by ~5×, comfortable for camera zoom up to ~3×.

**Alternatives considered.**

- **Single texture per terrain type (no variant array).** Matches portraits exactly. Rejected because tile-level uniformity reads as obviously tiled; multiple variants are the natural mitigation. Cost is the array indirection; benefit is the visual quality lift.
- **Random per-tile selection at render time.** Breaks determinism. Replays of the same battle would render differently each time. Hash-based picking from a stable seed avoids this with no UX cost.
- **Glob-scanned manifest.** `import.meta.glob('./grass-*.png')` would auto-detect new variants without manifest edits. Rejected for v1 — explicit lists are diff-friendly and avoid build-time resolution surprises. Manifest maintenance is low-frequency; the cost is small.
- **Sprite-only rendering, no Graphics fallback.** Drop the rect entirely; render only sprites when available, render nothing otherwise. Rejected — the colored rect is the universal fallback for terrain types without art and for the load-in-progress window. Keeping both layers is harmless overdraw.
- **Bundle the textures as base64-encoded data URLs.** Inlines assets into the bundle. Rejected — bundle size balloons; HTTP/2 multiplexes asset fetches cheaply; Pixi's `Assets.load` works equally well with URLs.

**References.**

- Session 26 brief: `docs/twentyOnePlanning/session-26-brief.md` (Item 3: terrain texture loading infrastructure)
- `src/assets/terrain/index.ts` (manifest, accessors, variant-pick)
- `src/assets/terrain/variant-pick.test.ts` (determinism + boundary tests)
- `src/renderer/tile-layer.ts` (`TileLayer.applyTerrainTextures`)
- `src/renderer/battle-renderer.ts` (`loadTerrainAssets`)
- Related: ADR-0048 (portrait integration — primary pattern reference)
