// Stacked-cell click resolution (S97 — bridge over/under UI, WI2).
//
// The renderer's hit-test resolves a pointer event GEOMETRICALLY (the
// layer whose art is under the pixel) and hands the UI the full stack
// at the cell. These helpers apply the CONTEXT rule on top: when the
// current action makes only one layer legal, the click means that
// layer, whatever pixel it landed on — so ordering a move to the one
// walkable cell under a span "just works". When the clicked layer is
// itself legal, the geometry (or an explicit stack-chip tap, which
// arrives as a layer-explicit click) is respected. The old S96
// occupant-priority-topmost rule survives only as the inspection
// tiebreak in `resolveInspectionEntry`, not as a front-line rule.
//
// Pure functions — exercised directly by unit tests.

import type { Position } from '@engine/index.ts';
import type { TileStackEntry } from '@renderer/index.ts';

function entryFor(clicked: Position, stack: ReadonlyArray<TileStackEntry>): TileStackEntry {
  return (
    stack.find((e) => e.pos.layer === clicked.layer) ?? { pos: clicked, occupant: null }
  );
}

// Resolve which layer of a stacked cell a click commits, given a
// per-layer validity predicate (legal move destination, valid target,
// …) from the current UI state:
//
//   1. Clicked layer valid → the click stands (geometry / chip choice).
//   2. Exactly one OTHER layer valid → context resolves to it.
//   3. Ambiguous (none or several valid) → the click stands; the caller
//      treats it like any other click (cancel-if-illegal, etc.) and the
//      stack chip is the disambiguation surface.
//
// Single-layer cells (stack length ≤ 1 — the overwhelming majority)
// resolve to the click unchanged.
export function resolveContextLayer(
  clicked: Position,
  stack: ReadonlyArray<TileStackEntry>,
  isValid: (entry: TileStackEntry) => boolean,
): TileStackEntry {
  const clickedEntry = entryFor(clicked, stack);
  if (stack.length <= 1) return clickedEntry;
  if (isValid(clickedEntry)) return clickedEntry;
  const valid = stack.filter(isValid);
  if (valid.length === 1) return valid[0]!;
  return clickedEntry;
}

// Inspection resolution (idle / action-menu): the clicked layer's
// occupant when present, else the topmost occupied layer of the stack
// (the stack arrives topmost-first) — a click anywhere on a stacked
// cell inspects the unit you can see. Falls back to the clicked entry
// when nobody is home.
export function resolveInspectionEntry(
  clicked: Position,
  stack: ReadonlyArray<TileStackEntry>,
): TileStackEntry {
  const clickedEntry = entryFor(clicked, stack);
  if (clickedEntry.occupant !== null) return clickedEntry;
  return stack.find((e) => e.occupant !== null) ?? clickedEntry;
}
