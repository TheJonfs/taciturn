// Per-unit numeric attributes.
//
// `BaseStats` are stored values that change at progression boundaries
// (level-up, equipment swap), not during a single turn. Effective stats
// (current Speed, max HP, etc.) are computed on read; never stored.
// See CLAUDE.md ground rule 5.
//
// Session 8 added pa/ma/maxHpBase to feed the damage pipeline. Their
// effective values flow through `modifyStatQuery` exactly like spd —
// the `.Base` suffix on `maxHpBase` distinguishes the *stored* baseline
// from the *computed* `maxHp` query (StatName: 'maxHp'). pa and ma are
// stored under their query names (no suffix) since the v1 hook surface
// happens to query the same name as the stored field.

export interface BaseStats {
  readonly spd: number;
  // Physical attack — the attacker-side primary scaler for physical
  // damage formulas (FFT-flavored PA × WP at the v1 base stage).
  readonly pa: number;
  // Magical attack — symmetric scaler for magical damage and healing.
  readonly ma: number;
  // Stored maxHp baseline; the *effective* max HP is the computed
  // `maxHp` query (modifyStatQuery hook chain) consumed by healing's
  // cap stage. Damage's lower-bound cap is 0 and doesn't read this.
  readonly maxHpBase: number;
}

export interface Vitals {
  hp: number;
  mp: number;
}
