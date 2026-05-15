// Knight — the instructor's hand-authored prose for the Specialization
// spread. Mechanical values (stats, costs, ranges, effects) are NOT
// authored here; they flow in from ../src/content at build time. This
// file holds only the voice.
//
// Ability-note keys must match the ability ids the catalog resolves for
// the Knight: attack, power_attack, stasis_sword, taunt (actives);
// counter, damage_reduction, move_plus_1 (passives).

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
    stasis_sword: {
      full: `Here the Knight's hybrid character shows itself: a true physical
strike that may, on a roll weighted by the cadet's own resolve, leave the
target Stopped — lifted clean out of the turn order for a span. It is the
Academy's plainest proof that the Knight is not merely a wall.`,
      compact: 'Physical strike with a chance to Stop the target. The Knight’s tempo tool.',
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
    damage_reduction: {
      full: `A quiet passive that pares a measure from every physical blow the
Knight suffers. It does nothing one can point to in a given moment, and
everything across a long engagement. The cadets who undervalue it are, as a
rule, the cadets who do not last.`,
      compact: 'Pares incoming physical damage. Invisible in the moment, decisive over time.',
    },
    move_plus_1: {
      full: `One further tile of Move Range. It sounds a small thing, and on
the practice yard it is. On uneven ground, against a foe who would rather
keep his distance, that single tile is frequently the difference between a
Knight in the engagement and a Knight watching it.`,
      compact: '+1 Move Range. Small on flat ground; often decisive on real terrain.',
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
