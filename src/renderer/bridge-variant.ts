// Bridge deck art selection (S97 — the six-piece bridge kit).
//
// Bridge deck tiles don't use the seeded random variant pick the other
// terrains do: their art is ORIENTED. The kit is six pieces — a flat
// deck per travel axis plus four inclines named by the direction their
// HIGH edge faces — and which piece a deck tile wears is fully
// determined by the map: the span's axis (same-layer neighbors) and
// the elevation of whatever each span end connects to. Deterministic
// by construction, so no seed is involved and replays/reloads are
// trivially stable.
//
// Rules (per bridge tile — the SPAN is the chain of adjacent
// bridge-terrain tiles at any layer, so a layer-0 approach RAMP on a
// bank is part of the same bridge as the lifted deck it leads to):
//   - Axis: span continuations N/S vs E/W. Both axes present (an
//     L-bend — no authored content) → the axis with more continuations
//     wins, tie → NS. Neither (a single-tile span) → NS.
//   - IN-SPAN slope: a span neighbor at HIGHER elevation votes a rise
//     toward it (the lower tile carries the ramp art; the higher
//     neighbor stays flat toward it). Equal-elevation neighbors vote
//     nothing.
//   - END slope: on a side where the span doesn't continue, compare
//     the tile's elevation to the topmost tile beyond it (the bank a
//     walker steps onto): lower bank → rise away from it (high edge
//     toward the span interior); higher bank → rise toward it; equal /
//     off-map → no incline.
//   - One incline vote → that rise piece. Two agreeing votes (a
//     consistently sloping ramp) → that rise piece. Conflicting votes
//     (a one-tile arch — the kit has no double-incline piece) or no
//     votes → the axis's flat piece.
//
// Alvera's western bridge (deck elev 3, north approach elev 2, and the
// S97 layer-0 ramp tile at (2, 10) elev 2) reads, north to south:
// rise_s, flat_ns, flat_ns, rise_n — the span flattens onto the rising
// bank ramp.

import type { BattleMap, Tile } from '@engine/index.ts';

export type BridgeDeckVariant =
  | 'flat_ns'
  | 'flat_ew'
  | 'rise_n'
  | 'rise_s'
  | 'rise_e'
  | 'rise_w';

// The fixed pool order for the 'bridge' terrain's texture manifest —
// index into the loaded pool = indexOf(variant). Kept here (beside the
// selection rule) so the manifest and the picker can't drift apart.
export const BRIDGE_DECK_VARIANT_ORDER: ReadonlyArray<BridgeDeckVariant> = [
  'flat_ns',
  'flat_ew',
  'rise_n',
  'rise_s',
  'rise_e',
  'rise_w',
];

// The topmost bridge-terrain tile at a cell — the walkable surface of
// the span there, whatever layer it rides (a lifted deck or a layer-0
// bank ramp). Undefined when the cell isn't part of a bridge.
function bridgeTileAt(map: BattleMap, x: number, y: number): Tile | undefined {
  let top: Tile | undefined;
  for (const t of map.tiles) {
    if (t.x !== x || t.y !== y || t.terrain !== 'bridge') continue;
    if (top === undefined || t.layer > top.layer) top = t;
  }
  return top;
}

// The tile a walker steps onto at (x, y) — the topmost layer present.
function topmostAt(map: BattleMap, x: number, y: number): Tile | undefined {
  let top: Tile | undefined;
  for (const t of map.tiles) {
    if (t.x !== x || t.y !== y) continue;
    if (top === undefined || t.layer > top.layer) top = t;
  }
  return top;
}

// A span end only slopes toward/away from a bank it plausibly
// CONNECTS to. A bank further than this from the tile's elevation is
// scenery, not an approach (Alvera's southern ramp abuts an elev-8
// house wall — the bridge must not "rise toward" a wall), so it casts
// no vote. 2 matches the game's practical single-step climb range.
const BRIDGE_END_MAX_STEP = 2;

// The incline vote for one span end. `intoSpan` is the rise variant
// whose high edge faces the span interior (bank lower than deck);
// `towardBank` faces the bank (bank higher than deck).
function endVote(
  map: BattleMap,
  tile: Tile,
  dx: number,
  dy: number,
  intoSpan: BridgeDeckVariant,
  towardBank: BridgeDeckVariant,
): BridgeDeckVariant | null {
  const bank = topmostAt(map, tile.x + dx, tile.y + dy);
  if (bank === undefined) return null;
  const delta = bank.elevation - tile.elevation;
  if (delta === 0 || Math.abs(delta) > BRIDGE_END_MAX_STEP) return null;
  return delta < 0 ? intoSpan : towardBank;
}

export function bridgeDeckVariantFor(map: BattleMap, tile: Tile): BridgeDeckVariant {
  const n = bridgeTileAt(map, tile.x, tile.y - 1);
  const s = bridgeTileAt(map, tile.x, tile.y + 1);
  const e = bridgeTileAt(map, tile.x + 1, tile.y);
  const w = bridgeTileAt(map, tile.x - 1, tile.y);

  const nsAxis =
    (n !== undefined ? 1 : 0) + (s !== undefined ? 1 : 0) >=
    (e !== undefined ? 1 : 0) + (w !== undefined ? 1 : 0);

  // Per axis side: a continuing span neighbor votes only when it sits
  // HIGHER (the lower tile carries the ramp art); a span end defers to
  // the bank beyond it.
  const sideVote = (
    neighbor: Tile | undefined,
    dx: number,
    dy: number,
    towardNeighbor: BridgeDeckVariant,
    awayFromNeighbor: BridgeDeckVariant,
  ): BridgeDeckVariant | null => {
    if (neighbor !== undefined) {
      return neighbor.elevation > tile.elevation ? towardNeighbor : null;
    }
    return endVote(map, tile, dx, dy, awayFromNeighbor, towardNeighbor);
  };

  const votes: BridgeDeckVariant[] = [];
  if (nsAxis) {
    const vn = sideVote(n, 0, -1, 'rise_n', 'rise_s');
    if (vn !== null) votes.push(vn);
    const vs = sideVote(s, 0, 1, 'rise_s', 'rise_n');
    if (vs !== null) votes.push(vs);
  } else {
    const vw = sideVote(w, -1, 0, 'rise_w', 'rise_e');
    if (vw !== null) votes.push(vw);
    const ve = sideVote(e, 1, 0, 'rise_e', 'rise_w');
    if (ve !== null) votes.push(ve);
  }

  const flat: BridgeDeckVariant = nsAxis ? 'flat_ns' : 'flat_ew';
  if (votes.length === 0) return flat;
  if (votes.length === 1) return votes[0]!;
  return votes[0] === votes[1] ? votes[0]! : flat;
}
