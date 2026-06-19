# Playtest Findings — new-player session on the post-S70 build (2026-06-19)

*15 notes from a new-player test. Triaged for routing. The through-line is **legibility**:
most of these are things an expert who already knows the rules would never trip over — the
fresh-eyes signal the project hasn't had. A few hide a real decision or a possible
behavior bug; those are called out under "Decisions for Chris."*

## A. Tooltip / copy corrections (text wrong or missing; low-risk)

- **#1 Damage Split** — tooltip still says it reflects *all* damage; the mechanic reflects
  *half*. Copy update to match the shipped value.
- **#10 Spiked Mail** — tooltip omits its retaliation-damage effect; add it.
- **#11 Wand of Potential** — tooltip omits the **+1 SP to lightning-tagged spells**
  (shipped S68/ADR-0115). Add it. (Known; no audit needed.)
- **#4 Tidal Pull** — confusingly written. Grounded: it's the Water reaction — *on being
  hit, +20 CT to self* (your next turn comes sooner). The word "pull" reads as pulling an
  enemy; it actually pulls *your own* turn forward. Rewrite from the mechanic.
- **#8 Wand Resonances** — each of the four wands shifts target resistances on hit, but the
  tooltips don't say which. Enumerate each wand's Resonance (which resistances, which
  direction) and surface it. The enumeration *is* the task — implementer reads the four
  wand defs and writes them out.

## B. Behavior audits → fix or clarify (verify code; may change behavior)

- **#2 Battle Skill ranges** — audit whether every Knight Battle Skill ability inherits the
  equipped weapon's range. **Bull Rush should be melee-locked** (it's a charge into an
  adjacent enemy; a bow-Knight shouldn't Bull Rush at range 5) — that one's a clear fix.
  Other abilities may need your per-ability intent once the audit lists them (see Decisions).
- **#6 Worldcraft → Flow State** — Flow State refunds +10 CT after any `magical`-tagged
  action. Question: are Worldcraft actions `magical`-tagged, and *should* they trigger the
  refund? Audit the current tag; the "should it" is a design call (see Decisions).
- **#9 Rasp Pendant triggers** — it drains MP on *final damage dealt*. Audit which channels
  actually fire it: basic attacks and direct ability damage presumably yes, but DoT ticks
  (Burn), reflected/`system_damage`, and AoE each need confirming. Some of those you may not
  *want* to trigger it (see Decisions).
- **#15 Math Skill Faith usage** — audit which Math Skill abilities still faith-scale. The
  Calculator's identity is faith-independent (that's the ~2× that justifies its lower MA),
  so any Math Skill ability still using Faith is likely an inconsistency to correct. (The S69
  kill-value re-base touched Precision Fire; this is the sweep.)

## C. Clear behavior fixes

- **#14 Templar Jump locks out Move** — using Templar Arts' Jump at the start of a turn must
  consume the Move action (Jump *is* a reposition; Jump-then-Move is a double-move). Mark
  Jump as spending the Move portion of the turn budget.

## D. Team Builder / UX legibility (new affordances)

- **#3 Empty slots show their level** — display a slot's level before a unit is placed, not
  after. (Implementer to confirm where a slot's level comes from in Mage War.)
- **#7 Show the chosen class's active skills** — the builder shows tooltips for *secondary*
  Command Set options but not the active skills of the *primary* class you picked. A new
  player can't see what their own class does. Surface the chosen class's command set.
- **#13 Unit detail cards show gender** — gender is invisible on the card, yet it gates Steal
  Heart (charm only crosses Male↔Female). A player can't plan charms without seeing it. Add
  gender to the detail card.

## E. UI / visual

- **#12 Targeting frame color** — the Math Skill target highlight is too close to the Red
  Team outline, so targets read as "enemy team." Recolor the targeting frame to something
  distinct, and review other targeting highlights for the same clash.

## Decisions for Chris (intent calls; the rest is clear work)

- **#5 Ignition — and this one's more than a tuning knob.** Current def: Support, **cost 2**,
  applies 1 Burn stack `onDamageDealt (magical)`. But the *design intent* on record
  (four-mages-design) is that it fires on **any** magical damage — explicitly including
  non-Fire casters who deal magical damage ("this is intended"). So your option B ("apply to
  all damaging spells, not just fire-tagged") may not be a buff at all — it may be *restoring
  the intended behavior*, which would make the current fire-gating the actual bug. So the real
  shape is: (1) audit whether it's currently gated to fire-tagged damage (a regression from
  intent?), then (2) decide — if you restore "any magical damage applies Burn," 2 SP is
  probably fair and option A (drop to 1 SP) is unnecessary; if you keep it fire-only, 1 SP is
  the value fix. My lean: restore the any-magical behavior at 2 SP rather than cheapen a
  fire-only niche — it matches the documented intent and the mix-and-match passive design.
- **#6 Worldcraft → Flow State** — should terrain-shaping count as "magical" for the CT
  refund? If yes (Terraformer is hybrid/arcane-flavored), it's a tag add; if no, gate it.
  Your call once the audit reports the current tag.
- **#9 Rasp Pendant channels** — which damage should drain MP? My default read: direct
  attacks and ability damage yes; DoT ticks and `system_damage` (reflect, falling, barrier)
  no, since those aren't the wielder "striking." Confirm and we encode it.
- **#2 Battle Skill non-Bull-Rush ranges** — Bull Rush → melee is unambiguous; for the rest,
  the audit will list which inherit weapon range, and you decide per-ability whether that's
  intended (e.g., is Lightning Stab meant to be melee or weapon-range?).

## Proposed batching into sessions

- **A legibility & polish pass** — A (#1,4,8,10,11) + D (#3,7,13) + E (#12). Coherent,
  low-risk, high new-player value; the bulk of the list. The Tidal Pull and Resonance
  rewrites need a glance at the mechanic but no engine change.
- **A behavior audit & correctness pass** — B (#2,6,9,15) + C (#14). Verify-then-fix; carries
  the intent decisions above, so settle those at plan-review.
- **#5 Ignition** — settle the decision first (audit + your call), then it's a small content
  change that can ride either batch or a tuning slot.
