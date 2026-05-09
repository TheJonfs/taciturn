## ADR-0031: Line AoE shape with kinematic stop, and the universal AoE-expansion model

**Status:** Accepted
**Date:** 2026-05-09

## Context

Session 19 ships Fire Mage. Two of the kit's pieces need engine substrate beyond what cones (session 18) introduced:

1. **Flame Lance** is a line-shape Ultimate — caster-anchored, cardinal-only, projects forward N tiles. The existing `AoeShape` union doesn't include lines. Diagonals are deferred to a future class consumer (cones followed the same path in session 18).

2. **Aether Bloom** is a Support passive that grows magical AoE shapes by one parameter. Fire Mage gets it free; other classes pay capacity to equip it. The growth rule needs to be defined per shape kind.

Additionally: `verticalTolerance` on the existing AoE shapes filters per-tile independently against the anchor's elevation. For a *line*, that's not the right semantic — a wall in the middle of the line should block the line's continuation, not just exclude that single tile while allowing tiles past the wall to be included.

## Decisions

### `'line'` AoeShape variant

```typescript
export type AoeShape =
  | { readonly kind: 'tile' }
  | { readonly kind: 'diamond'; readonly radius: number }
  | { readonly kind: 'square'; readonly radius: number }
  | { readonly kind: 'cross'; readonly radius: number }
  | { readonly kind: 'cone'; readonly rows: ReadonlyArray<number> }
  | { readonly kind: 'line'; readonly length: number }    // new
  | { readonly kind: 'custom'; readonly offsets: ReadonlyArray<AoeOffset> };
```

A line is **caster-anchored** (uses `AoeSpec.anchorMode: 'caster'` per ADR-0029, parallel to cones), **cardinal-only** (direction snaps via `cardinalFromTo`), and projects `length` tiles forward from the caster's tile. The caster's tile is *not* included (the caster doesn't hit themselves with their own line spell); the line starts one tile in front and extends `length` tiles total.

`shapeOffsets({ kind: 'line', length: N }, direction)` returns N offsets along the forward axis: `[forward × 1, forward × 2, ..., forward × N]`. Direction defaults to `'N'` if omitted (so callers without a directional context get a stable shape; misuse is caught by `aoeFootprint`'s caster-anchor requirement).

The dispatcher (in `resolveAbilityTargets`) treats lines like cones: requires `anchorMode: 'caster'`, throws on a cone-or-line shape with `anchorMode: 'target'`. The footprint anchor is the caster's position (not the target tile); the direction is `cardinalFromTo(caster.position, payload.target.position)`.

### Kinematic stop on line shapes

`aoeFootprint` for `'line'` shapes uses **early-termination semantic**: iterate forward from the caster, and on encountering a tile whose elevation differs from the caster's by more than `verticalTolerance`, stop. Tiles beyond the wall are not affected even if their individual elevation would pass tolerance.

```typescript
// In aoeFootprint:
case 'line': {
  const result: Tile[] = [];
  for (let step = 1; step <= shape.length; step++) {
    const x = anchor.x + forward.dx * step;
    const y = anchor.y + forward.dy * step;
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) break;  // off the map → stop
    const tilesHere = tilesAt(map, x, y);
    const inToleranceTiles = tilesHere.filter(
      (tile) => Math.abs(tile.elevation - anchor.elevation) <= verticalTolerance,
    );
    if (inToleranceTiles.length === 0) break;  // wall → stop, no tiles past this point
    for (const tile of inToleranceTiles) result.push(tile);
  }
  return result;
}
```

This semantic is **specific to line**. The existing per-tile-filter behavior is preserved for diamond / square / cross / cone / custom — those are spread shapes where "an explosion ignores walls per-tile" is the right model. A line is a projectile / beam; a wall stops it.

`verticalTolerance` for Flame Lance is **5** (your pick — large enough to clear most terrain, low enough that a true vertical wall blocks).

**Out of scope for v1:** kinematic stop on diagonal lines (no diagonal lines exist), kinematic stop for knockback paths (knockback already handles its own collision policy via `applyKnockback`), and applying the kinematic stop semantic to other shape kinds. If a future content consumer wants "cone with kinematic stop" or similar, this ADR doesn't preclude it but doesn't ship it either.

### Universal AoE-expansion model

`enlargeAoeShape(shape: AoeShape): AoeShape` is a pure helper that returns the shape grown by one parameter step:

| Shape | Base | Enlarged |
|---|---|---|
| `tile` | (1 tile) | `cross r1` (5 tiles) |
| `diamond r=N` | (Manhattan ≤ N) | `diamond r=N+1` |
| `square r=N` | (Chebyshev ≤ N) | `square r=N+1` |
| `cross r=N` | (arms length N) | `cross r=N+1` |
| `line length=N` | (N forward) | `line length=N+1` |
| `cone rows=[…]` | (as declared) | unchanged |
| `custom offsets=[…]` | (as declared) | unchanged |

Cone and custom shapes are intentionally exempt:

- **Cone**: cone shapes have their own asymmetric character. "Bigger cone" could mean wider rows, more rows, or both — no single rule serves all consumers. A future "cone-extender" passive can declare its own modifier.
- **Custom**: custom shapes are author-defined offset lists; there's no parameter to bump.

The Aether Bloom passive registers `modifyAoeShape` and uses `enlargeAoeShape` directly:

```typescript
passiveHook('modifyAoeShape', (args) => {
  if (!args.ability.tags?.includes('magical')) return args.baseShape;
  return enlargeAoeShape(args.baseShape);
});
```

**Filter on `'magical'` tag**, not on Fire-only or any class identity. The passive is universal — works on any magical AoE from any caster. Fire Mage gets it free via `freeAbilities`; other classes pay capacity 2 to equip. Fire Storm's base shape is `cross r1` (5 tiles); with Aether Bloom equipped, it becomes `cross r2` (9 tiles). Without it, Fire Storm reverts to the base. A future cross-classed mage casting Fire Storm gets the base cross r1 unless they spend a Support slot on Aether Bloom.

**Why not a Fire-specific passive:** the universal shape is more general and creates a real loadout decision (drop Aether Bloom for a non-AoE Support, lose the AoE size). A Fire-specific passive would be redundant — Fire Mage's only AoE is Fire Storm, so a Fire-only modifier reduces to the universal modifier on Fire Storm + nothing on other classes' AoEs (which is exactly what equipping Aether Bloom on Fire Mage achieves). Universal is cheaper to ship and more useful.

### Healing and friendly-fire interactions

The AoE-expansion modifier doesn't gate on healing — a future group-heal AoE would expand too, which is the right behavior (more allies in the heal). The modifier also doesn't gate on friendly-fire considerations; the dispatcher's friendly-fire filter (per ADR-0025) runs after the shape modification, so the larger shape just exposes more candidates to the existing filter.

## Consequences

### Positive

- **`enlargeAoeShape` is a pure helper.** Testable in isolation; reused by any future "AoE expander" content. Aether Bloom's hook handler is a one-liner.
- **Line shape semantics are honest.** A line that "shoots over a chasm to hit the back row" wouldn't match player intuition; the kinematic stop matches what players expect from a projectile / beam.
- **Cardinal-only line follows cone's precedent.** Same `cardinalFromTo` snap; same `anchorMode: 'caster'` requirement; same throw-on-misuse policy.
- **Aether Bloom is a single shipped piece.** No Fire-specific duplicate; the future "more AoE" content (a Mediator passive or similar) reuses it.

### Trade-offs

- **`enlargeAoeShape` is a no-op on cone and custom.** A Fire Mage with Aether Bloom casting a cone-shape spell sees no benefit; a future "shape grows wider" cone modifier would need its own helper. Acceptable for v1.
- **Line vertical tolerance default.** Flame Lance specifies `verticalTolerance: 5`; future line-shape spells must specify their own. No engine default — a missing field would surface as a content authoring bug at first cast.
- **Direction is captured at cast time, not cell-by-cell.** A line going around a corner isn't supported; the line is a straight cardinal projection. This matches FFT's typical line-spell behavior; if a future spell wants curved or path-following lines, that's a different shape kind.
- **The kinematic stop runs in `aoeFootprint`, not in the dispatcher.** Means the single-source-of-truth for "what tiles does this AoE affect" stays in `aoeFootprint`; the dispatcher just calls it. The trade-off is that `aoeFootprint`'s line branch reads the map differently from other shapes (forward iteration with break, vs. parallel filter), making the function slightly less uniform.

### Future work surfaced

- **Diagonal lines / cones.** Cardinal-only is a v1 simplification. When an 8-direction class ships, `DIRECTION_BASIS` and `cardinalFromTo` extend.
- **Cone-extender passive.** When a class wants "bigger cones," `enlargeAoeShape` extends with a cone branch — likely "append the last row to the rows list."
- **Stacking AoE expanders.** Two passives both registering `modifyAoeShape` would chain (each runs `enlargeAoeShape` on the previous result). This composes naturally — a `cross r1` with two expanders becomes `cross r3`. No engine work needed; the chain runner already handles it.
- **Per-element AoE expanders.** A "Fire-only" expander filtering on `tags?.includes('fire')` would compose cleanly with Aether Bloom — both fire on Fire spells, neither fires on Earth spells.
- **Renderer support.** Line and cone preview highlighting in the UI is a renderer concern. v1 demo battles use the AI controller for Fire Mage, so no UI work is forced this session.

## Alternatives considered

- **Fire-specific "Kindling" passive.** Rejected per the "why not a Fire-specific passive" rationale — universal is more general at the same cost.
- **AoE expansion declared per-ability (`baseShape` + `enlargedShape` fields).** Rejected — every AoE ability would have to predeclare its enlarged form, even if the rule is mechanical (radius+1). Worse: stacking multiple expanders becomes ad-hoc per ability.
- **Line shape as `cone` with `rows: [1, 1, 1, ...]`.** Rejected — semantically a line is not a cone (cones widen; lines don't), and `aoeFootprint`'s cone branch doesn't have the kinematic-stop semantic. Cleaner to ship line as its own variant.
- **Kinematic stop on all shape kinds.** Rejected — diamond / square / cross are spread shapes (explosion, area buff); a wall in the middle of a 3×3 burst doesn't block half the burst, it just excludes that one tile. The per-tile filter is the right model for spreads.
- **Using `verticalTolerance` as the line's "stop on this much elevation" threshold without a separate field.** Accepted — the same number serves both the per-tile filter and the kinematic stop. A future spell that wants asymmetric "filter forgiving but stop on smaller wall" can ship a separate field then.

## References

- ADR-0025 — AoE substrate (per-target dispatch, friendly-fire filter, modifyAoeShape hook).
- ADR-0026 — forced-movement collision (knockback's own kinematic policy; not extended here).
- ADR-0029 — Water Mage substrate (cone shape, anchorMode: 'caster', cardinalFromTo helper).
- `src/engine/types/aoe-shape.ts` — `'line'` variant.
- `src/engine/map/aoe.ts` — `shapeOffsets` and `aoeFootprint` line branches; `enlargeAoeShape` helper.
- `src/engine/actions/reducers.ts` — dispatcher's anchorMode check (cone-or-line require `'caster'`).
- `src/content/abilities/aether-bloom.ts` — universal AoE expander.
- `src/content/abilities/flame-lance.ts` — first line-shape consumer.
- `src/content/abilities/fire-storm.ts` — first AoE-expansion consumer.
