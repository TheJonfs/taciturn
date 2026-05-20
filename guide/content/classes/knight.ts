// Knight — the instructor's hand-authored prose for the Specialization
// spread. Mechanical values (stats, costs, ranges, effects) are NOT
// authored here; they flow in from ../src/content at build time. This
// file holds only the voice.
//
// Ability-note keys must match the ability ids the catalog resolves for
// the Knight: attack, power_attack, lightning_stab, taunt (actives);
// counter, martial_expertise, bravestrider (passives). (S42 swapped
// Stasis Sword's Stop rider for Lightning Stab's Silence rider — the
// Stop tool moved to the Assassin's Shadow Stitch. S41 swapped the
// Knight's free Support/Movement: Damage Reduction → Martial Expertise
// (PA ×1.25) and Move +1 → Bravestrider (+1 Move, +10 Brave).)

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
strike that may, on a roll weighted by the cadet's own resolve, leave the
target *Silenced* — its art sealed, its spells stopped in its throat for a
span. It is the Knight's answer to an enemy caster, and the Academy's
plainest proof that she is not merely a wall. A Bravestrider Knight lands
the seal the more reliably for her lifted Brave.`,
      compact: 'Physical strike with a chance to Silence the target. The Knight’s answer to a caster.',
    },
    taunt: {
      full: `Taunt fixes a foe's attention upon the Knight whether that foe
wills it or no — the rare instruction that simply takes hold. Used well, it
is mercy for a fragile ally and a trap for an overcommitted enemy. Used
poorly, it is merely an invitation to a beating one was not ready to absorb.`,
      compact: 'Forces a foe to fix on the Knight — no roll, it lands. Time it for an ally’s sake.',
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
The Move keeps the Knight in the engagement on uneven ground; the Brave is
the quieter gift — it steadies the reactions Brave governs and lends weight
to the Brave-scaled strokes of her Battle Skill, Lightning Stab's Silence
chief among them. Mobility and resolve, carried in a single bearing.`,
      compact: '+1 Move Range and +10 Brave. Keeps her in the fight, and firms the reactions and rolls Brave governs.',
    },
  },

  strategy: `The Knight rewards patience and punishes haste — a sentence the
cadet will hear this instructor repeat. Her worth compounds: the longer she
stands, the more Counter has answered, the more her armour has quietly
turned aside, the more a well-timed Taunt has bent the engagement around
her. A Knight thrown forward alone is a Knight wasted; a Knight placed where
the line must hold is worth two of anything else on the field.

Build her, then, for endurance and for presence. Where the requisitioning
cadet has a choice, this instructor favours the gear that lets the Knight be
*somewhere* — Move, Jump, the reach to arrive — over gear that sharpens a
blow she was always going to land. The damage is not the point. The standing
is the point.`,

  marginalia: [
    'Cadets always overspend Power Attack in their first term. Always. — note for next year.',
    'Taunt is not a dare. Stop treating it as a dare.',
    'See the River Ridge exercise — the one with the ford. The Knight who waited won it.',
    'The standing is the point. Underline that.',
  ],
};
