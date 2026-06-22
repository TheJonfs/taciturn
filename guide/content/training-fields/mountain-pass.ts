// Mountain Pass — the instructor's hand-authored prose for the Academy's
// fourth training field (Session 70). Mechanical particulars (the
// elevation grid, the split deployment caps) flow in from ../src/content;
// this file holds only the voice. Bodies accept light markdown.
//
// The field is 16×16, elevations 2–11, no water — all land at step cost
// one, painted in three elevation bands (low ground, mid slope, rock).
// Its character is the *ambush*: a single broad valley in the north-west,
// a low pass threading south-east between two walls of high ground, and a
// split deployment that seats one side in the open and the other on the
// heights to either flank.

import type { FieldProse } from './river-ridge.ts';

export const mountainPassProse: FieldProse = {
  id: 'mountain-pass',
  title: 'Mountain Pass',
  subtitle: 'the ambush ground',

  intro: `Mountain Pass is the field the Academy keeps for the cadet who
has learned to fight on level terms and must now learn to fight on
*unfair* ones. It carries no water and almost no flat ground — only a
broad valley basin in the north-west, a low pass winding south-east, and
two walls of rock that hem the pass into a defile. Most of the field is a
climb, and the side that holds the high ground holds the engagement. This
is the field on which a cadet learns what the high terraces of River
Ridge only hinted at: that ground is *cover*, and that an ambush is
terrain before it is tactics.`,

  terrainSections: [
    {
      title: 'The Valley Basin',
      body: `The north-west quarter falls away into a broad, low basin —
the one stretch of open footing the field offers, and the lowest ground
on it. A team set down here has room to form and to move, and nothing
above it but sky and the heights it must eventually climb. It is the
honest ground of the field, and on this field honest ground is exposed
ground: everything that overlooks the basin overlooks it from cover the
basin cannot answer.`,
    },
    {
      title: 'The Pass',
      body: `From the basin a low spine of ground threads south-east — a
ribbon of tiles at elevations two and three that is the only gentle
footing through the field's centre. It is the road, and like all roads
through mountains it is watched. To either side the ground rises sharply;
a cadet on the pass floor is a cadet in a trough, in range of both walls
and seen by both. Quick to cross, and costly to be caught upon.`,
    },
    {
      title: 'The Heights',
      body: `Two masses of rock define the south-east. The *south-west
massif* rises to elevations seven through ten, a wall along the lower
flank of the defile; the *north-east ridge* climbs higher still to a
single peak at eleven, the highest tile the Academy fields. Between them
runs the defile — the pass's narrow throat. From either height a cadet
reads the whole pass and the basin beyond, shoots over ground that blinds
the cadets below, and looks down on a fall of five elevations or more. The
heights are the field; everything else is the approach to them.`,
    },
  ],

  zoneSections: [
    {
      title: 'The Valley Deployment',
      body: `One side — the *victim* of the ambush, in the field's own
framing — deploys as a single block out in the north-west valley. It
begins with room and position and no height at all, and its whole opening
problem is to reach ground worth holding before the other side's
advantage tells.`,
    },
    {
      title: 'The Split Ambush',
      body: `The other side does not deploy as a block. Mountain Pass is
the first field to *split* a side's deployment into two separate seats,
each with its own cap: up to **three** cadets on the south-west massif,
and up to **two** on the north-east edge — set down on both flanks of the
defile, looking down on the pass the other side must cross. When a
sub-zone fills, its remaining tiles dim and stop accepting cadets; place
the rest in the other seat. The arithmetic of the split — three on one
wall, two on the other — is the ambush's whole shape: a crossfire, not a
line.`,
    },
  ],

  knockback: `The heights make knockback the field's sharpest instrument.
A shove off the south-west massif drops a target five elevations or more
into the defile; a shove from the north-east peak is greater still. The
defile floor is a trough between two walls, which is to say a place a
shoved cadet has nowhere to land softly. A team that has seized a height
and carries a knockback effect should read every enemy on the pass below
as a question of whether anything else it could do that turn matters.

The same lesson cuts both ways: a cadet who climbs to a seat on the rock
and stands at its lip has volunteered for the fall. Hold the height a tile
back from the edge.`,

  counsel: `Three things to read, in this order. *First*, the heights are
everything — line of sight on this field is terrain before it is anything
else, and the side on the high rock both sees over the ground that blinds
the valley and shoots down it with the elevation in its favour. If you
deploy in the valley, your opening question is which height you can
contest before the crossfire opens; if you deploy on the rock, it is how
to make the pass uncrossable.

*Second*, the pass is a trap as much as a road. It is the quick way
through and the seen way through at once. Cross it in a rush, under cover
of your own threats, or do not commit to it until the heights are settled.

*Third*, the split ambush is a crossfire by design — two flanks, not one
front. The valley side that lets both ambush seats fire on the same turn
has lost the reading; the ambush side that lets the victim engage its two
groups one at a time has wasted the position. Whichever side you hold,
the field is decided by the heights and the angles between them.`,

  legend: [
    ['#c9b88a', 'the pass floor (elev 2–3)'],
    ['#ad9760', 'valley basin (4)'],
    ['#9e864c', 'rising slope (5)'],
    ['#7e6629', 'the heights — rock (7)'],
    ['#594814', 'massif & NE peak (9+)'],
  ],
};
