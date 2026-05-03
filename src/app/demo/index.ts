// Public surface of the demo orchestration. Drives a scripted battle
// end-to-end so the renderer has visible content. v1 only — sessions 11
// (UI) and 12 (AI) replace the controllers; the orchestrator stays.

export { DemoOrchestrator, type Controller, type ControllerMap, type OrchestratorStep } from './orchestrator.ts';
export { greedyMeleeController } from './controller.ts';
