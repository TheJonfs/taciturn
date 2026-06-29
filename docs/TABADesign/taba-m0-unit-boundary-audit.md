# TABA M0 — Pre-design audit: the unit-model boundary

**Type:** Discovery / read-only audit. **Output:** a findings report — *not* a build. No campaign
code, no refactoring, no new types. Read the current model, map it, categorize it, and report back
with a recommendation. This audit's findings feed the M0 design brief; getting the boundary right
here is the highest-leverage M0 decision (it's the expensive-to-rework spine, per
`campaign-decomposition.md` §3–§4).

## Why this audit (the mental model to test)

The TABA campaign spine is **persistent unit identity + battle-as-pure-transition**: a durable unit
lives in campaign state → the battle takes a **snapshot** of it (instantiates self-contained battle
state) → runs as a pure transition → emits a **result** (outcome + per-unit deltas) → the campaign
**applies** the deltas back to the durable unit.

The key reframe: **this is the existing team-builder → battle → result flow made persistent.** Today
the team-builder produces a config, the battle consumes it, and the result is mostly discarded. The
campaign makes that config *durable* and applies the result *back* to it. So the real question isn't
"how do we invent a snapshot boundary" — it's **how close is the current one-shot flow already to the
persistent loop, and where does the config get dropped that should persist / the result get dropped
that should apply back?**

I'm carrying an unverified assumption — *that there may or may not already be a durable-template vs
battle-instance split.* Please overturn it if it's wrong. The whole point is to replace my guess with
the actual shape.

## What to investigate

### A. The unit model itself
- What type(s) represent a unit, and where are they defined? Is there already a split between a
  durable/config representation and a battle-state representation, or is it one `Unit` mutated through
  the battle?
- Enumerate the unit's fields and **categorize each** as: (1) **durable identity** (id, name, class,
  portrait — persists across battles), (2) **durable loadout** (equipment, R/S/M, abilities —
  persists), (3) **battle-only ephemeral** (current HP/MP, CT, position/facing, statuses, Monk stance,
  charge/channel state, per-action seed state, action-log), or (4) **ambiguous / mixed**.
- Specifically: is **current HP/MP** modeled distinctly from max, in a way that *could* persist (a
  wounded unit carrying low HP into the next node), or is it always derived/reset at battle start?
  (M0 carries unit *state* A→B but leaves leveling out — so whether "wounds persist" is even
  *expressible* in the current model matters.)

### B. The entry boundary (team-builder / deployment → battle)
- How does a roster get from the team-builder into a running battle? What data structure crosses that
  boundary?
- Is it a clean **instantiate-battle-state-from-config** (snapshot-in), or does the battle mutate the
  team-builder's own objects in place?
- Is the team-builder's output already plain serializable data, or does it carry behavior / class
  instances / closures?

### C. The exit boundary (battle → result)
- What does the battle currently emit when it ends? (Outcome only? Surviving units? Final HP? A
  structured result object, or something minimal/implicit?)
- How decoupled is that emission from any consumer — i.e., does the battle already report a result it
  doesn't itself act on?
- How hard would it be to **enrich** the result into a per-unit delta superset (XP / JP / wounds /
  survival / outcome) **without the battle knowing the campaign exists** (the "emit superset, consume
  subset" invariant)? Is there an obvious place that result is assembled?

### D. Serialization + identity (the M0 save/load + persistence needs)
- Is the durable part of the unit model **JSON-serializable as-is**? Flag anything that blocks
  round-trip save/load: functions, class instances, `Map`/`Set`, circular refs, non-plain objects.
- Are unit **IDs stable and durable**, or battle-scoped (assigned at battle start)? Could a unit keep
  one identity across multiple battles as-is, or is identity currently battle-local?

### E. The synthesis (your read — the part I most want)
- Given A–D, **where is the natural seam** between the persistent unit and the battle unit? Is the
  codebase already close to "durable config → battle snapshot → deltas out," or is it one mutated
  object that needs a split?
- **What's the muddiest part** — the single thing that'd be hardest to cleanly separate (the field or
  flow that mixes durable and ephemeral, or the place battle state leaks into config)?
- Are there **existing patterns/precedents** the campaign's snapshot/apply boundary should *compose
  on* rather than invent? (E.g., does the immutable-state + action-log architecture already give us a
  clean "initial state derived from config" step we can lean on?)

## Output format

A findings report answering A–E — terse is fine, code references welcome (type names, file paths,
the shape of the config-crossing-the-boundary and the result-coming-out). The most valuable section
is **E**: your recommendation on where the seam wants to be and what's already there to build on.
Chris brings the findings back to the planner thread to write the M0 brief against the real model.

## Explicitly out of scope
- Building, refactoring, or writing any campaign / persistence / serialization code.
- Designing the campaign-state container or delta schema (that's the M0 brief, written *after* this).
- Touching the battle engine's purity. This is read-and-report only.
