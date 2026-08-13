import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // No source or tests exist yet (Phase 1 scaffold) — without this, `vitest run`
    // exits non-zero on zero test files, which would falsely redden `npm run check`
    // before Phase 2 lands anything to test.
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      thresholds: {
        // Placeholder floor ported from the sibling project's aspiration, not yet
        // measured against a real suite (there is none). Recalibrate in Phase 7 to
        // just below what the real suite achieves — never lower it after that to
        // turn a red build green.
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },
  },
})
