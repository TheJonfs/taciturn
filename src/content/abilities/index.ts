import type { AbilityDefinition } from '@engine/index.ts';
import { aetherBloom } from './aether-bloom.ts';
import { applyBurnProc } from './apply-burn-proc.ts';
import { applySilenceProc } from './apply-silence-proc.ts';
import { attack } from './attack.ts';
import { bedrockStride } from './bedrock-stride.ts';
import { bolt } from './bolt.ts';
import { brine } from './brine.ts';
import { bulwarkStance } from './bulwark-stance.ts';
import { chainLightning } from './chain-lightning.ts';
import { combatFocusReaction } from './combat-focus.ts';
import { compound } from './compound.ts';
import { conductor } from './conductor.ts';
import { counter } from './counter.ts';
import { cure } from './cure.ts';
import { damageReduction } from './damage-reduction.ts';
import { discharge } from './discharge.ts';
import { dischargeStrike } from './discharge-strike.ts';
import { earthBlessing } from './earth-blessing.ts';
import { earthCataclysm } from './earth-cataclysm.ts';
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
import { float } from './float.ts';
import { flowState } from './flow-state.ts';
import { fly } from './fly.ts';
import { hotfoot } from './hotfoot.ts';
import { ignition } from './ignition.ts';
import { lightningStrike } from './lightning-strike.ts';
import { magneticMark } from './magnetic-mark.ts';
import { maelstrom } from './maelstrom.ts';
import { movePlus1 } from './move-plus-1.ts';
import { powerAttack } from './power-attack.ts';
import { quickstep } from './quickstep.ts';
import { smolder } from './smolder.ts';
import { spark } from './spark.ts';
import { stasisSword } from './stasis-sword.ts';
import { staticEmbrace } from './static-embrace.ts';
import { stormCaller } from './storm-caller.ts';
import { taunt } from './taunt.ts';
import { throwItem } from './throw-item.ts';
import { tidalPull } from './tidal-pull.ts';
import { tidalWave } from './tidal-wave.ts';
import { tideSurge } from './tide-surge.ts';
import { tidewalker } from './tidewalker.ts';
import { wandOfDeepwoodApplyShift } from './wand-of-deepwood-apply-shift.ts';
import { wandOfDepthsApplyShift } from './wand-of-depths-apply-shift.ts';
import { waterStrike } from './water-strike.ts';

export const abilities: ReadonlyArray<AbilityDefinition> = [
  aetherBloom,
  applyBurnProc,
  applySilenceProc,
  attack,
  bedrockStride,
  bolt,
  brine,
  bulwarkStance,
  chainLightning,
  combatFocusReaction,
  compound,
  conductor,
  counter,
  cure,
  damageReduction,
  discharge,
  dischargeStrike,
  earthBlessing,
  earthCataclysm,
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
  float,
  flowState,
  fly,
  hotfoot,
  ignition,
  lightningStrike,
  magneticMark,
  maelstrom,
  movePlus1,
  powerAttack,
  quickstep,
  smolder,
  spark,
  stasisSword,
  staticEmbrace,
  stormCaller,
  taunt,
  throwItem,
  tidalPull,
  tidalWave,
  tideSurge,
  tidewalker,
  wandOfDeepwoodApplyShift,
  wandOfDepthsApplyShift,
  waterStrike,
];
