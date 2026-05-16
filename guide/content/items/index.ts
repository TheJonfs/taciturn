// The Armory — hand-authored notes for the Academy's requisitionable
// gear. Mechanical data (stats, hooks, restrictions) flows in from
// ../src/content at build time; this file holds only the voice: the
// Master Armorer's notes and the instructor's tactical asides.
//
// Note keys match the catalog's item ids. Per the write-through
// discipline, flavour stays evocative but the tactical line stays
// mechanically clear — what the item does, and when to reach for it.

import type { ItemNote } from '../prose.ts';

/** The instructor's framing for the Armory chapter as a whole. */
export const armoryIntro = `The Academy armory is not a shop, and the
Master Armorer is not a merchant. What follows is the standing
inventory a cadet may requisition for an exercise — catalogued by the
Armorer, annotated by your instructor. Read both. The Armorer will tell
you what a thing *is*; this instructor will tell you when it is the
*right* thing, which is a different question and the harder one.`;

/** Per-section framing. */
export const sectionIntros: Readonly<Record<string, string>> = {
  weapons: `A weapon is the first requisition and the most
overthought. Weapon Power is not the whole of a weapon — accuracy, the
work a blade does *after* the swing, the reserve a staff asks in
return: all of it composes. The cadet who requisitions by the largest
number alone will spend a term learning why the racks hold more than
one.`,
  armour: `Armour and headgear are where an engagement is quietly won
or lost. None of it announces itself the way a weapon does; all of it
decides how long the cadet remains on the field to use the weapon at
all. Requisition for the engagement you expect — and a measure more for
the one you do not.`,
  accessories: `The accessory slot is small and its contents are not.
A single band may decide a cadet's tempo, her reserve, her resilience
against a whole element. The Armorer keeps the cases by the door for a
reason: they are the last thing a cadet should choose, and the first
thing a careful one revisits.`,
};

export const itemNotes: Readonly<Record<string, ItemNote>> = {
  // --- Weapons ------------------------------------------------------
  long_sword: {
    flavor: `The weapon every cadet is issued first, and the one a
surprising number return to. Honest power, honest reach, and accuracy
the others in the racks can only envy.`,
    tactical: 'The reliable baseline. When the build has no strong reason to reach elsewhere, it does not let the cadet down.',
  },
  bolt_hammer: {
    flavor: `The Bolt Hammer remains, in this instructor's view, one of
the armory's more elegant pieces — it asks the wielder to compose
physical and magical instincts in the same act, and rewards those who
can. A heavy head, a temperamental swing, and lightning waiting in it.`,
    tactical: 'A teaching weapon for the hybrid Knight: heavy WP, and a real chance the blow calls lightning down besides. The accuracy is the price.',
  },
  war_axe: {
    flavor: `The heaviest head in the racks, and the least apologetic
about it. The War Axe does not ask whether the cadet is ready; it asks
whether the target is.`,
    tactical: 'The highest raw Weapon Power on offer — for the cadet who can afford to miss sometimes and wants the hits that land to matter.',
  },
  flametongue: {
    flavor: `A modest blade that does not stop working when the swing
is over. The fire it carries keeps its own counsel and its own
appointments.`,
    tactical: 'Lower WP than its peers, but a real chance each hit leaves the target burning — cross-element pressure on a physical kit.',
  },
  staff_of_power: {
    flavor: `Raw magical force, bound into a staff and paid for at the
reserve. The Armorer issues it with a word of warning about the second
half of that sentence.`,
    tactical: 'A flat lift to Magical Attack — at the cost of every spell running dearer. Best on a mage with reserve to spare.',
  },
  staff_of_abundance: {
    flavor: `The deep-reserve staff. The cadet who runs dry in the
middle of a long engagement was, as a rule, issued the wrong one.`,
    tactical: 'Multiplies maximum MP outright — though her casts arrive a touch slower for it. The staff for the mage who means to outlast.',
  },
  wand_of_depths: {
    flavor: `A duellist's wand, cut for the Water Mage's hand. Light in
the swing, long in the reach — where the water runs, so does she.`,
    tactical: 'Extends the range of her water-tagged spells, and shifts a struck foe’s resistances. A Water Mage’s wand, and few others’.',
  },
  wand_of_deepwood: {
    flavor: `The Earth Mage's wand — patient wood for a patient
discipline. It does not hurry her, but it hurries her earth.`,
    tactical: 'Quickens her earth-tagged casts and shifts a struck foe’s resistances. The Earth Mage’s answer to her own slow tempo.',
  },

  // --- Shields ------------------------------------------------------
  managuard: {
    flavor: `A shield with a little art worked into it — the Armorer
calls it a hybrid's guard, and means it as praise.`,
    tactical: 'Front and side evasion plus a touch of Magical Attack. For the Knight whose kit reaches past the blade.',
  },
  escutcheon: {
    flavor: `The heaviest guard in the racks. Behind the Escutcheon, a
Knight is a difficult proposition from the front and a thankless one
from the side.`,
    tactical: 'The strongest evasion the armory issues, with elemental resistance besides. The anchoring Knight’s shield.',
  },
  warriors_aegis: {
    flavor: `A shield that hits back. Modest cover, by the standards of
the rack — but the arm behind it strikes the harder for carrying it.`,
    tactical: 'Lighter on evasion than its peers, but a real lift to Physical Attack. The aggressive Knight’s shield.',
  },

  // --- Armour -------------------------------------------------------
  iron_mail: {
    flavor: `Mail. It does what mail does, and it does it for anyone.
The Armorer issues it without commentary, which from the Armorer is its
own kind of endorsement.`,
    tactical: 'A plain, unrestricted lift to HP. The honest floor under any build.',
  },
  battle_gear: {
    flavor: `Vast survivability, cut to fit any cadet on the field.
The generalist's plate — heavy enough to matter, open enough for
anyone.`,
    tactical: 'A very large HP gain and a touch of Physical Attack, with no class restriction. The endurance answer for non-Knights.',
  },
  soldiers_leathers: {
    flavor: `For the Knight who means to arrive as well as endure.
Lighter than the plate, and quicker for it.`,
    tactical: 'Knight-only: solid HP, with Speed and Physical Attack besides. The mobile anchor’s armour.',
  },
  war_plate: {
    flavor: `The immovable object, requisitioned. A Knight in War Plate
will not be hurried, and she will not, in any sense that matters, be
moved.`,
    tactical: 'Knight-only: the largest HP pool in the armory and resistance to every element — paid for in a step of Speed.',
  },
  wizards_robe: {
    flavor: `The deepest reserves and the keenest art the armory will
issue a mage — and the Armorer is careful to add the rest of the
sentence: a thinner skin against every element there is.`,
    tactical: 'Mages only: large HP and MP gains and a lift to Magical Attack — at a broad elemental vulnerability. Power, openly paid for.',
  },
  sorcerers_robe: {
    flavor: `A measured robe, where the Wizard's is a bold one. A
standing ward about the wearer, and a quicker step beneath her.`,
    tactical: 'Mages only: steady HP and MP, a free Shell at battle’s start, and a tile of Move. The careful mage’s robe.',
  },
  silvered_vest: {
    flavor: `The hybrid's vest — survivability with a thread of art
worked through it, and open to any cadet who wants both.`,
    tactical: 'Unrestricted: a strong HP gain, useful MP, and a touch of Magical Attack. For the build that straddles the line.',
  },
  spiked_mail: {
    flavor: `The punisher's mail. A foe who lays a hand on a Knight in
Spiked Mail will, as a rule, regret it the first time and then keep
on regretting it.`,
    tactical: 'Knight-only: a heavy HP gain, and every physical blow the wearer suffers returns a measure of damage to the striker.',
  },
  travel_garb: {
    flavor: `Cut for the cadet who means to be elsewhere. Lighter than
the plate, sturdier than the robe, and friendlier to the foot.`,
    tactical: 'Unrestricted: a strong HP gain and a tile of Move. The mobility-minded build’s armour, open to any class.',
  },
  dark_robe: {
    flavor: `A robe cut for the mage who expects to face the heavier
elements — Earth's weight, Water's pull. The Armorer keeps it on the
same rack as its lighter twin and trusts the cadet to know which
engagement she is preparing for.`,
    tactical: 'Mages only: solid HP and MP, with strong resistance to Earth and Water. Choose it when the opposition runs to those two.',
  },
  light_robe: {
    flavor: `The other half of the pair. Fire's reach and Lightning's
edge are the elements one tends to fear in the heat of an exchange;
the Light Robe answers them.`,
    tactical: 'Mages only: solid HP and MP, with strong resistance to Fire and Lightning. Choose it when the opposition leans on those two.',
  },

  // --- Headgear -----------------------------------------------------
  iron_helm: {
    flavor: `A helm. It does what a helm does. The Armorer has, over
many years, declined to say more about it, and this instructor will
follow that example.`,
    tactical: 'A small, unrestricted lift to HP. The default head until the build asks for something specific.',
  },
  guard_cap: {
    flavor: `The cap for the cadet who expects to be burned, frozen,
shocked, and buried in the same exercise — and the Academy's exercises
do, in fact, arrange exactly that.`,
    tactical: 'A modest HP gain and resistance to every element at once. Broad insurance, for any class.',
  },
  steel_helm: {
    flavor: `Room for one more reaction, bought with a blind spot. The
Armorer issues it with the same advice every year: keep your front to
the work.`,
    tactical: 'Knight-only: good HP and an extra Reaction slot — at a real cost to side and back evasion. Powerful, and demanding of positioning.',
  },
  tactical_mask: {
    flavor: `The aggressive Knight's helm — cut to let her hit sooner
and harder, and trusting her to not need the rest.`,
    tactical: 'Knight-only: HP, Physical Attack, and Speed together. The forward Knight’s head.',
  },
  pointy_hat: {
    flavor: `The mage's hat, and rather more than a hat. Half a guard
against being silenced — which, for a cadet whose every tool is a
spoken word, is no small comfort.`,
    tactical: 'Mages only: HP, MP, and Magical Attack — and halves the chance an incoming Silence takes hold.',
  },
  magus_crown: {
    flavor: `A trade, worn on the head: a measure of raw art given up
for a second school of it. Breadth, where the other mage headgear
offers depth.`,
    tactical: 'Mages only: room for another command set — at a cost to Magical Attack. For the mage who wants range over force.',
  },
  focus_band: {
    flavor: `A steadying band. Every ill the enemy would lay on the
wearer, made a measure less likely to find purchase.`,
    tactical: 'Unrestricted: small HP and MP, and a standing reduction to the chance any negative status lands. Quiet, broad defence.',
  },
  crusaders_helm: {
    flavor: `The helm of the Knight who has accepted that her comrades
will mend her, and who means to receive that mending in full.`,
    tactical: 'Knight-only: HP, MP, and Faith — the last sharpens both the magic she gives and the magic she takes. A boon for a Knight whose teammates will Cure her.',
  },
  lookouts_hood: {
    flavor: `A scout's hood, requisitioned cheaply and worn often.
Modest in its protection; generous, by the head's standards, in its
tempo.`,
    tactical: 'Unrestricted: a touch of HP and a point of Speed. A cheap tempo lift for any class.',
  },
  tricorn: {
    flavor: `A jaunty thing for a mage's head, and the Armorer's
preferred cure for a cadet whose Reactions miss too often. A lifted
Brave makes the body's answer surer.`,
    tactical: 'Mages only: HP, MP, and Brave — the last makes her reactions more likely to fire when the field gives the chance.',
  },

  // --- Accessories --------------------------------------------------
  strength_ring: {
    flavor: `A small, honest band for the cadet whose argument is a
physical one. It promises little and delivers exactly that.`,
    tactical: 'A flat point of Physical Attack. Cheap, certain, and never wrong on a striker.',
  },
  diamond_bracelet: {
    flavor: `A touch of both arms at once — the hybrid's bracelet, for
the cadet who refuses to choose.`,
    tactical: 'A point each of Physical and Magical Attack. The accessory for a kit that draws on both.',
  },
  arcane_lens: {
    flavor: `The lens sharpens the eye. The cadet who wears it strikes
surer, and more of those strikes tell.`,
    tactical: 'Lifts critical chance and multiplies outgoing hit chance. For the cadet who wants her blows to land — and to land hard.',
  },
  lightfoot: {
    flavor: `Everything that makes a cadet difficult to pin, gathered
into a single band. The Armorer's quiet favourite.`,
    tactical: 'Speed, Move Range, and Jump together. Pure mobility — decisive on real terrain, for any class.',
  },
  boots_of_haste: {
    flavor: `Haste, from the first tick of the engagement. The cadet in
these boots is, simply and always, early.`,
    tactical: 'Grants Haste at battle’s start. A standing tempo advantage that asks nothing in return.',
  },
  tintinibar: {
    flavor: `A slow, steady mending that asks nothing of the wearer and
never quite stops. The Armorer is fond of it; one comes to understand
why.`,
    tactical: 'Grants Auto-Regen — a constant, unattended trickle of healing across the whole engagement.',
  },
  capacitor_ring: {
    flavor: `Absolute confidence against one element, and nothing
whatever against the rest. Know your opponent before you requisition
it.`,
    tactical: 'A vast Lightning resistance — enough, stacked on a class baseline, to turn incoming lightning into healing. Narrow, and devastating where it fits.',
  },
  rasp_pendant: {
    flavor: `Every physical blow the wearer lands feeds her reserve a
little. A duellist's pendant — it rewards the cadet who stays in the
exchange.`,
    tactical: 'Drains a share of the damage the wearer deals back as MP. For a physical kit that also wants a reserve.',
  },
  purifier: {
    flavor: `The negative conditions one suffers burn down twice as
fast for wearing it. The cadet who expects to be cursed should expect
this in answer.`,
    tactical: 'Doubles the rate at which negative statuses tick away — halving, in effect, how long the enemy’s curses last.',
  },
  augmentor: {
    flavor: `Room for one more passive bearing. Quiet, unglamorous, and
frequently the piece that decides a build.`,
    tactical: 'An extra Support slot. Whatever the cadet most wished she could also equip — now she can.',
  },
};
