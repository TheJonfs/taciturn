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

export type StatName = 'spd' | 'moveRange' | 'jump' | 'pa' | 'ma' | 'maxHp' | 'brave' | 'faith';
