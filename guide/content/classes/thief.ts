// The Thief — the instructor's hand-authored prose for the twelfth
// Specialization spread (S-thief, the resource-theft skirmisher).
// Mechanical particulars (stats, ability costs, ranges, contest chances)
// flow in from ../src/content; this file holds only the voice.
//
// Like the Calculator, the Terraformer, and the Templar, the Thief's
// First Action is a themed kit rather than a long spell list — the four
// Thievery arts — so the spread leads with a commandSetIntro block
// framing the theft before the four steals. Attack is omitted (no
// authored note → the template skips it): the Thief's basic strike is a
// delivery vehicle for the steals, not a story of its own.
//
// Lane note vs the Assassin: the Assassin denies what a foe can *do*
// (Stop, disable, debuffs); the Thief denies what a foe *has* (HP, MP,
// buffs, and — at capstone — the unit itself). Keep the two distinct in
// the prose; they are neighbours, not duplicates.
//
// Ability-note keys: steal_hp, steal_mp, steal_buffs, steal_heart
// (Thievery); slip_free (reaction), momentum (support), move_plus_2
// (movement).

import type { ClassProse } from '../prose.ts';

export const thiefProse: ClassProse = {
  tagline: 'The hand in the engagement — she does not break a foe so much as empty her.',

  brief: `The Thief is the Academy's twelfth discipline and the answer to
a question no other cadet asks. Where the rest of the roster deals in
*output* — a wound, a ward, a slowing, a reshaped field — the Thief
deals in *transfer*. She takes: health off a struck foe and onto
herself, the reserve out of a caster and into her own, the boons a unit
was granted stripped away and worn in their place, and — at her capstone
— the unit *itself*, charmed for a span into turning on the side that
raised it.

She is fast, slippery, and hard to pin, but she is not a striker who
arrives first; that is the Assassin, who denies a foe what she may *do*.
The Thief denies what a foe *has*. Every art answers to Physical Attack,
so her arm is also her cunning — and her whole turn bends toward one
question: spend the theft now, or bank the reserve for the theft that
decides the engagement.`,

  abilityNotes: {
    steal_hp: {
      full: `A measured strike — three-quarters of an honest blow's
weight — that siphons half the damage it deals back into the Thief. It
heals off what *lands*, so a fully-evaded or fully-resisted hit mends
nothing, and a killing blow siphons all the same. Her sustain valve,
cheap enough to lean on.`,
      compact: 'Melee strike at ×0.75 damage, healing the Thief for half the damage dealt. The cheap sustain valve.',
    },
    steal_mp: {
      full: `A weapon strike that takes no health but drains the
target's *reserve* — three times the Thief's Physical Attack in MP — and
refunds her half of what it pulls. Against a full caster it is a double
theft: her reserve refilled, the enemy's art starved. It carries on the
equipped weapon, so a bow lets her drain from range.`,
      compact: 'Weapon strike draining PA×3 MP; refunds half of what was taken. Starves a caster and refuels her at once.',
    },
    steal_buffs: {
      full: `A reaching theft, cast in a straight line: on a contest of
Brave and Physical Attack, it strips *every* boon the foe carries and
lays them all upon herself — magnitude, duration, and stacks intact. It
takes no debuff, and no buff from a foe's own gear; only what was *cast*
transfers. A buffed enemy is, to the Thief, a buffed ally waiting to
change sides.`,
      compact: 'Ranged contest (line of sight): strips all cast-on buffs from a foe and wears them herself. Not equipment buffs, not debuffs.',
    },
    steal_heart: {
      full: `The capstone, and the biggest single swing in the Mage War.
Steal Heart *charms* a foe for three turns — while it holds, the target
acts on the Thief's side, most cruelly turned upon the line that raised
it. It is *gender-gated*, a cadet charming only the opposite, and
*hard*: a contest that begins near one chance in ten and climbs only
with Physical Attack, Brave, and a target whose Brave was cut first.
Fragile, too — any attack that wounds the puppet may snap the charm
early. Set it up or do not throw it; and mind the reserve, for at 24 MP
against her 28-MP bar she banks for it across the engagement.`,
      compact: 'The charm capstone (24 MP): turns a foe to your side for 3 turns. Opposite-gender only, a hard PA/Brave contest, and attack damage can break it early. Set up first.',
    },
    slip_free: {
      full: `A reaction against being held: when a timed affliction
settles on the Thief — a Stop, a Slow, a binding — she shrugs a turn off
its duration on the instant, and a single-turn debuff she shrugs off
whole. It is Brave-gated, so the same boldness that fuels her thefts
fuels her escape. The control disciplines find her a frustrating mark.`,
      compact: 'Reaction: shaves a turn off any timed debuff applied to her (a 1-turn debuff, off entirely). Brave-gated. Hard to pin.',
    },
    momentum: {
      full: `The Water Mage's Flow State, turned inside out: where the
Hydrologist's engine refunds charge on her magical casts, the Thief's
refunds it on everything *but* — every strike, every steal, the basic
Attack included. Move and Wait alone return nothing. It makes the
patient, banking turns tempo-positive rather than dead, and the active
ones quicker still.`,
      compact: 'Support: refunds a measure of CT after any non-magical action (the basic Attack and the steals included). The inverse of Flow State.',
    },
    move_plus_2: {
      full: `Two full tiles of Move Range — the stronger of the
Academy's two movement bands — lifting the Thief to a reach of five.
This is not a convenience but the keystone the rest of the kit rests
on: it is what carries a melee theft across the field to the protected
caster in the enemy's back line, in a single turn, before he can spend
the reserve she has come to take.`,
      compact: '+2 Move Range (to an effective 5). The reach that gets her to a backline caster in one turn — load-bearing for the kit.',
    },
  },

  commandSetIntro: {
    name: 'Thievery',
    facts: 'First Action · steal HP · MP · buffs · the heart itself',
    full: `The Thief's First Action is a set of four thefts, and the turn
is choosing which to take — health, reserve, boons, or, at the capstone,
the foe entire. Every one rolls on her Physical Attack, and the whole
kit runs on a single reserve she must choose, each turn, to spend or to
hoard.`,
  },

  strategy: `The Thief is played as *attrition with intent*. The three
lesser thefts are her standing work — Steal MP to bleed a caster dry as
her own reserve fills, Steal HP to stand on borrowed health, Steal Buffs
to wear an opponent's preparation against him — while her Move of five,
Momentum, and Slip Free keep her reaching the back line and slipping any
hold. But the deciding turn is Steal Heart, and the rest of the kit is
built to set it up: the charm is a long shot until Physical Attack is
stacked and the target's Brave cut first. Thrown cold it is wasted;
thrown prepared it turns the enemy's strongest cadet against her own
line.`,

  marginalia: [
    `The Assassin denies what a foe may *do*. The Thief denies what a foe *has*. Neighbours, not twins.`,
    `Physical Attack is the whole cadet — it is her damage, her drain, and the odds on every contest she throws.`,
    `Steal Heart is never thrown cold. Cut the Brave, stack the arm, then charm — or do not spend the turn.`,
    `Twenty-four against twenty-eight. Every turn she does not bank the capstone is a turn she has chosen not to.`,
  ],
};
