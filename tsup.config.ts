import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  target: 'node22',
  dts: true,
  sourcemap: true,
  clean: true,
  shims: false,
  // Explicit, not left to package.json's "type" field to imply: import resolves
  // dist/index.js, require resolves dist/index.cjs, matching the exports map.
  outExtension({ format }) {
    return { js: format === 'cjs' ? '.cjs' : '.js' }
  },
})
