// Aethurge (catalog id: lightning_mage) — the instructor's
// hand-authored prose for the Specialization spread. Mechanical values
// flow in from ../src/content at build time; this file holds only the
// voice.
//
// S40 name-update pass: the discipline's display name is now "Aethurge"
// and two abilities were renamed in the same pass — Lightning Bolt
// (was Lightning Strike) and Megavolt (was Storm Caller). The
// remaining abilities (Static Embrace, Chain Lightning, Magnetic Mark,
// Discharge, Conductor, Quickstep) keep their names. Underlying ids
// preserved.
//
// Ability-note keys match the ids the catalog resolves for the
// Aethurge: attack, lightning_strike, static_embrace, chain_lightning,
// magnetic_mark, storm_caller (actives); discharge, conductor,
// quickstep (passives).

import type { ClassProse } from '../prose.ts';

export const lightningMageProse: ClassProse = {
  tagline: 'Elemental burst — the mage who spends everything on a single, perfect moment.',

  brief: `The Aethurge carries the sharpest mind for damage the Academy
trains and the slightest frame to carry it. She is the extreme case of
the caster's bargain: the highest Magical Attack on the field, set
atop the lowest pool of health, and a discipline that asks her to
spend the one to make the other not matter.

A cadet drawn to the Aethurge must understand that she is not a mage
who wins long engagements. She is a mage who ends short ones. Her whole
art bends toward the assembling of a single decisive turn — the mark
set, the crit weighted, the ground chosen — and then the spending of
it, completely. Read the moment correctly and she is the most
frightening cadet in the Mage War. Read it late and she is gone.`,

  abilityNotes: {
    attack: {
      full: `If an Aethurge is reduced to swinging away with whatever
physical object is at hand, the Aethurge is about to be a casualty.`,
      compact: 'A weak melee blow. The Aethurge in arm’s reach is the Aethurge about to fall.',
    },
    lightning_strike: {
      full: `The heaviest single-target stroke in any elemental
discipline — Lightning Bolt does not slow, does not curse, does not
linger. It simply asks the target to absorb more magical damage than
any other spell of its cost, and most targets cannot.`,
      compact: 'The heaviest single-target spell in the disciplines. Pure damage, nothing else.',
    },
    static_embrace: {
      full: `A boon laid on an ally: their next blows fall with a
keener edge — their chance of a telling strike sharpened for a span.
The Aethurge's gift to the team's striker, and a piece of her own
decisive-turn machinery when she lays it on herself.`,
      compact: 'Buffs an ally’s critical chance for a span. Sharpens a striker — or herself.',
    },
    chain_lightning: {
      full: `An area spell that grows hungrier the more it finds:
Chain Lightning's force climbs with each additional target caught in
the diamond. Against one foe it is ordinary. Against a bunched line it
is the cadet's reminder that the enemy chose to stand together.`,
      compact: 'Area damage that scales up with the number of targets caught. Punishes a cluster.',
    },
    magnetic_mark: {
      full: `Magnetic Mark deals no great wound itself. It leaves a foe
*Vulnerable* — the blow that follows lands harder for it. The Aethurge
marks the cadet she means to remove, and then removes them.`,
      compact: 'Marks a foe Vulnerable — the blow that follows lands harder. The setup.',
    },
    storm_caller: {
      full: `The discipline's ultimate, and the truest statement of the
caster's bargain in the whole Academy: Megavolt is a stroke of
overwhelming magical damage, paid for in part with a quarter of the
Aethurge's own health. It is not a spell one casts hopefully. It is a
spell one casts having already decided.`,
      compact: 'The ultimate: overwhelming damage, paid for with a quarter of her own HP.',
    },
    discharge: {
      full: `A reaction. A foe that strikes the Aethurge is answered in
kind, unbidden, with her art rather than her arm. It will not save a
fragile cadet on its own — but it ensures that reaching her was never
free.`,
      compact: 'Reaction: a foe that strikes her is answered with magical retaliation.',
    },
    conductor: {
      full: `The quiet engine of the discipline. Conductor lifts the
Aethurge's Magical Attack outright — and atop the highest base MA on
the field, a multiplier is not a small thing. It is the difference
between a heavy turn and a decisive one.`,
      compact: 'Support: multiplies her Magical Attack. Atop the field’s highest MA, no small thing.',
    },
    quickstep: {
      full: `On a turn the Aethurge commits to moving, Quickstep
returns a measure of charge at its end. The discipline's concession to
its own fragility: she may reposition out of danger and not, for once,
pay the full price in tempo for it.`,
      compact: 'Refunds CT at the end of a turn she moved on. Reposition without losing the tempo.',
    },
  },

  strategy: `The Aethurge is played as a held breath. Conductor belongs
in her Support slot without discussion — every other number in her kit
is built atop it. From there, the discipline is patience in service of
a single violent instant: stay back, stay alive, and assemble the
turn. Magnetic Mark on the cadet to be removed, Static Embrace to
weight the stroke, the ground chosen so Megavolt or Lightning Bolt
lands where it must — and then spend all of it at once.

She cannot trade. Her health does not permit it. What she can do is
ensure that the engagement reaches a moment where one perfect turn
settles it, and that when that moment comes, she is the cadet holding
it. Everything else she does is in service of arriving there alive.`,

  marginalia: [
    'The Aethurge does not win the engagement. She ends it. Know the difference.',
    'Conductor first. Everything she does is multiplied by it — so multiply it first.',
    'Megavolt is not a panic button. A cadet who treats it as one will spell out the lesson in her own health.',
    'Patience, then violence. Never the violence first.',
  ],
};
