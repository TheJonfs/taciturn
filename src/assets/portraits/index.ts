// Portrait asset URL map per class id. Vite resolves the `?url` suffix
// to the final hashed asset URL at build time; consumers (renderer for
// canvas via Pixi `Assets.load`, React for HTML `<img src>`) read the
// same URL.
//
// Per session 24.5: portraits are square PNGs at native resolution (~4MB
// each). Pixi downscales for the map token (~32px); React `<img>` with
// CSS sizing handles the queue tower / unit detail variants.
//
// Falls back to the existing colored-circle render when a class id has
// no entry. Missing-asset case is a renderer concern, not handled here.

import alchemistUrl from './alchemist.png';
import assassinUrl from './assassin.png';
import earthMageUrl from './earth-mage.png';
import fireMageUrl from './fire-mage.png';
import hunterUrl from './hunter.png';
import knightUrl from './knight.png';
import lightningMageUrl from './lightning-mage.png';
import waterMageUrl from './water-mage.png';
import { classId, type ClassId } from '@engine/index.ts';

export const PORTRAIT_URLS: ReadonlyMap<ClassId, string> = new Map([
  [classId('alchemist'), alchemistUrl],
  [classId('assassin'), assassinUrl],
  [classId('earth_mage'), earthMageUrl],
  [classId('fire_mage'), fireMageUrl],
  [classId('hunter'), hunterUrl],
  [classId('knight'), knightUrl],
  [classId('lightning_mage'), lightningMageUrl],
  [classId('water_mage'), waterMageUrl],
]);

// Convenience accessor: returns the portrait URL for a class, or `null`
// when the class has no portrait registered (renderer falls back to
// the colored-circle treatment).
export function portraitUrlFor(id: ClassId): string | null {
  return PORTRAIT_URLS.get(id) ?? null;
}
