// A plain JSON import, not a runtime fs-read off `import.meta.url` — the
// latter is ESM-only and would need CJS interop shimming to work in the
// dual-format build. tsup/esbuild inline the JSON at build time for both
// the ESM and CJS outputs, so there's no runtime path resolution at all.
import pkg from '../package.json' with { type: 'json' }

export const name: string = pkg.name
export const version: string = pkg.version
