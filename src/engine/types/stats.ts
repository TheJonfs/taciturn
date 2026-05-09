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
  // not where they're laid out on the per-battle Unit. Consumers
  // landed in session 14: Faith_factor in magical damage / healing
  // formulas; Brave/100 in reaction trigger chance. Range [1, 100].
  //
  // v1 test units default to brave 100 (deterministic Counter triggering
  // — see docs/battle-mechanics-guide.md "Reaction trigger chance") and
  // faith 80 (placeholder — produces Faith_factor 0.64 for symmetric
  // demo casts; visible damage/heals without overpowering them). The
  // 80 default is a tuning placeholder; realistic faith spreads land
  // with the content/tuning passes in sessions 16+ as classes ship and
  // playtest reveals appropriate ranges. Brave's similar tuning question
  // applies once non-100-Brave content arrives.
  readonly brave: number;
  readonly faith: number;
  // Crit infrastructure (session 20). `crit_chance` is a percentage in
  // [0, 100]; the `crit_roll` damage-pipeline handler reads it via
  // `modifyStatQuery` (so Crit_modifier and future buffs compose) and
  // rolls a deterministic per-attack RNG against it. `crit_multiplier`
  // is applied to damage when the roll lands. Both compose with variance
  // and resistance — crit is layered on top of all other multipliers
  // per ADR-0032. v1 placement convention: tuned content (demo battle
  // / Lightning Mage) sets `crit_chance: 5, crit_multiplier: 1.5`;
  // existing fixtures and pre-tuning content use `0 / 1` to preserve
  // deterministic damage values. The handler short-circuits on
  // `crit_chance <= 0`, so the `0 / 1` shape produces zero crits even
  // if a future Crit_modifier buff bumps the queried multiplier.
  readonly crit_chance: number;
  readonly crit_multiplier: number;
}

export interface Vitals {
  hp: number;
  mp: number;
}

// Equipment / status / passive stat-mod input. Sparse: only the stats
// the modifier touches are present. Composes additively against
// `BaseStats` via `modifyStatQuery` handlers (per ADR-0028). Sentinel
// values are omitted; consumers default missing entries to 0.
export type PartialBaseStats = Partial<BaseStats>;
