# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When
starting a session, read this file and process every item — act on it, promote it
elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a
reason. Items do not accumulate. If there are no notes to leave, replace the
contents with `_No handoff this session._` so the next session knows the file has
been processed.

---

## S83 — TABA M2 Formation UI + JP-gating LIVE (2026-07-04)

**Shipped** the whole between-battles Formation UI and flipped JP-gating live
(ADR-0140), across **5 commits** (`39d9d66` roster · `e196821` dossier +
Constellation + `reclassUnit` · `48d3491` Training + `purchaseComponent` ignite ·
`42fb3b5` Loadout tab · `a4445a3` gating-live). Suite green (**2401**), `tsc -b`
clean. All new UI is `src/app/formation/`; ops are campaign-side. Verified in a
dev harness (`?formation`) and a real New-Campaign launch into deployment.

### M2 is effectively complete
The reclass/spend/loadout UI + gating-live were the last big M2 pieces. What
remains are small tails (below).

### Watch-fors / things to eyeball in playtest
- **Seeded starting kits open tiers.** Gating-live needed authored units (empty
  unlocks) pre-unlocked from their loadout, else they couldn't act. `earned` is
  set == seeded spend so purse is 0 — BUT seeded spend counts toward tier
  thresholds, so a L25 veteran may **start with an adjacent reclass tier open**.
  Intended for veterans; if it feels too generous, dial the seed scope in
  `progression/starting-kit.ts` (e.g. seed only the equipped command sets'
  *authored* actives rather than the whole class). This is the one design
  consequence worth a look.
- **Loadout secondary is single-select.** Magus Crown lifts secondary capacity to
  2; the Loadout tab doesn't yet support a 2nd secondary. Minor, later.
- **Authored M1 loadouts carry un-unlocked passives** (they predate the JP
  model — e.g. Sera's Landwalker/Biomastery). The Loadout tab shows equipped
  passives regardless, so no stuck slots; removing one drops it (can't re-add
  without training). Harmless, but it's why some equipped passives read
  "exported" without a matching unlock until seeding runs.

### Remaining M2 tails
1. **JP spillover** on over-threshold spend — brief seam, still TBD.
2. ~~Enemy progression authoring~~ — **ENABLER + FIRST BATTLE DONE (S83, commits
   `1442061`, `1eb9ee0`).** `authoredEnemy(spec)` + `foldEnemyTeam` + `foldBattle`
   + `NodeBattle.enemies?`: an authored enemy is a `CampaignUnit` folded through
   the team-agnostic `campaignPlacement` — curve stats at its level, `statsByLevel`
   (enemies LEVEL mid-battle; the XP mechanism was already team-agnostic), and a
   kit GATED to its explicit `unlocks` (a SUBSET = a weak enemy). NO engine
   change. **River Ridge's opener** is authored (`node.ts` `riverRidgeEnemies()`):
   the garrison is derived from the template's own placements, dropped to **L22**,
   each gated to a **basic two-active kit** (per-class `RIVER_RIDGE_ENEMY_KITS` —
   easy to retune). The finale keeps the template's default (stronger) enemies.
   Next: tune the OTHER nodes' enemy teams (Stonebridge/Marshmoor/Mountain Pass)
   the same way — pure content/data.

**Verification note (Pixi deployment):** the campaign flow to an ACTUAL battle
can't be fully driven by the preview tools — the deployment map is a Pixi canvas
that ignores synthetic pointer events, so unit placement (and thus "Start Battle")
can't be automated. Everything up to deployment verifies in-browser (fold runs,
screen renders); the enemy correctness is covered by deterministic integration
tests (`authored-enemy.test.ts`). Seeing the tuned enemies fight needs a **manual
playtest**.

**Watch-for (pre-existing, not this work):** advancing a story scene fast logs a
React "Cannot update a component while rendering a different component"
(`CampaignApp` ↔ `StorySceneBeatView`). Surfaced by rapid dialogue clicks; likely
a latent setState-in-render in the interstitial advance. Benign in normal play
(one click per line), but worth a look.
3. **"Level Up!" banner** — animator polish (log line + HP-bar jump only today).

### Follow-ups the brief named that this session did / deferred
- **World-map management entry — DONE (commit `cc213e5`).** A "Manage Roster"
  button on the world map opens the Formation UI (`FormationManager` = the
  reusable roster⇄dossier shell) on the live `CampaignState.roster`; edits persist
  via `setState` + `saveCampaign` and carry into the next node (return rebuilds
  the world map from the just-edited state). The dev harness (`?formation`) now
  uses `FormationManager` too.
- **Pre-battle management entry — STILL DEFERRED.** The old M0 `FormationScreen`
  deploy-list still runs pre-battle; wiring the RosterView/dossier there (and/or a
  deploy-selection context) is the remaining Formation-flow follow-up. The
  ambient `onManageRoster` on `InterstitialRunner`/`BeatRendererProps` is the seam
  to reuse.
- **Recruitment order for Sort-by-Newest** — used roster array index (no
  recruitment ships until M3); add a monotonic `recruitedAt` when recruits land.
- **`canEquipPassive` open question** — resolved: enabler passives are
  true-but-inert (already the code's behavior); the UI notes the condition, never
  blocks.

### Dev harness
`FormationDevHarness` + `?formation` in `main.tsx` seeds a rich roster (fresh
campaign units are empty) for building/verifying the celestial UI. Dev-only,
URL-gated, kept for future formation work.

### Carried from earlier (still open, still by-design/low-priority)
- **Portrait override seam (ADR-0136)** — M5 completion to-do, untouched.
- **Border-shorthand console warnings** (M1) — cosmetic, dev-only, uncleaned.
- **"99 cap" is a guide fiction** (S80) — no global 99 clamp in code; a
  guide-doc correction someday.
