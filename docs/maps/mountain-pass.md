# Mountain Pass

*Design prose preserved from the hand-written map module header when the module migrated to the
Cartographer generated format (S98). The S70 brief's Appendix holds the original grid.*

Session 70's fourth authored map and the first to carry a *split* deployment config.

A narrow NW→SE pass: a broad NW valley basin (the 3-5 cluster, rows 1-7 cols 1-8), a low central
spine (the run of 2s at (6,8), (8,10), (8,11)), and a narrow SE defile walled by the bottom-center
massif (cols 7-10, rows 12-15, elev 7-10 — the SW wall) and the rising NE ridge (cols 10-14, peak
(14,5) = 11). "Ripe for an ambush": the split config (`content/deployment/registry.ts` →
`mountain_pass`) sits the ambusher in the SE heights on both flanks of the defile, the victim out
in the NW valley.

Elevations span 2-11; every tile is ≥ 2, so no water under the universal water-table convention.
The Session 70 visual pass paints three elevation bands: the high ground (≥ 7 — the SW massif and
NE ridge) is `rock`, the mid band (5-6) is `grass_rock` (a grass-over-stone transition), and the
lowlands (2-4) stay `ground`. All three are land, step cost 1, in every class's `canEnter` — the
split is purely visual. (In the migrated spec these are the `gte 7 → rock` / `gte 5 → grass_rock`
terrain bands.)

Deployment (S70, `mountain_pass` → `default`): the victim (Blue, team_a) deploys as one contiguous
block in the NW valley basin (8 tiles, elev 3-5, uncapped). The ambusher (Red, team_b) splits
across two disjoint SE-heights sub-zones flanking the defile: the dominant SW massif (elev 7-10,
cap 3) and the lower NE edge (elev 5-8, cap 2). Caps sum to 5 = the 5v5 roster, so the ambusher
fills exactly.
