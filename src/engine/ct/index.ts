// Public API of src/engine/ct.
// See docs/design/ct-system.md.

export { TRIGGER_THRESHOLD } from './constants.ts';
export { computeActionSpeed, computeSpeed } from './speed.ts';
export {
  nextEvent,
  projectUpcoming,
  ticksUntilTrigger,
  type ProjectedEntityKind,
  type ProjectedEvent,
} from './projection.ts';
