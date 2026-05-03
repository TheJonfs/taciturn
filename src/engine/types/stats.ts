// Per-unit numeric attributes.
//
// `BaseStats` are stored values that change at progression boundaries
// (level-up, equipment swap), not during a single turn. Effective stats
// (current Speed, max HP, etc.) are computed on read; never stored.
// See CLAUDE.md ground rule 5.
//
// Only `spd` is consumed in session 1. Other stats are added as the
// systems that read them land (PA/MA in the damage pipeline, session 8).

export interface BaseStats {
  readonly spd: number;
}

export interface Vitals {
  hp: number;
  mp: number;
}
