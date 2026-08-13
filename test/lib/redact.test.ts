import { describe, expect, it } from 'vitest'
import { createRedactor } from '../../src/lib/redact.js'

describe('createRedactor', () => {
  it('strips every occurrence of the apiKey, including its URL-encoded form', () => {
    const redactor = createRedactor('key with spaces')
    const encoded = encodeURIComponent('key with spaces')
    expect(redactor.redact(`key=${encoded}, again key=${encoded}, literal=key with spaces`)).toBe(
      'key=[REDACTED], again key=[REDACTED], literal=[REDACTED]',
    )
  })

  it('is a no-op passthrough for a trivially short apiKey (guards against mangling unrelated text)', () => {
    const redactor = createRedactor('abc')
    expect(redactor.redact('abc def abc')).toBe('abc def abc')
  })
})
