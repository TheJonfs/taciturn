// Monk — the instructor's hand-authored prose for the Specialization
// spread. Mechanical values flow in from ../src/content at build time;
// this file holds only the voice.
//
// Ability-note keys match the ids the catalog resolves for the Monk:
// chakra, foxfire, bears_heave, storm_stoop, serpents_coil (actives, the
// Martial Arts command set); counterpunch (reaction), barehanded
// (support), vigilance (movement). Attack is omitted by convention — the
// punch's PA² is explained in the Barehanded note, saving a recto slot.
//
// The Monk is the Academy's fourteenth discipline and its sixth physical.
// A barehanded, PA-scaling, stance-dancing martial artist: HP 190 / MP 26
// / PA 9 / MA 4 / Speed 10, evasion 11/8/3 (the roster's highest). Gear:
// head and accessory ONLY — no body, no off-hand, no weapon.
//
// NOTE (fit): as dense as the Enchanter — intro block, five actives,
// three passives. Notes held tight to keep the recto on two pages; budget
// a trim before adding.

import type { ClassProse } from '../prose.ts';

export const monkProse: ClassProse = {
  tagline: 'The empty hand — her own armoury, and her own undoing.',

  brief: `The Monk wears no armour worth the name and carries no weapon: a
head, a trinket, and her own two hands are the whole of her kit.
Everything she does runs off one stat — Physical Attack drives her
damage, her evasion, and her counterblow alike — and everything she
withstands, she withstands by *not being hit*.

So read her as a near-perfect counter to the blade and a glass jaw to the
spell. Her bare punch is the heaviest single blow the Academy fields and
has no ceiling — but it leaves her in no stance, and her only shield
against the elements *is* her stance. The whole discipline is that trade:
raw force with the body open, or a measured strike behind an elemental
guard.`,

  commandSetIntro: {
    name: 'Martial Arts',
    facts: 'First Action · Chakra + four Fists · stances are mutually exclusive',
    full: `A heal and four elemental strikes. Each *Fist* deals PA-scaled
damage of its element and leaves her in a *stance* — one element resisted
(+50) and its opposite worsened (−50) — with a rider besides. The stances
do not stack: a new Fist replaces the last, *Chakra* clears it, and the
bare punch sets none. Her guard against the elements is whichever stance
she last struck in.`,
  },

  abilityNotes: {
    chakra: {
      full: `Her sustain: it heals HP *and* restores MP, for herself and
all in a one-square diamond, scaled on PA and free of MP and Faith. The
catch — it clears her stance to neutral, so the turn she mends, her
elemental guard falls away. Friendly fire applies.`,
      compact: 'Self + area heal-and-MP-restore (PA-scaled, no Faith, MP-free). Clears her stance — mend and you expose yourself. Friendly fire.',
    },
    foxfire: {
      full: `A fire strike that leaves her in *Fox Stance* — fire warded,
earth worsened — with a fair chance of setting the target Burning. The
footing for pressing the attack.`,
      compact: 'Melee fire (PA-scaled); sets Fox Stance (+Fire/−Earth); ~half chance to Burn.',
    },
    bears_heave: {
      full: `*Bear Stance* — earth warded, lightning worsened — and a
*grapple-throw*: she seizes an adjacent unit, friend or foe, and sets it
on any tile within two. No direct damage, but a unit thrown off a ledge
takes the fall *unmitigated*. Hurl a foe onto a hazard, or lift an ally
clear.`,
      compact: 'Sets Bear Stance (+Earth/−Lightning); grapple-throws an adjacent unit (friend or foe) up to 2 tiles. No direct damage; a ledge drop deals unmitigated fall damage.',
    },
    storm_stoop: {
      full: `A three-tile line of lightning, leaving her in *Falcon
Stance* — lightning warded, water worsened. Her one strike with reach,
for when the fight will not come to her fists.`,
      compact: 'Straight-line lightning, reach 3 (PA-scaled); sets Falcon Stance (+Lightning/−Water). Her only ranged option.',
    },
    serpents_coil: {
      full: `A water strike leaving her in *Serpent Stance* — water warded,
fire worsened — that refunds CT on a hit, so her next turn comes sooner.
The footing that buys tempo.`,
      compact: 'Melee water (PA-scaled); sets Serpent Stance (+Water/−Fire); refunds CT on a hit — her next turn comes sooner.',
    },
    counterpunch: {
      full: `When a *physical* blow lands on her from an adjacent foe, she
answers for PA × 4, with a chance to knock the attacker back. A ranged
shot or a spell draws nothing — only the foe who closes pays.`,
      compact: 'Reaction: an adjacent physical hit draws a PA×4 counter + a knockback chance. Ranged and magic don’t trigger it. Brave-gated.',
    },
    barehanded: {
      full: `While both hands are empty her Weapon Power becomes her
*Physical Attack*, so the basic punch lands for PA² — her heaviest blow,
uncapped. But the punch sets no stance: the harder she leans on it, the
barer she stands to the elements. The Fists never gain the square — the
punch alone is the quadratic.`,
      compact: 'Support: empty hands → Weapon Power = PA, so the basic punch hits for PA² (uncapped). The punch sets no stance — raw damage, bare skin. Fists stay PA-linear.',
    },
    vigilance: {
      full: `Lifts her evasion on *every* facing — the back included — by
half her PA. Atop the roster's highest base evasion, she becomes the
hardest cadet to land a blade on, and a flank earns no free hit.`,
      compact: 'Movement: +½ PA evasion on all facings, the back included. Anti-flank; atop the roster’s best base evasion.',
    },
  },

  strategy: `Build her around the one stat: stack Physical Attack (a
Gauntlet of Might, a borrowed Martial Expertise) and punch, counter,
evasion, and heal all rise together. She has no body slot, so her head
and accessory are her only gear — spend the head on resistance to shore
the magic weakness she cannot otherwise answer.

Then play the trade. Open in a Fist's stance for the elemental guard, and
spend the bare PA² punch only when you can afford the exposure or the
target will not live to punish it; Chakra to sustain, knowing it strips
your stance. And mind her one true enemy, the mage: she eats physical
attackers alive — feed her their charge, and let Counterpunch bill them —
but against magic she has no defence save to dodge, to kill the caster,
or to throw a teammate's problem off a ledge with Bear's Heave.`,

  marginalia: [
    'No body, no blade, no shield — a head and a trinket are the whole kit. PA is the rest.',
    'The punch is PA² and uncapped; it is also stance-less. Raw force and a bare skin are the same choice.',
    'She eats the blade and starves on the spell. A mage across the field is the one fight she cannot simply dodge.',
    'Bear’s Heave throws friend or foe. A ledge does the killing the empty hand won’t.',
  ],
};
