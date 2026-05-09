// Names of computed unit stats addressed by `modifyStatQuery` hooks.
// See docs/design/status-effects.md ("Initial hook list").
//
// Closed union — extending it is a deliberate change, made when a new
// stat's consumer arrives. Each addition is one edit here; existing
// handlers stay valid because they discriminate on `args.statName`.
//
// Consumers:
// - 'spd'           — engine/ct/speed.ts (computeSpeed), session 1.
// - 'moveRange'     — engine/map/movement-profile.ts, session 4.
// - 'jump'          — engine/map/movement-profile.ts, session 4.
// - 'pa', 'ma'      — engine/damage/ pipeline base handlers, session 8.
// - 'maxHp'         — engine/damage/ pipeline cap stage (healing), session 8.
// - 'brave', 'faith' — added 13.7. Consumers ship in session 14
//   (Faith_factor in magical damage / status application formulas;
//   Brave/100 in reaction trigger chance and certain physical formulas).
//   No v1 status modifies brave or faith yet; the hook surface is here
//   so the modify-stat-query path is uniform when it arrives.
// - 'crit_chance', 'crit_multiplier' — added session 20. Consumed by the
//   `crit_roll` damage-pipeline handler at the variance stage. crit_chance
//   is read as a percentage in [0, 100]; values <= 0 short-circuit (no
//   crit). crit_multiplier is the damage multiplier applied on a
//   successful crit roll. Crit_modifier status (Lightning Buff) raises
//   crit_chance via this hook; future Lightning content / equipment may
//   raise either. Per ADR-0032.

export type StatName =
  | 'spd'
  | 'moveRange'
  | 'jump'
  | 'pa'
  | 'ma'
  | 'maxHp'
  | 'brave'
  | 'faith'
  | 'crit_chance'
  | 'crit_multiplier';
