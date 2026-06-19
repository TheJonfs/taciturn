## ADR-0119: Templar Jump forfeits the Move budget; Math Skill Faith sweep (Exact Rhythm)

**Status:** Accepted
**Date:** 2026-06-19

## Context

Two behaviour findings from the post-S70 new-player playtest (chunk 2 of the
S71 polish-correctness batch; source triage
`docs/thirtyNinePlanning/s70-newplayer-playtest-findings.md`):

- **#14 Templar Jump + Move.** A unit could commit Templar Arts' Jump (a charged
  off-field leap) and then still take a normal Move in the same turn — the charged
  cast consumed only the Act budget, leaving `movesAvailable` intact. Jump is the
  turn's mobility play; pairing it with a ground Move reads as a double-move.

- **#15 Math Skill Faith.** The Calculator's identity is *faith-independent
  output* — the ~2× magnitude that justifies its lower MA. S63 dropped Faith from
  the magnitudes of Precision Fire (damage) and Targeted Treatment (heal) via
  `noFaithScaling`. **Exact Rhythm** (the multi-target CT push) was the leftover:
  it still read `SP × MA × Faith Factor` through `faithScalesMagnitude: true`, a
  blueprint-era shape the S63 sweep never reached.

This ADR also records the *audit-only* outcomes for the other chunk-2 findings,
which needed no code change.

## Decision

**1. `spendsMoveBudget` ability flag (#14).** `ActiveAbilityDefinition` gains
`spendsMoveBudget?: boolean`. When a flagged ability commits on the active turn
(non-reaction, non-rider), `reduceUseAbility` zeroes `turnState.budget.movesAvailable`
right where it decrements `actsAvailable` — so `validateAction` (and the
already-budget-gated action menu) block a subsequent Move. Templar's Jump sets it.

This composes with the existing turn-budget model rather than special-casing Jump
by id: any future "this action is the turn's reposition" ability opts in with the
same flag. It applies at *commit* (Jump is charged; the lock must land when the
unit leaps, not when the charge resolves), and to the active unit only — reactions
and equipment-proc riders have no turn budget to spend.

`movesConsumed` is **not** bumped. That counter drives the turn-end CT cost
(Move+Act vs Act-only), and the implemented Jump lands back on its own takeoff
tile (no relocation, per ADR-0103) — so the unit did not physically move. The lock
forfeits a *second* mobility action without making the Jump turn cost more CT.
Bumping it (Jump priced as a Move+Act turn) is a separate balance lever if wanted.

*Noted divergence (flagged, not silently resolved):* the finding frames Jump as
"a reposition," but the shipped Jump returns to its takeoff tile, so it is not a
net relocation. The Move-lock is justified on action-economy grounds (a powerful
H6/V6 charged leap-attack shouldn't also grant a free Move), not on "it moved
you." If Jump is later made to land on the *target* tile (FFT-canonical), the lock
already fits.

**2. Exact Rhythm drops Faith from its magnitude (#15).** Removed
`faithScalesMagnitude: true` from Exact Rhythm's `CtEffectSpec`. The per-target CT
push is now `factor × MA` (SP applied via the Mathematician bonus), matching
Precision Fire / Targeted Treatment's faith-independent output. At default Faith
this is a ~2× magnitude lift — the same direction and rationale as the S63 buff to
the other two. The CT-push *application* stays deterministic (no chance roll); only
the Faith term left the magnitude.

## Audit-only outcomes (no code change this session)

The remaining chunk-2 / chunk-3 findings audited as *already correct*; the only
fix any of them needed was tooltip copy (shipped in chunk 1):

- **#2 Battle Skill ranges.** All three current Knight Battle Skill members —
  Power Attack, Lightning Stab, Bull Rush — hardcode `rangeMode: 'melee'`,
  `horizontal: 1`. None inherit weapon range; **Bull Rush is already melee-locked**.
  (Stasis Sword / Taunt are catalog-only cross-class options, not in the set.)
- **#9 Rasp Pendant channels.** The MP drain fires on the `onFinalDamage` hook,
  which runs **inside the damage pipeline** — direct attacks + ability damage
  (incl. AoE per-target) only. DoT ticks, reflect, falling, and barrier all go
  through `system_damage`, which bypasses the pipeline, so they don't drain. This
  already matches the agreed channel set; guardrails (absorbed-skip, `>0`,
  KO'd-skip) intact.
- **#6 Worldcraft → Flow State.** Worldcraft abilities are `['worldcraft']`-tagged,
  not `['magical']`; Flow State refunds CT only on `'magical'` — so terraforming
  does **not** trigger the refund. Per Chris's call (D2), left as-is: tagging
  Worldcraft `'magical'` would also make it Silence-blockable and Ignition-
  triggering, which is not wanted.
- **#5 Ignition (chunk 3).** Already fires on **any** magical damage (not just
  fire) at cost 2 — matching the documented mix-and-match intent. The `['fire']`
  tag is only Ignition's own source-ability tag (for the Wand of Lumen
  interaction), not a trigger gate. The only defect was the tooltip ("fire-tagged
  casts"), corrected in chunk 1. No behaviour change; chunk 3 closes with no code.

The Math Skill *status-application* Faith × MA gates (Precision Fire's Burn,
Sculpted Enhancement, Engineered Defenses) were initially **left intact** and
flagged for Chris — they use the engine-wide status-application formula, govern
*whether a status lands* (not output magnitude), and Precision Fire's was
explicitly retained in S63. **See the Update below: Chris reviewed and chose to
drop Faith from these too.**

## Update (same session): Faith dropped from Math Skill status applications

Chris reviewed the numbers and elected **Option B** — make the three Math Skill
status applications Faith-independent (MA-only factor) *and* retune their base
chances so the effective landing rates stay near today's, rather than letting the
MA factor push them to near-100%.

Why retune: the status-chance formula is
`base × Faith_factor × MA_factor × resistance × hooks`, and `MA_factor = 0.9 +
MA/10` is **≥ 1.8 for any MA ≥ 9** — it amplifies, never gates below 1.0. Faith
(×0.49 at the default 70/70) was the only term holding these below 100%. Dropping
Faith without retuning would jump them from ~44–71% to ~90–100% (and to a hard
100% with any MA buff). The bases were lowered to land near the prior effective
rates at base MA 9, still MA-scaled:

| Ability | base (was → now) | factors | ≈ chance at MA 9 |
|---|---|---|---|
| Precision Fire → Burn | 50 → **25** | `{ ma: true }` | ~45% |
| Sculpted Enhancement → PA/MA Up (linked) | 50 → **25** | `{ ma: true }` | ~45% |
| Engineered Defenses | 80 → **40** | `{ ma: true }` | ~72% |

This makes status application consistent with how S63/S71 treated *output
magnitude* (MA scales, Faith does not). The Sculpted Enhancement PA Up + MA Up
specs must carry identical `baseChance` + `factors` for `linkRoll` to keep them
coupled (same roll *and* same computed chance → both land or both miss).

The 25/25/40 set is a best-effort match, not a playtested value — logged as a
**tuning watch item** in `docs/playtest-watch.md` (the MA factor still pushes a
high-MA Calculator toward 100%, the lever if it reads too reliable). The
"blanket-remove rejected" alternative below is therefore superseded *for the
faith term*; the retune is what keeps it from being a blanket buff.

## Consequences

- Jump is now a full-mobility commitment: leap-attack, no follow-up Move.
- Exact Rhythm pushes CT ~2× harder at default Faith (consistent with the rest of
  the Math Skill kit); the Calculator's CT-lockout pressure rises accordingly — a
  tuning watch item, on the same lever (SP / cooldown) the ability's notes already
  name.
- A reusable `spendsMoveBudget` flag exists for future reposition-style actions.

## Alternatives considered

- **Bump `movesConsumed` for Jump (Move+Act CT cost).** Rejected as an
  unrequested balance change; the finding asks only that Move be *unavailable*
  after Jump. Reservable later.
- **Blanket-remove Faith from all Math Skill abilities, including status gates.**
  Rejected — the application-chance gate is the universal formula, not the
  output-magnitude identity, and was deliberately retained in S63 (flag, don't
  assume — per the brief's watch-for).
