// Stacking rules — what happens when a status type is applied to a unit
// that already carries an instance of that type.
// See docs/design/status-effects.md ("Stacking rules").

export type StackingRule =
  | 'REFRESH' // existing instance's duration resets; magnitude unchanged (most common)
  | 'REPLACE_IF_STRONGER' // new replaces existing iff new magnitude > existing
  | 'REPLACE' // new unconditionally replaces existing
  | 'STACK_INDEPENDENT' // multiple instances coexist; each with own duration/magnitude
  | 'STACK_ADDITIVE' // magnitudes add; duration refreshes
  | 'REJECT'; // new application rejected if any existing instance present
