// Fire Mage — the instructor's hand-authored prose for the
// Specialization spread. Mechanical values flow in from ../src/content
// at build time; this file holds only the voice.
//
// Ability-note keys match the ids the catalog resolves for the Fire
// Mage: attack, fire_strike, fire_embrace, fire_storm, spark, flame_lance
// (actives); ignition, aether_bloom, smolder, hotfoot (passives).

import type { ClassProse } from '../prose.ts';

export const fireMageProse: ClassProse = {
  tagline: 'Elemental escalation — the mage who sets a thing alight and lets it work.',

  brief: `The Fire Mage trades soundness for reach of consequence. She is
the most fragile cadet the Academy will put on a training field, and she
is, turn for turn, the one an opponent most wants gone — because the Fire
Mage's damage does not end when her spell does. She lights a foe, and the
fire keeps the appointment after she has moved on to the next.

A cadet drawn to this discipline must make peace, early, with being
brittle. The Fire Mage does not survive engagements by enduring them. She
survives them by ensuring the other side has more pressing concerns —
chiefly, that several of them are presently on fire. Played boldly, she
is decisive. Played timidly, she is merely killed.`,

  abilityNotes: {
    attack: {
      full: `The Fire Mage's staff is an afterthought, and a poor one.
With the lightest arm on the field she has no business in melee at all —
treat the basic strike as proof that a turn has gone badly wrong.`,
      compact: 'A weak melee blow. For the Fire Mage, an admission of a wasted turn.',
    },
    fire_strike: {
      full: `Honest magical damage at arc range, and on a hit it may sap
both the target's arms — Physical and Magical Attack alike — as a single,
linked stroke. Fire's signature: the debuff lands whole or not at all.`,
      compact: 'Arc-range damage; a linked chance to drop the target’s PA and MA together.',
    },
    fire_embrace: {
      full: `The same idea turned toward a friend. Fire Embrace lays a
linked pair of boons on an ally — Physical and Magical Attack both — and,
as with all of Fire's linked work, the pair holds or fails together. A
well-placed Embrace makes a striker of whoever stood beside her.`,
      compact: 'Lays a linked PA Up / MA Up on an ally. Makes a striker of a comrade.',
    },
    fire_storm: {
      full: `The discipline's first area spell — a diamond of fire dropped
onto a cluster. Modest in its single figures, generous in how many
figures it writes at once, and every cadet caught in it is a candidate
for what the Fire Mage's passives will do next.`,
      compact: 'Area fire damage in a diamond. Modest per target, generous in count.',
    },
    spark: {
      full: `Spark is small, and Spark is the point of the whole
discipline. It is the cheapest, surest way to set a single foe alight —
and a foe alight is a foe the Fire Mage has already half-spent without
spending another turn on them.`,
      compact: 'A cheap, reliable Burn on one target. Small spell; the discipline’s keystone.',
    },
    flame_lance: {
      full: `The discipline's ultimate: a line of fire torn from the Fire
Mage's own position, heavy with damage and trailing Burn behind it. It
asks her to commit her footing — the line reads from where she stands —
and rewards the cadet who has lined her enemies up to be read.`,
      compact: 'The ultimate: a caster-anchored line of heavy fire damage, leaving Burn behind.',
    },
    ignition: {
      full: `The quiet engine of the discipline. With Ignition equipped,
the Fire Mage's magical damage does not merely wound — it kindles.
Every spell becomes, in passing, a Spark. Equip it, and the whole kit
changes character.`,
      compact: 'Support: her magical damage applies Burn in passing. Every spell becomes a Spark.',
    },
    aether_bloom: {
      full: `Aether Bloom widens the Fire Mage's area spells — the diamond
opens, the line lengthens. Against a single foe it does nothing one can
see; against a bunched enemy line it is the difference between a good
turn and a turn the opponent does not recover from.`,
      compact: 'Support: widens her area spells. Nothing against one foe; decisive against a line.',
    },
    smolder: {
      full: `A reaction. A foe that strikes the Fire Mage catches, for its
trouble, a fire of its own — the discipline's standing reply to being
attacked. They may hurt her. She is, as a rule, already costing them more
than the blow was worth.`,
      compact: 'Reaction: an attacker that hits her is set alight. The cost of touching the Fire Mage.',
    },
    hotfoot: {
      full: `One further tile of Move Range, and a measure of Speed
besides. For a discipline that lives or dies on staying a step out of
reach, Hotfoot is not a convenience — it is survival, dressed as a
movement passive.`,
      compact: '+1 Move Range and +1 Speed. For the most fragile cadet, this is survival.',
    },
  },

  strategy: `The Fire Mage is played forward of where her health says she
should be, and that contradiction is the discipline. Ignition belongs in
her Support slot — it is what turns every spell she owns into a source of
Burn, and Burn is the damage the enemy cannot answer by killing her. From
there she is an escalation: Spark or Fire Strike to light the first foe,
Fire Storm into the cluster, and Flame Lance held for the moment a line
has formed and Aether Bloom can make her pay for forming it.

Guard her positioning as you would guard her health, because they are
the same thing. A Fire Mage who is reachable is a Fire Mage who is
shortly dead — but a Fire Mage who is not is the fastest clock in the
engagement, and it is running against the other side.`,

  marginalia: [
    'Brittle is not the same as careful. The timid Fire Mage dies anyway, and slower.',
    'Ignition first. The discipline is half a discipline without it.',
    'A cadet counted Spark’s damage and called it weak. Spark’s damage is not Spark’s job.',
    'If she can be reached, she has already been placed wrongly.',
  ],
};
