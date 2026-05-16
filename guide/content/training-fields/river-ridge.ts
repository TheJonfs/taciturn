// River Ridge — the instructor's hand-authored prose for the Academy's
// first training field. Mechanical particulars (terrain costs, the
// elevation grid, deployment zones) flow in from ../src/content; this
// file holds only the voice. Bodies accept light markdown.

export interface FieldSection {
  readonly title: string;
  readonly body: string;
}

export interface FieldProse {
  readonly title: string;
  readonly subtitle: string;
  readonly intro: string;
  readonly terrainSections: ReadonlyArray<FieldSection>;
  readonly zoneSections: ReadonlyArray<FieldSection>;
  readonly knockback: string;
  readonly counsel: string;
}

export const riverRidgeProse: FieldProse = {
  title: 'River Ridge',
  subtitle: 'the Academy’s flagship training field',

  intro: `River Ridge is the field every cadet meets first, and the
field every cadet meets again. The Academy holds it as the most
*balanced* ground in its training inventory — a ridge-line to the
east, a river to the west, a level plain between, and deployment
zones cut north and south so that no discipline is given an easy
advantage by the placement of its feet. This is the field where a
cadet learns whether she has understood the foundations she has been
taught.`,

  terrainSections: [
    {
      title: 'The Ridge',
      body: `A west-to-east rising ridge cuts across the centre of the
field, three rows deep. The cadet who reads it correctly will see it
as three distinct climbs: a gentle slope at the western foot, a sharp
jump at the centre, and a high perch at the east — what the Academy
calls the *terraces*.

The western terraces rise a single elevation at a time and are
crossed almost without thought. The central jump is the field's first
real cost: a swing of three elevations all at once, expensive in
movement and unfriendly to a careless step. The eastern perch sits
higher still — a vantage from which a ranged cadet can read the whole
field, but a vantage from which a knockback is a catastrophe.`,
    },
    {
      title: 'The River',
      body: `The western edge of the field is given over to a
north-south river, three columns wide. Its deepest channel runs along
the very edge; the middle and inner columns are shallower, and three
small islands break the water — two on the central column and a single
stepping-stone closer to the bank.

Walking the river is expensive: shallow water doubles the cost of a
tile, deep water triples it. The deep channel between the
inner-column islands is a real barrier — a ground-bound cadet does
not cross it in a single turn. Under a Water Mage carrying her
Tidewalker, the same column becomes a private road.`,
    },
    {
      title: 'The Plain',
      body: `What is left between the river and the ridge — and north
and south of the ridge itself — is flat, level, and unremarkable: the
field on which most of the engagement actually happens. The
deployment zones are inset corners of this plain, each four wide and
three deep, leaving the cadets a measure of room to manoeuvre before
contact is made.`,
    },
  ],

  zoneSections: [
    {
      title: 'The Western Passage',
      body: `The columns at the western foot of the ridge are the
*soft* passage — the climb is gentle here, and melee disciplines
gravitate to it as a matter of instinct. Most early-engagement
pressure resolves on this passage, and the cadet who arrives second
to it tends to lose the exchange.`,
    },
    {
      title: 'The Eastern Perch',
      body: `The high terraces along the eastern edge are a ranged
cadet's natural seat. From elevation nine she has clear line-of-sight
across the better part of the field, and her spells land with the
elevation modifier in her favour. The perch rewards the patient
caster and, in the same breath, punishes the one who is dislodged
from it.`,
    },
    {
      title: 'The Water Lane',
      body: `The river column is class-tied territory. A Water Mage
with Tidewalker treats it as a private flank; without that ability,
no other discipline can match the cost she pays to walk it. A cadet
who means to neutralise the lane should plan to do so by knockback,
not by chase.`,
    },
  ],

  knockback: `The ridge's terraces compose a graduated lesson in fall
damage. A shove off the gentle western tiers costs a target one or
two elevations of drop and little besides; a shove off the central
jump costs five and is no longer a small thing; a shove off the
eastern perch costs *seven* and is, frequently, the engagement.

The cadet who has taken the high perch should never stand within a
single tile of its edge, and the cadet who can reach an opponent on
that edge with a knockback effect should consider, as the Master
Armorer would put it, whether anything else they could do that turn
matters at all.`,

  counsel: `Three things to read on this field, in this order. *First*,
the central pivot: the moment the engagement opens, the question of
who arrives at the ridge's middle terrace first is most of the
question of who wins. Move with that in mind.

*Second*, the river. If your team carries a Water Mage with
Tidewalker, the western lane is yours and the engagement is, in
effect, three rows narrower than it looks. If it does not, treat the
lane as something only the enemy can use against you, and watch for
it accordingly.

*Third*, the perches. The high terraces are worth more than they
appear on the page — but only to a cadet who can hold them, and
holding them means refusing the edge. A perched cadet thrown into
deep water is the field's lesson at its sharpest. Do not be on either
side of that lesson without understanding which side you are on.`,
};
