// Ivalician name pool — the source of unit names for both the team
// builder's auto-population and the AI's Red roster.
//
// Per Session 38 (decision 1, revised in plan-review): a single shared
// pool, FFT/Ivalician-flavored, no per-class buckets. The convention
// coordinates with the guide project's Gariland Academy framing — see
// `guide/CLAUDE.md`.
//
// **Naming policy:** entries preserve the Mediterranean / Old-French
// phoneme palette Ivalice trades on, but **avoid canonical character
// names from FFT and the broader Ivalice multiverse** (FFXII, FFTA,
// FFTA2). The instructor's roster shouldn't surprise players with
// "wait, Ramza and Cidolfas are on the same team?" Original names with
// the same phonetic feel land instead. Adding an entry: same palette
// (V / L / M / R / S / -ia / -as / -el / -in), no canonical overlap.
//
// Names are first-name only; the unit-name field is a short single
// token. Authored values stay under the 24-character cap the team
// builder enforces.
//
// Public API: `pickName` and `pickTeamNames` from `./pick-name.ts`.

export const ivalicianNames: ReadonlyArray<string> = [
  // Original Ivalician-style names — Mediterranean / Old-French palette
  // without canonical FFT / FFXII / FFTA / FFTA2 overlap.
  'Adrien',
  'Alessio',
  'Aldric',
  'Aldwin',
  'Alistair',
  'Ariane',
  'Auralia',
  'Brienne',
  'Caedric',
  'Calista',
  'Constanza',
  'Cyrille',
  'Dorian',
  'Eustache',
  'Fabienne',
  'Fenella',
  'Galen',
  'Gareth',
  'Halric',
  'Helia',
  'Joaquim',
  'Linnea',
  'Liorel',
  'Maerwynn',
  'Marella',
  'Mariel',
  'Marisol',
  'Marius',
  'Mireille',
  'Morgaine',
  'Octavia',
  'Ostara',
  'Percival',
  'Reinhardt',
  'Renaud',
  'Roderic',
  'Rosalind',
  'Sabela',
  'Selene',
  'Severin',
  'Sylvain',
  'Talia',
  'Theron',
  'Thibault',
  'Tobias',
  'Valeria',
  'Vespasia',
  'Vionne',
  'Wymar',
  'Ysolde',
  'Yvain',
];

export { pickName, pickTeamNames, type Rng } from './pick-name.ts';
