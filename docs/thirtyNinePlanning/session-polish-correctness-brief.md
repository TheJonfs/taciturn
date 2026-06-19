# Session Brief — Polish & Correctness batch (S71+, splittable)

*Closes the 15 new-player playtest findings. Written as **one brief in three
independently-shippable chunks**, ordered low→higher risk, so it can span one session or
several depending on context budget: complete a chunk, commit, checkpoint; if context runs
low, ship the finished chunks and carry the rest to a follow-up — each chunk stands alone.
Most of this is legibility (the fresh-eyes signal the project hasn't had). Fixes land in the
shared core, so both Mage War and the eventual campaign benefit. Source triage:
`s70-newplayer-playtest-findings.md`.*

## Inputs

- The findings doc (full per-item detail + my leans).
- `planner-content-reference.md` and the specific defs: Damage Split, Spiked Mail, Wand of
  Potential + the four wands' Resonance, the `tidal_pull` reaction, `flow_state`, `ignition`,
  Rasp Pendant, the Knight Battle Skill set, the Math Skill set, Templar Arts Jump.
- The Team Builder UI; the targeting-highlight renderer.

## Goal

Resolve all 15 findings: correct wrong/missing tooltips, add Team Builder legibility
affordances, recolor targeting, audit-and-correct several behaviors, fix two clear bugs, and
(decision-gated) settle Ignition.

## Splittability (read first)

Three chunks, each its own commit + checkpoint, ordered by value/risk:
1. **Legibility & polish** — lowest risk, highest new-player value, the bulk. Safe to ship
   alone if only one chunk fits.
2. **Behavior audits & fixes** — engine-behavior changes; carries the intent decisions.
3. **Ignition** — small but **decision-gated** (D1); do last, skip if D1 unsettled.

If context runs out mid-brief: finish the current chunk to a green state, commit, and leave a
handoff line naming the carried chunks. Do **not** leave a chunk half-applied.

## Chunk 1 — Legibility & polish  *(no engine-behavior change; checkpoint + commit after)*

Tooltips/copy:
- **#1 Damage Split** — change "reflects all damage" → reflects **half** (match the shipped
  value).
- **#10 Spiked Mail** — add its retaliation-damage effect to the tooltip.
- **#11 Wand of Potential** — add **+1 SP to lightning-tagged spells** (ADR-0115).
- **#4 Tidal Pull** — rewrite from the mechanic: the Water reaction grants **+20 CT to self
  on being hit** (your next turn comes sooner). Don't echo the old "pull" framing.
- **#8 Wand Resonances** — read the four wand defs; state each one's Resonance (which
  resistances shift, which direction) explicitly in its tooltip.

Team Builder:
- **#3 Empty slots show level** — display a slot's level before a unit is placed. (Confirm
  where slot-level originates in Mage War.)
- **#7 Chosen class's active skills** — surface the picked primary class's command set, not
  only the secondary Command Set tooltips.
- **#13 Gender on detail card** — add gender to the unit detail card (it gates Steal Heart;
  players can't plan charms blind).

UI:
- **#12 Targeting frame color** — recolor the Math Skill target highlight so it doesn't read
  as the Red Team outline; review other targeting highlights for the same clash. Keep legible
  in both color themes.

## Chunk 2 — Behavior audits & fixes  *(engine behavior; audit→report→fix; checkpoint + commit after)*

- **#2 Battle Skill ranges** — audit whether each Knight Battle Skill ability inherits the
  equipped weapon's range. **Fix: Bull Rush → melee-locked** (firm). For the rest: report the
  list; change others only per D4 (default: leave as-is unless one is obviously wrong, e.g.
  another melee/charge ability on bow range — flag those).
- **#14 Templar Jump locks Move** — using Templar Arts Jump spends the Move portion of the
  turn budget (Jump is a reposition; Jump-then-Move is a double-move). Integrate with the
  turn-budget model so Move is unavailable after a turn-start Jump.
- **#15 Math Skill Faith sweep** — audit which Math Skill abilities still faith-scale; make
  them faith-independent (Calculator identity). If any appears *intentionally* faith-scaled,
  flag rather than blanket-change.
- **#9 Rasp Pendant channels** — audit which damage channels fire the MP drain. Align to the
  agreed set (D3 default: direct attacks + ability damage yes; DoT ticks + `system_damage`
  reflect/fall/barrier no). Confirm guardrails intact (cap at target MP, skip KO'd).
- **#6 Worldcraft → Flow State** — audit whether Worldcraft actions are `magical`-tagged and
  thus refund CT via Flow State. **Behavior change gated on D2** (Chris's intent): if "should
  count," ensure the tag/trigger fires; if "should not," gate it; if unstated, report the
  current behavior and defer the change.

## Chunk 3 — Ignition  *(decision-gated on D1; do last; skip if unsettled)*

- **#5 Ignition** — first audit whether it's currently gated to fire-tagged damage or fires on
  any magical damage. Then per D1: **(lean) restore "any magical damage applies 1 Burn,"
  keep cost 2** — matching the documented mix-and-match intent — or per Chris's alternative
  (1 SP fire-only). If D1 is unsettled at handoff, report the audit finding and defer the
  change to a follow-up.

## Acceptance criteria

- **Chunk 1:** every edited tooltip matches the actual mechanic (Damage Split half; Spiked
  Mail damage; Wand of Potential +1 SP; Tidal Pull self-CT; each wand's Resonance named).
  Team Builder shows slot level on empties, the chosen class's actives, and gender on cards.
  Targeting frame is visually distinct from the Red outline in both themes. No behavior change;
  suite green.
- **Chunk 2:** Bull Rush is melee; Battle Skill audit reported. Turn-start Templar Jump
  disables Move. No Math Skill ability faith-scales (or exceptions flagged). Rasp Pendant
  fires only on the agreed channels, guardrails intact. Worldcraft/Flow State behaves per D2.
  ADR note for the behavior changes. Suite green.
- **Chunk 3:** Ignition behaves per D1; suite green; ADR/changelog note.
- Across all: `tsc -b` + `vite build` clean; each chunk independently green and committed.

## Out of scope

- Anything beyond these 15 findings.
- The deeper feel passes (Taunt redesign, Templar/Thief/equipment tuning) — separate threads.
- Any campaign work.

## Files (hedged — audit confirms)

Content tooltip/ability/equipment/status defs (Damage Split, Spiked Mail, wands, tidal_pull,
flow_state, ignition, Rasp Pendant, Battle Skill, Math Skill, Templar Jump); Team Builder UI;
targeting renderer; turn-budget/Move-gating for Jump; ADR(s); Vitest specs.

## Decision points (for plan-review)

- **D1 — Ignition** scope/cost. *Lean: restore any-magical at 2 SP* (the fire-gating is likely
  the bug, not the cost). Alt: 1 SP fire-only. Gates chunk 3.
- **D2 — Worldcraft → Flow State** intent: should terrain-shaping count as magical for the CT
  refund? (Tag add vs gate vs leave.)
- **D3 — Rasp Pendant channels.** Default: attacks + abilities yes; DoT + `system_damage` no.
- **D4 — Battle Skill non-Bull-Rush ranges.** Default: fix only Bull Rush; report the rest;
  change others only on a flagged surprise.

## Workflow notes

Order is value/risk: chunk 1 first (if only one fits, it's the right one). Chunk 2 carries the
intents — settle D1–D4 at plan-review where possible so the implementer mostly proceeds; the
two genuinely audit-dependent ones (D2 Worldcraft tag, D4 Battle Skill list) report-then-fix
against the stated defaults, routing back only on a surprise. Throttle order if cutting:
chunk 3 first, then chunk 2's #6 (intent-gated). Keep tooltip rewrites tied to the *actual*
mechanic — several of these bugs are stale text describing old behavior.

## Watch-fors

- Tooltip rewrites that restate the buggy old text instead of the real mechanic.
- The Math Faith sweep blanket-changing an intentionally-faith-scaled ability (flag, don't
  assume).
- Rasp/Worldcraft are real behavior changes — regression-test; don't let the channel audit
  miss `system_damage` paths.
- Targeting recolor clashing with another existing highlight or failing in one color theme.
- Templar Jump's Move-lock must compose with the existing turn-budget model, not special-case
  around it.

## Estimated size

Medium-large as a whole, deliberately splittable. Chunk 1 is a comfortable standalone session
(many small low-risk items). Chunk 2 is the meatier audit-and-fix. Chunk 3 is small and gated.
One ambitious session could land 1+2; three chunks could span two sessions.
