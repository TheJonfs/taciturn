// Controllers public surface. Each controller adapts its source of
// decisions (UI clicks, AI heuristics) to the orchestrator's
// `Controller` interface defined in `src/app/demo/orchestrator.ts`.

export { createUiController, type UiController } from './ui-controller.ts';
