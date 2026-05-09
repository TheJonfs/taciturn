import type { AbilityDefinition } from '@engine/index.ts';
import { aetherBloom } from './aether-bloom.ts';
import { attack } from './attack.ts';
import { bolt } from './bolt.ts';
import { brine } from './brine.ts';
import { bulwarkStance } from './bulwark-stance.ts';
import { chainLightning } from './chain-lightning.ts';
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
import { fireEmbrace } from './fire-embrace.ts';
import { fireStorm } from './fire-storm.ts';
import { fireStrike } from './fire-strike.ts';
import { flameLance } from './flame-lance.ts';
import { float } from './float.ts';
import { flowState } from './flow-state.ts';
import { fly } from './fly.ts';
import { ignition } from './ignition.ts';
import { lightningStrike } from './lightning-strike.ts';
import { magneticMark } from './magnetic-mark.ts';
import { maelstrom } from './maelstrom.ts';
import { movePlus1 } from './move-plus-1.ts';
import { powerAttack } from './power-attack.ts';
import { smolder } from './smolder.ts';
import { spark } from './spark.ts';
import { stasisSword } from './stasis-sword.ts';
import { staticEmbrace } from './static-embrace.ts';
import { stormCaller } from './storm-caller.ts';
import { taunt } from './taunt.ts';
import { tidalPull } from './tidal-pull.ts';
import { tidalWave } from './tidal-wave.ts';
import { tideSurge } from './tide-surge.ts';
import { waterStrike } from './water-strike.ts';

export const abilities: ReadonlyArray<AbilityDefinition> = [
  aetherBloom,
  attack,
  bolt,
  brine,
  bulwarkStance,
  chainLightning,
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
  fireEmbrace,
  fireStorm,
  fireStrike,
  flameLance,
  float,
  flowState,
  fly,
  ignition,
  lightningStrike,
  magneticMark,
  maelstrom,
  movePlus1,
  powerAttack,
  smolder,
  spark,
  stasisSword,
  staticEmbrace,
  stormCaller,
  taunt,
  tidalPull,
  tidalWave,
  tideSurge,
  waterStrike,
];
