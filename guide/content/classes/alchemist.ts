// Alchemist — the instructor's hand-authored prose for the Specialization
// spread. Mechanical values flow in from ../src/content at build time;
// this file holds only the voice.
//
// Ability-note keys match the ids the catalog resolves for the
// Alchemist: attack, compound, throw_item (actives); combat_focus
// (reaction), field_recovery / "Healthy Stride" (movement),
// field_kit / "Travel Preparations" (support).
//
// The Alchemist is the Academy's sixth discipline (introduced after the
// Knight and the four elemental Mages). She is a physical-leaning
// support class whose whole tempo is *banking* turns into the stockpile
// (Compound) and *spending* them when the engagement asks (Throw Item).
// Consumables — Potion, Ether, Remedy, Phoenix Down — are the spell
// list of this discipline; the Compound MP costs and Throw Item ranges
// flow in from the catalog.

import type { ClassProse } from '../prose.ts';

export const alchemistProse: ClassProse = {
  tagline: 'Field support — the cadet who carries the team’s reserve in her satchel.',

  brief: `The Alchemist is the Academy's sixth specialization, and the
one cadets misread most often on first introduction. She wears no robe
and casts no spell, and a cadet drawn to swords or to thunderbolts will
glance at her satchel and conclude there is nothing here for her. This
is a mistake. The Alchemist's discipline is the *engagement's
arithmetic*: she banks the turns her team would otherwise waste and
spends them, later, on the turns her team cannot afford to lose.

She stands physically — solid health, an honest blade, a Move that
carries her where she needs to be — and she works *consumably*. Her
First Action set holds two instructions: *Compound*, which spends a
measure of her reserve to add a vial to her stockpile; and *Throw
Item*, which sends one of those vials a short distance to the cadet
who needs it. Healing, reviving, lifting a curse — none of it is a
spell, in the strict sense, and none of it is gated by the elemental
wheel. It is mended by hand, in the moment, at the cost of the reserve
the Alchemist took the trouble to lay in beforehand.

A cadet drawn to this discipline must be a cadet who enjoys *planning
ahead of the engagement*. The Alchemist who arrives empty-handed in a
crisis has misunderstood her own art; the Alchemist who has spent her
quiet turns Compounding, and her loud turns Throwing, is, frequently,
the cadet who keeps the rest of her team upright long enough to win.`,

  abilityNotes: {
    attack: {
      full: `The Alchemist's blade is not an afterthought, as it is for a
mage — she carries a real arm, and her physical attack lands with real
weight. It is not her *first* answer to a turn, but it is a perfectly
honest second one, and on the turn her stockpile is full and the field
demands a wound, she may take it herself.`,
      compact: 'An honest melee blow. Not her first answer; a real one when the field asks for damage.',
    },
    compound: {
      full: `*Compound* is the Alchemist's quiet turn — the turn she
spends building, rather than spending. The cadet picks a vial from the
short list of things her craft can prepare, and pays for it from her
reserve; the vial enters her stockpile and waits. Cadets new to the
discipline overlook these turns and arrive in the crisis with nothing
to throw. Veteran Alchemists open most engagements with a Compound and
are rewarded for the foresight three turns later.`,
      compact: 'Banks a vial into the stockpile, paid from MP. The Alchemist’s building-turn.',
    },
    throw_item: {
      full: `*Throw Item* is the discipline's loud turn — the cadet
selects a vial from her stockpile and sends it across the field to
whomever needs it. The throw is short — a few tiles, with the reach of
a spell — and the act asks neither MP nor a roll: the vial does what
the vial does, whole or not at all. The Alchemist's whole art is
choosing the vial that fits the moment.`,
      compact: 'Spends a banked vial on a target within a short reach. No MP, no roll — the vial does its work.',
    },
    combat_focus: {
      full: `A reaction. A blow that finds the Alchemist sharpens her
arm for the turns immediately following — her Physical Attack lifts for
a span, and a further blow re-sharpens the same edge. The discipline's
quiet answer to being targeted: hurt her, and the next vial she throws
heals heavier; the next blade she swings cuts deeper.`,
      compact: 'Reaction: an enemy blow lifts her PA for a span. Re-triggers refresh the lift.',
    },
    field_recovery: {
      full: `Healthy Stride mends the Alchemist by the square of the
ground she has crossed under her own power — a step heals a step's
worth, but four steps heal *sixteen*. The movement passive that
rewards moving *deliberately*: a Move-boosting accessory or armour
compounds at a rate no other discipline approaches. Knockback and
involuntary displacement do not feed the count; only the cadet's own
intent does.`,
      compact: 'Movement: heals (tiles moved)² HP on intentional movement. Move-boosters compound dramatically.',
    },
    field_kit: {
      full: `*Travel Preparations* is the bag the Alchemist arrives with.
Three vials — one Potion, one Phoenix Down, one Remedy — sit in her
stockpile before the engagement begins, free and unasked. The
discipline's running start: the cadet may Throw before she has
Compounded a single thing. Note that Ether is *not* in the starting
kit — the cadet who wants to refill an ally's reserve must Compound it
on demand, by design.`,
      compact: 'Support: starts with one Potion, one Phoenix Down, one Remedy in stockpile. Ether must be Compounded.',
    },
  },

  strategy: `The Alchemist is played in two registers: *building*, on
the turns the field is quiet — Compounding into the stockpile against
the crisis she can already see coming — and *spending*, when the
crisis arrives. The cadet who masters her learns to switch between
them on instinct, and never to confuse the one for the other.

Three things to keep, then. *Compound early*: the opening turn should
almost always lay a vial in, since empty hands are the discipline's
failure mode. *Move with purpose*: Healthy Stride is square, so a
Move-boosting piece — Boots of Haste, Sorcerer's Robe, Lightfoot — is
dramatically more valuable on this discipline than on any other. And
*throw the vial the moment matters*: a Potion held for the perfect
crisis is a Potion that was not used. The Alchemist's decisions are
nearly all priority decisions, and she is the discipline cadets get
wrong most often by hesitating.`,

  marginalia: [
    'The Alchemist’s first turn is a Compound. If it isn’t, ask her why.',
    'Healthy Stride is square, not linear. A cadet who walks two tiles heals four; one who walks four heals sixteen. Make her walk.',
    'Ether is not in the kit. If you forget, you forget when it matters — watch for it.',
    'A Phoenix Down on a living ally is mercy, not waste. The next blow was the one that mattered.',
  ],
};
