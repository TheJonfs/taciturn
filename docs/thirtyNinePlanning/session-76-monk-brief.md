# Session 76 — The Monk (14th class, 6th physical)

*A barehanded, PA-scaling, stance-dancing martial artist with self-sustain and a grapple-throw —
squaring the roster to 6 physical / 6 magical (+2 hybrids). Fills the "no physical class self-
sustains" gap and folds the Grappler concept in (Bear's Heave is the throw). **Deliberately skill-
expressive:** stance management is predictive defensive play the AI won't do, so its ceiling is
judged by hand; the `sim:both-ai` seam shows its floor. Built on the proven class-intro arc
(blueprint → audit → substrate → class → polish). Names are final except where noted.*

## The core idea (one paragraph for the implementer)

PA is the Monk's monostat: it drives damage (Barehanded → WP=PA → the basic punch is **PA²**),
evasion (Vigilance), and retaliation (Counterpunch). It wears **no body and no off-hand**, so its
durability is *evasion + counter + self-heal* (all physical-only) — making it a near-hard-counter to
physical and genuinely **fragile to magic** (low effective HP, thin resistance). The four elemental
**Fists** each set a mutually-exclusive **stance** (+50 one element / −50 the paired element) and
carry a rider; the basic **punch** sets no stance. That's the central, intended tension: leaning on
the PA² punch for raw damage means *no stance is up*, so the harder a Monk sells out to hit, the more
magic-exposed it becomes. **The PA-quadratic is uncapped on purpose** — it's melee-committal and
self-punishing, countered by magic and by kiting it down before it closes.

## Stats (final)

| HP | MP | PA | MA | Spd | Move | Jump | Eva F/S/B | Gear access |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **190** | 26 | 9 | 4 | 10 | 3 | 3 | 11/8/3 | **Universal Head only — No Body, No Off-hand** |

Brave/Faith 70/70 (placement defaults). HP 190 reads high but nets ~210 *effective* with a head —
below the Knight's ~314 and Hunter's ~226 — because there's no body slot to stack. The Monk is an
evasion-and-sustain bruiser, not an HP wall.

## Innate passives (free; one per bucket)

- **Counterpunch** (Reaction) — on a damaging hit from an *adjacent* unit, strike back for **PA×4**
  damage and a **PA×4 % chance** to knock the attacker back 1 tile. Brave-gated like other reactions;
  melee-only (ranged/magic don't trigger it).
- **Barehanded** (Support, cost 1 cross-class) — while holding nothing in either hand, **WP = PA**
  (instead of the default 1). Makes the basic punch scale as PA².
- **Vigilance** (Movement, cost 1 cross-class) — **all-facing** (F/S/B) evasion boosted by PA. Note
  it lifts *back* evasion off the floor, so the Monk resists flanking — a deliberate part of its
  anti-physical profile.

## Command set: Martial Arts *(name adjustable — "Beast Forms" is the thematic alt)*

**The basic Attack (punch)** is the PA² barehanded strike: melee, untagged, no stance, no rider —
the sellout damage. The five Martial Arts abilities below are the utility/elemental flow. **All four
Fists use `PA × power_coefficient` (a per-ability tunable), NOT the PA² weapon formula** — so range
can't PA²-explode and each Fist is balanced for its rider, not its damage. Fists deal **physical
damage with an element tag** (reduced by the target's resistance in that element; absorbable if the
target's resistance >100 there — so a Fist can heal a hyper-resistant target; the four-element
flexibility is the answer).

- **Chakra** — heal HP **and** MP for self + units in a diamond-1 (vtol 1) centered on self;
  amount = **PA × coef** (`noFaithScaling`, PA-based, never crits); **clears the caster's stance**
  (heal-but-expose-yourself tradeoff). Aether-Bloom-able (+1 AoE step).
- **Foxfire** (→ Fox stance: +50 Fire / −50 Earth) — fire-tagged Fist; **50% (+ PA/Brave factors)**
  to apply 1 Burn stack.
- **Bear's Heave** (→ Bear stance: +50 Earth / −50 Lightning) — **grapple-throw**: pick up the target
  and place it anywhere in a 2-radius diamond. Forced-movement, not damage (see D5) — enables
  ledge/hazard throws (fall = `system_damage`, unmitigated) and ally repositioning.
- **Storm Stoop** (→ Falcon stance: +50 Lightning / −50 Water) — lightning-tagged Fist; **line
  attack, horizontal range 3, vertical tolerance 3** (Flame-Lance-shaped — a reach, not free-target
  retreat).
- **Serpent's Coil** (→ Serpent stance: +50 Water / −50 Fire) — water-tagged Fist; **refunds Speed×2
  CT** after the hit (tempo).

### Stance table (the new mechanic)

| Stance | Set by | +50 res | −50 res |
| --- | --- | --- | --- |
| Fox | Foxfire | Fire | Earth |
| Bear | Bear's Heave | Earth | Lightning |
| Falcon | Storm Stoop | Lightning | Water |
| Serpent | Serpent's Coil | Water | Fire |

Stances are **mutually exclusive** (a new Fist replaces the prior stance); Chakra clears to neutral.
A Monk's only elemental resistance comes from its active stance + a resistance head — thin by design.

## Pre-implementation plan (audit — expect the substrate to be cleaner than this list)

Inventory what exists vs net-new; prune over-specified scope:
- **Barehanded (WP=PA):** a WP/damage-formula override hook — `modifyStatQuery` on WP, or a
  damage-pipeline hook. Likely small.
- **Vigilance (PA→evasion):** an evasion modifier keyed on PA, all facings. Compose on the evasion
  layer.
- **Stance system:** mutually-exclusive self-statuses each carrying tagged resistance mods + a
  clear-stance effect. Resistance-carrying statuses + a status that displaces its siblings — confirm
  whether mutual-exclusivity needs new machinery or rides an existing "replace same-group status"
  pattern.
- **Tagged-physical damage** (physical formula, element tag → resistance by tag): the formula's
  resistance step is tag-keyed regardless of physical/magical, so likely already supported — confirm.
- **Bear's Heave targeted-throw:** existing knockback (Bull Rush, Tidal Wave) is directional/fixed;
  this picks a *destination* tile in range. Confirm whether forced-movement supports free-target
  placement or needs a small extension. Reuse the fall→`system_damage` path for ledge throws.
- **Chakra (PA-heal, noFaithScaling):** reuse the healing formula with PA + `noFaithScaling`.
- **Foxfire Burn:** reuse the **existing Knight/Hunter PA+Brave status-application path** (audit to
  confirm it's the one to compose on) — NOT the `{faith, ma}` default (the Monk dumps MA).
- **Serpent's Coil CT refund:** reuse a CT-adjust channel (Greaves' `system_set_ct` / Ring's
  `system_ct_push` / Rapids Rush).
- **Counterpunch:** compose on the reaction system (damage + knockback-chance reaction).

## Implementation work (the class-intro arc)

1. **Substrate** — the net-new pieces only: Barehanded WP=PA, Vigilance PA→evasion, the stance
   system (mutually-exclusive tagged-resistance statuses + clear), and Bear's Heave's targeted-throw
   if forced-movement doesn't already place freely. Unit-test in isolation.
2. **Class** — the Monk definition (stats, gear access) + Martial Arts (Chakra + 4 Fists) + the 3
   innate passives, composing substrate + existing patterns (PA×coef damage, tagged-physical, Burn
   via the PA+Brave path, Chakra PA-heal, Serpent CT-refund, Counterpunch).
3. **Polish** — starting coefficients (D1–D6 below) at reasonable values; **AI awareness kept basic**
   (use Fists as attacks, Chakra as a heal; the AI is *not* expected to stance-manage defensively or
   value ledge-throws — that depth is hand-judged and out of AI scope); reference/guide sweep.

## Acceptance criteria

- The class plays per spec: barehanded punch = PA²; the four Fists = PA×coef (tunable), element-
  tagged, each setting its stance + rider; stances mutually exclusive; Chakra heals HP+MP in the
  diamond and clears the caster's stance.
- Foxfire's Burn applies via the PA+Brave path (lands at a sane rate despite MA 4).
- Vigilance lifts all-facing evasion by PA; Counterpunch fires on adjacent damaging hits.
- Per-Fist and Chakra coefficients are exposed as tunable parameters.
- Suite green; `tsc -b` + `vite build` clean; ADR(s) for the stance substrate (+ any new bits);
  reference + guide equipment/class sweep updated.
- **Feel:** floor read via `sim:both-ai`; the stance/throw ceiling judged by hand (AI-illegible).

## Out of scope

- **Bounding the PA-quadratic** — uncapped by design (melee-committal + stance-less-while-punching is
  self-balancing).
- A **knuckle/fist-weapon family** — defer unless the weapon-slot question (D6) lands on allowing one.
- AI stance-management / ledge-throw valuation — the skill-expressive depth is player-facing; the AI
  gets basic competence only.
- Campaign/progression hooks.

## Design questions / tuning flags (ship sane defaults; tune via seam + hand-play)

- **D1 — the four Fist coefficients.** Each tuned for its *rider*, not parity: Bear's Heave near-0
  (the throw is the point); Foxfire modest + Burn; Storm Stoop modest + reach; Serpent's Coil modest
  + tempo. Starting values are a tuning pass.
- **D2 — Chakra's PA coefficient** (heal magnitude) and confirm the stance-clear scope (caster-only,
  vs all affected units — moot under one-Monk-per-team but spec it for correctness).
- **D3 — Foxfire Burn:** base 50% and which factors via the PA+Brave path (audit settles the exact
  formula).
- **D4 — Serpent's Coil CT refund:** Speed×2 (~+20 CT) — confirm it isn't a dominant tempo loop;
  tune down if it spams.
- **D5 — Bear's Heave throw:** damage (likely 0), legal targets (enemies to displace/hazard + allies
  to reposition?), vertical tolerance, no-throw-into-occupied-tiles, and the ledge→`system_damage`
  interaction.
- **D6 — weapon slot:** empty-only (pure barehanded) or may hold a fist/knuckle weapon as an
  alternative to Barehanded? Affects whether a non-PA² Monk build exists.

## Files (hedged — audit confirms)

Content: the Monk class def + Martial Arts abilities + the four stance statuses. Substrate: WP=PA
hook; PA→evasion hook; stance mutual-exclusivity + clear; targeted-throw (if new). ADR(s); Vitest
per piece; reference + guide sweep.

## Watch-fors

- **PA-buff compounding** is the swingiest interaction — Gauntlet (+3), Martial Expertise (×1.25),
  Sculpted Enhancement, Combat Focus all hit damage *and* evasion *and* counter at once. Expected and
  uncapped; watch the ceiling in play.
- **Anti-physical hard-counter profile** (all-facing PA-evasion + Counterpunch + Chakra) concentrates
  the Monk's counterplay onto magic. Confirm it isn't oppressive on magic-light maps/matchups.
- **The self-balancing must actually hold** — the punch-sellout's exposure (no stance, no body) should
  let magic/kiting reliably run it down. If it doesn't, that's the first real balance signal.
- **Serpent CT loop** spammability (D4).
- **Stance system is AI-illegible** — the Monk will read weaker in `sim:both-ai` than in skilled
  hands; don't tune the class *down* off an AI-vs-AI floor read.

## Estimated size

Large — a full class introduction with genuine net-new substrate (the stance system especially, plus
WP=PA, PA-evasion, and possibly free-target throw). The proven multi-chunk arc; may run a session+.
The audit will likely prune (tagged-physical and free-target throw may already exist).
