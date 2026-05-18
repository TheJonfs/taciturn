// Pyromancer (catalog id: fire_mage) — the instructor's hand-authored
// prose for the Specialization spread. Mechanical values flow in from
// ../src/content at build time; this file holds only the voice.
//
// S40 name-update pass: the discipline's display name is now
// "Pyromancer" and four abilities were renamed in the same pass —
// Scorch (was Fire Strike), Inner Warmth (was Fire Embrace), Fireball
// (was Fire Storm), Slow Burn (was Spark). The remaining abilities
// (Flame Lance, Ignition, Aether Bloom, Smolder, Hotfoot) keep their
// names. Underlying ids preserved.
//
// Ability-note keys match the ids the catalog resolves for the
// Pyromancer: attack, fire_strike, fire_embrace, fire_storm, spark,
// flame_lance (actives); ignition, aether_bloom, smolder, hotfoot
// (passives).

import type { ClassProse } from '../prose.ts';

export const fireMageProse: ClassProse = {
  tagline: 'Elemental escalation — the mage who sets a thing alight and lets it work.',

  brief: `The Pyromancer trades soundness for reach of consequence.
She is one of the most fragile cadets the Academy will put on a
training ground, and yet, the one the opponent most wants gone —
because the Pyromancer's damage does not end when her spell does. She
lights a foe, and the fire keeps the appointment after she has moved
on to the next.

A cadet drawn to this discipline must make peace, early, with being
brittle. The Pyromancer does not survive engagements by enduring them.
She survives them by ensuring the other side has more pressing
concerns — chiefly, that several of them are presently on fire. Played
boldly, she is decisive. Played timidly, she is merely killed.`,

  abilityNotes: {
    attack: {
      full: `The Pyromancer's staff is an afterthought, and a poor one.
With the lightest arm on the field she has no business in melee at
all — treat the basic strike as proof that a turn has gone badly
wrong.`,
      compact: 'A weak melee blow. For the Pyromancer, an admission of a wasted turn.',
    },
    fire_strike: {
      full: `Honest magical damage at arc range, and on a hit Scorch
may sap both the target's arms — Physical and Magical Attack alike —
as a single, linked stroke. Fire's signature: the debuff lands whole
or not at all.`,
      compact: 'Arc-range damage; a linked chance to drop the target’s PA and MA together.',
    },
    fire_embrace: {
      full: `The same idea turned toward a friend. Inner Warmth lays a
linked pair of boons on an ally — Physical and Magical Attack both —
and, as with all of Fire's linked work, the pair holds or fails
together. A well-placed Inner Warmth makes a striker of whoever stood
beside her.`,
      compact: 'Lays a linked PA Up / MA Up on an ally. Makes a striker of a comrade.',
    },
    fire_storm: {
      full: `The discipline's first area spell. Fireball is a diamond
of fire dropped onto a cluster — modest in its single figures, generous
in how many figures it writes at once, and every cadet caught in it is
a candidate for what the Pyromancer's passives will do next.`,
      compact: 'Area fire damage in a diamond. Modest per target, generous in count.',
    },
    spark: {
      full: `Slow Burn is small, and Slow Burn is the point of the
whole discipline. It is the cheapest, surest way to set a single foe
alight — and a foe alight is a foe the Pyromancer has already
half-spent without spending another turn on them.`,
      compact: 'A cheap, reliable Burn on one target. Small spell; the discipline’s keystone.',
    },
    flame_lance: {
      full: `The discipline's ultimate: a line of fire torn from the
Pyromancer's own position, heavy with damage and trailing Burn behind
it. Flame Lance asks her to commit her footing — the line reads from
where she stands — and rewards the cadet who has lined her enemies up
to be read.`,
      compact: 'The ultimate: a caster-anchored line of heavy fire damage, leaving Burn behind.',
    },
    ignition: {
      full: `The quiet engine of the discipline. With Ignition equipped,
the Pyromancer's magical damage does not merely wound — it kindles.
Every spell becomes, in passing, a Slow Burn. Equip it, and the whole
kit changes character.`,
      compact: 'Support: her magical damage applies Burn in passing. Every spell becomes a Slow Burn.',
    },
    aether_bloom: {
      full: `Aether Bloom widens the Pyromancer's area spells — the
diamond opens, the line lengthens. Against a single foe it does
nothing one can see; against a bunched enemy line it is the difference
between a good turn and a turn the opponent does not recover from.`,
      compact: 'Support: widens her area spells. Nothing against one foe; decisive against a line.',
    },
    smolder: {
      full: `A reaction. A foe that strikes the Pyromancer catches, for
its trouble, a fire of its own — the discipline's standing reply to
being attacked. They may hurt her. She is, as a rule, already costing
them more than the blow was worth.`,
      compact: 'Reaction: an attacker that hits her is set alight. The cost of touching the Pyromancer.',
    },
    hotfoot: {
      full: `One further tile of Move Range, and a measure of Speed
besides. For a discipline that lives or dies on staying a step out of
reach, Hotfoot is not a convenience — it is survival, dressed as a
movement passive.`,
      compact: '+1 Move Range and +1 Speed. For the most fragile cadet, this is survival.',
    },
  },

  strategy: `The Pyromancer is played forward of where her health says
she should be, and that contradiction is the discipline. Ignition
belongs in her Support slot — it is what turns every spell she owns
into a source of Burn, and Burn is the damage the enemy cannot answer
by killing her. From there she is an escalation: Slow Burn or Scorch
to light the first foe, Fireball into the cluster, and Flame Lance
held for the moment a line has formed and Aether Bloom can make her
pay for forming it.

Guard her positioning as you would guard her health, because they are
the same thing. A Pyromancer who is reachable is a Pyromancer who is
shortly dead — but a Pyromancer who is not is the fastest clock in the
engagement, and it is running against the other side.`,

  marginalia: [
    'Brittle is not the same as careful. The timid Pyromancer dies anyway, and slower.',
    'Ignition first. The discipline is half a discipline without it.',
    'A cadet counted Slow Burn’s damage and called it weak. Slow Burn’s damage is not Slow Burn’s job.',
    'If she can be reached, she has already been placed wrongly.',
  ],
};
