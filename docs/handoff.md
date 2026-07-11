# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When
starting a session, read this file and process every item — act on it, promote it
elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a
reason. Items do not accumulate. If there are no notes to leave, replace the
contents with `_No handoff this session._` so the next session knows the file has
been processed.

---

## S88 — M3 economy infrastructure SHIPPED whole (2026-07-11)

All four stages of `taba-economy-infrastructure-brief.md` landed (ADR-0145):
gil + battle award (Stage 0, `86ba0c0`), node lifecycle + navigable map +
skirmish valve (Stage 1, `bb155a8`), cumulative story-gated shops (Stage 2,
`8671c94`), recruitment (Stage 3, `5612ace`). Suite green (**2696**),
`tsc -b` clean, every stage verified end-to-end in the browser (spoils line,
return travel, skirmish vs the stub band, Dorter menu at Stonebridge,
buy/sell round-trip, a real hire persisting across reload).

### Chris's in-session rulings (now baked in)

- **The M1 graph IS the sandbox** — retrofit, no separate dev graph (its
  content is placeholder anyway). Combat nodes are farmable NOW (offsets
  −1/0/0/+2 placeholder); **Stonebridge is the hub**.
- **Return travel is free to any visited node** with availability.

### For Chris / the planner

- **The next economy beat is CONTENT, not machinery:** real bundle→node
  assignment (replace `PLACEHOLDER_BUNDLES` in `equipment-pool.ts`), real
  prices (fill `ITEM_PRICE_OVERRIDES`), and the unique acquisition/placement
  flows (all receipts are one `grantItems` call away; Spiked Maul mid-Ch3
  alongside Crystal Plate per the S87 numbers). Every dial sits in
  `campaign/economy-config.ts`, each marked placeholder (D-econ-6).
- **The brief's design source `taba-economy-framework.md` is not in the repo**
  — if it should be preserved, drop it into `docs/TABADesign/`.
- **M4 seam is exact:** replace `generateSkirmishParty(level, count, catalog)`
  in `campaign/skirmish.ts`; nothing else moves. The stub is deterministic
  and gear-less by design (also keeps effect weapons off enemy loadouts —
  standing AI-valuation deferral).

### Watch-fors now live (playtest, don't pre-nerf — brief's own list)

- **Income-to-price ratio:** at X=10/level, one L24 skirmish pays ~1200 gil ≈
  2.4 flat-priced items. Farming feels fast; fine for testing, flag for the
  balance pass.
- **XP rubber-band on high-offset skirmishes** (Mountain Pass +2) — intended
  catch-up; watch it doesn't trivialize leveling.
- **Recruitment cap** — pinned by test (no bypass path found); re-check if a
  new hire entry point ever appears.
- **Re-entry guard** — driver-level regression test exists
  (`CampaignApp.test.tsx`); the per-beat model means a future re-armed
  engagement must carry a NEW `storyBeatId`.

### Post-ship addition (same session, Chris's request)

World-map **party banner + FFT-style march** (`9b35211`): a gold standard
marks the company; travel marches it along the road network (BFS over
win-edges as undirected roads) before the destination opens. Pure
presentation — same `onAdvance`, delayed. `PartyBanner` in
`WorldMapBeatView.tsx` is placeholder art: when sprite/portrait art exists,
replace that one `<g>`; the march machinery doesn't change. Failsafe timer
completes arrival if rAF stalls (hidden tab); reduced-motion + tests skip
the walk.

### Noticed, not acted on

- A hub with no battle beat can't size a hire's vitals or host a skirmish
  (`hireGeneric`/`buildSkirmishBattle` fail loud). Fine for authored content;
  a future battle-less market town needs an explicit template source (same
  constraint as `bootstrapRosterVitals`).
- The skirmish result screen reuses the node name ("River Ridge — Skirmish
  Won"); if skirmishes later get flavor variety, the summary beat already
  carries a `skirmish` flag to hang it on.
- Dev-server tab ran on an auto-port again (5173 busy); no product impact.

### Carried from earlier (still open, low-priority — unchanged from S87)

- JP spillover on over-threshold spend (M2 tail).
- Enemy progression tuning for Stonebridge / Marshmoor / Mountain Pass (data).
- Loadout 2nd-secondary UI (Magus Crown / Command Cap), "Level Up!" banner
  polish, rapid-dialogue-advance React setState-in-render warning.
- "99 cap" guide fiction (no code clamp) — guide-doc correction someday.
- S85 open-register playtest items (Epee CT-refund loops, Star Robe lifesteal,
  Expert's Tunic × Golden Hairpin, tempo-caster stack, Scouring × dual-wield,
  Manaeater-as-default, Terra Robe maybe weak) — watch, don't pre-nerf.
- S87 playtest watch-fors (Cremation × Pendant, Shadowblade vs HP sponges,
  Del's Stave dump-on-buffs, Golden Rod clock, Volley Bow friendly fire,
  Excalibur above-curve by intent — gate behind the optional boss when the
  economy content pass places it).
- FormationDevHarness (`?formation`) still shows 2 synthetic invalid units
  (Nova, Ptolemy) as a free showcase of warning states.
- reclassUnit frees now-illegal passives but keeps now-illegal gear (D2:
  surface, don't resolve).
