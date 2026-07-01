# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When
starting a session, read this file and process every item — act on it, promote it
elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a
reason. Items do not accumulate. If there are no notes to leave, replace the
contents with `_No handoff this session._` so the next session knows the file has
been processed.

---

## From S78 — TABA campaign M1, the loop / branching + interstitial (2026-06-30)

Shipped M1 end to end (commit `1009bb1`, ADR-0134): generalized M0's linear A→B
into a **forward-branching graph** navigated at a **world map**, and built the
**interstitial beat-sequence framework** the map plugs into. **No engine
changes** (as M0 predicted). `tsc -b` + `vite build` clean; suite green (**2192**,
+19 campaign tests). Decomposition §8 marks M1 shipped; guide-changelog S78;
roadmap "out of scope" section updated (campaign + save/load moved into the TABA
track).

New: `src/campaign/graph.ts` (model + routing), `interstitial.ts` (pure beat
builder), `src/app/interstitial/` (runner + `ResultSummaryBeatView` +
`WorldMapBeatView`). Rewired: `node.ts` (authored M1 graph), `loop.ts`
(`resolveWin`/`routeToNode`), `types.ts`/`serialization.ts` (position → node id,
save **v2**), `CampaignApp.tsx`, `FormationScreen.tsx`, `App.tsx`.

### ⏳ OWED: Chris's hand-verify (the M1 acceptance the tools can't drive)
I tool-verified only to **battle launch** (boot clean, New Campaign → **v2**
autosave at `node-river-ridge`, Formation N8/K5 with bootstrapped caster MP, the
reused deployment screen — no new console errors). Driving the Pixi battle to a
win/loss isn't automatable here, so **please hand-verify:**
1. **Branching playthrough:** win River Ridge → result-summary → **world map
   offers Stonebridge + Marshmoor** → pick one → fight → … → reach **The Return**
   → **Campaign Complete**.
2. **The skippable side-node:** on the Stonebridge route, the map offers **both**
   Mountain Pass *and* skip-to-finale; taking the Pass then rejoins the finale.
3. **Loss = retry:** lose a battle → **Defeat** result screen → Retry re-enters
   the node from the autosave (failed attempt discarded).
4. **Mid-graph save/resume:** after routing to a branch, reload → **Resume**
   re-enters that node (the save is node-id based now).
5. The **result-summary** unit lines read right (Survived / KO / Lost), and
   permadeath (a crystallized unit) shows **Lost** + drops from later Formations.

### ✅ RESOLVED: the M1 test roster (Chris-picked)
`m1Roster` in `roster.ts` is now the campaign roster (App points at it; `m0Roster`
kept only for tests that need N>K). **N=8, deploy K=5, uniform Lv 25** via
`M0_BASELINE_LEVEL` (the single difficulty knob — change it and the whole roster
moves). Composition: the Mage War **Gravity Well** five (Sera/Assassin,
Thessaly/Calculator, Lumen/Pyromancer, Chris/Templar, Clio/Hydrologist —
rescaled off their authored per-slot levels to 25) + three hand-authored units
(Alice/Alchemist ♀, Miluda/Knight ♀, Can'tano/Terraformer ♂) with Chris-specified
loadouts + equipment. All fold clean; verified live to Formation.
- **Equipment uniqueness is intentionally NOT held** for this roster (Chris's
  call — it's unenforced in campaign anyway, and the economy will own gear
  availability later). Miluda overlaps the Templar (Chris) on Warrior's Aegis /
  Tactical Mask / Soldier's Leathers / Gauntlet of Might; Can'tano overlaps on
  Tome of Power (Thessaly) / Skullclamp (Alice) / Wizard Robe (Lumen). Runs fine;
  the unique-per-team convention just doesn't hold if a colliding pair is
  co-deployed. Don't "fix" it — it's deliberate.

### Encounter winnability (carried from M0, still relevant)
M1 reuses the shipped battle templates' enemy teams at their authored stats vs the
`m1Roster` at **Lv 25**. The loop needs both outcomes reachable per node. The
**finale (The Return) reuses the River Ridge template** — same enemies as the
opener, which may feel easy by then; if it plays trivially, hand-author its enemy
team or bump `M0_BASELINE_LEVEL` (encounter authoring is M4, but a one-off tune is
cheap).

### Known simplifications (by design — not bugs)
- **Old M0 (v1) saves don't resume** — the position widening bumped the save to
  **v2**; a v1 slot fails loud on load (deliberate, no migration). Start a new
  campaign. If a *throwing* Resume button on a stale v1 save bothers you in
  practice, a small "obsolete-version → treat as no save" guard in `App`'s resume
  path is the fix (deferred — didn't want an ad-hoc catch that could mask real
  corruption).
- **Interstitial reload re-fights** — the autosave lands at node *entry* (start +
  after each map pick), so reloading *during* an interstitial (won, not yet
  picked) re-enters the just-won node. Carried M0 "save = node entry" discipline.
- **Wounds still don't carry** (M0 D-E) — heal-to-full each boundary; the carry
  plumbing is built, switch-on is one line in `apply-back.ts`. Deferred to an
  attrition pass.
- **Map is a placeholder SVG** — structure over art, meant to be reskinned.

### Flagged (pre-existing, NOT M1): border-shorthand console warnings
The deployment + formation roster rows mix CSS `border` shorthand with a
`borderColor` override on select/disable, so React logs "mixing shorthand and
non-shorthand" dev warnings. This predates M1 (M0's `FormationScreen` + the reused
`DeploymentScreen`); my new beat views use longhand and don't add to it. Cosmetic,
dev-only — left as-is (out of M1 scope); worth a small cleanup pass someday.

### Next TABA milestone
**M1.5 — story-scenes:** a `story-scene` beat type dropped into the framework this
session built (the runner is already an open set; add a descriptor variant + a
renderer + a registry entry — don't touch the runner). Then **M2 — progression**
(XP/JP/level/unlock), which extends `UnitBattleSummary` once the battle *tracks*
XP/JP (don't pre-build the empty fields).
