// Marshmoor — the instructor's hand-authored prose for the Academy's
// third training field (Session 52). Mechanical particulars (the
// elevation grid, the water costs, the deployment corners) flow in from
// ../src/content; this file holds only the voice. Bodies accept light
// markdown.

import type { FieldProse } from './river-ridge.ts';

export const marshmoorProse: FieldProse = {
  id: 'marshmoor',
  title: 'Marshmoor',
  subtitle: 'the wetland archipelago — open water, scattered isles, and two corner peaks',

  intro: `Marshmoor is the Academy's third standing training field, and
the cadet who has learned River Ridge's balance and Stonebridge's
crossing will find it argues with both. It is, before it is anything
else, *water* — a drowned field of open marsh in which the land has
been reduced to scattered isles, a pair of low flats near the centre,
and two far peaks in opposing corners. There is no single road across
it. The exercise is, first and last, a question of how a cadet
*moves*: who can cross the marsh, who must wade it, and who is left
counting the cost of every tile.`,

  terrainSections: [
    {
      title: 'The Marsh',
      body: `Most of Marshmoor is water, and the water is the field's
first lesson. Shallow water costs a cadet twice the movement of open
ground; deep water, three times — and on a field this drowned, that
arithmetic governs everything. There is no bridge and no ford: the
cadet crosses by stringing together the isles that break the surface,
or she wades, and pays.

A Hydrologist with her Tidewalker walks the marsh nearly as freely as
a plain, and a cadet with Jump enough leaps the narrow gaps between
isles at no cost at all. Every other discipline reads the water as a
tax on her tempo, and either plans her route a turn or two ahead or
arrives late and winded. There is no central feature to fight over
here, the way the bridge or the keep anchored Stonebridge; the field
itself, and the cadet's passage across it, is the contest.`,
    },
    {
      title: 'The Central Flats',
      body: `Two low patches of dry ground sit near the centre of the
field, a little offset from one another and parted by a band of water:
the west-central shelf and its eastern twin. Together they are the
nearest thing Marshmoor offers to open ground, and the engagement
gravitates to them — they are the shortest dry line between the
corners, and the cadet who holds both decides where the lines actually
meet.

But they are stepping-stones, not a plain. A cadet planted on the one
and a cadet planted on the other are still parted by water, and the
crossing between them is its own small contest. The cadet who reads
the centre as a single open field, the way River Ridge's plain was
open, will be corrected the first time she tries to walk it in a
straight line.`,
    },
    {
      title: 'The Corner Peaks',
      body: `Two heights rise from the corners the deployment zones do
*not* occupy: a peak of elevation five in the north-west, and the
field's high point, elevation six, in the south-east. Each is reached
by a mostly-dry spine up its own edge of the field — the south-western
team's natural climb is the north-west peak, the north-eastern team's
the south-east — and each looks down across the whole drowned centre.

They are the archer's prize on this field, and the chapter on the
bow's height rules below explains why. But mark *where* they sit: out
in the far corner, away from the flats, on the opposite side of the
field from where the engagement is decided. The cadet who climbs to a
peak has traded the centre for the height. Whether that trade pays is
the question Marshmoor is built to ask.`,
    },
  ],

  zoneSections: [
    {
      title: 'The Long Approach',
      body: `Marshmoor's deployment zones sit in opposite corners — the
widest separation of any field the Academy keeps — and the cadets
begin a long way from contact. Reckon on four to six turns of
manoeuvring before the lines meet; even a hasted Assassin cannot close
that gap quickly across this much water.

The cadet who treats those opening turns as dead time wastes the
field's chief gift. They are the time to raise one's wards, to take
position, to send the water-mobile ahead while the waders find their
footing. On Marshmoor the engagement is half-decided before a blow is
struck — by who *used* the approach and who merely crossed it.`,
    },
    {
      title: "The Archer's Peaks",
      body: `The two corner heights are where a Hunter earns her place
on this field. A bow rewards the high ground twice over here: the shot
lands harder from above — the bow's damage has always answered to
elevation — and, from a height, it reaches *farther* besides, a tile
of added range for every two elevations the shooter stands above her
mark. From the south-east peak, six elevations above a target in the
deep marsh, that is three tiles of reach added to an already long
shot, and the downhill blow at close to twice its weight.

The counterweight is the climb. The peak is off in its corner, a long
way from the flats, and the archer who takes it has left the centre to
her fellows. A perch this strong is worth holding — but only by a team
that can hold the centre without her.`,
    },
    {
      title: 'The Water Flank',
      body: `The marsh that taxes the wader is a road to the cadet built
for it. A Hydrologist with Tidewalker, or any discipline with Jump
enough to island-hop, can take a line through the open water that a
Knight in plate cannot hope to contest — around a flank, onto an isle
beside the enemy, into a corner the slow cadet reaches three turns
later.

On a field this drowned, water is not merely an obstacle to be
endured. To the right cadet it is the flank no one is guarding.`,
    },
  ],

  knockback: `Marshmoor sets more high ground beside open water than any
field the Academy keeps, and the cadet who has read the chapter on
knockback already knows what that means. A foe shoved from an isle or a
peak into the deep marsh takes the fall as damage *and* lands in water
that costs three of every move to leave — the blow and the bog at once.
From the south-east peak the drop is the longest on any of the
Academy's fields.

The cadet who has taken a height should stand a tile clear of every
watery edge; the cadet who can reach an enemy on such an edge with a
knockback effect should weigh, as ever, whether anything else she might
do that turn matters at all.`,

  counsel: `Three readings, in this order. *First*, the approach.
Marshmoor gives you the longest run-up of any field the Academy keeps,
and the team that spends it — warding, positioning, sending its
water-mobile ahead — meets the enemy already in order. The team that
merely trudges across arrives to fight a battle the other has already
arranged.

*Second*, the centre. The two flats are the field's dry heart, and the
shortest line between the corners runs across them. Hold both and you
decide where the engagement happens; cede them and you will fight on
ground of the enemy's choosing, with water at your back.

*Third*, the peaks — and the discipline to leave them be when they are
not yours to take. A Hunter on the south-east height is one of the most
dangerous things in the Academy's inventory, reaching farther and
hitting harder than she has any right to. But the climb is long and the
corner is far from the centre, and a team that sends *too much* to the
height will find it has won a magnificent perch above a battle it is
losing. Take the peak if you can spare the cadet. If you cannot, do not
let the enemy spare hers.`,

  legend: [
    ['#234a55', 'deep water'],
    ['#5a8c95', 'shallow water'],
    ['#c9b88a', 'flat ground (elev 2)'],
    ['#bba775', 'island rise (3)'],
    ['#ad9760', 'higher ground (4)'],
    ['#9e864c', 'NW peak (5)'],
    ['#8e7639', 'SE peak (6)'],
  ],
};
