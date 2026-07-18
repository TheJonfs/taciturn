# Brief — Earning-coverage audit + Ch1 shop/map polish

*Status: plaintext review by Chris before it ships to CC. Front-loads a systematic audit + a few UI items,
then the session stays open for continued Ch1 playtest/debug (the current session's context is full). The
audit is the centerpiece; WI2–4 are contained.*

---

## Context — the whack-a-mole, and the systematic fix

Ch1 playtest surfaced a run of **earning bugs**, found one per session: rider procs double-earning, Compound
not earning, zero-damage displacement not earning, Math Skill's CT pushes invisible to the effect diff. None
is a new ability — each is an *existing* ability whose **effect shape the earning predicate never handled**,
failing **silently** (no award, no error).

That's the same architecture as the AI scorer: a generic dispatcher over effect shapes where an
unrecognized shape fails silently. The AI got a systematic sweep (S89) that found all five of its gaps in
*one pass* and left a **coverage table** so gaps are visible. Earning has no such table — hence the
one-per-session discovery. **`formatItemDetail` is the third instance** of the pattern (Moon Robe's `SP +0`,
the 15 rider arms in S86): same dispatcher, same silent failure.

**Three registries dispatch on effect shape and fail silently: AI scoring, XP/JP earning, item display.**
One got audited; two didn't. This brief audits the second and (cheaply, same axis) the third.

## Goal

Replace whack-a-mole with a coverage pass. Sweep every effect discriminant, confirm each **earns** correctly
(and, same axis, **displays** correctly), fix the gaps, and leave a durable **coverage table** so future
gaps are visible-by-default rather than found by speedrun. Then the session is available for Ch1
playtest/debug.

---

## WI1 — Earning-coverage audit (centerpiece)

Model it directly on the S89 AI audit.

**Enumerate the effect discriminants** (the same axis the AI scorer dispatches on — `ai-substrate.md`'s
coverage table is the spine: damage, statusEffects, heal, cleanse, removeKO, worldcraft, ctEffects, mpDrain,
selfMove, displacement, and the riders). For **each**, confirm an ability using it:
- **earns XP** correctly (fires once, not zero, not double — the rider double-earn was a *double*; Compound/
  displacement/Math-CT were *zeros*);
- **earns JP** correctly (the JP predicate agrees with the XP one).

**Produce the coverage table.** Ideally **merge it with the AI coverage table** into one table with columns
*AI-scores? / earns-XP? / earns-JP? / displays?* — so the three-registry parallel is visible in one place
and a future discriminant can't be silently missed by any of them. At minimum, an earning column added to
the existing table.

**Display ride-along (same axis, cheap).** While sweeping, check each shape's `formatItemDetail`/UI display
(the third registry). If display gaps are few, fix them; if many, at least record them in the table (the
*visibility* is the win) and fix as a follow-up. Don't let display scope-creep block the earning fixes.

**Fix the earning gaps** the sweep finds. The four known ones are already fixed (ADR-0152); this is about
the *rest* — the shapes nobody has speedrun into yet (Chris spot-checked Engineered Defenses + Sculpted
Enhancement and both earn, but that's 2 of N).

**Deliverable:** the coverage table as a durable reference (extend `ai-substrate.md`'s table, or a sibling
`earning-coverage` doc cross-linked to it) + the gap fixes. This is what stops the whack-a-mole.

*Latent context (ADR-0152): the joint planner still fail-hard-nulls if its best plan fails validation for a
reason other than locks — unreachable now, but a robustness gap. Out of scope here; noted so the audit
doesn't re-derive it as new.*

## WI2 — Stock-refresh notification (required companion to refresh waves)

Per the revised economy §5: under per-hub stock, a refresh lands in a hub you may have left long ago, and
nothing signals it — so an expanded shop is **undiscoverable by default** (return travel is free; only the
notification is missing). Ch1 has two refresh triggers (Old Ordal → Alvera Staff+Tome; Mount Eska → Alvera
Arcane Robe), so this is live content, not hypothetical.

**Build:** a **new-stock badge on the hub node** on the Road Ahead (persists until you visit that hub —
localizes *which* town restocked, which a transient banner can't). **Plus** a cheap scene line at the
trigger node's post-battle scene ("word from Alvera — the arcanists have restocked") as narrative
reinforcement. Lean is badge-primary (points you to the place); the scene line is one authored line.

## WI3 — Road Ahead footprint expansion

The campaign map (Road Ahead) currently uses only part of the screen and can afford more. Chris's read is
its footprint is **not** tied to the battle map's — confirm that in the audit, then let `WorldMapBeatView`
render larger (more screen real estate). The viewBox is already bounds-derived from the full layout (S94),
so this is a container/render-size change, not a viewBox change; progressive reveal and the no-frame-jump
behavior should be unaffected. (Related, not in scope: this makes future room for a map illustration
backdrop, which Chris may add later as one Atlas re-placement pass.)

## WI4 — Cosmetic nits (small, fit the shop/guest surface)

- **Guest turn placard:** a guest's turn shows "Opponent's turn" in the action-menu placard (S93 leftover).
  A guest is player-side — the placard should read accordingly (or suppress the command placard on an
  AI-driven friendly turn, as it does for enemies). Fix while the guest surface is in hand.
- **Shop subtitle:** now that stock is per-hub, the `ShopScreen` subtitle can name the hub ("Alvera
  Village") — cosmetic copy, reinforces town identity.

---

## Acceptance criteria

- **WI1:** a coverage table exists mapping every effect discriminant to AI-scores / earns-XP / earns-JP
  (/displays), each verified; earning gaps fixed with tests pinning them; the table is a durable doc.
- **WI2:** clearing Old Ordal / Mount Eska shows a new-stock badge on Alvera until visited; a scene line
  fires at the trigger; buying the refreshed item works.
- **WI3:** the Road Ahead renders larger, decoupled from the battle-map footprint; reveal + no-frame-jump
  intact.
- **WI4:** guest turn placard reads correctly; shop subtitle names the hub.
- Suite green, `tsc -b` clean, Atlas round-trip intact.
- **Then:** session available for Ch1 playtest/debug (expect a Chris feedback batch).

## Out of scope

- **Cost tuning** (`D-econ-6`) — separate pass, needs the party-avg-per-node series from playtest.
- The joint-planner fail-hard-null robustness gap (unreachable; noted).
- Real maps / enemy lineups / dialogue (M4/M5).
- A map illustration backdrop (future; WI3 just makes room).

## Workflow notes

- **WI1 first** — it's the systematic win and the reason for the session; the coverage table it produces is
  durable value beyond the immediate fixes.
- File paths herein are inferences — audit to confirm (the earning predicate's location, the badge's
  render site).
- Mid-session design questions route through Chris to the planner.

## Watch-fors

- **Double vs zero earning** — the two failure directions differ (rider procs *double*-earned; the others
  *zero*-earned); the sweep must check both, not just "does it earn at all."
- **STACK_INDEPENDENT appliers** (Engineered Defenses, Sculpted Enhancement, per Chris) — a repeat cast adds
  a stack and *should* earn again; the audit must not "fix" these into once-only.
- **Display scope** — if the `formatItemDetail` sweep balloons, record-and-defer rather than blocking the
  earning fixes; the table's visibility is the deliverable, the display *fixes* can follow.
- **Map footprint coupling** — confirm Chris's read (not tied to battle map) before resizing; if it *is*
  coupled, flag rather than force it.

## Estimated size

WI1 is the real work (a full discriminant sweep + gap fixes + the table); WI2–4 are contained (a badge + a
scene line, a render-size change, two cosmetic tweaks). Should leave session headroom for playtest/debug,
which is the intent. If the earning sweep uncovers many gaps, WI1 alone could fill the session — fine; the
table + fixes are the priority, and the UI items can trail.
