import type { StatusEffectType } from '@engine/index.ts';
import { blind } from './blind.ts';
import { braveDown } from './brave-down.ts';
import { burn } from './burn.ts';
import { charging } from './charging.ts';
import { combatFocus } from './combat-focus.ts';
import { corneredFocus } from './cornered-focus.ts';
import { critModifier } from './crit-modifier.ts';
import { engineeredDefenses } from './engineered-defenses.ts';
import { dontAct } from './dont-act.ts';
import { dontMove } from './dont-move.ts';
import { enthralled } from './enthralled.ts';
import { faithDown } from './faith-down.ts';
import { haste } from './haste.ts';
import { heartwarded } from './heartwarded.ts';
import { maDown } from './ma-down.ts';
import { maUp } from './ma-up.ts';
import { manaFont } from './mana-font.ts';
import { movementDebuff } from './movement-debuff.ts';
import { movementSelfBuff } from './movement-self-buff.ts';
import { paDown } from './pa-down.ts';
import { paUp } from './pa-up.ts';
import { poison } from './poison.ts';
import { protect } from './protect.ts';
import { protectCast } from './protect-cast.ts';
import { quickening } from './quickening.ts';
import { regen } from './regen.ts';
import { regenAuto } from './regen-auto.ts';
import { resistanceSave } from './resistance-save.ts';
import { shell } from './shell.ts';
import { shellCast } from './shell-cast.ts';
import { silence } from './silence.ts';
import { slow } from './slow.ts';
import { speedDown } from './speed-down.ts';
import { speedSave } from './speed-save.ts';
import { stop } from './stop.ts';
import { updraft } from './updraft.ts';
import { taggedResistanceShift } from './tagged-resistance-shift.ts';
import { taunted } from './taunted.ts';
import { vulnerable } from './vulnerable.ts';
import { foxStance } from './fox-stance.ts';
import { bearStance } from './bear-stance.ts';
import { falconStance } from './falcon-stance.ts';
import { serpentStance } from './serpent-stance.ts';

export const statusTypes: ReadonlyArray<StatusEffectType> = [
  blind,
  braveDown,
  burn,
  foxStance,
  bearStance,
  falconStance,
  serpentStance,
  charging,
  combatFocus,
  corneredFocus,
  critModifier,
  engineeredDefenses,
  dontAct,
  dontMove,
  enthralled,
  faithDown,
  haste,
  heartwarded,
  maDown,
  maUp,
  manaFont,
  movementDebuff,
  movementSelfBuff,
  paDown,
  paUp,
  poison,
  protect,
  protectCast,
  quickening,
  regen,
  regenAuto,
  resistanceSave,
  shell,
  shellCast,
  silence,
  slow,
  speedDown,
  speedSave,
  stop,
  updraft,
  taggedResistanceShift,
  taunted,
  vulnerable,
];
