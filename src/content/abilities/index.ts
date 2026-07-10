import type { AbilityDefinition } from '@engine/index.ts';
import { aetherBloom } from './aether-bloom.ts';
import { applyBurnProc } from './apply-burn-proc.ts';
import { applySilenceProc } from './apply-silence-proc.ts';
import { applyVulnerableProc } from './apply-vulnerable-proc.ts';
import { applyScouredProc } from './apply-scoured-proc.ts';
import { voidVulnerableProc } from './void-vulnerable-proc.ts';
import { palliativePulse } from './palliative-pulse.ts';
import { attack } from './attack.ts';
import { chargedAttack } from './charged-attack.ts';
import { eagleEye } from './eagle-eye.ts';
import { highJump } from './high-jump.ts';
import { jump } from './jump.ts';
import { pinDown } from './pin-down.ts';
import { scramble } from './scramble.ts';
import { undertow } from './undertow.ts';
import { updraftReaction } from './updraft.ts';
import { barehanded } from './barehanded.ts';
import { bearsHeave } from './bears-heave.ts';
import { chakra } from './chakra.ts';
import { counterpunch } from './counterpunch.ts';
import { counterpunchStrike } from './counterpunch-strike.ts';
import { foxfire } from './foxfire.ts';
import { serpentsCoil } from './serpents-coil.ts';
import { stormStoop } from './storm-stoop.ts';
import { vigilance } from './vigilance.ts';
import { bedrockStride } from './bedrock-stride.ts';
import { blowdart } from './blowdart.ts';
import { bolt } from './bolt.ts';
import { bravestrider } from './bravestrider.ts';
import { brine } from './brine.ts';
import { bullRush } from './bull-rush.ts';
import { chainLightning } from './chain-lightning.ts';
import { combatFocusReaction } from './combat-focus.ts';
import { compound } from './compound.ts';
import { conductor } from './conductor.ts';
import { corneredFocusReaction } from './cornered-focus.ts';
import { counter } from './counter.ts';
import { cure } from './cure.ts';
import { damageReduction } from './damage-reduction.ts';
import { damageSplit } from './damage-split.ts';
import { engineeredDefenses as engineeredDefensesAbility } from './engineered-defenses.ts';
import { exactRhythm } from './exact-rhythm.ts';
import { expertFormer } from './expert-former.ts';
import { emissary } from './emissary.ts';
import { faithstrider } from './faithstrider.ts';
import { monkeygrip } from './monkeygrip.ts';
import { raise } from './raise.ts';
import { unifiedCalling } from './unified-calling.ts';
import { ignoreHeight } from './ignore-height.ts';
import { discharge } from './discharge.ts';
import { dischargeStrike } from './discharge-strike.ts';
import { earthBlessing } from './earth-blessing.ts';
import { earthCataclysm } from './earth-cataclysm.ts';
import { enchantHaste } from './enchant-haste.ts';
import { enchantProtect } from './enchant-protect.ts';
import { enchantShell } from './enchant-shell.ts';
import { esuna } from './esuna.ts';
import { earthCommunion } from './earth-communion.ts';
import { earthCurse } from './earth-curse.ts';
import { earthQuake } from './earth-quake.ts';
import { earthResilience } from './earth-resilience.ts';
import { earthStrike } from './earth-strike.ts';
import { fieldKit } from './field-kit.ts';
import { fieldRecovery } from './field-recovery.ts';
import { fireEmbrace } from './fire-embrace.ts';
import { fireStorm } from './fire-storm.ts';
import { fireStrike } from './fire-strike.ts';
import { flameLance } from './flame-lance.ts';
import { fleetOfFoot } from './fleet-of-foot.ts';
import { float } from './float.ts';
import { flowState } from './flow-state.ts';
import { fly } from './fly.ts';
import { hotfoot } from './hotfoot.ts';
import { ignition } from './ignition.ts';
import { lightningStab } from './lightning-stab.ts';
import { lightningStrike } from './lightning-strike.ts';
import { magneticMark } from './magnetic-mark.ts';
import { maelstrom } from './maelstrom.ts';
import { martialExpertise } from './martial-expertise.ts';
import { mathematician } from './mathematician.ts';
import { momentum } from './momentum.ts';
import { movePlus1 } from './move-plus-1.ts';
import { movePlus2 } from './move-plus-2.ts';
import { powerAttack } from './power-attack.ts';
import { precisionFire } from './precision-fire.ts';
import { quickstep } from './quickstep.ts';
import { sculptedEnhancement } from './sculpted-enhancement.ts';
import { shadowStitch } from './shadow-stitch.ts';
import { slipFree } from './slip-free.ts';
import { smolder } from './smolder.ts';
import { stealBuffs } from './steal-buffs.ts';
import { stealHeart } from './steal-heart.ts';
import { stealHp } from './steal-hp.ts';
import { stealMp } from './steal-mp.ts';
import { sowDoubt } from './sow-doubt.ts';
import { auraMastery } from './aura-mastery.ts';
import { resistanceSaveReaction } from './resistance-save.ts';
import { shortCharge } from './short-charge.ts';
import { spark } from './spark.ts';
import { speedSaveReaction } from './speed-save.ts';
import { stasisSword } from './stasis-sword.ts';
import { staticEmbrace } from './static-embrace.ts';
import { stormCaller } from './storm-caller.ts';
import { targetedTreatment } from './targeted-treatment.ts';
import { taunt } from './taunt.ts';
import { thoughtfulPacing } from './thoughtful-pacing.ts';
import { throwItem } from './throw-item.ts';
import { tidalPull } from './tidal-pull.ts';
import { tidalWave } from './tidal-wave.ts';
import { tideSurge } from './tide-surge.ts';
import { tidewalker } from './tidewalker.ts';
import { twoWeapons } from './two-weapons.ts';
import { undermine } from './undermine.ts';
import { vantage } from './vantage.ts';
import { wandOfDeepwoodApplyShift } from './wand-of-deepwood-apply-shift.ts';
import { wandOfLumenApplyShift } from './wand-of-lumen-apply-shift.ts';
import { wandOfDepthsApplyShift } from './wand-of-depths-apply-shift.ts';
import { wandOfPotentialApplyShift } from './wand-of-potential-apply-shift.ts';
import { waterStrike } from './water-strike.ts';
import { pillar } from './worldcraft/pillar.ts';
import { pit } from './worldcraft/pit.ts';
import { hill } from './worldcraft/hill.ts';
import { valley } from './worldcraft/valley.ts';
import { barrier } from './worldcraft/barrier.ts';
// TABA chapter-1 plot-unit signatures (free innate, unit-specific).
import { ascendantFlame } from './ascendant-flame.ts';
import { bulwarkOath } from './bulwark-oath.ts';
import { tidalCadence } from './tidal-cadence.ts';
import { hamstring } from './hamstring.ts';

export const abilities: ReadonlyArray<AbilityDefinition> = [
  // TABA plot-unit signatures.
  ascendantFlame,
  bulwarkOath,
  tidalCadence,
  hamstring,
  aetherBloom,
  applyBurnProc,
  applySilenceProc,
  // TABA M3 — the Dagger's 50% on-hit Vulnerable rider.
  applyVulnerableProc,
  // TABA M3 Stage 4 — Scouring Wand shred, Void Robe mark, Palliative
  // Pike's ally-only heal pulse.
  applyScouredProc,
  voidVulnerableProc,
  palliativePulse,
  attack,
  barehanded,
  bearsHeave,
  chakra,
  counterpunch,
  counterpunchStrike,
  foxfire,
  serpentsCoil,
  stormStoop,
  vigilance,
  bedrockStride,
  blowdart,
  bolt,
  bravestrider,
  brine,
  bullRush,
  chainLightning,
  combatFocusReaction,
  compound,
  conductor,
  corneredFocusReaction,
  counter,
  cure,
  damageReduction,
  damageSplit,
  engineeredDefensesAbility,
  exactRhythm,
  discharge,
  dischargeStrike,
  earthBlessing,
  earthCataclysm,
  enchantHaste,
  enchantProtect,
  enchantShell,
  esuna,
  earthCommunion,
  earthCurse,
  earthQuake,
  earthResilience,
  earthStrike,
  fieldKit,
  fieldRecovery,
  fireEmbrace,
  fireStorm,
  fireStrike,
  flameLance,
  fleetOfFoot,
  float,
  flowState,
  fly,
  hotfoot,
  ignition,
  lightningStab,
  lightningStrike,
  magneticMark,
  maelstrom,
  martialExpertise,
  mathematician,
  movePlus1,
  powerAttack,
  precisionFire,
  quickstep,
  sculptedEnhancement,
  shadowStitch,
  smolder,
  sowDoubt,
  auraMastery,
  resistanceSaveReaction,
  shortCharge,
  spark,
  speedSaveReaction,
  stasisSword,
  staticEmbrace,
  stormCaller,
  targetedTreatment,
  taunt,
  thoughtfulPacing,
  throwItem,
  chargedAttack,
  eagleEye,
  highJump,
  pinDown,
  scramble,
  undertow,
  updraftReaction,
  tidalPull,
  tidalWave,
  tideSurge,
  tidewalker,
  twoWeapons,
  undermine,
  vantage,
  wandOfDeepwoodApplyShift,
  wandOfDepthsApplyShift,
  wandOfLumenApplyShift,
  wandOfPotentialApplyShift,
  waterStrike,
  pillar,
  pit,
  hill,
  valley,
  barrier,
  ignoreHeight,
  expertFormer,
  // Session 62 — Templar arc foundation.
  faithstrider,
  monkeygrip,
  raise,
  emissary,
  unifiedCalling,
  jump,
  // Thief (12th class) — Thief Arts actives + the three native RSM.
  stealHp,
  stealMp,
  stealBuffs,
  stealHeart,
  slipFree,
  momentum,
  movePlus2,
];
