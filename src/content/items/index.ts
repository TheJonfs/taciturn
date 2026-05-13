import type { ItemDefinition } from '@engine/index.ts';
import { arcaneLens } from './arcane-lens.ts';
import { augmentor } from './augmentor.ts';
import { battleGear } from './battle-gear.ts';
import { boltHammer } from './bolt-hammer.ts';
import { bootsOfHaste } from './boots-of-haste.ts';
import { capacitorRing } from './capacitor-ring.ts';
import { diamondBracelet } from './diamond-bracelet.ts';
import { escutcheon } from './escutcheon.ts';
import { flametongue } from './flametongue.ts';
import { focusBand } from './focus-band.ts';
import { guardCap } from './guard-cap.ts';
import { ironHelm } from './iron-helm.ts';
import { ironMail } from './iron-mail.ts';
import { lightfoot } from './lightfoot.ts';
import { longSword } from './long-sword.ts';
import { magusCrown } from './magus-crown.ts';
import { managuard } from './managuard.ts';
import { pointyHat } from './pointy-hat.ts';
import { purifier } from './purifier.ts';
import { raspPendant } from './rasp-pendant.ts';
import { silveredVest } from './silvered-vest.ts';
import { soldiersLeathers } from './soldiers-leathers.ts';
import { sorcerersRobe } from './sorcerers-robe.ts';
import { staffOfAbundance } from './staff-of-abundance.ts';
import { staffOfPower } from './staff-of-power.ts';
import { steelHelm } from './steel-helm.ts';
import { strengthRing } from './strength-ring.ts';
import { tacticalMask } from './tactical-mask.ts';
import { tintinibar } from './tintinibar.ts';
import { wandOfDeepwood } from './wand-of-deepwood.ts';
import { wandOfDepths } from './wand-of-depths.ts';
import { warAxe } from './war-axe.ts';
import { warPlate } from './war-plate.ts';
import { warriorsAegis } from './warriors-aegis.ts';
import { wizardsRobe } from './wizards-robe.ts';

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
  // Shields (Knight-only)
  escutcheon,
  warriorsAegis,
  managuard,
  // Body armor
  battleGear,
  silveredVest,
  soldiersLeathers,
  warPlate,
  wizardsRobe,
  sorcerersRobe,
  // Head armor
  guardCap,
  focusBand,
  steelHelm,
  tacticalMask,
  pointyHat,
  magusCrown,
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
];
