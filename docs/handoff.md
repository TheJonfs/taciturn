# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When
starting a session, read this file and process every item — act on it, promote it
elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a
reason. Items do not accumulate. If there are no notes to leave, replace the
contents with `_No handoff this session._` so the next session knows the file has
been processed.

---

## From S79 — TABA campaign M1.5 (story-scenes / battle-as-beat) (2026-07-01)

**M1.5 shipped.** Generalized M1's fixed formation→deployment→battle→post-battle
pipeline into a node-owned **beat sequence** where a battle is one beat-type among
others. Story scenes now play pre-battle, post-battle, or standalone.
`requireBattle` is gone. **No engine changes.** Suite green (**2211**), `tsc -b` +
`vite build` clean. ADR-0135. Decomposition §8 + roadmap + guide-changelog
updated.

New/changed code: `src/campaign/sequence.ts` (new — beat model + cursor helpers,
now owns `NodeBattle`), `graph.ts` (node.beats, requireBattle deleted), `loop.ts`
(`resolveWin` → `applyBattleBeatWin` + `resolveNode`; `battleWasWon(result,
playerTeam)`), `interstitial.ts` (`buildInterstitial` → `buildResultSummaryBeat`
+ `buildRouteChoiceBeat`; `story-scene` in the presentational union), `node.ts`
(beat sequences + authored scenes + the standalone "The Crossing" node),
`CampaignApp.tsx` (rewritten as a beat-sequence walker), `StorySceneBeatView.tsx`
(new renderer), `InterstitialRunner.tsx` (registered story-scene). Tests:
`sequence.test.ts`, `InterstitialRunner.test.tsx` (new), plus graph/loop/
interstitial updated.

### ✅ Verified in-browser this session (S79)
Via the dev server (localStorage-save + Resume, since Pixi deployment isn't
script-drivable): the **pre-battle scene** (River Ridge intro) → Formation; the
**standalone node** "The Crossing" → world map; the **new 6-node map** + active
edge highlight; **routing** (The Crossing → The Return) → next node's Formation +
autosave. Fixed one bug found here: a TDZ crash (`planEntry` read `nonce` before
its `useState` initialized) — `nonce` is now declared before `screen`.

### 🔎 NOT yet hand-verified end-to-end (Chris — a real playthrough)
The **battle → result-summary → post-battle aftermath scene** path. It's covered
by pure tests + the runner test, and the battle sub-flow itself is unchanged M1
machinery, but a full deploy→fight→win of **Stonebridge** (to see its
`[battle, story(aftermath)]` aftermath scene) wasn't walked (deployment placement
needs the canvas). Use the S78 debug menu (Force Win) to traverse fast. Also
worth eyeballing: the **terminal victory** result-summary at The Return.

### 🧭 Deferred by the seam-audit (NOT a bug — a scoped cut)
**Multi-battle-node machinery.** The *model* supports `[battle, story, battle]`
(battle is a peer beat; the driver already loops over battle beats), but the
*driver/save* don't persist mid-node: only node-entry (`in_progress`) and
`awaiting_route` are saved, so reloading mid-node would re-fight. M1.5 authors no
such node, so it's unexercised. When consecutive battles are actually authored,
add a beat-cursor + resolved-battle persistence (the "v3" the audit deferred).
Save schema stays **v2**; old v1 saves still fail loud.

### 🖼️ Portrait override seam laid (durable field + engine threading deferred)
Groundwork for **plot characters with a fixed portrait independent of their
current class** (units reclass freely). Added `PortraitRef` (`{kind:'class',...}`
| `{kind:'fixed', key}`) + `resolvePortraitUrl` in `src/assets/portraits/
index.ts` — the single override-aware entry point, layered over the pure
class-derived `portraitUrlFor`. Story-scene `DialogueLine.portrait` now takes a
`PortraitRef` (content points at a *portrait*, not a class). **Deferred to when
the first plot character + art land (M5):** the durable `CampaignUnit.portrait?`
override, threading it fold → `UnitPlacement` → engine `Unit` → renderer (the
`gender`-cosmetic precedent, S55), and populating the empty `FIXED_PORTRAITS`
registry. The 7 other `portraitUrlFor` call sites (renderer, roster/deploy
panels) stay class-derived until that durable field exists — then they migrate
to `resolvePortraitUrl(unit.portrait ?? {kind:'class', ...})`.

### Known simplifications (by design)
- **Loss retry** re-enters the battle beat in-session (state unchanged, no story
  replay); a *reload* replays the node from its first beat (node-granularity).
- **Reload mid-sequence** (e.g. during a post-battle scene, before the map)
  resumes at the world map — the trailing scene is skipped, not replayed.
- Everything from the S78 handoff that was **by-design** still holds: wounds
  don't carry (heal-to-full each boundary), the finale reuses River Ridge's enemy
  team, the map is a placeholder SVG.

### Still pending from S78 (dropped/carried explicitly)
- **Border-shorthand console warnings** (M1 `FormationScreen`/`DeploymentScreen`
  rows mixing CSS `border` shorthand + `borderColor`) — cosmetic, dev-only, NOT
  touched this session. Still worth a small cleanup someday.
- The S78 "persist last result to replay the summary on resume" nicety — still
  not done; even less relevant now (mid-sequence reload → map by design).

### Next TABA milestone
**M2 — progression** (XP/JP/level/JP-gated unlock). Extends `UnitBattleSummary`
once the battle *tracks* XP/JP — don't pre-build the empty fields (S78 note holds).
