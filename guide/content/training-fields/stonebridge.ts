// Stonebridge — the instructor's hand-authored prose for the Academy's
// second training field. Mechanical particulars (the elevation grid,
// rampart positions, terrain costs, deployment zones) flow in from
// ../src/content; this file holds only the voice. Bodies accept light
// markdown.

import type { FieldProse } from './river-ridge.ts';

export const stonebridgeProse: FieldProse = {
  id: 'stonebridge',
  title: 'Stonebridge',
  subtitle: 'the river crossing, the corner hills, the ruined keep',

  intro: `Stonebridge is the Academy's second standing training field,
and the cadet who has only ever exercised on River Ridge will read it
with surprise. Where the Ridge was a *balanced* piece of ground
bisected by a river, Stonebridge is a *crossing*: one ribbon of water
cuts the field north to south, a single stone bridge climbs across it,
two old hills hold the western corners, and a ruined keep with rampart
walls broods over the south-eastern quarter. The exercise asks the
cadet as much about *where* to cross as it does about *whom* to strike
when she does.`,

  terrainSections: [
    {
      title: 'The Bridge',
      body: `A stone span at columns six and seven, climbing from
elevation three at each bank to a peak of six in the centre. It is the
only piece of ground a cadet may cross between the deployment zones
without entering the water — and the cadet who reads the field will
see at once that whoever takes the central span first reads the
engagement first. The bridge's height also makes it a perch in its own
right: a Hunter on the centre of the span looks down at most of the
field, and a caster who climbs it shoots at her leisure.`,
    },
    {
      title: 'The River',
      body: `A north-south river runs across columns three through nine,
varying in depth as it crosses the field. Most of the channel is
shallow at the banks and deep at the centre — elevation zero at the
mid-stream — and the bridge's stone piers are the only land that
interrupts that deep channel.

A ground-bound cadet does not cross the deep water in a single turn;
the bridge is, for her, the only road. A Hydrologist with her
Tidewalker carries the same advantage she did on River Ridge: the
river is hers, and the bridge is one option among many.`,
    },
    {
      title: 'The Corner Hills',
      body: `Two old hills rise at the western corners — north-west and
south-west — to elevation eight, a single tile shy of River Ridge's
eastern perch. They are the cadet's natural Hunter's-roost: visible
from much of the field, defensible by the slope around them, and a
long shot from either to the centre. They sit, importantly, on a
cadet's *own* side of the river — whichever team holds the western
corner closer to their deployment owns a perch they reach without
crossing.`,
    },
    {
      title: 'The Keep',
      body: `The Academy's mason has set the ruins of a small keep at
the south-eastern quarter — walls of *rampart* at elevation eight,
enclosing a flat interior at elevation two on three sides, with one
single tile of opening on the western face: the gate. The keep is
therefore a defensive position from which a cadet may shoot, and the
only way in for a foe without High Jump or other vertical mobility is
through the one tile the gate offers. A cadet inside the keep is, for
many turns, a cadet only one foe can reach at a time.`,
    },
  ],

  zoneSections: [
    {
      title: 'The Bridge Charge',
      body: `The central pivot of the field. The cadet who reaches the
bridge's peak first reads the rest of the engagement from there — and
since the peak is a single tile, it is the discipline of getting there
that decides it. Move with the bridge in mind from the opening turn,
or accept that the other team will.`,
    },
    {
      title: 'The Keep Door',
      body: `A single tile on the keep's western face — the gate — is
the only ground entry. A cadet *inside* the keep with a ranged
discipline (a Hunter, a Mage) is very difficult to dislodge: an
attacker arrives one at a time and arrives within reach of every other
defender at once. The cadets who hold the keep first hold it for the
engagement.`,
    },
    {
      title: 'The Hill Roost',
      body: `Each team's near corner hill is a Hunter's natural seat —
elevation eight, reached without crossing the river, and a clean line
to the centre of the field. A cadet who climbs to her own corner first
controls a long sightline; a cadet who lets the enemy claim it has
ceded a shot the field will repeat.`,
    },
  ],

  knockback: `Stonebridge is, of all the Academy's exercises, the field
where knockback decides the most. Three falls in particular bear
study. *The bridge into the channel*: a foe shoved from the bridge's
peak — elevation six — into the deep water tiles flanking the piers
takes the full drop, and the deep water besides. *The corner hill into
the lower bank*: a cadet thrown off the elevation-eight perch lands as
much as five tiles below, depending on the angle. *The keep walls
into the courtyard*: an attacker thrown from the rampart's elevation
eight onto the interior elevation two takes a six-elevation fall, and
the cadet inside the keep is the one who threw her.

The cadet who has taken any of these high places should stand a tile
clear of the edge. The cadet who can reach an opponent on any such
edge with a knockback effect should consider, as the Master Armorer
would put it, whether anything else they could do that turn matters
at all.`,

  counsel: `Three readings, in this order. *First*, the bridge. The
moment the engagement opens, the question of who reaches the central
span first is most of the question of who controls the field's
crossing. A Knight or an Assassin who arrives at the peak with her
team gathered behind her has, in effect, narrowed the field by half.

*Second*, the keep. If a Hunter or a Mage on your team takes the
interior on the opening turns, the engagement bends around the gate
for as long as she remains there. If the *enemy* takes it, plan
either to siege through that single tile or to make the keep an
irrelevance — and the latter is, more often than not, the wiser
exercise.

*Third*, the corner hills. Each team's near corner is a free perch a
careless cadet leaves uncontested. Do not be the cadet who let it sit
empty for the enemy's Hunter to take.`,

  legend: [
    ['#234a55', 'deep water'],
    ['#5a8c95', 'shallow water'],
    ['#c9b88a', 'plain (elev 2)'],
    ['#bba775', 'low bank (3)'],
    ['#9e864c', 'bridge approach (5)'],
    ['#8e7639', 'bridge peak (6)'],
    ['#6c581d', 'corner hill (8)'],
    ['#7d756a', 'keep rampart'],
  ],
};
