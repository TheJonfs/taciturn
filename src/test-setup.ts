// Vitest setup — runs once per test file before the suite.
//
// jsdom does not implement `HTMLCanvasElement.prototype.getContext`, so
// any test whose import graph reaches pixi.js (e.g. `App.test.tsx` ->
// `BattleView` -> pixi) emits a "Not implemented" stderr line at import
// time. The tests in question never mount a live Pixi `Application`;
// the line is pure import-time noise. Stubbing the getter to return
// `null` silences it without changing behaviour — `null` is exactly
// what jsdom's unimplemented stub would have returned. (S33.5A carry.)

HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;

// `.test.tsx` files drive React with bare `react-dom/client` + `act`
// (the repo has no @testing-library). React only treats `act` as
// configured when this global is set; without it every `act` call
// emits a "not configured to support act(...)" stderr line.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
