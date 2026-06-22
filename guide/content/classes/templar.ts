// The Templar — the instructor's hand-authored prose for the eleventh
// Specialization spread (S62). A hybrid holy knight of the Glabados
// Church: White-Mage healing and revival joined to the Dragoon's
// off-field leap. Mechanical particulars (stats, ability costs, ranges)
// flow in from ../src/content; this file holds only the voice.
//
// Like the Calculator and the Terraformer, the Templar's First Action
// is a small, themed *kit* rather than a long spell list — three
// Templar Arts (Cure, Raise, Jump) — so the spread leads with a
// commandSetIntro block framing the kit before the three works, which
// also balances the column against the Templar's four innate passives.
// Attack is omitted (no authored note → the template skips it): the
// Templar fights through Jump, which carries the weapon story (PA × WP,
// doubled with a Lance), so the bare strike is a footnote.
//
// Ability-note keys: cure, raise, jump (Templar Arts); emissary,
// monkeygrip, unified_calling, faithstrider (the four innate passives).

import type { ClassProse } from '../prose.ts';

export const templarProse: ClassProse = {
  tagline: 'The holy knight — mender, reviver, and the leap that falls from the sky.',

  brief: `The Templar is the Academy's one true *hybrid of the spirit*:
a knight of the Glabados Church who mends and revives as a White Mage
does, and who answers a distant foe with the Dragoon's leap. She is
slow and middling in both her attacks — neither the Knight's arm nor a
Mage's art — but she endures, she heals, and she carries the only
revival the Academy fields without a thrown Phoenix Down.

She is the *second* discipline cleared for Knight steel — head, body,
and shield alike — and the first whose guard does not fail entirely at
her back. Read her as the team's anchor of last resort: the cadet who
keeps the line standing, brings the fallen back, and, when the moment
asks, vaults off the field to come down on a foe who thought herself
out of reach.`,

  abilityNotes: {
    cure: {
      full: `A charged heal dropped as a small diamond — five tiles of
mending at its base, scaled on Magical Attack and Faith, and widened to
a full diamond under Aether Bloom. It does not ask whose side a cadet is
on: it heals allies, the caster herself, *and* any enemy caught in it.
Quick to land, so placement is the whole skill.`,
      compact: 'Charged diamond heal (MA × Faith), widening under Aether Bloom. Heals friend, foe, and self alike — place it well.',
    },
    raise: {
      full: `The Academy's only standing revival short of a thrown
Phoenix Down — and, like the Phoenix Down, it answers *only* a cadet
already down: it brings a KO'd ally back and mends them in the same
breath, scaled higher than Cure. It will not heal the living; for that,
Cure. A single Raise can undo the turn the enemy thought had settled the
engagement.`,
      compact: 'Charged revive: brings back a KO’d ally and heals them. KO-only — use Cure for the living. The Academy’s lone revival spell.',
    },
    jump: {
      full: `The Dragoon's leap: the Templar vaults clear off the field —
*untargetable* while she is airborne — then falls on a chosen tile for
Physical Attack times weapon, *doubled* with a Lance in hand. It
reaches far and high, striking perched foes melee cannot. The mark may
dodge by leaving the tile; the higher her Speed, the less time she
gives them to. Committing the leap spends her Move for the turn — she
cannot Jump and also walk.`,
      compact: 'Off-field leap: untargetable while airborne, then PA × WP on a tile (×2 with a Lance). Dodgeable by moving. Spends the turn’s Move.',
    },
    emissary: {
      full: `All the mending she works lands a quarter heavier — her
spells *and* any healing item she throws, a Potion or a Phoenix Down
alike. It compounds with Faith and Magical Attack rather than merely
adding, so an invested healer notices it on every cast. Regen alone is
untouched.`,
      compact: 'Support: +25% to all healing she applies (spells and thrown items; not Regen). Compounds with Faith and MA.',
    },
    monkeygrip: {
      full: `The grip that bends the rules: a two-handed weapon held in
one hand, freeing the off-hand for a shield or a second weapon. It
makes the loadout *legal*, no more — a second attack still wants Two
Weapons — but it is what pairs a Defender's aura, or a Lance, with a
guard.`,
      compact: 'Support: two-handed weapons held one-handed, freeing the off-hand. Legality only; a second swing wants Two Weapons.',
    },
    unified_calling: {
      full: `A reaction to being mended: every one-time heal she
receives — a spell, or a Potion or Phoenix Down used on her — returns
her Magical reserve a measure equal to her Physical Attack. On a
Templar who heals herself, the mending pays toward the next cast. Regen
does not trigger it.`,
      compact: 'Reaction: a one-time heal received refunds MP equal to her PA. Self-healing funds the next cast. Not Regen.',
    },
    faithstrider: {
      full: `A tile of Move and ten points of Faith. The Move lifts her
from the slow-caster's two to a serviceable three; the Faith cuts
*both* ways — it sharpens her own healing and revival, and it opens her
wider to enemy magic. Innate to the Templar, so her Move reads three on
the field though the band below counts her base.`,
      compact: '+1 Move, +10 Faith. The Faith sharpens her healing and deepens her wounds both. Innate (Move 3 in play).',
    },
  },

  commandSetIntro: {
    name: 'Templar Arts',
    facts: 'First Action · heal · revive · the off-field leap',
    full: `The Templar's First Action is a kit of three, and no two are
alike: *Cure*, the cross-shaped heal that spares neither friend nor
foe; *Raise*, the Academy's lone revival spell; and *Jump*, the
Dragoon's leap that carries her off the board and down onto a distant
mark. Healer and skirmisher in one command — which she leads with is
the engagement's question, asked fresh each turn.`,
  },

  strategy: `Emissary of Murond is the Support slot's natural tenant —
a free quarter atop every heal she works — though a Templar built to
hold the line may prefer *Monkeygrip*, which pairs a Defender's
damage-halving aura, or a Lance, with a Knight shield. Either way she
is the team's anchor: heal the cluster with Cure, hold *Raise* for the
ally the enemy has spent a turn to fell, and Jump when a foe has
strayed within the leap's long reach.

Faith is her lever. Faithstrider and Faith-heavy gear compound her
mending and her revival — but the same Faith deepens every magical
wound she takes, so a high-Faith Templar wants the Knight plate her
access permits. She does not out-damage a striker or out-heal a
dedicated Mage. She does both, endures, and is still standing to do
them again.`,

  marginalia: [
    `The second cadet cleared for Knight steel — head, body, and shield. Only the Knight came first.`,
    `A guard at her back: back evade two, where every other discipline has none at all.`,
    `Faith cuts both ways. It mends harder and it wounds deeper. Mind the second half.`,
    `A Lance in hand, and the leap lands at twice the weight.`,
  ],
};
