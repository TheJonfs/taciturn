// Water Mage — the instructor's hand-authored prose for the
// Specialization spread. Mechanical values flow in from ../src/content
// at build time; this file holds only the voice.
//
// Ability-note keys match the ids the catalog resolves for the Water
// Mage: attack, water_strike, tide_surge, tidal_wave, brine, maelstrom
// (actives); tidal_pull, flow_state, tidewalker (passives).

import type { ClassProse } from '../prose.ts';

export const waterMageProse: ClassProse = {
  tagline: 'Elemental tempo — the mage who decides when the engagement happens.',

  brief: `The Water Mage is the fastest caster the Academy trains, and
speed, in her hands, is not a way of arriving sooner — it is a way of
arranging *when everyone else arrives*. Her discipline is the rhythm of
an engagement: she pushes an enemy's turn further off, draws an ally's
turn nearer, and refunds her own, until the order of the field bends
around her.

A cadet drawn to the Water Mage should be a cadet who enjoys thinking in
the turn queue rather than the damage figures. She wins engagements that,
counted blow for blow, she had no business winning — because she was
never counting blows. She was counting turns.`,

  abilityNotes: {
    attack: {
      full: `The Water Mage's staff is the least of her. Her basic strike
exists, and on the turn the reserve is dry it is better than nothing —
but a cadet who finds herself leaning on it has lost the thread of the
discipline.`,
      compact: 'A weak melee blow. A sign, for the Water Mage, that something has gone wrong.',
    },
    water_strike: {
      full: `Honest magical damage at arc range — and, on a hit, the
target's own turn is shoved further down the queue. The Water Mage rarely
needs the damage to be large. She needs the enemy to be *late*, and Water
Strike makes them late.`,
      compact: 'Arc-range damage that pushes the target’s CT back. The enemy, made late.',
    },
    tide_surge: {
      full: `The mirror of that idea, turned toward a friend: Tide Surge
reaches for an ally's place in the queue and pulls it forward. A cadet
who can grant a wounded comrade their turn a beat early has, in effect,
given the team a free action.`,
      compact: 'Bumps an ally’s CT forward — their turn, sooner. A near-free action for the team.',
    },
    tidal_wave: {
      full: `The discipline's first area spell. It strikes the diamond and
shoves what it catches — and the Water Mage who has read the ground knows
that *where* a foe is thrown is frequently worth more than the wound it
took on the way.`,
      compact: 'Area damage in a diamond, with knockback. Position is the prize, not the damage.',
    },
    brine: {
      full: `Brine does not hurry. It settles a slowing into the target's
limbs and lets the Water Mage's own speed do the rest — against a foe
already behind in the queue, a Brine is very nearly a sentence.`,
      compact: 'A chance to slow the target. Stacked on her own tempo, close to decisive.',
    },
    maelstrom: {
      full: `The discipline's ultimate: a cone torn open from the Water
Mage's own position, heavy with damage and heavier with displacement. It
asks the cadet to commit her footing to it — the cone reads from where
she stands — and it rearranges a corner of the field entirely.`,
      compact: 'The ultimate: a caster-anchored cone — heavy damage and knockback. Rearranges the field.',
    },
    tidal_pull: {
      full: `A reaction. A blow that lands on the Water Mage does not only
cost her health — it stirs the tide, and her own turn comes a little
sooner for it. The discipline turns even being hurt into tempo.`,
      compact: 'Reaction: a blow that lands on her bumps her own CT forward. Pain, made into tempo.',
    },
    flow_state: {
      full: `The quiet engine of the discipline. Flow State refunds a
measure of the Water Mage's charge each time she works her art — every
spell she casts brings the next one nearer. Equip it, and her rhythm
becomes something an opponent simply cannot match.`,
      compact: 'Support: every spell refunds a measure of her CT. The discipline’s engine.',
    },
    tidewalker: {
      full: `Water is no obstacle to the cadet who has made a study of it.
Tidewalker clamps the cost of crossing it — the Water Mage moves through
the ford while others wade. On the right ground, that is a flank no one
else can take.`,
      compact: 'Clamps the movement cost of water tiles. A flank others cannot reach.',
    },
  },

  strategy: `The Water Mage is played in the turn queue, not on the map.
Flow State belongs in her Support slot — it is the difference between a
fast caster and a caster who has stopped letting the enemy take turns at
all. From there, the cadet should think in pairs: a Water Strike that
sets an enemy back and a Tide Surge that brings an ally forward are, in
sum, two turns stolen from the other side of the field.

She is fragile — the lightest-armoured discipline but one — so her tempo
is also her defence. A Water Mage who is always about to act is a Water
Mage who is difficult to punish. Lose the rhythm and you lose her;
keep it, and the engagement was decided before the first blow.`,

  marginalia: [
    'Count turns, not wounds. If you remember nothing else of the Water Mage, remember that.',
    'Flow State is not optional. I have never once seen it left off and been glad.',
    'A cadet asked me if Maelstrom “does enough damage.” She had missed the entire point.',
    'The ford at River Ridge was built for this discipline. Use it.',
  ],
};
