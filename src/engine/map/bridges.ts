// Bridge (multi-layer deck) constants — S96, ADR-0155.
//
// A DECK is any tile at layer ≥ 1: a bridge span, a future platform or
// upper floor. Two constants govern how decks interact with the world;
// both were Chris's calls in the S96 bridge design pass:
//
// - `BRIDGE_DECK_THICKNESS`: the vertical extent of the deck's solid body
//   for line-of-sight, hanging BELOW its surface elevation — a deck at
//   elevation E occludes rays in the open band (E − thickness, E). Mirrors
//   the Barrier's height-1 convention (line-of-sight.ts), pointed down
//   instead of up.
//
// - `BRIDGE_MIN_CLEARANCE`: the minimum open space between a deck and the
//   tile beneath it — one unit for the deck's own occlusion band plus one
//   of headroom. Enforced two ways: statically by the map validator
//   (authored decks must sit ≥ clearance above their under-tile), and
//   dynamically by the RAM rule (a Worldcraft raise that would leave less
//   than this clearance destroys the deck — Worldcraft is a violent act
//   against carpentry in its way).

export const BRIDGE_DECK_THICKNESS = 1;
export const BRIDGE_MIN_CLEARANCE = 2;
