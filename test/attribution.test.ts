import { describe, expect, it } from 'vitest'
import { formatAttribution } from '../src/attribution.js'

describe('formatAttribution', () => {
  it('credits the contributor when `user` is present', () => {
    expect(formatAttribution({ user: 'Josch13' })).toBe('by Josch13 via Pixabay')
  })

  it('falls back to a plain credit when `user` is absent', () => {
    expect(formatAttribution({})).toBe('via Pixabay')
  })
})
