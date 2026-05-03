// Sentinel test: confirms Vitest is wired up and can discover tests in src/engine/.
// Replace or remove once real engine tests exist.

describe('test harness', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
