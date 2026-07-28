# Zelmonia Hills (16×16)

Cartographer-authored (S98) — the spec lives in `src/content/maps/zelmonia-hills.ts`
(codegen output; edit via the Cartographer, not by hand). The Ch1 node-5 story
battle (Theo Renault) fights here; deployment zones in
`src/content/deployment/registry.ts`.

## Geography

Hills rising from the southern valleys (elev 2–4) through terraced shoulders to
a northern crest (elev 12–14), with eastern spur ridges (elev 11) and a scatter
of boulder outcrops through the mid-slopes (the hand-placed `grass_rock`
overrides).

## Terrain treatment (S100, Ch1 iteration)

The map reuses Mountain Pass's rocky-terrain art, rethresholded for this map's
2–14 elevation range:

- `gte 11 → rock` — bare stone on the northern crest and spur ridges.
- `gte 7 → grass_rock` — rocky grass across the 7–10 shoulders.
- Below 7 stays green `ground`; the water table (0/1) is authored but unused.

Purely cosmetic: `rock` / `grass_rock` are plain `land` in the ruleset, same
costs as `ground` (Session 70). The point is legibility — before this pass the
map was almost uniformly green and the elevation progression only read from the
tile digits. Thresholds are ordinary band entries; iterate them in the
Cartographer freely.
