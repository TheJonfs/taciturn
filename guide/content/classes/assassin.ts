// Assassin — the instructor's hand-authored prose for the Specialization
// spread. Mechanical values flow in from ../src/content at build time;
// this file holds only the voice.
//
// Ability-note keys match the ids the catalog resolves for the Assassin:
// attack, shadow_stitch, blowdart, undermine, sow_doubt (actives, the
// Shadow Arts command set); speed_save (reaction), two_weapons (support),
// fleet_of_foot (movement).
//
// The Assassin is the Academy's seventh discipline and its third
// non-caster (after the Knight and the Alchemist). A Speed-defined glass
// cannon: the fastest and most mobile profile in v1, the lightest arm,
// and a back evade of zero. Her identity is denial — ranged, no-damage
// status application (Stop / Poison / Brave Down / Faith Down) — rather
// than the trade of blows.

import type { ClassProse } from '../prose.ts';

export const assassinProse: ClassProse = {
  tagline: 'Speed and shadow — the blade that unmakes a foe before it strikes one.',

  brief: `The Assassin is the fastest cadet the Academy fields, and the
most mobile — and a cadet who reads those facts as merely *a striker who
arrives first* has misread her. Her gift is not the blow but the turn.
She acts more often than anyone on the field, and she spends that
surfeit not on damage — her arm is among the lightest the Academy issues
— but on dismantling the enemy's ability to act at all: a foe Stopped
clean out of the turn order, poisoned, stripped of the Brave that fires
his reactions and the Faith that powers his art.

This is bought at a fearful price in resilience. She is paper — slight
of health, and a back she does not guard at all, so that a single cadet
who reaches her flank tends to end her. Hers is therefore a discipline
of position and tempo before all else: she lands her conditions from
range, behind the screen of her own speed, and is gone before the enemy
can answer. A cadet drawn to the Assassin must learn to think a turn
ahead of everyone — because she will, in fact, be acting one.`,

  abilityNotes: {
    attack: {
      full: `The Assassin's blade is light — the lightest honest arm the
Academy issues — and on its own it does little. Its purpose is
plurality: equip a second weapon and she strikes twice; add The Offering
and twice becomes four. The Assassin who means to deal damage does it by
*volume*, never by weight of any single blow.`,
      compact: 'A light melee blow. Its worth is in number — dual-wielded and doubled, not in any one strike.',
    },
    shadow_stitch: {
      full: `The discipline's signature: a thread of shadow cast across
the field that pins a foe *Stopped* — lifted clean from the turn order
for a span. It rolls on the Assassin's own Brave and Speed rather than
on spell-craft, so the faster and bolder the cadet, the surer the pin.
It flies straight now, so cover turns it aside.`,
      compact: 'Ranged Stop — pins a foe out of the turn order. Rolls on her Brave and Speed; her speed makes it stick. Cover blocks it.',
    },
    blowdart: {
      full: `A dart of venom sent across the field — Poison, applied at
range and with little ceremony. It is the Assassin's *standing* chip
pressure: it ticks a foe down while she turns her attention to the next
throat, and asks nothing of her once it is on. A straight flight, so a
wall or a body between will stop it.`,
      compact: 'Ranged Poison — reliable, untended chip pressure. Apply it and move on. Cover blocks it.',
    },
    undermine: {
      full: `Undermine strips a measure of a foe's *Brave* — and Brave,
the cadet will recall, is what fires a unit's reactions and steadies its
nerve. Lower it and the enemy's Counter sleeps, his reactive tricks fall
quiet. The cut holds for the whole engagement; against a reaction-heavy
opponent it is very nearly a disarmament — where cover does not stop the
dart.`,
      compact: 'Ranged, lasting Brave −20 — quiets a foe’s reactions for the engagement. Disarms a Counter build. Cover blocks it.',
    },
    sow_doubt: {
      full: `The mirror of Undermine, turned upon the enemy's art: Sow
Doubt strips *Faith*, and Faith is what lends a caster's spells their
bite and their reliability. A doubting mage is a lesser mage — her damage
thinner, her statuses likelier to slip their hold. Lasting, like its
sister, and stopped the same way by a wall between.`,
      compact: 'Ranged, lasting Faith −20 — softens an enemy caster’s spells and status chances. The anti-mage cut. Cover blocks it.',
    },
    speed_save: {
      full: `A reaction, and a cruel one for the enemy: every blow that
lands on the Assassin makes her *faster* for the rest of the engagement,
and the gain accumulates. It will not save a fragile cadet from a
focused killing — but it ensures that whittling at her only sharpens
her.`,
      compact: 'Reaction: each damaging hit grants +1 Speed, lasting and accumulating. Hitting her makes her faster.',
    },
    two_weapons: {
      full: `Two Weapons opens the off-hand to a second blade, and the
Assassin strikes with both — her Physical Attack pared to three-quarters
for the privilege. For a discipline whose damage is a matter of *number*
rather than force, it is the foundation under every striking build she
runs.`,
      compact: 'Support: dual-wield, at PA ×0.75. The foundation of the volume-damage build.',
    },
    fleet_of_foot: {
      full: `One further tile of Move and one of Jump, granted freely —
and atop the Academy's highest base mobility, it leaves the Assassin
ungovernable on the ground. Mobility is not a convenience to this
discipline; it is the better part of her defence.`,
      compact: 'Movement: +1 Move, +1 Jump. Atop the field’s best mobility — distance is the Assassin’s real armour.',
    },
  },

  strategy: `The Assassin is played as *denial* before damage. Her four
Shadow Arts are the discipline: read which thread the engagement most
needs cut — Undermine against a reaction-heavy line, Sow Doubt against an
enemy caster, Shadow Stitch against the one foe who must not act this
round, Blowdart for standing chip that costs nothing to maintain. Land
them from range, behind the screen of her speed, and the enemy fights a
turn behind from the first exchange.

Guard her position as you would her life — they are the same thing, with
a back evade of nothing. Where the cadet wants damage instead, the path
is *volume*: Two Weapons, The Offering, and a touch of Speed turn her
into a flurry of light strikes no armour was built to shed. Strike from
where you cannot be answered, and let Speed Save punish every blow the
enemy spends to reach her.`,

  marginalia: [
    'The Assassin’s first question is never “whom do I hit” but “whose turn do I take.”',
    'Speed Save means the enemy sharpens her every time he connects. Make him regret the exchange.',
    'Her back evade is zero. Zero. A flanked Assassin is a dead one — say it until they hear it.',
    'Volume, not weight. Two Weapons and The Offering, or do not bring her for the killing at all.',
  ],
};
