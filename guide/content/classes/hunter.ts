// Hunter — the instructor's hand-authored prose for the Specialization
// spread. Mechanical values flow in from ../src/content at build time;
// this file holds only the voice.
//
// Ability-note keys match the ids the catalog resolves for the Hunter:
// attack, pin_down, charged_attack, scramble (actives, the Marksmanship
// command set); updraft (reaction), eagle_eye and vantage (support),
// high_jump (movement).
//
// The Hunter is the Academy's eighth discipline and its fourth
// non-caster — the addition that balances the roster at four physical
// and four magical. A ranged-instant-damage skirmisher built around the
// bow weapon class: shoots any elevation (the bow's vertical 99),
// rewards the high ground (height-delta variance, now sharpened by
// Vantage), and depends on Eagle Eye to convert the bow's thin 40%
// baseline accuracy into hits.

import type { ClassProse } from '../prose.ts';

export const hunterProse: ClassProse = {
  tagline: 'Altitude and the long shot — the cadet who picks her tile and waits.',

  brief: `The Hunter is the Academy's eighth specialization, and the
discipline that brings its roster into balance: four physical
disciplines, four magical, the Hunter rounding out the first. Her art
is the long shot taken from the high ground. She arrives second to no
perch, draws on her bow, and answers the field at a range and from a
height most cadets cannot reach. She is no front-liner — her health is
unremarkable, her arm light — but on the right tile, with the right
shot, she is the engagement.

Two facts shape the discipline. First, the bow misses without help:
every bow the Armory issues lands fewer than half its shots unaided,
and it is *Eagle Eye*, her free Support, that lifts the strike to land.
The cadet who fails to equip it has misunderstood her kit. Second, the
bow rewards *height*: every elevation she stands above her target adds
to the damage, and every level she stands below cuts it — and *Vantage*
lets her aim from a height she has not climbed. Climb. Shoot. Pin.
Climb again.`,

  abilityNotes: {
    attack: {
      full: `The Hunter's basic strike, with a bow in hand, is her bread
and her honest answer — and at a range a melee cadet cannot reach to
interrupt. With Eagle Eye to lift its accuracy and the right ground
beneath her, the simple bow shot is, in practice, most of the
engagement.`,
      compact: 'A ranged bow shot. With Eagle Eye and the right elevation, it carries most engagements.',
    },
    pin_down: {
      full: `*Pin Down* lays Slow on a target at range, free of MP, on a
roll weighted by the Hunter's Brave and Speed rather than spell-craft.
Cheap, reliable, and her standing answer to the foe she most needs to
keep at the edge of the field. It is a *bow* attack through and through:
it takes its reach from the bow in her hand, so it cannot touch a cadet
right beside her — and, like any bow shot, it reaches *farther* loosed
from the high ground.`,
      compact: 'Ranged, free Slow, carried on the bow — so it cannot reach an adjacent foe, and it reaches farther shot from above.',
    },
    charged_attack: {
      full: `*Charged Attack* is the aimed shot — a charged bow strike at
twice an ordinary draw's force, the heaviest single shot in her quiver
and, from the perch, devastating. It commits to a *tile*, not a unit:
it strikes whoever stands there when it lands, so a target who steps
off before it resolves escapes it clean. Lead the mark, or loose it
when she is pinned.`,
      compact: 'Charged bow shot at ×2 damage, aimed at a tile — a target who steps off before it lands escapes. Lead them, or fire when they’re pinned.',
    },
    scramble: {
      full: `A short hop — one tile across, but as much as five tiles
*up* — taken as an action rather than a turn. *Scramble* exists for one
purpose: putting the Hunter on the perch she could not reach by
walking. It is the discipline's quiet admission that her real defence
is altitude, and her real movement skill is *getting* there.`,
      compact: 'Self-move: 1 horizontal, up to 5 vertical. The hop onto the perch she could not walk to.',
    },
    updraft: {
      full: `A reaction. A blow that finds the Hunter teaches her
*Jump* — a lasting tile of vertical reach, accumulating across the
engagement. The discipline's quiet answer to being closed upon: hurt
her, and the next perch she takes is one tile higher.`,
      compact: 'Reaction: a damaging hit grants +1 Jump, lasting and accumulating. Each hit lifts her further out of reach.',
    },
    eagle_eye: {
      full: `The quiet engine of the discipline. *Eagle Eye* multiplies
the Hunter's outgoing hit chance, outright — and given the bows' thin
baseline accuracy that multiplier is not optional. It is what turns the
coin-flip into the connection. If the cadet equips one thing first,
this instructor would have it be this.`,
      compact: 'Support: doubles her outgoing hit chance. The thing that makes the bow land. Equip it first.',
    },
    high_jump: {
      full: `Two further tiles of Jump. The Hunter starts climbing at
three; with High Jump she is climbing at five, and there is little
terrain in the Academy's inventory she cannot reach. Bow plus altitude
is the discipline; this is half of it, granted freely.`,
      compact: 'Movement: +2 Jump. Atop a Hunter’s native climb, she reaches almost any terrain.',
    },
    vantage: {
      full: `Her second free Support, and the one that makes the high
ground *pay*. *Vantage* lets her aim as though she stood two tiles
higher than her feet — and only on her own shots. The downhill damage,
the high-ground accuracy, a bow's reach from elevation, the line drawn
over cover: each reads from the borrowed height, though her body never
leaves its tile. It is altitude lent to every arrow, and the surest
sign that this discipline's damage is a thing she *earns* by where she
draws from.`,
      compact: 'Support: her own attacks resolve as if two tiles higher — downhill damage, accuracy, reach, and the shot over cover. Borrowed altitude, on offence alone.',
    },
  },

  strategy: `The Hunter is played for *position* before damage. Equip
Eagle Eye in her Support slot before anything else — the bows do not
land without it — and treat every opening turn as a question of *where*.
Climb to the highest tile in line of sight, drop a Pin Down on whichever
foe most needs slowing, and from there shoot at the leisure her
altitude buys her.

Two things to keep, then. *Read the terrain first*: her whole kit
assumes the high ground, and a Hunter on the flat is playing the wrong
game — Scramble, High Jump, and Vantage all serve the same end. And
*guard her from below*: her front evade is modest and her back is none,
so a foe who closes ends her quickly. If the enemy commits a striker to
climb after her, she has already won the trade her teammates were
waiting to make.`,

  marginalia: [
    'No Eagle Eye, no bow. Write that down.',
    'The Longbow at five levels above the target is double damage. At five levels below it is zero. Climb.',
    'Scramble does not run — it leaps. One tile across, up to five tiles up. Plan accordingly.',
    'Updraft means every blow they land lifts her further away. Make them pay for reaching her.',
  ],
};
