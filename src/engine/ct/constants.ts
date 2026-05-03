// CT system constants.
// See docs/design/ct-system.md.

// The universal trigger threshold. Rigid by design — abilities operate on
// Speed and CT pushes; the threshold itself is never modified.
export const TRIGGER_THRESHOLD = 100;

// Speed floor. Stop status sets a unit's effective Speed to this value;
// negative speeds are not allowed.
export const SPEED_FLOOR = 0;

// Projection-after-trigger CT cost (ADR-0003).
// Represents the cost of a full Move + Act turn. When the Ruleset lands
// (session 6), this becomes a per-battle parameter; until then, the
// projection assumes the most expensive common turn so the queue acts as
// a conservative tempo forecast.
export const ASSUMED_TURN_CT_COST = 100;
