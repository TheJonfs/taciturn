// Foundations of Battle — the combat-theory chapter. Hand-authored
// conceptual prose, one section per principle. Mechanical numbers are
// NOT hardcoded here: the page template interleaves diagrams and data
// callouts built from the imported ruleset. The `key` ties a section
// to its diagram. Bodies accept light markdown.

export interface FoundationsSection {
  readonly key: string;
  readonly title: string;
  readonly body: string;
}

export const foundationsIntro = `What follows is not lore, and it is not
optional. These are the principles every engagement at Gariland runs on
— the same for every cadet, every discipline, every field. Learn them
here, on the page, where a mistake costs nothing. The field charges
more.`;

export const foundationsSections: ReadonlyArray<FoundationsSection> = [
  {
    key: 'charge-time',
    title: 'The Rhythm of an Engagement',
    body: `Every engagement at Gariland keeps a single clock, and every
cadet on the field keeps her place in it. That clock is Charge Time —
CT — and learning to read it is the first thing the Academy teaches,
because nothing else makes sense until you do.

A cadet does not act when she wishes. She acts when her CT comes full.
Between her turns it rises, tick by tick, at a rate set by her Speed —
the faster cadet's clock fills sooner, and so she acts the more often.
When it reaches the threshold the turn is hers: she may move, she may
act, she may do both, or she may decline and simply wait. Each of those
choices spends a different measure of the clock she has just filled,
and the heavier the commitment, the longer until her next turn comes
round.

This is the rhythm of an engagement, and it is very nearly the whole of
it. A cadet who thinks only of the blow in front of her, and not of
when she will be permitted the next one, has not yet understood the
field. Speed is not a small stat. Speed is the tempo of the war.`,
  },
  {
    key: 'actions',
    title: 'The Cadet&rsquo;s Options',
    body: `When a cadet's turn comes round, she makes her choices from a
fixed set of abilities — not a free hand, but a structured one. What she
may do on each turn is built from five buckets, and each bucket is built
on a different kind of choice.

The First Action is her command — the discipline she has trained in,
the spell or strike she leads with. A Secondary set may hold a borrowed
school besides. Her Reaction is the answer her body gives, unbidden,
when the field acts upon her; her Support is the standing passive that
shapes everything she does; her Movement is how she carries herself
across the ground. Each bucket has a capacity — room for so much and no
more — and the cadet's loadout is the art of spending that room well.

One does not get everything. That is the point. A loadout is a set of
decisions about what kind of cadet you intend to be — made before the
engagement, and answered for during it.`,
  },
  {
    key: 'elements',
    title: 'The Elemental Wheel',
    body: `The Academy holds that the four elemental principles — Fire,
Earth, Lightning, Water — compose a closed cycle of opposition. This is
not a matter of lore. It is a matter the cadet will read on the field,
in the plain arithmetic of damage dealt and damage suffered.

Each discipline stands strong against one element and yields to
another, around and around with no beginning. A cadet who knows where
her opponent sits on the wheel knows, before a spell leaves her hands,
which of her own will land heavy and which will be shrugged aside.

And there is a further turn of the screw. Resistance, pushed far
enough — by discipline, by requisitioned gear, by both at once — does
not merely blunt an element. It *inverts* it: a blow the cadet should
fear becomes a blow that mends her. The Academy calls this absorption,
and the cadet who engineers it deliberately has understood the wheel
better than most who merely respect it.`,
  },
  {
    key: 'status',
    title: 'Lingering Conditions',
    body: `Few engagements are decided by damage alone. Most are decided
by the conditions the cadets impose on one another along the way — the
lingering states the Academy calls statuses.

Some are boons: a mending that ticks on untended, a quickened step, a
ward against harm. Some are afflictions: a slowing, a blinding, a
silence that takes the words of a caster's art out of her mouth.
Some are simply parametric — a stat raised or lowered, holding for a
span. They arrive by spell, by reaction, by the standing effect of
gear, and they leave by their own clocks, or by a cadet's effort to be
rid of them.

The cadet's instinct, early, is to treat statuses as garnish on the
real business of the blow. The cadet's instinct is wrong. The slow that
costs an opponent a turn, the silence that costs her her discipline
entirely — these are not garnish. They are, frequently, the
engagement.`,
  },
  {
    key: 'terrain',
    title: 'Reading the Ground',
    body: `The training field is never flat, and the cadet who treats it
as though it were has handed her opponent an advantage for nothing.

Ground has elevation, and elevation has weight: a cadet strikes more
surely from above, and a cadet thrown from a height takes the fall as
damage. Ground has texture — open land crossed at no cost to speak of,
shallow water at a price, deep water at a steeper one — and a cadet's
discipline and gear decide whether that price is worth paying or worth
avoiding. And the field can be made to move a cadet against her will:
knockback, the displacing force of certain spells, which a careless
caster spends on damage and a careful one spends on *position*.

Ground also *blocks*. A class of attacks — the bolt and the beam, the
straight-line spell that travels from caster to mark — requires a clear
line between the two: an interposed body, a conjured barrier, or *the
ground itself* rising above that line will stop it cold. Here height
answers in kind. A cadet who holds the high ground — or a Hunter who
aims with *Vantage* — looks *down* a raised line and sees over a ridge
that would blind a caster on the flat; to reach a target in a hollow
behind a crest, one must stand high enough to clear it. These are the
engagement's aimed strikes, and cover — terrain now as much as wall — is
the answer to them. Mark the distinction, for it does not hold
everywhere: the lobbed and the arcing attacks — a bow's high shot, a
spell that falls upon its target from above rather than flying at it —
arc over a wall or a low hump as though it were not there. Only a
*genuine mountain*, rising well above both cadets, turns the lob aside.
A cadet behind cover is safe from the aimed strike and exposed to the
lob, and reading which is which is reading the ground.

Read the terrain as carefully as you read your opponent. More often
than the cadet expects, the two are the same reading.`,
  },
  {
    key: 'standing',
    title: 'The Cadet&rsquo;s Standing',
    body: `Before a cadet's gear is requisitioned and before the
engagement is called, the Academy registers each member of a team in
the *marching order* — the sequence in which the team's cadets are
listed for the field. This is not a courtesy. The marching order
sets, for each cadet, her *level* in the engagement, and the level
shapes the body she will fight with.

The convention is simple. The first cadet in the order is set at the
Academy's reference level — *level twenty-five* — and stands at her
baseline of HP, MP, and her discipline's *dominant* stat (Physical
Attack for the Knight, the Alchemist, the Hunter; Speed for the
Assassin; Magical Attack for the four elemental Mages and the
Calculator). The second cadet drops one rank to twenty-four, the
third rises one to twenty-six; the fourth drops two to twenty-three,
the fifth rises two to twenty-seven, and so on outward by
alternating step.

The effects come in two tiers. A single rank of remove — slot two or
three — shifts the cadet's HP and MP by a tenth, raised at the
higher level and lowered at the lower. Two ranks of remove — slots
four and five — carry that same ten-percent HP and MP shift and *add*
a point of the cadet's dominant stat besides, gained at the higher
level and lost at the lower. The HP-and-MP shift does not compound
further with distance; the dominant-stat shift is the cost and the
gift the outer ranks pay for their place.

The marching order is therefore a quiet design choice the team-builder
makes for the cadet who will most reward the body she is given. A
team whose first cadet is the discipline's anchor — the Knight at the
line, the Calculator behind it — concedes the outer slots' HP and MP
in exchange for that anchor's standing at her clean baseline. A team
that arranges otherwise is asking the engagement to favour a different
shape of cadet. Neither is wrong; both are *chosen*.`,
  },
  {
    key: 'equipment',
    title: 'Requisitioned Gear',
    body: `A cadet does not take the field as she is. She takes it as she
has equipped herself — and the Academy's armory is generous enough that
the equipping is a real decision, not a formality.

Five slots: a weapon in one hand or the other, a shield or second
weapon in the off hand of those trained in such, protection for the
head and for the body, and an accessory. Each piece composes onto
the cadet's baseline — stats raised, resistances shifted, sometimes a
standing effect granted or a bucket's capacity widened. Some gear is
open to any cadet; some is cut for a single discipline and barred to
the rest.

The full catalogue, with the Master Armorer's notes, is later in this
handbook. For now, the principle: a cadet's gear is not decoration upon
the cadet. It is part of the argument she intends to make.`,
  },
  {
    key: 'hit-evasion',
    title: 'Whether the Blow Lands',
    body: `Not every blow lands, and not every blow that lands lands the
same.

A physical strike must first defeat the target's evasion — and evasion
is a matter of facing. A cadet is hardest to strike from the front,
less so from the side, and barely guarded at all from behind; the cadet
who manoeuvres for the back arc has won half the exchange before she
swings. Magical force does not roll against evasion the same way — the
caster's art finds its mark more reliably — but it answers to
resistance instead, which the elemental wheel has already taught you to
respect.

And any blow that lands may, by chance, land as a *critical* — harder
than it had any right to. The chance is small by default, but it is not
nothing, and gear and discipline can sharpen it. The Academy's counsel
is the same as ever: do not build a plan upon the critical. Build a
plan that is glad of one.`,
  },
];
