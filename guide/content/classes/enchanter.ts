// Enchanter — the instructor's hand-authored prose for the Specialization
// spread. Mechanical values flow in from ../src/content at build time;
// this file holds only the voice.
//
// Ability-note keys match the ids the catalog resolves for the Enchanter:
// enchant_haste, enchant_protect, enchant_shell, esuna (actives, the
// Auramancy command set); resistance_save (reaction), short_charge and
// aura_mastery (support), float (movement). Attack is omitted by
// convention — at PA 3 the Enchanter's own strike is a footnote; her
// offence, by design, comes from a secondary command set.
//
// The Enchanter is the Academy's thirteenth discipline and its sixth
// caster (the Enchantress). A dedicated ally-enhancement mage: HP 103 /
// MP 40 / PA 3 / MA 10 / Speed 10, universal + magical gear. Auramancy —
// charged, friendly-fire AoE buffs and a cleanse — is her whole First
// Action; she wins by what her allies do, not by what she does.
//
// NOTE (fit): the densest possible spread — an intro block plus four
// actives and four passives. Notes are deliberately held to ~two
// sentences to keep the recto on two pages; budget a trim before adding.

import type { ClassProse } from '../prose.ts';

export const enchanterProse: ClassProse = {
  tagline: 'The hand behind the line — she strikes no telling blow, and sharpens every one that lands.',

  brief: `The Enchanter is the Academy's thirteenth discipline and the
only one that does not, in any real sense, fight. Her Physical Attack is
the lightest the racks have measured, and her command set holds no spell
that deals a point of damage. What she carries instead is *aura* — the
art of making the cadets beside her faster, harder to wound, and clean of
the afflictions the enemy lays on them.

Read her as a *force multiplier*, never a duellist. Her offence must be
requisitioned — a secondary command set, for she has none of her own —
and her survival depends on the line she stands behind. But a team built
around her ceases to be five cadets and becomes one instrument: hasted,
warded, and cleansed faster than the enemy can answer.`,

  commandSetIntro: {
    name: 'Auramancy',
    facts: 'Charged · 1-square diamond · friendly fire',
    full: `Her whole First Action. Each casting is *charged* and lands as
a one-square diamond that blesses everyone within — the caster and any
enemy in it as readily as her allies, so aim at your own cluster. The
three wards roll to land (surer the higher her Magical Attack, poorer on
a faithless ally); Esuna, the cleanse, never rolls at all.`,
  },

  abilityNotes: {
    enchant_haste: {
      full: `Haste on every cadet in the diamond — Speed half again as
high for several turns, so the whole cluster acts oftener than the enemy
expects. Aura Mastery deepens it further.`,
      compact: 'Area Haste (Speed ×1.5) for several turns. Tempo for the whole cluster; deepened by Aura Mastery.',
    },
    enchant_protect: {
      full: `Protect halves the *physical* damage the area takes — and it
multiplies *after* resistance rather than competing with it, so a warded
cadet is reliably tougher than gear alone. The answer to a melee press.`,
      compact: 'Area Protect — halves incoming physical, stacking with resistance (not competing). Against a melee press.',
    },
    enchant_shell: {
      full: `Shell is the mirror, turned on the enemy's art: it halves the
*magical* damage the area takes, again after resistance. The ward that
holds a team together against a mage line.`,
      compact: 'Area Shell — halves incoming magical, after resistance. Against a mage line.',
    },
    esuna: {
      full: `The cleanse: it lifts the common afflictions — Poison, Blind,
Silence, Stop, the Don'ts, Slow, Burn — from each cadet in the diamond at
once, never missing and heedless of Faith. It leaves the committed Downs
alone (as Remedy does) and cleanses any enemy in the area too — so aim it
home.`,
      compact: 'Area cleanse of the common ailments (the Remedy set). Always lands, ignores Faith; leaves the Downs. Catches enemies in the area.',
    },
    resistance_save: {
      full: `Each spell that wounds her hardens her against the elements:
+10 to every elemental resistance, accumulating all engagement without
ceiling. A mage who keeps casting at her teaches her to ignore him.`,
      compact: 'Reaction: a magical hit grants +10 to all elemental resistance, accumulating and permanent. Mages sharpen her against themselves.',
    },
    short_charge: {
      full: `Every charged spell she casts resolves about a third sooner —
and it lends to any discipline, not only her own auras. Instants are
untouched.`,
      compact: 'Support: charged spells resolve ~⅓ sooner — any class, any charge. Instants unaffected.',
    },
    aura_mastery: {
      full: `The buffs she *casts* land about a third stronger — her wards,
and cross-classed, a Geosage's Regen or an Aethurge's Crit boost.
Equipment grants and flat stat buffs are untouched; with Support capacity
three she runs this *and* Short Charge.`,
      compact: 'Support: the buffs she casts land ~⅓ stronger (not equipment grants). Pairs with Short Charge — faster and stronger.',
    },
    float: {
      full: `Her Movement, revived: she crosses any water at no added cost
and takes no fall damage — a shove off a ledge, a tile collapsing, both
harmless. No flight, no reach of elevation.`,
      compact: 'Movement: cross any water at no extra cost; immune to fall damage. No flight or elevation reach.',
    },
  },

  strategy: `Play her as the team's *condition*, set before the fighting
proper. Each turn, ask whose moment it is — Haste the cadet about to
strike, Shell the cluster a mage has ranged, Esuna the ally an Assassin
has just Stopped — and place every diamond on your own people, for a ward
dropped on the enemy is worse than wasted.

She is not self-sufficient: requisition a secondary command set for the
turns no ally needs blessing, and never field her without a line to stand
behind — at Physical Attack three she cannot answer a cadet who reaches
her. And her cast buffs can be lifted by a Thief's Steal Buffs, so against
one, time a ward for the turn it pays rather than banking it early.`,

  marginalia: [
    'She casts on her own people. The diamond blesses friend and foe alike — your cluster, never theirs.',
    'A faithless ally is a hard ally to bless. The wards find the devout first; Esuna finds everyone.',
    'Short Charge and Aura Mastery both — faster and stronger. The capacity is there for the pair.',
    'Her buffs can be stolen. A Thief across the field is reason enough to hold a ward a beat.',
  ],
};
