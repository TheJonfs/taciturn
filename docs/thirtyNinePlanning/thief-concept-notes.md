# Thief — Concept Notes (12th class)

*Settled structural vision and starting parameters for the Thief, the roster's twelfth
class and fifth physical. Conceptually complete; implementation deferred to a future
content session (after the AI capability-expansion arc, per the substrate → content
cadence). Open tuning values and implementer audit questions are flagged explicitly.
Mirror of `templar-concept-notes.md`.*

## Identity & design intent

The Thief fills the one mechanical axis the physical roster doesn't touch: **resource
interaction.** Every existing class outputs damage, a control-status, a heal, or terrain;
none transfers or denies resources. The Thief drains HP, drains MP, strips and wears
enemy buffs, and (at capstone) temporarily steals a unit outright.

**Lane boundary vs the Assassin (hold this line as the kit grows):** the Assassin denies
what a unit can *do* (Stop, disable, debuffs); the Thief denies what a unit *has*
(HP / MP / buffs / eventually equipment). Don't give the Thief action-denial statuses —
that blurs the two.

**Core tension — the MP budget.** A 28-MP bar against a 24-MP capstone means the Thief is
perpetually choosing between using its kit and banking for Steal Heart. Steal MP is the
pressure valve (net-positive refuel); the free basic attack is the MP-conservation filler
(and, with the support passive, a tempo-positive one). This juggling *is* the class.

**Build axis.** PA drives every active (Steal Heart chance, Steal MP magnitude, Steal HP
damage, Steal Buffs chance), so the optimal build stacks PA, with Brave (steal/contest
reliability + reaction trigger rate) and Speed (tempo, evasion) as the marginal choices.
Coherent, but deliberately PA-centric.

## Stats & gear

| Stat | Value | Notes |
|---|---|---|
| HP | 90 | Moderate — sturdier than the Assassin, far below the Knight. |
| MP | 28 | Tuned to the 24-MP Steal Heart bank. |
| PA | 7 | Baseline; ~10 fully equipped. The class's everything-stat. |
| MA | 3 | No magical scaling; abilities are PA/Brave-driven. |
| Speed | 11 | Fast skirmisher; a touch under the Assassin (the speed-for-PA trade). |
| Brave | 70 | Default; ~85 equipped. Load-bearing for the steal contest + reaction rate. |
| Faith | (class default) | Pin to the current roster default. |
| Move / Jump | 3 / 3 | → Move 5 with the movement passive. |
| Evasion (F/S/B) | 8 / 4 / 0 | Evasive from the front, exposed from behind. |

Gear: universal slots only, same as the non-Knight/non-Templar physical classes.

## Active abilities

| Ability | MP | Effect | Scales on | Success gate |
|---|---|---|---|---|
| **Steal Heart** | 24 | Charm target 3 turns (parallels Stop / Don't Move / Don't Act); 50% chance to clear early on damage | PA + Brave contest | `10 + 3·PA + 0.5·(Thief_Brave − Target_Brave)`, clamp [1, 95] |
| **Steal HP** | 5 | 75% of a normal weapon attack's damage; heal 50% of damage dealt | PA × WP | evasion (attack); heals only on damage dealt |
| **Steal MP** | 3 | Drain PA × 3 MP from target; restore 50% of MP *actually removed* to self | PA × 3 | evasion (attack) |
| **Steal Buffs** | 4 | Strip all positive-polarity statuses; apply all to the Thief | PA + Brave contest | `33 + 3·PA + 0.5·(Thief_Brave − Target_Brave)`, clamp [1, 95] |

### Steal Heart success formula

Tuned-additive: `baseChance + α·PA + β·(Thief_Brave − Target_Brave)`, clamped [1, 95].
- `baseChance = 10`, `α = 3`, `β = 0.5`. So 1 PA ≈ 6 points of Brave differential.
- Cap of 95 is deliberate: the biggest swing in the game is never a guaranteed lock,
  even under full setup.

Worked examples:
- Naked baseline (PA 7, Brave 70 vs 70): `10 + 21 + 0` = **31%**.
- Fully equipped (PA 10, Brave 85 vs 70): `10 + 30 + 7.5` = **48%**.
- Equipped + one Undermine on target (Brave 85 vs ~50): `10 + 30 + 17.5` = **58%**.

Reliability is intentionally low naked — Steal Heart is a set-up-or-don't-bother capstone.
The 24-MP cost prevents the Thief self-comboing an Undermine without a refuel or an
MP-raising body slot, so the setup must be earned (teammate, cross-class secondary, or
Steal MP loop first).

The β = 0.5 coefficient is the "how much does Brave manipulation pay" dial; the α/β = 6
ratio is a playtest-revisitable starting point.

## RSM abilities

- **Reaction — `Slip Free` (1 pt).** When a debuff is applied to the Thief, immediately
  advance it one tick of duration (a 3-turn Stop becomes 2). Composes on the Purifier
  accessory's duration machinery. Brave-gated like any reaction, so the Thief's Brave
  investment also raises its fire rate. Note: a 1-tick debuff is negated outright.
  (Name alternatives: `Shake Off`, `Light Feet`.)
- **Support — `Momentum` (1 pt).** Refund a small amount of CT whenever the Thief takes a
  **non-magical action** (basic attack included). Parallel to the Hydrologist's Flow
  State. Including the basic attack is deliberate: it makes MP-banking turns
  tempo-productive rather than dead, without devaluing the steals (which also refund).
  Keep the magnitude small, matching Flow State.
  (Name alternatives: `Adrenaline`, `Quickening`.)
- **Movement — `Move +2` (2 pt).** Canonical FFT, no rider. Base Move 3 → 5. Pairs
  deliberately with Steal MP — the reach is what lets the Thief get to a protected
  backline caster to drain it.

(All three sit in different buckets, so the full native package runs together — a
slippery, fast, control-resistant skirmisher — at the opportunity cost of cross-class
R/S/M.)

## Deferred / banked

- **Steal Equipment** (per-slot, Calculator-style submenu) + **Equip Change** — deferred
  to a future inventory/campaign context. With no between-battle persistence and all gear
  available in the team builder, the "keep it" payoff is inert; the "disable their gear
  for the battle" dimension needs a mutable-loadout path the engine likely lacks. Banked
  as the deliberate plant that *motivates* an inventory system.
- **Steal Heart's expansive targeting model** — v1 uses FFT-canonical gender gating
  (Male ↔ Female). A per-unit attraction parameter or universal targeting is downstream.
- **Control-override substrate** — Steal Heart's real cost is building a *temporary
  control reassignment* primitive (controller decoupled from team for a duration). This is
  the load-bearing reason the capstone is worth the lift: Confusion (controller → none /
  random), Berserk (controller → forced-attack), and future Charm-family statuses all
  consume it. Treat it as substrate with multiple consumers, not a one-off.

## Open tuning values & watch-fors

- **PA : Brave ratio** (α/β = 6) — revisit in playtest.
- **Steal MP coefficient** — PA × 3 is 30 MP at max PA, which roughly halves a rebaselined
  48-MP mage on one cast and locks it out on two; a max-PA Thief is incidentally a hard
  mage-counter. Keep for now; PA × 2 is the release valve if oppressive.
- **Steal HP lifesteal %** — 50% is the "how self-sustaining" dial; 60–75% if sustain
  should be more of the identity.
- **Steal Heart break trigger** — "50% on any damage" is the v1 rule; be aware DoT ticks
  and the controller's own AoE will roll it (charm is genuinely fragile). If that feels
  too random, restrict the trigger to damage from the puppet's *original* team and decide
  per-instance vs once-per-turn.
- **Steal Buffs thematics** — Brave-resisting buff-theft is a mild stretch; reuse of the
  contest formula is the justification. Watch the snowball (stolen Haste → more Thief
  turns → more steals).

## Implementer audit questions (audit-overturns-spec — expect the substrate to differ)

- **Support trigger predicate** — is "non-magical action" cleanly the inverse of Flow
  State's magical-tag check, or does it need explicit construction (and should the basic
  attack be in or out — the doc argues in)?
- **Steal Buffs** — is there a dispel / clear-specific-status primitive, or is that
  net-new? Confirm every stealable buff carries the `aiHints.polarity: 'buff'` declaration
  (undeclared buffs slip the filter; "neither" statuses like Stop/charging must not be
  taken).
- **Steal MP** — confirm restore keys off MP *actually removed*, not nominal PA × 3.
- **Steal Heart** — confirm the existing `{ brave, pa }` status-chance shape's `brave`
  term is the caster's (positive proc factor); the Thief introduces the *new* form of
  target-Brave-as-resistance, so define that relationship explicitly.
- **Control-override** — does the engine model unit-controller separately from
  unit-team, or is that the substrate to build? Edge cases: Steal-Heart the last enemy
  (win condition?), KO while charmed (whose loss?), revert timing mid-charge,
  post-revert immunity window to prevent chain-charm-lock.

## AI notes

The kit leans on two AI dimensions: the **MP-economy term currently in flight** (the gain
side of Steal MP) and the **deferred self-state valuation** (gaining buffs on self,
valuing a charm swing, playing *around* being charmed). The AI will use the legible parts
(Steal HP as damage+heal; Steal MP gain; Steal Heart target selection by value) but
under-play the rest until those land. Content ahead of AI as usual — the Thief adds weight
to the case for promoting the self-state AI dimension.

## Status

Conceptually settled at the starting-parameter level. Implementation is a future content
session, sequenced after the AI capability-expansion arc. Proven class-introduction arc:
blueprint → audit → substrate → class → polish.
