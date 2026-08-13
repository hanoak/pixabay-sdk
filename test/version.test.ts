import { describe, expect, it } from 'vitest'
import { name, version } from '../src/version.js'

describe('version', () => {
  it('reads the real package name and version', () => {
    expect(name).toBe('@hanoak/pixabay-sdk')
    expect(version).toMatch(/^\d+\.\d+\.\d+/)
  })
})
