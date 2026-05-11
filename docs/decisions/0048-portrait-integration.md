# ADR-0048 — Class portrait integration: async load, sprite + img dual path, graceful fallback

**Status:** Accepted (Session 24.5, 2026-05-11)

**Context.** Session 24.5 ships portrait art for all five v1 classes (earth-mage, fire-mage, knight, lightning-mage, water-mage) as square PNGs at native resolution (~4MB each). The portraits need to render in three places:

- **Map tokens** on the PixiJS canvas. Replaces (or sits over) the existing colored-circle body.
- **Unit detail panel** (React `<img>`).
- **QueueTower** mini-cards and active-unit anchor (React `<img>`).

Three integration choices interact:

1. Where do the assets live, and how are they loaded?
2. How does the renderer get textures into `UnitSprite`?
3. What happens when an asset is missing or fails to load?

**Decision.**

**1. Asset module** (`src/assets/portraits/index.ts`). Vite-resolved static URL imports keyed by class id:

```typescript
import earthMageUrl from './earth-mage.png';
// ...
export const PORTRAIT_URLS: ReadonlyMap<ClassId, string> = new Map([...]);
export function portraitUrlFor(id: ClassId): string | null;
```

Vite handles the asset-URL hashing at build time; both Pixi (via `Assets.load(url)`) and React (via `<img src={url}>`) consume the same URL strings. A new `src/vite-env.d.ts` declares the `*.png` module type so TypeScript accepts the imports.

**2. Renderer pipeline** (canvas):
- `BattleRenderer.mount` enumerates the class ids present in the initial state, kicks off `Assets.load(url)` for each, and on each promise resolution, calls `sprite.setPortrait(texture)` on every UnitSprite of that class.
- `UnitSprite` adds a `setPortrait(texture)` method that creates a `Sprite`, scales to `UNIT_RADIUS * 2`, anchors at (0.5, 0.5), and inserts it above the body Graphics. The colored body stays underneath as a backdrop (visible at the corners outside the portrait's square bounding box, framing the portrait visually).
- A new `teamRing` Graphics is drawn behind the body — stroke-only, team color, width 3 — so the team-color readout persists when the portrait covers the body. Visible at the portrait's edge regardless of portrait alpha.
- An `enemyTeam` boolean passed to `UnitSprite`'s constructor sets `sprite.scale.x = -1` so enemy portraits flip horizontally (facing the player).
- Hit-flash on the portrait: lerp the sprite's `tint` from `0xffffff` toward `HIT_FLASH_COLOR` based on the animator's flash level. The body's flash overlay still renders underneath (visible at the unframed corners).

**3. React pipeline** (`<img>`):
- `UnitDetailPanel` adds a `<PortraitImage classId={..} size={64} />` to the header.
- `QueueTower` mini-cards use a `<MiniPortrait>` inside the existing 40×40 portrait slot; the active-unit anchor uses a 44×44 `<img>` with the team-color border.
- Both fall back to the prior colored-block when `portraitUrlFor(classId)` returns `null`.

**Fallback behavior.** Missing assets are non-fatal:
- Renderer: if `Assets.load` rejects, the catch swallows (logs in dev) and the UnitSprite keeps its colored-circle body. The `teamRing` stroke still draws, so team color is still visible.
- React: `portraitUrlFor` returns `null` for unregistered class ids; components render the prior placeholder block.

The colored body + team ring are the universal fallback; portraits are additive.

**Consequences.**

- **Asset load is async**, but the renderer stays responsive during the gap. Units show as colored circles for the first few hundred ms (subjective: ~one heartbeat) before portraits swap in. Acceptable for v1.
- **Pixi `Assets.load` caches** so re-mounting the same texture across battles is free after the first load.
- **Source PNGs are ~4MB each** (≈20MB total for 5 classes). Acceptable for dev; production should ship lower-resolution variants (compressed WebP, or 256×256 PNG). Flagged in handoff.
- **No new tests added** for the integration: visual changes are verified manually. The fallback path is exercised by removing a registered URL from `PORTRAIT_URLS` (or by giving a class no entry).
- **Portraits don't change facing on canvas.** The horizontal flip is a one-time team-orientation hint, not a per-action facing. The unit's facing tick continues to communicate cardinal facing.

**Alternatives considered.**

- **Sync asset load at mount.** Rejected — would block first paint behind portrait load (~hundreds of ms for ~20MB total), and the user-facing payoff is small. Async with a one-frame swap is the smoother experience.
- **Mask the portrait to a circle** so corners don't overflow the team ring. Rejected for v1 — Pixi masks add a draw-order constraint and a recurring per-sprite cost. The visual overflow is small (corners poke out by ~6px on a 32×32 portrait inscribed in a 17-radius circle); acceptable.
- **Replace the colored body entirely when portrait loads.** Rejected — the body remains as a backdrop for translucent portraits and as the fallback. Always-on means no flicker if the portrait fails post-load.
- **Render portraits via Pixi `Texture` only** (no React `<img>` route). Rejected — UnitDetailPanel and QueueTower are React, not Pixi; using `<img>` with CSS sizing is the natural shape and avoids duplicating texture management in React.

**References.**

- Session 24.5 brief: `docs/twentyOnePlanning/session-24-5-brief.md` (Item 11)
- Session 24.5 plan: `docs/twentyOnePlanning/session-24-5-plan.md` (Architectural decision 11)
- Assets: `src/assets/portraits/*.png`, `src/assets/portraits/index.ts`
- Vite asset declarations: `src/vite-env.d.ts`
- Renderer changes: `src/renderer/unit-layer.ts` (setPortrait, teamRing, hit-flash tint), `src/renderer/battle-renderer.ts` (loadPortraitAssets)
- React surfaces: `src/ui/unit-detail-panel.tsx` (PortraitImage), `src/ui/queue-tower.tsx` (MiniPortrait, anchor `<img>`)
