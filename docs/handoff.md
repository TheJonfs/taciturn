# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When starting a session, read this file and process every item — act on it, promote it elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a reason. Items do not accumulate. If there are no notes to leave, replace the contents with `_No handoff this session._` so the next session knows the file has been processed.

---

## From Session 62 close (2026-06-10) — Templar arc: audit + foundation + Cure + Raise

S62 opened the Templar arc (hybrid White Mage + Dragoon for the Glabados Church;
spec: `docs/thirtyNinePlanning/templar-concept-notes.md`). It was audit-first, then
shipped **Steps 1–3** of the ratified build order. **1721 → 1746 tests (+25)**,
`tsc -b` + `vite build` clean. Three ADRs: **0099** (Raise), **0100** (Monkeygrip),
**0101** (on-heal hooks: Unified Calling + Emissary). **All four Templar innates are
now built** (Faithstrider, Monkeygrip, Emissary, Unified Calling).

### The substrate audit (T1–T9) — current verdicts

Headline finding still holds: **faith and Auto-Protect both already existed**, so the
arc is shorter than the brief budgeted. Updated status after this session's work:

| # | Mechanic | Verdict | Status |
|---|----------|---------|--------|
| T1 | Faith | ✅ EXISTS | `computeFaithFactor`; healing = MA×power×faith. Used by Cure/Raise. |
| T2 | Raise (spell revive) | 🟢 **DONE (S62, ADR-0099)** | `removeKO` ability effect + revive-before-heal + charged-resolve KO bypass. |
| T3 | Cure AoE | 🟢 **DONE (S62)** | Stub → charged AoE-cross heal, friendly-fire, vert-tol 1. Composed; no engine change. |
| T4 | Jump leap | 🔴 NET-NEW (headline) | Off-field leap; 3×Speed hook; D3 (full leap vs charged-strike v1) still open. |
| T5 | Lance pierce | 🟡 mixed | Line/multi-target/friendly-fire exist (Flame Lance); pierce on a *basic* attack is net-new. |
| T6 | Auto-Protect | ✅ EXISTS → SHIPPED | `protect` status + statusGrants. Defender ships it (S62). |
| T7 | Monkeygrip | 🟢 **DONE (S62, ADR-0100)** | Declarative `relaxesTwoHandedGrip` flag read by the equip validator. |
| T8 | Unified Calling (on-heal reaction) | 🟢 **DONE (S62, ADR-0101)** | New `onHealingReceived` hook; Emissary's `modifyOutgoingHealing` shipped same ADR. |
| T9 | Smaller pieces | ✅ COMPOSE | Faithstrider shipped (S62); class scaffold + gear permission pending (Step 5). |

### Ratified 5-step build order — progress

1. **Foundation** — ✅ Defender, Faithstrider, portraits. *(Pending: class scaffold + Knight gear permission — held until the class has a command set.)*
2. **Monkeygrip + Cure rework + Raise wire** — ✅ **COMPLETE** (Cure, Raise/ADR-0099, Monkeygrip/ADR-0100).
3. **On-heal reaction hook + Unified Calling + Emissary** — ✅ **COMPLETE** (ADR-0101).
4. **Jump leap (T4)** — the big one, gated by D3. **NEXT** (or T5 Lance pierce first — see below).
5. Class assembly (stat block, command set, four innates [all built], three weapons, gear permission) → polish/playtest.

### What shipped this session (commits to main — Chris is sole worker)

- `5343219` — Templar portraits committed (cleared the S60/S61 loose end).
- `e2cc34f` — **Faithstrider** (Movement passive, +1 Move/+10 Faith) + **Defender**
  (2nd Knight Sword, WP 11, Auto-Protect via `statusGrants:['protect']`, 50%).
- `b4b99b1` — **Cure rework**: hidden S13 stub → spec'd charged AoE heal (MA×8×faith,
  cross r1, friendly-fire, excludeCaster false, vert-tol 1, SP 40, MP 8). Pure
  composition. The real-catalog consumers were robust; **session-57 (AI) still passes**
  — the basic AI picks the now-charged AoE Cure to heal a dying ally, targeting it as a
  `unit`. No AI gap, no stale tests to retire.
- `991450c` — **Raise** + the `removeKO` ability-effect substrate (**ADR-0099**).
  Revive-before-heal in `resolveAbilityEffect`; the charged-resolve KO fizzle now exempts
  `removeKO` (a `removed` target still fizzles). Power 10, MP 12, SP 30, ≈37 HP. Authored
  hidden, NOT in a command set yet (see below).
- `c159426` — **Monkeygrip** + the `relaxesTwoHandedGrip` capability (**ADR-0100**). The
  equip validator now reads loadout passives and skips the two-handed-occupies-both-hands
  throw when a passive declares the flag. Declarative (not a hook): equip legality is a
  static setup-time property. Support, cost 2, available. Player-facing (got a guide entry).
- `3747a82` — **Step 3 on-heal hooks** (**ADR-0101**): two new closed-surface hooks.
  `onHealingReceived` (recipient-side, emits actions) → **Unified Calling** (Reaction, +PA
  MP on a one-time heal). `modifyOutgoingHealing` (healer-side multiplier) → **Emissary**
  (Support, +25% outgoing healing). Both apply to one-time-source heals (Cure/Raise +
  Potion/Phoenix Down), NOT Regen (structural exclusion — no firing in `system_heal`).
  Both `available`, player-facing (guide entries). All four Templar innates now built.

### NEXT — Step 4 (Jump leap, T4) and/or Step 5 leftover (Lance pierce, T5)

Two offensive-pillar pieces remain before class assembly (Step 5). Both are net-new:

1. **Jump leap (T4) — the headline unknown, with design call D3.** Charged-action infra is
   solid, but the off-field "leave the tile / land later for damage" leap has no precedent;
   `actionSpeed = 3 × Speed` needs a `modifyActionSpeed`-style formula (today actionSpeed is a
   fixed per-ability number). **D3 (Chris):** full off-field leap (unit leaves the board during
   the charge, lands for `PA × WP × (1 + isLance)` at H6/V6) vs. a simpler charged-strike v1
   (no off-field state; a big telegraphed charged hit). Flag early if the off-field state
   balloons. This is the one piece with real scope uncertainty — get D3 before building.
2. **Lance pierce (T5) — enables the Lance + Imp Halberd weapons.** Line shape + multi-target +
   friendly-fire all exist (Flame Lance), but the *basic attack* is single-target. Net-new:
   make a weapon's basic attack pierce a 2-tile line (hitting both units, friendly-firing an
   intervening ally). Once pierce exists, the **Lance (WP 10) + Imp Halberd (WP 8, MA +1)**
   weapons ship (they were held from Step 1 to avoid shipping pierce-less). More contained than
   Jump; no big design gate.

Recommendation: take **Lance pierce (T5) next** (contained, unblocks two weapons, no design
gate), then **Jump (T4)** with D3 ratified, then **class assembly (Step 5)** — at which point
all innates (built), Cure/Raise, Jump, and the three weapons exist, plus the stat block + Knight
head/body gear permission (`classRestrictions += templar`). Or jump straight to Jump if Chris
wants the headline resolved first.

**Class-assembly readiness:** the four innates are built; Cure + Raise exist (hidden, need the
Templar command set to surface them — wiring Raise into a command set will want the session-57
AI heal-choice re-checked, since the healer would then have both Cure and Raise). Defender ships
now; Lance/Imp Halberd need T5.

### Decisions banked from Chris (S62)

- Jump keeps its name; Cure reworked in place; Auto-Protect 50% (tunable later like
  Auto-Shell); Cure vert-tol 1; "Imp Halberd" name kept.

### Watch / notes for next session

- **Raise is not yet equippable.** It's hidden and in no surfaced command set. Wiring it
  into `white_magic` now would give the basic-AI healer both Cure and Raise and likely flip
  **session-57**'s "picks Cure" assertion (Raise heals more on a single target). It joins
  the **Templar command set at class assembly (Step 5)** — handle the S57 expectation then.
- **Emissary (+25% healing)** still un-audited for a `modifyHealing`-style hook — confirm
  the hook exists before wiring Emissary (Step 3). May be a small net-new.
- **Cure / Raise are not player-facing yet** (hidden command sets) — no guide-changelog
  entries until the Templar command set surfaces them. Defender + Faithstrider already got
  the S62 player-facing entry.
- Lance/Imp Halberd weapons wait for pierce (T5) so they don't ship half-built.

### Roadmap note

`docs/roadmap.md`'s per-session log was abandoned ~S20b; live planning is the
`thirtyNinePlanning/` briefs + this handoff. Templar falls under the existing
"Class/ability/equipment catalog expansion" content-pass — no roadmap edit made.

### Standing carries (from S61, unchanged — not Templar work)

- **Role-aware deployment sorting** — the 4th/last coverage-map consumer (ADR-0094),
  deferred behind the Templar arc. Substrate (`threatsToTile`/`buildCoverageMap`) in place.
- Barrier denial dials (ADR-0098); cost-loop redundancy (§3). Layer-2 positional
  prediction; Worldcraft move-then-cast; killValue-weighted Math re-base; Perch
  move-onto-created-perch; default team templates with Terraformer; roster-wide Move-tier
  discussion; Calculator team-template revision + AI personality variants; Marshmoor
  template-compliance tests; lightning-mage.ts stale S20 header;
  `draft-terraformer-substrate-audit.md` archival; terrain-transition animation; Math Skill
  SP scaling review.

### Browser/playtest — NOT done (and why)

All S62 work is content + engine substrate verified by unit/integration tests; nothing
render-observable to drive. Cure/Raise/Auto-Protect *feel* (the tank stress-test, the
multiplicative heal stack) are playtest questions for when the Templar is assembled and
playable.
