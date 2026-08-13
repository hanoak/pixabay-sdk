import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // Lets `vitest run` succeed on a subset with zero matching test files
    // (e.g. filtered runs) instead of exiting non-zero.
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      thresholds: {
        // Lower than the sibling project's 90 by deliberate choice, not as a
        // red-build workaround: tests here stay bare-minimal (one case per
        // meaningful behavior, not exhaustive edge/branch enumeration), so a
        // 90 floor would force padding tests just to hit a number. This still
        // catches the real regression this floor exists for — a new module
        // landing with no tests at all. Recalibrate in Phase 7 to just below
        // what the full v1 suite achieves; never lower it after that to turn
        // a red build green.
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
})
