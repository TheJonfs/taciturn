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

// jsdom (as configured) does not expose Web Storage, but the TABA campaign
// autosave (`src/campaign/persistence.ts`) needs `localStorage`. Install a
// minimal in-memory Storage so persistence round-trips are testable; the
// real app uses the browser's localStorage. Defined unconditionally via
// `defineProperty` so we never read Node's experimental `localStorage`
// getter (which warns about `--localstorage-file`).
class MemoryStorage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}
Object.defineProperty(globalThis, 'localStorage', {
  value: new MemoryStorage() as unknown as Storage,
  configurable: true,
  writable: true,
});
