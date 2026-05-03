// Public API of src/engine/ct.
// See docs/design/ct-system.md.

export { ASSUMED_TURN_CT_COST, SPEED_FLOOR, TRIGGER_THRESHOLD } from './constants.ts';
export { computeActionSpeed, computeSpeed } from './speed.ts';
export {
  nextEvent,
  projectUpcoming,
  ticksUntilTrigger,
  type ProjectedEntityKind,
  type ProjectedEvent,
} from './projection.ts';
