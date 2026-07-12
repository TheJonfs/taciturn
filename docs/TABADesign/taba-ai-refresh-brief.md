# Brief — AI competency refresh (pre-M4)

*Status: plaintext review by Chris before it ships to CC. Dispositions D-ai-1/2/3 settled (below). This
brief is **audit-first by necessity** — there's no AI-substrate reference doc, so Work Item 1 establishes
the grounding and **scopes the rest of the session**. Expect audit-overturns-spec to bite harder than
usual here; WI2–4 are goal-level until the audit maps the machinery.*

---

## Context

M3's machinery is done. Next is M4/M5 — authoring ~30 story battles and fueling a theoretically infinite
skirmish grind. Before that, the AI gets a competency refresh so it's ready to play everything the roster
can do. The Enchanter got an AI pass when it shipped (Mage War); the Monk almost certainly did not; the
rest of the roster's AI state is unaudited. Meanwhile the roster has grown a lot of *positional tactical
levers* (high ground, terrain manipulation, fall-damage throws, zone abilities) that authored encounters
will lean on.

**The bar (Chris's words, made into an engineering target):** the AI must (1) **not fall on its face on
any class** — play each class's kit sensibly — and (2) **pose a challenge through legible levers, not just
inflated stats.** It explicitly does **not** need to be a savant (the campaign's asymmetric win condition —
player must win every fight, AI need only win once — means the AI bats slightly above the player but never
needs mastery).

**Why "legible" is the real target — the challenge has two levers that trade off.** Difficulty can come
from the node **offset** (stats — economy-owned) or from **AI lever-use** (terrain, height, positioning —
AI-owned). Today the AI leans on the offset because its lever-use is thin, which *is* the "inflated stats"
failure. Strengthening AI lever-use lets us dial the offset **down** and still get real challenge — the
kind the player can see coming and learn from. So the refresh's goal isn't "make the AI hard," it's "make
the AI hard *legibly*, so difficulty stops depending on inflated numbers." That reframing is the priority
rule for the whole session: **a visible lever beats hidden cleverness every time.**

**Two consumers.** The AI plays both authored story battles (specific levers placed on purpose — the
lever-use items matter most) and generated skirmishes (generic parties, eventually geared — the
per-class-floor and gear-floor items matter most). The floor work serves both.

## Settled dispositions

- **D-ai-1 — Gear valuation: floor only.** Value stat gear + common effect patterns so a geared enemy plays
  sensibly. **Not** exotic-effect optimization (Del's Stave dump timing, Moon Robe synergy, etc. — ceiling).
- **D-ai-2 — Per-class scope: sweep all, audit prunes.** Audit the whole roster; fix the classes that are
  actually thin/broken.
- **D-ai-3 — Ordering: gear-floor this session, generator consumes it in M4.** The M4 generator's
  equipment/ability-assignment upgrade depends on the AI being able to value gear — so the AI floor lands
  first. The generator upgrade itself is M4, out of scope here.

## Goal

Bring the AI to the competency floor across the roster and teach it the placed levers authored encounters
rely on, so M4/M5 can author challenging-yet-legible battles without depending on inflated offsets — and so
the M4 generator can assign gear the AI will actually use. Floor, not ceiling; competent, not optimal.

---

## Work Item 1 — Audit (the gate: scopes everything after it)

**This is the first and possibly only guaranteed deliverable.** Establish the grounding, then make a scope
call.

Produce:

1. **Architecture summary.** How does the AI decide today? (Scoring/utility model? Policy dispatch? Behavior
   tree?) How is *per-class* behavior expressed — data-driven parameters, coded policies, or a generic
   fallback everyone shares? Enough detail that WI2–4 know *where* fixes compose.
2. **Per-class competency matrix.** For every roster class: **competent / thin / broken**, with a one-line
   failure-mode note where not competent. Known priors: Enchanter = passed (verify it held); Monk =
   suspected-none (verify). Everything else is unknown — this matrix is the real map.
3. **Lever inventory.** Which placed levers the AI currently uses vs ignores: Hunter high-ground seeking,
   Worldcraft/terrain use (Terraformer), fall-damage throws (Monk Bear's Heave; any Valley-style multi-fall
   the AI already does — the handoff noted it *does* Valley-group for fall damage, so confirm the baseline),
   deployment role-aware placement.
4. **Gear-valuation state.** Does the AI value equipment at all today, or ignore it? (The skirmish stub is
   gearless *because* of the standing deferral — confirm whether that's "AI ignores gear" or "AI mis-values
   it.")

Then, **the scope call (routes the session):**

> Based on the matrix + lever inventory, can WI2–4 be completed **this session**, or is this an **arc**? If
> arc-sized, **stop after the audit and write back** a proposed decomposition (which classes/levers/beats,
> in what order, over how many sessions) for the planner to sequence — do **not** grind through a
> multi-session arc unilaterally. If it's a single-session's worth, proceed through WI2–4. In-between (some
> now, some back) is fine and expected — say which is which.

This branch is deliberate: AI work is open-ended, and mid-scope planning routes through the planner, not the
implementer solo.

---

## Work Item 2 — Per-class competency floor *(scope per WI1)*

For each class the matrix flags **thin/broken**, bring it to the floor: uses its signature kit sensibly,
doesn't waste turns, doesn't ignore its own class identity, doesn't self-sabotage. **Floor, not ceiling** —
"a competent human wouldn't wince watching it," not "plays optimally." Monk is the known anchor (verify +
likely build; its Bear's Heave fall-throw overlaps WI3).

Resist gold-plating: an AI that's *too* good on every class makes infinite grinding miserable and isn't
needed (asymmetric win condition). Competent-and-legible is the ceiling of this work, by design.

## Work Item 3 — Placed-lever use (the legible-challenge floor) *(scope per WI1)*

Teach the levers authored encounters will lean on — these are what let the offset come down:

- **Hunter high-ground seeking** — bows gain range/damage from elevation; the AI should value perching.
- **Worldcraft floor (Terraformer)** — use terrain manipulation *purposefully at all* (raise/lower, create
  advantage). Floor = "doesn't play it uselessly"; chaining terrain into fall combos is ceiling, deferred.
- **Fall-damage throws (Monk Bear's Heave)** — throw a unit off a ledge for unmitigated fall damage; the
  single-target melee analog of the Valley grouping the AI reportedly already does.
- **Deployment role-aware sorting** — place front-line units forward, fragile casters back. Bad deployment
  is the AI beating itself before turn 1; this is high-leverage and probably cheap.

## Work Item 4 — Gear-valuation floor *(scope per WI1)*

The AI values **stat gear + common effect patterns** enough that a geared enemy plays sensibly — equips
appropriately if it ever chooses gear, and factors worn gear into its move scoring (a unit with a reflect
shield, a resist body, a lifesteal weapon shouldn't play as if naked). **Explicitly not** exotic-effect
optimization. This is the enabler for the M4 generator's gear-assignment upgrade (D-ai-3).

---

## Acceptance criteria

- **WI1 audit delivered**: architecture summary, per-class matrix, lever inventory, gear state, and an
  explicit scope call (finish / arc-write-back / in-between).
- **For each class brought to floor (WI2)**: a **scenario test** — set up a state where the sensible play is
  clear, run the AI, assert it doesn't fumble (makes a *reasonable*, not necessarily optimal, choice). Plus
  Chris's playtest eyeball as the real judge (playtest-overrides-analysis applies to AI behavior too).
- **Levers demonstrably used (WI3)**: scenario tests — Hunter seeks high ground when it's reachable and
  advantageous; the AI throws a unit off a ledge when lethal/valuable; Terraformer uses terrain rather than
  no-oping; deployment sorts sensibly by role.
- **Geared enemy plays sensibly (WI4)**: a scenario with a geared enemy where the AI's play visibly accounts
  for the gear.
- **No gold-plating regression**: skirmish play stays *beatable and not exhausting* — the floor is
  competent, not oppressive.
- Suite green, `tsc -b` clean; AI stays a pure Engine-reader (no Renderer/UI dependency).

## Out of scope (ceiling — deferred to the bonus-boss horizon)

- Calculator personality variants; clever target-priority optimization; combo-chaining (stance→throw→counter,
  multi-unit Valley setups beyond the existing baseline); exotic-effect gear optimization; bonus-boss-caliber
  play.
- **The M4 generator's equipment/ability-assignment upgrade** (consumes WI4; M4 work).
- Anything requiring engine changes to the AI's *inputs* (if the AI can't see something it needs — e.g. a
  terrain query — flag it, don't build it here).

## Files (audit establishes the real map — over-specified)

- `src/ai/` — the layer; WI1 maps its internal structure and per-class expression.
- `src/content/classes/`, `src/content/abilities/` — the kits the AI must play (read-only reference).
- `src/engine/map/` — elevation / terrain / range / LoS queries the lever work reads (high ground, throws).
- Deployment phase (`deployment-phase-architecture.md` + its module) — WI3 role-aware sorting.
- `src/campaign/skirmish.ts` — the gear-less stub context (WI4's eventual consumer is the M4 replacement of
  `generateSkirmishParty`).
- AI test location (audit to confirm) — per-class + per-lever scenario tests.

## Workflow notes

- **WI1 gates and routes.** If the audit says "arc," stop and write back a decomposition; don't grind a
  multi-session arc solo. Mid-scope planning routes through Chris → planner.
- **Audit-first, prune hard.** The matrix likely prunes D-ai-2's "all classes" to a handful of real gaps;
  report what was already competent (audit-overturns-spec is expected, more here than usual).
- **Floor discipline throughout.** Every work item's target is "competent and legible," never "optimal."
  When in doubt about depth, do less — the ceiling is deliberately off-limits this session.

## Watch-fors

- **Gold-plating** — the biggest risk. An AI too strong on every skirmish makes infinite grinding
  miserable and exceeds what the asymmetric win condition needs. Legible-and-competent, not oppressive.
- **Legibility over cleverness** — prioritize levers the player can *see* (height, terrain, positioning)
  over hidden optimization; a loss should be reconstructable ("I should have respected the high ground"),
  not feel arbitrary.
- **Determinism** — AI decisions must stay deterministic given (state, seed) so replays hold; no wall-clock
  or unseeded randomness in the policy.
- **Input gaps** — if a lever needs a query the AI can't currently make, that's a flag-to-planner, not a
  silent engine change.

## Estimated size

**Unknown until WI1 — and that's the point.** The audit is 1 contained deliverable. WI2–4 could be anything
from "a handful of thin classes + deployment sorting, all this session" to "a multi-session arc." The brief
is built to absorb either: the audit sizes the work and either proceeds or writes back. Treat WI1 as the
committed scope; WI2–4 as scope-on-discovery.
