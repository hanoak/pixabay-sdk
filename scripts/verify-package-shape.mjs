// Verifies the built package actually resolves via both module systems — the
// dual-format equivalent of the sibling MCP server's stdout-purity child-process
// test. Runs against the real dist/ output (via check:package, after a fresh
// build), not vitest's TS-transform pipeline, so it can only catch dist/-shape
// bugs vitest's source-level tests never would (e.g. the exports-map mismatch
// publint/attw already validate separately — this is the runtime-resolution
// half of that same concern).
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const esm = await import('../dist/index.js')
assert.equal(typeof esm.PixabayClient, 'function', 'ESM import() should resolve PixabayClient')
assert.equal(typeof esm.version, 'string', 'ESM import() should resolve version')

const require = createRequire(import.meta.url)
const cjs = require('../dist/index.cjs')
assert.equal(typeof cjs.PixabayClient, 'function', 'CJS require() should resolve PixabayClient')
assert.equal(typeof cjs.version, 'string', 'CJS require() should resolve version')

console.log('package shape OK: both require() and import() resolve dist/ correctly')
