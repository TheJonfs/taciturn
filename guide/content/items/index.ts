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
one. Every weapon is open to every discipline; the off-hand shields and
books at the rack's end are not, and carry their class — *Heavy*,
*Magical*, or *Universal* — beside the name, as the armour stores
explain in full.`,
  armour: `Armour and headgear are where an engagement is quietly won
or lost. None of it announces itself the way a weapon does; all of it
decides how long the cadet remains on the field to use the weapon at
all. Requisition for the engagement you expect — and a measure more for
the one you do not.

The Academy issues protective gear — head, body, and the off-hand
shields and books catalogued among the weapon racks — in three classes,
and an entry's class is marked beside its name. *Universal* gear is open
to every discipline. *Heavy* gear is the armoured line's — the Knight's
plate and true shields, which the Templar is also cleared to bear.
*Magical* gear is the casting line's — the robes, the mage's headgear,
and the off-hand books, requisitionable by the four elemental Mages, the
Calculator, and the Terraformer. A cadet need only know her own
discipline's classes to read the racks at a glance.`,
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
    flavor: `A duellist's wand, cut for the Hydrologist's hand. Light
in the swing, long in the reach — where the water runs, so does she.`,
    tactical: 'Extends the range of her water-tagged spells, and shifts a struck foe’s resistances. A Hydrologist’s wand, and few others’.',
  },
  wand_of_deepwood: {
    flavor: `The Geosage's wand — patient wood for a patient
discipline. It does not hurry her, but it hurries her earth.`,
    tactical: 'Quickens her earth-tagged casts and shifts a struck foe’s resistances. The Geosage’s answer to her own slow tempo.',
  },
  wand_of_lumen: {
    flavor: `The Pyromancer's wand — slim and warm to the touch, and
faintly bright at the tip when its bearer has been working her art.
The lamp-light her cadets nickname it for is the engagement's quiet
warning that the burn is taking root.`,
    tactical: 'A Pyromancer’s wand in all but the label: every fire-tagged status she applies lands with an extra stack of Burn behind it — Slow Burn, Scorch, Ignition’s passing kindlings all sharpened. On hit, the wand also bends a struck foe’s resistances — a gift to a Hydrologist ally and a tax on a Geosage one. Read the team before requisitioning.',
  },
  parrying_sword: {
    flavor: `A blade cut for the defence, not the cut. Lighter at the
edge than the Long Sword and quicker at the cross-guard, the
Parrying Sword teaches its wielder to read the incoming blow and
turn it before it lands.`,
    tactical: 'Lower WP than the Long Sword, paid back in evasion: a meaningful lift to front and a smaller one to the side. Same back as before — flanking still tells. The blade for the cadet who means to stand a long exchange, not to end it in one blow.',
  },
  absolom: {
    flavor: `A great two-handed blade with a name and a temper. The
Armorer issues it to cadets who have earned a certain steadiness, and
watches to see whether the steadiness holds — for the Absolom rewards
conviction and punishes doubt, and does both in plain arithmetic.`,
    tactical: 'The heaviest Weapon Power in the racks, and a two-handed grip that forbids an off-hand and collapses Two Weapons to a single blow. Its damage rides the wielder’s Brave — a default cadet under-rolls it; a Brave-stacked one (Soul Vest, Tricorn, Crusader’s Helm, Bravestrider) swings at or past full force. It carries a Reaction slot besides, which that same Brave makes fire the more often. The Knight’s sword — and a trap for the timid.',
  },
  defender: {
    flavor: `A broad ward-blade of the old Church pattern, graven down
the fuller with a prayer against harm. The Armorer issues it with the
remark that it is, in truth, a shield that happens to take an edge —
and the cadets who carry it tend to agree.`,
    tactical: 'A Knight Sword that halves every physical blow the bearer takes, from the first tick of the engagement — Auto-Protect, standing and free. Heavy WP and Brave-scaled like Absolom, but the aura is the point, and weapons are universal, so *any* discipline can requisition that protection. Two-handed: pairing the guard it grants with an actual shield wants Monkeygrip.',
  },

  // --- Lances -------------------------------------------------------
  // The Lance weapon class (S62, the Templar arc): two-handed reach
  // weapons that strike at two tiles and pierce the tile beyond the
  // target. Universal, like every weapon; the Templar's Jump reads the
  // 'lance' tag for its damage-doubling, but no class is gated from them.
  lance: {
    flavor: `A long ash-shafted spear with a leaf of bright steel at its
head. The Armorer keeps the Lances on a rack of their own, away from
the swords, because a cadet who turns with one in a crowded line tends
to learn the reach the hard way.`,
    tactical: 'Reach where a sword has none: it strikes at two tiles and up four in height, and it *pierces* — the basic attack runs through the target into whoever stands directly behind, friend or foe, so mind your line. High WP, two-handed. The Templar’s Jump lands at double damage with a Lance in hand, but any discipline may carry one for the reach and the pierce.',
  },
  imp_halberd: {
    flavor: `A darker cousin of the Lance, its head wrought in a barbed
and faintly wicked pattern that sits oddly in a holy knight's grip. The
Armorer has opinions about the name and keeps them to himself.`,
    tactical: 'The Lance traded toward the spirit: two points of Weapon Power surrendered for a point of Magical Attack — the same two-tile reach and the same pierce, but cut for the healer who also means to leap. On a Templar the +1 MA compounds her Cure and Raise; on a striker the vanilla Lance hits harder. Choose by which half of the kit you are feeding.',
  },

  // --- Knives -------------------------------------------------------
  // A small, quick, accurate weapon class, requisitionable by any cadet
  // — the Armorer keeps them on the same rack as the swords, but speaks
  // of them differently, because the knife rewards the cadet who is
  // already quick rather than the cadet who is already strong.
  chefs_knife: {
    flavor: `An honest implement borrowed from another sort of practice.
The cadet who first carried one onto the training field was, by all
accounts, an Alchemist who had grown tired of being underestimated.`,
    tactical: 'A light, accurate blade with a touch of Physical Attack — the Alchemist’s natural sidearm, since her Potions, Phoenix Downs, and Ethers all scale with PA. Open to any cadet who wants a fast knife with a small lift to her arm.',
  },
  sai: {
    flavor: `Twin-pronged and shorter than a sword, the Sai is the
quickest hand in the racks. The Armorer keeps a careful eye on which
cadets requisition it, and which cadets requisition it twice.`,
    tactical: 'A light knife that feeds its own +1 Speed back into the knife class’s Speed-derived variance — a slower cadet wielding it lands closer to a clean average, and a faster one accelerates further. Open to any class.',
  },
  magebane: {
    flavor: `The duellist's answer to a robe and a staff. The Armorer
issues the Magebane with a brief, formal warning about which cadets it
is *not* meant for — and a longer, more private remark about which
cadets it absolutely is.`,
    tactical: 'The heaviest of the knives, with a real chance each blow that lands gags the target — a serious threat to a caster. Open to any class; punishing on a Knight or an Alchemist who can close on the mage line.',
  },

  // --- Bows ---------------------------------------------------------
  // The bow weapon class is the Hunter's natural arm but no class is
  // gated from it. The trade is uniform: a thin baseline accuracy
  // (Eagle Eye exists for this), a two-handed grip, and a damage band
  // governed by elevation rather than by the wielder's roll.
  longbow: {
    flavor: `A tall yew bow, requisitioned with a quiet word from the
Armorer about wind and patience. It is the plainest of the Academy's
ranged arms and the one that asks the most of its bearer's feet.`,
    tactical: 'High WP, an honest two-handed shot — and an accuracy that is half what a sword’s is, so equip Eagle Eye or accept that every other arrow vanishes. The elevation-driven variance is the soul of it: from above, every level lifts the damage; from below, every level cuts it, and five levels below the target the arrow does nothing at all. And height does not only sharpen the shot — it lengthens it: standing above her mark, the archer gains a tile of range for every two elevations of drop, so the high ground reaches farther as well as harder. Take the high ground or take a different weapon.',
  },
  riptide_bow: {
    flavor: `A driftwood-and-sinew bow, kept oiled against the damp. It
hisses against the air on release, and on a hit it draws a measure of
the target's tempo away with it.`,
    tactical: 'Lower WP than the Longbow, but the arrows carry water with them — cross-element pressure on a kit that already wants the perch — and roughly one shot in three drags the struck foe’s CT back besides. Same accuracy caveat as its sister bow, and the same height rules: damage and reach both grow with the drop, so the perch pays this bow twice as well.',
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
  buckler: {
    flavor: `The plainest guard the Armorer keeps, and the one he hands
over without ceremony. It is not, by his own admission, a good shield.
It is the shield that means no cadet ever takes the field with an empty
off-hand.`,
    tactical: 'The entry-tier off-hand, open to any cadet: modest front-and-side evasion and a thin, even ward against all four elements. Every other shield in the racks improves on it — but when the build has nothing better to hang at the off-hand, the Buckler is never wrong and never nothing.',
  },
  talisman_of_warding: {
    flavor: `A warding-charm worn where a shield would hang. It turns no
blade — but the cadet who expects the engagement to come at her in fire
and frost rather than in steel will be glad of what it does turn.`,
    tactical: 'Off-hand, any class: a deep, even +20 ward against all four elements, and nothing else. The answer to a mage-heavy opposition without spending the body or head slot on resistance — pure elemental insurance, carried in the off-hand.',
  },
  talisman_of_conviction: {
    flavor: `A small token of resolve, worn at the off-hand. It sharpens
neither the blade nor the ward — only the cadet’s own certainty, which
for some kits is the stat that decides the engagement.`,
    tactical: 'Off-hand, any class: a flat +5 Brave and +5 Faith. The off-hand counterpart to the Soul Vest — for the reaction-heavy Brave build that wants its answers to fire, or the Faith-scaled caster and healer who wants her art to land and her mending to hold.',
  },
  tome_of_power: {
    flavor: `The first book a Mage opens. Where the Knight hangs a shield
at the off-hand, the caster carries a book — and this one asks only that
she mean to hit harder and cast longer.`,
    tactical: 'Mages and the Calculator: a flat +1 Magical Attack and +10 to the reserve, with none of the Staff of Power’s MP-cost tax. The straightforward caster’s off-hand — more force, more casts, no catch.',
  },
  livre_of_urgency: {
    flavor: `The tempo book, bound for the caster who would rather act
again than act harder. The Armorer keeps it near the Aethurge’s racks,
and is rarely surprised by who requisitions it.`,
    tactical: 'Mages and the Calculator: +1 Speed for turn frequency, and +5 action speed on her magical casts so each resolves sooner off the charge. The two compose — more turns, and each cast landing earlier. The off-hand for the discipline that wins on tempo.',
  },
  battle_dictionary: {
    flavor: `The oddest of the three books, and the one experienced
cadets reach for first. Its lift to the arm is wasted on most who carry
it — but the tile of reach it lends a spell is the most coveted thing a
caster can hang at the off-hand.`,
    tactical: 'Mages and the Calculator: +1 horizontal range on every magical cast — the most valuable magical off-hand effect in the racks — and a tile of vertical tolerance on her area spells besides, so they catch foes a step above or below the mark. The +1 Physical Attack most casters will never use, though on the Calculator it is not wholly wasted. The reach book.',
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
  shimmer_cloak: {
    flavor: `A travelling cloak woven so its surface is never quite
where the eye expects it. The cadet inside is harder to read, harder
to strike, and — the Armorer notes drily — harder to find in the
common-room afterwards.`,
    tactical: 'Unrestricted: a real lift to HP and a flat ten points of evasion at every facing. The defensive body for the cadet who expects to be flanked as often as faced.',
  },
  soul_vest: {
    flavor: `A vest with a measure of the cadet's own conviction worked
through it. The Armorer cannot quite explain how, and is careful not
to ask.`,
    tactical: 'Unrestricted: a modest HP gain alongside lifts to *both* Brave and Faith. Useful on a Knight whose reactions need the firing chance, on an Alchemist running magical secondaries, or on any cadet whose kit asks both stats to compose.',
  },
  battlemages_chain: {
    flavor: `A coat of fine ring-mail with a few links struck from a
queerer metal, worn by the cadet who casts as readily as she stands.
The Armorer keeps it between the plate and the robes, which is exactly
where it belongs.`,
    tactical: 'Unrestricted: a heavy HP gain, useful MP, and a point of Magical Attack — a robe’s reserves and a soldier’s bulk in one body, trading the robes’ elemental resistance for raw durability. The body for the hybrid, and for any cadet who casts but would rather not be made of paper to do it.',
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
  barbut: {
    flavor: `A close iron helm with a narrow slit and a heavier weight
than its size suggests, struck for the front-liner who has grown tired
of being held in place. The Armorer recommends it to anyone who has
spent an exercise unable to move.`,
    tactical: 'Heavy: a solid HP gain, and — the point of it — *half* the chance an incoming Stop, Don’t Move, or Don’t Act takes hold. The answer to a control-heavy enemy: an Assassin’s Shadow Stitch, a Pin Down, a disabling line. Stacks multiplicatively with the Focus Band for a front-liner who refuses to be locked down.',
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
  circlet: {
    flavor: `A slim band of pale metal that warms faintly when its
wearer's reserve is running back — the Armorer's quiet provision for the
mage who has learned, of late, that her spells are not free.`,
    tactical: 'Magical: a touch of HP and MP, and — its reason for being — a standing trickle of MP back each turn, scaled to half the wearer’s Magical Attack. The sustain answer to the leaner reserves the casting disciplines now carry; weigh it against the Golden Hairpin’s halved costs and the Magus Crown’s breadth, and choose by whether the engagement is long.',
  },
  golden_hairpin: {
    flavor: `A thin gilded pin, worn through the hair where it stays
quiet and out of the engagement. The work in it is older than the
Academy, and the spells it touches notice.`,
    tactical: 'Unrestricted: a touch of HP and, more importantly, every cast costs the wearer half its standing MP. The headgear for a cadet whose reserve runs short — a long-engagement mage, a Calculator paying the per-cadet Math tax, or a Knight running a magical secondary.',
  },
  skullclamp: {
    flavor: `A heavy iron band that fits, with some discomfort, to the
brow. The Armorer issues it with a brief warning about headaches and
a longer one about what the cadet trades to wear it.`,
    tactical: 'Unrestricted: a flat lift to *both* Physical and Magical Attack, paid for in HP and MP both. The hybrid striker’s helm — useful on any cadet whose kit hits with both arms (a Knight casting a borrowed school, a Calculator wanting a sharper MA, an Alchemist with a magical secondary). The HP and MP costs are real; treat it as a deliberate trade.',
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
  the_offering: {
    flavor: `An old altar-piece worn at the belt, and the Armorer parts
with it wearing a raised eyebrow. It asks its price in raw power and
returns it in *frequency*: the blade falls twice where once it fell
but once.`,
    tactical: 'Doubles every weapon’s swings on a basic Attack, at a flat −3 PA. Paired with Two Weapons, that is four light strikes in a turn — the Assassin’s volume-damage keystone. Wasted on a single heavy blow; it rewards many small ones.',
  },
  ironfoot: {
    flavor: `Iron-shod boots, heavy at the foot and willingly so. The
cadet who wears them moves shorter, lower, and slower — and hits
harder for the planted weight beneath her.`,
    tactical: 'A trade of mobility for power: a step lost in Move, a tile lost in Jump, a measure of Speed besides — paid back in a flat point each of Physical and Magical Attack, and one further Movement slot. The opposite accessory of Lightfoot; for the kit that has chosen its ground and means to hold it.',
  },
  mantle_of_protection: {
    flavor: `A heavy travelling cloak with a quiet weight to it, worn
by every cadet who has reason to fear *every* kind of harm at once.
The Armorer keeps a single one in stock and trades it grudgingly.`,
    tactical: 'A broad defensive blanket: +25 to every elemental and metaphysical resistance the Academy recognises, and +25 evasion at every facing. The accessory for the cadet who cannot predict what is coming — and who would rather not be specialised against any of it.',
  },
};
