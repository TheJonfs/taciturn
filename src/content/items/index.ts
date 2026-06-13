import type { ItemDefinition } from '@engine/index.ts';
import { absolom } from './absolom.ts';
import { arcaneLens } from './arcane-lens.ts';
import { augmentor } from './augmentor.ts';
import { battleDictionary } from './battle-dictionary.ts';
import { battleGear } from './battle-gear.ts';
import { buckler } from './buckler.ts';
import { boltHammer } from './bolt-hammer.ts';
import { bootsOfHaste } from './boots-of-haste.ts';
import { capacitorRing } from './capacitor-ring.ts';
import { chefsKnife } from './chefs-knife.ts';
import { crusadersHelm } from './crusaders-helm.ts';
import { darkRobe } from './dark-robe.ts';
import { defender } from './defender.ts';
import { impHalberd } from './imp-halberd.ts';
import { lance } from './lance.ts';
import { diamondBracelet } from './diamond-bracelet.ts';
import { escutcheon } from './escutcheon.ts';
import { ether } from './ether.ts';
import { flametongue } from './flametongue.ts';
import { focusBand } from './focus-band.ts';
import { goldenHairpin } from './golden-hairpin.ts';
import { guardCap } from './guard-cap.ts';
import { ironHelm } from './iron-helm.ts';
import { ironMail } from './iron-mail.ts';
import { lightRobe } from './light-robe.ts';
import { lightfoot } from './lightfoot.ts';
import { ironfoot } from './ironfoot.ts';
import { livreOfUrgency } from './livre-of-urgency.ts';
import { longSword } from './long-sword.ts';
import { longbow } from './longbow.ts';
import { mantleOfProtection } from './mantle-of-protection.ts';
import { parryingSword } from './parrying-sword.ts';
import { riptideBow } from './riptide-bow.ts';
import { wandOfLumen } from './wand-of-lumen.ts';
import { lookoutsHood } from './lookouts-hood.ts';
import { magebane } from './magebane.ts';
import { magusCrown } from './magus-crown.ts';
import { managuard } from './managuard.ts';
import { phoenixDown } from './phoenix-down.ts';
import { pointyHat } from './pointy-hat.ts';
import { potion } from './potion.ts';
import { purifier } from './purifier.ts';
import { raspPendant } from './rasp-pendant.ts';
import { remedy } from './remedy.ts';
import { sai } from './sai.ts';
import { shimmerCloak } from './shimmer-cloak.ts';
import { silveredVest } from './silvered-vest.ts';
import { skullclamp } from './skullclamp.ts';
import { soulVest } from './soul-vest.ts';
import { soldiersLeathers } from './soldiers-leathers.ts';
import { sorcerersRobe } from './sorcerers-robe.ts';
import { spikedMail } from './spiked-mail.ts';
import { staffOfAbundance } from './staff-of-abundance.ts';
import { staffOfPower } from './staff-of-power.ts';
import { steelHelm } from './steel-helm.ts';
import { strengthRing } from './strength-ring.ts';
import { tacticalMask } from './tactical-mask.ts';
import { talismanOfConviction } from './talisman-of-conviction.ts';
import { talismanOfWarding } from './talisman-of-warding.ts';
import { theOffering } from './the-offering.ts';
import { tintinibar } from './tintinibar.ts';
import { tomeOfPower } from './tome-of-power.ts';
import { travelGarb } from './travel-garb.ts';
import { tricorn } from './tricorn.ts';
import { wandOfDeepwood } from './wand-of-deepwood.ts';
import { wandOfDepths } from './wand-of-depths.ts';
import { warAxe } from './war-axe.ts';
import { warPlate } from './war-plate.ts';
import { warriorsAegis } from './warriors-aegis.ts';
import { wizardsRobe } from './wizards-robe.ts';
// Session 65 — equipment expansion (control sub-game + MP economy)
import { battlemagesChain } from './battlemages-chain.ts';
import { barbut } from './barbut.ts';
import { circlet } from './circlet.ts';

export const items: ReadonlyArray<ItemDefinition> = [
  // Session 17c / 19 originals
  longSword,
  strengthRing,
  bootsOfHaste,
  ironHelm,
  ironMail,
  // Session 29 batch A — weapons
  flametongue,
  warAxe,
  wandOfDepths,
  wandOfDeepwood,
  staffOfPower,
  staffOfAbundance,
  // Session 31 batch B — new weapon
  boltHammer,
  // Session 40 — knife weapon class. Speed-based dynamic variance per
  // the discriminated-union `physicalVariance` substrate. Class-agnostic
  // by design (no `classRestrictions`); soft filter is whether non-melee
  // classes want to be attacking at all.
  chefsKnife,
  magebane,
  sai,
  // Session 50 — defensive sword variant (universal sword; WP 6 + per-
  // facing evade in lieu of higher WP).
  parryingSword,
  // Session 50 — Knight Sword weapon class (two-handed, Brave-scaled
  // variance, high WP + rider package).
  absolom,
  // Shields (Knight-only via per-item classRestrictions)
  escutcheon,
  warriorsAegis,
  managuard,
  // S51 — universal off-hand pieces (shield kind, no classRestrictions)
  buckler,
  talismanOfWarding,
  talismanOfConviction,
  // S51 — mage off-hand Books (shield kind, mage class restriction)
  tomeOfPower,
  livreOfUrgency,
  battleDictionary,
  // Body armor
  battleGear,
  silveredVest,
  soldiersLeathers,
  warPlate,
  wizardsRobe,
  sorcerersRobe,
  // Session 37 — mage equipment pool expansion + cross-cutting bodies
  travelGarb,
  lightRobe,
  darkRobe,
  spikedMail,
  // Session 50 — universal armor expansion: defensive +HP/evade body
  shimmerCloak,
  // Session 50 — Brave/Faith hybrid body
  soulVest,
  // Session 65 — Heavy hybrid body, Knight/Templar (HP +80 / MP +10 / MA +1)
  battlemagesChain,
  // Head armor
  guardCap,
  focusBand,
  steelHelm,
  tacticalMask,
  pointyHat,
  magusCrown,
  // Session 37 — universal speed head, Knight hybrid-caster head, Mage Brave head
  lookoutsHood,
  crusadersHelm,
  tricorn,
  // Session 50 — universal head expansion: MP-economy head (50% MP cost)
  goldenHairpin,
  // Session 50 — hybrid offense head with HP/MP tax (-20 HP / -10 MP / +1 PA / +1 MA)
  skullclamp,
  // Session 65 — control sub-game + MP economy heads:
  //   Barbut (heavy; Knight/Templar): HP +30 + Stop/Don't Move/Don't Act resist
  //   Circlet (mage): HP +10 / MP +10 + MA/2 per-turn MP regen (mana_font grant)
  barbut,
  circlet,
  // Accessories
  capacitorRing,
  tintinibar,
  lightfoot,
  augmentor,
  diamondBracelet,
  purifier,
  arcaneLens,
  // Session 31 batch B — new accessory
  raspPendant,
  // Session 42 — swings-per-weapon accessory (ADR-0080)
  theOffering,
  // Session 45 — bow weapon class (two-handed, ranged, height-delta variance)
  longbow,
  riptideBow,
  // Session 45 follow-up — defensive / tradeoff / fire wand
  mantleOfProtection,
  ironfoot,
  wandOfLumen,
  // Session 39a — Alchemist consumables (stockpile content for Compound
  // / Throw Item). Not equippable; appear in stockpile maps only.
  potion,
  phoenixDown,
  remedy,
  ether,
  // Session 62 — Templar arc foundation. Defender: second Knight Sword,
  // grants Auto-Protect via statusGrants (universal weapon — any class).
  defender,
  // Session 62 — Lance weapon class (two-handed, pierces; ADR-0102).
  lance,
  impHalberd,
];
