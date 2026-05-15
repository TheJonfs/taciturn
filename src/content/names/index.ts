// Ivalician name pool — the source of unit names for both the team
// builder's auto-population and the AI's Red roster.
//
// Per Session 38 (decision 1, revised in plan-review): a single shared
// pool, FFT/Ivalician-flavored, no per-class buckets. The convention
// coordinates with the guide project's Gariland Academy framing — see
// `guide/CLAUDE.md`.
//
// Names are first-name only; the unit-name field is a short single
// token. Authored values stay under the 24-character cap the team
// builder enforces. New entries should preserve the Mediterranean /
// Old-French phoneme set Ivalician trades on (V / L / M / R / S
// consonants, -ia / -as / -el / -in endings).
//
// Public API: `pickName` and `pickTeamNames` from `./pick-name.ts`.

export const ivalicianNames: ReadonlyArray<string> = [
  // FFT principals
  'Ramza',
  'Delita',
  'Cidolfas',
  'Agrias',
  'Mustadio',
  'Ovelia',
  'Wiegraf',
  'Beowulf',
  'Reis',
  'Meliadoul',
  'Rapha',
  'Marach',
  'Alma',
  'Olan',
  'Tietra',
  'Argath',
  // FFXII / FFTA / FFTA2
  'Larsa',
  'Ashe',
  'Basch',
  'Vaan',
  'Penelo',
  'Fran',
  'Balthier',
  'Vossler',
  'Marche',
  'Ritz',
  'Adelle',
  'Luso',
  'Hurdy',
  'Reks',
  // Ivalician-flavored additions, same phoneme palette
  'Maerwynn',
  'Caedric',
  'Ostara',
  'Joaquim',
  'Selene',
  'Auralia',
  'Morgaine',
  'Roderic',
  'Talia',
  'Yvain',
  'Fenella',
  'Gareth',
  'Dorian',
  'Liorel',
  'Cyrille',
  'Alessio',
  'Brienne',
  'Tobias',
  'Marisol',
  'Halric',
];

export { pickName, pickTeamNames, type Rng } from './pick-name.ts';
