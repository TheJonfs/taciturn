// Geosage (catalog id: earth_mage) — the instructor's hand-authored
// prose for the Specialization spread. Mechanical values flow in from
// ../src/content at build time; this file holds only the voice.
//
// S40 name-update pass: the discipline's display name is now "Geosage"
// and several abilities were renamed in the same pass — Rock Toss,
// Life from the Loam, Gaian Hex, Earthquake, Cataclysm, Biomastery,
// Landwalker. Bedrock Stride is unchanged. The underlying ability /
// class ids are preserved (so this file's key structure does not
// change); only the display strings in the prose follow the rename.
//
// Ability-note keys match the ids the catalog resolves for the
// Geosage: attack, earth_strike, earth_blessing, earth_curse,
// earth_quake, earth_cataclysm (actives); earth_resilience,
// earth_communion, bedrock_stride (passives).

import type { ClassProse } from '../prose.ts';

export const earthMageProse: ClassProse = {
  tagline: 'Elemental control — the mage who closes the ground and keeps it.',

  brief: `The Geosage is the slowest of the four elemental cadets, and
the most often underestimated for it. This is an error, and the field
corrects it quickly. Where her sisters in the discipline reach for tempo
or for burst, the Geosage reaches for *constraint* — she does not race
the engagement, she narrows it, tile by tile, until the enemy has
nowhere left to be.

She is also the sturdiest caster the Academy trains, and her instinct is
patience. A cadet who learns to think two turns ahead of her own CT will
find that the Geosage's slows, blinds, and silences compound into
something an opponent simply cannot fight through. The discipline asks
for foresight. It repays it without fail.`,

  abilityNotes: {
    attack: {
      full: `Although the Geosage's basic strike is not her first plan,
with the right wand, it can nonetheless influence the battlefield.`,
      compact: 'A weak melee blow — but with the right wand, it can still shift the field.',
    },
    earth_strike: {
      full: `The discipline's workhorse: reliable magical damage at arc
range, and more often than not Rock Toss leaves the target labouring
through unseen mud besides. One opens most engagements with it and is
rarely sorry.`,
      compact: 'Reliable arc-range damage; usually slows the target too. The opener.',
    },
    earth_blessing: {
      full: `Not every spell is aimed at an enemy. Life from the Loam
settles a slow, certain mending upon an ally — Regen does not hurry,
but it does not miss, and across a long engagement it pays for itself
many times over.`,
      compact: 'Lays Regen on an ally — unhurried, certain healing over time.',
    },
    earth_curse: {
      full: `Gaian Hex asks two separate questions of a target: whether
it can still see, and whether it can still speak the words of its art.
Either answer alone makes a good turn. Both, and one has unmade a foe
without spending a point of its health.`,
      compact: 'Rolls Blind and Silence on a target — independently. Either is a fine result.',
    },
    earth_quake: {
      full: `The first of the Geosage's area spells. Earthquake is not
the heaviest blow in the discipline, but it finds everything standing
in the diamond, and it leaves the survivors slow. Against a cluster,
that is worth more than a larger number against one.`,
      compact: 'Area damage in a diamond; slows what it catches. For clusters.',
    },
    earth_cataclysm: {
      full: `The discipline's ultimate, and its plainest statement of
purpose. Cataclysm does not merely wound a cluster of foes — it poisons
them, and a measure of them it stops from acting and from moving at all.
Expensive, slow to arrive, and, when it arrives, decisive.`,
      compact: 'The ultimate: heavy area damage, Poison, and a chance to Stop foes acting and moving.',
    },
    earth_resilience: {
      full: `A reaction. A blow that finds the Geosage teaches her feet
something — struck, she gains ground. Landwalker is the discipline's
quiet answer to being closed upon: hurt her, and she is harder to pin
the next turn for it.`,
      compact: 'Reaction: a blow that lands on her grants her movement. Her answer to being closed on.',
    },
    earth_communion: {
      full: `The quiet engine of the whole discipline. Biomastery
weights every status the Geosage attempts — her slows, her blinds, her
silences all take hold more often for it. If the cadet equips one
thing first, this instructor would have it be this.`,
      compact: 'Support: lifts the landing chance of every status she applies. Equip it first.',
    },
    bedrock_stride: {
      full: `One further tile of Move Range, and an end to fearing the
drop — the Geosage steps off any ledge as though it were the next
stair down. For so slow a cadet, the freedom to ignore the terrain's
threats is no small gift.`,
      compact: '+1 Move Range, and immunity to falling damage. The slow mage, freed of the terrain.',
    },
  },

  strategy: `The Geosage rewards the patient hand and punishes the
hurried one. She is slow — do not fight that, build around it.
Biomastery belongs in her Support slot before anything else; it is the
multiplier the rest of her kit is balanced against. From there, the
pattern is simple to state and hard to do well: open with Rock Toss,
read which foe most needs unmaking, and hex or quake accordingly,
holding Cataclysm for the moment a cluster has bunched and cannot
scatter in time.

Keep her behind the line — her HP is generous for a caster, not for a
duellist — and let the engagement come to the ground she has prepared.
It will. It always does.`,

  marginalia: [
    'The cadet who rushes the Geosage forward has not understood the Geosage.',
    'Biomastery before Cataclysm. Every term I say it; every term someone learns it the hard way.',
    'Life from the Loam is not glamorous. Win a long engagement without it, then we’ll talk.',
    'Slow is not the same as late. Write that down.',
  ],
};
