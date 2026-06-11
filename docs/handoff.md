# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When starting a session, read this file and process every item — act on it, promote it elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a reason. Items do not accumulate. If there are no notes to leave, replace the contents with `_No handoff this session._` so the next session knows the file has been processed.

---

## From Session 62 close (2026-06-10) — Templar arc: substrate audit + foundation

S62 was the **audit-first opener** of the Templar class arc (a hybrid White
Mage + Dragoon for the Glabados Church). Spec lives in
`docs/thirtyNinePlanning/templar-concept-notes.md`. The audit (the primary
deliverable) is below; two whole foundation pieces shipped. **1721 → 1729 tests
(+8)**, `tsc -b` + `vite build` clean. No ADR this session (no engine/design
decisions landed — foundation composed on existing substrate).

### The substrate audit (T1–T9) — exists / compose / net-new

**Headline: the arc is shorter than the brief feared.** The two biggest feared
costs — **faith** and **Auto-Protect** — both already exist. The two genuinely
large net-new items are **Jump's off-field leap** and the **on-heal reaction
hook**.

| # | Mechanic | Verdict | Notes / key file |
|---|----------|---------|------------------|
| T1 | **Faith** | ✅ EXISTS (0) | `computeFaithFactor` (`src/engine/damage/handlers.ts:60`), symmetric caster×target. Healing already runs `MA × power × faithFactor` (`:216`). Cure/Raise/Emissary/Faithstrider compose directly. **D1 dissolved.** |
| T2 | **Raise (spell revive)** | 🟡 COMPOSE + small wire | Revive logic exists but only as a **consumable** effect (`removeKO`, `reducers.ts:3410`). `AbilityEffects` has **no revive field** — needs a small new ability-side revive effect reusing that reducer path. |
| T3 | **Cure AoE** | 🟡 COMPOSE (entangled) | `src/content/abilities/cure.ts` is a **hidden placeholder** (single-target arc, SP 0, MP 4, coeff 5). Spec: AoE 1-cross, friendly-fire, vert-tol **1**, SP 40, MP 8. Cross shape, friendly-fire, and Pyromancer's **Aether Bloom** expander all exist. **Caution:** `cure` is a fixture in ~10 integration tests + the `white-magic` command set — reworking it ripples. Chris greenlit reworking in place + retiring stale placeholder tests. |
| T4 | **Jump leap** | 🔴 **NET-NEW (headline)** | Charged-action infra is solid; the **off-field "leave tile / land later" leap is net-new** — no precedent. 3×Speed needs a `modifyActionSpeed` formula hook. **D3 (full leap vs. charged-strike v1) is the live relief valve.** |
| T5 | **Lance pierce** | 🟡 mixed | Line shape + multi-target + friendly-fire all exist (**Flame Lance**). The net-new bit: the **basic Attack is single-target** — making a *weapon's* basic attack pierce a 2-tile line. |
| T6 | **Auto-Protect** | ✅ **mostly EXISTS** → SHIPPED | `src/content/statuses/protect.ts` is a complete permanent physical-resistance status (`permanent_per_unit_ct`, +50%). Equipment `statusGrants` pattern exists. **Defender shipped this session using it.** Brief called this the 2nd-largest item; it was nearly free. |
| T7 | **Monkeygrip** | 🔴 NET-NEW (low, ~150 ln) | Two-handed enforced at setup (`create-initial-state.ts:324`). Needs a hook to relax "two-hander occupies both hands." Self-contained. |
| T8 | **Unified Calling (on-heal reaction)** | 🔴 **NET-NEW hook** | No `onHealingReceived` hook. Hook surface is closed (ground rule 8) → genuine engine change **+ ADR required**. The one real discipline item. |
| T9 | **Smaller pieces** | ✅ COMPOSE (low) | Class scaffold (Knight template), gear-gating (`classRestrictions`), movement+stat-mod (**Bravestrider** = exact Faithstrider template), weapon-type = a `tags:['lance']` string. **Faithstrider shipped this session.** |

### Ratified build order (Chris, plan-review) — 5 steps, session splits by context

1. **Foundation** (this session + remainder): Lance + Imp Halberd weapons; Defender ✅; Faithstrider ✅; class scaffold + Knight head/body gear permission.
2. Monkeygrip (T7) + Cure rework (T3) + Raise ability-revive wire (T2).
3. On-heal reaction hook (T8) + ADR; Unified Calling + Emissary.
4. **Jump leap (T4)** — the big one, gated by D3.
5. Class assembly (stat block, command set, four innates, three weapons) → polish/playtest.

Chris: "we'll see how context unfolds over each step to decide multi- vs.
single-session."

### What shipped this session (commits to main — Chris is sole worker)

- **`5343219`** — committed the long-carried `templar-male/female.png` portraits
  (the S60/S61 commit-or-remove loose end; **cleared**).
- **`e2cc34f`** — Faithstrider + Defender:
  - **Faithstrider** (`src/content/abilities/faithstrider.ts`) — Templar Movement
    passive, +1 moveRange / +10 faith. Bravestrider-shaped, cost 2.
  - **Defender** (`src/content/items/defender.ts`) — 2nd Knight Sword, WP 11,
    two-handed, Brave variance; grants Auto-Protect via `statusGrants:['protect']`
    (50% physical, the status default). Universal weapon.
  - Tests: `src/content/session-62-templar-foundation.test.ts` (+8). Loader
    content-count guard bumped (abilities 88→89, items 67→68).
  - Guide-changelog: real S62 entry (both pieces are player-equippable now).

### Decisions banked from Chris this session (for content as it lands)

- **Jump** keeps its name (despite the existing Hunter "High Jump" *stat* passive
  and the Jump *stat* — FFT parlance parses it).
- **Cure**: rework the existing stub in place; obviate stale placeholder tests.
- **Auto-Protect**: start at **50%** (Protect default); tunable down later via a
  magnitude-carrying `statusGrants` variant (like the Auto-Shell reservation).
- **Cure vertical tolerance**: **1**.
- **Imp Halberd**: keep the name (not "Imperial").

### Next session — start Step 1 remainder / Step 2

Cleanest next item: **finish Step 1** — Lance + Imp Halberd weapons (need pierce,
T5, so they land *with* Step 2's pierce work rather than half-built), then the
**class scaffold** (stat block HP 132 / MP 36 / PA 6 / MA 6 / Speed 8 / Move 2 /
Jump 3, evade 10/6/2; Knight head/body + universal gear; innates wired as they
exist — Faithstrider + Emissary first). Gear permission (`classRestrictions +=
templar`) needs the class registered, so it rides with the scaffold. **Note:**
Emissary (+25% healing) wasn't audited for a `modifyHealing`-style hook — confirm
that hook exists before wiring Emissary (may be a small net-new, like Conductor's
`modifyStatQuery` shape but on healing output).

### Open content values still to pin (not blocking)

- Lance / Imp Halberd exact WP confirmed in spec (10 / 8); confirm reach encoding
  H2/V4 maps to weapon `range: { max: 2, vertical: 4 }` at author time.
- HP 132 vs. Knight sanity-check — a playtest question once the class is playable.
- Confirm Unified Calling (reaction) + Emissary (support) costs/innate-free on
  Templar (concept-notes "Open decisions").

### Roadmap note

`docs/roadmap.md`'s per-session log was abandoned around S20b; live planning is
the `thirtyNinePlanning/` briefs + this handoff. The Templar arc falls under the
existing "Class/ability/equipment catalog expansion" content-pass note — **no
roadmap edit made** (nothing to record in the stale log).

### Standing carries (from S61, unchanged — not Templar work)

- **Role-aware deployment sorting** — the 4th/last coverage-map consumer
  (ADR-0094); deferred when the arc pivoted to content. Substrate
  (`threatsToTile` / `buildCoverageMap`) all in place. Clean someday-item.
- Barrier denial dials (multi-ally, speculative/zoning walls, richer enumeration
  — ADR-0098); cost-loop redundancy note (ADR-0098 §3).
- Layer-2 positional prediction; Worldcraft move-then-cast planning; full
  killValue-weighted Math re-base; Perch "move onto a created perch"; default
  team templates with Terraformer; roster-wide Move-tier discussion; Calculator
  team-template revision + AI personality variants; Marshmoor template-compliance
  tests; lightning-mage.ts stale S20 header; `draft-terraformer-substrate-audit.md`
  archival; terrain-transition animation; Math Skill SP scaling review.

### Playtest / browser verification — NOT done (and why)

Foundation is pure content (definitions + statusGrants wiring), verified by unit
tests; nothing AI- or render-observable to drive. Auto-Protect's *feel* (the
tank stress-test) is a playtest question for when the Templar is assembled and
playable — not now.
