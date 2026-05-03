// Names of computed unit stats addressed by `modifyStatQuery` hooks.
// See docs/design/status-effects.md ("Initial hook list").
//
// Closed union — extending it is a deliberate change, made when a new
// stat's consumer arrives. Today only Speed has a consumer (CT system).
// Sessions 4/5/8 add the others (move/jump/pa/ma/accuracy/evasion/...).

export type StatName = 'spd';
