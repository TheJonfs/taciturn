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
  // Character-layer stats. Stored on BaseStats for v1 simplicity; their
  // "character layer" property in the design (durability across battles,
  // class changes, equipment swaps) describes their progression model,
  // not where they're laid out on the per-battle Unit. Consumers ship
  // in session 14 (Faith_factor in magical formulas, Brave/100 in
  // reaction trigger chance). Range [1, 100]; v1 test units default to
  // brave 100 (deterministic Counter triggering) and faith 70 (typical
  // mid-tier).
  readonly brave: number;
  readonly faith: number;
}

export interface Vitals {
  hp: number;
  mp: number;
}
