# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When
starting a session, read this file and process every item — act on it, promote it
elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a
reason. Items do not accumulate. If there are no notes to leave, replace the
contents with `_No handoff this session._` so the next session knows the file has
been processed.

---

## From S78 — TABA campaign M1 (branching + interstitial) + a dev debug menu (2026-06-30)

**M1 shipped and hand-verified.** Generalized M0's linear A→B into a
**forward-branching graph** navigated at a **world map**, built the
**interstitial beat-sequence framework** the map plugs into, and (post-review)
added save-after-battle + a dev-only battle debug menu. **No engine changes** for
M1 itself. Suite green (**2196**), `tsc -b` + `vite build` clean.

Commits on `main`: `1009bb1` (M1 framework, ADR-0134) · `adb5585` (docs) ·
`0b93981` (M1 roster) · `5766075` (save-after-battle) · `d2fb87a` (debug menu) ·
`41b86fc` (debug remove-unit rout fix).

### ✅ Verified this session (Chris, via the new debug menu)
Force Win / Force Lose drive the interstitial correctly; the branching flow,
result screen, and world-map routing all work; clearing a side via Remove routs.
Chris considers "most of the behavior we're looking for" verified. Not
exhaustively re-checked but believed good: permadeath **Lost** lines + carry
across multiple nodes (the mechanism is tested; the end-to-end multi-node visual
wasn't specifically walked).

### 🧰 New dev tool: the battle debug menu (`src/app/DebugBattleMenu.tsx`)
Gated by `import.meta.env.DEV` (tree-shaken out of prod — invisible on Vercel; use
the local dev server to see it). Collapsible 🐛 chip in-battle → **Force Win**,
**Force Lose**, **Remove ‹unit›** (either side). Backed by two
`DemoOrchestrator` debug methods: `debugForceOutcome` (stamps `outcome`) and
`debugRemoveUnit` (KOs + commits `system_unit_removed` through the reducer). Use
it to traverse the graph fast in future sessions. NB: Remove skips the normal
death pipeline's hooks (on-death reactions won't fire) — don't use it to test
death-triggered mechanics.

### 🔭 FOR THE M1.5 BRIEF (story-scenes) — decisions to make before building
The interstitial framework is the slot M1.5 plugs into, but it has shape
constraints the brief should resolve up front:
1. **It's POST-battle only.** Beats run after `onBattleEnd`, and they're
   *outcome-built* by `buildInterstitial`, not authored per node. FFT story
   scenes usually play **before** a battle (dialogue → fight) or standalone (no
   battle). Neither has a slot yet. Decide where pre-battle / standalone beats
   live in the loop (today: formation → deployment → battle → post-battle
   interstitial).
2. **Beats are outcome-built, not node-authored.** D3's "a node can specify its
   beats" is stubbed, not wired. M1.5 likely shifts to node-authored beat lists.
3. **`requireBattle` assumes every node fights.** The model already allows
   battle-less nodes (`node.battle` is optional), but `CampaignApp`/`loop.ts`
   assert a battle via `requireBattle`. That assertion is the seam M1.5 relaxes
   for story-only nodes.
4. **The multi-beat runner is fresh ground.** M1 only ever runs 1–2 beats, and
   there's no React test for the runner (per the deferred-UI-test convention).
   M1.5 will be the first to run 3+ beats — worth knowing.
The runner itself stays an **open set** (dispatches by `beat.type`, never
switches on it): a `story-scene` beat = a descriptor variant + a renderer + a
registry entry, no runner change.

### ✅ M1 test roster (Chris-picked) — `m1Roster` in `roster.ts`
**N=8, deploy K=5, uniform Lv 25** via `M0_BASELINE_LEVEL` (the single difficulty
knob). Gravity Well five (Sera/Assassin, Thessaly/Calculator, Lumen/Pyromancer,
Chris/Templar, Clio/Hydrologist, rescaled to 25) + Alice/Alchemist ♀,
Miluda/Knight ♀, Can'tano/Terraformer ♂. **Equipment uniqueness intentionally
NOT held** (unenforced in campaign; the economy owns gear later) — Miluda and
Can'tano reuse roster gear by design. Don't "fix" it.

### Known simplifications (by design — not bugs)
- **Old M0 (v1) saves don't resume** — position widening bumped the save to
  **v2**; a v1 slot fails loud on load (deliberate, no migration). A small
  "obsolete-version → treat as no save" guard in `App`'s resume path is the fix
  if a throwing Resume button ever annoys (deferred; didn't want a catch that
  masks real corruption).
- **Interstitial-resume shows the map only** — save-after-battle carries an
  `awaiting_route` phase; reloading after a win resumes at the world map (no
  re-fight), but the result-summary isn't replayed (its BattleResult is
  transient). If desired, persist the last result to rebuild it — Chris to judge
  after a playthrough.
- **Wounds still don't carry** (M0 D-E) — heal-to-full each boundary; switch-on
  is one line in `apply-back.ts`. Deferred to an attrition pass.
- **Encounter winnability:** the finale (The Return) reuses the River Ridge enemy
  team — may feel soft by the end. Bump `M0_BASELINE_LEVEL` or hand-author its
  team if it plays trivially (M4 owns real encounter authoring).
- **Map is a placeholder SVG** — structure over art, meant to be reskinned.

### Flagged (pre-existing, NOT M1): border-shorthand console warnings
Deployment + formation roster rows mix CSS `border` shorthand with a `borderColor`
override on select/disable → React "mixing shorthand and non-shorthand" dev
warnings. Predates M1 (M0 `FormationScreen` + reused `DeploymentScreen`); the new
beat views use longhand. Cosmetic, dev-only — worth a small cleanup someday.

### Next TABA milestones
**M1.5 — story-scenes** (see the design forks above). Then **M2 — progression**
(XP/JP/level/unlock), which extends `UnitBattleSummary` once the battle *tracks*
XP/JP (don't pre-build the empty fields).
