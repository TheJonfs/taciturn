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
// Rules (per deck tile):
//   - Axis: same-layer neighbors N/S vs E/W. Both axes present (an
//     L-bend — no authored content) → the axis with more continuations
//     wins, tie → NS. Neither (a single-tile span) → NS.
//   - A tile is an END on a side where the span doesn't continue. Each
//     end compares the deck's elevation to the topmost tile beyond it
//     (the bank a walker steps onto): lower bank → the deck rises away
//     from it (high edge toward the span interior); higher bank → the
//     deck rises toward it; equal / off-map → no incline.
//   - One incline vote → that rise piece. Two agreeing votes (a
//     consistently sloping ramp) → that rise piece. Conflicting votes
//     (a one-tile arch — the kit has no double-incline piece) or no
//     votes → the axis's flat piece.
//
// Alvera's western bridge (deck elev 3, both approaches elev 2) reads,
// north to south: rise_s, flat_ns, rise_n — the hump-bridge arc.

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

function spanContinues(map: BattleMap, x: number, y: number, layer: number): boolean {
  for (const t of map.tiles) {
    if (t.x === x && t.y === y && t.layer === layer) return true;
  }
  return false;
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
  if (bank.elevation < tile.elevation) return intoSpan;
  if (bank.elevation > tile.elevation) return towardBank;
  return null;
}

export function bridgeDeckVariantFor(map: BattleMap, tile: Tile): BridgeDeckVariant {
  const n = spanContinues(map, tile.x, tile.y - 1, tile.layer);
  const s = spanContinues(map, tile.x, tile.y + 1, tile.layer);
  const e = spanContinues(map, tile.x + 1, tile.y, tile.layer);
  const w = spanContinues(map, tile.x - 1, tile.y, tile.layer);

  const nsAxis = (n ? 1 : 0) + (s ? 1 : 0) >= (e ? 1 : 0) + (w ? 1 : 0);

  const votes: BridgeDeckVariant[] = [];
  if (nsAxis) {
    if (!n) {
      const v = endVote(map, tile, 0, -1, 'rise_s', 'rise_n');
      if (v !== null) votes.push(v);
    }
    if (!s) {
      const v = endVote(map, tile, 0, 1, 'rise_n', 'rise_s');
      if (v !== null) votes.push(v);
    }
  } else {
    if (!w) {
      const v = endVote(map, tile, -1, 0, 'rise_e', 'rise_w');
      if (v !== null) votes.push(v);
    }
    if (!e) {
      const v = endVote(map, tile, 1, 0, 'rise_w', 'rise_e');
      if (v !== null) votes.push(v);
    }
  }

  const flat: BridgeDeckVariant = nsAxis ? 'flat_ns' : 'flat_ew';
  if (votes.length === 0) return flat;
  if (votes.length === 1) return votes[0]!;
  return votes[0] === votes[1] ? votes[0]! : flat;
}
