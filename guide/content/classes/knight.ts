// Knight — the instructor's hand-authored prose for the Specialization
// spread. Mechanical values (stats, costs, ranges, effects) are NOT
// authored here; they flow in from ../src/content at build time. This
// file holds only the voice.
//
// Ability-note keys must match the ability ids the catalog resolves for
// the Knight: attack, power_attack, lightning_stab, bull_rush (actives);
// counter, martial_expertise, bravestrider (passives). (S42 swapped
// Stasis Sword's Stop rider for Lightning Stab's Silence rider — the
// Stop tool moved to the Assassin's Shadow Stitch. S41 swapped the
// Knight's free Support/Movement: Damage Reduction → Martial Expertise
// (PA ×1.25) and Move +1 → Bravestrider (+1 Move, +10 Brave). S65
// (ADR-0108) suppressed Taunt and added Bull Rush, and moved the Battle
// Skill riders to PA-scaling: Lightning Stab's Silence and Bull Rush's
// knockback both roll on the Knight's PA now, not her MA, and land the
// more reliably for it.)

import type { ClassProse } from '../prose.ts';

export const knightProse: ClassProse = {
  tagline: 'Armoured melee — the line that holds, and the team that holds behind it.',

  brief: `The Knight is the first specialization most cadets meet, and for
good reason: it asks the field a single, honest question, and answers it
with its body. Where the Mage bends the engagement from a distance, the
Knight *occupies* it. She stands where the line must hold, and the line
holds because she stands there.

Do not mistake this for a want of subtlety. A Knight who has learned her
craft reads ground and facing as keenly as any caster reads the elemental
wheel — she knows which tile turns an exchange, which approach denies a
flank, when to spend a step and when to keep it. One discovers, in time,
that her value compounds the longer she remains on the field. Cadets who
treat the Knight as a blunt instrument tend to lose her early; cadets who
treat her as an anchor tend to win the engagements that matter.`,

  abilityNotes: {
    attack: {
      full: `Every cadet begins here. The Knight's basic strike asks nothing
of her reserves and rolls to land like any honest blow — what distinguishes
it is the weight of arm and armour behind it. Do not disdain a thing for
being freely given.`,
      compact: 'Free and reliable; carries the Knight’s full weight. Never beneath her.',
    },
    power_attack: {
      full: `Power Attack trades a measure of magical reserve for half again
the force of a basic strike. One spends it when the opening is real — a
wounded foe, an exposed flank — and not before. The reserve is finite; the
opening is not always.`,
      compact: 'Heavier strike for a measure of MP. Spend it on a real opening, not a hopeful one.',
    },
    lightning_stab: {
      full: `Here the Knight's hybrid character shows itself: a true physical
strike that may leave the target *Silenced* — its art sealed for a span.
The seal rolls on her *Physical Attack*, the highest stat she owns, so it
lands far more often than a caster's trick would — roughly half her blows,
where once it was a third. The Knight's answer to an enemy mage, and the
plainest proof she is not merely a wall.`,
      compact: 'Physical strike with a good chance to Silence the target — the seal scales on her PA. The Knight’s answer to a caster.',
    },
    bull_rush: {
      full: `A weapon strike that asks no extra damage and offers something
better: a high chance, on a hit, to *shove the target back a tile* — off a
ledge, out of a Pit, into a Valley, or simply clear of the line she meant
to hold. The shove rolls on the Knight's Physical Attack and Brave, and a
high-Brave target plants her feet against it; but on most enemies it is
the Knight's quiet hand on the shape of the field.`,
      compact: 'A normal-damage strike with a high chance to knock the target back one tile. Shove a foe off a ledge or into a hazard.',
    },
    counter: {
      full: `A reaction: when a physical blow finds the Knight, she answers it
in kind, unbidden. The cadet does not spend a turn on Counter — she spends a
Reaction slot, once, and is repaid every engagement thereafter. It is, in
this instructor's view, the most economical thing in her repertoire.`,
      compact: 'Answers physical blows automatically. One slot spent; repaid all engagement long.',
    },
    martial_expertise: {
      full: `The Knight's quiet engine: Martial Expertise lifts her Physical
Attack by a quarter, outright. It does nothing one can point to in a single
moment and everything across an engagement — every strike she throws, every
Counter she answers with, lands the heavier for it. The cadet who gives her
Support slot to this has multiplied the whole of her offence at a stroke.`,
      compact: 'Support: Physical Attack ×1.25. A flat lift to everything her arm does — strikes and Counters alike.',
    },
    bravestrider: {
      full: `One further tile of Move Range, and ten points of Brave besides.
The Move keeps the Knight in the engagement on uneven ground; the Brave
steadies the reactions Brave governs and stiffens her own footing against a
Bull Rush in turn. For the surer Silence and the harder shove she now
stacks *Physical Attack* instead — but the resolve Bravestrider lends is
never wasted on her.`,
      compact: '+1 Move Range and +10 Brave. Keeps her in the fight and firms the reactions Brave governs (her Battle Skill riders now scale on PA).',
    },
  },

  strategy: `The Knight rewards patience and punishes haste — a sentence the
cadet will hear this instructor repeat. Her worth compounds: the longer she
stands, the more Counter has answered, the more her armour has quietly
turned aside, the more a well-placed Bull Rush has spoiled an enemy's
footing or fed her a fall. A Knight thrown forward alone is a Knight wasted;
a Knight placed where the line must hold is worth two of anything else on
the field.

Build her, then, for endurance and for presence. Where the requisitioning
cadet has a choice, this instructor favours the gear that lets the Knight be
*somewhere* — Move, Jump, the reach to arrive — over gear that sharpens a
blow she was always going to land. The damage is not the point. The standing
is the point.`,

  marginalia: [
    'Cadets always overspend Power Attack in their first term. Always. — note for next year.',
    'Bull Rush is a shove, not a kill. The cadet who learns to read a ledge gets twice the use of it.',
    'See the River Ridge exercise — the one with the ford. The Knight who waited won it.',
    'The standing is the point. Underline that.',
  ],
};
