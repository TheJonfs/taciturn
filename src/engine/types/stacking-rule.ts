// Stacking rules — what happens when a status type is applied to a unit
// that already carries an instance of that type.
// See docs/design/status-effects.md ("Stacking rules").

export type StackingRule =
  | 'REFRESH' // existing instance's duration resets; magnitude unchanged (most common)
  | 'REPLACE_IF_STRONGER' // new replaces existing iff new magnitude > existing
  | 'REPLACE' // new unconditionally replaces existing
  | 'STACK_INDEPENDENT' // multiple instances coexist; each with own duration/magnitude
  | 'STACK_ADDITIVE' // single instance; magnitudes sum; duration refreshes; stack count stays at 1
  | 'STACK_COUNT_ADDITIVE' // single instance; stack count increments; magnitude is per-stack constant; duration refreshes (per ADR-0018; first consumer is Burn in session 19)
  | 'REJECT'; // new application rejected if any existing instance present
