// The Terraformer — the instructor's hand-authored prose for the tenth
// Specialization spread. Mechanical particulars (stats, ability costs,
// ranges) flow in from ../src/content; this file holds only the voice.
//
// Like the Calculator, the Terraformer's First Action is a *system*
// rather than a list — the Worldcraft command set reshapes the field
// instead of striking the cadets on it — so the spread leads with a
// commandSetIntro block that explains the effect queue and its revert
// before the five terrain works it governs. See content/prose.ts for
// the field's shape.
//
// Prose tightened (S55 fit pass): the recto was spilling onto a third
// page, so the brief, the Worldcraft intro, every ability note, and the
// strategy were cut to the Calculator's density (~25-30 words a note).

import type { ClassProse } from '../prose.ts';

export const terraformerProse: ClassProse = {
  tagline: 'The battlefield-shaper — she fights the ground itself, and lets the ground fight the cadet.',

  brief: `The Terraformer is the strangest discipline in the Academy's
catalogue, and the one that thinks least about her opponent and most
about the ground he stands on. She deals almost no direct damage;
instead she *remakes the field* — a wall where a lane was open, a pit
beneath an advancing foe, a line of barriers across a crossing. Her
foes do not so much lose to her as find the ground turned against them.

She is, uniquely, a *hybrid*: Physical and Magical Attack both matter,
for a Barrier's strength is the product of the two. Read her as the
engineer of the engagement — slow, deliberate, and most dangerous to
the cadet who does not notice what she is building until she stands in
it.`,

  abilityNotes: {
    // Worldcraft abilities — each keyed by ability id.
    pillar: {
      full: `The point-raise: one tile lifted four elevations. The rise
harms no one — but a foe atop the pillar rides it back down when it
reverts, and takes the fall. The cheapest wall, perch, or delayed trap
in the kit.`,
      compact: `Raise one tile +4. No harm on the rise; the fall comes on the revert.`,
    },
    pit: {
      full: `The point-drop: one tile sunk four elevations, the fall paid
*at once* — the deepest immediate harm in the set. The revert raises it
gently and costs nothing; with Pit, the damage is all in the casting.`,
      compact: `Lower one tile −4; the occupant takes the fall immediately.`,
    },
    hill: {
      full: `The area-raise: a three-by-three rise, steepest at the
centre. Like the Pillar it harms no one as it lifts — but its revert
drops the centre three elevations and the edges two. A clustered line
caught atop a reverting Hill is the discipline at its most theatrical.`,
      compact: `3×3 raise (centre +3, edges +2, corners +1). The fall waits for the revert.`,
    },
    valley: {
      full: `The area-drop: the Hill inverted, paying its fall at the
moment of casting — centre deepest, corners barely at all. It spares
neither friend nor foe; a careless Valley drops your own line as readily
as the enemy's. Read the ground before you sink it.`,
      compact: `3×3 lower (centre −3, edges −2, corners −1); immediate fall, friendly fire included.`,
    },
    barrier: {
      full: `The pure-control work: a wall of three to five barriers,
each impassable and blind to sight, raised without touching elevation.
Their strength is the *product* of her two attacks — the reason her
line is hybrid — and they stand until broken or spent.`,
      compact: `A line of 3–5 barriers; HP scales on PA × MA. Blocks movement and sight until broken.`,
    },

    // Free R/S/M passives — keyed by ability id.
    damage_split: {
      full: `The signature Reaction: survive a blow, and she returns the
*full* measure to her attacker and mends herself for half. Unlike
Counter, it scales with whatever struck her — the harder the hit, the
harsher the answer.`,
      compact: `On surviving a hit: reflect the full damage back, heal half. Scales with the blow.`,
    },
    ignore_height: {
      full: `The Movement passive that makes the kit cohere: she steps
between tiles of any elevation as though the gap were nothing,
untroubled by the Jump that binds every other cadet. The discipline
that makes the ground vertical climbs it without thought.`,
      compact: `Step across any elevation gap, ignoring Jump entirely.`,
    },
    expert_former: {
      full: `Lifts the works she may hold at once from two to four —
twice as much field shaped before the oldest reverts. For a cadet who
lives by what she has built, very nearly mandatory; and useless to
anyone without the Worldcraft to spend it on.`,
      compact: `Raises the Worldcraft effect cap from 2 to 4. Near-mandatory; useless off the discipline.`,
    },
  },

  commandSetIntro: {
    name: 'Worldcraft',
    facts: 'Tile-targeted · range 4 · instant cast · the cap reverts the oldest work',
    full: `The Terraformer's First Action is not a strike but a *work*.
Each of the five is cast in an instant and reshapes the ground rather
than the cadet — but she holds only so many at once: *two* by default,
*four* with Expert Former. Exceed the cap and the oldest reverts, and
the revert is the whole art: a raised tile drops whoever rides it when
it falls; a sunken tile pays its fall at once. Plan which work reverts,
and when.`,
  },

  strategy: `The Terraformer rewards forethought above any discipline
the Academy keeps, because she alone has her own past turns come back
to act on the field. The effect cap is not a limit to resent but a
lever to play: a Pillar raised under a foe is a fall *banked* for the
turn it reverts — and a cadet who fills her cap without minding the
order of reversion drops her own line at the worst moment.

Pit and Valley deal their harm at once and want a clustered, low-Brave
enemy; Pillar and Hill bank it for the revert and want patience;
Barrier asks only her two attacks, so a Battle Dictionary's Physical
Attack is not wasted on her. She does not win by killing the cadet. She
wins by deciding where the cadet may stand.`,

  marginalia: [
    `The first hybrid — PA *and* MA both matter, because a Barrier's strength is their product.`,
    `Off the elemental wheel, like the Calculator. No element resists her; she casts none.`,
    `Fragile from behind — back evade is nil. Keep her own walls between her and the field.`,
    `She does not race the engagement. She rebuilds the ground it is fought on.`,
  ],
};
