// CT system constants — only the truly rigid one remains here.
// See docs/design/ct-system.md ("Rigid substrate" vs. "Parameterizable
// elements") and ADR-0008.
//
// `SPEED_FLOOR` and the projection-after-trigger CT cost moved to the
// active ruleset in session 6 (RulesetDefinition.speedBounds.floor and
// .ctCosts.moveAndAct respectively); they are addressable per battle.
// `TRIGGER_THRESHOLD` stays here because the design doc names it as
// rigid: "100 threshold is rigid; Speed and CT pushes cover the design
// space."

// The universal trigger threshold. Rigid by design — abilities operate
// on Speed and CT pushes; the threshold itself is never modified.
export const TRIGGER_THRESHOLD = 100;
