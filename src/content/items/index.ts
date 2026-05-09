import type { ItemDefinition } from '@engine/index.ts';
import { bootsOfHaste } from './boots-of-haste.ts';
import { ironHelm } from './iron-helm.ts';
import { ironMail } from './iron-mail.ts';
import { longSword } from './long-sword.ts';
import { strengthRing } from './strength-ring.ts';

export const items: ReadonlyArray<ItemDefinition> = [
  longSword,
  strengthRing,
  bootsOfHaste,
  ironHelm,
  ironMail,
];
